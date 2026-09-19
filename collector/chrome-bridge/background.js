// This bridge deliberately never reads, fills, submits, stores, or transmits
// credentials, cookies, form values, page text, balances, or transactions.
// It only opens Wells after a user clicks the extension action and sends bounded
// non-financial state to the local collector process.
const LOCAL_BRIDGE = "http://127.0.0.1:43811";
const WELLS_SIGN_ON = "https://connect.secure.wellsfargo.com/auth/login/present?origin=cob";
let session = null;

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

chrome.action.onClicked.addListener(async () => {
  try {
    await startSession();
    const tab = await chrome.tabs.create({ url: WELLS_SIGN_ON, active: true });
    await send("/v1/progress", {
      method: "POST",
      body: JSON.stringify({ version: 1, event: "wells_opened", tabId: Number.isInteger(tab.id) ? tab.id : null }),
    });
    await chrome.action.setBadgeText({ text: "AUTH" });
  } catch {
    session = null;
    await chrome.action.setBadgeText({ text: "OFF" });
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!session || !message || typeof message !== "object" || sender.id !== chrome.runtime.id) return;
  const event = message.event;
  if (!["auth_required", "authenticated_page"].includes(event)) return;
  // A tab ID is not financial evidence; it allows the local bridge to correlate
  // non-sensitive progress only. It is kept in memory and never written to disk.
  const tabId = Number.isInteger(sender.tab?.id) ? sender.tab.id : null;
  void send("/v1/progress", { method: "POST", body: JSON.stringify({ version: 1, event, tabId }) });
  void chrome.action.setBadgeText({ text: event === "auth_required" ? "AUTH" : "READY" });
});
