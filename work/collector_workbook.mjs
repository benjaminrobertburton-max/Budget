// Collector-to-workbook intake boundary. Artifact Tool authors the intake tab;
// a narrow OOXML merge preserves EVERY original formula/native workbook part.
// This entry point never replaces a live workbook or claims a verified refresh.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {FileBlob,SpreadsheetFile,Workbook} from '@oai/artifact-tool';
import JSZip from 'jszip';
import {xml2js,js2xml} from 'xml-js';
import {requireEvidence as check} from '../collector/src/errors.mjs';
import {assertPrivateDirectory,assertRegularFile} from '../collector/src/private-paths.mjs';
import {openPrivateEvidenceStore} from '../collector/src/private-evidence-store.mjs';
import {windowsProtector} from '../collector/src/protection.mjs';
import {intakeAccounts,prepareWorkbookIntake,validateIntakeBindings} from '../collector/src/workbook-intake.mjs';
import {workbookBytes} from './workbook_bytes.mjs';
import {preparePaypalImport} from '../collector/src/paypal-normalize.mjs';

export const INTAKE_SHEET='Support - Collector Intake';
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const lname=n=>n.name?.split(':').at(-1);
const elements=n=>(n?.elements??[]).filter(e=>e.type==='element');
const child=(n,name)=>elements(n).find(e=>lname(e)===name);
const root=(doc,name)=>elements(doc).find(e=>lname(e)===name);
const xml=text=>xml2js(text,{compact:false});
const serial=doc=>js2xml(doc,{compact:false,
  attributeValueFn:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')});
const node=(name,attributes={},children=[])=>({type:'element',name,attributes,elements:children});
const stringCell=(address,text,style)=>node('c',{xmlns:ns,r:address,t:'inlineStr',...(style!==undefined?{s:style}:{})},
  [node('is',{},[node('t',{'xml:space':'preserve'},[{type:'text',text}])])]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const cellNodes=sheet=>elements(child(sheet,'sheetData')).flatMap(r=>elements(r).filter(c=>lname(c)==='c'));
const getCell=(sheet,address)=>cellNodes(sheet).find(c=>c.attributes?.r===address);
const keyParts=['xl/workbook.xml','xl/_rels/workbook.xml.rels','[Content_Types].xml'];
const updates={
  '1. Start':{
    A2:'Collector import is incomplete. Open Support - Collector Intake. Figures below are the prior review, not a new payment plan.',
    B7:'Import incomplete',C7:'Prior plan; do not execute',B8:'Review intake',
    C8:'See Collector Intake tab',E4:'Prior source checkpoints'},
  '2. Tuesday Review':{A2:'PRIOR REVIEW ONLY — collector intake is not verified. Do not execute this checklist for the new import.'},
};
// Shared native-preservation helpers for the direct ledger importer.
export const workbookXml={ns,lname,elements,child,root,xml,serial,node,stringCell,cellNodes,getCell,sheetMap};
async function sheetMap(zip){
  const document=xml(await zip.file('xl/workbook.xml').async('string'));
  const relationships=xml(await zip.file('xl/_rels/workbook.xml.rels').async('string'));
  const sheets=child(root(document,'workbook'),'sheets');
  const rels=root(relationships,'Relationships');
  const map=new Map();
  for(const sheet of elements(sheets)){
    const rel=elements(rels).find(r=>r.attributes.Id===sheet.attributes['r:id']);
    check(rel&&rel.attributes.TargetMode!=='External','UNSUPPORTED_WORKBOOK','The source worksheet relationship is unsupported.');
    const target=rel.attributes.Target;
    const part=target.startsWith('/')?target.slice(1):path.posix.normalize(path.posix.join('xl',target));
    check(part.startsWith('xl/worksheets/')&&zip.file(part),'UNSUPPORTED_WORKBOOK','The source worksheet is missing.');
    map.set(sheet.attributes.name,{part,document:xml(await zip.file(part).async('string'))});
  }
  return {document,relationships,sheets,rels,map};
}
function updateText(sheet,address,text){
  const old=getCell(sheet,address);
  check(old&&!child(old,'f'),'UNSUPPORTED_WORKBOOK','The current workbook layout differs from the supported import template.');
  const replacement=stringCell(address,text,old.attributes.s);
  // Preserve cell style and all row/column layout; never replace a formula.
  Object.assign(old,replacement);
}
function safeText(value){return typeof value==='string'?"'"+value:value;}

async function authorIntake(intake){
  const wb=Workbook.create(),s=wb.worksheets.add(INTAKE_SHEET);
  const detailStart=23;
  s.getRange('A1:I1').merge();s.getRange('A1').values=[['Collector Intake — review required']];
  s.getRange('A2:I2').merge();s.getRange('A2').values=[['Source capture is not a verified import. No ledger, budget amount, payment confirmation or history entry has been changed.']];
  s.getRange('A4:F4').values=[['Account','Capture time (UTC)','Posted rows','Pending rows','Pending evidence','Status']];
  for(let i=0;i<intake.accounts.length;i++){
    const a=intake.accounts[i],captured=a.capturedAt?'UTC · '+a.capturedAt.slice(0,16).replace('T',' '):'Missing';
    s.getRange(`A${5+i}:F${5+i}`).values=[[a.label,captured,a.posted,a.pending,a.pendingBasis,a.status]];
  }
  s.getRange('A9:D9').values=[['Account','Source balance type','Captured amount (USD)','Source checks']];
  let line=10;
  for(const a of intake.accounts)for(const b of a.balances){
    s.getRange(`A${line}:D${line}`).values=[[a.label,b.type.replaceAll('_',' '),b.amountMinor/100,a.issues.join(', ')||'No parsing issue; import not verified']];line++;
  }
  s.getRange('A20:I20').merge();s.getRange('A20').values=[['Next: reconcile accepted history and pending changes, verify remaining sources, then create a new payment plan.']];
  s.getRange('A22:I22').values=[['Account','Status','Source date','Source description','Source amount (USD)','Source category','Ledger import','Meaning / missing information','Private evidence reference']];
  if(intake.rows.length)s.getRange(`A${detailStart}:I${detailStart+intake.rows.length-1}`).values=intake.rows.map(r=>[
    r.account,r.state,r.date?new Date(r.date+'T00:00:00Z'):null,safeText(r.description),r.amountMinor===null?null:r.amountMinor/100,
    safeText(r.sourceCategory), 'Not imported',r.note,r.evidenceRef]);
  const last=Math.max(23,detailStart+intake.rows.length-1);
  s.getRange(`A1:I${last}`).format={font:{name:'Arial',size:10,color:'#243447'},verticalAlignment:'center',wrapText:true};
  for(const row of [1,4,9,22])s.getRange(`A${row}:I${row}`).format={fill:'#173F5F',font:{bold:true,color:'#FFFFFF'},rowHeight:32};
  s.getRange('A2:I2').format={fill:'#FFF2CC',rowHeight:38};s.getRange('A20:I20').format={fill:'#FFF2CC',rowHeight:34};
  s.getRange('A5:I7').format.rowHeight=46;s.getRange('A10:I18').format.rowHeight=30;
  s.getRange(`A23:I${last}`).format.rowHeight=48;
  s.getRange('C10:C18').setNumberFormat('$#,##0.00;[Red]($#,##0.00);-');
  s.getRange(`E23:E${last}`).setNumberFormat('$#,##0.00;[Red]($#,##0.00);-');
  s.getRange(`C23:C${last}`).setNumberFormat('mmm d, yyyy');
  for(const [col,width] of [['A',21],['B',29],['C',16],['D',38],['E',29],['F',29],['G',17],['H',46],['I',34]])s.getRange(`${col}:${col}`).format.columnWidth=width;
  s.freezePanes.freezeRows(2);s.showGridLines=false;s.tabColor='#566575';
  wb.recalculate();
  return workbookBytes(wb);
}

// Append only the new sheet, borrowing existing styles instead of replacing the
// original styles/theme. Convert new shared strings to inline text: no collisions
// with the original string table; merchant text can never become a formula.
export async function buildCollectorWorkbook(baseBytes,intake){
  check(intake?.kind==='workbook_collector_intake'&&intake.workbookReady===false,
    'INVALID_INTAKE','Only unverified collector intake belongs in this review copy.');
  const base=await JSZip.loadAsync(baseBytes),source=await sheetMap(base);
  check(!source.map.has(INTAKE_SHEET),'INTAKE_ALREADY_PRESENT','Use the original current workbook, not a previous collector review copy.');
  for(const name of ['1. Start','2. Tuesday Review','Support - Ledger','6. History'])
    check(source.map.has(name),'UNSUPPORTED_WORKBOOK','The required existing budget sheets are missing.');
  const ledger=root(source.map.get('Support - Ledger').document,'worksheet');
  const start=root(source.map.get('1. Start').document,'worksheet');
  const style=(s,address)=>getCell(s,address)?.attributes?.s??'0';
  const styles={title:style(start,'A1'),header:style(ledger,'A4'),text:style(ledger,'C5'),
    money:style(ledger,'D5'),date:style(ledger,'B5'),warning:style(start,'C8')};
  const generated=await JSZip.loadAsync(await authorIntake(intake));
  const generatedSheet=xml(await generated.file('xl/worksheets/sheet1.xml').async('string'));
  const sheet=root(generatedSheet,'worksheet');
  const shared=generated.file('xl/sharedStrings.xml');
  const strings=shared?elements(root(xml(await shared.async('string')),'sst')):[];
  for(const c of cellNodes(sheet)){
    const address=c.attributes.r,row=Number(address.match(/\d+$/)[0]),col=address.match(/^[A-Z]+/)[0];
    c.attributes.s=[1,4,9,22].includes(row)?(row===1?styles.title:styles.header)
      :[2,20].includes(row)?styles.warning:row>=23&&col==='C'?styles.date
        :row>=23&&col==='E'||row>=10&&row<=18&&col==='C'?styles.money:styles.text;
    if(c.attributes.t==='s'){
      const index=Number(child(c,'v')?.elements?.[0]?.text);
      check(strings[index],'UNSUPPORTED_WORKBOOK','The intake text table is invalid.');
      c.attributes.t='inlineStr';c.elements=[node('is',{xmlns:ns},structuredClone(strings[index].elements))];
    }
    if(row>=23&&intake.rows[row-23]){
      const sourceRow=intake.rows[row-23];
      const literal={A:sourceRow.account,B:sourceRow.state,D:sourceRow.description,F:sourceRow.sourceCategory,
        G:'Not imported',H:sourceRow.note,I:sourceRow.evidenceRef}[col];
      if(typeof literal==='string')Object.assign(c,stringCell(address,literal,c.attributes.s));
    }
    check(!child(c,'f'),'INVALID_INTAKE','Source intake must not contain executable formulas.');
  }
  // This tab deliberately has no tables, external links, drawings or relations.
  const rid='rIdCollector'+randomUUID().replaceAll('-','');
  const part=`xl/worksheets/collector-${randomUUID()}.xml`;
  const sheetId=Math.max(...elements(source.sheets).map(s=>Number(s.attributes.sheetId)))+1;
  source.sheets.elements.push(node('sheet',{xmlns:ns,'xmlns:r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships',name:INTAKE_SHEET,sheetId:String(sheetId),'r:id':rid}));
  source.rels.elements.push(node('Relationship',{xmlns:'http://schemas.openxmlformats.org/package/2006/relationships',Id:rid,Type:'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',Target:part.slice(3)}));
  const ct=xml(await base.file('[Content_Types].xml').async('string'));
  root(ct,'Types').elements.push(node('Override',{xmlns:'http://schemas.openxmlformats.org/package/2006/content-types',PartName:'/'+part,ContentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml'}));
  for(const [name,patch] of Object.entries(updates)){
    const entry=source.map.get(name),s=root(entry.document,'worksheet');
    for(const [address,text] of Object.entries(patch))updateText(s,address,text);
    base.file(entry.part,serial(entry.document));
  }
  base.file('xl/workbook.xml',serial(source.document));base.file('xl/_rels/workbook.xml.rels',serial(source.relationships));
  base.file('[Content_Types].xml',serial(ct));base.file(part,serial(generatedSheet));
  const bytes=await base.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  await verifyCollectorPreservation(baseBytes,bytes);
  return bytes;
}

export async function verifyCollectorPreservation(beforeBytes,afterBytes){
  const before=await JSZip.loadAsync(beforeBytes),after=await JSZip.loadAsync(afterBytes);
  const a=await sheetMap(before),b=await sheetMap(after);
  check(JSON.stringify([...b.map.keys()])===JSON.stringify([...a.map.keys(),INTAKE_SHEET]),
    'WORKBOOK_PRESERVATION_FAILED','Original sheet order changed.');
  const exemptions=new Set([...keyParts,...Object.keys(updates).map(n=>a.map.get(n).part),b.map.get(INTAKE_SHEET).part]);
  const addedSheet=elements(b.sheets).find(s=>s.attributes.name===INTAKE_SHEET);
  const addedRid=addedSheet.attributes['r:id'];
  b.sheets.elements=b.sheets.elements.filter(s=>s!==addedSheet);
  b.rels.elements=b.rels.elements.filter(r=>r.attributes?.Id!==addedRid);
  check(serial(a.document)===serial(b.document)&&serial(a.relationships)===serial(b.relationships),
    'WORKBOOK_PRESERVATION_FAILED','Original workbook metadata or relationships changed.');
  const ctBefore=xml(await before.file('[Content_Types].xml').async('string'));
  const ctAfter=xml(await after.file('[Content_Types].xml').async('string'));
  const types=root(ctAfter,'Types');
  types.elements=types.elements.filter(n=>n.attributes?.PartName!=='/'+b.map.get(INTAKE_SHEET).part);
  check(serial(ctBefore)===serial(ctAfter),'WORKBOOK_PRESERVATION_FAILED','Original component types changed.');
  for(const [name,file] of Object.entries(after.files))if(!file.dir&&!before.file(name))
    check(name===b.map.get(INTAKE_SHEET).part,'WORKBOOK_PRESERVATION_FAILED','An unexpected component was added.');
  for(const [name,file] of Object.entries(before.files)){
    if(file.dir)continue;
    check(after.file(name),'WORKBOOK_PRESERVATION_FAILED','An original workbook component was removed.');
    if(!exemptions.has(name))check(sha(await file.async('nodebuffer'))===sha(await after.file(name).async('nodebuffer')),
      'WORKBOOK_PRESERVATION_FAILED','An unrelated workbook component changed.');
  }
  for(const [name,patch] of Object.entries(updates)){
    const old=root(a.map.get(name).document,'worksheet'),changed=root(b.map.get(name).document,'worksheet');
    for(const address of Object.keys(patch)){
      const oldCell=getCell(old,address),newCell=getCell(changed,address);
      check(oldCell&&newCell&&!child(oldCell,'f'),'WORKBOOK_PRESERVATION_FAILED','An original formula changed.');
      Object.assign(newCell,structuredClone(oldCell));
    }
    check(serial(old)===serial(changed),'WORKBOOK_PRESERVATION_FAILED','A workbook cell or layout outside the intake notice changed.');
  }
}

async function formulaScanAndRender(filename,outputRoot,original){
  const prior=await SpreadsheetFile.importXlsx(original);
  prior.recalculate();
  const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(filename));
  wb.recalculate();
  let errors=0,comparedCells=0;
  const summary=await wb.inspect({kind:'sheet',include:'id,name',maxChars:20000});
  const sheets=summary.ndjson.split('\n').filter(Boolean).map(line=>JSON.parse(line)).filter(x=>x.kind==='sheet');
  for(const entry of sheets)for(const row of wb.worksheets.getItem(entry.name).getUsedRange().values)
    for(const value of row)if(typeof value==='string'&&/^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!)/.test(value))errors++;
  check(errors===0,'WORKBOOK_FORMULA_ERROR','The workbook formula scan found an error; no review copy was published.');
  const column=index=>{let text='';for(let n=index+1;n;n=Math.floor((n-1)/26))text=String.fromCharCode(65+(n-1)%26)+text;return text;};
  for(const entry of sheets.filter(s=>s.name!==INTAKE_SHEET)){
    const oldSheet=prior.worksheets.getItem(entry.name),newSheet=wb.worksheets.getItem(entry.name);
    // All supported budget sheets begin at A1. Include unchanged text/input cells
    // as well as calculated results; skip only the explicit import notices.
    const values=oldSheet.getUsedRange().values,currentValues=newSheet.getUsedRange().values;
    for(let row=0;row<values.length;row++)for(let col=0;col<values[row].length;col++){
      const address=column(col)+(row+1);
      if(updates[entry.name]?.[address]!==undefined)continue;
      const current=currentValues[row]?.[col];
      check(JSON.stringify(values[row][col]??null)===JSON.stringify(current??null),
        'WORKBOOK_OUTPUT_CHANGED','An original input or calculated output changed; no review copy was published.');
      comparedCells++;
    }
  }
  for(const [name,range,file] of [['1. Start','A1:I17','Start.png'],['2. Tuesday Review','A1:I27','Tuesday.png'],[INTAKE_SHEET,'A1:I30','Collector_Intake.png']]){
    const image=await wb.render({sheetName:name,range,scale:1,format:'png'});
    await fs.writeFile(path.join(outputRoot,file),new Uint8Array(await image.arrayBuffer()),{flag:'wx',mode:0o600});
  }
  return {formulaErrors:errors,comparedCells};
}

export async function runWorkbookIntake(configFile,{protector=windowsProtector(),now=new Date(),apply=false}={}){
  const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
  const policy={repositoryRoot};
  check(path.isAbsolute(configFile),'UNSAFE_STORAGE_PATH','The intake configuration must be an absolute private path.');
  await assertPrivateDirectory(path.dirname(configFile),policy);await assertRegularFile(configFile,16000);
  const config=JSON.parse(await fs.readFile(configFile,'utf8'));
  check(config?.version===1&&Object.keys(config).filter(k=>k!=='paypalPromotions').sort().join(',')==='baseWorkbook,bindings,outputRoot,privateRoot,version',
    'INVALID_INTAKE_CONFIG','The intake configuration has unsupported or missing fields.');
  validateIntakeBindings(config.bindings);
  check(typeof config.baseWorkbook==='string'&&path.isAbsolute(config.baseWorkbook)&&path.extname(config.baseWorkbook).toLowerCase()==='.xlsx',
    'UNSUPPORTED_WORKBOOK','Configure a private local XLSX workbook.');
  await assertPrivateDirectory(path.dirname(config.baseWorkbook),policy);await assertRegularFile(config.baseWorkbook,40*1024*1024);
  await assertPrivateDirectory(config.outputRoot,policy);await assertPrivateDirectory(config.privateRoot,policy);
  const store=await openPrivateEvidenceStore({root:config.privateRoot,repositoryRoot,protector});
  const records={};
  for(const a of intakeAccounts(config.bindings))records[a.key]=await store.latestCapture({source:a.source,product:a.product,suffix:config.bindings[a.key]});
  const intake=prepareWorkbookIntake({records,bindings:config.bindings,now});
  if(Object.hasOwn(config,'paypalPromotions')){
    check(apply,'PAYPAL_DIRECT_IMPORT_REQUIRED','Financing updates use direct workbook import only.');
    intake.paypal=preparePaypalImport(await store.latestPaypalCapture(),config.paypalPromotions,now);
  }
  check(intake.accounts.some(a=>a.capturedAt),'INTAKE_EMPTY','No fresh bound account captures were found. Nothing was written.');
  const original=await fs.readFile(config.baseWorkbook),originalHash=sha(original);
  const direct=apply?await import('./collector_apply.mjs'):null;
  const imported=apply?await direct.buildDirectWorkbook(original,intake):null;
  const bytes=imported?.bytes??await buildCollectorWorkbook(original,intake);
  await fs.mkdir(config.outputRoot,{recursive:true,mode:0o700});await assertPrivateDirectory(config.outputRoot,policy);
  const folder=await fs.mkdtemp(path.join(config.outputRoot,'intake-'));
  const pending=path.join(folder,'review.partial.xlsx'),output=path.join(folder,'budget_collector_review.xlsx');
  const replacement=apply?path.join(path.dirname(config.baseWorkbook),`.budget-import-${randomUUID()}.xlsx`):null;
  let published=false;
  try{
    await fs.writeFile(pending,bytes,{flag:'wx',mode:0o600});
    const checks=apply?imported.checks:await formulaScanAndRender(pending,folder,original);
    if(apply)await direct.renderDirectWorkbook(bytes,folder,{paypal:!!intake.paypal});
    await assertRegularFile(config.baseWorkbook,40*1024*1024);
    check(sha(await fs.readFile(config.baseWorkbook))===originalHash,'WORKBOOK_CHANGED','The original workbook changed during intake; rerun against the current file.');
    const [encrypted]=await protector.sealMany([{version:1,kind:apply?'workbook_import_receipt':'workbook_intake_receipt',baseHash:originalHash,
      workbookHash:sha(bytes),createdAt:intake.createdAt,references:[...intake.accounts.map(a=>a.evidenceRef),intake.paypal?.evidenceRef].filter(Boolean),workbookReady:false}]);
    await fs.writeFile(path.join(folder,'receipt.enc'),encrypted,{flag:'wx',mode:0o600});
    if(apply){
      await fs.writeFile(path.join(folder,'before.xlsx'),original,{flag:'wx',mode:0o600});
      await assertPrivateDirectory(path.dirname(config.baseWorkbook),policy);
      const handle=await fs.open(replacement,'wx',0o600);
      try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
      await fs.unlink(pending);
    }
    await assertRegularFile(config.baseWorkbook,40*1024*1024);
    check(sha(await fs.readFile(config.baseWorkbook))===originalHash,'WORKBOOK_CHANGED','The original changed before publication; rerun against the current file.');
    if(apply){
      await fs.rename(replacement,config.baseWorkbook);
      return {status:'ledger_updated',workbookReady:false,output:config.baseWorkbook,backup:path.join(folder,'before.xlsx'),checks,
        accounts:intake.accounts.length,rows:imported.rows,added:imported.added,promoted:imported.promoted,retired:imported.retired};
    }
    // Exclusive publication: unlike rename on POSIX, link cannot replace a file.
    await fs.link(pending,output);published=true;await fs.unlink(pending);
    return {status:'intake_review_created',workbookReady:false,output,checks,accounts:intake.accounts.filter(a=>a.capturedAt).length,rows:intake.rows.length};
  }catch(error){
    // Remove only the files created by this invocation. Never remove a source,
    // profile, directory tree, or another run's output on validation failure.
    if(published)await fs.unlink(output);
    if(replacement)await fs.unlink(replacement).catch(e=>{if(e.code!=='ENOENT')throw e;});
    for(const name of ['review.partial.xlsx','Start.png','Tuesday.png','Collector_Intake.png','Ledger.png','History.png','Snapshots.png','Debt.png','Promos.png','Savings.png','Inputs.png','before.xlsx','receipt.enc'])
      await fs.unlink(path.join(folder,name)).catch(e=>{if(e.code!=='ENOENT')throw e;});
    await fs.rmdir(folder);
    throw error;
  }
}

export async function workbookImportCli(configFile){
  try{
    const result=await runWorkbookIntake(configFile,{apply:true});
    console.log(`Workbook updated: ${result.output}`);
    console.log(`Private backup: ${result.backup}`);
    console.log(`${result.accounts} configured accounts imported: ${result.added} added, ${result.promoted} posted transitions. Remaining source checks still gate the payment plan.`);
    return 0;
  }catch(error){
    const code=typeof error?.code==='string'&&/^[A-Z_]+$/.test(error.code)?error.code:'WORKBOOK_IMPORT_FAILED';
    console.error(`Workbook import blocked: ${code}. Existing workbook preserved.`);return 1;
  }
}

export async function workbookIntakeCli(configFile){
  try{
    const result=await runWorkbookIntake(configFile);
    console.log(`Collector review copy: ${result.output}`);
    console.log(`${result.accounts} sources; ${result.rows} captured rows. Import remains unverified; original workbook unchanged.`);
    return 0;
  }catch(error){
    // Neither workbook values nor raw parser/file errors may reach CLI logs.
    const code=typeof error?.code==='string'&&/^[A-Z_]+$/.test(error.code)?error.code:'WORKBOOK_INTAKE_FAILED';
    console.error(`Collector workbook intake blocked: ${code}. Original workbook unchanged.`);return 1;
  }
}
