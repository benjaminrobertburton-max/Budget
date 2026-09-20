// This bridge talks only to the loopback collector and Wells. It never reads,
// fills, submits, stores, or transmits credentials, cookies, form values, or
// browser storage. Chrome's own alarm wakes the installed extension; no helper
// tab, Chrome launch, debugger, or external web message is used.
const LOCAL_BRIDGE = "http://127.0.0.1:43811";
const WELLS_SIGN_ON = "https://connect.secure.wellsfargo.com/auth/login/present?origin=cob";
const POLL_ALARM = "budget-collector-local-command";
let session = null;
let pollInFlight = false;
let wellsTabId = null;
const checkingNavigation = new Set();

async function send(path, body) {
  if (!session) return false;
  try {
    const response = await fetch(`${LOCAL_BRIDGE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Budget-Collector-Session": session },
      body: JSON.stringify(body), cache: "no-store",
    });
    if (response.status === 403) session = null;
    return response.ok;
  } catch { session = null; return false; }
}

async function startSession() {
  if (session) return true;
  try {
    const response = await fetch(`${LOCAL_BRIDGE}/v1/session`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    });
    if (!response.ok) return false;
    const body = await response.json();
    if (!body || typeof body.session !== "string" || !/^[a-f0-9]{64}$/.test(body.session)) return false;
    session = body.session;
    return true;
  } catch { return false; }
}

async function nextCommand() {
  if (!session) return "none";
  try {
    const response = await fetch(`${LOCAL_BRIDGE}/v1/command`, {
      headers: { "X-Budget-Collector-Session": session }, cache: "no-store",
    });
    if (response.status === 403) { session = null; return "none"; }
    if (!response.ok) return "none";
    const body = await response.json();
    return body?.version === 1 && ["none", "open_wells", "capture_wells_activity"].includes(body.command)
      ? body.command : "none";
  } catch { session = null; return "none"; }
}

async function probe(tabId) {
  if (!Number.isInteger(tabId)) return false;
  wellsTabId = tabId;
  const delivered = await chrome.tabs.sendMessage(tabId, { command: "probe_wells_state" })
    .then(() => true)
    .catch(() => false);
  // An already-open Wells tab can predate an extension update. Reloading that
  // same tab is the only recovery; it creates no tab and cannot loop.
  if (!delivered) await chrome.tabs.reload(tabId).catch(() => {});
  return delivered;
}

async function openOrReuseWells() {
  const existing = await chrome.tabs.query({ url: ["https://connect.secure.wellsfargo.com/accounts/*"] });
  const reusable = existing.find(tab => Number.isInteger(tab.id));
  if (reusable?.id) {
    await probe(reusable.id);
    await send("/v1/progress", { version: 1, event: "wells_opened", tabId: reusable.id });
    return;
  }
  const tab = await chrome.tabs.create({ url: WELLS_SIGN_ON, active: true });
  wellsTabId = Number.isInteger(tab.id) ? tab.id : null;
  await send("/v1/progress", { version: 1, event: "wells_opened", tabId: wellsTabId });
}

async function navigateChecking(tabId) {
  if (!Number.isInteger(tabId) || checkingNavigation.has(tabId)) return;
  checkingNavigation.add(tabId);
  const target = { tabId };
  try {
    await chrome.debugger.attach(target, "1.3");
    // Return only a viewport rectangle for the visible product link. No page
    // text, URL, account identifier, balance, cookie, or form value is read.
    const response = await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => { const a = [...document.querySelectorAll('a,button,[role="link"],[role="button"]')].find(x => /^\\s*everyday checking\\b/i.test(x.innerText || '')); if (!a) return null; const r = a.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`,
    });
    const rect = response?.result?.value;
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(value => typeof value === "number" && Number.isFinite(value)) || rect[2] < 2 || rect[3] < 2) return;
    const x = rect[0] + rect[2] / 2;
    const y = rect[1] + rect[3] / 2;
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  } catch {
    // A stale tab or unsupported page fails closed; no retry loop is allowed.
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
    checkingNavigation.delete(tabId);
  }
}

async function pollCommand() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    if (!await startSession()) return;
    const command = await nextCommand();
    if (command === "open_wells") await openOrReuseWells();
    if (command === "capture_wells_activity" && Number.isInteger(wellsTabId)) {
      await chrome.tabs.sendMessage(wellsTabId, { command: "capture_wells_activity" }).catch(() => {});
    }
  } finally { pollInFlight = false; }
}

// Chrome permits a minimum 30-second repeating MV3 alarm. It is the supported
// invisible wake path while no Wells tab is open; once Wells is open, its page
// heartbeat calls pollCommand immediately.
chrome.alarms.create(POLL_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === POLL_ALARM) void pollCommand(); });
chrome.runtime.onStartup.addListener(() => void pollCommand());
chrome.runtime.onInstalled.addListener(() => void pollCommand());

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== "object" || sender.id !== chrome.runtime.id) return;
  const tabId = Number.isInteger(sender.tab?.id) ? sender.tab.id : null;
  if (message.event === "collector_page_ready") { void pollCommand(); return; }
  if (message.event === "checking_navigation_required" && tabId !== null) {
    wellsTabId = tabId;
    void navigateChecking(tabId);
    return;
  }
  if (!session || tabId === null) return;
  if (message.event === "activity_capture" && tabId === wellsTabId && message.candidate) {
    void send("/v1/activity", message.candidate);
    return;
  }
  if (!['auth_required', 'authenticated_page'].includes(message.event)) return;
  wellsTabId = tabId;
  void send("/v1/progress", { version: 1, event: message.event, tabId }).then(sent => {
    if (sent) void pollCommand();
  });
});
