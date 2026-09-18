import { parseMoney } from "../src/money.mjs";
import { requireEvidence as check } from "../src/errors.mjs";

// These selectors belong ONLY to our invented fixture site, not to a bank.
export function fixtureBrowserReader({ context, site, saveEvidence }) {
  const pages = new Map();
  const visit = async (page, url, signal) => {
    signal.throwIfAborted();
    const close = () => { page.close().catch(() => {}); };
    signal.addEventListener("abort", close, { once: true });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      signal.throwIfAborted();
    } finally { signal.removeEventListener("abort", close); }
  };
  return {
    async openGroup(group, { signal }) {
      const page = await context.newPage();
      pages.set(group.id, page);
      await visit(page, `${site.baseUrl}/group/${group.id}/sign-in`, signal);
    },
    async isReady(group, { signal }) {
      signal.throwIfAborted();
      return await pages.get(group.id).locator("body").getAttribute("data-session-ready") === "true";
    },
    async collect(account, group, { signal }) {
      const page = pages.get(group.id);
      const capture = { schemaVersion: 1, mode: "synthetic", accountId: account.id, status: "collected",
        capturedAt: null, pages: [], balances: [], transactions: [], coverage: {}, obligations: null,
        promos: [], promoCount: null, resolvedPending: [] };
      for (const pageId of account.requiredPages) {
        let url = `${site.baseUrl}/group/${group.id}/${account.id}/${pageId}/0`;
        const seen = new Set();
        let coverage;
        let capturedAt;
        do {
          check(!seen.has(url) && seen.size < 100, "PAGINATION_LOOP", "Activity pagination repeated or exceeded its bound.");
          seen.add(url);
          await visit(page, url, signal);
          check(await page.locator("body").getAttribute("data-session-ready") === "true", "NEEDS_USER_AUTH", "The fictional session needs approval again.");
          const marker = page.locator("[data-capture]");
          check(await marker.getAttribute("data-account") === account.id
            && await marker.getAttribute("data-page") === pageId, "WRONG_ACCOUNT", "The page does not match the requested account and section.");
          capturedAt = await marker.getAttribute("data-captured-at");
          capture.capturedAt = capturedAt;
          const ref = `fixture-browser:${account.id}:${pageId}:${seen.size}`;
          const field = name => page.locator(`[data-field="${name}"]`).innerText();
          const count = async name => {
            const value = (await field(name)).trim();
            check(/^\d+$/.test(value) && Number.isSafeInteger(Number(value)), "MISSING_SOURCE_COUNT", "The source count is missing or invalid.");
            return Number(value);
          };
          if (pageId === "summary") {
            for (const row of await page.locator("[data-balance]").all()) {
              const [type, currency, amount] = await row.locator("td").allTextContents();
              capture.balances.push({ type, currency, amountMinor: parseMoney(amount, currency), evidenceRef: ref });
            }
          } else if (["posted", "pending"].includes(pageId)) {
            const currentCoverage = { count: await count("count"), totalMinor: parseMoney(await field("total"), account.currency), complete: true,
              ...(pageId === "posted" ? { fromDate: await field("fromDate"), throughDate: await field("throughDate") } : { scope: await field("scope") }) };
            check(!coverage || JSON.stringify(currentCoverage) === JSON.stringify(coverage), "CHANGED_COVERAGE", "Coverage controls changed between activity pages.");
            coverage = currentCoverage;
            for (const row of await page.locator("[data-transaction]").all()) {
              const [sourceId, pendingSourceId, effectiveDate, postedDate, merchant, amount, currency, state, kind] = await row.locator("td").allTextContents();
              capture.transactions.push({ accountId: account.id, sourceId: sourceId || null, pendingSourceId: pendingSourceId || null,
                effectiveDate, postedDate: postedDate || null, merchant, amountMinor: parseMoney(amount, currency), currency, state, kind, section: pageId, evidenceRef: ref });
            }
          } else if (pageId === "obligations") {
            capture.obligations = { minimumMinor: parseMoney(await field("minimum"), account.currency), statementMinor: parseMoney(await field("statement"), account.currency), dueDate: await field("dueDate"), evidenceRef: ref };
          } else {
            capture.promoCount = await count("promoCount");
            for (const row of await page.locator("[data-promo]").all()) {
              const [sourceId, amount, expiresOn] = await row.locator("td").allTextContents();
              capture.promos.push({ sourceId, balanceMinor: parseMoney(amount, account.currency), expiresOn, evidenceRef: ref });
            }
          }
          const next = await page.locator("[data-next]").count() ? await page.locator("[data-next]").getAttribute("href") : null;
          const nextUrl = next ? new URL(next, url) : null;
          check(!nextUrl || nextUrl.origin === site.origin && nextUrl.pathname.startsWith(new URL(`${site.baseUrl}/group/${group.id}/${account.id}/${pageId}/`).pathname),
            "UNEXPECTED_NAVIGATION", "The activity link leaves the registered source section.");
          url = nextUrl?.href ?? null;
        } while (url);
        const ref = `fixture-browser:${account.id}:${pageId}`;
        capture.pages.push({ id: pageId, complete: true, capturedAt, evidenceRef: ref });
        if (coverage) capture.coverage[pageId] = { ...coverage, evidenceRef: ref };
      }
      signal.throwIfAborted();
      await saveEvidence(capture);
      return capture;
    },
  };
}
