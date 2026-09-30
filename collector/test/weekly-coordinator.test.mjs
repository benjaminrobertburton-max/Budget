import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {runWeeklyRefresh} from '../src/weekly-refresh.mjs';
import {readWeeklySession,saveWeeklySession} from '../src/weekly-session.mjs';
import {WEEKLY_SOURCES} from '../src/weekly-sequence.mjs';
import {openPrivateEvidenceStore} from '../src/private-evidence-store.mjs';
import {intakeRecords,INTAKE_BINDINGS} from '../fixtures/workbook-intake.mjs';
import {fictionalCiti} from '../fixtures/citi.mjs';
import {fictionalPaypal} from '../fixtures/paypal.mjs';
import {tempDirectory,fixtureProtector,repositoryRoot} from './store-helpers.mjs';

async function setup(t){
  const privateRoot=await tempDirectory(t),configFile=path.join(privateRoot,'config.json'),protector=fixtureProtector();
  const config={bindings:{...INTAKE_BINDINGS,citi:'4444'},wealthfront:{accountId:'FICTIONAL-CASH'}};
  const records=intakeRecords();
  const candidates={...Object.fromEntries(Object.entries(records).map(([k,v])=>[k,v.record.payload])),citi:fictionalCiti(),paypal:fictionalPaypal(),
    wealthfront:{version:1,kind:'wealthfront_cash',finding:'captured',accountId:'FICTIONAL-CASH',title:'Individual Cash Account',
      total:'$150.00',available:'$150.00',unavailable:'$0.00',pending:'$0.00',rows:[
        {description:'FICTIONAL TRANSFER',amount:'-$50.00',date:'Sep 9, 2031',runningBalance:'$150.00'},
        {description:'FICTIONAL DEPOSIT',amount:'+$100.00',date:'Sep 8, 2031',runningBalance:'$200.00'}]}};
  let released=0,imports=0;
  return {privateRoot,configFile,candidates,config,protector,get imports(){return imports;},get released(){return released;},
    options:{configFile,preflight:async()=>({config,privateRoot,protector,sessionKey:configFile,release:async()=>{released++;}}),
      importWorkbook:async(file,{evidenceReferences})=>{
        assert.equal(file,configFile);assert.equal(Object.keys(evidenceReferences).length,6);imports++;
        return {output:path.join(privateRoot,'fictional.xlsx'),backup:'fictional-backup'};
      },openResult:()=>{}}};
}
const commands={open_wells:'wells',open_chase_prime:'chase_prime',open_chase_sapphire:'chase_sapphire',capture_citi_activity:'citi',capture_paypal_financing:'paypal',capture_wealthfront_cash:'wealthfront'};
const callbacks={wells:'onActivityCapture',chase_prime:'onChaseActivityCapture',chase_sapphire:'onChaseActivityCapture',citi:'onCitiActivityCapture',paypal:'onPaypalCapture',wealthfront:'onWealthfrontCapture'};
function fakeBridge(f,{stopAfter=null,abort=null,seen=[]}={}){
  return async options=>{
    assert.equal(options.captureAfterAuth,'wells');
    const queue=command=>{
      const source=commands[command];seen.push(source);
      if(source===stopAfter){setImmediate(()=>abort.abort());return;}
      setImmediate(async()=>{await options[callbacks[source]](f.candidates[source]);});
    };
    queue(options.nextCommand);return {queue,close:async()=>{}};
  };
}

test('actual weekly coordinator accepts Chase identity objects and imports only after all six sources',async t=>{
  const f=await setup(t),seen=[];
  const result=await runWeeklyRefresh({...f.options,startBridge:fakeBridge(f,{seen})});
  assert.deepEqual(seen,WEEKLY_SOURCES);assert.equal(result.status,'complete');assert.equal(f.imports,1);assert.equal(f.released,1);
  assert.deepEqual(await readWeeklySession({privateRoot:f.privateRoot,configFile:f.configFile,sources:WEEKLY_SOURCES}),[]);
});

test('interruption after Wells resumes at Chase without another Wells capture',async t=>{
  const f=await setup(t),abort=new AbortController(),seen=[];
  await assert.rejects(runWeeklyRefresh({...f.options,signal:abort.signal,startBridge:fakeBridge(f,{stopAfter:'chase_prime',abort})}),{code:'REFRESH_CANCELLED'});
  assert.equal(f.imports,0);
  await runWeeklyRefresh({...f.options,startBridge:fakeBridge(f,{seen})});
  assert.deepEqual(seen,WEEKLY_SOURCES.slice(1));assert.equal(f.imports,1);
});

test('failed final import retains all six receipts and retries import without opening Chrome',async t=>{
  const f=await setup(t);
  await assert.rejects(runWeeklyRefresh({...f.options,startBridge:fakeBridge(f),importWorkbook:async()=>{throw Error('fictional import blocked');}}));
  const saved=await readWeeklySession({privateRoot:f.privateRoot,configFile:f.configFile,sources:WEEKLY_SOURCES});
  assert.deepEqual(saved,WEEKLY_SOURCES);assert.equal(f.imports,0);
  await runWeeklyRefresh({...f.options,startBridge:async()=>{assert.fail('No capture bridge on import retry');}});
  assert.equal(f.imports,1);
});

test('wrong Chase account blocks before import and preserves Wells checkpoint',async t=>{
  const f=await setup(t);f.candidates.chase_prime.source.accountSuffix='9999';
  await assert.rejects(runWeeklyRefresh({...f.options,startBridge:fakeBridge(f)}),{code:'CHASE_IDENTITY_BLOCKED'});
  assert.equal(f.imports,0);assert.equal(f.released,1);
  assert.deepEqual(await readWeeklySession({privateRoot:f.privateRoot,configFile:f.configFile,sources:WEEKLY_SOURCES}),['wells']);
});
