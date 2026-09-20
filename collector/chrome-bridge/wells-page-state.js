// Do not inspect input values, browser storage, URLs or cookies. Activity text is
// read only after the local collector sends a bounded capture command, and then
// goes directly to the encrypted local evidence boundary.
(() => {
  let previous = null;
  let readinessAttempts = 0;
  let readinessTimer = null;
  let checkingNavigationStarted = false;
  const visible = node => node.getClientRects().length > 0
    && getComputedStyle(node).visibility !== "hidden" && getComputedStyle(node).display !== "none";
  const currentState = () => {
    const controls = [...document.querySelectorAll("input")];
    return controls.some(input => visible(input) && !input.disabled
      && (input.type === "password" || /^(username|current-password|new-password|one-time-code)$/.test(input.autocomplete)))
      ? "auth_required" : "authenticated_page";
  };
  const rowCells = row => [...row.querySelectorAll("th,td,[role=cell],[role=columnheader]")]
    .filter(cell => !cell.closest("tr,[role=row]") || cell.closest("tr,[role=row]") === row);
  const headerKind = value => value.toLowerCase().replace(/\s+/g, " ").trim();
  const activityHeader = row => {
    const headers = rowCells(row).map(text).map(headerKind);
    return headers.some(value => /^date$/i.test(value)) && headers.some(value => /^description$/i.test(value))
      && headers.some(value => /^(deposits?\s*\/\s*credits|withdrawals?\s*\/\s*debits)$/i.test(value));
  };
  const activityContainers = () => [...document.querySelectorAll("table,[role=table],[role=grid]")];
  const activityRows = container => [...container.querySelectorAll("tr,[role=row]")]
    .filter(row => visible(row) && (!row.closest("tr,[role=row]") || row.closest("tr,[role=row]") === row));
  const hasActivityTable = () => activityContainers().some(container => activityRows(container).some(activityHeader));
  const openCheckingActivity = () => {
    if (currentState() === "auth_required" || hasActivityTable()) return false;
    // Account-summary cards expose this stable product label. Opening the
    // checking detail is read-only navigation; this never opens transfers,
    // payments, statements, profile settings, or another product.
    const checking = [...document.querySelectorAll("a")].find(link => /^\s*everyday checking\b/i.test(link.innerText || ""));
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
  const text = cell => (cell.innerText || "").replace(/\s+/g, " ").trim().slice(0, 700);
  const capture = () => {
    if (currentState() === "auth_required") return null;
    const tables = activityContainers();
    const table = tables.find(candidate => activityRows(candidate).some(activityHeader));
    const empty = { version: 1, kind: "activity_candidate", coverageVerified: false, workbookReady: false,
      finding: "no_activity_table", hasFrames: !!document.querySelector("iframe,frame"), tables: [],
      layout: { tableCount: tables.length, rowCount: 0, headerCount: 0, hasShadowRoots: false, tables: [] } };
    if (!table) return empty;
    const rows = activityRows(table);
    const header = rows.find(activityHeader);
    if (!header || rows.length > 500) return empty;
    const headers = rowCells(header).map(text);
    const normalize = value => value.toLowerCase().replace(/[^a-z]/g, "");
    const columns = headers.map(value => ({ date: "date", description: "description", depositscredits: "credit", withdrawalsdebits: "debit", endingdailybalance: "balance" })[normalize(value)] || "unknown");
    if (!columns.includes("date") || !columns.includes("description") || (!columns.includes("credit") && !columns.includes("debit"))) return empty;
    const data = rows.filter(row => row !== header).map(row => rowCells(row).map(text));
    const candidate = { ...empty, finding: "candidate_read", tables: [{ columns, headers, rows: data, issues: [] }],
      layout: { tableCount: tables.length, rowCount: rows.length, headerCount: 1, hasShadowRoots: false,
        tables: [{ kind: "html_table", rows: rows.length, headerRows: 1, reason: "candidate_read", columns }] } };
    return candidate;
  };
  chrome.runtime.onMessage.addListener(message => {
    if (message?.command === "probe_wells_state") { previous = null; checkingNavigationStarted = false; report(); return; }
    if (message?.command !== "capture_wells_activity") return;
    const candidate = capture();
    if (candidate) chrome.runtime.sendMessage({ event: "activity_capture", candidate });
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
