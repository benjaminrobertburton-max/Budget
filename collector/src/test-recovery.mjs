import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { defaultTestRoot, noLinksInTestTree } from "./disposable-run.mjs";
import { assertPrivateDirectory, assertRegularFile } from "./private-paths.mjs";
import { windowsTestProcesses, validateProcessSnapshot, validateBrowserGuard } from "./test-processes.mjs";
import { requireEvidence as check } from "./errors.mjs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const blocked = reason => ({ status: "blocked", reason, removed: false });

async function smallFile(filename, maxBytes = 2048) {
  await assertRegularFile(filename, maxBytes);
  return fs.readFile(filename, "utf8");
}

// Unknown or reused PIDs block. This implementation never terminates a process.
// A post-start Chrome process might be an orphan even if its parent disappeared;
// conservatively block rather than trust an incomplete saved PID list.
export function recoveryProcessDecision(marker, guard, snapshot) {
  validateProcessSnapshot(snapshot, marker.pid);
  if (snapshot.processes.some(row => row.pid === marker.pid)) return "test_running";
  if (!guard) return "ready";
  const boot = Date.parse(snapshot.bootId);
  const previousBoot = Date.parse(guard.bootId);
  const started = Date.parse(guard.startedAfter);
  if (boot > started && boot > previousBoot) return "ready"; // Restart proves old processes exited.
  if (snapshot.bootId !== guard.bootId || Date.parse(snapshot.observedAt) < started) return "process_state_unknown";
  const baseline = new Set(guard.baselineChrome.map(row => `${row.pid}:${row.createdAt}`));
  const chrome = new Map(snapshot.processes.filter(row => row.kind === "chrome").map(row => [row.pid, row]));
  const descendsFromPreexisting = row => {
    const seen = new Set();
    while (row && !seen.has(row.pid)) {
      if (baseline.has(`${row.pid}:${row.createdAt}`)) return true;
      seen.add(row.pid);
      const parent = chrome.get(row.parentPid);
      // A reused parent PID cannot be treated as the child's earlier parent.
      if (!parent || Date.parse(parent.createdAt) > Date.parse(row.createdAt)) return false;
      row = parent;
    }
    return false;
  };
  if ([...chrome.values()].some(row => Date.parse(row.createdAt) >= started && !descendsFromPreexisting(row))) return "browser_may_be_running";
  return "ready";
}

async function inspect(config, recoveryToken) {
  const boundaries = { repositoryRoot: config.repositoryRoot, cloudRoots: config.cloudRoots ?? [] };
  const parent = await assertPrivateDirectory(config.parent, boundaries);
  let names;
  try { names = await fs.readdir(parent); }
  catch (error) { if (error.code === "ENOENT") return { result: { status: "clean", removed: false } }; throw error; }
  if (names.length === 0) return { result: { status: "clean", removed: false } };
  const lock = path.join(parent, ".active-test.json");
  if (recoveryToken) {
    check(await smallFile(path.join(parent, ".recovery.lock")) === recoveryToken,
      "RECOVERY_OWNERSHIP_UNKNOWN", "Recovery ownership changed.");
    names = names.filter(name => name !== ".recovery.lock");
  }
  if (names.includes(".recovery.lock")) return { result: blocked("recovery_in_progress") };
  const roots = names.filter(name => name.startsWith("run-") && uuid.test(name.slice(4)));
  check(names.includes(".active-test.json") && roots.length <= 1
    && names.length === roots.length + 1,
  "RECOVERY_OWNERSHIP_UNKNOWN", "Unexpected test files prevent safe recovery.");
  const markerText = await smallFile(lock);
  const marker = JSON.parse(markerText);
  check(exactKeys(marker, ["version", "purpose", "id", "pid"]) && marker.version === 2
    && marker.purpose === "disposable-collector-test" && uuid.test(marker.id)
    && Number.isSafeInteger(marker.pid) && marker.pid > 0 && marker.pid <= 2147483647,
  "RECOVERY_OWNERSHIP_UNKNOWN", "This test has no supported recovery ownership record.");
  let root;
  let identity;
  let guard;
  let guardText;
  const parentIdentity = await fs.lstat(parent);
  const resolvedParent = await fs.realpath(parent);
  if (roots.length) {
    root = path.join(parent, roots[0]);
    await assertPrivateDirectory(root, boundaries);
    identity = await fs.lstat(root);
    const resolved = await fs.realpath(root);
    check(path.dirname(resolved) === resolvedParent && path.basename(resolved) === roots[0]
      && await smallFile(path.join(root, ".owner.json")) === markerText
      && await smallFile(path.join(root, ".browser-unused.json")) === markerText,
    "RECOVERY_OWNERSHIP_UNKNOWN", "Test ownership could not be established.");
    await noLinksInTestTree(root);
    try {
      guardText = await smallFile(path.join(root, ".browser-starting.json"), 2 * 1024 * 1024);
      guard = validateBrowserGuard(JSON.parse(guardText), marker.id, marker.pid);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      check((await fs.readdir(path.join(root, "browser-profile"))).length === 0,
        "RECOVERY_OWNERSHIP_UNKNOWN", "An unregistered browser profile prevents recovery.");
    }
  }
  const snapshot = await config.processProbe(marker.pid);
  const decision = recoveryProcessDecision(marker, guard, snapshot);
  return { parent, parentIdentity, resolvedParent, root, identity, lock, markerText, guardText,
    result: decision === "ready" ? { status: "ready", removed: false } : blocked(decision) };
}

function sameDirectory(before, after) {
  return before?.dev === after?.dev && before?.ino === after?.ino;
}

/** Default is inspection only. Explicit cleanup affects only an owned disposable run. */
export async function recoverDisposableTest({ repositoryRoot, parent = defaultTestRoot(), cloudRoots = [],
  processProbe = windowsTestProcesses, confirm = false } = {}) {
  let recoveryFile;
  let recoveryToken;
  let ownsRecoveryLock = false;
  let result;
  try {
    check(typeof confirm === "boolean", "RECOVERY_OWNERSHIP_UNKNOWN", "Recovery requires an explicit mode.");
    const config = { repositoryRoot, parent, cloudRoots, processProbe };
    const initial = await inspect(config);
    if (!confirm || initial.result.status !== "ready") return initial.result;
    recoveryFile = path.join(initial.parent, ".recovery.lock");
    recoveryToken = JSON.stringify({ version: 1, id: randomUUID(), pid: process.pid });
    let handle;
    try { handle = await fs.open(recoveryFile, "wx", 0o600); }
    catch { return blocked("recovery_in_progress"); }
    ownsRecoveryLock = true;
    try { await handle.writeFile(recoveryToken); await handle.sync(); }
    finally { await handle.close(); }
    const current = await inspect(config, recoveryToken); // Fresh process + path evidence under the lock.
    check(current.result.status === "ready" && initial.markerText === current.markerText
      && initial.guardText === current.guardText
      && initial.root === current.root && initial.resolvedParent === current.resolvedParent
      && sameDirectory(initial.parentIdentity, current.parentIdentity)
      && sameDirectory(initial.identity, current.identity),
    "RECOVERY_OWNERSHIP_UNKNOWN", "Test state changed during recovery.");
    if (current.root) {
      // Absolute, direct-child path, exact markers, identity and no junctions checked twice above.
      await fs.rm(current.root, { recursive: true, force: false });
      try { await fs.lstat(current.root); throw new Error("Not removed"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    check(await smallFile(current.lock) === current.markerText, "RECOVERY_OWNERSHIP_UNKNOWN", "Test ownership changed.");
    await fs.unlink(current.lock);
    result = { status: "cleaned", removed: true };
  } catch {
    // A malformed marker or process error must never leak its bytes or a local path.
    result = blocked("ownership_or_process_check_failed");
  } finally {
    if (ownsRecoveryLock) {
      try {
        if (await smallFile(recoveryFile) === recoveryToken) await fs.unlink(recoveryFile);
        else result = blocked("recovery_lock_changed");
      } catch { result = blocked("recovery_lock_changed"); }
    }
  }
  if (result?.status === "cleaned") {
    try { if ((await fs.readdir(parent)).length !== 0) return blocked("unexpected_files_remain"); }
    catch { return blocked("ownership_or_process_check_failed"); }
  }
  return result;
}

export function recoveryMessage(result) {
  if (result.status === "clean") return "No disposable test files remain.";
  if (result.status === "cleaned") return "The stopped test's owned files were removed and deletion verified. No processes were terminated.";
  if (result.status === "ready") return "The stopped test can be cleaned up. Run recover-test --confirm-cleanup to remove only its disposable files.";
  if (result.reason === "test_running") return "The test owner is still running (or its process ID is reused). Stop the collector normally, then check again. No files were removed.";
  if (result.reason === "browser_may_be_running") return "A possible test Chrome process still exists. Close only the collector's test window, then check again. If ownership remains uncertain, restart Windows before retrying. No personal Chrome process will be stopped automatically.";
  return "Cleanup could not be proven safe. Keep live testing blocked; review the owned test state without deleting unrelated files. Private diagnostics were not printed.";
}
