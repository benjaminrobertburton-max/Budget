import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { openLocalStore } from "../src/local-store.mjs";
import { refreshToLocalStore } from "../src/private-refresh.mjs";
import { fixtureProtector, testStore, repositoryRoot } from "./store-helpers.mjs";
import { makeRegistry, makeCaptures, fixtureAdapters, FIXTURE_NOW } from "../fixtures/synthetic.mjs";

async function refresh(store, mutate = () => {}) {
  const registry = makeRegistry();
  const captures = makeCaptures(registry);
  mutate(captures, registry);
  return refreshToLocalStore({ store, registry, adapters: fixtureAdapters(captures), now: FIXTURE_NOW });
}

const names = async (root, subdirectory) => (await fs.readdir(path.join(root, subdirectory))).filter(name => name.endsWith(".enc")).sort();

test("collection survives closing and reopening an encrypted local store", async t => {
  const { root, protector, store } = await testStore(t);
  const result = await refresh(store);
  assert.equal(result.status, "candidate_saved_locally", JSON.stringify(result));
  assert.equal(result.workbookReady, false);
  assert.equal(result.receipt.sequence, 1);
  const reopened = await openLocalStore({ root, repositoryRoot, protector });
  const loaded = await reopened.readLatest();
  assert.equal(loaded.payload.candidate.accountCount, 11);
  assert.equal(loaded.payload.candidate.nextState.accounts["demo-wells"].records.length, 4);
  for (const directory of ["runs", "commits"]) {
    for (const name of await names(root, directory)) {
      const bytes = await fs.readFile(path.join(root, directory, name));
      assert.ok(!bytes.includes(Buffer.from("FICTIONAL PAYROLL")));
      assert.ok(!bytes.includes(Buffer.from('"amountMinor"')));
    }
  }
  await assert.rejects(fs.stat(path.join(root, "refresh.lock")), { code: "ENOENT" });
});

test("repeated saved refresh preserves old snapshots and adds no transactions", async t => {
  const { root, store } = await testStore(t);
  assert.equal((await refresh(store)).status, "candidate_saved_locally");
  const first = (await names(root, "runs"))[0];
  const firstBytes = await fs.readFile(path.join(root, "runs", first));
  const result = await refresh(store);
  assert.equal(result.status, "candidate_saved_locally");
  assert.equal(result.receipt.sequence, 2);
  assert.equal(result.addedTransactions, 0);
  assert.equal((await names(root, "runs")).length, 2);
  assert.deepEqual(await fs.readFile(path.join(root, "runs", first)), firstBytes);
});

test("failed account checks leave the last saved state and files intact", async t => {
  const { root, store } = await testStore(t);
  await refresh(store);
  const previous = await store.readLatest();
  const result = await refresh(store, captures => { captures["demo-wells"].coverage.pending.totalMinor = 0; });
  assert.equal(result.status, "blocked");
  assert.equal(result.issues[0].code, "TOTAL_MISMATCH");
  assert.deepEqual(await store.readLatest(), previous);
  assert.equal((await names(root, "runs")).length, 1);
  assert.equal((await names(root, "commits")).length, 1);
});

test("interrupted save leaves an orphan ciphertext, preserves the prior commit, and can retry", async t => {
  let interrupt = false;
  const { root, store } = await testStore(t, { onCheckpoint: async () => { if (interrupt) throw new Error("FICTIONAL INTERRUPTION"); } });
  await refresh(store);
  const previous = await store.readLatest();
  interrupt = true;
  const failed = await refresh(store);
  assert.equal(failed.status, "blocked");
  assert.equal(failed.issues[0].code, "LOCAL_STORAGE_ERROR");
  assert.deepEqual(await store.readLatest(), previous);
  assert.equal((await names(root, "runs")).length, 2);
  assert.equal((await names(root, "commits")).length, 1);
  interrupt = false;
  const retried = await refresh(store);
  assert.equal(retried.status, "candidate_saved_locally");
  assert.equal(retried.receipt.sequence, 2);
  assert.equal(retried.addedTransactions, 0);
});

test("a first-run interruption never becomes accepted history", async t => {
  const { store } = await testStore(t, { onCheckpoint: async () => { throw new Error("FICTIONAL INTERRUPTION"); } });
  assert.equal((await refresh(store)).status, "blocked");
  assert.equal(await store.readLatest(), null);
});

test("encryption failure never falls back to plaintext writes", async t => {
  const protector = fixtureProtector();
  let fail = false;
  const wrapped = { ...protector, sealMany: async values => {
    if (fail) throw new Error("FICTIONAL PRIVATE FAILURE TEXT");
    return protector.sealMany(values);
  } };
  const { root, store } = await testStore(t, { protector: wrapped });
  await refresh(store);
  fail = true;
  const result = await refresh(store);
  assert.equal(result.status, "blocked");
  assert.ok(!JSON.stringify(result).includes("FICTIONAL PRIVATE FAILURE TEXT"));
  assert.equal((await names(root, "runs")).length, 1);
  assert.equal((await store.readLatest()).sequence, 1);
});

test("damaged latest snapshot blocks instead of silently selecting an older run", async t => {
  const { root, store } = await testStore(t);
  await refresh(store);
  await refresh(store);
  const file = path.join(root, "runs", (await names(root, "runs")).at(-1));
  const bytes = await fs.readFile(file);
  bytes[bytes.length - 1] ^= 1;
  await fs.writeFile(file, bytes);
  await assert.rejects(store.readLatest(), { code: "CORRUPT_LOCAL_HISTORY" });
  const result = await refresh(store);
  assert.equal(result.status, "blocked");
});

test("damaged commit blocks instead of silently selecting an older run", async t => {
  const { root, store } = await testStore(t);
  await refresh(store);
  await refresh(store);
  const file = path.join(root, "commits", (await names(root, "commits")).at(-1));
  const bytes = await fs.readFile(file);
  bytes[bytes.length - 1] ^= 1;
  await fs.writeFile(file, bytes);
  await assert.rejects(store.readLatest());
});

test("missing earlier commit is detected by sequence and hash linkage", async t => {
  const { root, store } = await testStore(t);
  await refresh(store);
  await refresh(store);
  await fs.unlink(path.join(root, "commits", (await names(root, "commits"))[0]));
  await assert.rejects(store.readLatest(), { code: "CORRUPT_LOCAL_HISTORY" });
});

test("missing latest snapshot is not treated as an empty store", async t => {
  const { root, store } = await testStore(t);
  await refresh(store);
  await fs.unlink(path.join(root, "runs", (await names(root, "runs"))[0]));
  await assert.rejects(store.readLatest(), { code: "LOCAL_STORAGE_ERROR" });
});

test("a duplicate sequence or substituted filename is rejected", async t => {
  const { root, store } = await testStore(t);
  await refresh(store);
  const existing = path.join(root, "commits", (await names(root, "commits"))[0]);
  await fs.copyFile(existing, path.join(root, "commits", `000000000001-${randomUUID()}.enc`));
  await assert.rejects(store.readLatest(), { code: "CORRUPT_LOCAL_HISTORY" });
});

test("wrong encryption context cannot open private history", async t => {
  const { root, store } = await testStore(t);
  await refresh(store);
  const reopened = await openLocalStore({ root, repositoryRoot, protector: fixtureProtector() });
  await assert.rejects(reopened.readLatest());
});

test("two refreshes cannot own the same store lock", async t => {
  const { root, store } = await testStore(t);
  let release;
  let entered;
  const held = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { entered = resolve; });
  const owner = store.withLock(async () => { entered(); await held; });
  await ready;
  try {
    const result = await refresh(store);
    assert.equal(result.status, "blocked");
    assert.equal(result.issues[0].code, "REFRESH_LOCKED");
    assert.ok(await fs.stat(path.join(root, "refresh.lock")));
  } finally {
    release();
    await owner;
  }
  assert.equal((await refresh(store)).status, "candidate_saved_locally");
});

test("a foreign or interrupted lock is preserved for explicit recovery", async t => {
  const { root, store } = await testStore(t);
  const lock = Buffer.from(JSON.stringify({ version: 1, pid: 9999999, token: "FICTIONAL-OTHER-LOCK" }));
  await fs.writeFile(path.join(root, "refresh.lock"), lock, { flag: "wx" });
  const result = await refresh(store);
  assert.equal(result.issues[0].code, "REFRESH_LOCKED");
  assert.deepEqual(await fs.readFile(path.join(root, "refresh.lock")), lock);
});

test("released transaction handles cannot write or read later", async t => {
  const { store } = await testStore(t);
  let lease;
  await store.withLock(async transaction => { lease = transaction; });
  await assert.rejects(lease.latest(), { code: "LOCK_EXPIRED" });
  await assert.rejects(lease.appendCandidate({}), { code: "LOCK_EXPIRED" });
});

test("parallel writes by one lock owner are serialized into distinct commits", async t => {
  const { store } = await testStore(t);
  await refresh(store);
  const payload = (await store.readLatest()).payload;
  const receipts = await store.withLock(transaction => Promise.all([
    transaction.appendCandidate(payload), transaction.appendCandidate(payload),
  ]));
  assert.deepEqual(receipts.map(receipt => receipt.sequence), [2, 3]);
  assert.equal((await store.readLatest()).sequence, 3);
});

test("private registry requirements cannot silently change", async t => {
  const { store } = await testStore(t);
  await refresh(store);
  const result = await refresh(store, (_, registry) => { registry.accounts[0].label = "FICTIONAL CHANGED ACCOUNT"; });
  assert.equal(result.status, "blocked");
  assert.equal(result.issues[0].code, "REGISTRY_CHANGED");
  assert.equal((await store.readLatest()).sequence, 1);
});

test("the store refuses live and workbook-ready records", async t => {
  const { store } = await testStore(t);
  await refresh(store);
  const payload = (await store.readLatest()).payload;
  payload.candidate.workbookReady = true;
  await assert.rejects(store.withLock(transaction => transaction.appendCandidate(payload)), { code: "INVALID_LOCAL_RECORD" });
});
