// This short-lived local extension page exists solely to wake the service worker
// when a local Tuesday launcher begins. It reads no page/account data.
chrome.runtime.sendMessage({ event: "collector_wake" }, () => {
  chrome.tabs.getCurrent(tab => { if (Number.isInteger(tab?.id)) void chrome.tabs.remove(tab.id); });
});
