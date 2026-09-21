import { withDisposableTestRun } from "./disposable-run.mjs";
import { startChromeBridge } from "./chrome-bridge.mjs";
import { activitySummary, validateActivityCandidate } from "./activity-probe.mjs";
import { requireEvidence as check } from "./errors.mjs";

// Temporary collector evidence only. We neither own nor delete ordinary Chrome.
// No home store, workbook writes, source previews or financial console output.
export async function runChaseWorkTest({ repositoryRoot, parent, protector,
  port = 43811, durationMs = 10 * 60 * 1000, signal, target = "overview", captureWindowMs = 35000,
  onReady = () => {}, onStatus = () => {} } = {}) {
  check(Number.isInteger(durationMs) && durationMs > 0 && durationMs <= 10 * 60 * 1000,
    "INVALID_TEST_RUN", "The work test requires a bounded duration.");
  check(["overview", "prime_visa", "sapphire_preferred"].includes(target),
    "INVALID_TEST_RUN", "The work test requires a recognized Chase target.");
  check(Number.isInteger(captureWindowMs) && captureWindowMs > 0 && captureWindowMs <= 60000,
    "INVALID_TEST_RUN", "The capture response window must be bounded.");
  const command = target === "overview" ? "open_chase"
    : target === "prime_visa" ? "open_chase_prime" : "open_chase_sapphire";
  return withDisposableTestRun({ repositoryRoot, parent, protector }, async scope => {
    // Encryption must work before a bank-opening command is exposed.
    await scope.saveEvidence({ version: 1, kind: "work_chase_preflight", financialData: false });
    let finish;
    const done = new Promise(resolve => { finish = resolve; });
    let terminal = null;
    let capturing = false;
    let bridge;
    let summary = null;
    let captureTimer = null;
    let lastEmptyOutcome = null;
    const stop = reason => { if (terminal === null) { terminal = reason; finish(); } };
    const abort = () => stop("cancelled");
    const timer = setTimeout(() => stop("timeout"), durationMs);
    const report = event => { try { onStatus(event); } catch { stop("status_failed"); } };
    scope.registerClose(async () => {
      clearTimeout(timer);
      clearTimeout(captureTimer);
      signal?.removeEventListener("abort", abort);
      if (bridge) await bridge.close();
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) stop("cancelled");
    if (terminal === null) {
      bridge = await startChromeBridge({
        port, nextCommand: command, captureAfterAuth: target === "overview",
        onProgress: ({ event }) => {
          report(event);
          // Each frame can reply independently. An empty outer shell is not
          // evidence that a later transaction frame has no data. Keep the run
          // open through the reader's bounded 30s render wait plus delivery grace.
          if (["activity_capture_no_table", "activity_capture_page_limit",
            "activity_capture_auth_required"].includes(event)) lastEmptyOutcome = event;
          if (["chase_capture_dispatched", "activity_capture_no_table",
            "activity_capture_page_limit", "activity_capture_auth_required"].includes(event)
            && captureTimer === null && terminal === null) {
            captureTimer = setTimeout(() => stop(lastEmptyOutcome ?? "capture_incomplete"), captureWindowMs);
          }
          if (["chase_delivery_failed", "chase_evidence_save_failed"].includes(event)) stop(event);
        },
        onChaseActivityCapture: async candidate => {
          check(terminal === null && !capturing, "TEST_RUN_CLOSED", "The work capture is no longer available.");
          capturing = true;
          try {
            validateActivityCandidate(candidate);
            await scope.saveEvidence({ version: 1, kind: "work_chase_candidate", candidate });
            if (terminal === null) {
              summary = activitySummary(candidate);
              stop("candidate_captured");
            }
          } catch {
            stop("capture_failed");
            throw new Error("WORK_CAPTURE_FAILED");
          }
        },
      });
      await onReady({ port: bridge.port });
    }
    await done;
    // The scope drains registered writes, then closes/drains the bridge under
    // its bounded close timeout BEFORE deletion. Terminal callbacks reject new
    // captures; a stuck HTTP shutdown preserves files and reports cleanup blocked.
    return { status: terminal, summary, workbookReady: false };
  });
}
