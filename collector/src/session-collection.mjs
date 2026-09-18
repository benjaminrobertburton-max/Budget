import { setTimeout as delay } from "node:timers/promises";
import { validateRegistry, validateCapture } from "./contracts.mjs";
import { collectCandidate } from "./refresh.mjs";
import { CollectionError, requireEvidence as check } from "./errors.mjs";

function semaphore(capacity, signal) {
  let active = 0;
  const queue = [];
  const pump = () => {
    while (!signal.aborted && active < capacity && queue.length) {
      active++;
      queue.shift()(() => { active--; pump(); });
    }
  };
  signal.addEventListener("abort", () => { while (queue.length) queue.shift()(null); }, { once: true });
  return async () => {
    signal.throwIfAborted();
    const release = await new Promise(resolve => { queue.push(resolve); pump(); });
    signal.throwIfAborted();
    return release;
  };
}

async function bounded(operation, signal, timeoutMs) {
  const controller = new AbortController();
  const combined = AbortSignal.any([signal, controller.signal]);
  let timer;
  let rejectAbort;
  try {
    combined.throwIfAborted();
    return await Promise.race([
      Promise.resolve().then(() => operation(combined)),
      new Promise((_, reject) => {
        rejectAbort = () => reject(new CollectionError("SESSION_INTERRUPTED", "Collection was cancelled or a source timed out."));
        combined.addEventListener("abort", rejectAbort, { once: true });
        timer = setTimeout(() => controller.abort(), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (rejectAbort) combined.removeEventListener("abort", rejectAbort);
  }
}

// All sign-in groups open together; waiting for a login never occupies a collection slot.
// Same-institution accounts are read sequentially in their shared ordinary session.
export async function collectWithSessions({ registry, groups, reader, previousState = null,
  now = () => new Date(), signal = new AbortController().signal, maxConcurrent = 2,
  pollMs = 250, operationTimeoutMs = 30000, authTimeoutMs = 20 * 60 * 1000,
  onProgress = () => {},
}) {
  registry = structuredClone(registry);
  validateRegistry(registry);
  check(Number.isInteger(maxConcurrent) && maxConcurrent >= 1 && maxConcurrent <= 4
    && Number.isInteger(pollMs) && pollMs >= 1 && pollMs <= 1000
    && Number.isInteger(operationTimeoutMs) && operationTimeoutMs > 0 && operationTimeoutMs <= 60000
    && Number.isInteger(authTimeoutMs) && authTimeoutMs > 0 && authTimeoutMs <= 30 * 60 * 1000,
  "INVALID_SESSION_OPTIONS", "Session timing and concurrency must be bounded.");
  check(Array.isArray(groups) && groups.length > 0
    && groups.every(group => /^[a-z][a-z0-9-]{0,79}$/.test(group.id)
      && Array.isArray(group.accountIds) && group.accountIds.length > 0)
    && new Set(groups.map(group => group.id)).size === groups.length,
  "INVALID_SESSION_GROUPS", "Institution groups must have distinct identifiers and explicit accounts.");
  const accounts = new Map(registry.accounts.map(account => [account.id, structuredClone(account)]));
  const ids = groups.flatMap(group => group.accountIds);
  check(ids.length === accounts.size && new Set(ids).size === ids.length && ids.every(id => accounts.has(id)),
    "INVALID_SESSION_GROUPS", "Every registered account must belong to exactly one sign-in group.");
  const controller = new AbortController();
  const combined = AbortSignal.any([signal, controller.signal]);
  const acquire = semaphore(maxConcurrent, combined);
  const started = performance.now();
  const captures = new Map();
  let observerFailed = false;
  const states = new Map(groups.map(group => [group.id, {
    groupId: group.id, status: "opening", accountCount: group.accountIds.length,
    collectedAccounts: 0, loginWaitMs: 0, collectionMs: 0,
  }]));
  const publish = (groupId, changes) => {
    Object.assign(states.get(groupId), changes);
    // Status metadata only, no page text, URLs, credentials, or financial values.
    try { onProgress(structuredClone({ elapsedMs: Math.round(performance.now() - started), groups: [...states.values()] })); }
    catch { observerFailed = true; }
  };
  try {
    await Promise.all(groups.map(async original => {
      const group = structuredClone(original);
      let release;
      try {
        await bounded(s => reader.openGroup(structuredClone(group), { signal: s }), combined, operationTimeoutMs);
        const loginStarted = performance.now();
        publish(group.id, { status: "needs_login" });
        while (!await bounded(s => reader.isReady(structuredClone(group), { signal: s }), combined, operationTimeoutMs)) {
          check(performance.now() - loginStarted < authTimeoutMs, "AUTH_WAIT_EXPIRED", "The sign-in wait expired without a complete import.");
          await delay(pollMs, undefined, { signal: combined });
        }
        publish(group.id, { status: "queued", loginWaitMs: Math.round(performance.now() - loginStarted) });
        release = await acquire();
        const collectionStarted = performance.now();
        publish(group.id, { status: "collecting" });
        for (const id of group.accountIds) {
          combined.throwIfAborted();
          const account = accounts.get(id);
          const capture = await bounded(s => reader.collect(structuredClone(account), structuredClone(group), { signal: s }), combined, operationTimeoutMs);
          validateCapture(capture, account, now());
          captures.set(id, structuredClone(capture));
          publish(group.id, { collectedAccounts: states.get(group.id).collectedAccounts + 1 });
        }
        publish(group.id, { status: "collected", collectionMs: Math.round(performance.now() - collectionStarted) });
      } catch {
        publish(group.id, { status: combined.aborted ? "cancelled" : "blocked" });
      } finally {
        release?.();
      }
    }));
    const blocked = [...states.values()].filter(state => state.status !== "collected");
    if (blocked.length || combined.aborted || observerFailed) return {
      status: combined.aborted ? "cancelled" : "blocked", candidate: null,
      issues: [...blocked.map(state => ({ groupId: state.groupId, code: "INCOMPLETE_SESSION", message: "An institution needs attention; no workbook was changed." })),
        ...(observerFailed ? [{ groupId: null, code: "PROGRESS_DISPLAY_FAILED", message: "The progress display failed; no workbook was changed." }] : [])],
      progress: [...states.values()], elapsedMs: Math.round(performance.now() - started),
    };
    // Re-check all sources at publication time, including earlier completed sources.
    const adapters = Object.fromEntries(registry.accounts.map(account => [account.adapter, {
      collect: async requested => structuredClone(captures.get(requested.id)),
    }]));
    const result = await collectCandidate({ registry, adapters, previousState, now: now() });
    return { ...result, progress: [...states.values()], elapsedMs: Math.round(performance.now() - started) };
  } finally {
    controller.abort();
  }
}
