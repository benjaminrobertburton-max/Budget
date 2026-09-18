import { requireEvidence as check } from "./errors.mjs";
import { assertMinorUnits } from "./money.mjs";

export const SCHEMA_VERSION = 1;
export const MAX_CAPTURE_AGE_MS = 15 * 60 * 1000;
const idPattern = /^[a-z][a-z0-9-]{0,79}$/;
const text = value => typeof value === "string" && value.trim().length > 0;

function object(value, keys) {
  check(value !== null && typeof value === "object" && !Array.isArray(value), "INVALID_SCHEMA", "A required record is missing or malformed.");
  check(Object.keys(value).every(key => keys.includes(key)), "INVALID_SCHEMA", "A record contains an unsupported field.");
}

function list(value) {
  check(Array.isArray(value), "INVALID_SCHEMA", "A required list is missing.");
}

export function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function captureTime(value, now) {
  check(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && validDate(value.slice(0, 10)) && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === (value.includes(".") ? value : value.replace("Z", ".000Z")),
  "INVALID_TIMESTAMP", "Capture time must be a valid explicit UTC timestamp.");
  const age = now.getTime() - Date.parse(value);
  check(age >= 0 && age <= MAX_CAPTURE_AGE_MS, "STALE_SOURCE", "Source data is stale or has a future capture time; collect it again.");
}

function evidence(value) {
  check(text(value), "MISSING_EVIDENCE", "A required local evidence reference is missing.");
}

export function validateRegistry(registry) {
  object(registry, ["schemaVersion", "mode", "accounts"]);
  check(registry.schemaVersion === SCHEMA_VERSION, "INVALID_SCHEMA", "Unsupported registry schema version.");
  check(registry.mode === "synthetic", "LIVE_NOT_READY", "Live collection is disabled until the home-machine pilot and private storage are ready.");
  list(registry.accounts);
  check(registry.accounts.length > 0, "EMPTY_REGISTRY", "The account registry must not be empty.");
  const ids = new Set();
  for (const account of registry.accounts) {
    object(account, ["id", "label", "institution", "adapter", "currency", "timeZone", "requiredPages", "balanceTypes", "requiresObligations", "requiresPromos"]);
    check(typeof account.id === "string" && idPattern.test(account.id) && !ids.has(account.id), "INVALID_REGISTRY", "Registry account identifiers must be valid and unique.");
    ids.add(account.id);
    check(text(account.label) && text(account.institution) && typeof account.adapter === "string" && idPattern.test(account.adapter), "INVALID_REGISTRY", "Account labels and adapter identifiers are required.");
    check(["USD", "CAD"].includes(account.currency), "INVALID_CURRENCY", "The account must declare its currency.");
    try {
      check(text(account.timeZone), "INVALID_REGISTRY", "The source timezone is required.");
      new Intl.DateTimeFormat("en-CA", { timeZone: account.timeZone });
    } catch {
      check(false, "INVALID_REGISTRY", "The source timezone is missing or unsupported.");
    }
    list(account.requiredPages);
    check(["summary", "posted", "pending"].every(page => account.requiredPages.includes(page))
      && account.requiredPages.every(page => ["summary", "posted", "pending", "obligations", "promos"].includes(page))
      && new Set(account.requiredPages).size === account.requiredPages.length,
    "INVALID_REGISTRY", "Required account pages must explicitly cover summary, posted, and all pending activity.");
    list(account.balanceTypes);
    check(account.balanceTypes.length > 0 && account.balanceTypes.every(type => ["available", "current", "ledger"].includes(type))
      && new Set(account.balanceTypes).size === account.balanceTypes.length,
    "INVALID_REGISTRY", "Required balance types must be explicit and unique.");
    check(typeof account.requiresObligations === "boolean" && typeof account.requiresPromos === "boolean",
      "INVALID_REGISTRY", "Obligation and promotional-plan requirements must be explicit.");
    check(!account.requiresObligations || account.requiredPages.includes("obligations"), "INVALID_REGISTRY", "The required obligation page is missing from the registry.");
    check(!account.requiresPromos || account.requiredPages.includes("promos"), "INVALID_REGISTRY", "The required promotional-plan page is missing from the registry.");
  }
  return registry;
}

export function validateTransaction(row, account) {
  object(row, ["accountId", "sourceId", "pendingSourceId", "effectiveDate", "postedDate", "merchant", "amountMinor", "currency", "state", "kind", "section", "evidenceRef"]);
  check(row.accountId === account.id && row.currency === account.currency, "WRONG_ACCOUNT", "A transaction does not match its registered account or currency.");
  check(row.sourceId === null || text(row.sourceId), "INVALID_TRANSACTION", "Source identity must be explicit or explicitly unavailable.");
  check(row.pendingSourceId === null || text(row.pendingSourceId), "INVALID_TRANSACTION", "Pending linkage must be explicit or explicitly unavailable.");
  check(validDate(row.effectiveDate) && text(row.merchant), "INVALID_TRANSACTION", "A transaction date or source description is missing or invalid.");
  check(["posted", "pending"].includes(row.state) && row.section === row.state, "INVALID_TRANSACTION", "Transaction state must match the visible source section.");
  check(row.state === "posted" ? validDate(row.postedDate) : row.postedDate === null,
    "INVALID_TRANSACTION", "Posted activity needs a posting date; pending activity must not invent one.");
  check(row.state === "posted" || row.pendingSourceId === null, "INVALID_TRANSACTION", "Only a posted transaction can resolve a pending source identity.");
  check(["purchase", "refund", "payment", "transfer", "payroll", "savings", "unknown"].includes(row.kind),
    "INVALID_TRANSACTION", "Transaction kind must be source-supported or unknown.");
  assertMinorUnits(row.amountMinor);
  evidence(row.evidenceRef);
  return row;
}

export function validateCapture(capture, account, now) {
  object(capture, ["schemaVersion", "mode", "accountId", "status", "capturedAt", "pages", "balances", "transactions", "coverage", "obligations", "promos", "promoCount", "resolvedPending"]);
  check(capture.schemaVersion === SCHEMA_VERSION && capture.mode === "synthetic", "INVALID_SCHEMA", "Unsupported capture version or mode.");
  check(capture.accountId === account.id, "WRONG_ACCOUNT", "The adapter returned a different account.");
  check(capture.status !== "needs_user_auth", "NEEDS_USER_AUTH", "The account requires your normal bank login or approval; resume after completing it.");
  check(capture.status === "collected", "INCOMPLETE_SOURCE", "The account could not be completely collected.");
  captureTime(capture.capturedAt, now);
  list(capture.pages);
  const pageIds = new Set();
  for (const page of capture.pages) {
    object(page, ["id", "capturedAt", "complete", "evidenceRef"]);
    check(account.requiredPages.includes(page.id) && !pageIds.has(page.id), "INVALID_PAGE", "A source page is unexpected or duplicated.");
    pageIds.add(page.id);
    check(page.complete === true, "INCOMPLETE_SOURCE", "A required page is incomplete or still loading.");
    captureTime(page.capturedAt, now);
    evidence(page.evidenceRef);
  }
  check(account.requiredPages.every(page => pageIds.has(page)), "MISSING_PAGE", "A required source page has not been collected.");
  list(capture.balances);
  const balanceTypes = new Set();
  for (const balance of capture.balances) {
    object(balance, ["type", "amountMinor", "currency", "evidenceRef"]);
    check(account.balanceTypes.includes(balance.type) && !balanceTypes.has(balance.type), "INVALID_BALANCE", "A required balance type is duplicated or unrecognized.");
    balanceTypes.add(balance.type);
    check(balance.currency === account.currency, "INVALID_CURRENCY", "Balance currency does not match the account.");
    assertMinorUnits(balance.amountMinor);
    evidence(balance.evidenceRef);
  }
  check(account.balanceTypes.every(type => balanceTypes.has(type)), "MISSING_BALANCE", "A required balance is missing; it cannot be treated as zero.");
  list(capture.transactions);
  for (const row of capture.transactions) validateTransaction(row, account);
  object(capture.coverage, ["posted", "pending"]);
  for (const state of ["posted", "pending"]) {
    const coverage = capture.coverage[state];
    object(coverage, state === "posted"
      ? ["count", "totalMinor", "complete", "fromDate", "throughDate", "evidenceRef"]
      : ["count", "totalMinor", "complete", "scope", "evidenceRef"]);
    check(Number.isSafeInteger(coverage.count) && coverage.count >= 0, "MISSING_COVERAGE", "Independent source counts are required, including an explicit zero.");
    assertMinorUnits(coverage.totalMinor);
    check(coverage.complete === true, "INCOMPLETE_SOURCE", "Activity coverage is incomplete.");
    evidence(coverage.evidenceRef);
    if (state === "posted") {
      check(validDate(coverage.fromDate) && validDate(coverage.throughDate) && coverage.fromDate <= coverage.throughDate,
        "MISSING_COVERAGE", "The complete posted activity date window is required.");
      const localDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: account.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      }).format(new Date(capture.capturedAt));
      check(coverage.throughDate === localDate, "STALE_SOURCE", "Posted coverage must reach the capture date in the source timezone.");
    } else {
      check(coverage.scope === "all-current", "MISSING_COVERAGE", "Pending coverage must include all current pending activity.");
    }
  }
  if (account.requiresObligations) {
    object(capture.obligations, ["minimumMinor", "statementMinor", "dueDate", "evidenceRef"]);
    assertMinorUnits(capture.obligations.minimumMinor);
    assertMinorUnits(capture.obligations.statementMinor);
    check(capture.obligations.minimumMinor >= 0, "INVALID_OBLIGATION", "A payment minimum cannot be negative.");
    check(capture.obligations.dueDate === null ? capture.obligations.minimumMinor === 0 : validDate(capture.obligations.dueDate),
      "INVALID_OBLIGATION", "A required payment due date is missing or invalid.");
    evidence(capture.obligations.evidenceRef);
  } else {
    check(capture.obligations === null, "INVALID_OBLIGATION", "Unexpected obligation data needs an explicit registry requirement.");
  }
  list(capture.promos);
  check(account.requiresPromos ? Number.isSafeInteger(capture.promoCount) && capture.promoCount === capture.promos.length : capture.promoCount === null,
    "PROMO_COUNT_MISMATCH", "The independently observed promotional-plan count is missing or does not match.");
  check(account.requiresPromos || capture.promos.length === 0, "INVALID_PROMO", "Unexpected promotional-plan data needs an explicit registry requirement.");
  const promoIds = new Set();
  for (const promo of capture.promos) {
    object(promo, ["sourceId", "balanceMinor", "expiresOn", "evidenceRef"]);
    check(text(promo.sourceId) && !promoIds.has(promo.sourceId) && validDate(promo.expiresOn), "INVALID_PROMO", "Promotional-plan identity or expiration is missing, invalid, or duplicated.");
    promoIds.add(promo.sourceId);
    assertMinorUnits(promo.balanceMinor);
    check(promo.balanceMinor >= 0, "INVALID_PROMO", "A promotional balance cannot be negative.");
    evidence(promo.evidenceRef);
  }
  list(capture.resolvedPending);
  const resolvedIds = new Set();
  for (const resolution of capture.resolvedPending) {
    object(resolution, ["sourceId", "resolution", "evidenceRef"]);
    check(text(resolution.sourceId) && !resolvedIds.has(resolution.sourceId) && resolution.resolution === "cancelled", "INVALID_PENDING_RESOLUTION", "Pending cancellation needs unique source identity and explicit evidence.");
    resolvedIds.add(resolution.sourceId);
    evidence(resolution.evidenceRef);
  }
  return capture;
}
