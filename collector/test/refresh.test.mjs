import test from "node:test";
import assert from "node:assert/strict";
import { collectCandidate } from "../src/refresh.mjs";
import { makeRegistry, makeCaptures, fixtureAdapters, makeTransaction, FIXTURE_NOW } from "../fixtures/synthetic.mjs";

async function run(mutate = () => {}, options = {}) {
  const registry = makeRegistry();
  const captures = makeCaptures(registry);
  mutate(captures, registry);
  return collectCandidate({ registry, adapters: fixtureAdapters(captures), now: FIXTURE_NOW, ...options });
}

async function blocked(code, mutate, options) {
  const result = await run(mutate, options);
  assert.equal(result.status, "blocked");
  assert.equal(result.candidate, null);
  assert.ok(result.issues.some(issue => issue.code === code), JSON.stringify(result.issues));
  return result;
}

test("all eleven fictional accounts produce a candidate, not a verified workbook", async () => {
  const result = await run();
  assert.equal(result.status, "candidate_ready");
  assert.equal(result.candidate.accountCount, 11);
  assert.equal(result.candidate.workbookReady, false);
  assert.equal(result.candidate.remainingGates.length, 4);
  const kinds = result.candidate.captures.flatMap(capture => capture.transactions.map(row => row.kind));
  assert.ok(kinds.includes("payroll") && kinds.includes("transfer") && kinds.includes("refund"));
});

test("repeating a refresh adds no transactions and does not mutate previous history", async () => {
  const first = await run();
  const state = first.candidate.nextState;
  const baseline = structuredClone(state);
  const second = await run(() => {}, { previousState: state });
  assert.equal(second.status, "candidate_ready");
  assert.deepEqual(state, baseline);
  assert.deepEqual(second.candidate.nextState, state);
  assert.equal(Object.values(second.candidate.changes).reduce((total, change) => total + change.added, 0), 0);
});

const failureCases = [
  ["missing source", "INVALID_SCHEMA", captures => delete captures["demo-citi"]],
  ["missing activity page", "MISSING_PAGE", captures => captures["demo-wells"].pages.pop()],
  ["loading activity page", "INCOMPLETE_SOURCE", captures => { captures["demo-wells"].pages[0].complete = false; }],
  ["old page capture", "STALE_SOURCE", captures => { captures["demo-wells"].pages[0].capturedAt = "2031-04-07T15:00:00.000Z"; }],
  ["future capture", "STALE_SOURCE", captures => { captures["demo-wells"].capturedAt = "2031-04-08T15:01:00.000Z"; }],
  ["missing available balance", "MISSING_BALANCE", captures => captures["demo-wells"].balances.shift()],
  ["fractional cents", "INVALID_MONEY", captures => { captures["demo-wells"].balances[0].amountMinor = 1.001; }],
  ["wrong account", "WRONG_ACCOUNT", captures => { captures["demo-wells"].accountId = "demo-citi"; }],
  ["wrong currency", "INVALID_CURRENCY", captures => { captures["demo-wells"].balances[0].currency = "CAD"; }],
  ["missing due date", "INVALID_OBLIGATION", captures => { captures["demo-citi"].obligations.dueDate = null; }],
  ["missing obligations", "INVALID_SCHEMA", captures => { captures["demo-citi"].obligations = null; }],
  ["missing promo detail", "PROMO_COUNT_MISMATCH", captures => { captures["demo-paypal"].promos = []; }],
  ["missing promo control", "PROMO_COUNT_MISMATCH", captures => { captures["demo-paypal"].promoCount = null; }],
  ["missing independent count", "MISSING_COVERAGE", captures => { captures["demo-wells"].coverage.pending.count = null; }],
  ["count mismatch", "COUNT_MISMATCH", captures => { captures["demo-wells"].coverage.posted.count += 1; }],
  ["signed total mismatch", "TOTAL_MISMATCH", captures => { captures["demo-wells"].coverage.pending.totalMinor = 2100; }],
  ["filtered pending", "MISSING_COVERAGE", captures => { captures["demo-wells"].coverage.pending.scope = "this-week"; }],
  ["missing evidence", "MISSING_EVIDENCE", captures => { captures["demo-wells"].transactions[0].evidenceRef = ""; }],
  ["invalid calendar date", "INVALID_TRANSACTION", captures => { captures["demo-wells"].transactions[0].effectiveDate = "2031-02-30"; }],
  ["missing status", "INVALID_TRANSACTION", captures => { captures["demo-wells"].transactions[0].state = null; }],
  ["source window excludes collected row", "INVALID_COVERAGE", captures => { captures["demo-wells"].coverage.posted.fromDate = "2031-04-08"; }],
  ["unsupported field", "INVALID_SCHEMA", captures => { captures["demo-wells"].credentials = "NOT A REAL SECRET"; }],
];
for (const [name, code, mutate] of failureCases) test(`blocks ${name}`, () => blocked(code, mutate));

test("authentication requests are consolidated across accounts", async () => {
  const result = await blocked("NEEDS_USER_AUTH", captures => {
    captures["demo-wells"].status = "needs_user_auth";
    captures["demo-citi"].status = "needs_user_auth";
  });
  assert.deepEqual(result.issues.map(issue => issue.accountId), ["demo-wells", "demo-citi"]);
});

test("missing adapter is not skipped", () => blocked("MISSING_ADAPTER", (_, registry) => { registry.accounts[0].adapter = "not-installed"; }));
test("live mode is disabled", () => blocked("LIVE_NOT_READY", (_, registry) => { registry.mode = "live"; }));
test("empty registry is blocked", () => blocked("EMPTY_REGISTRY", (_, registry) => { registry.accounts = []; }));
test("duplicate registry entries are blocked", () => blocked("INVALID_REGISTRY", (_, registry) => { registry.accounts.push(structuredClone(registry.accounts[0])); }));
test("missing account ID is rejected", () => blocked("INVALID_REGISTRY", (_, registry) => { delete registry.accounts[0].id; }));
test("missing adapter ID is rejected", () => blocked("INVALID_REGISTRY", (_, registry) => { delete registry.accounts[0].adapter; }));
test("invalid source timezone is rejected", () => blocked("INVALID_REGISTRY", (_, registry) => { registry.accounts[0].timeZone = "Invalid/Timezone"; }));
test("invalid clock time cannot roll into another date", () => blocked("INVALID_TIMESTAMP", captures => { captures["demo-wells"].capturedAt = "2031-04-07T24:00:00Z"; }));

test("source overlap is deduplicated only by a matching source ID", async () => {
  const result = await run(captures => {
    captures["demo-wells"].transactions.push({ ...captures["demo-wells"].transactions[0], evidenceRef: "fixture:overlapping-next-page" });
  });
  assert.equal(result.status, "candidate_ready");
  assert.equal(result.candidate.nextState.accounts["demo-wells"].records.length, 4);
});
test("conflicting ID is blocked", () => blocked("CONFLICTING_SOURCE_ID", captures => {
  captures["demo-wells"].transactions.push({ ...captures["demo-wells"].transactions[0], amountMinor: 999 });
}));
test("fingerprint collision is not assumed to be page overlap", () => blocked("AMBIGUOUS_DUPLICATE", captures => {
  captures["demo-wells"].transactions[0].sourceId = null;
  captures["demo-wells"].transactions.push(structuredClone(captures["demo-wells"].transactions[0]));
}));
test("identical purchases with different source IDs remain two transactions", async () => {
  const result = await run(captures => {
    const capture = captures["demo-chase-sapphire"];
    capture.transactions.push({ ...capture.transactions[0], sourceId: "second-real-purchase" });
    Object.assign(capture.coverage.posted, { count: 3, totalMinor: -6557 });
  });
  assert.equal(result.status, "candidate_ready");
  assert.equal(result.candidate.nextState.accounts["demo-chase-sapphire"].records.length, 3);
});
test("a single source-less transaction can be reread exactly", async () => {
  const mutate = captures => { captures["demo-wells"].transactions[0].sourceId = null; };
  const first = await run(mutate);
  const second = await run(mutate, { previousState: first.candidate.nextState });
  assert.equal(second.status, "candidate_ready");
  assert.equal(second.candidate.changes["demo-wells"].added, 0);
});

test("explicit pending-to-posted link preserves one lifecycle and both observations", async () => {
  const first = await run();
  const second = await run(captures => {
    const capture = captures["demo-wells"];
    const row = capture.transactions.find(item => item.sourceId === "wf-hold");
    Object.assign(row, { sourceId: "wf-final", pendingSourceId: "wf-hold", amountMinor: -1950, state: "posted", section: "posted", postedDate: "2031-04-08" });
    Object.assign(capture.coverage.posted, { count: 4, totalMinor: 226572 });
    Object.assign(capture.coverage.pending, { count: 0, totalMinor: 0 });
  }, { previousState: first.candidate.nextState });
  assert.equal(second.status, "candidate_ready");
  const account = second.candidate.nextState.accounts["demo-wells"];
  assert.equal(account.records.length, 4);
  assert.equal(second.candidate.changes["demo-wells"].postedTransitions, 1);
  assert.equal(account.records.find(row => row.current.sourceId === "wf-final").versions.length, 2);
});

test("same amount alone cannot link a disappearing pending item", async () => {
  const first = await run();
  await blocked("PENDING_UNRESOLVED", captures => {
    const capture = captures["demo-wells"];
    Object.assign(capture.transactions.find(row => row.sourceId === "wf-hold"), { sourceId: "unlinked-posted", state: "posted", section: "posted", postedDate: "2031-04-08" });
    Object.assign(capture.coverage.posted, { count: 4, totalMinor: 226422 });
    Object.assign(capture.coverage.pending, { count: 0, totalMinor: 0 });
  }, { previousState: first.candidate.nextState });
});

test("missing pending is not silently dropped", async () => {
  const first = await run();
  await blocked("PENDING_UNRESOLVED", captures => {
    captures["demo-wells"].transactions = captures["demo-wells"].transactions.filter(row => row.state !== "pending");
    Object.assign(captures["demo-wells"].coverage.pending, { count: 0, totalMinor: 0 });
  }, { previousState: first.candidate.nextState });
});

test("explicit cancellation is retained and does not duplicate on replay", async () => {
  const first = await run();
  const mutate = captures => {
    const capture = captures["demo-wells"];
    capture.transactions = capture.transactions.filter(row => row.state !== "pending");
    Object.assign(capture.coverage.pending, { count: 0, totalMinor: 0 });
    capture.resolvedPending.push({ sourceId: "wf-hold", resolution: "cancelled", evidenceRef: "fixture:explicit-cancellation" });
  };
  const second = await run(mutate, { previousState: first.candidate.nextState });
  assert.equal(second.status, "candidate_ready");
  assert.equal(second.candidate.changes["demo-wells"].cancelled, 1);
  assert.equal(second.candidate.nextState.accounts["demo-wells"].records.filter(row => !row.active).length, 1);
  const third = await run(mutate, { previousState: second.candidate.nextState });
  assert.equal(third.status, "candidate_ready");
  assert.equal(third.candidate.changes["demo-wells"].cancelled, 0);
});

test("source order does not affect anchors or hide backdated activity", async () => {
  const first = await run();
  const second = await run(captures => {
    const capture = captures["demo-wells"];
    capture.transactions.reverse();
    capture.transactions.push(makeTransaction("demo-wells", { sourceId: "late-visible", effectiveDate: "2031-03-30", postedDate: "2031-04-03", amountMinor: -800 }));
    Object.assign(capture.coverage.posted, { count: 4, totalMinor: 227722 });
  }, { previousState: first.candidate.nextState });
  assert.equal(second.status, "candidate_ready");
  assert.equal(second.candidate.changes["demo-wells"].added, 1);
});
test("saved latest posted anchor must be present", async () => {
  const first = await run();
  await blocked("ANCHOR_MISSING", captures => {
    const capture = captures["demo-wells"];
    capture.transactions = capture.transactions.filter(row => row.sourceId !== "wf-fuel");
    Object.assign(capture.coverage.posted, { count: 2, totalMinor: 233200 });
  }, { previousState: first.candidate.nextState });
});
test("previously posted activity cannot disappear even if the anchor is present", async () => {
  const first = await run();
  await blocked("POSTED_ACTIVITY_MISSING", captures => {
    const capture = captures["demo-wells"];
    capture.transactions = capture.transactions.filter(row => row.sourceId !== "wf-payroll");
    Object.assign(capture.coverage.posted, { count: 2, totalMinor: -1478 });
  }, { previousState: first.candidate.nextState });
});
test("posted details cannot be silently rewritten", async () => {
  const first = await run();
  await blocked("POSTED_ACTIVITY_CHANGED", captures => {
    captures["demo-wells"].transactions[0].merchant = "FICTIONAL ALTERED DESCRIPTION";
  }, { previousState: first.candidate.nextState });
});
test("an anchor alone is insufficient without a complete overlap window", async () => {
  const first = await run();
  await blocked("INSUFFICIENT_LOOKBACK", captures => {
    captures["demo-wells"].coverage.posted.fromDate = "2031-04-07";
  }, { previousState: first.candidate.nextState });
});
test("a failed refresh leaves the prior state unchanged", async () => {
  const first = await run();
  const state = first.candidate.nextState;
  const baseline = structuredClone(state);
  await blocked("TOTAL_MISMATCH", captures => { captures["demo-wells"].coverage.posted.totalMinor = 0; }, { previousState: state });
  assert.deepEqual(state, baseline);
});
test("removing an account after onboarding is not silently accepted", async () => {
  const first = await run();
  await blocked("REGISTRY_CHANGED", (_, registry) => { registry.accounts.pop(); }, { previousState: first.candidate.nextState });
});
test("malformed saved history blocks before any reader runs", async () => {
  const first = await run();
  first.candidate.nextState.accounts["demo-wells"].records[0].current.amountMinor = null;
  await blocked("INVALID_MONEY", () => {}, { previousState: first.candidate.nextState });
});
test("saved observation history must agree with the current transaction", async () => {
  const first = await run();
  first.candidate.nextState.accounts["demo-wells"].records[0].current.amountMinor = 99;
  await blocked("INVALID_PREVIOUS_STATE", () => {}, { previousState: first.candidate.nextState });
});
test("a saved anchor cannot be silently removed", async () => {
  const first = await run();
  first.candidate.nextState.accounts["demo-wells"].anchorKey = null;
  await blocked("INVALID_PREVIOUS_STATE", () => {}, { previousState: first.candidate.nextState });
});

test("unknown transaction kinds remain unknown", async () => {
  const result = await run(captures => { captures["demo-wells"].transactions[0].kind = "unknown"; });
  assert.equal(result.status, "candidate_ready");
  assert.equal(result.candidate.captures[0].transactions[0].kind, "unknown");
});
test("zero payment with no due date requires explicit source evidence", async () => {
  const result = await run(captures => {
    Object.assign(captures["demo-discover"].obligations, { minimumMinor: 0, dueDate: null });
  });
  assert.equal(result.status, "candidate_ready");
  await blocked("MISSING_EVIDENCE", captures => {
    Object.assign(captures["demo-discover"].obligations, { minimumMinor: 0, dueDate: null, evidenceRef: "" });
  });
});

test("bank errors cannot leak source text into diagnostics", async () => {
  const registry = makeRegistry();
  const secretMarker = "FICTIONAL-SENSITIVE-ERROR-CONTENT";
  const result = await collectCandidate({ registry, adapters: { fixture: { collect: async () => { throw new Error(secretMarker); } } }, now: FIXTURE_NOW });
  assert.equal(result.status, "blocked");
  assert.ok(!JSON.stringify(result).includes(secretMarker));
});
test("a stuck reader times out and receives an abort signal", async () => {
  const registry = makeRegistry();
  registry.accounts = registry.accounts.slice(0, 1);
  let signal;
  const result = await collectCandidate({ registry, adapters: { fixture: { collect: (_account, options) => {
    signal = options.signal;
    return new Promise(() => {});
  } } }, now: FIXTURE_NOW, timeoutMs: 10 });
  assert.equal(result.status, "blocked");
  assert.equal(result.issues[0].code, "SOURCE_TIMEOUT");
  assert.equal(signal.aborted, true);
});

test("coverage dates use the source timezone, including UTC rollover", async () => {
  const now = new Date("2031-04-09T01:00:00.000Z");
  const result = await run(captures => {
    for (const capture of Object.values(captures)) {
      capture.capturedAt = now.toISOString();
      capture.pages.forEach(page => { page.capturedAt = now.toISOString(); });
    }
  }, { now });
  assert.equal(result.status, "candidate_ready");
});
