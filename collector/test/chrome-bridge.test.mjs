import assert from "node:assert/strict";
import test from "node:test";
import { startChromeBridge } from "../src/chrome-bridge.mjs";

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
    assert.deepEqual(bridge.status(), { listening: true, extensionConnected: true, lastEvent: "authenticated_page" });
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
