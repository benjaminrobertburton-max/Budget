// Do not inspect input values, browser storage, URLs or cookies. Activity text is
// read only after the local collector sends a bounded capture command, and then
// goes directly to the encrypted local evidence boundary.
(() => {
  let previous = null;
  let readinessAttempts = 0;
  let readinessTimer = null;
  let captureAttempts = 0;
  let captureTimer = null;
  let pageTurnTimer = null;
  let checkingNavigationStarted = false;
  const visible = node => node.getClientRects().length > 0
    && getComputedStyle(node).visibility !== "hidden" && getComputedStyle(node).display !== "none";
  // Wells has used both ordinary DOM and open web-component roots for the
  // account shell. Search only the current page's DOM, open shadow roots and
  // same-origin frames; never inspect browser storage, URLs or credentials.
  const roots = () => {
    const found = [], seen = new Set(), queue = [document];
    while (queue.length && found.length < 64) {
      const root = queue.shift();
      if (!root || seen.has(root)) continue;
      seen.add(root); found.push(root);
      for (const node of root.querySelectorAll("*")) {
        if (node.shadowRoot) queue.push(node.shadowRoot);
        if (node.tagName === "IFRAME") {
          try { if (node.contentDocument) queue.push(node.contentDocument); } catch { /* cross-origin frame */ }
        }
      }
    }
    return found;
  };
  const deepQueryAll = selector => roots().flatMap(root => [...root.querySelectorAll(selector)]);
  const hasShadowRoots = () => roots().some(root => root !== document && root.host);
  const currentState = () => {
    const controls = deepQueryAll("input");
    return controls.some(input => visible(input) && !input.disabled
      && (input.type === "password" || /^(username|current-password|new-password|one-time-code)$/.test(input.autocomplete)))
      ? "auth_required" : "authenticated_page";
  };
  const rowCells = row => [...row.querySelectorAll("th,td,[role=cell],[role=columnheader]")]
    .filter(cell => !cell.closest("tr,[role=row]") || cell.closest("tr,[role=row]") === row);
  const headerKind = value => value.toLowerCase().replace(/\s+/g, " ").trim();
  const headerLabel = cell => {
    const testId = (cell.getAttribute("data-testid") || "").toLowerCase();
    const byTestId = {
      "transaction-heading-date": "Date",
      "transaction-heading-description": "Description",
      "transaction-heading-deposits_or_credits": "Deposits/Credits",
      "transaction-heading-withdrawals_or_debits": "Withdrawals/Debits",
      "transaction-heading-ending_daily_balance": "Ending Daily Balance",
    }[testId];
    return byTestId || text(cell);
  };
  const activityHeader = row => {
    // Wells renders a visible label and a stable transaction-heading-* test id
    // on the same header cell. Keep those signals separate: concatenating them
    // ("Date transaction-heading-DATE") makes an exact-label detector miss a
    // valid table even though DevTools/accessibility exposes the header.
    const headers = rowCells(row).flatMap(cell => {
      const label = headerKind(headerLabel(cell));
      const testId = headerKind(cell.getAttribute("data-testid") || "");
      const testLabel = testId.replace(/^transaction-heading-/, "").replace(/_/g, " ");
      return [label, testLabel].filter(Boolean);
    });
    return headers.some(value => /^(date)$/i.test(value)) && headers.some(value => /^(description)$/i.test(value))
      && headers.some(value => /^(deposits?\s*\/?\s*credits|withdrawals?\s*\/?\s*debits)$/i.test(value));
  };
  const activityContainers = () => deepQueryAll("table,[role=table],[role=grid]");
  const activityRows = container => [...container.querySelectorAll("tr,[role=row]")]
    .filter(row => visible(row) && (!row.closest("tr,[role=row]") || row.closest("tr,[role=row]") === row));
  const hasActivityTable = () => activityContainers().some(container => activityRows(container).some(activityHeader));
  const openCheckingActivity = () => {
    if (currentState() === "auth_required" || hasActivityTable()) return false;
    // Account-summary cards expose this stable product label. Opening the
    // checking detail is read-only navigation; this never opens transfers,
    // payments, statements, profile settings, or another product.
    const checking = deepQueryAll("a,button,[role=link],[role=button]")
      .find(link => /^\s*everyday checking\b/i.test(link.innerText || ""));
    if (!checking) return false;
    // Wells ignores synthetic content-script clicks on this card. Ask the
    // extension for one narrowly scoped trusted click at the visible card; the
    // extension receives no URL or page data and will not retry stale tabs.
    if (!checkingNavigationStarted) {
      checkingNavigationStarted = true;
      chrome.runtime.sendMessage({ event: "checking_navigation_required" });
    }
    return true;
  };
  const report = () => {
    if (openCheckingActivity()) { previous = null; return; }
    const event = currentState();
    // Wells renders account cards asynchronously. Do not signal an authenticated
    // page to the bridge until an activity table is present, or until a short
    // bounded wait proves that the expected checking card never appeared.
    // Wells can finish the account-detail table well after the authenticated
    // shell appears. Keep this bounded at 30 seconds without emitting a false
    // no-table result during normal rendering.
    if (event === "authenticated_page" && !hasActivityTable() && readinessAttempts < 150) {
      readinessAttempts++;
      if (readinessTimer === null) readinessTimer = setTimeout(() => { readinessTimer = null; report(); }, 200);
      return;
    }
    readinessAttempts = 0;
    if (event === previous) return;
    previous = event;
    chrome.runtime.sendMessage({ event });
  };
  const text = cell => {
    const visibleText = (cell.innerText || "").replace(/\s+/g, " ").trim();
    if (visibleText) return visibleText.slice(0, 700);
    const testId = cell.getAttribute("data-testid") || "";
    const match = /^transaction-heading-(DATE|DESCRIPTION|DEPOSITS_OR_CREDITS|WITHDRAWALS_OR_DEBITS|ENDING_DAILY_BALANCE)$/i.exec(testId);
    const labels = { DATE: "Date", DESCRIPTION: "Description", DEPOSITS_OR_CREDITS: "Deposits/Credits",
      WITHDRAWALS_OR_DEBITS: "Withdrawals/Debits", ENDING_DAILY_BALANCE: "Ending Daily Balance" };
    return match ? labels[match[1].toUpperCase()] : "";
  };
  const capture = () => {
    if (currentState() === "auth_required") return null;
    const tables = activityContainers();
    const table = tables.find(candidate => activityRows(candidate).some(activityHeader));
    const summary = () => {
      const labels = { "available balance": "available", "current posted balance": "ledger", "pending withdrawals/debits": "pending_debits" };
      const balances = [];
      const sourceMoney = value => {
        const matches = value.match(/(?:^|\s)(?:\$|USD\s*)?\d{1,3}(?:,\d{3})*(?:\.\d{2})?(?=\s|$)/g) || [];
        return matches.length === 1 ? matches[0].trim() : "";
      };
      // The production Wells summary uses semantic links and divs in some
      // releases, rather than a two-cell table. Walk only a few ancestors of
      // the exact visible label and accept one adjacent money string.
      for (const cell of deepQueryAll("a,span,div,th,td,[role=cell]")) {
        if (!visible(cell)) continue;
        const type = labels[headerKind(text(cell))];
        if (!type || balances.some(value => value.type === type)) continue;
        let value = "";
        for (let parent = cell.parentElement, depth = 0; parent && depth < 4 && !value; parent = parent.parentElement, depth++) {
          if (visible(parent)) value = sourceMoney(text(parent));
        }
        if (value) balances.push({ type, text: value });
      }
      const account = deepQueryAll("a,button,span,div,[role=link],[role=button]").find(node => {
        const value = text(node); return value.length < 100 && /^\s*account\b.*\d{4}\s*$/i.test(value);
      });
      const match = account && text(account).match(/(\d{4})\s*$/);
      const next = deepQueryAll("a,button,[role=link],[role=button]").filter(node => /^\s*next\s*$/i.test(text(node)));
      return { accountSuffix: match ? match[1] : null, balances,
        nextPage: !next.length ? "next_unavailable" : next.every(node => node.disabled || node.getAttribute("aria-disabled") === "true") ? "next_disabled" : "next_enabled",
        pageToken: "00000000" };
    };
    const source = summary();
    const empty = { version: 1, kind: "activity_candidate", coverageVerified: false, workbookReady: false,
      finding: "no_activity_table", hasFrames: !!document.querySelector("iframe,frame"), tables: [],
      source, layout: { tableCount: tables.length, rowCount: 0, headerCount: 0, hasShadowRoots: hasShadowRoots(), tables: [] } };
    if (!table) return empty;
    const rows = activityRows(table);
    const header = rows.find(activityHeader);
    if (!header || rows.length > 500) return empty;
    const headers = rowCells(header).map(headerLabel);
    const normalize = value => value.toLowerCase().replace(/[^a-z]/g, "");
    const columns = headers.map(value => ({ date: "date", description: "description", depositscredits: "credit", withdrawalsdebits: "debit", endingdailybalance: "balance" })[normalize(value)] || "unknown");
    if (!columns.includes("date") || !columns.includes("description") || (!columns.includes("credit") && !columns.includes("debit"))) return empty;
    const data = rows.filter(row => row !== header).map(row => rowCells(row).map(text));
    // A short deterministic token lets the extension verify that Next produced
    // a different visible page without exporting page text to ordinary status.
    let hash = 2166136261;
    for (const character of `${headers.join("|")}\n${data.map(row => row.join("|")).join("\n")}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    source.pageToken = (hash >>> 0).toString(16).padStart(8, "0");
    const candidate = { ...empty, finding: "candidate_read", tables: [{ columns, headers, rows: data, issues: [] }],
      layout: { tableCount: tables.length, rowCount: rows.length, headerCount: 1, hasShadowRoots: hasShadowRoots(),
        tables: [{ kind: "html_table", rows: rows.length, headerRows: 1, reason: "candidate_read", columns }] } };
    return candidate;
  };
  const captureAfterPageTurn = (previousToken, attempts = 0) => {
    const candidate = capture();
    if (candidate?.finding === "candidate_read" && candidate.source.pageToken !== previousToken) {
      chrome.runtime.sendMessage({ event: "activity_capture", candidate }); return;
    }
    if (attempts >= 150) {
      if (candidate?.source) candidate.source.nextPage = "next_stalled";
      if (candidate) chrome.runtime.sendMessage({ event: "activity_capture", candidate });
      return;
    }
    pageTurnTimer = setTimeout(() => captureAfterPageTurn(previousToken, attempts + 1), 200);
  };
  const captureWhenReady = () => {
    if (currentState() === "auth_required") return;
    if (!hasActivityTable() && captureAttempts < 150) {
      captureAttempts++;
      if (captureTimer === null) captureTimer = setTimeout(() => { captureTimer = null; captureWhenReady(); }, 200);
      return;
    }
    captureAttempts = 0;
    const candidate = capture();
    if (candidate) chrome.runtime.sendMessage({ event: "activity_capture", candidate });
  };
  chrome.runtime.onMessage.addListener(message => {
    if (message?.command === "probe_wells_state") { previous = null; checkingNavigationStarted = false; report(); return; }
    if (message?.command !== "capture_wells_activity") return;
    captureAttempts = 0;
    captureWhenReady();
  });
  chrome.runtime.onMessage.addListener(message => {
    if (message?.command !== "capture_wells_after_next" || !/^[a-f0-9]{8}$/.test(message.pageToken || "")) return;
    if (pageTurnTimer !== null) clearTimeout(pageTurnTimer);
    pageTurnTimer = null; captureAfterPageTurn(message.pageToken);
  });
  // The content script is the sole wake path. A small heartbeat lets a local
  // command begin after Wells was already open without alarms or helper tabs.
  const announce = () => chrome.runtime.sendMessage({ event: "collector_page_ready" }).catch(() => {});
  announce();
  setInterval(announce, 2000);
  report();
  new MutationObserver(report).observe(document.documentElement, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["hidden", "aria-hidden", "style", "disabled", "autocomplete", "type"] });
})();
