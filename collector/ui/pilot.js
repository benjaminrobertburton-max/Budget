// Control-panel DOM only. This script never runs in a bank page.
const get = id => document.getElementById(id);
const labels = {
  not_started: ["Not started", "Nothing has connected. Review the steps to begin."],
  opening: ["Opening", "Opening the separate account tab. Handle any sign-in yourself."],
  manual_navigation: ["Your turn", "Use the account tab to sign in and open one account page. Return here to inspect its outline. Keep only one account tab open."],
  inspecting: ["Inspecting outline", "Reading page structure only. No account text or field values are being copied."],
  outline_saved: ["Outline saved locally", "An encrypted page outline was saved for this temporary test. Account coverage and authentication remain unverified."],
  blocked: ["Needs review", "The page could not be opened or inspected safely. Stop this test and report the issue; no private error details were logged."],
  stopping: ["Stopping", "The browser is closing. Cleanup is confirmed by the launcher after the test files are removed."],
};
let current = null;
let sending = false;
function render(state) {
  current = state;
  const label = labels[state.status] ?? labels.blocked;
  get("status-badge").textContent = label[0];
  get("status-message").textContent = label[1];
  get("start").disabled = sending || !get("ack").checked || state.status !== "not_started";
  get("ack").disabled = state.status !== "not_started";
  get("inspect").disabled = sending || !["manual_navigation", "outline_saved"].includes(state.status) || state.inspectionCount >= 12;
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
  }
}
async function act(action) {
  if (sending && action !== "stop") return;
  sending = true;
  if (current) render(current);
  try {
    const body = action === "start" ? { action, acknowledged: get("ack").checked } : { action };
    await fetch("action", { method: "POST", headers: {
      "Content-Type": "application/json", "X-Collector-Control": document.querySelector('meta[name="collector-control"]').content,
    }, body: JSON.stringify(body) });
  } finally { sending = false; await poll(); }
}
get("ack").addEventListener("change", () => { if (current) render(current); });
for (const id of ["start", "inspect", "stop"]) get(id).addEventListener("click", () => { act(id).catch(() => {}); });
get("stop-top").addEventListener("click", () => { act("stop").catch(() => {}); });
poll();
setInterval(poll, 600);
