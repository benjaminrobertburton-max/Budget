import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { withDisposableTestRun } from "../src/disposable-run.mjs";
import { openFixtureBrowser } from "../src/fixture-browser.mjs";
import { collectWithSessions } from "../src/session-collection.mjs";
import { startFixtureSite } from "../fixtures/browser-site.mjs";
import { fixtureBrowserReader } from "../fixtures/browser-reader.mjs";
import { FIXTURE_NOW, makeCaptures } from "../fixtures/synthetic.mjs";
import { repositoryRoot, tempDirectory } from "../test/store-helpers.mjs";

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
