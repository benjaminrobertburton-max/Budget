import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { withDisposableTestRun } from "../src/disposable-run.mjs";
import { recoverDisposableTest, recoveryProcessDecision, recoveryMessage } from "../src/test-recovery.mjs";
import { validateProcessSnapshot, windowsTestProcesses } from "../src/test-processes.mjs";
import { fixtureProtector, repositoryRoot, tempDirectory } from "./store-helpers.mjs";

const bootId = "2031-04-01T00:00:00.000Z";
const startedAfter = "2031-04-08T10:00:00.000Z";
const observedAt = "2031-04-08T11:00:00.000Z";
const snapshot = (processes = [], extra = {}) => ({ version: 1, bootId, observedAt, processes, ...extra });
const row = (pid, kind = "chrome", createdAt = startedAfter, parentPid = 0) => ({ pid, parentPid, kind, createdAt });
const guard = (baselineChrome = []) => ({ bootId, startedAfter, baselineChrome });

async function orphan(t, { armed = false } = {}) {
  const parent = path.join(await tempDirectory(t), "disposable");
  let root;
  const processProbe = async () => snapshot([row(process.pid, "owner", bootId)], { observedAt: startedAfter });
  await assert.rejects(withDisposableTestRun({ repositoryRoot, parent, protector: fixtureProtector(), processProbe }, async scope => {
    root = scope.paths.root;
    if (armed) {
      await scope.armBrowserRecovery();
      await fs.writeFile(path.join(scope.paths.browserProfile, "fictional-cache"), "FICTIONAL-BROWSER-CACHE");
    }
    await scope.saveEvidence({ privateMarker: "FICTIONAL-SECRET-ONLY" });
    scope.registerClose(() => { throw new Error("FICTIONAL interrupted shutdown"); });
  }), { code: "TEST_CLEANUP_REQUIRED" });
  return { parent, root, repositoryRoot, processProbe: async () => snapshot() };
}

test("recovery inspection is read-only; confirmed cleanup removes only a stopped owned test", async t => {
  const config = await orphan(t, { armed: true });
  const files = await fs.readdir(config.root);
  assert.deepEqual(await recoverDisposableTest(config), { status: "ready", removed: false });
  assert.deepEqual(await fs.readdir(config.root), files);
  assert.deepEqual(await recoverDisposableTest({ ...config, confirm: true }), { status: "cleaned", removed: true });
  assert.deepEqual(await fs.readdir(config.parent), []);
});

test("storage-only crash can be recovered without a browser or a reboot", async t => {
  const config = await orphan(t);
  assert.equal((await recoverDisposableTest({ ...config, confirm: true })).status, "cleaned");
});

test("active Chrome is checked before traversing its still-changing tree", async t => {
  const config = await orphan(t, {armed:true});
  // A dangling link would fail the tree check. While Chrome is active, recovery
  // must first report the process blocker; after exit the unsafe link still blocks.
  await fs.symlink(path.join(config.root,"missing-target"),path.join(config.root,"moving-cache"),"junction");
  const diagnostics = [];
  const active = await recoverDisposableTest({...config,
    processProbe:async()=>snapshot([row(999999)]),onDiagnostic:value=>diagnostics.push(value)});
  assert.equal(active.reason,"browser_may_be_running");
  assert.deepEqual(diagnostics,[]);
  const stopped = await recoverDisposableTest({...config,confirm:true,
    onDiagnostic:value=>diagnostics.push(value)});
  assert.equal(stopped.status,"blocked");
  assert.equal(diagnostics[0].stage,"tree");
  assert.doesNotMatch(JSON.stringify(diagnostics),/moving-cache|missing-target|FICTIONAL/);
  await fs.unlink(path.join(config.root,"moving-cache"));
});

test("no leftover test means no process lookup or directory creation", async t => {
  const parent = path.join(await tempDirectory(t), "not-created");
  const result = await recoverDisposableTest({ repositoryRoot, parent, confirm: true, processProbe: () => assert.fail("No lookup needed") });
  assert.equal(result.status, "clean");
  await assert.rejects(fs.stat(parent), { code: "ENOENT" });
});

for (const [label, processes, reason] of [
  ["live owner", [row(process.pid, "owner", bootId)], "test_running"],
  ["reused owner PID", [row(process.pid, "chrome", observedAt)], "test_running"],
  ["orphan browser", [row(999999)], "browser_may_be_running"],
  ["unknown newer personal Chrome", [row(999999, "chrome", observedAt)], "browser_may_be_running"],
]) {
  test(`${label} blocks cleanup without killing processes`, async t => {
    const config = await orphan(t, { armed: true });
    const result = await recoverDisposableTest({ ...config, confirm: true, processProbe: async () => snapshot(processes) });
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, reason);
    await fs.stat(config.root);
    assert.match(recoveryMessage(result), /running|Chrome/);
  });
}

test("pre-existing personal Chrome is not confused with a new test browser", () => {
  assert.equal(recoveryProcessDecision({ pid: 100 }, guard(), snapshot([row(200, "chrome", bootId)])), "ready");
});

test("new personal Chrome tabs are excluded only through a proven pre-existing process lineage", () => {
  const personal = row(200, "chrome", bootId);
  const tab = row(201, "chrome", startedAfter, 200);
  const worker = row(202, "chrome", observedAt, 201);
  assert.equal(recoveryProcessDecision({ pid: 100 }, guard([personal]), snapshot([personal, tab, worker])), "ready");
  // PID reuse, missing ancestors and cycles must not invent an ownership proof.
  assert.equal(recoveryProcessDecision({ pid: 100 }, guard([personal]), snapshot([{ ...personal, createdAt: observedAt }, tab])), "browser_may_be_running");
  assert.equal(recoveryProcessDecision({ pid: 100 }, guard([personal]), snapshot([tab, worker])), "browser_may_be_running");
  assert.equal(recoveryProcessDecision({ pid: 100 }, guard([personal]), snapshot([row(201, "chrome", startedAfter, 202), row(202, "chrome", startedAfter, 201)])), "browser_may_be_running");
});

test("a verified later boot permits recovery but a running reused owner PID still blocks", () => {
  const later = snapshot([], { bootId: "2031-04-08T10:30:00.000Z" });
  assert.equal(recoveryProcessDecision({ pid: 100 }, guard(), later), "ready");
  later.processes = [row(100, "owner", observedAt)];
  assert.equal(recoveryProcessDecision({ pid: 100 }, guard(), later), "test_running");
});

test("clock rollback or an inconsistent boot never establishes process exit", () => {
  assert.equal(recoveryProcessDecision({ pid: 100 }, guard(), snapshot([], { observedAt: bootId })), "process_state_unknown");
  assert.equal(recoveryProcessDecision({ pid: 100 }, guard(), snapshot([], { bootId: "2031-04-02T00:00:00.000Z" })), "process_state_unknown");
});

for (const [label, tamper] of [
  ["changed owner", async c => fs.writeFile(path.join(c.root, ".owner.json"), "FICTIONAL-PRIVATE-SECRET")],
  ["legacy marker", async c => { const file = path.join(c.parent, ".active-test.json"); const value = JSON.parse(await fs.readFile(file)); value.version = 1; await fs.writeFile(file, JSON.stringify(value)); }],
  ["unknown parent files", async c => fs.writeFile(path.join(c.parent, "keep.txt"), "FICTIONAL-KEEP")],
  ["torn startup record", async c => fs.writeFile(path.join(c.root, ".browser-starting.json"), "{FICTIONAL-SECRET")],
  ["unknown startup owner", async c => fs.writeFile(path.join(c.root, ".browser-starting.json"), JSON.stringify({ version: 2, owner: randomUUID(), ...guard() }))],
  ["missing startup record with a used profile", async c => fs.unlink(path.join(c.root, ".browser-starting.json"))],
  ["prior recovery lock", async c => fs.writeFile(path.join(c.parent, ".recovery.lock"), "FICTIONAL-OTHER-RECOVERY")],
]) {
  test(`${label} is preserved for review without leaking private details`, async t => {
    const config = await orphan(t, { armed: true });
    await tamper(config);
    const result = await recoverDisposableTest({ ...config, confirm: true });
    assert.equal(result.status, "blocked");
    assert.doesNotMatch(JSON.stringify(result) + recoveryMessage(result), /FICTIONAL|SECRET/);
    await fs.stat(config.root);
  });
}

test("recovery rejects junctions and preserves an unrelated profile", async t => {
  const config = await orphan(t);
  const personal = await tempDirectory(t);
  await fs.writeFile(path.join(personal, "keep"), "FICTIONAL-KEEP");
  const link = path.join(config.root, "link");
  await fs.symlink(personal, link, process.platform === "win32" ? "junction" : "dir");
  try {
    assert.equal((await recoverDisposableTest({ ...config, confirm: true })).status, "blocked");
    assert.equal(await fs.readFile(path.join(personal, "keep"), "utf8"), "FICTIONAL-KEEP");
  } finally { await fs.unlink(link); }
});

test("recovery rechecks processes immediately before deletion", async t => {
  const config = await orphan(t, { armed: true });
  let calls = 0;
  const result = await recoverDisposableTest({ ...config, confirm: true, processProbe: async () => snapshot(++calls === 1 ? [] : [row(process.pid, "owner")]) });
  assert.equal(calls, 2);
  assert.equal(result.status, "blocked");
  await fs.stat(config.root);
  await assert.rejects(fs.stat(path.join(config.parent, ".recovery.lock")), { code: "ENOENT" });
});

test("a startup journal changed during recovery is not accepted as fresh ownership proof", async t => {
  const config = await orphan(t, { armed: true });
  let calls = 0;
  const result = await recoverDisposableTest({ ...config, confirm: true, processProbe: async () => {
    if (++calls === 1) {
      const file = path.join(config.root, ".browser-starting.json");
      const changed = JSON.parse(await fs.readFile(file));
      changed.startedAfter = "2031-04-08T10:01:00.000Z";
      await fs.writeFile(file, JSON.stringify(changed));
    }
    return snapshot();
  } });
  assert.equal(result.status, "blocked");
  await fs.stat(config.root);
});

test("an unawaited startup journal write cannot recreate a cleaned run", async t => {
  const parent = path.join(await tempDirectory(t), "late-guard");
  await withDisposableTestRun({ repositoryRoot, parent, protector: fixtureProtector(), processProbe: async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
    return snapshot([row(process.pid, "owner")]);
  } }, async scope => { scope.armBrowserRecovery(); });
  assert.deepEqual(await fs.readdir(parent), []);
});

test("process probe failures and unknown extra process data fail closed", async t => {
  const config = await orphan(t);
  for (const processProbe of [async () => { throw new Error("FICTIONAL-PRIVATE-ERROR"); }, async () => ({ ...snapshot(), commandLine: "FICTIONAL-SECRET" })]) {
    const result = await recoverDisposableTest({ ...config, confirm: true, processProbe });
    assert.equal(result.status, "blocked");
    assert.doesNotMatch(JSON.stringify(result), /FICTIONAL/);
    await fs.stat(config.root);
  }
});

test("a leftover ownership lock with no run can be removed only after owner exit", async t => {
  const parent = path.join(await tempDirectory(t), "lock-only");
  await fs.mkdir(parent);
  await fs.writeFile(path.join(parent, ".active-test.json"), JSON.stringify({ version: 2, purpose: "disposable-collector-test", id: randomUUID(), pid: 100 }));
  const result = await recoverDisposableTest({ repositoryRoot, parent, confirm: true, processProbe: async () => snapshot() });
  assert.equal(result.status, "cleaned");
  assert.deepEqual(await fs.readdir(parent), []);
});

test("process snapshot validator rejects ambiguous, duplicate, or private metadata", () => {
  for (const invalid of [snapshot([row(100), row(100)]), snapshot([{ ...row(100), commandLine: "private" }]), snapshot([row(-1)]), snapshot([row(100, "owner")]), snapshot([], { bootId: "yesterday" })]) {
    assert.throws(() => validateProcessSnapshot(invalid, 200), { code: "PROCESS_CHECK_FAILED" });
  }
});

test("browser startup journal is flushed once and pending writes are drained", async t => {
  const parent = path.join(await tempDirectory(t), "guard");
  let retained;
  await withDisposableTestRun({ repositoryRoot, parent, protector: fixtureProtector(), processProbe: async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
    return snapshot([row(process.pid, "owner")]);
  } }, async scope => {
    retained = scope;
    const armed = scope.armBrowserRecovery();
    assert.throws(() => scope.armBrowserRecovery(), { code: "BROWSER_GUARD_REQUIRED" });
    const guard = await armed;
    assert.equal(JSON.parse(await fs.readFile(path.join(scope.paths.root, ".browser-starting.json"))).bootId, guard.bootId);
  });
  assert.throws(() => retained.armBrowserRecovery(), { code: "BROWSER_GUARD_REQUIRED" });
  assert.deepEqual(await fs.readdir(parent), []);
});

test("Windows process helper returns only bounded non-sensitive metadata", { skip: process.platform !== "win32" }, async () => {
  const result = await windowsTestProcesses(process.pid);
  assert.equal(result.version, 1);
  assert.ok(result.processes.some(item => item.pid === process.pid));
  assert.doesNotMatch(JSON.stringify(result), /CommandLine|ExecutablePath|Users|http|username/i);
});
