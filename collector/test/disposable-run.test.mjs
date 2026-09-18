import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { withDisposableTestRun, defaultTestRoot } from "../src/disposable-run.mjs";
import { fixtureProtector, repositoryRoot, tempDirectory } from "./store-helpers.mjs";

async function options(t, extra = {}) {
  return { repositoryRoot, parent: path.join(await tempDirectory(t), "disposable"), protector: fixtureProtector(), ...extra };
}

test("disposable evidence is encrypted, resources close first, and all owned files are removed", async t => {
  const config = await options(t);
  const order = [];
  let root;
  let saved;
  const result = await withDisposableTestRun(config, async ({ paths, saveEvidence, registerClose }) => {
    root = paths.root;
    saved = await saveEvidence({ merchant: "FICTIONAL-MERCHANT-ONLY", amount: 123 });
    const ciphertext = await fs.readFile(saved);
    assert.ok(!ciphertext.includes(Buffer.from("FICTIONAL-MERCHANT-ONLY")));
    assert.deepEqual(await config.protector.openMany([ciphertext]), [{ merchant: "FICTIONAL-MERCHANT-ONLY", amount: 123 }]);
    await fs.writeFile(path.join(paths.browserProfile, "fixture-cache"), "FAKE-BROWSER-CACHE");
    registerClose(async () => { await fs.stat(root); order.push("first"); });
    registerClose(async () => { await fs.stat(saved); order.push("second"); });
    return { passed: true };
  });
  assert.deepEqual(result, { passed: true });
  assert.deepEqual(order, ["second", "first"]);
  await assert.rejects(fs.stat(root), { code: "ENOENT" });
  assert.deepEqual(await fs.readdir(config.parent), []);
});

test("task failure still closes resources and deletes files without exposing private errors", async t => {
  const config = await options(t);
  let closed = false;
  await assert.rejects(withDisposableTestRun(config, async ({ saveEvidence, registerClose }) => {
    registerClose(async () => { closed = true; });
    await saveEvidence({ marker: "FICTIONAL-SECRET" });
    throw new Error("FICTIONAL-SECRET");
  }), error => error.code === "TEST_RUN_FAILED" && !error.message.includes("FICTIONAL-SECRET"));
  assert.equal(closed, true);
  assert.deepEqual(await fs.readdir(config.parent), []);
});

test("evidence writes are drained before cleanup even if a caller forgot to await one", async t => {
  const config = await options(t);
  const base = config.protector;
  config.protector = { async sealMany(values) {
    await new Promise(resolve => setTimeout(resolve, 20));
    return base.sealMany(values);
  } };
  await withDisposableTestRun(config, async ({ saveEvidence }) => { saveEvidence({ marker: "FICTIONAL" }); });
  assert.deepEqual(await fs.readdir(config.parent), []);
});

test("encryption errors fail closed and still remove the test run", async t => {
  const config = await options(t, { protector: { async sealMany() { throw new Error("FICTIONAL-PRIVATE-ERROR"); } } });
  await assert.rejects(withDisposableTestRun(config, async ({ saveEvidence }) => {
    saveEvidence({ marker: "FICTIONAL" });
  }), { code: "TEST_RUN_FAILED" });
  assert.deepEqual(await fs.readdir(config.parent), []);
});

test("late writes and resource registration cannot recreate a deleted run", async t => {
  const config = await options(t);
  let retained;
  await withDisposableTestRun(config, async scope => { retained = scope; });
  assert.throws(() => retained.saveEvidence({}), { code: "TEST_RUN_CLOSED" });
  assert.throws(() => retained.registerClose(async () => {}), { code: "TEST_RUN_CLOSED" });
  assert.deepEqual(await fs.readdir(config.parent), []);
});

test("one disposable test cannot overlap another in the same parent", async t => {
  const config = await options(t);
  await withDisposableTestRun(config, async () => {
    await assert.rejects(withDisposableTestRun(config, async () => assert.fail("must not run")), { code: "TEST_CLEANUP_REQUIRED" });
  });
  assert.deepEqual(await fs.readdir(config.parent), []);
});

test("crash leftovers block a new test without silently deleting them", async t => {
  const config = await options(t);
  await fs.mkdir(config.parent);
  const orphan = path.join(config.parent, "run-orphan-fixture");
  await fs.mkdir(orphan);
  await fs.writeFile(path.join(orphan, "fixture.enc"), "FICTIONAL");
  await assert.rejects(withDisposableTestRun(config, async () => assert.fail("must not run")), { code: "TEST_CLEANUP_REQUIRED" });
  assert.equal(await fs.readFile(path.join(orphan, "fixture.enc"), "utf8"), "FICTIONAL");
});

test("failed resource shutdown preserves the owned run and blocks subsequent testing", async t => {
  const config = await options(t);
  let root;
  await assert.rejects(withDisposableTestRun(config, async ({ paths, registerClose }) => {
    root = paths.root;
    registerClose(async () => { throw new Error("FICTIONAL-BROWSER-STILL-RUNNING"); });
  }), { code: "TEST_CLEANUP_REQUIRED" });
  await fs.stat(root);
  await assert.rejects(withDisposableTestRun(config, async () => assert.fail("must not run")), { code: "TEST_CLEANUP_REQUIRED" });
});

test("resource shutdown is bounded, does not hang, and never claims deletion", async t => {
  const config = await options(t, { closeTimeoutMs: 10 });
  await assert.rejects(withDisposableTestRun(config, async ({ registerClose }) => {
    registerClose(() => new Promise(() => {}));
  }), { code: "TEST_CLEANUP_REQUIRED" });
});

test("changed owner markers prevent deletion", async t => {
  const config = await options(t);
  let root;
  await assert.rejects(withDisposableTestRun(config, async ({ paths }) => {
    root = paths.root;
    await fs.writeFile(path.join(root, ".owner.json"), "different-owner");
  }), { code: "TEST_CLEANUP_REQUIRED" });
  await fs.stat(root);
});

test("cleanup never follows a junction or touches an unrelated personal-profile stand-in", async t => {
  const config = await options(t);
  const unrelated = await tempDirectory(t);
  const sentinel = path.join(unrelated, "personal-profile-sentinel");
  await fs.writeFile(sentinel, "FICTIONAL-KEEP");
  let link;
  try {
    await assert.rejects(withDisposableTestRun(config, async ({ paths }) => {
      link = path.join(paths.root, "unexpected-link");
      await fs.symlink(unrelated, link, process.platform === "win32" ? "junction" : "dir");
    }), { code: "TEST_CLEANUP_REQUIRED" });
    assert.equal(await fs.readFile(sentinel, "utf8"), "FICTIONAL-KEEP");
  } finally {
    if (link) await fs.unlink(link);
  }
});

test("repository and cloud locations are rejected before a test is started", async t => {
  const config = await options(t);
  await assert.rejects(withDisposableTestRun({ ...config, parent: path.join(repositoryRoot, "collector-data") }, async () => {}), { code: "UNSAFE_STORAGE_PATH" });
  await assert.rejects(withDisposableTestRun({ ...config, cloudRoots: [config.parent] }, async () => {}), { code: "UNSAFE_STORAGE_PATH" });
});

test("the default disposable location is separate from the persistent home store", { skip: process.platform !== "win32" }, () => {
  assert.equal(defaultTestRoot(), path.join(process.env.LOCALAPPDATA, "BudgetCollectorTesting"));
  assert.notEqual(defaultTestRoot(), path.join(process.env.LOCALAPPDATA, "BudgetCollector"));
});
