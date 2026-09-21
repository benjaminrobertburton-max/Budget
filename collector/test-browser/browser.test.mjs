import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fork } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { withDisposableTestRun } from "../src/disposable-run.mjs";
import { openFixtureBrowser } from "../src/fixture-browser.mjs";
import { collectWithSessions } from "../src/session-collection.mjs";
import { startFixtureSite } from "../fixtures/browser-site.mjs";
import { fixtureBrowserReader } from "../fixtures/browser-reader.mjs";
import { FIXTURE_NOW, makeCaptures } from "../fixtures/synthetic.mjs";
import { repositoryRoot, tempDirectory } from "../test/store-helpers.mjs";
import { inspectPageStructure } from "../src/page-structure.mjs";
import { recoverDisposableTest, recoveryProcessDecision } from "../src/test-recovery.mjs";
import { windowsTestProcesses } from "../src/test-processes.mjs";

async function runBrowser(t, task) {
  const parent = path.join(await tempDirectory(t), "browser-run");
  let root;
  let pids;
  let failure;
  let fixtureAssertion;
  try {
    await withDisposableTestRun({ parent, repositoryRoot }, async scope => {
      root = scope.paths.root;
      const site = await startFixtureSite();
      scope.registerClose(() => site.close());
      const browser = await openFixtureBrowser(scope, { origin: site.origin });
      pids = browser.processIds();
      try { await task({ scope, site, ...browser }); }
      catch (error) { if (error.code === "ERR_ASSERTION") fixtureAssertion = error; throw error; }
    });
  } catch (error) { failure = error; }
  assert.deepEqual(await fs.readdir(parent), [], "owned profile and source evidence must be removed");
  await assert.rejects(fs.stat(root), { code: "ENOENT" });
  for (const pid of pids ?? []) assert.throws(() => process.kill(pid, 0), { code: "ESRCH" });
  if (failure) throw fixtureAssertion ?? failure;
}

test("Chrome reads fictional DOM tables, overlap, obligations and promos; deletes its profile after exit", async t => {
  await runBrowser(t, async ({ scope, site, context }) => {
    for (const group of site.groups) site.approve(group.id);
    const reader = fixtureBrowserReader({ context, site, saveEvidence: scope.saveEvidence });
    const result = await collectWithSessions({ registry: site.registry, groups: site.groups, reader, now: () => FIXTURE_NOW });
    assert.equal(result.status, "candidate_ready");
    assert.equal(result.candidate.accountCount, 5);
    assert.equal(result.progress.length, 4);
    const expected = makeCaptures();
    for (const capture of result.candidate.captures) {
      assert.deepEqual(capture.balances.map(balance => balance.amountMinor), expected[capture.accountId].balances.map(balance => balance.amountMinor));
      assert.equal(result.candidate.nextState.accounts[capture.accountId].records.length, expected[capture.accountId].transactions.length);
    }
    assert.equal(result.candidate.captures.find(capture => capture.accountId === "demo-paypal").promos.length, 1);
    const repeated = await collectWithSessions({ registry: site.registry, groups: site.groups, reader, now: () => FIXTURE_NOW, previousState: result.candidate.nextState });
    assert.equal(repeated.status, "candidate_ready");
    assert.ok(Object.values(repeated.candidate.changes).every(change => change.added === 0));
    assert.ok((await fs.readdir(scope.paths.browserProfile)).length > 0);
    assert.equal((await fs.readdir(scope.paths.evidence)).length, 10);
  });
});

test("fictional manual approval resumes one group without waiting for other logins", async t => {
  await runBrowser(t, async ({ scope, site, context }) => {
    const controller = new AbortController();
    let firstCollected = false;
    const reader = fixtureBrowserReader({ context, site, saveEvidence: scope.saveEvidence });
    const openGroup = reader.openGroup;
    reader.openGroup = async (group, options) => {
      await openGroup(group, options);
      if (group.id === "demo-checking") {
        const page = context.pages().find(item => item.url().includes(`/group/${group.id}/sign-in`));
        await page.getByRole("button", { name: "Simulate approval" }).click();
      }
    };
    const result = await collectWithSessions({ registry: site.registry, groups: site.groups, reader, now: () => FIXTURE_NOW,
      signal: controller.signal, authTimeoutMs: 10000, onProgress: progress => {
        const checking = progress.groups.find(group => group.groupId === "demo-checking");
        if (checking.status === "collected" && !controller.signal.aborted) {
          firstCollected = progress.groups.some(group => group.status === "needs_login");
          controller.abort();
        }
      } });
    assert.equal(firstCollected, true);
    assert.equal(result.status, "cancelled");
    assert.equal(result.candidate, null);
  });
});

test("browser test cannot navigate to an external bank and task errors still clean up", async t => {
  await assert.rejects(runBrowser(t, async ({ site, context }) => {
    const page = await context.newPage();
    await page.goto(`${site.baseUrl}/start`);
    await assert.rejects(page.goto("https://example.com/"));
    throw new Error("FICTIONAL-PRIVATE-ERROR");
  }), error => error.code === "TEST_RUN_FAILED" && !error.message.includes("FICTIONAL-PRIVATE"));
});

test("a live URL is refused before any browser starts", async () => {
  await assert.rejects(openFixtureBrowser({}, { origin: "https://www.wellsfargo.com" }), { code: "FIXTURE_ORIGIN_REQUIRED" });
});

test("the local Cancel button ends login waits and cleans up the browser and profile", async t => {
  await runBrowser(t, async ({ scope, site, context }) => {
    const controller = new AbortController();
    site.onCancel(() => controller.abort());
    const dashboard = await context.newPage();
    await dashboard.goto(`${site.baseUrl}/start`);
    site.setProgress({ groups: [{ groupId: "demo-checking", status: "needs_login", collectedAccounts: 0, accountCount: 1 }] });
    await dashboard.waitForFunction(() => document.querySelector("#progress").textContent.includes("needs_login"), null, { timeout: 3000 });
    assert.match(await dashboard.locator("#progress").innerText(), /demo-checking.*needs_login.*0\/1/);
    const collection = collectWithSessions({ registry: site.registry, groups: site.groups,
      reader: fixtureBrowserReader({ context, site, saveEvidence: scope.saveEvidence }),
      signal: controller.signal, now: () => FIXTURE_NOW, authTimeoutMs: 10000 });
    await dashboard.getByRole("button", { name: "Cancel test and delete its data" }).click();
    const result = await collection;
    assert.equal(result.status, "cancelled");
    assert.equal(result.candidate, null);
  });
});

test("private structural inspection excludes credentials, page text, attributes and frame contents", async t => {
  await runBrowser(t, async ({ context }) => {
    const page = await context.newPage();
    await page.setContent(`<body><main id="FICTIONAL-ACCOUNT-123" data-balance="765.43">
      <h1>FICTIONAL-PERSON-NAME</h1><table><tr><td>FICTIONAL-MERCHANT</td><td>$765.43</td></tr></table>
      <form><label>FICTIONAL-USERNAME</label><input value="FICTIONAL-PASSWORD"><input type="password" value="FICTIONAL-CODE"></form>
      <div contenteditable="true">FICTIONAL-EDITABLE</div>
      <a href="https://example.com/?account=FICTIONAL-PRIVATE" title="FICTIONAL-LABEL">FICTIONAL-LINK</a>
      <x-fictional-account role="FICTIONAL-SECRET">FICTIONAL-SECRET</x-fictional-account>
      <iframe srcdoc="<p>FICTIONAL-FRAME</p>"></iframe><div id="shadow"></div></main></body>`);
    await page.evaluate(() => {
      document.querySelector("#shadow").attachShadow({ mode: "open" }).innerHTML = "<table><tr><td>FICTIONAL-SHADOW</td></tr></table>";
      for (const input of document.querySelectorAll("input")) Object.defineProperty(input, "value", { get() { throw new Error("Credential read prohibited"); } });
    });
    const structure = await inspectPageStructure(page);
    assert.doesNotMatch(JSON.stringify(structure), /FICTIONAL|765|https|password|account=|srcdoc/i);
    assert.equal(structure.hasFrames, true);
    assert.equal(structure.hasShadowRoots, true);
    assert.equal(structure.coverageVerified, false);
    assert.equal(structure.redactedSubtrees, 2);
    assert.ok(structure.nodes.some(item => item.tag === "table"));
    assert.ok(structure.nodes.some(item => item.tag === "other" && item.role === "other"));
    assert.ok(!structure.nodes.some(item => item.tag === "input"));
  });
});

test("large pages produce a bounded incomplete structure, never a false coverage pass", async t => {
  await runBrowser(t, async ({ context }) => {
    const page = await context.newPage();
    await page.setContent(`<main>${"<div>FICTIONAL</div>".repeat(1600)}</main>`);
    const result = await inspectPageStructure(page);
    assert.equal(result.nodes.length, 1500);
    assert.equal(result.truncated, true);
    assert.equal(result.coverageVerified, false);
  });
});

test("forced collector exit leaves a blocked run which can be recovered after real Chrome exits", { timeout: 45000 }, async t => {
  let child;
  let exited;
  // Register helper shutdown before the temporary-directory cleanup hook.
  t.after(async () => {
    if (child && child.exitCode === null) {
      if (child.connected) child.send("finish");
      await Promise.race([exited, delay(10000, null, { ref: false })]);
      if (child.exitCode === null) child.kill();
    }
  });
  const parent = path.join(await tempDirectory(t), "crashed-browser");
  const script = fileURLToPath(new URL("../fixtures/interrupted-browser.mjs", import.meta.url));
  child = fork(script, [parent], { stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true });
  exited = once(child, "exit");
  const ready = await Promise.race([
    once(child, "message").then(([message]) => message),
    exited.then(() => { throw new Error("Fictional crash helper exited before readiness"); }),
    delay(20000, null, { ref: false }).then(() => { throw new Error("Fictional crash helper timed out"); }),
  ]);
  assert.equal(ready.ready, true);
  const active = await recoverDisposableTest({ repositoryRoot, parent });
  assert.equal(active.status, "blocked");
  assert.equal(active.reason, "test_running");
  child.send("crash");
  assert.equal((await exited)[0], 17);
  const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { return error.code !== "ESRCH"; } };
  const deadline = performance.now() + 10000;
  while (ready.pids.some(alive) && performance.now() < deadline) await delay(50);
  assert.ok(!ready.pids.some(alive), "fictional Chrome processes must exit before recovery");
  assert.ok((await fs.readdir(parent)).length > 0, "forced exit must leave recoverable files");
  const marker = JSON.parse(await fs.readFile(path.join(parent, ".active-test.json"), "utf8"));
  const runName = (await fs.readdir(parent)).find(name => name.startsWith("run-"));
  const guard = JSON.parse(await fs.readFile(path.join(parent, runName, ".browser-starting.json"), "utf8"));
  const decisions = [];
  const processProbe = async ownerPid => {
    try {
      const snapshot = await windowsTestProcesses(ownerPid);
      decisions.push(recoveryProcessDecision(marker, guard, snapshot));
      return snapshot;
    } catch (error) {
      decisions.push("process_probe_failed");
      throw error;
    }
  };
  const config = { repositoryRoot, parent, processProbe,
    onDiagnostic: ({stage,code}) => decisions.push(`${stage}:${code}`) };
  // The startup PID list cannot include every later Chrome descendant. Wait for
  // the complete, read-only ownership decision, not merely the recorded PIDs.
  const recoveryDeadline = performance.now() + 10000;
  let readiness = await recoverDisposableTest(config);
  while (readiness.status === "blocked" && readiness.reason === "browser_may_be_running"
    && performance.now() < recoveryDeadline) {
    await delay(100);
    readiness = await recoverDisposableTest(config);
  }
  const result = readiness.status === "ready"
    ? await recoverDisposableTest({ ...config, confirm: true }) : readiness;
  // Fixed outcomes only; never print process metadata, paths or source evidence.
  if (result.status !== "cleaned") t.diagnostic(`Recovery probe decisions: ${decisions.join(",")}`);
  assert.equal(result.status, "cleaned", `Recovery must be verified: ${result.reason ?? result.status}`);
  assert.deepEqual(await fs.readdir(parent), []);
});
