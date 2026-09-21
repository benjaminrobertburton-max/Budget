import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {prepareWorkbookIntake} from '../src/workbook-intake.mjs';
import {intakeRecords,INTAKE_BINDINGS,INTAKE_NOW} from '../fixtures/workbook-intake.mjs';
import {fixtureProtector,tempDirectory,repositoryRoot} from './store-helpers.mjs';
import {openPrivateEvidenceStore} from '../src/private-evidence-store.mjs';
import {fictionalWorkbook} from '../../work/collector_workbook_fixture.mjs';
import {buildCollectorWorkbook,verifyCollectorPreservation,runWorkbookIntake} from '../../work/collector_workbook.mjs';
const require=createRequire(new URL('../../work/collector_workbook.mjs',import.meta.url));
const JSZip=require('jszip');
const execute=promisify(execFile);

test('incomplete intake CLI arguments never fall through to the dated workbook build or demo',async t=>{
  const folder=await tempDirectory(t);
  for(const args of [
    ['work/build_comprehensive_budget.mjs','--collector-intake'],
    ['work/build_comprehensive_budget.mjs','--collector-intake='],
    ['work/build_comprehensive_budget.mjs','--collector-intake=a','--collector-intake=b'],
    ['collector/src/cli.mjs','workbook-intake'],
  ])await assert.rejects(execute(process.execPath,args,{cwd:repositoryRoot,windowsHide:true,
    env:{...process.env,BUDGET_OUTPUT_DIR:folder}}),e=>e.code===1&&!e.stdout.includes('passed'));
  assert.deepEqual(await fs.readdir(folder),[]);
});

test('real XLSX intake preserves historical/native parts and every original financial cell',async()=>{
  const base=await fictionalWorkbook(),intake=prepareWorkbookIntake({records:intakeRecords(),bindings:INTAKE_BINDINGS,now:INTAKE_NOW});
  const archive=await JSZip.loadAsync(base);archive.file('customXml/fictional-preserved.xml','<fictional>keep</fictional>');
  const input=await archive.generateAsync({type:'nodebuffer'}),out=await buildCollectorWorkbook(input,intake);
  await verifyCollectorPreservation(input,out);
  const zip=await JSZip.loadAsync(out);
  const name=Object.keys(zip.files).find(n=>n.startsWith('xl/worksheets/collector-'));
  const content=await zip.file(name).async('string');
  assert.match(content,/FICTIONAL PAYROLL/);assert.match(content,/Not imported/);
  assert.match(content,/Zero inferred/);assert.doesNotMatch(content,/<f[ >]/);
  assert.equal(await zip.file('customXml/fictional-preserved.xml').async('string'),'<fictional>keep</fictional>');
  await assert.rejects(buildCollectorWorkbook(out,intake),{code:'INTAKE_ALREADY_PRESENT'});
});
test('merchant text cannot execute as a workbook formula',async()=>{
  const records=intakeRecords();records.chase_prime.record.payload.tables[0].rows[1][1]='=HYPERLINK("https://invalid.example","FICTIONAL")';
  const out=await buildCollectorWorkbook(await fictionalWorkbook(),prepareWorkbookIntake({records,bindings:INTAKE_BINDINGS,now:INTAKE_NOW}));
  const zip=await JSZip.loadAsync(out),name=Object.keys(zip.files).find(n=>n.startsWith('xl/worksheets/collector-'));
  const text=await zip.file(name).async('string');assert.match(text,/HYPERLINK/);assert.doesNotMatch(text,/<f[ >]/);
});

test('numeric-looking descriptions retain exact source text and leading zeroes',async()=>{
  const records=intakeRecords();records.chase_prime.record.payload.tables[0].rows[1][1]='001234';
  const out=await buildCollectorWorkbook(await fictionalWorkbook(),prepareWorkbookIntake({records,bindings:INTAKE_BINDINGS,now:INTAKE_NOW}));
  const zip=await JSZip.loadAsync(out),name=Object.keys(zip.files).find(n=>n.startsWith('xl/worksheets/collector-'));
  assert.match(await zip.file(name).async('string'),/>001234<\/t>/);
});
test('private encrypted evidence reaches a separate rendered review workbook without touching the base',async t=>{
  const root=await tempDirectory(t),protector=fixtureProtector();
  const base=await fictionalWorkbook(),baseWorkbook=path.join(root,'current.xlsx');await fs.writeFile(baseWorkbook,base);
  const config={version:1,baseWorkbook,outputRoot:path.join(root,'reviews'),privateRoot:path.join(root,'private'),bindings:INTAKE_BINDINGS};
  const store=await openPrivateEvidenceStore({root:config.privateRoot,repositoryRoot,protector});
  for(const {record} of Object.values(intakeRecords()))await store.save(record);
  const configFile=path.join(root,'config.json');await fs.writeFile(configFile,JSON.stringify(config));
  const r=await runWorkbookIntake(configFile,{protector,now:INTAKE_NOW});
  assert.equal(r.workbookReady,false);assert.equal(r.rows,5);assert.equal(r.accounts,3);
  assert.equal(r.checks.formulaErrors,0);assert.ok(r.checks.comparedCells>100);
  assert.deepEqual(await fs.readFile(baseWorkbook),base);
  await verifyCollectorPreservation(base,await fs.readFile(r.output));
  const files=await fs.readdir(path.dirname(r.output));assert.deepEqual(files.sort(),['Collector_Intake.png','Start.png','Tuesday.png','budget_collector_review.xlsx','receipt.enc'].sort());
  const [receipt]=await protector.openMany([await fs.readFile(path.join(path.dirname(r.output),'receipt.enc'))]);
  assert.equal(receipt.workbookReady,false);assert.equal(receipt.references.length,3);
});

test('changed financial cells are detected independently of the importer',async()=>{
  const base=await fictionalWorkbook(),intake=prepareWorkbookIntake({records:intakeRecords(),bindings:INTAKE_BINDINGS,now:INTAKE_NOW});
  const out=await buildCollectorWorkbook(base,intake),zip=await JSZip.loadAsync(out);
  const name='xl/worksheets/sheet7.xml';
  zip.file(name,(await zip.file(name).async('string')).replace('<x:v>2</x:v>','<x:v>999</x:v>'));
  await assert.rejects(verifyCollectorPreservation(base,await zip.generateAsync({type:'nodebuffer'})),{code:'WORKBOOK_PRESERVATION_FAILED'});
});

test('formula-error failure removes derived files and preserves the original',async t=>{
  const root=await tempDirectory(t),protector=fixtureProtector(),zip=await JSZip.loadAsync(await fictionalWorkbook());
  const part='xl/worksheets/sheet4.xml';
  zip.file(part,(await zip.file(part).async('string')).replace('100-50','1/0'));
  const base=await zip.generateAsync({type:'nodebuffer'}),baseWorkbook=path.join(root,'current.xlsx');
  await fs.writeFile(baseWorkbook,base);
  const config={version:1,baseWorkbook,outputRoot:path.join(root,'reviews'),privateRoot:path.join(root,'private'),bindings:INTAKE_BINDINGS};
  const store=await openPrivateEvidenceStore({root:config.privateRoot,repositoryRoot,protector});
  for(const {record} of Object.values(intakeRecords()))await store.save(record);
  const file=path.join(root,'config.json');await fs.writeFile(file,JSON.stringify(config));
  await assert.rejects(runWorkbookIntake(file,{protector,now:INTAKE_NOW}),{code:'WORKBOOK_FORMULA_ERROR'});
  assert.deepEqual(await fs.readFile(baseWorkbook),base);assert.deepEqual(await fs.readdir(config.outputRoot),[]);
});
test('repo/cloud paths and empty source intake cannot publish a workbook',async t=>{
  const root=await tempDirectory(t),protector=fixtureProtector(),baseWorkbook=path.join(root,'current.xlsx');
  await fs.writeFile(baseWorkbook,await fictionalWorkbook());
  const config={version:1,baseWorkbook,outputRoot:path.join(root,'reviews'),privateRoot:path.join(root,'private'),bindings:INTAKE_BINDINGS};
  const file=path.join(root,'config.json');await fs.writeFile(file,JSON.stringify(config));
  await assert.rejects(runWorkbookIntake(file,{protector,now:INTAKE_NOW}),{code:'INTAKE_EMPTY'});
  await assert.rejects(fs.stat(config.outputRoot),{code:'ENOENT'});
  config.outputRoot=path.join(repositoryRoot,'outputs');await fs.writeFile(file,JSON.stringify(config));
  await assert.rejects(runWorkbookIntake(file,{protector,now:INTAKE_NOW}),{code:'UNSAFE_STORAGE_PATH'});
  config.outputRoot=path.join(root,'OneDrive','reviews');await fs.writeFile(file,JSON.stringify(config));
  await assert.rejects(runWorkbookIntake(file,{protector,now:INTAKE_NOW}),{code:'UNSAFE_STORAGE_PATH'});
});

test('a concurrent base edit during receipt encryption blocks publication without undoing that edit',async t=>{
  const root=await tempDirectory(t),protector=fixtureProtector(),baseWorkbook=path.join(root,'current.xlsx');
  await fs.writeFile(baseWorkbook,await fictionalWorkbook());
  const config={version:1,baseWorkbook,outputRoot:path.join(root,'reviews'),privateRoot:path.join(root,'private'),bindings:INTAKE_BINDINGS};
  const store=await openPrivateEvidenceStore({root:config.privateRoot,repositoryRoot,protector});
  for(const {record} of Object.values(intakeRecords()))await store.save(record);
  const file=path.join(root,'config.json');await fs.writeFile(file,JSON.stringify(config));
  const changed=Buffer.from('FICTIONAL CONCURRENT EDIT');
  const editingProtector={...protector,async sealMany(records){
    if(records[0]?.kind==='workbook_intake_receipt')await fs.writeFile(baseWorkbook,changed);
    return protector.sealMany(records);
  }};
  await assert.rejects(runWorkbookIntake(file,{protector:editingProtector,now:INTAKE_NOW}),{code:'WORKBOOK_CHANGED'});
  assert.deepEqual(await fs.readFile(baseWorkbook),changed);assert.deepEqual(await fs.readdir(config.outputRoot),[]);
});
