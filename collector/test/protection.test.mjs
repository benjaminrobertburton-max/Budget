import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { windowsProtector } from "../src/protection.mjs";
import { testStore, tempDirectory, repositoryRoot } from "./store-helpers.mjs";
import { withDisposableTestRun } from "../src/disposable-run.mjs";
import { refreshToLocalStore } from "../src/private-refresh.mjs";
import { makeRegistry, makeCaptures, fixtureAdapters, FIXTURE_NOW } from "../fixtures/synthetic.mjs";

test("Windows user-bound protection round-trips fictional data and rejects tampering", { skip: process.platform !== "win32" }, async () => {
  const protector = windowsProtector();
  const values = [{ marker: "FICTIONAL-DPAPI-TEST-ONLY", value: 123 }, { marker: "FICTIONAL-SECOND-RECORD" }];
  const encrypted = await protector.sealMany(values);
  assert.equal(encrypted.length, 2);
  assert.ok(encrypted.every(bytes => !bytes.includes(Buffer.from("FICTIONAL"))));
  assert.deepEqual(await protector.openMany(encrypted), values);
  const broken = JSON.parse(encrypted[0].toString("utf8"));
  const payload = Buffer.from(broken.payload, "base64");
  payload[payload.length - 1] ^= 1;
  broken.payload = payload.toString("base64");
  await assert.rejects(protector.openMany([Buffer.from(JSON.stringify(broken))]), { code: "PROTECTION_FAILED" });
});

test("actual Windows encryption protects a disposable fictional candidate on disk", { skip: process.platform !== "win32" }, async t => {
  const { store } = await testStore(t, { protector: windowsProtector() });
  const registry = makeRegistry();
  const result = await refreshToLocalStore({ store, registry, adapters: fixtureAdapters(makeCaptures(registry)), now: FIXTURE_NOW });
  assert.equal(result.status, "candidate_saved_locally", JSON.stringify(result));
  const saved = await store.readLatest();
  assert.equal(saved.payload.candidate.accountCount, 11);
  assert.equal(saved.payload.candidate.workbookReady, false);
});

test("plaintext and unknown protection formats are never accepted", async () => {
  const protector = windowsProtector();
  await assert.rejects(protector.openMany([Buffer.from('{"marker":"FICTIONAL-PLAINTEXT"}')]), { code: "PROTECTION_FAILED" });
});

test("disposable evidence uses actual Windows encryption and is removed after the test", { skip: process.platform !== "win32" }, async t => {
  const parent = path.join(await tempDirectory(t), "dpapi-disposable");
  let filename;
  await withDisposableTestRun({ repositoryRoot, parent }, async ({ saveEvidence }) => {
    const value = { marker: "FICTIONAL-DISPOSABLE-DPAPI-ONLY" };
    filename = await saveEvidence(value);
    const ciphertext = await fs.readFile(filename);
    assert.ok(!ciphertext.includes(Buffer.from(value.marker)));
    assert.deepEqual(await windowsProtector().openMany([ciphertext]), [value]);
  });
  await assert.rejects(fs.stat(filename), { code: "ENOENT" });
  assert.deepEqual(await fs.readdir(parent), []);
});
