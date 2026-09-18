// Entirely fictional records for offline development. These are not household facts.
// Institution names describe adapter coverage targets, not working integrations.
export const FIXTURE_NOW = new Date("2031-04-08T15:00:00.000Z");

export function makeRegistry() {
  const specifications = [
    ["demo-wells", "Wells Fargo", "USD", ["available", "ledger"], false, false],
    ["demo-wealthfront", "Wealthfront", "USD", ["available"], false, false],
    ["demo-chase-sapphire", "Chase Sapphire", "USD", ["current"], true, false],
    ["demo-chase-prime", "Chase Prime", "USD", ["current"], true, false],
    ["demo-citi", "Citi", "USD", ["current"], true, false],
    ["demo-discover", "Discover", "USD", ["current"], true, false],
    ["demo-capital-one", "Capital One", "USD", ["current"], true, false],
    ["demo-paypal", "PayPal Credit", "USD", ["current"], true, true],
    ["demo-cutx", "Credit Union of Texas", "USD", ["available"], false, false],
    ["demo-rbc", "RBC", "CAD", ["available"], false, false],
    ["demo-fidelity", "Fidelity", "USD", ["current"], false, false],
  ];
  return {
    schemaVersion: 1,
    mode: "synthetic",
    accounts: specifications.map(([id, institution, currency, balanceTypes, requiresObligations, requiresPromos]) => ({
      id, institution, label: `Fictional ${institution} account`, adapter: "fixture", currency,
      timeZone: currency === "CAD" ? "America/Toronto" : "America/Chicago",
      requiredPages: ["summary", "posted", "pending", ...(requiresObligations ? ["obligations"] : []), ...(requiresPromos ? ["promos"] : [])],
      balanceTypes, requiresObligations, requiresPromos,
    })),
  };
}

export function makeTransaction(accountId, overrides = {}) {
  return {
    accountId, sourceId: "fixture-posted-1", pendingSourceId: null,
    effectiveDate: "2031-04-07", postedDate: "2031-04-07",
    merchant: "FICTIONAL CORNER SHOP", amountMinor: -1234, currency: "USD",
    state: "posted", kind: "purchase", section: "posted", evidenceRef: "fixture:activity:row-1",
    ...overrides,
  };
}

export function makeCaptures(registry = makeRegistry()) {
  const captures = Object.fromEntries(registry.accounts.map((account, index) => [account.id, {
    schemaVersion: 1, mode: "synthetic", accountId: account.id, status: "collected",
    capturedAt: FIXTURE_NOW.toISOString(),
    pages: account.requiredPages.map(id => ({ id, complete: true, capturedAt: FIXTURE_NOW.toISOString(), evidenceRef: `fixture:${account.id}:${id}` })),
    balances: account.balanceTypes.map(type => ({ type, amountMinor: 250000 + index * 1000, currency: account.currency, evidenceRef: `fixture:${account.id}:summary` })),
    transactions: [],
    coverage: {
      posted: { count: 0, totalMinor: 0, complete: true, fromDate: "2031-03-01", throughDate: "2031-04-08", evidenceRef: `fixture:${account.id}:posted-controls` },
      pending: { count: 0, totalMinor: 0, complete: true, scope: "all-current", evidenceRef: `fixture:${account.id}:pending-controls` },
    },
    obligations: account.requiresObligations ? { minimumMinor: 1700, statementMinor: 29000, dueDate: "2031-04-22", evidenceRef: `fixture:${account.id}:obligations` } : null,
    promos: account.requiresPromos ? [{ sourceId: "fictional-promo-1", balanceMinor: 43000, expiresOn: "2031-11-19", evidenceRef: `fixture:${account.id}:promos` }] : [],
    promoCount: account.requiresPromos ? 1 : null,
    resolvedPending: [],
  }]));
  captures["demo-wells"].transactions = [
    makeTransaction("demo-wells", { sourceId: "wf-payroll", amountMinor: 230000, kind: "payroll", merchant: "FICTIONAL PAYROLL" }),
    makeTransaction("demo-wells", { sourceId: "wf-fuel", effectiveDate: "2031-04-08", postedDate: "2031-04-08", amountMinor: -4678, merchant: "FICTIONAL FUEL" }),
    makeTransaction("demo-wells", { sourceId: "wf-hold", state: "pending", section: "pending", postedDate: null, amountMinor: -2100, merchant: "FICTIONAL HOTEL HOLD" }),
    makeTransaction("demo-wells", { sourceId: "wf-transfer", amountMinor: 3200, kind: "transfer", merchant: "FICTIONAL TRANSFER" }),
  ];
  // Separate source controls are explicit fixture values, not derived from the parser output.
  Object.assign(captures["demo-wells"].coverage.posted, { count: 3, totalMinor: 228522 });
  Object.assign(captures["demo-wells"].coverage.pending, { count: 1, totalMinor: -2100 });
  captures["demo-wealthfront"].transactions = [
    makeTransaction("demo-wealthfront", { sourceId: "wealthfront-transfer", amountMinor: -3200, kind: "transfer", merchant: "FICTIONAL TRANSFER" }),
  ];
  Object.assign(captures["demo-wealthfront"].coverage.posted, { count: 1, totalMinor: -3200 });
  captures["demo-chase-sapphire"].transactions = [
    makeTransaction("demo-chase-sapphire", { sourceId: "chase-purchase", amountMinor: -3650 }),
    makeTransaction("demo-chase-sapphire", { sourceId: "chase-refund", amountMinor: 743, kind: "refund", merchant: "FICTIONAL REFUND" }),
  ];
  Object.assign(captures["demo-chase-sapphire"].coverage.posted, { count: 2, totalMinor: -2907 });
  return captures;
}

export function fixtureAdapters(captures) {
  return { fixture: { collect: async account => structuredClone(captures[account.id]) } };
}
