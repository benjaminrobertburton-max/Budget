// The local Refresh command wakes this worker through Chrome's supported
// externally_connectable API. It opens at most one Wells tab per run and never
// reads/fills/submits credentials, cookies, form values, or browser storage.
const LOCAL_BRIDGE = "http://127.0.0.1:43811";
const WELLS_SIGN_ON = "https://connect.secure.wellsfargo.com/auth/login/present?origin=cob";
let session = null;
let wellsTabId = null;
let connecting = null;

async function startSession() {
  if (session) return true;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      const response = await fetch(`${LOCAL_BRIDGE}/v1/session`, { method: "POST",
        headers: { "Content-Type": "application/json" }, cache: "no-store" });
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
    const response = await fetch(`${LOCAL_BRIDGE}${path}`, { method: "POST",
      headers: { "Content-Type": "application/json", "X-Budget-Collector-Session": session },
      body: JSON.stringify(body), cache: "no-store" });
    if (response.status === 403) session = null;
    return response.ok;
  } catch { session = null; return false; }
}

async function nextCommand() {
  if (!session) return "none";
  try {
    const response = await fetch(`${LOCAL_BRIDGE}/v1/command`, {
      headers: { "X-Budget-Collector-Session": session }, cache: "no-store" });
    if (response.status === 403) { session = null; return "none"; }
    if (!response.ok) return "none";
    const command = await response.json();
    return command?.version === 1 ? command.command : "none";
  } catch { session = null; return "none"; }
}

async function probe(tabId) {
  if (!session || !Number.isInteger(tabId)) return;
  wellsTabId = tabId;
  await chrome.tabs.sendMessage(tabId, { command: "probe_wells_state" }).catch(() => {});
}

async function openOrReuseWells() {
  // Query only the established account-area pattern; never inspect a tab URL
  // or title, and never reuse an unrelated sign-out or marketing page.
  const existing = await chrome.tabs.query({ url: ["https://connect.secure.wellsfargo.com/accounts/*"] });
  const reusable = existing.find(tab => Number.isInteger(tab.id));
  if (reusable?.id) { await probe(reusable.id); return; }
  const tab = await chrome.tabs.create({ url: WELLS_SIGN_ON, active: true });
  if (Number.isInteger(tab.id)) wellsTabId = tab.id;
  await send("/v1/progress", { version: 1, event: "wells_opened", tabId: Number.isInteger(tab.id) ? tab.id : null });
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const senderUrl = typeof sender.url === "string" ? sender.url : "";
  if (!message || message.version !== 1 || message.action !== "start_refresh" || !/^http:\/\/127\.0\.0\.1:\d+\/v1\/trigger$/.test(senderUrl)
    || typeof message.token !== "string" || !/^[a-f0-9]{64}$/.test(message.token)) return;
  void (async () => {
    const ready = await startSession();
    const accepted = ready && await send("/v1/trigger", { version: 1, token: message.token });
    if (accepted && await nextCommand() === "open_wells") await openOrReuseWells();
    if (Number.isInteger(sender.tab?.id)) await chrome.tabs.remove(sender.tab.id).catch(() => {});
    sendResponse({ ok: accepted });
  })();
  return true;
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== "object" || sender.id !== chrome.runtime.id) return;
  const tabId = Number.isInteger(sender.tab?.id) ? sender.tab.id : null;
  if (message.event === "collector_page_ready" && tabId !== null) { void probe(tabId); return; }
  if (!session || tabId === null || tabId !== wellsTabId) return;
  if (message.event === "activity_capture" && message.candidate) { void send("/v1/activity", message.candidate); return; }
  if (!['auth_required', 'authenticated_page'].includes(message.event)) return;
  void send("/v1/progress", { version: 1, event: message.event, tabId })
    .then(sent => { if (sent && message.event === "authenticated_page") void nextCommand().then(command => {
      if (command === "capture_wells_activity") void chrome.tabs.sendMessage(tabId, { command: "capture_wells_activity" }).catch(() => {});
    }); });
});
