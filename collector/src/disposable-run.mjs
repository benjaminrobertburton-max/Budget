import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { CollectionError, requireEvidence as check } from "./errors.mjs";
import { assertPrivateDirectory, assertRegularFile } from "./private-paths.mjs";
import { windowsProtector } from "./protection.mjs";
import { windowsTestProcesses, validateProcessSnapshot } from "./test-processes.mjs";

// This lifecycle is for work-machine tests, NEVER the persistent home store.
export function defaultTestRoot() {
  check(process.platform === "win32" && process.env.LOCALAPPDATA,
    "PRIVATE_PATH_REQUIRED", "Disposable testing requires a private local directory.");
  return path.join(process.env.LOCALAPPDATA, "BudgetCollectorTesting");
}

function failure(code, message) {
  return new CollectionError(code, message);
}

export async function noLinksInTestTree(directory) {
  for (const entry of await fs.readdir(directory)) {
    const filename = path.join(directory, entry);
    const info = await fs.lstat(filename);
    check(!info.isSymbolicLink() && (info.isDirectory() || info.isFile()),
      "UNSAFE_CLEANUP", "A test directory contains an unexpected link or file type.");
    if (info.isDirectory()) await noLinksInTestTree(filename);
  }
}

async function closeWithin(close, timeoutMs) {
  let timer;
  try {
    await Promise.race([
      Promise.resolve().then(close),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(failure("TEST_CLOSE_FAILED", "A test resource did not close.")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Close registered resources, delete this exact owned run, and verify removal.
 * A crash/failed cleanup blocks the next run; it is NOT reported as deletion.
 * Browser integration must register a close function that waits for process exit.
 * No browser is launched here and no personal profile may be passed to this API.
 */
export async function withDisposableTestRun({
  repositoryRoot, parent = defaultTestRoot(), cloudRoots = [],
  protector = windowsProtector(), closeTimeoutMs = 30000,
  processProbe = windowsTestProcesses,
}, task) {
  check(typeof task === "function" && Number.isInteger(closeTimeoutMs)
    && closeTimeoutMs > 0 && closeTimeoutMs <= 30000,
  "INVALID_TEST_RUN", "A test needs a task and a bounded resource-close timeout.");
  const boundaries = { repositoryRoot, cloudRoots };
  const safeParent = await assertPrivateDirectory(parent, boundaries);
  await fs.mkdir(safeParent, { recursive: true, mode: 0o700 });
  await assertPrivateDirectory(safeParent, boundaries);
  const resolvedParent = await fs.realpath(safeParent);
  const marker = JSON.stringify({ version: 2, purpose: "disposable-collector-test", id: randomUUID(), pid: process.pid });
  const lock = path.join(safeParent, ".active-test.json");
  let handle;
  try {
    handle = await fs.open(lock, "wx", 0o600);
  } catch {
    throw failure("TEST_CLEANUP_REQUIRED", "Another test or an unfinished cleanup exists. No new test was started.");
  }
  try {
    await handle.writeFile(marker, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  let root;
  let identity;
  let result;
  let taskFailed = false;
  let accepting = true;
  let writeFailed = false;
  let removed = false;
  const writes = [];
  const closers = [];
  try {
    check((await fs.readdir(safeParent)).every(name => name === ".active-test.json"),
      "TEST_CLEANUP_REQUIRED", "An earlier test left files behind. Cleanup must be verified before another test.");
    root = path.join(safeParent, `run-${randomUUID()}`);
    await fs.mkdir(root, { mode: 0o700 });
    identity = await fs.lstat(root);
    await fs.writeFile(path.join(root, ".owner.json"), marker, { flag: "wx", mode: 0o600 });
    const paths = Object.freeze({
      root, store: path.join(root, "store"), evidence: path.join(root, "evidence"),
      browserProfile: path.join(root, "browser-profile"),
    });
    for (const directory of [paths.store, paths.evidence, paths.browserProfile]) {
      await fs.mkdir(directory, { mode: 0o700 });
    }
    // Immutable journal: an incomplete .browser-starting.json always blocks recovery.
    // The arm record is flushed before any browser process may be launched.
    const initialGuard = await fs.open(path.join(root, ".browser-unused.json"), "wx", 0o600);
    try { await initialGuard.writeFile(marker, "utf8"); await initialGuard.sync(); }
    finally { await initialGuard.close(); }
    let browserArmed = false;
    result = await task(Object.freeze({
      paths,
      armBrowserRecovery() {
        check(accepting && !browserArmed, "BROWSER_GUARD_REQUIRED", "Only one owned browser may start in a disposable test.");
        browserArmed = true;
        const pending = (async () => {
          const snapshot = validateProcessSnapshot(await processProbe(process.pid), process.pid);
          check(snapshot.processes.some(row => row.pid === process.pid), "PROCESS_CHECK_FAILED", "The test owner could not be verified.");
          const guard = { version: 2, owner: JSON.parse(marker).id, bootId: snapshot.bootId,
            startedAfter: snapshot.observedAt, baselineChrome: snapshot.processes.filter(row => row.kind === "chrome") };
          const guardFile = await fs.open(path.join(root, ".browser-starting.json"), "wx", 0o600);
          try { await guardFile.writeFile(JSON.stringify(guard), "utf8"); await guardFile.sync(); }
          finally { await guardFile.close(); }
          return Object.freeze(guard);
        })();
        writes.push(pending);
        pending.catch(() => { writeFailed = true; });
        return pending;
      },
      registerClose(close) {
        check(accepting && typeof close === "function", "TEST_RUN_CLOSED", "This test no longer accepts resources.");
        closers.push(close);
      },
      saveEvidence(value) {
        check(accepting, "TEST_RUN_CLOSED", "This test no longer accepts evidence.");
        const pending = (async () => {
          const [ciphertext] = await protector.sealMany([value]);
          check(Buffer.isBuffer(ciphertext), "PROTECTION_FAILED", "Test evidence could not be protected.");
          await assertPrivateDirectory(paths.evidence, boundaries);
          const filename = path.join(paths.evidence, `${randomUUID()}.enc`);
          await fs.writeFile(filename, ciphertext, { flag: "wx", mode: 0o600 });
          return filename;
        })();
        writes.push(pending);
        pending.catch(() => { writeFailed = true; });
        return pending;
      },
    }));
  } catch {
    // Never forward a bank/parser error containing private page text.
    taskFailed = true;
  } finally {
    accepting = false;
    await Promise.allSettled(writes);
    let closeFailed = false;
    for (const close of closers.reverse()) {
      try { await closeWithin(close, closeTimeoutMs); }
      catch { closeFailed = true; }
    }
    try {
      check(!closeFailed, "TEST_CLOSE_FAILED", "A test resource may still be running.");
      await assertPrivateDirectory(safeParent, boundaries);
      await assertRegularFile(lock, 1024);
      check(await fs.readFile(lock, "utf8") === marker, "UNSAFE_CLEANUP", "Test ownership changed.");
      if (root) {
        await assertPrivateDirectory(root, boundaries);
        const resolved = await fs.realpath(root);
        const current = await fs.lstat(root);
        check(path.dirname(resolved) === resolvedParent && path.basename(resolved) === path.basename(root)
          && current.dev === identity?.dev && current.ino === identity?.ino,
        "UNSAFE_CLEANUP", "The test directory changed unexpectedly.");
        await assertRegularFile(path.join(root, ".owner.json"), 1024);
        check(await fs.readFile(path.join(root, ".owner.json"), "utf8") === marker,
          "UNSAFE_CLEANUP", "Test ownership changed.");
        await noLinksInTestTree(resolved);
        // Exact ownership and absolute boundaries are checked above. Never delete the parent.
        await fs.rm(resolved, { recursive: true, force: false });
        try {
          await fs.lstat(root);
          throw failure("TEST_CLEANUP_REQUIRED", "Test files remain.");
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      await fs.unlink(lock);
      removed = (await fs.readdir(safeParent)).length === 0;
    } catch {
      removed = false;
    }
  }
  check(removed, "TEST_CLEANUP_REQUIRED",
    "Test cleanup could not be verified. Local test files may remain; resolve this before another test.");
  check(!taskFailed && !writeFailed, "TEST_RUN_FAILED", "The test failed. Its disposable files were removed; private error details were not logged.");
  return result;
}
