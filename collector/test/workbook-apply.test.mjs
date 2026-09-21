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
const require=createRequire(new URL('../../work/workbook_bytes.mjs',import.meta.url));
const {SpreadsheetFile}=await import(pathToFileURL(require.resolve('@oai/artifact-tool')));
const intake=records=>prepareWorkbookIntake({records,bindings:INTAKE_BINDINGS,now:INTAKE_NOW});
const value=(wb,name,cell)=>wb.worksheets.getItem(name).getRange(cell).values[0][0];
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
