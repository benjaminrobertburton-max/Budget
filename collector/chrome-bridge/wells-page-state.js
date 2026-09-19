// Do not inspect input values, browser storage, URLs or cookies. Activity text is
// read only after the local collector sends a bounded capture command, and then
// goes directly to the encrypted local evidence boundary.
(() => {
  let previous = null;
  const visible = node => node.getClientRects().length > 0
    && getComputedStyle(node).visibility !== "hidden" && getComputedStyle(node).display !== "none";
  const currentState = () => {
    const controls = [...document.querySelectorAll("input")];
    return controls.some(input => visible(input) && !input.disabled
      && (input.type === "password" || /^(username|current-password|new-password|one-time-code)$/.test(input.autocomplete)))
      ? "auth_required" : "authenticated_page";
  };
  const report = () => {
    const event = currentState();
    if (event === previous) return;
    previous = event;
    chrome.runtime.sendMessage({ event });
  };
  const text = cell => (cell.innerText || "").replace(/\s+/g, " ").trim().slice(0, 700);
  const capture = () => {
    if (currentState() === "auth_required") return null;
    const tables = [...document.querySelectorAll("table")];
    const table = tables.find(candidate => {
      const headers = [...candidate.querySelectorAll("tr")].flatMap(row => [...row.querySelectorAll("th")]).map(text);
      return headers.some(value => /^date$/i.test(value)) && headers.some(value => /^description$/i.test(value))
        && headers.some(value => /^(deposits\/credits|withdrawals\/debits)$/i.test(value));
    });
    const empty = { version: 1, kind: "activity_candidate", coverageVerified: false, workbookReady: false,
      finding: "no_activity_table", hasFrames: !!document.querySelector("iframe,frame"), tables: [],
      layout: { tableCount: tables.length, rowCount: 0, headerCount: 0, hasShadowRoots: false, tables: [] } };
    if (!table) return empty;
    const rows = [...table.querySelectorAll("tr")].filter(row => visible(row));
    const header = rows.find(row => row.querySelectorAll("th").length >= 3);
    if (!header || rows.length > 500) return empty;
    const headers = [...header.querySelectorAll("th")].map(text);
    const normalize = value => value.toLowerCase().replace(/[^a-z]/g, "");
    const columns = headers.map(value => ({ date: "date", description: "description", depositscredits: "credit", withdrawalsdebits: "debit", endingdailybalance: "balance" })[normalize(value)] || "unknown");
    if (!columns.includes("date") || !columns.includes("description") || (!columns.includes("credit") && !columns.includes("debit"))) return empty;
    const data = rows.filter(row => row !== header).map(row => [...row.querySelectorAll("td")].map(text));
    const candidate = { ...empty, finding: "candidate_read", tables: [{ columns, headers, rows: data, issues: [] }],
      layout: { tableCount: tables.length, rowCount: rows.length, headerCount: 1, hasShadowRoots: false,
        tables: [{ kind: "html_table", rows: rows.length, headerRows: 1, reason: "candidate_read", columns }] } };
    return candidate;
  };
  chrome.runtime.onMessage.addListener(message => {
    if (message?.command !== "capture_wells_activity") return;
    const candidate = capture();
    if (candidate) chrome.runtime.sendMessage({ event: "activity_capture", candidate });
  });
  report();
  new MutationObserver(report).observe(document.documentElement, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["hidden", "aria-hidden", "style", "disabled", "autocomplete", "type"] });
})();
