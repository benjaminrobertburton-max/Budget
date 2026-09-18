import { requireEvidence as check } from "./errors.mjs";
import { validatePageStructure } from "./page-structure.mjs";

export function createPilotController({ mode, openBank, inspectBank, saveOutline, stopRun,
  operationTimeoutMs = 20000 } = {}) {
  check(["wells", "fictional"].includes(mode) && [openBank, inspectBank, saveOutline, stopRun].every(fn => typeof fn === "function")
    && Number.isInteger(operationTimeoutMs) && operationTimeoutMs > 0 && operationTimeoutMs <= 20000,
  "INVALID_PILOT", "Pilot controls require an explicit bounded read-only configuration.");
  let status = "not_started";
  let reason = "none";
  let inspectionCount = 0;
  let blockedRequests = 0;
  let lastOutline = null;
  let busy = false;
  let current = Promise.resolve();
  const abort = new AbortController();
  const state = () => ({ version: 1, mode, status, reason, inspectionCount, blockedRequests,
    lastOutline: lastOutline ? { ...lastOutline } : null,
    authenticationVerified: false, coverageVerified: false, workbookUpdated: false });
  function stop(why = "user_stopped") {
    if (status === "stopping") return;
    status = "stopping";
    reason = ["user_stopped", "window_closed", "session_expired", "interrupted", "operation_timeout"].includes(why) ? why : "interrupted";
    abort.abort();
    stopRun();
  }
  function launch(task) {
    busy = true;
    current = (async () => {
      let timer;
      try {
        await Promise.race([task(), new Promise((_, reject) => {
          timer = setTimeout(() => { stop("operation_timeout"); reject(new Error("Timeout")); }, operationTimeoutMs);
        })]);
      } catch {
        if (status !== "stopping") { status = "blocked"; reason = "inspection_or_navigation_failed"; }
      } finally { clearTimeout(timer); busy = false; }
    })();
  }
  function action(value) {
    const allowedKeys = value?.action === "start" ? ["action", "acknowledged"] : ["action"];
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).sort().join(",") !== allowedKeys.sort().join(",")
      || !["start", "inspect", "stop"].includes(value.action)) return false;
    if (value.action === "stop") { stop(); return true; }
    if (busy || status === "stopping" || status === "blocked") return false;
    if (value.action === "start") {
      if (value.acknowledged !== true || status !== "not_started") return false;
      status = "opening";
      launch(async () => { await openBank(abort.signal); if (!abort.signal.aborted) status = "manual_navigation"; });
      return true;
    }
    if (!["manual_navigation", "outline_saved"].includes(status) || inspectionCount >= 12) return false;
    status = "inspecting";
    launch(async () => {
      const outline = validatePageStructure(await inspectBank(abort.signal));
      if (abort.signal.aborted) return;
      await saveOutline(outline, abort.signal);
      if (abort.signal.aborted) return;
      lastOutline = { elements: outline.nodes.length,
        tables: outline.nodes.filter(node => node.tag === "table" || node.role === "table" || node.role === "grid").length,
        hasFrames: outline.hasFrames, hasShadowRoots: outline.hasShadowRoots,
        redactedSubtrees: outline.redactedSubtrees, truncated: outline.truncated };
      inspectionCount += 1;
      status = "outline_saved";
    });
    return true;
  }
  return Object.freeze({ state, action, stop, settled: () => current,
    noteBlockedRequest() { blockedRequests = Math.min(9999, blockedRequests + 1); } });
}
