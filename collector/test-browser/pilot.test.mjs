import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { withDisposableTestRun } from "../src/disposable-run.mjs";
import { startPilotInScope } from "../src/pilot-session.mjs";
import { openOwnedTestBrowser } from "../src/owned-browser.mjs";
import { installPilotNetworkPolicy } from "../src/pilot-policy.mjs";
import { repositoryRoot, tempDirectory } from "../test/store-helpers.mjs";

async function fictionalPilot(t, task, options = {}) {
  const parent = path.join(await tempDirectory(t), "pilot");
  let assertion;
  let root;
  try {
    await withDisposableTestRun({ parent, repositoryRoot }, async scope => {
      root = scope.paths.root;
      const run = await startPilotInScope(scope, { mode: "fictional", headless: true, ...options });
      try { await task(run, scope); }
      catch (error) { if (error.code === "ERR_ASSERTION") assertion = error; throw error; }
      finally { run.stop(); }
      await run.done;
    });
  } catch (error) { throw assertion ?? error; }
  assert.deepEqual(await fs.readdir(parent), []);
  await assert.rejects(fs.stat(root), { code: "ENOENT" });
}

test("pilot controls open only after acknowledgement, inspect only structure, then clean up", async t => {
  await fictionalPilot(t, async (run, scope) => {
    assert.equal(run.context.pages().length, 1);
    assert.equal(await run.controlPage.locator("#start").isDisabled(), true);
    await run.controlPage.locator("#ack").check();
    await run.controlPage.locator("#start").click();
    await run.controlPage.waitForFunction(() => document.querySelector("#status-badge").textContent === "Your turn");
    assert.equal(run.context.pages().length, 2);
    await run.controlPage.locator("#inspect").click();
    await run.controlPage.waitForFunction(() => document.querySelector("#outline-count").textContent === "1 / 12");
    assert.match(await run.controlPage.locator("#outline-note").innerText(), /Not verified account evidence/);
    const state = run.pilot.state();
    assert.equal(state.coverageVerified, false);
    assert.equal(state.lastOutline.tables, 1);
    assert.doesNotMatch(JSON.stringify(state), /FICTIONAL SHOP|234\.56|7\.43|SECRET/);
    const records = await fs.readdir(scope.paths.evidence);
    assert.equal(records.length, 2); // Non-financial encryption preflight + outline.
    for (const filename of records) {
      const bytes = await fs.readFile(path.join(scope.paths.evidence, filename));
      assert.ok(!bytes.includes(Buffer.from("structure_only")));
      assert.ok(!bytes.includes(Buffer.from("FICTIONAL")));
    }
    await run.controlPage.locator("#stop-top").click();
    await run.done;
    assert.equal(run.pilot.state().status, "stopping");
  });
});

test("closing the control tab stops an unopened pilot and deletes its profile", async t => {
  await fictionalPilot(t, async run => {
    await run.controlPage.close();
    await run.done;
    assert.equal(run.pilot.state().reason, "window_closed");
  });
});

test("closing the account tab stops the pilot without modifying a workbook", async t => {
  await fictionalPilot(t, async run => {
    run.pilot.action({ action: "start", acknowledged: true });
    await run.pilot.settled();
    const bank = run.context.pages().find(page => page !== run.controlPage);
    await bank.close();
    await run.done;
    assert.equal(run.pilot.state().reason, "window_closed");
    assert.equal(run.pilot.state().workbookUpdated, false);
  });
});

test("pilot timeout and interruption stop unattended sessions and remove disposable files", async t => {
  await fictionalPilot(t, async run => {
    await run.done;
    assert.equal(run.pilot.state().reason, "session_expired");
  }, { durationMs: 50 });
  const controller = new AbortController();
  await fictionalPilot(t, async run => {
    controller.abort();
    await run.done;
    assert.equal(run.pilot.state().reason, "interrupted");
  }, { signal: controller.signal });
});

test("headless live pilot is refused before any files, processes, or network access", async () => {
  await assert.rejects(startPilotInScope({}, { mode: "wells", headless: true }), { code: "INVALID_PILOT" });
});

async function listen(server) {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });

test("actual Chrome policy blocks redirects, fetches and websocket handshakes to unreviewed destinations", async t => {
  const parent = path.join(await tempDirectory(t), "policy");
  let assertion;
  try {
    await withDisposableTestRun({ parent, repositoryRoot }, async scope => {
      let outsideHits = 0;
      let upgrades = 0;
      let blocked = 0;
      let unsupportedHits = 0;
      const outside = http.createServer((_, response) => { outsideHits++; response.end("Fictional unreviewed destination"); });
      outside.on("upgrade", (_, socket) => { upgrades++; socket.destroy(); });
      const outsideOrigin = await listen(outside);
      scope.registerClose(() => close(outside));
      const prefix = `/${"a".repeat(48)}/`;
      const allowed = http.createServer((request, response) => {
        if (request.url === `${prefix}redirect`) { response.writeHead(302, { Location: `${outsideOrigin}/fictional-private` }); response.end(); }
        else if (request.url === `${prefix}post-redirect`) { response.writeHead(307, { Location: `${outsideOrigin}/fictional-post` }); response.end(); }
        else if (request.url === `${prefix}relative`) { response.writeHead(302, { Location: "finished" }); response.end(); }
        else if (request.url === `${prefix}chain`) { response.writeHead(303, { Location: "redirect" }); response.end(); }
        else if (request.url?.includes("unsupported")) { unsupportedHits++; response.end("Fictional unsupported context"); }
        else response.end("<!doctype html><body>Fictional policy check</body>");
      });
      const origin = await listen(allowed);
      scope.registerClose(() => close(allowed));
      const browser = await openOwnedTestBrowser(scope, { headless: true,
        configure: context => installPilotNetworkPolicy(context, { panelAddress: `${origin}${prefix}`, onBlocked: () => { blocked++; } }) });
      const page = browser.context.pages()[0];
      let stage = "open allowed page";
      try {
        await page.goto(`${origin}${prefix}`);
        stage = "allow reviewed relative redirect";
        await page.goto(`${origin}${prefix}relative`);
        assert.equal(page.url(), `${origin}${prefix}finished`);
        stage = "deny redirected destination";
        await Promise.all([
          page.waitForEvent("framenavigated", { predicate: frame => frame === page.mainFrame() && frame.url().startsWith("chrome-error:") }),
          assert.rejects(page.goto(`${origin}${prefix}redirect`)),
        ]);
        stage = "reopen allowed page";
        await page.goto(`${origin}${prefix}`);
        stage = "deny fetch and websocket";
        const result = await page.evaluate(async other => {
          let denied = false;
          try { await fetch(`${other}/fictional-fetch`); } catch { denied = true; }
          await new Promise(resolve => {
            const socket = new WebSocket(other.replace("http:", "ws:"));
            socket.onerror = resolve; socket.onclose = resolve;
            setTimeout(() => { socket.close(); resolve(); }, 500);
          });
          return denied;
        }, outsideOrigin);
        assert.equal(result, true);
        stage = "deny POST and chained redirects";
        const redirectResults = await page.evaluate(async () => {
          const denied = [];
          for (const [endpoint, options] of [["post-redirect", { method: "POST", body: "FICTIONAL-POST-ONLY" }], ["chain", {}]]) {
            try { await fetch(endpoint, options); denied.push(false); } catch { denied.push(true); }
          }
          return denied;
        });
        assert.deepEqual(redirectResults, [true, true]);
        stage = "deny unsupported frames and popups";
        const popup = page.waitForEvent("popup");
        await page.evaluate(() => {
          const frame = document.createElement("iframe"); frame.src = "unsupported-frame"; document.body.append(frame);
          window.open("unsupported-popup");
        });
        const child = await popup;
        await child.waitForLoadState("domcontentloaded").catch(() => {});
        await child.close();
        assert.equal(unsupportedHits, 0);
        assert.equal(outsideHits, 0, "redirects and fetches must be blocked BEFORE reaching an unreviewed origin");
        assert.equal(upgrades, 0);
        assert.ok(blocked >= 3);
      } catch (error) {
        assertion = error.code === "ERR_ASSERTION" ? error : new Error(`Fictional policy check failed during: ${stage} (${error.name})`);
        throw error;
      }
    });
  } catch (error) { throw assertion ?? error; }
  assert.deepEqual(await fs.readdir(parent), []);
});
