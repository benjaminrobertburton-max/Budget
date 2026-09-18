import test from "node:test";
import assert from "node:assert/strict";
import { validateActivityCandidate, activitySummary, readActivityCandidate } from "../src/activity-probe.mjs";
import { fictionalActivityCandidate } from "../fixtures/activity-candidate.mjs";
import { createPilotController } from "../src/pilot-controller.mjs";
import { startPilotPanel } from "../src/pilot-panel.mjs";

test("private evidence retains exact strings but public summaries contain only structural enums and counts", () => {
  const value = fictionalActivityCandidate();
  assert.equal(validateActivityCandidate(value), value);
  assert.deepEqual(activitySummary(value), { finding: "candidate_read", hasFrames: false,
    layout: value.layout,
    tables: [{ columns: ["date", "description", "amount", "status"], rows: 1, issues: [] }],
    coverageVerified: false, workbookReady: false });
  assert.doesNotMatch(JSON.stringify(activitySummary(value)), /FICTIONAL|2031|7\.43|Pending/);
});

test("unexpected private fields, invented status and unbounded evidence are rejected without private errors", async () => {
  const bad = [value => { value.url = "FICTIONAL-PRIVATE"; }, value => { value.tables[0].columns[0] = "FICTIONAL-PRIVATE"; },
    value => { value.tables[0].rows[0][0] = "x".repeat(701); }, value => { value.tables[0].issues = ["FICTIONAL-PRIVATE"]; },
    value => { value.coverageVerified = true; }, value => { value.workbookReady = true; },
    value => { value.tables[0].rows = Array(501).fill(["fictional"]); }, value => { value.finding = "authentication_controls"; },
    value => { value.tables[0].headers.push("extra"); }, value => { value.tables[0].rows[0] = [null]; }];
  bad.push(value => { value.layout.tables[0].reason = "FICTIONAL-PRIVATE"; },
    value => { value.layout.tables[0].columns = ["FICTIONAL-PRIVATE"]; },
    value => { value.layout.privateLabel = "FICTIONAL-PRIVATE"; },
    value => { value.layout.rowCount = "FICTIONAL-PRIVATE"; });
  for (const mutate of bad) {
    const value = fictionalActivityCandidate(); mutate(value);
    assert.throws(() => validateActivityCandidate(value), error => error.code === "ACTIVITY_PROBE_INVALID" && !error.message.includes("FICTIONAL"));
    await assert.rejects(readActivityCandidate({ evaluate: async () => value }), { code: "ACTIVITY_PROBE_INVALID" });
  }
});

function setup(overrides = {}) {
  const calls = { saved: 0, reports: [], stopped: 0 };
  const controller = createPilotController({ mode: "fictional", openBank: async () => {},
    inspectBank: async () => {}, saveOutline: async () => {}, captureActivity: async () => fictionalActivityCandidate(),
    saveActivity: async () => { calls.saved++; }, onActivityReport: report => calls.reports.push(report),
    stopRun: () => { calls.stopped++; }, ...overrides });
  return { controller, calls };
}
async function capture(controller) {
  controller.action({ action: "start", acknowledged: true }); await controller.settled();
  assert.equal(controller.action({ action: "capture", acknowledged: true }), true); await controller.settled();
}

test("activity needs separate consent, encrypted save before preview, and never enters public state", async () => {
  const { controller, calls } = setup();
  assert.equal(controller.action({ action: "capture", acknowledged: true }), false);
  controller.action({ action: "start", acknowledged: true }); await controller.settled();
  for (const action of [{ action: "capture" }, { action: "capture", acknowledged: false },
    { action: "capture", acknowledged: true, url: "private" }]) assert.equal(controller.action(action), false);
  controller.action({ action: "capture", acknowledged: true }); await controller.settled();
  assert.equal(calls.saved, 1);
  assert.deepEqual(controller.privateReview(), fictionalActivityCandidate());
  assert.doesNotMatch(JSON.stringify([controller.state(), calls.reports]), /FICTIONAL|2031|7\.43|Pending/);
  assert.equal(controller.state().coverageVerified, false);
  assert.equal(controller.state().authenticationVerified, false);
  assert.equal(controller.state().workbookUpdated, false);
  controller.privateReview().tables[0].rows[0][0] = "not an internal mutation";
  assert.equal(controller.privateReview().tables[0].rows[0][0], "2031-04-08");
  controller.stop(); assert.equal(controller.privateReview(), null);
});

test("missing tables are an exception, not a zero-activity or authentication claim", async () => {
  const candidate = { ...fictionalActivityCandidate(), finding: "no_activity_table", tables: [] };
  const { controller } = setup({ captureActivity: async () => candidate });
  await capture(controller);
  assert.equal(controller.state().status, "needs_activity");
  assert.equal(controller.state().coverageVerified, false);
});

test("failed encryption or reader validation never publishes a private preview or result", async () => {
  for (const overrides of [{ saveActivity: async () => { throw new Error("FICTIONAL-SECRET"); } },
    { captureActivity: async () => ({ ...fictionalActivityCandidate(), privateUrl: "FICTIONAL-SECRET" }) }]) {
    const { controller, calls } = setup(overrides); await capture(controller);
    assert.equal(controller.state().status, "blocked"); assert.equal(controller.privateReview(), null);
    assert.equal(calls.reports.length, 0); assert.equal(controller.state().activityCount, 0);
    assert.doesNotMatch(JSON.stringify(controller.state()), /FICTIONAL/);
  }
});

test("capture is bounded, serialized and abort cannot expose late results", async () => {
  let release;
  const { controller, calls } = setup({ captureActivity: () => new Promise(resolve => { release = resolve; }) });
  controller.action({ action: "start", acknowledged: true }); await controller.settled();
  controller.action({ action: "capture", acknowledged: true });
  assert.equal(controller.action({ action: "capture", acknowledged: true }), false);
  controller.stop(); release(fictionalActivityCandidate()); await controller.settled();
  assert.equal(controller.privateReview(), null); assert.equal(calls.saved, 0);
  const repeated = setup().controller;
  await capture(repeated);
  for (let index = 1; index < 12; index++) { assert.equal(repeated.action({ action: "capture", acknowledged: true }), true); await repeated.settled(); }
  assert.equal(repeated.action({ action: "capture", acknowledged: true }), false);
});

test("private review requires same-origin POST, a capability and empty body; no private GET or cached response", async t => {
  const { controller } = setup(); await capture(controller);
  const panel = await startPilotPanel({ controller, mode: "fictional" }); t.after(() => panel.close());
  const request = extra => fetch(`${panel.address}review`, { method: "POST", headers: { Origin: panel.origin,
    "Content-Type": "application/json", "X-Collector-Control": panel.actionKey }, body: "{}", ...extra });
  assert.equal((await fetch(`${panel.address}review`)).status, 404);
  assert.equal((await request({ headers: { Origin: "https://www.wellsfargo.com" } })).status, 403);
  assert.equal((await request({ headers: { Origin: panel.origin, "Content-Type": "application/json" } })).status, 403);
  assert.equal((await request({ body: '{"account":"fictional"}' })).status, 400);
  const response = await request(); assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(await response.json(), fictionalActivityCandidate());
  assert.doesNotMatch(await (await fetch(`${panel.address}state`)).text(), /FICTIONAL|2031|7\.43/);
  controller.stop(); assert.equal(await (await request()).json(), null);
});
