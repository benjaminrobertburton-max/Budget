import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {fictionalWorkbook} from '../../work/collector_workbook_fixture.mjs';
import {workbookBytes} from '../../work/workbook_bytes.mjs';
import {buildDirectWorkbook} from '../../work/collector_apply.mjs';
import {runWorkbookIntake} from '../../work/collector_workbook.mjs';
import {prepareWorkbookIntake} from '../src/workbook-intake.mjs';
import {reconcileWorkbookLedger} from '../src/workbook-reconcile.mjs';
import {intakeRecords,INTAKE_BINDINGS,INTAKE_NOW} from '../fixtures/workbook-intake.mjs';
import {openPrivateEvidenceStore} from '../src/private-evidence-store.mjs';
import {tempDirectory,fixtureProtector,repositoryRoot} from './store-helpers.mjs';
import {fictionalCiti} from '../fixtures/citi.mjs';
import {randomUUID} from 'node:crypto';
import {fictionalPaypal,fictionalPaypalBindings} from '../fixtures/paypal.mjs';
import {preparePaypalImport} from '../src/paypal-normalize.mjs';
const require=createRequire(new URL('../../work/workbook_bytes.mjs',import.meta.url));
const {SpreadsheetFile}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')));
const intake=records=>prepareWorkbookIntake({records,bindings:INTAKE_BINDINGS,now:INTAKE_NOW});
const value=(wb,name,cell)=>wb.worksheets.getItem(name).getRange(cell).values[0][0];

test('Wealthfront encrypted evidence updates cash, preserves savings logic, and rejects incomplete replay',async t=>{
  const root=await tempDirectory(t),protector=fixtureProtector(),cash='Support - Account Snapshots',savings='5. Savings & Debt';
  const wb=await SpreadsheetFile.importXlsx(await baseline());
  wb.worksheets.getItem(cash).getRange('B6:G6').values=[['Wealthfront savings',100,0,0,100,'Prior cash snapshot']];
  wb.worksheets.getItem(cash).getRange('B7:F7').values=[['Personal safe cash',20,0,0,20]];
  wb.worksheets.getItem(cash).getRange('C6:F7').setNumberFormat('$#,##0.00');
  wb.worksheets.getItem(savings).getRange('A5:A7').values=[['Wealthfront available now'],['Personal safe cash'],['Confirmed liquid savings']];
  wb.worksheets.getItem(savings).getRange('B5').formulas=[[`='${cash}'!F6`]];
  wb.worksheets.getItem(savings).getRange('B6').formulas=[[`='${cash}'!F7`]];
  wb.worksheets.getItem(savings).getRange('B7').formulas=[['=SUM(B5:B6)']];
  wb.worksheets.getItem(savings).getRange('B5:B7').setNumberFormat('$#,##0.00');
  wb.worksheets.getItem('1. Start').getRange('F7').values=[['Wealthfront']];
  wb.recalculate();const base=await workbookBytes(wb);
  const payload={version:1,kind:'wealthfront_cash',finding:'captured',accountId:'FICTIONAL-CASH',title:'Individual Cash Account',
    total:'$150.00',available:'$150.00',unavailable:'$0.00',pending:'$0.00',rows:[
      {description:'FICTIONAL TRANSFER',amount:'-$50.00',date:'Sep 9, 2031',runningBalance:'$150.00'},
      {description:'FICTIONAL DEPOSIT',amount:'+$100.00',date:'Sep 8, 2031',runningBalance:'$200.00'},
      {description:'FICTIONAL INTEREST',amount:'+$1.00',date:'Sep 1, 2031',runningBalance:'$100.00'}]};
  const config={version:1,baseWorkbook:path.join(root,'current.xlsx'),outputRoot:path.join(root,'runs'),privateRoot:path.join(root,'private'),bindings:INTAKE_BINDINGS,
    wealthfront:{accountId:payload.accountId,initialAnchor:{date:'2031-09-08',description:'FICTIONAL DEPOSIT',amountMinor:10000}}};
  await fs.writeFile(config.baseWorkbook,base);const file=path.join(root,'config.json');await fs.writeFile(file,JSON.stringify(config));
  const store=await openPrivateEvidenceStore({root:config.privateRoot,repositoryRoot,protector});
  for(const {record} of Object.values(intakeRecords()))await store.save(record);
  const reference=await store.save({source:'wealthfront',capturedAt:INTAKE_NOW.toISOString(),payload});
  const result=await runWorkbookIntake(file,{protector,now:INTAKE_NOW,apply:true});
  assert.deepEqual(await fs.readFile(result.backup),base);assert.equal(result.checks.formulaErrors,0);
  const accepted=await fs.readFile(config.baseWorkbook),saved=await SpreadsheetFile.importXlsx(accepted);saved.recalculate();
  assert.equal(value(saved,cash,'F6'),150);assert.equal(value(saved,cash,'F7'),20);
  assert.equal(value(saved,savings,'B5'),150);assert.equal(value(saved,savings,'B7'),170);
  assert.equal(saved.worksheets.getItem(savings).getRange('B5').formulas[0][0],`='${cash}'!F6`);
  assert.equal(value(saved,'6. History','J5'),3);assert.equal(value(saved,'4. Money Plan','B28'),50);
  assert.equal(value(saved,cash,'B13'),reference);assert.equal(value(saved,cash,'I13'),'Verified');
  assert.equal(value(saved,cash,'D13'),3);assert.equal(value(saved,cash,'F13'),51);
  assert.equal(value(saved,'2. Tuesday Review','E9'),'Done');assert.equal(result.workbookReady,false);
  assert.equal(saved.worksheets.getItem('Support - Ledger').getRange('A5:A12').values.flat().includes('Wealthfront'),false);
  if(process.env.BUDGET_FICTIONAL_PREVIEWS){
    await fs.mkdir(process.env.BUDGET_FICTIONAL_PREVIEWS,{recursive:true});
    for(const name of ['Start','Snapshots','Savings'])await fs.copyFile(path.join(path.dirname(result.backup),name+'.png'),path.join(process.env.BUDGET_FICTIONAL_PREVIEWS,'Wealthfront-'+name+'.png'));
  }
  const again=await runWorkbookIntake(file,{protector,now:INTAKE_NOW,apply:true});
  assert.equal(again.added,0);assert.deepEqual(await fs.readFile(again.backup),accepted);
  const replay=await fs.readFile(config.baseWorkbook);
  await store.save({source:'wealthfront',capturedAt:INTAKE_NOW.toISOString(),payload:{...payload,available:''}});
  await assert.rejects(runWorkbookIntake(file,{protector,now:INTAKE_NOW,apply:true}),{code:'WEALTHFRONT_CAPTURE_FAILED'});
  assert.deepEqual(await fs.readFile(config.baseWorkbook),replay);
});

async function baseline(){
  const wb=await SpreadsheetFile.importXlsx(await fictionalWorkbook());
  const ledger=wb.worksheets.getItem('Support - Ledger');
  const rows=[['Wells Fargo','2031-09-08','FICTIONAL PAYROLL',-500,'Posted','Income','Exclude'],
    ['Wells Fargo','2031-09-07','FICTIONAL TRANSFER',25,'Posted','Savings transfer','Transfer / verify'],
    ['Chase','2031-09-08','FICTIONAL SHOP',4,'Posted','Shopping','Include'],
    ['Prime Visa','2031-09-08','FICTIONAL SHOP',4,'Posted','Shopping','Include'],
    ['Chase','2031-09-01','FICTIONAL PENDING',3,'Pending','Shopping','Include']];
  ledger.getRange('A5:M9').clear({applyTo:'contents'});
  rows.forEach((row,i)=>{
    ledger.getRange(`A${5+i}:G${5+i}`).values=[[row[0],new Date(row[1]),...row.slice(2)]];
    ledger.getRange(`I${5+i}:M${5+i}`).values=[[`fictional-${i}`,'User note','fictional:accepted',row[4],'Verified']];
    ledger.getRange(`H${5+i}`).formulas=[[`=B${5+i}-WEEKDAY(B${5+i}-2,1)+1`]];
  });
  const history=wb.worksheets.getItem('6. History');history.getRange('A4:M5').clear({applyTo:'contents'});
  history.getRange('A4:M4').values=[['Review Tuesday','Purchase week start','Purchase week end','Wells available at review','Wealthfront rent transfer','Total Wells plan','Execution check','Purchase budget','Posted spend','Pending spend','Committed spend','Remaining / over','Notes']];
  history.getRange('A5:H5').values=[[new Date('2031-09-02'),new Date('2031-08-26'),new Date('2031-09-01'),100,0,50,'Completed',50]];
  for(const [column,status] of [['I','Posted'],['J','Pending']])history.getRange(`${column}5`).formulas=[[`=SUMIFS('Support - Ledger'!$D$5:$D$304,'Support - Ledger'!$B$5:$B$304,"<"&A5,'Support - Ledger'!$E$5:$E$304,"${status}",'Support - Ledger'!$G$5:$G$304,"Include")`]];
  history.getRange('K5').formulas=[['=I5+J5']];history.getRange('L5').formulas=[['=H5-K5']];
  const cash=wb.worksheets.getItem('Support - Account Snapshots');cash.getRange('A11').values=[['Account']];cash.getRange('A5').values=[[new Date('2031-09-02')]];
  cash.getRange('A12:A20').values=[['Wells Fargo'],['Wealthfront'],['Chase Sapphire'],['Chase Sapphire'],['Citi'],['Prime Visa'],['Discover'],['Capital One'],['PayPal']];
  const debt=wb.worksheets.getItem('Support - Debt Detail');debt.getRange('A5:B6').values=[['Chase card',100],['Prime Visa card',100]];
  debt.getRange('D5:D6').values=[[new Date('2031-09-20')],[new Date('2031-09-21')]];
  wb.worksheets.getItem('1. Start').getRange('B14').formulas=[["=COUNTBLANK('Support - Debt Detail'!D5:D15)"]];
  wb.worksheets.getItem('Support - Rules').getRange('A5:C5').values=[['FICTIONAL NEW','Shopping','Include']];
  wb.recalculate();return workbookBytes(wb);
}

test('PayPal financing updates existing inputs, preserves formulas and rejects unbound workbook rows',async t=>{
  const wb=await SpreadsheetFile.importXlsx(await baseline()),name='Support - Promo Detail',s=wb.worksheets.getItem(name);
  s.getRange('A5:G5').values=[['Merchant','Deadline','Balance','Accrued deferred interest','Weeks remaining','Weekly payoff target','Priority']];
  const bindings=fictionalPaypalBindings();
  bindings.forEach((b,i)=>{const r=i+6;s.getRange(`A${r}:D${r}`).values=[[b.workbookMerchant,new Date(b.expirationDate),200,5]];
    s.getRange(`E${r}`).formulas=[[`=MAX(1,ROUNDUP((B${r}-$B$3)/7,0))`]];s.getRange(`F${r}`).formulas=[[`=C${r}/E${r}`]];});
  s.getRange('B3').values=[[new Date('2031-09-02')]];s.getRange('E3').values=[[new Date('2031-10-10')]];
  s.getRange('C11').formulas=[['=SUM(C6:C9)']];s.getRange('F12').formulas=[['=SUM(F6:F9)']];
  s.getRange('A1:G1').merge();s.getRange('A1').values=[['FICTIONAL TEST — Promotional debt']];
  s.getRange('B3').setNumberFormat('mmm d, yyyy');s.getRange('E3').setNumberFormat('mmm d, yyyy');s.getRange('B6:B9').setNumberFormat('mmm d, yyyy');
  for(const range of ['C6:D11','F6:F12'])s.getRange(range).setNumberFormat('$#,##0.00');
  s.getRange('A5:G5').format={wrapText:true,rowHeight:45,font:{bold:true}};
  const savings=wb.worksheets.getItem('5. Savings & Debt');savings.getRange('A20:A22').values=[['Active PayPal promo balance'],['Weekly payoff target'],['First promo deadline']];
  for(const [cell,source] of [['B20','C11'],['B21','F12'],['B22','B6']])savings.getRange(cell).formulas=[[`='${name}'!${source}`]];
  savings.getRange('B20:B21').setNumberFormat('$#,##0.00');savings.getRange('B22').setNumberFormat('mmm d, yyyy');
  wb.worksheets.getItem('2. Tuesday Review').getRange('B14:D14').values=[['PayPal promo','Payoff target',null]];
  wb.worksheets.getItem('2. Tuesday Review').getRange('D14').formulas=[[`='${name}'!F12`]];
  wb.worksheets.getItem('Support - Budget Inputs').getRange('A20').values=[['PayPal promo']];
  wb.worksheets.getItem('Support - Budget Inputs').getRange('D20').formulas=[[`='${name}'!F12`]];
  const base=await workbookBytes(wb),a=intake(intakeRecords());
  a.paypal=preparePaypalImport({reference:`local:evidence:${randomUUID()}`,record:{version:1,kind:'budget-collector-source-evidence',source:'paypal',capturedAt:INTAKE_NOW.toISOString(),payload:fictionalPaypal()}},bindings,INTAKE_NOW);
  const result=await buildDirectWorkbook(base,a),saved=await SpreadsheetFile.importXlsx(result.bytes);saved.recalculate();
  assert.equal(value(saved,name,'C11'),260);assert.equal(value(saved,name,'C9'),0);assert.equal(value(saved,name,'D6'),2);
  assert.equal(saved.worksheets.getItem(name).getRange('F6').formulas[0][0],'=C6/E6');
  assert.equal(value(saved,name,'E3'),48131);assert.equal(value(saved,'6. History','J5'),3);
  assert.equal(value(saved,'Support - Account Snapshots','I20'),'Promo verified');
  assert.equal(result.checks.formulaErrors,0);
  assert.equal(value(saved,'5. Savings & Debt','B20'),260);
  assert.equal(value(saved,'2. Tuesday Review','D14'),value(saved,name,'F12'));
  assert.equal(value(saved,'Support - Budget Inputs','D20'),value(saved,name,'F12'));
  const root=await tempDirectory(t),protector=fixtureProtector();
  const config={version:1,baseWorkbook:path.join(root,'current.xlsx'),outputRoot:path.join(root,'runs'),privateRoot:path.join(root,'private'),bindings:INTAKE_BINDINGS,paypalPromotions:bindings};
  await fs.writeFile(config.baseWorkbook,base);const file=path.join(root,'config.json');await fs.writeFile(file,JSON.stringify(config));
  const store=await openPrivateEvidenceStore({root:config.privateRoot,repositoryRoot,protector});
  for(const {record} of Object.values(intakeRecords()))await store.save(record);
  await store.save({source:'paypal',capturedAt:INTAKE_NOW.toISOString(),payload:fictionalPaypal()});
  const imported=await runWorkbookIntake(file,{protector,now:INTAKE_NOW,apply:true});
  assert.deepEqual(await fs.readFile(imported.backup),base);assert.equal(imported.checks.formulaErrors,0);
  const actual=await SpreadsheetFile.importXlsx(await fs.readFile(config.baseWorkbook));actual.recalculate();
  assert.equal(value(actual,name,'C11'),260);assert.equal(value(actual,'Support - Account Snapshots','I20'),'Promo verified');
  if(process.env.BUDGET_FICTIONAL_PREVIEWS){
    await fs.mkdir(process.env.BUDGET_FICTIONAL_PREVIEWS,{recursive:true});
    for(const name of ['Promos','Savings','Tuesday','Inputs','Start','Snapshots'])
      await fs.copyFile(path.join(path.dirname(imported.backup),name+'.png'),path.join(process.env.BUDGET_FICTIONAL_PREVIEWS,name+'.png'));
  }
  a.paypal.rows[0].workbookMerchant='Unknown';await assert.rejects(buildDirectWorkbook(base,a),{code:'PAYPAL_BINDING_MISMATCH'});
});

test('direct import updates real input sheets, preserves closed weeks, and repeats without duplicates',async()=>{
  const base=await baseline(),records=intakeRecords();
  records.wells.record.payload.tables[0].rows.push(['09/08/2031','FICTIONAL NEW','','$10.00']);
  const first=await buildDirectWorkbook(base,intake(records));
  assert.equal(first.added,1);assert.equal(first.checks.historyCellsPreserved,2);
  const wb=await SpreadsheetFile.importXlsx(first.bytes);wb.recalculate();
  assert.equal(value(wb,'Support - Account Snapshots','F5'),950);
  assert.equal(value(wb,'Support - Debt Detail','B5'),25);assert.equal(value(wb,'Support - Debt Detail','B6'),25);
  assert.equal(value(wb,'Support - Debt Detail','D5'),null);assert.equal(value(wb,'Support - Debt Detail','D6'),null);
  assert.equal(value(wb,'1. Start','B14'),11);
  assert.equal(value(wb,'6. History','J5'),3);assert.equal(value(wb,'6. History','K5'),3);
  assert.equal(value(wb,'Support - Ledger','D10'),10);assert.equal(value(wb,'Support - Ledger','F10'),'Shopping');
  assert.equal(value(wb,'Support - Account Snapshots','I16'),'Needed');
  assert.equal(value(wb,'2. Tuesday Review','E9'),'Done');
  const again=await buildDirectWorkbook(first.bytes,intake(records));assert.equal(again.added,0);assert.equal(again.rows,first.rows);
  const zipped=await require('jszip').loadAsync(again.bytes);
  const original=await require('jszip').loadAsync(base);
  for(const name of Object.keys(original.files).filter(n=>!/^xl\/worksheets\/sheet\d+\.xml$/.test(n)&&!original.files[n].dir))
    assert.deepEqual(await zipped.file(name).async('nodebuffer'),await original.file(name).async('nodebuffer'),`Native part preserved: ${name}`);
  assert.doesNotMatch(await zipped.file('xl/workbook.xml').async('string'),/Collector Intake/);
});

test('pending settlement is counted once while prior weekly totals remain fixed',async()=>{
  const records=intakeRecords(),first=await buildDirectWorkbook(await baseline(),intake(records));
  const sapphire=records.chase_sapphire.record.payload;
  sapphire.tables.shift();sapphire.tables[0].rows.push(['Sep 1, 2031','FICTIONAL PENDING','$3.00']);
  Object.assign(sapphire.source.chase,{pendingObserved:false,pendingHeader:'',pendingSummary:''});
  const second=await buildDirectWorkbook(first.bytes,intake(records));
  assert.equal(second.promoted,1);assert.equal(second.added,0);
  const wb=await SpreadsheetFile.importXlsx(second.bytes);wb.recalculate();
  assert.equal(value(wb,'Support - Ledger','E9'),'Posted');assert.equal(value(wb,'6. History','J5'),3);
  assert.equal(value(wb,'6. History','K5'),3);assert.equal(value(wb,'Support - Account Snapshots','D15'),0);
  const again=await buildDirectWorkbook(second.bytes,intake(records));assert.equal(again.added,0);assert.equal(again.promoted,0);
});

test('missing accepted anchor refuses the entire update',async()=>{
  const records=intakeRecords();records.wells.record.payload.tables[0].rows[3][1]='DIFFERENT SOURCE';
  await assert.rejects(buildDirectWorkbook(await baseline(),intake(records)),{code:'ANCHOR_MISSING'});
});

test('identical purchases are separate occurrences and unknown merchants/dates stay flagged',async()=>{
  const base=await baseline(),wb=await SpreadsheetFile.importXlsx(base);
  const ledger=wb.worksheets.getItem('Support - Ledger').getRange('A5:M9').values;
  const records=intakeRecords(),table=records.chase_sapphire.record.payload.tables[1];
  table.rows.push([...table.rows[1]]);
  const data=intake(records),pending=data.rows.find(r=>r.state==='pending');pending.description='UNKNOWN MERCHANT';
  const first=reconcileWorkbookLedger(data,ledger,[]);
  assert.equal(first.rows.filter(r=>r[0]==='Chase'&&r[4]==='Posted'&&r[3]===4).length,2);
  const unknown=first.rows.find(r=>r[2]==='UNKNOWN MERCHANT');assert.equal(unknown[1],null);assert.equal(unknown[12],'Needs verification');
  assert.equal(first.retired,1);
  const again=reconcileWorkbookLedger(data,first.rows,[]);assert.equal(again.added,0);
  assert.equal(new Set(again.rows.map(r=>r[8])).size,again.rows.length);
});

test('a changed pending date is surfaced rather than silently assigning it to an old purchase week',async()=>{
  const wb=await SpreadsheetFile.importXlsx(await baseline());
  const records=intakeRecords(),s=records.chase_sapphire.record.payload;s.tables.shift();
  s.tables[0].rows.push(['Sep 8, 2031','FICTIONAL PENDING','$3.00']);Object.assign(s.source.chase,{pendingObserved:false,pendingHeader:'',pendingSummary:''});
  const r=reconcileWorkbookLedger(intake(records),wb.worksheets.getItem('Support - Ledger').getRange('A5:M9').values,[]);
  assert.equal(r.promoted,0);assert.equal(r.retired,1);
  assert.equal(r.rows.find(row=>row[2]==='FICTIONAL PENDING'&&row[4]==='Posted')[12],'Needs verification');
});

test('direct private save backs up the exact original and updates the configured workbook',async t=>{
  const root=await tempDirectory(t),protector=fixtureProtector(),base=await baseline();
  const config={version:1,baseWorkbook:path.join(root,'current.xlsx'),outputRoot:path.join(root,'runs'),privateRoot:path.join(root,'private'),bindings:INTAKE_BINDINGS};
  await fs.writeFile(config.baseWorkbook,base);const file=path.join(root,'config.json');await fs.writeFile(file,JSON.stringify(config));
  const store=await openPrivateEvidenceStore({root:config.privateRoot,repositoryRoot,protector});
  for(const {record} of Object.values(intakeRecords()))await store.save(record);
  const result=await runWorkbookIntake(file,{protector,now:INTAKE_NOW,apply:true});
  assert.equal(result.status,'ledger_updated');assert.equal(result.output,config.baseWorkbook);
  assert.deepEqual(await fs.readFile(result.backup),base);assert.notDeepEqual(await fs.readFile(config.baseWorkbook),base);
  assert.equal(result.workbookReady,false);assert.equal(result.checks.formulaErrors,0);
  if(process.env.BUDGET_FICTIONAL_PREVIEWS){
    await fs.mkdir(process.env.BUDGET_FICTIONAL_PREVIEWS,{recursive:true});
    for(const name of ['Start','Ledger','History','Snapshots','Debt'])
      await fs.copyFile(path.join(path.dirname(result.backup),name+'.png'),path.join(process.env.BUDGET_FICTIONAL_PREVIEWS,name+'.png'));
  }
  const accepted=await fs.readFile(config.baseWorkbook);
  const failing={...protector,async sealMany(){throw new Error('FICTIONAL RECEIPT FAILURE');}};
  await assert.rejects(runWorkbookIntake(file,{protector:failing,now:INTAKE_NOW,apply:true}));
  assert.deepEqual(await fs.readFile(config.baseWorkbook),accepted);
  assert.equal((await fs.readdir(config.outputRoot)).length,1);
});

test('Citi encrypted evidence updates ledger, balances, due date, source checks and accepted anchors',async t=>{
  const root=await tempDirectory(t),protector=fixtureProtector();
  const wb=await SpreadsheetFile.importXlsx(await baseline());
  const ledger=wb.worksheets.getItem('Support - Ledger');
  ledger.getRange('A10:M11').values=[
    ['Citi',new Date('2031-09-07'),'FICTIONAL SHOP',12,'Posted','Shopping','Include',null,'citi-old1','Keep user note','old','Posted','Verified'],
    ['Citi',new Date('2031-09-06'),'FICTIONAL REFUND',-2,'Posted','Shopping','Include',null,'citi-old2','','old','Posted','Verified']];
  wb.worksheets.getItem('Support - Debt Detail').getRange('A7:D7').values=[['Citi card',999,99,new Date('2031-09-01')]];
  wb.worksheets.getItem('Support - Rules').getRange('A6:C6').values=[['FICTIONAL PENDING','Shopping','Include']];
  wb.worksheets.getItem('1. Start').getRange('F9').values=[['Citi AAdvantage']];
  wb.recalculate();const base=await workbookBytes(wb);
  const config={version:1,baseWorkbook:path.join(root,'current.xlsx'),outputRoot:path.join(root,'runs'),privateRoot:path.join(root,'private'),bindings:{...INTAKE_BINDINGS,citi:'1234'}};
  await fs.writeFile(config.baseWorkbook,base);const file=path.join(root,'config.json');await fs.writeFile(file,JSON.stringify(config));
  const records=intakeRecords();records.citi={reference:`local:evidence:${randomUUID()}`,record:{version:1,kind:'budget-collector-source-evidence',source:'citi',capturedAt:INTAKE_NOW.toISOString(),payload:fictionalCiti()}};
  records.citi.record.payload.minimumDue='$7.25';
  const store=await openPrivateEvidenceStore({root:config.privateRoot,repositoryRoot,protector});
  for(const {record} of Object.values(records))await store.save(record);
  const result=await runWorkbookIntake(file,{protector,now:INTAKE_NOW,apply:true});
  assert.equal(result.accounts,4);assert.equal(result.checks.formulaErrors,0);assert.deepEqual(await fs.readFile(result.backup),base);
  const saved=await fs.readFile(config.baseWorkbook),after=await SpreadsheetFile.importXlsx(saved);after.recalculate();
  assert.equal(value(after,'Support - Debt Detail','B7'),15);assert.equal(value(after,'Support - Debt Detail','C7'),7.25);
  assert.equal(value(after,'Support - Debt Detail','D7'),(Date.parse('2031-10-01')-Date.UTC(1899,11,30))/86400000);
  assert.equal(value(after,'Support - Account Snapshots','I16'),'Verified');
  assert.equal(value(after,'Support - Account Snapshots','D16'),3);assert.equal(value(after,'Support - Account Snapshots','F16'),15);
  assert.match(value(after,'1. Start','G9'),/2031-09-07/);assert.equal(value(after,'6. History','J5'),3);
  const data=prepareWorkbookIntake({records,bindings:config.bindings,now:INTAKE_NOW});
  const replay=await buildDirectWorkbook(saved,data);assert.equal(replay.added,0);
  const c=records.citi.record.payload;c.rows[0].state='posted';c.pendingTotal='$0.00';c.postedTotal='$15.00';
  const settled=await buildDirectWorkbook(saved,prepareWorkbookIntake({records,bindings:config.bindings,now:INTAKE_NOW}));
  assert.equal(settled.promoted,1);assert.equal(settled.added,0);
  c.rows[1].description='CHANGED ACCEPTED POSTED ROW';
  await assert.rejects(buildDirectWorkbook(saved,prepareWorkbookIntake({records,bindings:config.bindings,now:INTAKE_NOW})),{code:'ANCHOR_MISSING'});
  records.citi.record.capturedAt='2031-09-08T14:00:00Z';
  assert.throws(()=>prepareWorkbookIntake({records,bindings:config.bindings,now:INTAKE_NOW}),{code:'STALE_INTAKE'});
  if(process.env.BUDGET_FICTIONAL_PREVIEWS){
    await fs.mkdir(process.env.BUDGET_FICTIONAL_PREVIEWS,{recursive:true});
    for(const name of ['Start','Snapshots','Debt'])await fs.copyFile(path.join(path.dirname(result.backup),name+'.png'),path.join(process.env.BUDGET_FICTIONAL_PREVIEWS,'Citi-'+name+'.png'));
  }
  assert.deepEqual(await fs.readFile(config.baseWorkbook),saved);
});
