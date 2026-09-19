// This short-lived local extension page opens a runtime port, which reliably
// wakes the service worker before requesting a local collector command. It
// reads no page/account data and closes itself promptly.
const port = chrome.runtime.connect({ name: "collector-wake" });
port.postMessage({ event: "collector_wake" });
setTimeout(() => chrome.tabs.getCurrent(tab => { if (Number.isInteger(tab?.id)) void chrome.tabs.remove(tab.id); }), 750);
