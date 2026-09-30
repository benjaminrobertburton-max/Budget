// Portable accepted anchors live in the authoritative private XLSX, never Git.
// Native custom properties avoid changing any cell, formula, or worksheet.
import JSZip from 'jszip';
import {createHash} from 'node:crypto';
import {workbookXml as X} from './collector_workbook.mjs';
import {requireEvidence as check,CollectionError} from '../collector/src/errors.mjs';
import {normalizeWealthfrontCash,makeWealthfrontCheckpoint,validateWealthfrontCheckpoint} from '../collector/src/wealthfront-normalize.mjs';
import {serialDate} from '../collector/src/workbook-reconcile.mjs';

const PROPERTY='BudgetCollectorWealthfrontCheckpointV1',PART='docProps/custom.xml';
const NS='http://schemas.openxmlformats.org/officeDocument/2006/custom-properties';
const VT='http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes';
const REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties';
const TYPE='application/vnd.openxmlformats-officedocument.custom-properties+xml';
const digest=text=>createHash('sha256').update(text).digest('hex');
const partName=i=>`${PROPERTY}.Part${String(i).padStart(3,'0')}`;
const text=n=>(n?.elements??[]).map(e=>e.type==='text'?e.text:text(e)).join('');
async function snapshot(zip){
  const m=await X.sheetMap(zip),entry=m.map.get('Support - Account Snapshots');
  check(entry,'UNSUPPORTED_WORKBOOK','The accepted cash snapshot sheet is required.');
  const s=X.root(entry.document,'worksheet'),file=zip.file('xl/sharedStrings.xml');
  const strings=file?X.elements(X.root(X.xml(await file.async('string')),'sst')).map(text):[];
  return address=>{const c=X.getCell(s,address);if(!c)return null;
    if(c.attributes.t==='inlineStr')return text(X.child(c,'is'));
    const v=text(X.child(c,'v'));return c.attributes.t==='s'?strings[Number(v)]:c.attributes.t==='str'?v:v===''?null:Number(v);
  };
}
function matchesSnapshot(p,value,binding){
  validateWealthfrontCheckpoint(p);
  const minor=address=>{const v=value(address);return typeof v==='number'&&Number.isFinite(v)?Math.round(v*100):null;};
  check(p.accountId===binding?.accountId&&value('B13')===p.evidenceRef&&value('I13')==='Verified'
    &&value('D13')===p.rowCount&&value('E13')===p.rowCount
    &&minor('F13')===p.activityTotalMinor&&minor('G13')===p.activityTotalMinor
    &&minor('C6')===p.totalMinor&&minor('F6')===p.totalMinor&&minor('D6')===0&&minor('E6')===0
    &&value('A6')===serialDate(p.capturedAt.slice(0,10))
    &&String(value('J13')??'').includes(`Captured ${p.capturedAt}.`),
    'WEALTHFRONT_CHECKPOINT_MISMATCH','The portable checkpoint does not match the accepted workbook snapshot or local account.');
  return p;
}
async function property(zip){
  const part=zip.file(PART);if(!part)return null;
  const props=X.root(X.xml(await part.async('string')),'Properties');
  const owned=X.elements(props).filter(p=>p.attributes?.name===PROPERTY||p.attributes?.name?.startsWith(PROPERTY+'.'));
  const candidates=owned.filter(p=>p.attributes.name===PROPERTY);
  check(candidates.length<=1,'WEALTHFRONT_CHECKPOINT_INVALID','Duplicate workbook checkpoints require review.');
  if(!candidates.length){check(!owned.length,'WEALTHFRONT_CHECKPOINT_INVALID','The checkpoint manifest is missing.');return null;}
  const read=p=>{const children=X.elements(p);check(children.length===1&&X.lname(children[0])==='lpwstr',
    'WEALTHFRONT_CHECKPOINT_INVALID','The checkpoint property type is invalid.');const v=text(children[0]);
    check(v.length<=240,'WEALTHFRONT_CHECKPOINT_INVALID','The checkpoint property exceeds its supported size.');return v;};
  let manifest;try{manifest=JSON.parse(read(candidates[0]));}catch{throw new CollectionError('WEALTHFRONT_CHECKPOINT_INVALID','The checkpoint manifest is unreadable.');}
  check(manifest?.version===1&&Object.keys(manifest).sort().join(',')==='parts,sha256,version'
    &&Number.isInteger(manifest.parts)&&manifest.parts>0&&manifest.parts<=60
    &&/^[a-f0-9]{64}$/.test(manifest.sha256??'')&&owned.length===manifest.parts+1,
    'WEALTHFRONT_CHECKPOINT_INVALID','The checkpoint manifest is invalid.');
  let raw='';for(let i=0;i<manifest.parts;i++){
    const pieces=owned.filter(p=>p.attributes.name===partName(i));check(pieces.length===1,'WEALTHFRONT_CHECKPOINT_INVALID','A checkpoint part is missing or duplicated.');raw+=read(pieces[0]);
  }
  check(raw.length<=12000&&digest(raw)===manifest.sha256,'WEALTHFRONT_CHECKPOINT_INVALID','The checkpoint is incomplete or changed.');
  let p;try{p=JSON.parse(raw);}catch{throw new CollectionError('WEALTHFRONT_CHECKPOINT_INVALID','The checkpoint is unreadable.');}
  return validateWealthfrontCheckpoint(p);
}
export async function readWealthfrontCheckpoint(bytes,binding){
  const zip=await JSZip.loadAsync(bytes),p=await property(zip);
  return p?matchesSnapshot(p,await snapshot(zip),binding):null;
}
export async function resolveWealthfrontPrior(bytes,binding,store){
  const zip=await JSZip.loadAsync(bytes),value=await snapshot(zip),p=await property(zip);
  // An invalid/stale embedded checkpoint never falls back to an older binding.
  if(p)return matchesSnapshot(p,value,binding);
  const ref=value('B13');if(typeof ref!=='string'||!ref.startsWith('local:evidence:')){
    check(value('I13')!=='Verified','WEALTHFRONT_ANCHOR_INVALID','A verified Wealthfront snapshot cannot lose its accepted reference.');
    return null;
  }
  let prior;try{prior=await store.open(ref);}catch{
    throw new CollectionError('WEALTHFRONT_PORTABILITY_REQUIRED','Accepted Wealthfront evidence is unavailable here. Migrate its checkpoint on the originating machine; do not reset its anchor.');
  }
  check(prior?.source==='wealthfront','WEALTHFRONT_ANCHOR_INVALID','Accepted Wealthfront source is invalid.');
  const n=normalizeWealthfrontCash(prior.payload);
  return matchesSnapshot(makeWealthfrontCheckpoint({...n,evidenceRef:ref,capturedAt:prior.capturedAt}),value,binding);
}
export async function embedWealthfrontCheckpoint(bytes,checkpoint){
  const p=validateWealthfrontCheckpoint(checkpoint),zip=await JSZip.loadAsync(bytes);
  matchesSnapshot(p,await snapshot(zip),{accountId:p.accountId});
  const current=zip.file(PART),doc=current?X.xml(await current.async('string')):{elements:[X.node('Properties',{xmlns:NS,'xmlns:vt':VT})]};
  const props=X.root(doc,'Properties');check(props,'WEALTHFRONT_CHECKPOINT_INVALID','The custom-property package is invalid.');
  props.attributes={...props.attributes,'xmlns:vt':VT};
  const raw=JSON.stringify(p),chunks=[];let chunk='';
  // Excel custom string properties have a 255-character limit. Use <=240
  // UTF-16 units per property, never split surrogate pairs, and verify a digest.
  for(const char of raw){if(chunk.length+char.length>240){chunks.push(chunk);chunk='';}chunk+=char;}if(chunk)chunks.push(chunk);
  props.elements=(props.elements??[]).filter(e=>e.attributes?.name!==PROPERTY&&!e.attributes?.name?.startsWith(PROPERTY+'.'));
  let pid=Math.max(1,...X.elements(props).map(e=>Number(e.attributes?.pid)||0));
  for(const [name,value] of [[PROPERTY,JSON.stringify({version:1,parts:chunks.length,sha256:digest(raw)})],...chunks.map((v,i)=>[partName(i),v])]){
    props.elements.push(X.node('property',{xmlns:NS,fmtid:'{D5CDD505-2E9C-101B-9397-08002B2CF9AE}',pid:++pid,name},
      [X.node('vt:lpwstr',{},[{type:'text',text:value}])]));
  }
  zip.file(PART,X.serial(doc));
  const types=X.xml(await zip.file('[Content_Types].xml').async('string')),typeRoot=X.root(types,'Types');
  const overrides=X.elements(typeRoot).filter(e=>e.attributes?.PartName==='/'+PART);
  check(overrides.length<=1&&(!overrides.length||overrides[0].attributes.ContentType===TYPE),'UNSUPPORTED_WORKBOOK','Conflicting custom-property content type.');
  if(!overrides.length){typeRoot.elements.push(X.node('Override',{xmlns:'http://schemas.openxmlformats.org/package/2006/content-types',PartName:'/'+PART,ContentType:TYPE}));zip.file('[Content_Types].xml',X.serial(types));}
  const relationships=X.xml(await zip.file('_rels/.rels').async('string')),rels=X.root(relationships,'Relationships');
  const links=X.elements(rels).filter(e=>e.attributes?.Type===REL);
  check(links.length<=1&&(!links.length||[PART,'/'+PART].includes(links[0].attributes.Target)&&!links[0].attributes.TargetMode),'UNSUPPORTED_WORKBOOK','Conflicting custom-property relationship.');
  if(!links.length){let id='BudgetCollectorCustomProperties';while(X.elements(rels).some(e=>e.attributes?.Id===id))id+='X';
    rels.elements.push(X.node('Relationship',{xmlns:'http://schemas.openxmlformats.org/package/2006/relationships',Id:id,Type:REL,Target:PART}));zip.file('_rels/.rels',X.serial(relationships));}
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
