import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openPrivateEvidenceStore } from "../src/private-evidence-store.mjs";

const protector = {
  async sealMany(values) { return values.map(value => Buffer.from(JSON.stringify(value)).toString("base64")).map(value => Buffer.from(value)); },
  async openMany(values) { return values.map(value => JSON.parse(Buffer.from(value.toString(), "base64").toString("utf8"))); },
};

test('Chase evidence can be saved and reopened without being mistaken for Wells', async t => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'collector-chase-evidence-'));
  t.after(() => fs.rm(parent, {recursive:true, force:true}));
  const repositoryRoot = path.join(parent,'repository'); await fs.mkdir(repositoryRoot);
  const store = await openPrivateEvidenceStore({root:path.join(parent,'private'),repositoryRoot,protector});
  const payload = {kind:'activity_candidate', rows:[['FICTIONAL ONLY']]};
  const ref = await store.save({source:'chase', capturedAt:'2031-04-08T12:00:00.000Z',payload});
  assert.equal((await store.open(ref)).source,'chase');
  assert.deepEqual(await store.latestPayload({source:'chase',kind:'activity_candidate'}),payload);
  assert.equal(await store.latestPayload({source:'wells',kind:'activity_candidate'}),null);
  const prime={product:'prime_visa',suffix:'1234'},sapphire={product:'sapphire_preferred',suffix:'5678'};
  await store.save({source:'chase',capturedAt:'2031-04-08T12:01:00Z',payload:{kind:'chase_anchor_snapshot',identity:prime}});
  await store.save({source:'chase',capturedAt:'2031-04-08T12:02:00Z',payload:{kind:'chase_anchor_snapshot',identity:sapphire}});
  assert.deepEqual((await store.latestPayload({source:'chase',kind:'chase_anchor_snapshot',identity:prime})).identity,prime);
  assert.deepEqual((await store.latestPayload({source:'chase',kind:'chase_anchor_snapshot',identity:sapphire})).identity,sapphire);
});

test("source evidence is sealed outside the repository and ordinary references contain no source text", async t => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "collector-evidence-"));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const repositoryRoot = path.join(parent, "repository");
  const root = path.join(parent, "private");
  await fs.mkdir(repositoryRoot);
  const store = await openPrivateEvidenceStore({ root, repositoryRoot, protector });
  const reference = await store.save({ source: "wells", capturedAt: "2031-04-08T12:00:00.000Z",
    payload: { rows: [["FICTIONAL MERCHANT", "$7.43"]] } });
  assert.match(reference, /^local:evidence:[a-f0-9-]{36}$/);
  assert.doesNotMatch(reference, /FICTIONAL|7\.43/);
  assert.deepEqual(await store.open(reference), { version: 1, kind: "budget-collector-source-evidence",
    source: "wells", capturedAt: "2031-04-08T12:00:00.000Z", payload: { rows: [["FICTIONAL MERCHANT", "$7.43"]] } });
  const files = await fs.readdir(path.join(root, "source-evidence"));
  assert.equal(files.length, 1);
  assert.doesNotMatch(await fs.readFile(path.join(root, "source-evidence", files[0]), "utf8"), /FICTIONAL|7\.43/);
});

test('latest normalized evidence stays private and is selected by encrypted record kind', async t => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'collector-evidence-'));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const repositoryRoot = path.join(parent, 'repository'), root = path.join(parent, 'private');
  await fs.mkdir(repositoryRoot);
  const store = await openPrivateEvidenceStore({ root, repositoryRoot, protector });
  await store.save({ source:'wells', capturedAt:'2031-04-08T12:00:00.000Z', payload:{kind:'raw_candidate', secret:'FICTIONAL'} });
  await store.save({ source:'wells', capturedAt:'2031-04-08T12:01:00.000Z', payload:{kind:'wells_normalized_activity', rows:3} });
  assert.deepEqual(await store.latestPayload({source:'wells',kind:'wells_normalized_activity'}),{kind:'wells_normalized_activity',rows:3});
});
