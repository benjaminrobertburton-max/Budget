import JSZip from 'jszip';
import fs from 'node:fs/promises';
import path from 'node:path';
import {SpreadsheetFile} from '@oai/artifact-tool';
import {workbookBytes} from './workbook_bytes.mjs';
import {workbookXml as X} from './collector_workbook.mjs';
import {requireEvidence as check} from '../collector/src/errors.mjs';
import {reconcileWorkbookLedger,serialDate,isoDate} from '../collector/src/workbook-reconcile.mjs';

const LEDGER='Support - Ledger',HISTORY='6. History',CASH='Support - Account Snapshots',DEBT='Support - Debt Detail';
const col=n=>String.fromCharCode(65+n);
const errorValue=v=>typeof v==='string'&&/^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!)/.test(v);
function reviewTuesday(createdAt){
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(createdAt));
  const date=new Date(day+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+5)%7);
  return date.toISOString().slice(0,10);
}

// Artifact Tool performs calculation and authoring. Merge only authorized cells
// and refreshed formula caches back into the original ZIP, preserving native
// styles, links, validations, drawing/table parts and sheet order verbatim.
export async function mergeCells(original,authored,patches){
  const base=await JSZip.loadAsync(original),generated=await JSZip.loadAsync(authored);
  const a=await X.sheetMap(base),b=await X.sheetMap(generated);
  check([...a.map.keys()].join('|')===[...b.map.keys()].join('|'),'WORKBOOK_LAYOUT_CHANGED','Worksheet order changed.');
  const sst=generated.file('xl/sharedStrings.xml');
  const strings=sst?X.elements(X.root(X.xml(await sst.async('string')),'sst')):[];
  for(const [name,entry] of a.map){
    const sheet=X.root(entry.document,'worksheet'),other=X.root(b.map.get(name).document,'worksheet');
    const data=X.child(sheet,'sheetData'),changes=patches.get(name)??new Map();let dirty=false;
    const convert=(cell,address,value)=>{
      const copy=structuredClone(cell??X.node('c',{xmlns:X.ns,r:address}));
      if(typeof value==='string')return X.stringCell(address,value,copy.attributes.s);
      if(copy.attributes.t==='s'){
        const index=Number(X.child(copy,'v')?.elements?.[0]?.text);
        copy.attributes.t='inlineStr';copy.elements=[X.node('is',{xmlns:X.ns},structuredClone(strings[index].elements))];
      }
      return copy;
    };
    for(const [address,patch] of changes){
      const old=X.getCell(sheet,address),fresh=convert(X.getCell(other,address),address,patch.formula?undefined:patch.value);
      const template=old??X.getCell(sheet,address.replace(/\d+$/,'5'));
      if(template?.attributes.s!==undefined)fresh.attributes.s=template.attributes.s;
      if(old){for(const key of Object.keys(old))delete old[key];Object.assign(old,fresh);}
      else{
        const number=address.match(/\d+$/)[0];let row=X.elements(data).find(r=>r.attributes.r===number);
        if(!row){row=X.node('row',{xmlns:X.ns,r:number,ht:'45',customHeight:'1'},[]);data.elements.push(row);}
        row.elements.push(fresh);row.elements.sort((l,r)=>l.attributes.r.replace(/\d/g,'').localeCompare(r.attributes.r.replace(/\d/g,'')));
      }
      dirty=true;
    }
    for(const cell of X.cellNodes(sheet))if(X.child(cell,'f')&&!changes.has(cell.attributes.r)){
      const fresh=X.getCell(other,cell.attributes.r);
      check(fresh&&X.serial(X.child(cell,'f'))===X.serial(X.child(fresh,'f')),
        'FORMULA_CHANGED','A formula outside the authorized import changed.');
      const cache=X.child(fresh,'v');
      cell.elements=cell.elements.filter(e=>X.lname(e)!=='v');
      if(cache)cell.elements.push(structuredClone(cache));
      if(fresh.attributes.t)cell.attributes.t=fresh.attributes.t;else delete cell.attributes.t;
      dirty=true;
    }
    if(dirty){
      data.elements.sort((l,r)=>Number(l.attributes?.r??0)-Number(r.attributes?.r??0));
      if(name===LEDGER){
        const last=Math.max(...X.elements(data).map(r=>Number(r.attributes.r)));
        for(const tag of ['dimension','autoFilter']){
          const item=X.child(sheet,tag);
          if(item?.attributes?.ref)item.attributes.ref=item.attributes.ref.replace(/(:[A-M])\d+$/,`$1${last}`);
        }
      }
      base.file(entry.part,X.serial(entry.document));
    }
  }
  return base.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}

export async function buildDirectWorkbook(original,intake){
  const wb=await SpreadsheetFile.importXlsx(original);wb.recalculate();
  const sheet=name=>wb.worksheets.getItem(name);
  check(sheet(LEDGER).getRange('A4').values[0][0]==='Account'
    &&sheet(HISTORY).getRange('A4').values[0][0]==='Review Tuesday'
    &&sheet(CASH).getRange('A11').values[0][0]==='Account',
    'UNSUPPORTED_WORKBOOK','The current workbook does not match the supported ledger/history layout.');
  const ledger=sheet(LEDGER).getUsedRange().values.slice(4).map(r=>Array.from({length:13},(_,i)=>r[i]??null));
  while(ledger.length&&!ledger.at(-1)[0])ledger.pop();
  const result=reconcileWorkbookLedger(intake,ledger,sheet('Support - Rules').getUsedRange().values.slice(4));
  const patches=new Map(),frozen=[];
  const write=(name,address,value,formula=false)=>{
    if(!patches.has(name))patches.set(name,new Map());patches.get(name).set(address,formula?{formula:value}:{value});
    const range=sheet(name).getRange(address);range.clear({applyTo:'contents'});
    if(formula)range.formulas=[[value]];else{
      if(typeof value==='string')range.setNumberFormat('@');
      range.values=[[typeof value==='string'&&value.startsWith('=')?"'"+value:value]];
    }
  };
  const review=reviewTuesday(intake.createdAt),reviewSerial=serialDate(review);
  const h=sheet(HISTORY).getUsedRange().values;
  // User-approved change: retain recorded past-week spending when pending rows
  // settle. Freeze only I/J inputs; K/L still use their original formulas.
  for(let i=4;i<h.length;i++)if(typeof h[i][0]==='number'&&h[i][0]<reviewSerial&&h[i][6]){
    for(const c of [8,9]){
      check(typeof h[i][c]==='number'&&!errorValue(h[i][c]),'INVALID_HISTORY','A recorded historical total is unavailable.');
      write(HISTORY,`${col(c)}${i+1}`,h[i][c]);frozen.push([`${col(c)}${i+1}`,h[i][c]]);
    }
  }
  const oldEnd=Math.max(304,ledger.length+4),end=Math.max(oldEnd,result.rows.length+4);
  for(let i=0;i<result.rows.length;i++){
    const row=i+5;
    for(let c=0;c<13;c++)if(c!==7&&(ledger[i]?.[c]??null)!==(result.rows[i][c]??null))write(LEDGER,`${col(c)}${row}`,result.rows[i][c]);
    if(!ledger[i])write(LEDGER,`H${row}`,`=IF(B${row}="","",B${row}-WEEKDAY(B${row}-2,1)+1)`,true);
  }
  if(end>oldEnd){
    const names=(await wb.inspect({kind:'sheet',include:'name',maxChars:20000})).ndjson.split('\n').filter(Boolean).map(JSON.parse).filter(x=>x.kind==='sheet').map(x=>x.name);
    for(const name of names){const formulas=sheet(name).getUsedRange().formulas;
      for(let r=0;r<formulas.length;r++)for(let c=0;c<formulas[r].length;c++){
        const f=formulas[r][c];if(!f)continue;
        const expanded=f.replace(new RegExp("('Support - Ledger'!\\$[A-M]\\$5:\\$[A-M]\\$)"+oldEnd+'\\b','g'),`$1${end}`);
        if(expanded!==f)write(name,`${col(c)}${r+1}`,expanded,true);
      }
    }
  }
  const wells=result.reports.find(a=>a.key==='wells'),balance=type=>wells.balances.find(b=>b.type===type)?.amountMinor;
  check(Number.isSafeInteger(balance('available')),'MISSING_BALANCE','Wells available balance is missing.');
  const oldReview=sheet(CASH).getRange('A5').values[0][0];
  write(CASH,'A5',serialDate(intake.createdAt.slice(0,10)));write(CASH,'C5',balance('available')/100);write(CASH,'F5',balance('available')/100);
  const wp=intake.rows.filter(r=>r.account==='Wells Fargo'&&r.state==='pending');
  write(CASH,'D5',wp.filter(r=>r.amountMinor>0).reduce((s,r)=>s+r.amountMinor,0)/100);
  write(CASH,'E5',-wp.filter(r=>r.amountMinor<0).reduce((s,r)=>s+r.amountMinor,0)/100);
  write(CASH,'G5','Bank available balance; pending is shown separately, not deducted twice. '+wells.evidenceRef);
  const controls=[['wells',12,['posted','pending']],['chase_sapphire',14,['posted']],['chase_sapphire',15,['pending']],['chase_prime',17,['posted','pending']]];
  const hasCiti=result.reports.some(a=>a.key==='citi');
  const importedLabel=hasCiti?'Wells, Chase and Citi':'Wells and Chase';
  if(hasCiti)controls.push(['citi',16,['posted','pending']]);
  for(const [key,row,states] of controls){
    const report=result.reports.find(a=>a.key===key),indices=states.flatMap(s=>report.scope[s]);
    // For combined source controls count exact account and active statuses. For
    // the two Sapphire controls use the latest capture reference in column K.
    const archives=states.map(s=>`${report.evidenceRef}:${s}`);
    write(CASH,`B${row}`,report.evidenceRef);write(CASH,`C${row}`,'Collector '+states.join(' + '));
    write(CASH,`D${row}`,indices.length);write(CASH,`F${row}`,indices.reduce((s,i)=>s+Math.round(result.rows[i][3]*100),0)/100);
    write(CASH,`E${row}`,'='+archives.map(a=>`COUNTIF('${LEDGER}'!$K$5:$K$${end},"${a}")`).join('+'),true);
    write(CASH,`G${row}`,'='+archives.map(a=>`SUMIF('${LEDGER}'!$K$5:$K$${end},"${a}",'${LEDGER}'!$D$5:$D$${end})`).join('+'),true);
    write(CASH,`H${row}`,'Yes');
    const needs=indices.some(i=>result.rows[i][12]!=='Verified');
    const status=needs?'Needs classification':key!=='wells'&&!['no_payment_due','requirements_captured'].includes(report.bankPaymentStatus)?'Needs payment details':'Verified';
    write(CASH,`I${row}`,`=IF(OR(E${row}<>D${row},ABS(G${row}-F${row})>0.005),"Source check needed","${status}")`,true);
    write(CASH,`J${row}`,report.pendingBasis+(needs?'; resolve ledger date/category exceptions':''));
  }
  if(typeof oldReview!=='number'||oldReview<reviewSerial)for(const row of [13,16,18,19,20]){
    if(controls.some(c=>c[1]===row))continue;
    write(CASH,`I${row}`,'Needed');write(CASH,`J${row}`,'Not refreshed by this import.');
  }
  const debts=sheet(DEBT).getUsedRange().values;
  for(const [key,label] of [['chase_sapphire','Chase card'],['chase_prime','Prime Visa card'],...(hasCiti?[['citi','Citi card']]:[])]){
    const report=result.reports.find(a=>a.key===key),row=debts.findIndex(r=>r[0]===label)+1;
    check(row>=5,'UNSUPPORTED_WORKBOOK','A card debt input row is missing.');
    const current=report.balances.find(b=>b.type==='current_balance');check(current,'MISSING_BALANCE','A card balance is missing.');
    write(DEBT,`B${row}`,current.amountMinor/100);
    write(DEBT,`C${row}`,key==='citi'?report.balances.find(b=>b.type==='minimum_due').amountMinor/100:report.bankPaymentStatus==='no_payment_due'?0:null);
    write(DEBT,`D${row}`,key==='citi'?serialDate(report.dueDate):null);
    write(DEBT,`G${row}`,report.balances.map(b=>`${b.type.replaceAll('_',' ')}: ${(b.amountMinor/100).toFixed(2)}`).join('; ')
      +`; ${key==='citi'?'Minimum and due date captured':report.bankPaymentStatus==='no_payment_due'?'Bank displays no payment due':'Payment requirements need source verification'}`);
  }
  write('1. Start','A2',`${importedLabel} imported. Complete remaining source checks before creating the payment plan.`);
  write('1. Start','A4',`Current import — ${review}`);
  write('1. Start','B6',wells.needsReview?'Needs review':'Verified');write('1. Start','C6','Ledger and current pending reconciled.');
  write('1. Start','C5','Bank available; includes pending.');
  write('1. Start','B7','Import in progress');write('1. Start','C7','Payment plan not ready');
  write('1. Start','B8','Finish source checks');write('1. Start','C8','See Account Snapshots');
  const checkpoints=sheet('1. Start').getRange('F6:F13').values;
  for(let i=0;i<checkpoints.length;i++){
    const report=result.reports.find(a=>a.label===checkpoints[i][0]);if(!report)continue;
    const accepted=report.scope.posted.map(n=>result.rows[n]).filter(r=>r[12]==='Verified')
      .sort((a,b)=>String(b[8].split('|')[3]).localeCompare(a[8].split('|')[3]));
    if(accepted[0])write('1. Start',`G${6+i}`,`${accepted[0][8].split('|')[3]} · ${String(accepted[0][2]).slice(0,24)} · ${(accepted[0][3]*(report.key==='wells'?-1:1)).toFixed(2)}`);
  }
  write('2. Tuesday Review','A2',`NOT A CURRENT PAYMENT PLAN. ${importedLabel} inputs updated; finish source checks before rebuilding this checklist. Prior confirmations retained.`);
  write('3. This Week','B3',reviewSerial-7);
  const exceptions=result.reports.some(a=>a.needsReview);
  write('3. This Week','A2',exceptions?'Incomplete spending analysis: resolve missing dates/categories in the ledger and remaining source checks. Not a cash-payment decision.'
    :`Prior Tuesday–Monday spending. ${importedLabel} updated; check remaining sources. Not a cash-payment decision.`);
  if(intake.paypal){
    const name='Support - Promo Detail',promo=sheet(name),data=promo.getRange('A6:G9').values;
    check(promo.getRange('A5').values[0][0]==='Merchant'&&data.every(r=>typeof r[0]==='string'&&r[0]),
      'PAYPAL_LAYOUT_UNSUPPORTED','Promotion template requires review before import.');
    check(intake.paypal.rows.length===data.length,'PAYPAL_BINDING_MISMATCH','Every existing promotion requires explicit source evidence.');
    for(const p of intake.paypal.rows){
      const matches=data.flatMap((r,i)=>r[0]===p.workbookMerchant?[i+6]:[]);
      check(matches.length===1,'PAYPAL_BINDING_MISMATCH','Workbook promotion mapping is ambiguous.');
      const row=matches[0];
      check(promo.getRange(`B${row}`).values[0][0]===serialDate(p.expirationDate),'PAYPAL_DEADLINE_CHANGED','Promotion deadline differs from the accepted workbook.');
      for(const column of ['C','D'])check(!promo.getRange(`${column}${row}`).formulas[0][0],'PAYPAL_LAYOUT_UNSUPPORTED','A promotion input contains a formula.');
      write(name,`C${row}`,p.amountMinor/100);write(name,`D${row}`,p.interestMinor/100);
    }
    write(name,'B3',reviewSerial);
    const total=intake.paypal.rows.reduce((s,p)=>s+p.amountMinor,0)/100;
    write(CASH,'B20',intake.paypal.evidenceRef);write(CASH,'C20','Financing snapshot');
    write(CASH,'D20',data.length);write(CASH,'E20',`=COUNTA('${name}'!A6:A9)`,true);
    write(CASH,'F20',total);write(CASH,'G20',`='${name}'!C11`,true);write(CASH,'H20','Promo identities matched');
    write(CASH,'I20','=IF(OR(D20<>E20,ABS(F20-G20)>0.005),"Source check needed","Promo verified")',true);
    write(CASH,'J20','Promos only; not card/payment verification.');
    write('1. Start','G13','Promo snapshot refreshed');
  }
  wb.recalculate();
  if(intake.paypal)check(sheet(CASH).getRange('I20').values[0][0]==='Promo verified','PAYPAL_SOURCE_MISMATCH','Promotion balance/count reconciliation failed.');
  if(intake.wealthfront){
    const w=intake.wealthfront;
    check(w.coverageVerified&&w.balances.pending===0&&w.balances.unavailable===0,'WEALTHFRONT_CAPTURE_FAILED','Unresolved cash evidence cannot update the workbook.');
    write(CASH,'A6',serialDate(w.capturedAt.slice(0,10)));write(CASH,'C6',w.balances.total/100);
    write(CASH,'D6',0);write(CASH,'E6',0);write(CASH,'F6',w.balances.available/100);
    write(CASH,'G6','Bank available balance. No additional deduction for past transfers.');
    write(CASH,'B13',w.evidenceRef);write(CASH,'C13','Cash + first-page activity');
    write(CASH,'D13',w.rows.length);write(CASH,'E13',w.rows.length);
    const total=w.rows.reduce((s,r)=>s+r.amountMinor,0)/100;
    write(CASH,'F13',total);write(CASH,'G13',total);write(CASH,'H13','Yes');write(CASH,'I13','Verified');
    write(CASH,'J13','Private evidence: running balances and accepted overlap matched; zero pending/held displayed.');
    write('1. Start','G7','Cash and activity refreshed');
    wb.recalculate();
  }
  for(const [,row] of controls){
    check(sheet(CASH).getRange(`E${row}`).values[0][0]===sheet(CASH).getRange(`D${row}`).values[0][0]
      &&Math.abs(sheet(CASH).getRange(`G${row}`).values[0][0]-sheet(CASH).getRange(`F${row}`).values[0][0])<0.005,
      'SOURCE_CONTROL_MISMATCH','Imported count or signed total differs from captured source rows.');
  }
  const names=(await wb.inspect({kind:'sheet',include:'name',maxChars:20000})).ndjson.split('\n').filter(Boolean).map(JSON.parse).filter(x=>x.kind==='sheet').map(x=>x.name);
  for(const name of names)check(!sheet(name).getUsedRange().values.flat().some(errorValue),'WORKBOOK_FORMULA_ERROR','Formula validation failed; no workbook updated.');
  for(const [address,value] of frozen)check(sheet(HISTORY).getRange(address).values[0][0]===value,'HISTORY_CHANGED','A closed weekly total changed.');
  const bytes=await mergeCells(original,await workbookBytes(wb),patches);
  const saved=await SpreadsheetFile.importXlsx(bytes);saved.recalculate();
  for(const name of names){
    const actual=saved.worksheets.getItem(name).getUsedRange().values,expected=sheet(name).getUsedRange().values;
    for(let r=0;r<Math.max(actual.length,expected.length);r++)for(let c=0;c<Math.max(actual[r]?.length??0,expected[r]?.length??0);c++){
      const a=actual[r]?.[c]??null,e=expected[r]?.[c]??null;
      const same=a===e||(typeof a==='number'&&typeof e==='number'&&Number.isFinite(a)&&Number.isFinite(e)&&Math.abs(a-e)<1e-9);
      check(same,'WORKBOOK_EXPORT_CHANGED',`Saved value differs at ${name}!${col(c)}${r+1} (${typeof a}/${typeof e}).`);
    }
  }
  return {bytes,checks:{formulaErrors:0,historyCellsPreserved:frozen.length},added:result.added,promoted:result.promoted,retired:result.retired,rows:result.rows.length};
}

export async function renderDirectWorkbook(bytes,folder,{paypal=false,wealthfront=false}={}){
  const wb=await SpreadsheetFile.importXlsx(bytes);
  for(const [name,range,file] of [['1. Start','A1:H17','Start.png'],[LEDGER,'A1:M18','Ledger.png'],[HISTORY,'A1:M10','History.png'],[CASH,'A1:J21','Snapshots.png'],[DEBT,'A1:G10','Debt.png'],...(paypal?[
    ['Support - Promo Detail','A1:G12','Promos.png'],['5. Savings & Debt','A1:D24','Savings.png'],['2. Tuesday Review','A10:I16','Tuesday.png'],['Support - Budget Inputs','A17:F22','Inputs.png']]:wealthfront?[['5. Savings & Debt','A1:D18','Savings.png']]:[])]){
    const image=await wb.render({sheetName:name,range,scale:1,format:'png'});
    await fs.writeFile(path.join(folder,file),new Uint8Array(await image.arrayBuffer()),{flag:'wx'});
  }
}
