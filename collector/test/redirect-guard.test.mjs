import test from "node:test";
import assert from "node:assert/strict";
import { createRedirectGuard } from "../src/redirect-guard.mjs";
import { wellsRequestAllowed } from "../src/pilot-policy.mjs";

async function setup({ broken = false, allow = value => new URL(value).origin === "https://allowed.example" } = {}) {
  const sent = [];
  let handler;
  let closed = 0;
  let blocked = 0;
  const page = { close: async () => { closed++; } };
  const session = { on: (_, fn) => { handler = fn; }, send: async (method, value) => {
    sent.push({ method, value });
    if (broken && method !== "Fetch.enable") throw new Error("FICTIONAL PRIVATE PROTOCOL DETAIL");
  } };
  const context = { pages: () => [page], newCDPSession: async () => session, newPage: async () => page };
  const guard = await createRedirectGuard(context, allow, () => { blocked++; });
  return { context, guard, page, sent, paused: value => handler({ requestId: "fictional", request: { url: "https://allowed.example/start" }, ...value }),
    closed: () => closed, blocked: () => blocked };
}

test("response guard continues normal responses and relative allowed redirects without reading bodies", async () => {
  const state = await setup();
  for (const event of [{ responseStatusCode: 200 }, { responseStatusCode: 304 },
    { responseStatusCode: 302, responseHeaders: [{ name: "Location", value: "/next" }] }]) {
    await state.paused(event);
    assert.equal(state.sent.at(-1).method, "Fetch.continueResponse");
    assert.deepEqual(Object.keys(state.sent.at(-1).value), ["requestId"]);
  }
  assert.equal(state.blocked(), 0);
});

test("response guard rejects external and duplicate redirect locations before following them", async () => {
  const state = await setup();
  for (const headers of [[{ name: "location", value: "https://unreviewed.example/private" }],
    [{ name: "Location", value: "/next" }, { name: "LOCATION", value: "/another" }]]) {
    await state.paused({ responseStatusCode: 307, responseHeaders: headers });
    assert.equal(state.sent.at(-1).method, "Fetch.failRequest");
  }
  assert.equal(state.blocked(), 2);
  assert.equal(state.closed(), 0);
});

test("malformed redirects and failed interception close the affected page, never continue unrestricted", async () => {
  const malformed = await setup();
  await malformed.paused({ responseStatusCode: 302, responseHeaders: [{ name: "Location", value: "https://[invalid" }] });
  assert.equal(malformed.closed(), 1);
  assert.equal(malformed.sent.filter(call => call.method === "Fetch.continueResponse").length, 0);
  const broken = await setup({ broken: true });
  await broken.paused({ responseStatusCode: 200 });
  assert.equal(broken.closed(), 1);
  assert.equal(broken.blocked(), 1);
});

test("only guarded top-level pages can send requests; unknown frames and tabs remain blocked", async () => {
  const state = await setup();
  const request = (page, parent = null) => ({ frame: () => ({ page: () => page, parentFrame: () => parent }) });
  assert.equal(state.guard(request(state.page)), true);
  assert.equal(state.guard(request({})), false);
  assert.equal(state.guard(request(state.page, {})), false);
  assert.throws(() => state.guard({ frame() { throw new Error("Worker has no frame"); } }));
  await state.context.newPage();
  assert.equal(state.sent.filter(call => call.method === "Fetch.enable").length, 2);
});

test("unsupported browser interception refuses startup instead of silently weakening restrictions", async () => {
  await assert.rejects(createRedirectGuard({ pages: () => [{}], newCDPSession: async () => { throw new Error("Unsupported"); } }, () => true));
});

test("redirects preserve request-type and source-method restrictions for media, including POST-to-GET redirects", async () => {
  const state = await setup({ allow: (url, request) => wellsRequestAllowed({ url, ...request }) });
  for (const [method, resourceType, status, destination, expected] of [
    ["GET", "Stylesheet", 302, "https://www17.wellsfargomedia.com/assets/fictional.css", true],
    ["GET", "Font", 307, "https://www15.wellsfargomedia.com/wfui/fictional.woff2", true],
    ["GET", "Image", 308, "https://www10.wellsfargomedia.com/assets/fictional.png", true],
    ["GET", "Document", 302, "https://www17.wellsfargomedia.com/assets/fictional.css", false],
    ["POST", "Stylesheet", 303, "https://www17.wellsfargomedia.com/assets/fictional.css", false],
    ["POST", "Image", 307, "https://www10.wellsfargomedia.com/assets/fictional.png", false],
    ["GET", "Script", 302, "https://www17.wellsfargomedia.com/assets/fictional.css", false],
    ["GET", "Fetch", 302, "https://www17.wellsfargomedia.com/assets/fictional.css", false],
    ["GET", "Stylesheet", 302, "https://unreviewed.example/fictional.css", false],
    ["GET", "Stylesheet", 302, "https://www17.wellsfargomedia.com/assets/fictional.css?private=value", false],
  ]) {
    await state.paused({ request: { url: "https://connect.secure.wellsfargo.com/fictional-start", method }, resourceType,
      responseStatusCode: status, responseHeaders: [{ name: "Location", value: destination }] });
    assert.equal(state.sent.at(-1).method, expected ? "Fetch.continueResponse" : "Fetch.failRequest");
  }
  assert.equal(state.closed(), 0);
});
