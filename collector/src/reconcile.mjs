import { createHash } from "node:crypto";
import { requireEvidence as check } from "./errors.mjs";
import { sumMinor } from "./money.mjs";

const financialFields = row => [row.accountId, row.sourceId, row.pendingSourceId, row.effectiveDate,
  row.postedDate, row.merchant, row.amountMinor, row.currency, row.state, row.kind, row.section];
export const transactionSignature = row => JSON.stringify(financialFields(row));
const signature = transactionSignature;
const sourceKey = (accountId, sourceId) => JSON.stringify([accountId, "source", sourceId]);

export function transactionKey(row) {
  if (row.sourceId !== null) return sourceKey(row.accountId, row.sourceId);
  // A fallback fingerprint identifies an exact observation, not a pending/posting lifecycle.
  const hash = createHash("sha256").update(signature(row)).digest("hex");
  return JSON.stringify([row.accountId, "fingerprint", hash]);
}

function distinctRows(rows) {
  const result = new Map();
  for (const row of rows) {
    const key = transactionKey(row);
    if (result.has(key)) {
      check(row.sourceId !== null, "AMBIGUOUS_DUPLICATE", "Identical transactions without stable source IDs cannot be safely collapsed.");
      check(signature(result.get(key)) === signature(row), "CONFLICTING_SOURCE_ID", "The same source identity has conflicting transaction details.");
    } else {
      result.set(key, row);
    }
  }
  return result;
}

function checkCoverage(capture, rows, previous) {
  for (const state of ["posted", "pending"]) {
    const section = [...rows.values()].filter(row => row.state === state);
    const coverage = capture.coverage[state];
    check(section.length === coverage.count, "COUNT_MISMATCH", "The independently observed activity count does not match the collected entries.");
    check(sumMinor(section.map(row => row.amountMinor)) === coverage.totalMinor,
      "TOTAL_MISMATCH", "The independently observed signed activity total does not match the collected entries.");
  }
  const window = capture.coverage.posted;
  for (const row of rows.values()) {
    if (row.state === "posted") {
      check(row.postedDate >= window.fromDate && row.postedDate <= window.throughDate,
        "INVALID_COVERAGE", "A posted transaction falls outside the declared source window.");
    }
  }
  if (!previous) return;
  if (previous.anchorKey !== null) {
    check(rows.get(previous.anchorKey)?.state === "posted", "ANCHOR_MISSING", "The saved posted-transaction anchor has not been reached.");
  }
  // Always reread an overlap window; a screen's display order is not a cutoff.
  const lookback = new Date(`${previous.asOfDate}T00:00:00Z`);
  lookback.setUTCDate(lookback.getUTCDate() - 7);
  let requiredFrom = lookback.toISOString().slice(0, 10);
  for (const record of previous.records) {
    if (record.active && record.current.state === "pending" && record.current.effectiveDate < requiredFrom) {
      requiredFrom = record.current.effectiveDate;
    }
    const row = record.current;
    if (record.active && row.state === "posted" && row.postedDate >= window.fromDate && row.postedDate <= window.throughDate) {
      check(rows.has(transactionKey(row)), "POSTED_ACTIVITY_MISSING", "Previously verified posted activity is missing from the overlapping source window.");
    }
  }
  check(window.fromDate <= requiredFrom, "INSUFFICIENT_LOOKBACK", "The posted window must cover the overlap period and unresolved pending activity.");
}

export function reconcileAccount(capture, previous = null) {
  const incoming = distinctRows(capture.transactions);
  checkCoverage(capture, incoming, previous);
  const records = new Map((previous?.records ?? []).map(record => [transactionKey(record.current), structuredClone(record)]));
  const priorKeys = new Set(records.keys());
  const resolved = new Set();
  const changes = { added: 0, postedTransitions: 0, cancelled: 0 };
  for (const [key, row] of incoming) {
    let oldKey = key;
    let old = records.get(key);
    if (!old && row.pendingSourceId !== null) {
      oldKey = sourceKey(row.accountId, row.pendingSourceId);
      old = records.get(oldKey);
      check(old?.active && old.current.state === "pending", "INVALID_PENDING_LINK", "A pending-to-posted source link cannot be resolved to an active pending record.");
      check(!incoming.has(oldKey) && !resolved.has(oldKey), "CONFLICTING_PENDING_LINK", "A pending identity is still present or has multiple posted replacements.");
    }
    if (old) {
      check(old.active, "REUSED_SOURCE_ID", "An inactive source identity has reappeared and needs review.");
      if (old.current.state === "posted") {
        check(signature(old.current) === signature(row), "POSTED_ACTIVITY_CHANGED", "Previously verified posted details have changed and need review.");
      } else if (row.state === "posted") {
        changes.postedTransitions += 1;
      }
      if (signature(old.current) !== signature(row)) old.versions.push(structuredClone(row));
      old.current = structuredClone(row);
      records.delete(oldKey);
      records.set(key, old);
      resolved.add(oldKey);
    } else {
      records.set(key, { current: structuredClone(row), versions: [structuredClone(row)], active: true, cancellation: null });
      changes.added += 1;
    }
  }
  for (const resolution of capture.resolvedPending) {
    const key = sourceKey(capture.accountId, resolution.sourceId);
    const old = records.get(key);
    check(old && old.current.state === "pending" && !incoming.has(key) && !resolved.has(key),
      "INVALID_PENDING_RESOLUTION", "A cancellation conflicts with collected activity or lacks a saved pending record.");
    if (!old.active) {
      check(old.cancellation?.resolution === resolution.resolution, "INVALID_PENDING_RESOLUTION", "Pending cancellation conflicts with its saved evidence.");
      continue;
    }
    old.active = false;
    old.cancellation = structuredClone(resolution);
    changes.cancelled += 1;
    resolved.add(key);
  }
  for (const key of priorKeys) {
    const old = records.get(key);
    if (old?.active && old.current.state === "pending") {
      check(incoming.has(key) || resolved.has(key), "PENDING_UNRESOLVED", "A previous pending item disappeared without an evidenced posting or cancellation.");
    }
  }
  const posted = [...incoming.values()].filter(row => row.state === "posted")
    .sort((a, b) => a.postedDate.localeCompare(b.postedDate) || transactionKey(a).localeCompare(transactionKey(b)));
  return {
    state: {
      asOfDate: capture.coverage.posted.throughDate,
      anchorKey: posted.length ? transactionKey(posted.at(-1)) : previous?.anchorKey ?? null,
      records: [...records.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, record]) => record),
    },
    changes,
  };
}
