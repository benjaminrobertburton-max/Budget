import { requireEvidence as check } from "./errors.mjs";

const COLUMNS = ["date", "posted_date", "description", "amount", "credit", "debit", "balance", "status", "reference", "unknown"];
const ISSUES = ["hidden_rows", "interactive_cells", "uneven_rows", "spanned_cells", "truncated", "unknown_columns"];
const FINDINGS = ["candidate_read", "authentication_controls", "no_activity_table", "page_limit"];
const keys = (value, expected) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(",") === expected.sort().join(",");
const boundedText = value => typeof value === "string" && value.length <= 700;

// Private evidence contract. Neither this object nor its exceptions may be logged.
// Raw date/sign/status text is retained; this is NOT a normalized source capture.
export function validateActivityCandidate(value) {
  const valid = keys(value, ["version", "kind", "coverageVerified", "workbookReady", "finding", "hasFrames", "tables"])
    && value.version === 1 && value.kind === "activity_candidate" && value.coverageVerified === false
    && value.workbookReady === false && FINDINGS.includes(value.finding) && typeof value.hasFrames === "boolean"
    && Array.isArray(value.tables) && value.tables.length <= 12
    && value.tables.every(table => keys(table, ["columns", "headers", "rows", "issues"])
      && Array.isArray(table.columns) && table.columns.length >= 3 && table.columns.length <= 16
      && table.columns.every(column => COLUMNS.includes(column))
      && Array.isArray(table.headers) && table.headers.length === table.columns.length && table.headers.every(boundedText)
      && Array.isArray(table.rows) && table.rows.length <= 500
      && table.rows.every(row => Array.isArray(row) && row.length <= 16 && row.every(boundedText))
      && Array.isArray(table.issues) && table.issues.length <= ISSUES.length
      && new Set(table.issues).size === table.issues.length && table.issues.every(issue => ISSUES.includes(issue)))
    && (value.finding === "candidate_read" ? value.tables.length > 0 : value.tables.length === 0);
  check(valid && JSON.stringify(value).length <= 300000,
    "ACTIVITY_PROBE_INVALID", "The activity candidate could not be inspected safely. No private details were logged.");
  return value;
}

// The ONLY report that may reach ordinary status, CLI, chat or diagnostics.
export function activitySummary(candidate) {
  validateActivityCandidate(candidate);
  return { finding: candidate.finding, hasFrames: candidate.hasFrames,
    tables: candidate.tables.map(table => ({ columns: [...table.columns], rows: table.rows.length, issues: [...table.issues] })),
    coverageVerified: false, workbookReady: false };
}

export async function readActivityCandidate(page) {
  const candidate = await page.evaluate(() => {
    const tableSelector = 'table,[role="table"],[role="grid"]';
    const rowSelector = 'tr,[role="row"]';
    const excluded = 'form,input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[role="textbox"],script,style,noscript,template,iframe';
    const result = { version: 1, kind: "activity_candidate", coverageVerified: false, workbookReady: false,
      finding: "no_activity_table", hasFrames: !!document.querySelector("iframe,frame"), tables: [] };
    const visible = node => !node.closest('[hidden],[aria-hidden="true"]') && node.getClientRects().length > 0
      && getComputedStyle(node).visibility !== "hidden" && getComputedStyle(node).display !== "none";
    // Bound work before reading text. Never read body.innerText/HTML, values,
    // URLs, IDs, cookies, browser storage, request bodies or authentication data.
    if (document.getElementsByTagName("*").length > 12000) return { ...result, finding: "page_limit" };
    const authInput = [...document.querySelectorAll("input")].some(input => visible(input) && !input.disabled
      && (input.type === "password" || /^(username|current-password|new-password|one-time-code)$/.test(input.autocomplete)));
    if (authInput) return { ...result, finding: "authentication_controls" };
    let budget = 190000;
    let truncated = false;
    const safeText = root => {
      let text = "";
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.parentElement || node.parentElement.closest(excluded) || !visible(node.parentElement)) continue;
        const raw = node.nodeValue ?? "";
        const limit = Math.max(0, Math.min(700 - text.length, budget));
        if (raw.length > limit) truncated = true;
        const part = raw.slice(0, limit);
        budget -= part.length;
        text += part;
        if (truncated) break;
      }
      return text.replace(/\s+/g, " ").trim();
    };
    const classify = label => {
      const text = label.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
      if (/^(date|transaction date)$/.test(text)) return "date";
      if (/^(posted date|posting date)$/.test(text)) return "posted_date";
      if (/^(description|transaction description|merchant|details)$/.test(text)) return "description";
      if (/^(amount|transaction amount)$/.test(text)) return "amount";
      if (/^(deposits?( additions?)?|additions?|credits?|deposits? credits?)$/.test(text)) return "credit";
      if (/^(withdrawals?( subtractions?)?|subtractions?|debits?|withdrawals? debits?)$/.test(text)) return "debit";
      if (/^(balance|running balance|ending daily balance|daily balance)$/.test(text)) return "balance";
      if (/^(status|transaction status)$/.test(text)) return "status";
      if (/^(check( number| no)?|reference( number| no)?)$/.test(text)) return "reference";
      return "unknown";
    };
    const tables = [...document.querySelectorAll(tableSelector)];
    if (tables.length > 12) return { ...result, finding: "page_limit" };
    for (const table of tables) {
      if (!visible(table) || table.closest(excluded) || table.querySelector(tableSelector)) continue;
      const allRows = [...table.querySelectorAll(rowSelector)].filter(row => row.closest(tableSelector) === table);
      const cells = row => [...row.querySelectorAll('th,td,[role="columnheader"],[role="cell"],[role="gridcell"]')]
        .filter(cell => cell.closest(rowSelector) === row && cell.closest(tableSelector) === table);
      const headerRows = allRows.filter(row => visible(row) && cells(row).some(cell => cell.matches('th,[role="columnheader"]')));
      if (headerRows.length !== 1) continue; // Multiple header tiers/row headers need a source-specific map.
      const headerRow = headerRows[0];
      const headerCells = cells(headerRow);
      if (headerCells.length < 3 || headerCells.length > 16 || headerCells.some(cell => !visible(cell))) continue;
      const headers = headerCells.map(safeText);
      const columns = headers.map(classify);
      if (!columns.some(column => ["date", "posted_date"].includes(column)) || !columns.includes("description")
        || !columns.some(column => ["amount", "credit", "debit"].includes(column))) continue;
      const issues = new Set();
      if (columns.includes("unknown")) issues.add("unknown_columns");
      const rows = [];
      for (const row of allRows) {
        if (row === headerRow || row.closest("tfoot")) continue;
        if (!visible(row)) { issues.add("hidden_rows"); continue; }
        const rowCells = cells(row);
        if (rows.length === 500 || rowCells.length > 16) { issues.add("truncated"); break; }
        if (rowCells.length !== columns.length) issues.add("uneven_rows");
        if (rowCells.some(cell => cell.querySelector(excluded))) issues.add("interactive_cells");
        if ([...rowCells, ...headerCells].some(cell => cell.colSpan > 1 || cell.rowSpan > 1)) issues.add("spanned_cells");
        rows.push(rowCells.map(safeText));
        if (truncated) { issues.add("truncated"); break; }
      }
      result.tables.push({ columns, headers, rows, issues: [...issues] });
      if (truncated) break;
    }
    if (result.tables.length) result.finding = "candidate_read";
    return result;
  });
  return validateActivityCandidate(candidate);
}
