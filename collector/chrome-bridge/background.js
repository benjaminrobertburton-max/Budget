// This bridge deliberately never reads, fills, submits, stores, or transmits
// credentials, cookies, form values, page text, balances, or transactions.
// A local collector can issue one bounded, read-only Wells-open command. The
// extension polls only while the local collector is running; it does not create
// a schedule, open Wells spontaneously, or make a financial decision.
const LOCAL_BRIDGE = "http://127.0.0.1:43811";
const WELLS_SIGN_ON = "https://connect.secure.wellsfargo.com/auth/login/present?origin=cob";
const POLL_ALARM = "budget-collector-local-command";
let session = null;
let pollInFlight = false;
let wellsTabId = null;

async function send(path, options = {}) {
  if (!session) return false;
  try {
    const response = await fetch(`${LOCAL_BRIDGE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Budget-Collector-Session": session,
        ...(options.headers ?? {}),
      },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function startSession() {
  const response = await fetch(`${LOCAL_BRIDGE}/v1/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("LOCAL_COLLECTOR_UNAVAILABLE");
  const body = await response.json();
  if (!body || typeof body.session !== "string" || !/^[a-f0-9]{64}$/.test(body.session)) {
    throw new Error("INVALID_LOCAL_COLLECTOR_SESSION");
  }
  session = body.session;
}

async function openWells() {
  const tab = await chrome.tabs.create({ url: WELLS_SIGN_ON, active: true });
  wellsTabId = Number.isInteger(tab.id) ? tab.id : null;
  await send("/v1/progress", {
    method: "POST",
    body: JSON.stringify({ version: 1, event: "wells_opened", tabId: Number.isInteger(tab.id) ? tab.id : null }),
  });
  await chrome.action.setBadgeText({ text: "AUTH" });
}

async function pollCommand() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    if (!session) await startSession();
    const response = await fetch(`${LOCAL_BRIDGE}/v1/command`, {
      headers: { "X-Budget-Collector-Session": session }, cache: "no-store",
    });
    if (response.status === 403) { session = null; return; }
    if (!response.ok) return;
    const command = await response.json();
    if (!command || command.version !== 1 || !["none", "open_wells", "capture_wells_activity"].includes(command.command)) return;
    if (command.command === "open_wells") await openWells();
    if (command.command === "capture_wells_activity" && Number.isInteger(wellsTabId)) {
      await chrome.tabs.sendMessage(wellsTabId, { command: "capture_wells_activity" });
    }
  } catch {
    // The normal state is no local collector. Never surface host/process details.
    session = null;
  } finally { pollInFlight = false; }
}

chrome.alarms.create(POLL_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === POLL_ALARM) void pollCommand(); });
chrome.runtime.onStartup.addListener(() => void pollCommand());
chrome.runtime.onInstalled.addListener(() => void pollCommand());

chrome.action.onClicked.addListener(async () => {
  try {
    await startSession();
    await openWells(); // Development fallback only; routine collection uses a local command.
  } catch {
    session = null;
    await chrome.action.setBadgeText({ text: "OFF" });
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!session || !message || typeof message !== "object" || sender.id !== chrome.runtime.id) return;
  const event = message.event;
  if (event === "activity_capture") {
    if (Number.isInteger(sender.tab?.id) && sender.tab.id === wellsTabId && message.candidate) {
      void send("/v1/activity", { method: "POST", body: JSON.stringify(message.candidate) });
    }
    return;
  }
  if (!["auth_required", "authenticated_page"].includes(event)) return;
  // A tab ID is not financial evidence; it allows the local bridge to correlate
  // non-sensitive progress only. It is kept in memory and never written to disk.
  const tabId = Number.isInteger(sender.tab?.id) ? sender.tab.id : null;
  if (event === "authenticated_page") wellsTabId = tabId;
  void send("/v1/progress", { method: "POST", body: JSON.stringify({ version: 1, event, tabId }) });
  void chrome.action.setBadgeText({ text: event === "auth_required" ? "AUTH" : "READY" });
});
