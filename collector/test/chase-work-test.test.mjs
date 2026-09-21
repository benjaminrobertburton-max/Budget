import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { runChaseWorkTest } from "../src/chase-work-test.mjs";
import { fixtureProtector, repositoryRoot, tempDirectory } from "./store-helpers.mjs";
import { fictionalActivityCandidate } from "../fixtures/activity-candidate.mjs";
import { windowsProtector } from "../src/protection.mjs";

const origin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";

test('paired work run isolates both cards and verifies repeat overlap before cleanup',async t=>{
  const parent=path.join(await tempDirectory(t),'pair');
  const result=await runChaseWorkTest({repositoryRoot,parent,protector:fixtureProtector(),port:0,target:'both',
    onReady:async({port})=>{
      const {base,headers}=await connect(port);
      for(const product of ['prime_visa','prime_visa','sapphire_preferred','sapphire_preferred']){
        const command=await(await fetch(base+'/v1/command',{headers})).json();
        assert.equal(command.command,product==='prime_visa'?'open_chase_prime':'open_chase_sapphire');
        const c=fictionalActivityCandidate();
        c.source={accountSuffix:product==='prime_visa'?'1234':'5678',balances:[],nextPage:'next_enabled',pageToken:'a0000001',
          chase:{product,range:'Activity since last statement',postedFooter:'3 of 20 transactions',pendingObserved:false}};
        c.tables=[{columns:['date','description','amount','details_control'],headers:['Date','Description','Amount','Action'],
          rows:[['Posted Transactions'],...['A','B','C'].map(n=>['Sep 1, 2031','FICTIONAL '+n,'$1.00',''])],issues:[]}];
        assert.equal((await fetch(base+'/v1/chase-activity',{method:'POST',headers,body:JSON.stringify(c)})).status,204);
      }
    }});
  assert.equal(result.status,'candidate_captured');assert.equal(result.checks.length,4);
  assert.deepEqual(result.checks.map(c=>c.overlap.action),['baseline_only','stop','baseline_only','stop']);
  assert.equal(result.checks[1].overlap.unmatchedPosted,0);
  assert.equal(result.checks[3].overlap.unmatchedPosted,0);
  assert.equal(result.workbookReady,false);
  assert.deepEqual(await fs.readdir(parent),[]);
});

test('temporary Chase requests another page only for missing prior overlap and stops when found',async t=>{
  const {normalizeChaseActivity}=await import('../src/chase-normalize.mjs');
  const make=(names,token)=>{
    const c=fictionalActivityCandidate();
    c.source={accountSuffix:'1234',balances:[],nextPage:'next_enabled',pageToken:token,
      chase:{product:'prime_visa',range:'Activity since last statement',postedFooter:'2 of 8 transactions',pendingObserved:true}};
    c.tables=[{columns:['date','description','amount','details_control'],headers:['Date','Description','Amount','Action'],
      rows:[['Posted Transactions'],...names.map(n=>['Sep 1, 2031',n,'$1.00',''])],issues:[]}];return c;
  };
  const prior=normalizeChaseActivity(make(['A','B','C'],'a0000001'),'fixture');
  const parent=path.join(await tempDirectory(t),'incremental');
  const result=await runChaseWorkTest({repositoryRoot,parent,protector:fixtureProtector(),port:0,prior,
    onReady:async({port})=>{
      const {base,headers}=await connect(port);
      await fetch(base+'/v1/command',{headers});
      assert.equal((await fetch(base+'/v1/chase-activity',{method:'POST',headers,body:JSON.stringify(make(['NEW'],'a0000002'))})).status,204);
      const next=await(await fetch(base+'/v1/command',{headers})).json();
      assert.deepEqual(next,{version:1,command:'capture_chase_more',pageToken:'a0000002'});
      assert.equal((await fetch(base+'/v1/chase-activity',{method:'POST',headers,body:JSON.stringify(make(['NEW','A','B','C'],'a0000003'))})).status,204);
    }});
  assert.equal(result.overlap.action,'stop');assert.equal(result.overlap.overlapVerified,true);
  assert.equal(result.overlap.unmatchedPosted,1);
  assert.deepEqual(await fs.readdir(parent),[]);
});

test("an early empty Chase frame must not close the work run before a later activity candidate", async t => {
  const parent = path.join(await tempDirectory(t),"frames");
  const result = await runChaseWorkTest({repositoryRoot,parent,protector:fixtureProtector(),port:0,
    onReady:async ({port})=>{
      const {base,headers} = await connect(port);
      const empty = fictionalActivityCandidate();
      empty.finding = "no_activity_table"; empty.tables = [];
      assert.equal((await fetch(base+"/v1/chase-activity",{method:"POST",headers,
        body:JSON.stringify(empty)})).status,204);
      await new Promise(resolve=>setTimeout(resolve,30));
      assert.equal((await fetch(base+"/v1/chase-activity",{method:"POST",headers,
        body:JSON.stringify(fictionalActivityCandidate())})).status,204);
    }});
  assert.equal(result.status,"candidate_captured");
  assert.deepEqual(await fs.readdir(parent),[]);
});

test("all-empty Chase replies end at the bounded response window and never certify an account", async t => {
  const parent = path.join(await tempDirectory(t),"empty-frames");
  const result = await runChaseWorkTest({repositoryRoot,parent,protector:fixtureProtector(),port:0,
    captureWindowMs:80,durationMs:3000,onReady:async ({port})=>{
      const {base,headers} = await connect(port);
      await fetch(base+"/v1/progress",{method:"POST",headers,
        body:JSON.stringify({version:1,event:"chase_capture_dispatched",tabId:2})});
      const empty = fictionalActivityCandidate();
      empty.finding = "no_activity_table"; empty.tables = [];
      await fetch(base+"/v1/chase-activity",{method:"POST",headers,body:JSON.stringify(empty)});
    }});
  assert.equal(result.status,"activity_capture_no_table");
  assert.equal(result.summary,null);
  assert.equal(result.workbookReady,false);
  assert.deepEqual(await fs.readdir(parent),[]);
});

test("a dispatched Chase capture with no reply ends as incomplete, not zero activity", async t => {
  const parent = path.join(await tempDirectory(t),"missing-frames");
  const result = await runChaseWorkTest({repositoryRoot,parent,protector:fixtureProtector(),port:0,
    captureWindowMs:60,durationMs:3000,onReady:async ({port})=>{
      const {base,headers} = await connect(port);
      await fetch(base+"/v1/progress",{method:"POST",headers,
        body:JSON.stringify({version:1,event:"chase_capture_dispatched",tabId:2})});
    }});
  assert.equal(result.status,"capture_incomplete");
  assert.equal(result.summary,null);
  assert.deepEqual(await fs.readdir(parent),[]);
});

for (const [target,command] of [["prime_visa","open_chase_prime"],["sapphire_preferred","open_chase_sapphire"]]) {
  test(`temporary ${target} requests only its configured card and does not auto-capture Overview`, async t => {
    const parent = path.join(await tempDirectory(t),"card-work");
    const controller = new AbortController();
    const result = await runChaseWorkTest({repositoryRoot,parent,protector:fixtureProtector(),
      port:0,target,signal:controller.signal,onReady:async ({port})=>{
        const {base,headers} = await connect(port);
        assert.equal((await (await fetch(base+"/v1/command",{headers})).json()).command,command);
        await fetch(base+"/v1/progress",{method:"POST",headers,
          body:JSON.stringify({version:1,event:"chase_authenticated_page",tabId:2})});
        assert.equal((await (await fetch(base+"/v1/command",{headers})).json()).command,"none");
        controller.abort();
      }});
    assert.equal(result.status,"cancelled");
    assert.deepEqual(await fs.readdir(parent),[]);
  });
}

test("temporary Chase rejects arbitrary navigation targets before creating files", async t => {
  const parent = path.join(await tempDirectory(t),"must-not-exist");
  await assert.rejects(runChaseWorkTest({repositoryRoot,parent,target:"https://unreviewed.example"}),
    {code:"INVALID_TEST_RUN"});
  await assert.rejects(fs.stat(parent),{code:"ENOENT"});
});
async function connect(port) {
  const base = `http://127.0.0.1:${port}`;
  const sessionResponse = await fetch(base + "/v1/session", {method:"POST",headers:{Origin:origin}});
  const {session} = await sessionResponse.json();
  const headers = {Origin:origin,"X-Budget-Collector-Session":session};
  return { base, headers };
}

test("work Chase capture encrypts evidence, drains bridge and deletes only its owned run", async t => {
  const parent = path.join(await tempDirectory(t), "work-test");
  const protector = fixtureProtector();
  const sealed = [];
  const instrumented = {...protector, sealMany: async records => {
    sealed.push(...records.map(record => record.kind));
    return protector.sealMany(records);
  }};
  const result = await runChaseWorkTest({repositoryRoot,parent,protector:instrumented,port:0,
    onReady:async ({port}) => {
      const {base,headers} = await connect(port);
      assert.equal((await (await fetch(base+"/v1/command",{headers})).json()).command,"open_chase");
      const response = await fetch(base+"/v1/chase-activity",{method:"POST",headers,
        body:JSON.stringify(fictionalActivityCandidate())});
      assert.equal(response.status,204);
    }});
  assert.deepEqual(sealed,["work_chase_preflight","work_chase_candidate"]);
  assert.equal(result.status,"candidate_captured");
  assert.equal(result.workbookReady,false);
  assert.doesNotMatch(JSON.stringify(result),/FICTIONAL SHOP|1234|125\.00|7\.43/);
  assert.deepEqual(await fs.readdir(parent),[]);
});

test("Chase work normalization remains inside encrypted evidence and exposes only counts", async t => {
  const parent=path.join(await tempDirectory(t),'normalized-work');
  const protector=fixtureProtector();
  let saved;
  const candidate=fictionalActivityCandidate();
  candidate.tables=[{columns:['date','description','unknown','amount','details_control'],
    headers:['Date','Description','Category','Amount','Action'],
    rows:[['Posted Transactions'],['Sep 1, 2031','FICTIONAL PRIVATE SHOP','Shopping','−$3.27','']],
    issues:['unknown_columns']}];
  const result=await runChaseWorkTest({repositoryRoot,parent,port:0,
    protector:{...protector,sealMany:async records=>{
      const blobs=await protector.sealMany(records);
      if(records[0].kind==='work_chase_candidate') saved=(await protector.openMany(blobs))[0];
      return blobs;
    }},onReady:async({port})=>{
      const {base,headers}=await connect(port);
      assert.equal((await fetch(base+'/v1/chase-activity',{method:'POST',headers,body:JSON.stringify(candidate)})).status,204);
    }});
  assert.equal(saved.normalized.transactions[0].sourceAmountMinor,-327);
  assert.equal(saved.normalized.transactions[0].sourceCategory,'Shopping');
  assert.equal(result.normalization.parsedRows,1);
  assert.equal(result.normalization.workbookReady,false);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE SHOP|Shopping|327/);
  assert.deepEqual(await fs.readdir(parent),[]);
});

for (const reason of ["cancelled","timeout","capture_failed"]) {
  test(`work Chase ${reason} leaves no collector evidence`, async t => {
    const parent = path.join(await tempDirectory(t), "work-test");
    const controller = new AbortController();
    const protector = fixtureProtector();
    const instrumented = {...protector, sealMany:async records => {
      if (reason === "capture_failed" && records[0].kind === "work_chase_candidate") throw new Error("FICTIONAL PRIVATE FAILURE");
      return protector.sealMany(records);
    }};
    const pending = runChaseWorkTest({repositoryRoot,parent,protector:instrumented,port:0,
      signal:controller.signal,durationMs:reason === "timeout" ? 50 : 5000,
      onReady:async ({port}) => {
        if (reason === "cancelled") controller.abort();
        if (reason === "capture_failed") {
          const {base,headers} = await connect(port);
          assert.equal((await fetch(base+"/v1/chase-activity",{method:"POST",headers,
            body:JSON.stringify(fictionalActivityCandidate())})).status,500);
        }
      }});
    if (reason === "capture_failed") await assert.rejects(pending,{code:"TEST_RUN_FAILED"});
    else {
      const result = await pending;
      assert.equal(result.status,reason);
      assert.equal(result.summary,null);
    }
    assert.deepEqual(await fs.readdir(parent),[]);
  });
}

test("work Chase rejects failed preflight before opening a bank-command bridge", async t => {
  const parent = path.join(await tempDirectory(t), "work-test");
  await assert.rejects(runChaseWorkTest({repositoryRoot,parent,port:0,
    protector:{...fixtureProtector(),sealMany:async()=>{throw new Error("FICTIONAL SECRET");}},
    onReady:()=>assert.fail("Must not start")}),{code:"TEST_RUN_FAILED"});
  assert.deepEqual(await fs.readdir(parent),[]);
});

test("work Chase uses actual Windows encryption and deletes the encrypted records", async t => {
  const parent = path.join(await tempDirectory(t), "work-dpapi");
  const protector = windowsProtector();
  let verified = 0;
  const protectedWriter = {...protector, sealMany:async records => {
    const blobs = await protector.sealMany(records);
    for (const blob of blobs) assert.equal(blob.includes(Buffer.from("FICTIONAL SHOP")),false);
    assert.deepEqual(await protector.openMany(blobs),records);
    verified += records.length;
    return blobs;
  }};
  const result = await runChaseWorkTest({repositoryRoot,parent,protector:protectedWriter,port:0,
    onReady:async ({port}) => {
      const {base,headers} = await connect(port);
      assert.equal((await fetch(base+"/v1/chase-activity",{method:"POST",headers,
        body:JSON.stringify(fictionalActivityCandidate())})).status,204);
    }});
  assert.equal(result.status,"candidate_captured");
  assert.equal(verified,2);
  assert.deepEqual(await fs.readdir(parent),[]);
});

test("work Chase cancellation waits for an in-flight encrypted write before removing evidence", async t => {
  const parent = path.join(await tempDirectory(t), "work-drain");
  const controller = new AbortController();
  const protector = fixtureProtector();
  let writeFinished = false;
  const protectedWriter = {...protector,sealMany:async records => {
    if (records[0].kind === "work_chase_candidate") {
      controller.abort();
      await new Promise(resolve=>setTimeout(resolve,40));
      writeFinished = true;
    }
    return protector.sealMany(records);
  }};
  const result = await runChaseWorkTest({repositoryRoot,parent,protector:protectedWriter,port:0,
    signal:controller.signal,onReady:async ({port}) => {
      const {base,headers} = await connect(port);
      await fetch(base+"/v1/chase-activity",{method:"POST",headers,
        body:JSON.stringify(fictionalActivityCandidate())});
    }});
  assert.equal(result.status,"cancelled");
  assert.equal(result.summary,null);
  assert.equal(writeFinished,true);
  assert.deepEqual(await fs.readdir(parent),[]);
});
