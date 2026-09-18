import { fileURLToPath } from "node:url";
import { withDisposableTestRun } from "./disposable-run.mjs";
import { openOwnedTestBrowser } from "./owned-browser.mjs";
import { openFixtureBrowser } from "./fixture-browser.mjs";
import { startPilotPanel } from "./pilot-panel.mjs";
import { createPilotController } from "./pilot-controller.mjs";
import { installPilotNetworkPolicy, isWellsDocument, WELLS_SIGN_ON } from "./pilot-policy.mjs";
import { inspectPageStructure } from "./page-structure.mjs";
import { requireEvidence as check } from "./errors.mjs";
import { fictionalPilotPage } from "../fixtures/pilot-bank.mjs";

// Opens controls, NOT a bank. Only an acknowledged local Start action navigates.
// No click/fill/submit/cookies/storage APIs are exposed to the pilot controller.
export async function startPilotInScope(scope, { mode, headless = false, signal,
  durationMs = 20 * 60 * 1000 } = {}) {
  check(["wells", "fictional"].includes(mode) && typeof headless === "boolean"
    && (mode !== "wells" || headless === false) && Number.isInteger(durationMs)
    && durationMs > 0 && durationMs <= 20 * 60 * 1000,
  "INVALID_PILOT", "The Wells pilot must be visible, disposable, and time bounded.");
  // Verify encryption BEFORE any live destination can be opened.
  await scope.saveEvidence({ version: 1, kind: "pilot_preflight", mode, financialData: false });
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  let context;
  let panel;
  let controlPage;
  let bankPage;
  let expired;
  let outlineSequence = 0;
  const pilot = createPilotController({ mode,
    stopRun: () => finish(),
    async openBank(abort) {
      check(!abort.aborted, "PILOT_STOPPED", "Pilot stopped.");
      bankPage = await context.newPage();
      bankPage.on("close", () => pilot.stop("window_closed"));
      check(!abort.aborted, "PILOT_STOPPED", "Pilot stopped.");
      await bankPage.goto(mode === "wells" ? WELLS_SIGN_ON : `${panel.address}fictional-bank`, { waitUntil: "domcontentloaded", timeout: 15000 });
      if (!abort.aborted) await bankPage.bringToFront();
    },
    async inspectBank(abort) {
      check(!abort.aborted, "PILOT_STOPPED", "Pilot stopped.");
      const candidates = context.pages().filter(page => page !== controlPage && !page.isClosed()
        && (mode === "wells" ? isWellsDocument(page.url()) : page.url() === `${panel.address}fictional-bank`));
      check(candidates.length === 1, "PILOT_PAGE_AMBIGUOUS", "Keep exactly one permitted account page open before inspection.");
      const page = candidates[0];
      const before = page.url(); // Private in memory, never returned or persisted.
      const outline = await inspectPageStructure(page);
      check(!abort.aborted && page.url() === before, "PILOT_PAGE_CHANGED", "The page changed while being inspected.");
      return outline;
    },
    async saveOutline(outline, abort) {
      check(!abort.aborted, "PILOT_STOPPED", "Pilot stopped.");
      await scope.saveEvidence({ version: 1, kind: "pilot_structure", sequence: ++outlineSequence, outline });
    },
  });
  const interrupt = () => pilot.stop("interrupted");
  // Clear timers/listeners even when startup fails, before closing owned resources.
  scope.registerClose(async () => { clearTimeout(expired); signal?.removeEventListener("abort", interrupt); });
  panel = await startPilotPanel({ controller: pilot, mode, fictionalPage: mode === "fictional" ? fictionalPilotPage : null });
  scope.registerClose(async () => { await panel.close(); await pilot.settled(); });
  if (mode === "wells") {
    ({ context } = await openOwnedTestBrowser(scope, { headless: false,
      configure: ctx => installPilotNetworkPolicy(ctx, { panelAddress: panel.address, onBlocked: pilot.noteBlockedRequest }) }));
  } else {
    ({ context } = await openFixtureBrowser(scope, { origin: panel.origin, headless }));
  }
  context.on("close", () => pilot.stop("window_closed"));
  controlPage = context.pages()[0] ?? await context.newPage();
  controlPage.on("close", () => pilot.stop("window_closed"));
  await controlPage.goto(panel.address, { waitUntil: "domcontentloaded" });
  expired = setTimeout(() => pilot.stop("session_expired"), durationMs);
  signal?.addEventListener("abort", interrupt, { once: true });
  if (signal?.aborted) interrupt();
  // Raw browser handles are returned only to the in-process harness, never the panel/CLI.
  return { done, pilot, controlPage, context, panel, stop: () => pilot.stop() };
}

async function runVisiblePilot(mode) {
  const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    return await withDisposableTestRun({ repositoryRoot }, async scope => {
      const run = await startPilotInScope(scope, { mode, signal: controller.signal });
      await run.done;
      const state = run.pilot.state();
      return { status: "stopped", inspectionCount: state.inspectionCount, reason: state.reason,
        coverageVerified: false, workbookUpdated: false };
    });
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}

export const runWellsPilot = () => runVisiblePilot("wells");
export const runFictionalPilot = () => runVisiblePilot("fictional");
