import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { runChaseWorkTest } from "../src/chase-work-test.mjs";
import { fixtureProtector, repositoryRoot, tempDirectory } from "./store-helpers.mjs";
import { fictionalActivityCandidate } from "../fixtures/activity-candidate.mjs";
import { windowsProtector } from "../src/protection.mjs";

const origin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
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
