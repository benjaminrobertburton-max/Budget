// Do not inspect input values, body text, browser storage, URLs, cookies, or
// transaction content. This script only tells the local bridge whether a visible
// authentication control remains on the page.
(() => {
  let previous = null;
  const visible = node => node.getClientRects().length > 0
    && getComputedStyle(node).visibility !== "hidden" && getComputedStyle(node).display !== "none";
  const currentState = () => {
    const controls = [...document.querySelectorAll("input")];
    return controls.some(input => visible(input) && !input.disabled
      && (input.type === "password" || /^(username|current-password|new-password|one-time-code)$/.test(input.autocomplete)))
      ? "auth_required" : "authenticated_page";
  };
  const report = () => {
    const event = currentState();
    if (event === previous) return;
    previous = event;
    chrome.runtime.sendMessage({ event });
  };
  report();
  new MutationObserver(report).observe(document.documentElement, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["hidden", "aria-hidden", "style", "disabled", "autocomplete", "type"] });
})();
