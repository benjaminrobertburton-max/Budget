// Chase discovery reader. It never inspects input values, browser storage,
// cookies, URLs, or credentials. Private table text is read only after the
// loopback collector explicitly requests a capture, then goes directly to the
// encrypted evidence store. This is deliberately separate from Wells because
// their activity layouts and coverage controls are not interchangeable.
(() => {
  let previous = null;
  let captureAttempts = 0;
  let captureTimer = null;
  const visible = node => node.getClientRects().length > 0
    && getComputedStyle(node).visibility !== "hidden" && getComputedStyle(node).display !== "none";
  const roots = () => {
    const found = [], seen = new Set(), queue = [document];
    while (queue.length && found.length < 256) {
      const root = queue.shift();
      if (!root || seen.has(root)) continue;
      seen.add(root); found.push(root);
      for (const node of root.querySelectorAll("*")) {
        if (node.shadowRoot) queue.push(node.shadowRoot);
        if (node.tagName === "IFRAME") { try { if (node.contentDocument) queue.push(node.contentDocument); } catch {} }
      }
    }
    return found;
  };
  const deepQueryAll = selector => roots().flatMap(root => [...root.querySelectorAll(selector)]);
  const hasShadowRoots = () => roots().some(root => root !== document && root.host);
  const text = cell => (cell.innerText || "").replace(/\s+/g, " ").trim().slice(0, 700);
  const rowCells = row => [...row.querySelectorAll("th,td,[role=cell],[role=gridcell],[role=columnheader]")]
    .filter(cell => !cell.closest("tr,[role=row]") || cell.closest("tr,[role=row]") === row);
  const rows = container => [...container.querySelectorAll("tr,[role=row]")]
    .filter(row => visible(row) && (!row.closest("tr,[role=row]") || row.closest("tr,[role=row]") === row));
  const containers = () => deepQueryAll("table,[role=table],[role=grid]");
  const normalized = value => value.toLowerCase().replace(/[^a-z]/g, "");
  const classify = value => ({ date: "date", transactiondate: "date", posteddate: "posted_date", postingdate: "posted_date",
    description: "description", transactiondescription: "description", merchant: "description", details: "description",
    amount: "amount", transactionamount: "amount", debit: "debit", debitamount: "debit", withdrawal: "debit",
    credit: "credit", creditamount: "credit", deposit: "credit", balance: "balance", runningbalance: "balance",
    status: "status", action: "details_control" })[normalized(value)] || "unknown";
  const activityHeader = row => {
    const columns = rowCells(row).map(cell => classify(text(cell)));
    return columns.some(column => column === "date" || column === "posted_date")
      && columns.includes("description") && columns.some(column => ["amount", "credit", "debit"].includes(column));
  };
  const currentState = () => {
    const controls = deepQueryAll("input");
    const loginControls = controls.some(input => visible(input) && !input.disabled
      && (input.type === "password" || /^(username|current-password|new-password|one-time-code)$/.test(input.autocomplete)))
    const signedIn = deepQueryAll('a,button,[role=button],[role=link]').some(node => visible(node)
      && /^sign\s*out$/i.test(text(node)));
    return loginControls || !signedIn ? "chase_auth_required" : "chase_authenticated_page";
  };
  const hasActivityTable = () => containers().some(container => rows(container).some(activityHeader));
  const report = () => {
    const event = currentState();
    if (event === previous) return;
    previous = event;
    chrome.runtime.sendMessage({ event }).catch(() => {});
  };
  const empty = () => ({ version: 1, kind: "activity_candidate", coverageVerified: false, workbookReady: false,
    finding: "no_activity_table", hasFrames: !!document.querySelector("iframe,frame"), tables: [],
    // Chase source labels, summary balance semantics, identity format, and its
    // pagination behaviour have not been certified. Do not invent Wells fields.
    source: { accountSuffix: null, balances: [], nextPage: "next_unavailable", pageToken: "00000000" },
    layout: { tableCount: 0, rowCount: 0, headerCount: 0, hasShadowRoots: hasShadowRoots(), tables: [] } });
  const capture = () => {
    if (currentState() === "chase_auth_required") return { ...empty(), finding: "authentication_controls" };
    const candidate = empty();
    const found = containers();
    candidate.layout.tableCount = found.length;
    candidate.layout.rowCount = found.reduce((count, table) => count + rows(table).length, 0);
    candidate.layout.headerCount = deepQueryAll("th,[role=columnheader]").length;
    if (found.length > 12 || candidate.layout.rowCount > 12000) return { ...candidate, finding: "page_limit" };
    const matches = [];
    for (const table of found) {
      const tableRows = rows(table);
      const header = tableRows.find(activityHeader);
      if (!header) continue;
      const headerCells = rowCells(header);
      const headers = headerCells.map(text);
      const columns = headers.map(classify);
      if (tableRows.length > 500 || headerCells.length < 3 || headerCells.length > 16) return { ...candidate, finding: "page_limit" };
      matches.push({ table, tableRows, header, headers, columns });
    }
    // Observed Chase detail pages have distinct PENDING and ACTIVITY tables.
    // Preserve their section identity as explicit evidence rows. A dashboard
    // preview or an unknown table cannot be promoted to account detail evidence.
    const sections = matches.map(({ table }) => table.id.startsWith("PENDING-") ? "Pending Transactions"
      : table.id.startsWith("ACTIVITY-") ? "Posted Transactions" : null);
    if (matches.length > 1) {
      if (matches.length !== 2 || new Set(sections).size !== 2 || sections.includes(null)) return candidate;
      candidate.finding = "candidate_read";
      candidate.tables = matches.map(({ tableRows, header, headers, columns }, index) => ({
        columns, headers, rows: [[sections[index]], ...tableRows.filter(row => row !== header).map(row => rowCells(row).map(text))],
        issues: columns.includes("unknown") ? ["unknown_columns"] : [],
      }));
      candidate.layout.tables = matches.map(({ tableRows, columns }) => ({kind: "html_table", rows: tableRows.length,
        headerRows: 1, reason: "candidate_read", columns}));
      return candidate;
    }
    if (matches.length !== 1) return candidate;
    if (sections[0] === null) return candidate;
    const { table, tableRows, header, headers, columns } = matches[0];
    const data = tableRows.filter(row => row !== header).map(row => rowCells(row).map(text));
    if (data.some(row => row.length !== columns.length) || data.some(row => row.some(value => value.length > 700))) return candidate;
    let hash = 2166136261;
    for (const character of `${headers.join("|")}\n${data.map(row => row.join("|")).join("\n")}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    candidate.source.pageToken = (hash >>> 0).toString(16).padStart(8, "0");
    candidate.finding = "candidate_read";
    candidate.tables = [{ columns, headers, rows: [[sections[0]], ...data], issues: columns.includes("unknown") ? ["unknown_columns"] : [] }];
    candidate.layout.tables = [{ kind: table.tagName === "TABLE" ? "html_table" : table.getAttribute("role") === "grid" ? "aria_grid" : "aria_table",
      rows: tableRows.length, headerRows: 1, reason: "candidate_read", columns }];
    return candidate;
  };
  const captureWhenReady = () => {
    if (currentState() === "chase_auth_required") return;
    if (!hasActivityTable() && captureAttempts < 150) {
      captureAttempts++;
      if (captureTimer === null) captureTimer = setTimeout(() => { captureTimer = null; captureWhenReady(); }, 200);
      return;
    }
    captureAttempts = 0;
    const candidate = capture();
    chrome.runtime.sendMessage({ event: "chase_activity_capture", candidate }).catch(() => {});
  };
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.command === "probe_chase_state") { sendResponse({ accepted: true }); previous = null; report(); return; }
    if (message?.command !== "capture_chase_activity") return;
    sendResponse({ accepted: true });
    captureAttempts = 0; captureWhenReady();
  });
  const announce = () => chrome.runtime.sendMessage({ event: "chase_page_ready" }).catch(() => {});
  announce(); setInterval(announce, 2000); report();
  new MutationObserver(report).observe(document.documentElement, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["hidden", "aria-hidden", "style", "disabled", "autocomplete", "type"] });
})();
