import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createPilotController } from "../src/pilot-controller.mjs";
import { startPilotPanel } from "../src/pilot-panel.mjs";
import { WELLS_SIGN_ON, isWellsDocument, wellsRequestAllowed, assertPanelAddress, installPilotNetworkPolicy } from "../src/pilot-policy.mjs";

const outline = () => ({ version: 1, kind: "structure_only", coverageVerified: false, truncated: false,
  hasFrames: false, hasShadowRoots: false, redactedSubtrees: 0,
  nodes: [{ id: 0, parent: -1, position: 1, tag: "body", role: "none", shadow: false }] });
function setup(extra = {}) {
  const calls = { opened: 0, saved: 0, stopped: 0 };
  const controller = createPilotController({ mode: "fictional",
    openBank: async () => { calls.opened += 1; }, inspectBank: async () => outline(),
    saveOutline: async () => { calls.saved += 1; }, stopRun: () => { calls.stopped += 1; }, ...extra });
  return { controller, calls };
}
async function start(controller) {
  assert.equal(controller.action({ action: "start", acknowledged: true }), true);
  await controller.settled();
}

test("pilot has no automatic bank navigation and requires explicit acknowledgement", async () => {
  const { controller, calls } = setup();
  assert.equal(calls.opened, 0);
  assert.equal(controller.action({ action: "start" }), false);
  assert.equal(controller.action({ action: "start", acknowledged: false }), false);
  assert.equal(controller.action({ action: "inspect" }), false);
  await start(controller);
  assert.equal(calls.opened, 1);
  assert.equal(controller.action({ action: "start", acknowledged: true }), false);
  assert.equal(controller.state().status, "manual_navigation");
});

test("outline storage never marks account/authentication/workbook verified", async () => {
  const { controller, calls } = setup();
  await start(controller);
  assert.equal(controller.action({ action: "inspect" }), true);
  await controller.settled();
  assert.equal(calls.saved, 1);
  assert.equal(controller.state().inspectionCount, 1);
  assert.equal(controller.state().authenticationVerified, false);
  assert.equal(controller.state().coverageVerified, false);
  assert.equal(controller.state().workbookUpdated, false);
  assert.deepEqual(controller.state().lastOutline, { elements: 1, tables: 0, hasFrames: false, hasShadowRoots: false, redactedSubtrees: 0, truncated: false });
});

test("unknown command fields, input data, URLs and financial actions are rejected", async () => {
  const { controller, calls } = setup();
  for (const command of [null, [], { action: "pay" }, { action: "transfer" }, { action: "inspect", account: "private" }, { action: "start", acknowledged: true, url: WELLS_SIGN_ON }]) {
    assert.equal(controller.action(command), false);
  }
  assert.equal(calls.opened, 0);
});

test("rapid duplicate actions serialize; stopping a pending action prevents late storage", async () => {
  let resolve;
  const { controller, calls } = setup({ inspectBank: () => new Promise(done => { resolve = done; }) });
  await start(controller);
  assert.equal(controller.action({ action: "inspect" }), true);
  assert.equal(controller.action({ action: "inspect" }), false);
  controller.action({ action: "stop" });
  resolve(outline());
  await controller.settled();
  assert.equal(calls.saved, 0);
  assert.equal(calls.stopped, 1);
  controller.stop();
  assert.equal(calls.stopped, 1);
  assert.equal(controller.state().status, "stopping");
});

test("pilot bounds inspection count and treats failed encryption as a blocked test", async () => {
  const { controller } = setup();
  await start(controller);
  for (let index = 0; index < 12; index++) { assert.equal(controller.action({ action: "inspect" }), true); await controller.settled(); }
  assert.equal(controller.action({ action: "inspect" }), false);
  const failed = setup({ saveOutline: async () => { throw new Error("FICTIONAL PRIVATE CONTENT"); } }).controller;
  await start(failed);
  failed.action({ action: "inspect" });
  await failed.settled();
  assert.equal(failed.state().status, "blocked");
  assert.equal(failed.state().inspectionCount, 0);
  assert.doesNotMatch(JSON.stringify(failed.state()), /FICTIONAL/);
});

test("private failures and unexpected outline fields never reach panel state", async () => {
  for (const inspectBank of [async () => { throw new Error("FICTIONAL-PASSWORD"); }, async () => ({ ...outline(), url: "FICTIONAL-ACCOUNT" })]) {
    const { controller, calls } = setup({ inspectBank });
    await start(controller);
    controller.action({ action: "inspect" });
    await controller.settled();
    assert.equal(controller.state().status, "blocked");
    assert.equal(calls.saved, 0);
    assert.doesNotMatch(JSON.stringify(controller.state()), /FICTIONAL/);
  }
});

test("a stuck pilot operation is bounded and initiates shutdown", async () => {
  const { controller, calls } = setup({ operationTimeoutMs: 15, openBank: () => new Promise(() => {}) });
  await start(controller);
  assert.equal(controller.state().status, "stopping");
  assert.equal(controller.state().reason, "operation_timeout");
  assert.equal(calls.stopped, 1);
});

test("Wells policy requires HTTPS, true domain boundaries, no URL credentials, and normal ports", () => {
  for (const url of [WELLS_SIGN_ON, "https://www.wellsfargo.com/", "https://online.wellsfargo.com/fictional-account"]) assert.equal(isWellsDocument(url), true);
  for (const url of ["http://www.wellsfargo.com/", "https://wellsfargo.com.evil.example/", "https://evilwellsfargo.com/", "https://wellsfargo.com@evil.example/", "https://user@www.wellsfargo.com/", "https://www.wellsfargo.com:444/", "https://www.wellsfargo.com./", "file:///private", "data:text/html,private", "javascript:alert(1)", "https://127.0.0.1/", "malformed", "https://www17.wellsfargomedia.com/"]) {
    assert.equal(isWellsDocument(url), false);
  }
});

test("separate media/third-party domains stay blocked pending explicit review", () => {
  const url = "https://www17.wellsfargomedia.com/fixture.png";
  assert.equal(wellsRequestAllowed({ url, method: "GET", resourceType: "image" }), false);
  assert.equal(wellsRequestAllowed({ url, method: "POST", resourceType: "image" }), false);
  assert.equal(wellsRequestAllowed({ url, method: "GET", resourceType: "document" }), false);
  assert.equal(wellsRequestAllowed({ url, method: "GET", resourceType: "fetch" }), false);
  assert.equal(wellsRequestAllowed({ url: WELLS_SIGN_ON, method: "POST", resourceType: "document" }), true);
});

test("pilot network handler blocks unreviewed destinations and websocket connections without logging URLs", async () => {
  let route;
  let sockets;
  let blocked = 0;
  const panelAddress = `http://127.0.0.1:54321/${"a".repeat(48)}/`;
  const page = {};
  const frame = { parentFrame: () => null, page: () => page };
  await installPilotNetworkPolicy({ route: async (_, fn) => { route = fn; }, routeWebSocket: async (_, fn) => { sockets = fn; },
    newCDPSession: async () => ({ send: async () => {}, on() {} }), pages: () => [page], newPage: async () => ({}), on() {} }, { panelAddress, onBlocked: () => { blocked++; } });
  for (const [url, expected] of [[panelAddress, true], [WELLS_SIGN_ON, true], ["https://unknown.example/PRIVATE", false], ["http://127.0.0.1:54321/other", false]]) {
    let continued = false;
    let aborted = false;
    await route({ request: () => ({ url: () => url, method: () => "GET", resourceType: () => "document", frame: () => frame }), continue: async () => { continued = true; }, abort: async () => { aborted = true; } });
    assert.equal(continued, expected);
    assert.equal(aborted, !expected);
  }
  let closed = false;
  sockets({ close() { closed = true; } });
  assert.equal(closed, true);
  assert.equal(blocked, 3);
  assert.throws(() => assertPanelAddress("http://localhost:54321/"), { code: "PILOT_PANEL_REQUIRED" });
});

async function panelFor(t) {
  const state = setup();
  const panel = await startPilotPanel({ controller: state.controller, mode: "fictional", fictionalPage: "<p>Fictional only</p>" });
  t.after(() => panel.close());
  return { ...state, ...panel };
}
const post = (panel, command, extra = {}) => fetch(`${panel.address}action`, { method: "POST", headers: {
  Origin: panel.origin, "Content-Type": "application/json", "X-Collector-Control": panel.actionKey, ...extra,
}, body: JSON.stringify(command) });

test("panel start requires the private capability, exact origin, JSON type and acknowledgement", async t => {
  const panel = await panelFor(t);
  const startCommand = { action: "start", acknowledged: true };
  for (const extra of [{ Origin: "https://www.wellsfargo.com" }, { Origin: "null" }, { "X-Collector-Control": "wrong" }, { "Content-Type": "text/plain" }]) {
    assert.equal((await post(panel, startCommand, extra)).status, 403);
  }
  assert.equal(panel.calls.opened, 0);
  assert.equal((await post(panel, { action: "start", acknowledged: false })).status, 409);
  assert.equal((await post(panel, startCommand)).status, 202);
  await panel.controller.settled();
  assert.equal(panel.calls.opened, 1);
});

test("panel rejects wrong Host, wrong capability path, query strings, oversized and unknown actions", async t => {
  const panel = await panelFor(t);
  const spoof = await new Promise(resolve => {
    const request = http.get(panel.address, { headers: { Host: "attacker.example" } }, response => { response.resume(); resolve(response.statusCode); });
    request.on("error", () => resolve(0));
  });
  assert.equal(spoof, 403);
  assert.equal((await fetch(`${panel.origin}/state`)).status, 404);
  assert.equal((await fetch(`${panel.address}?private=value`)).status, 404);
  assert.equal((await post(panel, { action: "pay" })).status, 409);
  assert.equal((await post(panel, { action: "start", acknowledged: true, secret: "x".repeat(300) })).status, 413);
  assert.equal(panel.calls.opened, 0);
});

test("panel serves no third-party resources, uses no-store/CSP, and exposes only fixed state", async t => {
  const panel = await panelFor(t);
  const response = await fetch(panel.address);
  const html = await response.text();
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.doesNotMatch(html, /https:\/\/|FICTIONAL-SECRET|account_number/);
  assert.match(html, /Account coverage is not verified/);
  const state = await (await fetch(`${panel.address}state`)).json();
  assert.equal(state.authenticationVerified, false);
  assert.equal((await fetch(`${panel.address}state`, { headers: { Origin: "https://unrelated.example" } })).status, 403);
});
