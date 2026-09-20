import assert from "node:assert/strict";
import test from "node:test";
import { startChromeBridge } from "../src/chrome-bridge.mjs";
import { fictionalActivityCandidate } from "../fixtures/activity-candidate.mjs";

const origin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const post = (port, path, headers = {}, body = "") => fetch(`http://127.0.0.1:${port}${path}`, {
  method: "POST", headers: { Origin: origin, ...headers }, body,
});

test("loopback bridge accepts only one Chrome-extension origin and bounded progress", async () => {
  const observed = [];
  const bridge = await startChromeBridge({ port: 0, onProgress: value => observed.push(value) });
  try {
    assert.equal(bridge.status().extensionConnected, false);
    assert.equal((await post(bridge.port, "/v1/session", { Origin: "https://example.com" })).status, 403);
    const sessionResponse = await post(bridge.port, "/v1/session");
    assert.equal(sessionResponse.status, 200);
    const { session } = await sessionResponse.json();
    assert.match(session, /^[a-f0-9]{64}$/);
    assert.equal((await post(bridge.port, "/v1/progress", { "X-Budget-Collector-Session": "wrong" }, JSON.stringify({ version: 1, event: "wells_opened", tabId: 1 }))).status, 403);
    assert.equal((await post(bridge.port, "/v1/progress", { "X-Budget-Collector-Session": session }, JSON.stringify({ version: 1, event: "authenticated_page", tabId: 1 }))).status, 204);
    assert.deepEqual(observed, [{ event: "authenticated_page" }]);
    assert.deepEqual(bridge.status(), { listening: true, extensionConnected: true, lastEvent: "authenticated_page", commandQueued: false });
  } finally { await bridge.close(); }
});

test("loopback status is bounded local-only diagnostic state", async () => {
  const bridge = await startChromeBridge({ port: 0, nextCommand: "capture_wells_activity" });
  try {
    const status = await fetch(`http://127.0.0.1:${bridge.port}/v1/status`);
    assert.equal(status.status, 200);
    assert.deepEqual(await status.json(), { version: 1, listening: true,
      extensionConnected: false, lastEvent: null, commandQueued: true });
    assert.equal((await fetch(`http://127.0.0.1:${bridge.port}/v1/status`, { headers: { Origin: origin } })).status, 403);
  } finally { await bridge.close(); }
});

test("local trigger page permits only its paired extension to start a refresh", async () => {
  const bridge = await startChromeBridge({ port: 0, triggerExtensionId: "abcdefghijklmnopabcdefghijklmnop" });
  try {
    assert.match(bridge.triggerUrl, /^http:\/\/127\.0\.0\.1:\d+\/v1\/trigger$/);
    const page = await fetch(bridge.triggerUrl);
    assert.equal(page.status, 200);
    const html = await page.text();
    const token = html.match(/token:"([a-f0-9]{64})"/)?.[1];
    assert.ok(token);
    assert.match(html, /runtime\.sendMessage/);
    assert.doesNotMatch(html, /balance|transaction|credential|wells/i);
    assert.equal((await fetch(bridge.triggerUrl, { method: "POST", headers: { Origin: origin } })).status, 403);
    const { session } = await (await post(bridge.port, "/v1/session")).json();
    const accepted = await post(bridge.port, "/v1/trigger", { "X-Budget-Collector-Session": session }, JSON.stringify({ version: 1, token }));
    assert.equal(accepted.status, 204);
    assert.equal((await post(bridge.port, "/v1/trigger", { "X-Budget-Collector-Session": session }, JSON.stringify({ version: 1, token: "0".repeat(64) }))).status, 400);
  } finally { await bridge.close(); }
});

test("loopback bridge delivers one capture command only to its connected extension", async () => {
  const bridge = await startChromeBridge({ port: 0, nextCommand: "capture_wells_activity" });
  try {
    const sessionResponse = await post(bridge.port, "/v1/session");
    const { session } = await sessionResponse.json();
    const get = headers => fetch(`http://127.0.0.1:${bridge.port}/v1/command`, {
      headers: { Origin: origin, ...headers },
    });
    assert.equal((await get({})).status, 403);
    const first = await get({ "X-Budget-Collector-Session": session });
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { version: 1, command: "capture_wells_activity" });
    assert.equal(bridge.status().commandQueued, false);
    assert.deepEqual(await (await get({ "X-Budget-Collector-Session": session })).json(), { version: 1, command: "none" });
  } finally { await bridge.close(); }
});

test("command polling accepts Chromium's origin-less extension GET only with its session", async () => {
  const bridge = await startChromeBridge({ port: 0, nextCommand: "capture_wells_activity" });
  try {
    const { session } = await (await post(bridge.port, "/v1/session")).json();
    const command = await fetch(`http://127.0.0.1:${bridge.port}/v1/command`, {
      headers: { "X-Budget-Collector-Session": session },
    });
    assert.equal(command.status, 200);
    assert.deepEqual(await command.json(), { version: 1, command: "capture_wells_activity" });
    assert.equal((await fetch(`http://127.0.0.1:${bridge.port}/v1/command`, {
      headers: { "X-Budget-Collector-Session": "wrong" },
    })).status, 403);
  } finally { await bridge.close(); }
});

test("activity packets are accepted only for the paired extension and never enter status", async () => {
  const saved = [];
  const bridge = await startChromeBridge({ port: 0, onActivityCapture: async value => saved.push(value) });
  try {
    const { session } = await (await post(bridge.port, "/v1/session")).json();
    const candidate = fictionalActivityCandidate();
    const activity = await post(bridge.port, "/v1/activity", { "X-Budget-Collector-Session": session }, JSON.stringify(candidate));
    assert.equal(activity.status, 204);
    assert.deepEqual(saved, [candidate]);
    assert.deepEqual(bridge.status(), { listening: true, extensionConnected: true,
      lastEvent: "activity_candidate_captured", commandQueued: false });
    assert.doesNotMatch(JSON.stringify(bridge.status()), /FICTIONAL|7\.43/);
    assert.equal((await post(bridge.port, "/v1/activity", { "X-Budget-Collector-Session": "wrong" }, JSON.stringify(candidate))).status, 403);
  } finally { await bridge.close(); }
});

test("empty or unsupported activity states never invoke the private evidence writer", async () => {
  const saved = [];
  const bridge = await startChromeBridge({ port: 0, onActivityCapture: async value => saved.push(value) });
  try {
    const { session } = await (await post(bridge.port, "/v1/session")).json();
    for (const finding of ["no_activity_table", "page_limit", "authentication_controls"]) {
      const candidate = fictionalActivityCandidate();
      candidate.finding = finding;
      candidate.tables = [];
      const response = await post(bridge.port, "/v1/activity", { "X-Budget-Collector-Session": session }, JSON.stringify(candidate));
      assert.equal(response.status, 204);
      assert.match(bridge.status().lastEvent, /^activity_capture_/);
    }
    assert.deepEqual(saved, []);
  } finally { await bridge.close(); }
});

test("loopback bridge rejects raw page content and invalid paths", async () => {
  const bridge = await startChromeBridge({ port: 0 });
  try {
    const sessionResponse = await post(bridge.port, "/v1/session");
    const { session } = await sessionResponse.json();
    assert.equal((await post(bridge.port, "/v1/progress", { "X-Budget-Collector-Session": session }, JSON.stringify({ version: 1, event: "authenticated_page", tabId: 1, text: "private" }))).status, 400);
    assert.equal((await post(bridge.port, "/not-a-route", { "X-Budget-Collector-Session": session })).status, 404);
  } finally { await bridge.close(); }
});
