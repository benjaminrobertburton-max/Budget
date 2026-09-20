// Direct local page reader. It never opens, reloads, or controls browser tabs;
// a Wells document that is already open wakes this worker through its content
// script. It never reads/fills/submits credentials, cookies, form values, or
// browser storage. Activity is sent only after the local command requests it.
const LOCAL_BRIDGE = "http://127.0.0.1:43811";
let session = null;
let wellsTabId = null;
let connecting = null;

async function startSession() {
  if (session) return true;
  if (connecting) return connecting;
  connecting = (async () => {
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
    finally { connecting = null; }
  })();
  return connecting;
}

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

async function requestCapture(tabId) {
  if (!session || !Number.isInteger(tabId)) return;
  try {
    const response = await fetch(`${LOCAL_BRIDGE}/v1/command`, {
      headers: { "X-Budget-Collector-Session": session }, cache: "no-store",
    });
    if (response.status === 403) { session = null; return; }
    if (!response.ok) return;
    const command = await response.json();
    if (command?.version === 1 && command.command === "capture_wells_activity") {
      await chrome.tabs.sendMessage(tabId, { command: "capture_wells_activity" });
    }
  } catch { session = null; }
}

async function probe(tabId) {
  if (!Number.isInteger(tabId) || !await startSession()) return;
  wellsTabId = tabId;
  await chrome.tabs.sendMessage(tabId, { command: "probe_wells_state" }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== "object" || sender.id !== chrome.runtime.id) return;
  const tabId = Number.isInteger(sender.tab?.id) ? sender.tab.id : null;
  if (message.event === "collector_page_ready" && tabId !== null) { void probe(tabId); return; }
  if (!session || tabId === null || tabId !== wellsTabId) return;
  if (message.event === "activity_capture" && message.candidate) {
    void send("/v1/activity", message.candidate);
    return;
  }
  if (!['auth_required', 'authenticated_page'].includes(message.event)) return;
  void send("/v1/progress", { version: 1, event: message.event, tabId })
    .then(sent => { if (sent && message.event === "authenticated_page") void requestCapture(tabId); });
});
