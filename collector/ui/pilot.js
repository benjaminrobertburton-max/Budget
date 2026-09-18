// Control-panel DOM only. This script never runs in a bank page.
const get = id => document.getElementById(id);
const labels = {
  not_started: ["Not started", "Nothing has connected. Review the steps to begin."],
  opening: ["Opening", "Opening the separate account tab. Handle any sign-in yourself."],
  manual_navigation: ["Your turn", "Sign in and open checking activity in the bank tab. Return here to test the reader. This is a development step, not the intended weekly routine."],
  inspecting: ["Inspecting outline", "Reading page structure only. No account text or field values are being copied."],
  outline_saved: ["Outline saved locally", "An encrypted page outline was saved for this temporary test. Account coverage and authentication remain unverified."],
  capturing: ["Reading activity", "Reading recognizable transaction tables. Contents stay in this private temporary session; the workbook is unchanged."],
  activity_saved: ["Candidate read · unverified", "The currently loaded tables were captured locally. Review the rows below; this is not a complete or reconciled account import."],
  needs_activity: ["Activity not recognized", "No transaction tables were captured. Make sure sign-in is finished and checking activity is visible. Nothing was assumed to be zero."],
  blocked: ["Needs review", "The page could not be opened or inspected safely. Stop this test and report the issue; no private error details were logged."],
  stopping: ["Stopping", "The browser is closing. Cleanup is confirmed by the launcher after the test files are removed."],
};
let current = null;
let sending = false;
let reviewedCount = -1;
const ready = ["manual_navigation", "outline_saved", "activity_saved", "needs_activity"];
const headers = () => ({ "Content-Type": "application/json",
  "X-Collector-Control": document.querySelector('meta[name="collector-control"]').content });
function render(state) {
  current = state;
  const label = labels[state.status] ?? labels.blocked;
  get("status-badge").textContent = label[0];
  get("status-message").textContent = label[1];
  get("start").disabled = sending || !get("ack").checked || state.status !== "not_started";
  get("ack").disabled = state.status !== "not_started";
  get("inspect").disabled = sending || !ready.includes(state.status) || state.inspectionCount >= 12;
  get("capture").disabled = sending || !ready.includes(state.status) || !state.activityEnabled || !get("capture-ack").checked || state.activityCount >= 12;
  get("capture-ack").disabled = !ready.includes(state.status);
  get("activity").hidden = !state.lastActivity;
  get("review").disabled = sending || !ready.includes(state.status) || !state.lastActivity?.tables.length;
  if (state.activityCount !== reviewedCount || !ready.includes(state.status)) {
    get("private-rows").replaceChildren();
    get("private-rows").hidden = true;
    get("review").textContent = "Show captured rows here";
  }
  if (state.lastActivity) {
    const report = state.lastActivity;
    const count = report.tables.reduce((sum, table) => sum + table.rows, 0);
    const problems = report.tables.flatMap(table => table.issues).map(issue => issue.replaceAll("_", " "));
    get("activity-note").textContent = `${report.tables.length} table(s), ${count} row(s) on this page. Read ${state.activityCount} / 12. ${report.finding.replaceAll("_", " ")}.${report.hasFrames ? " Embedded frames not read." : ""}${problems.length ? ` Limitations: ${[...new Set(problems)].join(", ")}.` : ""}`;
  }
  get("stop").disabled = state.status === "stopping";
  get("stop-top").disabled = state.status === "stopping";
  get("network-warning").hidden = state.blockedRequests === 0;
  get("outline").hidden = !state.lastOutline;
  if (state.lastOutline) {
    get("outline-count").textContent = `${state.inspectionCount} / 12`;
    get("element-count").textContent = state.lastOutline.elements;
    get("table-count").textContent = state.lastOutline.tables;
    const limits = ["Text and form values excluded"];
    if (state.lastOutline.hasFrames) limits.push("embedded frames not inspected");
    if (state.lastOutline.hasShadowRoots) limits.push("open shadow roots detected");
    if (state.lastOutline.truncated) limits.push("outline truncated");
    get("outline-note").textContent = `${limits.join(" · ")}. Not verified account evidence.`;
  }
}
async function poll() {
  try {
    const response = await fetch("state", { cache: "no-store" });
    if (!response.ok) throw new Error("Unavailable");
    render(await response.json());
  } catch {
    get("status-message").textContent = "The control connection ended. Check the launcher for cleanup confirmation; do not assume files were deleted.";
    get("start").disabled = true;
    get("inspect").disabled = true;
    get("capture").disabled = true;
    get("review").disabled = true;
    get("private-rows").replaceChildren();
    get("private-rows").hidden = true;
  }
}
async function act(action) {
  if (sending && action !== "stop") return;
  sending = true;
  if (current) render(current);
  try {
    const body = action === "start" ? { action, acknowledged: get("ack").checked }
      : action === "capture" ? { action, acknowledged: get("capture-ack").checked } : { action };
    await fetch("action", { method: "POST", headers: headers(), body: JSON.stringify(body) });
  } finally { sending = false; await poll(); }
}
get("ack").addEventListener("change", () => { if (current) render(current); });
get("capture-ack").addEventListener("change", () => { if (current) render(current); });
for (const id of ["start", "inspect", "capture", "stop"]) get(id).addEventListener("click", () => { act(id).catch(() => {}); });
get("review").addEventListener("click", async () => {
  const container = get("private-rows");
  if (!container.hidden) { container.replaceChildren(); container.hidden = true; get("review").textContent = "Show captured rows here"; return; }
  const sequence = current?.activityCount;
  try {
    const response = await fetch("review", { method: "POST", headers: headers(), body: "{}", cache: "no-store" });
    if (!response.ok) throw new Error("Unavailable");
    const candidate = await response.json();
    if (!candidate || sequence !== current?.activityCount || !ready.includes(current?.status)) return;
    container.replaceChildren();
    for (const [index, source] of candidate.tables.entries()) {
      const caption = document.createElement("h4");
      caption.textContent = `Table ${index + 1} · ${source.rows.length} captured row(s)`;
      const table = document.createElement("table");
      const head = table.createTHead().insertRow();
      for (const value of source.headers) { const cell = document.createElement("th"); cell.textContent = value; head.append(cell); }
      const body = table.createTBody();
      for (const row of source.rows) { const tr = body.insertRow(); for (const value of row) tr.insertCell().textContent = value; }
      const scroll = document.createElement("div"); scroll.className = "table-scroll"; scroll.tabIndex = 0; scroll.append(table);
      container.append(caption, scroll);
    }
    reviewedCount = sequence;
    container.hidden = false;
    get("review").textContent = "Hide captured rows";
  } catch { get("activity-note").textContent = "Private preview unavailable. No data was sent to logs or chat."; }
});
get("stop-top").addEventListener("click", () => { act("stop").catch(() => {}); });
poll();
setInterval(poll, 600);
