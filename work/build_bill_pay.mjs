// Balance-only weekly workbook. Financial inputs/output stay outside the repository.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import JSZip from 'jszip';
import {Workbook,SpreadsheetFile,FileBlob} from '@oai/artifact-tool';
import {workbookXml as X} from './collector_workbook.mjs';
import {defaultPrivateRoot,assertPrivateDirectory,assertRegularFile} from '../collector/src/private-paths.mjs';
import {openPrivateEvidenceStore} from '../collector/src/private-evidence-store.mjs';

export function money(value){
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(typeof value!=='string'||!/^\s*-?\$?\d[\d,]*(?:\.\d{1,2})?\s*$/.test(value))throw new Error('Missing or ambiguous monetary amount');
  return Number(value.trim().replace(/[$,]/g,''));
}
const serial=date=>Math.round((Date.parse(date+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000);
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
export function weeklyPromo(balance,deadline,review){
  return round(balance/Math.max(1,Math.ceil((serial(deadline)-serial(review))/7)));
}
export function monthlyDue(review,day){
  const d=new Date(review+'T00:00:00Z');
  let due=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),day));
  if(due<d)due=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,day));
  return due.toISOString().slice(0,10);
}

// Minimum steady weekly amount satisfying every cumulative deadline, assuming
// payments are directed to the earliest outstanding deadlines first.
export function applyLevelPayoff(wb){
  const s=wb.worksheets.getItem('Bills & Settings'),p=wb.worksheets.getItem('Pay This Week');
  const promos=[];
  for(let row=36;row<200;row++){
    const values=s.getRange(`A${row}:C${row}`).values[0];
    if(typeof values[1]!=='number'||typeof values[2]!=='number')break;
    promos.push(values);
  }
  if(!promos.length)throw new Error('No promotion balances and deadlines found');
  promos.sort((a,b)=>a[2]-b[2]);
  const last=35+promos.length,rate=last+6,header=last+8,firstTier=header+1;
  const deadlines=[...new Set(promos.map(p=>p[2]))],lastTier=header+deadlines.length;
  s.getRange(`A36:C${last}`).values=promos;
  s.getRange('E35').values=[["This week's target"]];
  s.getRange(`A${rate}`).values=[['Steady weekly payment']];
  s.getRange(`B${rate}`).formulas=[[`=MIN(SUM(B36:B${last}),MAX(E${firstTier}:E${lastTier}))`]];
  s.getRange(`A${header}:E${header}`).values=[['Deadline tier','Tier balance','Cumulative owed','Paydays left','Weekly floor']];
  for(let i=0;i<deadlines.length;i++){
    const row=firstTier+i;
    s.getRange(`A${row}`).values=[[deadlines[i]]];
    s.getRange(`B${row}`).formulas=[[`=SUMIFS($B$36:$B$${last},$C$36:$C$${last},A${row})`]];
    s.getRange(`C${row}`).formulas=[[`=SUM(B$${firstTier}:B${row})`]];
    s.getRange(`D${row}`).formulas=[[`=MAX(1,ROUNDUP((A${row}-$B$4)/7,0))`]];
    s.getRange(`E${row}`).formulas=[[`=ROUNDUP(ROUND(C${row}/D${row},10),2)`]];
  }
  for(let row=36;row<=last;row++){
    s.getRange(`D${row}`).formulas=[[`=MAX(1,ROUNDUP((C${row}-$B$4)/7,0))`]];
    s.getRange(`E${row}`).formulas=[[`=MIN(B${row},MAX(0,$B$${rate}${row===36?'':`-SUM($B$36:B${row-1})`}))`]];
  }
  s.getRange(`E${last+1}`).formulas=[[`=SUM(E36:E${last})`]];
  s.getRange('F36').values=[["Targets only; confirm PayPal's payment allocation."]];
  s.getRange('F38').values=[['Refresh remaining balances at the next import.']];
  s.getRange(`F${rate}`).values=[['Lowest steady amount that covers every deadline.']];
  s.getRange(`F${firstTier}`).values=[['Pay earlier deadlines first; carry excess forward.']];
  s.getRange(`F${firstTier+1}`).values=[['Assumes no new charges and on-time weekly payments.']];
  s.getRange(`F${firstTier+2}`).values=[['The statement minimum still applies.']];
  s.getRange(`A${rate}:F${lastTier}`).format={font:{name:'Arial',size:11,color:'#24364B'},rowHeight:29,verticalAlignment:'center'};
  s.getRange(`A${header}:E${header}`).format={fill:'#193657',font:{bold:true,color:'#FFFFFF'},wrapText:true,rowHeight:35};
  s.getRange(`A${firstTier}:A${lastTier}`).setNumberFormat('mmm d, yyyy');
  for(const range of [`B${rate}`,`B${firstTier}:C${lastTier}`,`E${firstTier}:E${lastTier}`])s.getRange(range).setNumberFormat('$#,##0.00 ;($#,##0.00);$0.00 ');
  s.getRange(`A${rate}:B${rate}`).format={fill:'#EAF0F6',font:{bold:true}};
  p.getRange('F16').values=[['Steady weekly payment; earliest promo deadlines first.']];
  p.getRange('C11:C20').dataValidation={rule:{type:'list',values:['To do','Scheduled','Done','Not needed']}};
  for(const row of [18,19]){
    p.getRange(`C${row}`).values=[['Scheduled']];
    p.getRange(`F${row}`).values=[['Not paid yet. Cash reserved for the automatic transfer.']];
  }
  wb.recalculate();
  return {lastRow:lastTier+1,weekly:p.getRange('B16').values[0][0],rent:p.getRange('B20').values[0][0]};
}

export async function updatePayoffWorkbook(filename){
  const repositoryRoot=fileURLToPath(new URL('../',import.meta.url)),policy={repositoryRoot};
  await assertPrivateDirectory(path.dirname(filename),policy);await assertRegularFile(filename,40*1024*1024);
  const original=await fs.readFile(filename),wb=await SpreadsheetFile.importXlsx(await FileBlob.load(filename));
  const result=applyLevelPayoff(wb);
  for(const name of ['Pay This Week','Bills & Settings'])for(const row of wb.worksheets.getItem(name).getUsedRange().values)for(const v of row)
    if(typeof v==='string'&&/^#(REF!|VALUE!|DIV\/0!|NAME\?|N\/A|NUM!)/.test(v))throw new Error('Formula error '+v);
  const backup=filename+'.before-level-payoff-'+randomUUID()+'.xlsx';await fs.writeFile(backup,original,{flag:'wx'});
  for(const sheet of ['Pay This Week','Bills & Settings']){
    const preview=await wb.render({sheetName:sheet,range:sheet==='Pay This Week'?'A1:F34':`A1:F${result.lastRow}`,scale:1,format:'png'});
    await fs.writeFile(path.join(path.dirname(filename),sheet==='Pay This Week'?'pay-this-week.png':'bills-settings.png'),new Uint8Array(await preview.arrayBuffer()));
  }
  const temporary=filename+'.'+randomUUID()+'.xlsx';await(await SpreadsheetFile.exportXlsx(wb)).save(temporary);
  if(!(await fs.readFile(filename)).equals(original))throw new Error('Workbook changed during update');
  await fs.rename(temporary,filename);
  const receiptFile=filename+'.import.json';
  const receipt=await fs.readFile(receiptFile,'utf8').then(JSON.parse,e=>{if(e.code==='ENOENT')return null;throw e;});
  if(receipt){
    receipt.totals.paypal=result.weekly;receipt.totals.rent=result.rent;
    receipt.adjustment={kind:'level-payoff-earliest-deadline-first',backup,automaticStatuses:'Scheduled'};
    await fs.writeFile(receiptFile,JSON.stringify(receipt,null,2));
  }
  return {...result,filename,backup};
}
const text=n=>(n?.elements??[]).map(e=>e.type==='text'?e.text:text(e)).join('');
async function readWorkbook(filename){
  const zip=await JSZip.loadAsync(await fs.readFile(filename)),map=await X.sheetMap(zip);
  const strings=zip.file('xl/sharedStrings.xml')?X.elements(X.root(X.xml(await zip.file('xl/sharedStrings.xml').async('string')),'sst')).map(text):[];
  return (sheet,address)=>{
    const entry=map.map.get(sheet);if(!entry)return null;
    const c=X.getCell(X.root(entry.document,'worksheet'),address);if(!c)return null;
    if(c.attributes.t==='inlineStr')return text(X.child(c,'is'));
    const v=text(X.child(c,'v'));
    return c.attributes.t==='s'?strings[Number(v)]:c.attributes.t==='str'?v:v===''?null:Number(v);
  };
}
function sourceKey(record){
  const p=record.payload;
  if(p.kind==='activity_candidate'&&record.source==='chase')return p.source?.chase?.product;
  if(p.kind==='activity_candidate'&&record.source==='wells')return 'wells';
  return ({citi_activity:'citi',paypal_financing:'paypal',wealthfront_cash:'wealthfront'})[p.kind];
}
async function captures(root,date,repositoryRoot){
  const store=await openPrivateEvidenceStore({root,repositoryRoot}),latest={};
  for(const name of await fs.readdir(path.join(root,'source-evidence'))){
    if(!/^[a-f0-9-]{36}\.enc$/.test(name))continue;
    const ref='local:evidence:'+name.slice(0,-4),r=await store.open(ref),key=sourceKey(r);
    // Explicit capture date, no freshness timeout or transaction reconciliation.
    if(key&&r.capturedAt.slice(0,10)===date&&(!latest[key]||r.capturedAt>latest[key].capturedAt))latest[key]={...r,ref};
  }
  for(const key of ['wells','prime_visa','sapphire_preferred','citi','paypal','wealthfront'])
    if(!latest[key])throw new Error('Missing saved capture for '+key+' on '+date);
  return latest;
}
function balance(record,type){
  const entries=record.payload.source.balances.filter(b=>b.type===type);
  if(entries.length!==1)throw new Error('Missing or ambiguous '+type);
  return money(entries[0].text);
}
function wellsRows(record){
  const result=[];
  for(const table of record.payload.tables??[]){
    let status='';
    for(const row of table.rows??[]){
      if(row.length===1&&/Pending Transactions/i.test(row[0]))status='pending';
      if(row.length===1&&/Posted Transactions/i.test(row[0]))status='posted';
      if(/^\d{2}\/\d{2}\/\d{2}$/.test(row[1]??'')){
        const [m,d,y]=row[1].split('/');result.push({date:`20${y}-${m}-${d}`,description:row[2],debit:row[4]?money(row[4]):0,status});
      }
    }
  }
  return result;
}
export async function buildBillPay(options){
  const repositoryRoot=fileURLToPath(new URL('../',import.meta.url)),policy={repositoryRoot};
  const {base,date,output,discover,capitalOne}=options,root=options.root??defaultPrivateRoot();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(serial(date))||new Date(date+'T00:00:00Z').getUTCDay()!==2)throw new Error('Supply the review Tuesday as YYYY-MM-DD');
  for(const folder of [root,path.dirname(base),path.dirname(output)])await assertPrivateDirectory(folder,policy);
  await assertRegularFile(base,40*1024*1024);
  if(path.resolve(base)===path.resolve(output))throw new Error('Preserve the original; use a new output path');
  if(await fs.stat(output).then(()=>true,()=>false))throw new Error('Output already exists; preserve its payment confirmations and choose a new filename');
  const original=await fs.readFile(base),read=await readWorkbook(base),r=await captures(root,options.captureDate??date,repositoryRoot);
  const get=(address,sheet,oldAddress)=>{
    const v=read('Bills & Settings',address)??read(sheet,oldAddress);
    if(typeof v!=='number'||!Number.isFinite(v))throw new Error('Missing bill setting '+address);
    return v;
  };
  const rows=wellsRows(r.wells),end=serial(date)+6;
  const seen=(pattern)=>round(rows.filter(t=>pattern.test(t.description)&&serial(t.date)>=serial(date)&&serial(t.date)<=end).reduce((s,t)=>s+t.debit,0));
  const lastTuition=rows.filter(t=>/PAYPAL TRANSFER.*ADD TO BALANCE/i.test(t.description)&&t.status==='posted'&&t.date<=date&&t.debit>0).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const tuition=get('B21','5. Savings & Debt','B15');
  // Preserve the schedule, while using an observed recurring debit when it differs only by cents.
  const tuitionAmount=lastTuition&&Math.abs(lastTuition.debit-tuition)<=0.05?lastTuition.debit:tuition;
  const promos=r.paypal.payload.rows.map(p=>{
    const deadline=new Date(p.expirationDate).toISOString().slice(0,10);
    return [p.merchant??p.description??'PayPal promotion',money(p.remainingBalance),serial(deadline),null,null];
  }).filter(p=>p[1]>0);
  if(!promos.length)throw new Error('No active PayPal promotion amounts supplied');
  const wb=Workbook.create(),pay=wb.worksheets.add('Pay This Week'),settings=wb.worksheets.add('Bills & Settings');
  const currency='$#,##0.00 ;($#,##0.00);$0.00 ';
  function cell(s,a,v){s.getRange(a).values=[[v]];}
  function formula(s,a,f){s.getRange(a).formulas=[[f]];}
  function band(s,a,title){cell(s,a.split(':')[0],title);s.getRange(a).format={fill:'#DCE7F2',font:{bold:true,color:'#193657'}};}
  for(const s of [pay,settings]){
    s.showGridLines=false;s.tabColor=s===pay?'#193657':'#6A8CAA';
    s.getRange('A1:F58').format={font:{name:'Arial',size:11,color:'#24364B'},rowHeight:25,verticalAlignment:'center'};
    s.getRange('A1:A58').format.columnWidth=32;s.getRange('B1:B58').format.columnWidth=17;
    s.getRange('C1:C58').format.columnWidth=19;s.getRange('D1:D58').format.columnWidth=19;
    s.getRange('E1:E58').format.columnWidth=19;s.getRange('F1:F58').format.columnWidth=48;
    s.getRange('A2:F2').format.font={size:17,bold:true,color:'#193657'};
  }
  cell(settings,'A2','Bills & Settings');
  cell(settings,'A4','Review Tuesday');cell(settings,'B4',serial(date));settings.getRange('B4').setNumberFormat('mmm d, yyyy');
  cell(settings,'F4','Yellow cells are editable. Amounts are USD.');
  settings.getRange('A5:D5').values=[['Account','Captured balance','Captured / supplied','Basis']];
  const banks=[
    ['Wells',balance(r.wells,'available'),r.wells.capturedAt.slice(0,10),'Available after pending'],
    ['Wealthfront',money(r.wealthfront.payload.available),r.wealthfront.capturedAt.slice(0,10),'Available cash'],
    ['Chase Sapphire',balance(r.sapphire_preferred,'current_balance'),r.sapphire_preferred.capturedAt.slice(0,10),'Posted current balance'],
    ['Prime Visa',balance(r.prime_visa,'current_balance'),r.prime_visa.capturedAt.slice(0,10),'Posted current balance'],
    ['Citi',money(r.citi.payload.currentBalance),r.citi.capturedAt.slice(0,10),'Posted current balance'],
    ['Discover',money(discover),date,'User supplied'],
    ['Capital One',money(capitalOne),date,'User supplied'],
  ];settings.getRange('A6:D12').values=banks;settings.getRange('B6:B12').setNumberFormat(currency);
  settings.getRange('D6:D12').format.wrapText=true;settings.getRange('A6:D12').format.rowHeight=34;
  cell(settings,'F6','Wells available already reflects its pending debits.');
  cell(settings,'F8','Pending card charges are not payable yet.');
  cell(settings,'F9','Pay captured posted balances in full.');
  cell(settings,'F10','Card-funded bills are included in card payments.');
  band(settings,'A16:F16','Bill amounts and timing');
  settings.getRange('A17:D17').values=[['Item','Amount','Timing','Already in Wells cash']];
  const config=[
    ['Minimum Wells balance',get('B18','2. Tuesday Review','E26'),'Keep after actions',null],
    ['Weekly rent cap',get('B19','Support - Budget Inputs','E12'),'Capacity only',null],
    ['Fidelity',get('B20','5. Savings & Debt','B13'),'Weekly automatic',seen(/FID BKG SVC LLC MONEYLINE/i)],
    ['Tuition',tuitionAmount,'Weekly automatic',seen(/PAYPAL TRANSFER.*ADD TO BALANCE/i)],
    ['Car loan',get('B22','Support - Budget Inputs','D13'),'Monthly on the 26th',null],
    ['Rent estimate',get('B23','5. Savings & Debt','B35'),'Monthly on the 1st',null],
  ];settings.getRange('A18:D23').values=config;
  cell(settings,'F20','Subtract only this review week’s captured debits.');
  cell(settings,'F21','Uses the latest recurring debit when cents changed.');
  cell(settings,'F22','Weekly funding = monthly / 4, except due week.');
  cell(settings,'F23','Estimate retained; enter the actual bill when due.');
  cell(settings,'A25','Next rent due');formula(settings,'B25','=DATE(YEAR(B4),MONTH(B4)+(DAY(B4)>1),1)');
  cell(settings,'A26','Next car payment');formula(settings,'B26','=DATE(YEAR(B4),MONTH(B4)+(DAY(B4)>26),26)');
  settings.getRange('B25:B26').setNumberFormat('mmm d, yyyy');
  cell(settings,'A27','AT&T already in Wells');cell(settings,'B27',seen(/ATT PAYMENT/i));
  cell(settings,'F27','Already reflected in available cash; do not pay again.');
  cell(settings,'A28','PayPal already in Wells');cell(settings,'B28',seen(/PAYPAL INST XFER.*CREDIT REPAYMEN/i));
  cell(settings,'F28','Current-week repayments reduce the new payment.');
  cell(settings,'A30','Canada loan / insurance');cell(settings,'B30',get('B30','Support - Budget Inputs','C40'));
  cell(settings,'C30','Weekly reference');cell(settings,'F30','Due month-end / 27th; confirm Wells funding if due.');
  cell(settings,'A31','Other Wells bills this week');cell(settings,'B31',0);
  cell(settings,'F31','Add any extra direct debit not already in Wells cash.');
  band(settings,'A34:F34','PayPal promotional payoff');
  settings.getRange('A35:E35').values=[['Promotion','Remaining','Deadline','Paydays left','Weekly payment']];
  const start=36,last=start+promos.length-1;
  settings.getRange(`A${start}:E${last}`).values=promos;
  promos.forEach((p,i)=>{
    const row=start+i;
    formula(settings,`D${row}`,`=MAX(1,ROUNDUP((C${row}-$B$4)/7,0))`);
    formula(settings,`E${row}`,`=ROUND(B${row}/D${row},2)`);
  });
  settings.getRange(`B36:B${last}`).setNumberFormat(currency);settings.getRange(`C36:C${last}`).setNumberFormat('mmm d, yyyy');settings.getRange(`E36:E${last}`).setNumberFormat(currency);
  settings.getRange(`A36:A${last}`).format.wrapText=true;settings.getRange(`A36:E${last}`).format.rowHeight=36;
  cell(settings,`A${last+1}`,'Total');formula(settings,`B${last+1}`,`=SUM(B36:B${last})`);formula(settings,`E${last+1}`,`=SUM(E36:E${last})`);
  settings.getRange(`B${last+1}`).setNumberFormat(currency);settings.getRange(`E${last+1}`).setNumberFormat(currency);
  cell(settings,`F36`,'Final planned payment is before each promo deadline.');
  cell(settings,`F38`,'PayPal minimum was not captured; cover it if higher.');
  cell(settings,`A${last+4}`,'PayPal minimum due');cell(settings,`F${last+4}`,'Enter if greater than the calculated weekly payoff.');
  settings.getRange(`B${last+4}`).format.fill='#FFF2CC';
  settings.getRange(`B${last+4}`).setNumberFormat(currency);
  for(const a of ['B4','B11:B12','B18:B23','B31'])settings.getRange(a).format={fill:'#FFF2CC',font:{color:'#1D5DA8'}};
  settings.getRange('B18:B23').setNumberFormat(currency);settings.getRange('B27:B31').setNumberFormat(currency);settings.getRange('D20:D21').setNumberFormat(currency);
  for(const a of ['A5:D5','A17:D17',`A35:E35`])settings.getRange(a).format={fill:'#193657',font:{bold:true,color:'#FFFFFF'},rowHeight:30,wrapText:true};
  settings.freezePanes.freezeRows(5);

  cell(pay,'A2','Pay This Week');formula(pay,'A3',`="Tuesday "&TEXT('Bills & Settings'!B4,"mmm d")&" – Monday "&TEXT('Bills & Settings'!B4+6,"mmm d, yyyy")`);
  cell(pay,'A5','Wells available');formula(pay,'B5',"='Bills & Settings'!B6");
  cell(pay,'C5','Wealthfront available');formula(pay,'D5',"='Bills & Settings'!B7");
  cell(pay,'F5','Captured cash, not a live bank connection.');
  cell(pay,'A6','Weekly cash plan');formula(pay,'B6','=SUM(B11:B20)');
  cell(pay,'C6','Wells after plan');formula(pay,'D6','=ROUND(B5+B23-B6,2)');
  cell(pay,'A7','Transfer from Wealthfront');formula(pay,'B7','=B23');
  cell(pay,'C7','Actions remaining');formula(pay,'D7','=COUNTIFS(C11:C20,"To do")+COUNTIFS(C23,"To do")');
  cell(pay,'F7','Personal-safe savings are excluded.');
  pay.getRange('B5:B7').setNumberFormat(currency);pay.getRange('D5:D6').setNumberFormat(currency);
  pay.getRange('A5:D7').format.fill='#EAF0F6';pay.getRange('B5:B7').format.font={bold:true,size:14};
  pay.getRange('A10:D10').values=[['Payment or funding','Amount','Status','Method']];
  const actions=[
    ['Chase Sapphire',"=MAX(0,'Bills & Settings'!B8)",'To do','Manual','Pay the captured posted balance.'],
    ['Prime Visa',"=MAX(0,'Bills & Settings'!B9)",'To do','Manual','Pay the captured posted balance.'],
    ['Citi',"=MAX(0,'Bills & Settings'!B10)",'To do','Manual','Pay the captured posted balance.'],
    ['Discover',"=MAX(0,'Bills & Settings'!B11)",'To do','Manual','Balance supplied for this review.'],
    ['Capital One',"=MAX(0,'Bills & Settings'!B12)",'To do','Manual','Balance supplied for this review.'],
    ['PayPal Credit',`=ROUND(MAX(0,MAX('Bills & Settings'!E${last+1},'Bills & Settings'!B${last+4})-'Bills & Settings'!B28),2)`,'To do','Manual','Weekly payoff toward promotion deadlines.'],
    ['Car reserve',"=IF('Bills & Settings'!B26<='Bills & Settings'!B4+6,ROUND('Bills & Settings'!B22,2),ROUND('Bills & Settings'!B22/4,2))",'To do','Manual','Skip weekly reserve in the car-payment week.'],
    ['Fidelity',"=MAX(0,'Bills & Settings'!B20-'Bills & Settings'!D20)",'Done','Automatic','Cash reserved; Done means no manual action.'],
    ['Tuition',"=MAX(0,'Bills & Settings'!B21-'Bills & Settings'!D21)",'Done','Automatic','Cash reserved; Done means no manual action.'],
    ['Rent funding',"=IF('Bills & Settings'!B25<='Bills & Settings'!B4+6,ROUND('Bills & Settings'!B23,2),ROUND(MIN('Bills & Settings'!B19,MAX(0,B5-SUM(B11:B19)+IF('Bills & Settings'!B26<='Bills & Settings'!B4+6,B17,0)-'Bills & Settings'!B31-'Bills & Settings'!B18)),2))",'To do','Manual','Only remaining Wells capacity, up to the cap.'],
  ];
  actions.forEach((a,i)=>{const row=i+11;cell(pay,`A${row}`,a[0]);formula(pay,`B${row}`,a[1]);cell(pay,`C${row}`,a[2]);cell(pay,`D${row}`,a[3]);cell(pay,`F${row}`,a[4]);});
  // Other direct debits remain a visible cash requirement, not a hidden adjustment.
  cell(pay,'A21','Other direct bills');formula(pay,'B21',"='Bills & Settings'!B31");cell(pay,'C21','Review');cell(pay,'F21','Enter extra bills in Bills & Settings if needed.');
  cell(pay,'A6','Wells cash required');formula(pay,'B6',"=ROUND(SUM(B11:B21)-IF('Bills & Settings'!B26<='Bills & Settings'!B4+6,B17,0),2)");
  cell(pay,'A23','Wealthfront to Wells');formula(pay,'B23',"=ROUND(MAX(0,B6+'Bills & Settings'!B18-B5),2)");cell(pay,'C23','To do');cell(pay,'D23','Manual');cell(pay,'F23','Make this transfer before the payments, if needed.');
  formula(pay,'A17',"=IF('Bills & Settings'!B26<='Bills & Settings'!B4+6,\"Car payment from reserve\",\"Car reserve / CUTX\")");
  formula(pay,'F17',"=IF('Bills & Settings'!B26<='Bills & Settings'!B4+6,\"Pay from car reserve. Confirm it covers this amount.\",\"Weekly funding: monthly car payment divided by four.\")");
  formula(pay,'A20',"=IF('Bills & Settings'!B25<='Bills & Settings'!B4+6,\"Rent payment\",\"Rent funding\")");
  formula(pay,'F20',"=IF('Bills & Settings'!B25<='Bills & Settings'!B4+6,\"Rent due this week; confirm the actual bill amount.\",\"Fund only Wells capacity. No catch-up assumed.\")");
  pay.getRange('B11:B23').setNumberFormat(currency);
  pay.getRange('C11:C20').format={fill:'#FFF2CC',font:{color:'#1D5DA8'}};pay.getRange('C23').format={fill:'#FFF2CC',font:{color:'#1D5DA8'}};
  pay.getRange('C11:C20').dataValidation={rule:{type:'list',values:['To do','Done','Not needed']}};
  pay.getRange('C23').dataValidation={rule:{type:'list',values:['To do','Done','Not needed']}};
  pay.getRange('C11:C23').conditionalFormats.add('containsText',{text:'Done',format:{font:{color:'#16824B',bold:true}}});
  cell(pay,'A25','Confirmed manual payments');formula(pay,'B25','=SUMIFS(B11:B20,C11:C20,"Done",D11:D20,"Manual")');pay.getRange('B25').setNumberFormat(currency);pay.getRange('B25').format.font.color='#16824B';
  cell(pay,'A27','AT&T already pending');formula(pay,'B27',"='Bills & Settings'!B27");pay.getRange('B27').setNumberFormat(currency);cell(pay,'F27','Included in Wells available; no extra deduction.');
  cell(pay,'A29','Next rent due');formula(pay,'B29',"='Bills & Settings'!B25");
  cell(pay,'A30','Next car payment');formula(pay,'B30',"='Bills & Settings'!B26");pay.getRange('B29:B30').setNumberFormat('mmm d, yyyy');
  cell(pay,'F29','Edit payment status after each manual action.');
  cell(pay,'F30','No history or transaction reconciliation required.');
  cell(pay,'A32','PayPal minimum');cell(pay,'F32','Not captured. Pay the minimum if it exceeds the plan.');
  cell(pay,'A33','Canada bills');cell(pay,'F33','Month-end / 27th: confirm funding in the due week.');
  for(const row of [11,13,15,17,19,21])pay.getRange(`A${row}:D${row}`).format.fill='#F0F4F8';
  pay.getRange('C11:C20').format.fill='#FFF2CC';pay.getRange('C11:C23').format.horizontalAlignment='center';
  pay.getRange('A10:D10').format={fill:'#193657',font:{bold:true,color:'#FFFFFF'},rowHeight:29};
  pay.getRange('A23:D23').format.borders={preset:'outside',style:'thin',color:'#A6B8CA'};
  pay.getRange('A11:A23').format.wrapText=true;pay.getRange('A11:D23').format.rowHeight=31;
  pay.getRange('F1:F58').format.columnWidth=57;pay.getRange('F11:F33').format.wrapText=true;
  pay.getRange('E1:E58').format.columnWidth=3;
  for(const s of [pay,settings])s.getRange('A2:F2').format.borders={bottom:{style:'thin',color:'#A6B8CA'}};
  const payoff=applyLevelPayoff(wb);
  const initialDate=settings.getRange('B4').values[0][0];
  cell(settings,'B4',serial('2026-11-24'));wb.recalculate();
  if(pay.getRange('B17').values[0][0]!==round(config[4][1]))throw new Error('Car due-week amount must equal the monthly payment');
  cell(settings,'B4',serial('2026-12-01'));wb.recalculate();
  if(pay.getRange('B20').values[0][0]!==round(config[5][1]))throw new Error('Rent due-week amount must equal the rent bill');
  cell(settings,'B4',initialDate);wb.recalculate();
  for(const row of [11,12,13,14,15,16,17,20,23])if(pay.getRange(`B${row}`).values[0][0]===0)cell(pay,`C${row}`,row===17&&serial(monthlyDue(date,26))<=end?'To do':'Not needed');
  wb.recalculate();
  for(const s of [pay,settings])for(const row of s.getUsedRange().values)for(const v of row)if(typeof v==='string'&&/^#(REF!|VALUE!|DIV\/0!|NAME\?|N\/A|NUM!|SPILL!|CALC!)/.test(v))throw new Error('Formula error: '+v);
  const folder=path.dirname(output);await fs.mkdir(folder,{recursive:true});
  const backupFolder=path.join(root,'backups');await fs.mkdir(backupFolder,{recursive:true});
  const backup=path.join(backupFolder,`before-bill-pay-${randomUUID()}.xlsx`);await fs.writeFile(backup,original,{flag:'wx'});
  for(const s of [pay,settings]){
    const preview=await wb.render({sheetName:s.name,range:s===pay?'A1:F34':`A1:F${payoff.lastRow}`,scale:1,format:'png'});
    await fs.writeFile(path.join(folder,s===pay?'pay-this-week.png':'bills-settings.png'),new Uint8Array(await preview.arrayBuffer()));
  }
  const temporary=path.join(folder,'.bill-pay-'+randomUUID()+'.xlsx');
  await(await SpreadsheetFile.exportXlsx(wb)).save(temporary);
  // Exclusive publication protects an existing checklist from accidental replacement.
  await fs.copyFile(temporary,output,fs.constants.COPYFILE_EXCL);await fs.unlink(temporary);
  const report={date,output,backup,sourceCaptures:Object.fromEntries(Object.entries(r).map(([k,v])=>[k,{ref:v.ref,capturedAt:v.capturedAt}])),totals:{wells:pay.getRange('B5').values[0][0],cashPlan:pay.getRange('B6').values[0][0],wealthfrontTransfer:pay.getRange('B7').values[0][0],wellsAfter:pay.getRange('D6').values[0][0],paypal:pay.getRange('B16').values[0][0],rent:pay.getRange('B20').values[0][0]},formulaErrors:0};
  await fs.writeFile(output+'.import.json',JSON.stringify(report,null,2),{flag:'wx'});
  if(!(await fs.readFile(base)).equals(original))throw new Error('Original workbook changed during the build');
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args={};for(let i=2;i<process.argv.length;i+=2)args[process.argv[i].replace(/^--/,'')]=process.argv[i+1];
  const report=args.update?await updatePayoffWorkbook(args.update):await buildBillPay({base:args.base,date:args.date,captureDate:args['capture-date'],output:args.output,root:args.root,discover:args.discover,capitalOne:args['capital-one']});
  console.log(JSON.stringify(report,null,2));
}
