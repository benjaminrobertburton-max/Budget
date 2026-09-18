import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { collectWithSessions } from "../src/session-collection.mjs";
import { makeRegistry, makeCaptures, FIXTURE_NOW } from "../fixtures/synthetic.mjs";

function setup() {
  const registry = makeRegistry();
  const captures = makeCaptures(registry);
  const groups = registry.accounts.map(account => ({ id: account.id, accountIds: [account.id] }));
  const reader = { openGroup: async () => {}, isReady: async () => true, collect: async account => structuredClone(captures[account.id]) };
  return { registry, groups, reader, now: () => FIXTURE_NOW, pollMs: 1, operationTimeoutMs: 1000, authTimeoutMs: 1000 };
}

test("all institutions can request login while a ready institution already collects", async () => {
  const options = setup();
  const opened = new Set();
  let allowRest = false;
  let earlyCollection = false;
  options.reader.openGroup = async group => { opened.add(group.id); };
  options.reader.isReady = async group => group.id === "demo-wells" || allowRest;
  const collect = options.reader.collect;
  options.reader.collect = async account => {
    if (account.id === "demo-wells") {
      earlyCollection = !allowRest && opened.size === options.groups.length;
      allowRest = true;
    }
    return collect(account);
  };
  const result = await collectWithSessions(options);
  assert.equal(earlyCollection, true);
  assert.equal(result.status, "candidate_ready");
});

test("collection is bounded across institutions and sequential inside a shared sign-in", async () => {
  const options = setup();
  options.groups = [{ id: "shared-cards", accountIds: ["demo-chase-sapphire", "demo-chase-prime"] }, ...options.groups.filter(group => !group.id.startsWith("demo-chase"))];
  let active = 0;
  let maximum = 0;
  const busy = new Set();
  let overlap = false;
  const collect = options.reader.collect;
  options.reader.collect = async (account, group) => {
    if (busy.has(group.id)) overlap = true;
    busy.add(group.id);
    maximum = Math.max(maximum, ++active);
    await delay(5);
    active--;
    busy.delete(group.id);
    return collect(account);
  };
  const result = await collectWithSessions({ ...options, maxConcurrent: 2 });
  assert.equal(result.status, "candidate_ready");
  assert.equal(maximum, 2);
  assert.equal(overlap, false);
});

test("unapproved sessions time out without producing a partial candidate", async () => {
  const options = setup();
  options.reader.isReady = async group => group.id !== "demo-wells";
  const result = await collectWithSessions({ ...options, authTimeoutMs: 10 });
  assert.equal(result.status, "blocked");
  assert.equal(result.candidate, null);
  assert.equal(result.issues[0].groupId, "demo-wells");
});

test("cancelling sign-in waits stops without publishing", async () => {
  const options = setup();
  const controller = new AbortController();
  options.reader.isReady = async () => false;
  const result = await collectWithSessions({ ...options, signal: controller.signal,
    onProgress: () => controller.abort() });
  assert.equal(result.status, "cancelled");
  assert.equal(result.candidate, null);
});

test("stuck collection gets an abort signal and cannot publish", async () => {
  const options = setup();
  let aborted = false;
  options.reader.collect = async (_account, _group, { signal }) => new Promise(() => {
    signal.addEventListener("abort", () => { aborted = true; }, { once: true });
  });
  const result = await collectWithSessions({ ...options, operationTimeoutMs: 10 });
  assert.equal(aborted, true);
  assert.equal(result.status, "blocked");
  assert.equal(result.candidate, null);
});

test("private reader errors never appear in progress or exceptions", async () => {
  const options = setup();
  options.reader.openGroup = async () => { throw new Error("FICTIONAL-PRIVATE-PAGE-CONTENT"); };
  const result = await collectWithSessions(options);
  assert.equal(result.status, "blocked");
  assert.ok(!JSON.stringify(result).includes("FICTIONAL-PRIVATE"));
});

test("every registered account must belong to exactly one institution session", async () => {
  const options = setup();
  await assert.rejects(collectWithSessions({ ...options, groups: options.groups.slice(1) }), { code: "INVALID_SESSION_GROUPS" });
  await assert.rejects(collectWithSessions({ ...options, groups: [...options.groups, { id: "duplicate", accountIds: ["demo-wells"] }] }), { code: "INVALID_SESSION_GROUPS" });
});

test("sources collected early are checked for freshness again before a candidate is returned", async () => {
  const options = setup();
  let calls = 0;
  options.now = () => ++calls > options.registry.accounts.length ? new Date(FIXTURE_NOW.getTime() + 16 * 60 * 1000) : FIXTURE_NOW;
  const result = await collectWithSessions(options);
  assert.equal(result.status, "blocked");
  assert.equal(result.candidate, null);
  assert.ok(result.issues.every(issue => issue.code === "STALE_SOURCE"));
});

test("a progress-display error cannot leak details or permit a candidate", async () => {
  const result = await collectWithSessions({ ...setup(), onProgress: () => { throw new Error("FICTIONAL-PRIVATE"); } });
  assert.equal(result.status, "blocked");
  assert.equal(result.issues[0].code, "PROGRESS_DISPLAY_FAILED");
  assert.ok(!JSON.stringify(result).includes("FICTIONAL-PRIVATE"));
});

test("timing reports are nonnegative waiting measurements, not invented human work time", async () => {
  const result = await collectWithSessions(setup());
  assert.equal(result.status, "candidate_ready");
  assert.ok(result.progress.every(group => group.loginWaitMs >= 0 && group.collectionMs >= 0));
  assert.ok(result.elapsedMs >= 0);
  assert.ok(!JSON.stringify(result.progress).includes("amountMinor"));
});
