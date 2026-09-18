import { CollectionError, requireEvidence as check, safeIssue } from "./errors.mjs";
import { validateRegistry, validateCapture, validateTransaction, validDate, SCHEMA_VERSION } from "./contracts.mjs";
import { reconcileAccount, transactionKey, transactionSignature } from "./reconcile.mjs";

function validatePrevious(previous, registry) {
  if (previous === null) return;
  check(previous?.schemaVersion === SCHEMA_VERSION && previous.mode === "synthetic"
    && previous.accounts && typeof previous.accounts === "object" && !Array.isArray(previous.accounts),
  "INVALID_PREVIOUS_STATE", "Previous collector state has an unsupported format.");
  check(Object.keys(previous.accounts).length === registry.accounts.length
    && registry.accounts.every(account => Object.hasOwn(previous.accounts, account.id)),
  "REGISTRY_CHANGED", "The registry changed; explicit account onboarding or retirement is required.");
  for (const account of registry.accounts) {
    const state = previous.accounts[account.id];
    check(state && validDate(state.asOfDate) && (state.anchorKey === null || typeof state.anchorKey === "string") && Array.isArray(state.records),
      "INVALID_PREVIOUS_STATE", "Previous account state is malformed.");
    const keys = new Set();
    for (const record of state.records) {
      check(record && typeof record.active === "boolean" && Array.isArray(record.versions) && record.versions.length > 0,
        "INVALID_PREVIOUS_STATE", "Previous transaction history is malformed.");
      validateTransaction(record.current, account);
      for (const version of record.versions) validateTransaction(version, account);
      check(transactionSignature(record.current) === transactionSignature(record.versions.at(-1)),
        "INVALID_PREVIOUS_STATE", "Current transaction details do not match saved observation history.");
      check(record.active ? record.cancellation === null
        : record.current.state === "pending" && record.cancellation?.resolution === "cancelled"
          && record.cancellation.sourceId === record.current.sourceId
          && typeof record.cancellation.evidenceRef === "string" && record.cancellation.evidenceRef.trim().length > 0,
      "INVALID_PREVIOUS_STATE", "Inactive transaction state requires explicit cancellation evidence.");
      const key = transactionKey(record.current);
      check(!keys.has(key), "INVALID_PREVIOUS_STATE", "Previous state contains duplicate transaction identities.");
      keys.add(key);
    }
    check(state.anchorKey === null
      ? !state.records.some(record => record.active && record.current.state === "posted")
      : state.records.some(record => record.active && record.current.state === "posted" && transactionKey(record.current) === state.anchorKey),
      "INVALID_PREVIOUS_STATE", "The saved anchor is absent from previous posted history.");
  }
}

// Candidate data only: no disk writes, no browser control, no workbook writes, no Git.
// A production verified snapshot requires the future storage and workbook acceptance gates.
export async function collectCandidate({ registry, adapters, previousState = null, now = new Date(), timeoutMs = 30000 }) {
  try {
    validateRegistry(registry);
    check(now instanceof Date && Number.isFinite(now.getTime()), "INVALID_TIMESTAMP", "A valid collection time is required.");
    check(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 60000, "INVALID_TIMEOUT", "Collection needs a timeout between one millisecond and one minute.");
    validatePrevious(previousState, registry);
  } catch (error) {
    return { status: "blocked", issues: [safeIssue(null, error)], candidate: null };
  }
  // Give adapters immutable copies so they cannot silently remove registry requirements.
  const accounts = structuredClone(registry.accounts);
  const savedState = structuredClone(previousState);
  const results = await Promise.all(accounts.map(async account => {
    try {
      const adapter = adapters?.[account.adapter];
      check(typeof adapter?.collect === "function", "MISSING_ADAPTER", "No tested reader is available for this account.");
      const capture = await collectWithTimeout(adapter, account, timeoutMs);
      validateCapture(capture, account, now);
      const previous = savedState?.accounts[account.id] ?? null;
      check(!previous || capture.coverage.posted.throughDate >= previous.asOfDate,
        "STALE_SOURCE", "The account capture predates the previously accepted account state.");
      const reconciled = reconcileAccount(capture, previous);
      return { accountId: account.id, capture: structuredClone(capture), ...reconciled };
    } catch (error) {
      // Adapter exceptions may contain sensitive text. Expose only our own validated errors.
      return { issue: safeIssue(account.id, error instanceof CollectionError ? error : null) };
    }
  }));
  const issues = results.filter(result => result.issue).map(result => result.issue);
  if (issues.length) return { status: "blocked", issues, candidate: null };
  return {
    status: "candidate_ready",
    issues: [],
    candidate: {
      schemaVersion: SCHEMA_VERSION,
      mode: "synthetic",
      workbookReady: false,
      capturedAt: now.toISOString(),
      accountCount: accounts.length,
      captures: results.map(result => result.capture),
      changes: Object.fromEntries(results.map(result => [result.accountId, result.changes])),
      nextState: {
        schemaVersion: SCHEMA_VERSION,
        mode: "synthetic",
        accounts: Object.fromEntries(results.map(result => [result.accountId, result.state])),
      },
      remainingGates: ["live-source-certification", "encrypted-local-storage", "movement-reconciliation", "workbook-validation"],
    },
  };
}

async function collectWithTimeout(adapter, account, timeoutMs) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => adapter.collect(structuredClone(account), { signal: controller.signal }))
        .catch(() => { throw new CollectionError("ADAPTER_ERROR", "The reader failed. Private source details have not been included in this message."); }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new CollectionError("SOURCE_TIMEOUT", "The account reader timed out; the refresh did not produce an import candidate."));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
