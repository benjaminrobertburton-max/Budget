import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startChromeBridge } from "./chrome-bridge.mjs";
import { defaultPrivateRoot, assertPrivateDirectory, assertRegularFile } from "./private-paths.mjs";
import { readFile } from "node:fs/promises";
import { openPrivateEvidenceStore } from "./private-evidence-store.mjs";
import { normalizeWellsActivity, reconcileWellsOverlap } from "./wells-normalize.mjs";
import { normalizeChaseActivity } from "./chase-normalize.mjs";
import { createChaseAnchorSession } from "./chase-overlap.mjs";
import { normalizeCitiActivity } from "./citi-normalize.mjs";
import { normalizePaypalFinancing } from "./paypal-normalize.mjs";
import { normalizeWealthfrontCash } from "./wealthfront-normalize.mjs";
import { mapWellsToLedgerStage } from "./workbook-ledger-map.mjs";
import { CollectionError, requireEvidence as check, safeIssue } from "./errors.mjs";
import { createWeeklySequence } from "./weekly-sequence.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const sourceCommand = Object.freeze({
  wells: "open_wells", chase_prime: "open_chase_prime", chase_sapphire: "open_chase_sapphire",
  citi: "capture_citi_activity", paypal: "capture_paypal_financing", wealthfront: "capture_wealthfront_cash",
});

export function normalizeWeeklyLaunchConfig(value) {
  check(value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 1 && typeof value.workbookConfig === "string" && path.isAbsolute(value.workbookConfig),
  "INVALID_LAUNCH_CONFIG", "The local weekly-refresh configuration is invalid.");
  return { workbookConfig: path.resolve(value.workbookConfig) };
}

export async function readWeeklyLaunchConfig({ localAppData = process.env.LOCALAPPDATA } = {}) {
  const root = defaultPrivateRoot();
  check(typeof localAppData === "string" && path.isAbsolute(localAppData) && path.resolve(localAppData) === path.dirname(root),
    "PRIVATE_CONFIG_REQUIRED", "The local weekly-refresh configuration is unavailable.");
  const filename = path.join(root, "weekly-refresh.json");
  try {
    await assertRegularFile(filename, 4_000);
    return normalizeWeeklyLaunchConfig(JSON.parse(await readFile(filename, "utf8")));
  } catch (error) {
    if (error instanceof CollectionError) throw error;
    check(false, "PRIVATE_CONFIG_REQUIRED", "The local weekly-refresh configuration is unavailable.");
  }
}

function openWorkbook(filename, spawnProcess = spawn) {
  // Shell open receives a locally validated output path only. It does not pass
  // arguments to a workbook or enable macros.
  const child = spawnProcess("cmd.exe", ["/d", "/s", "/c", "start", "", filename], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

function timeout(ms, onTimeout) {
  return new Promise((_, reject) => setTimeout(() => { onTimeout(); reject(Object.assign(new Error("REFRESH_TIMEOUT"), { code: "REFRESH_TIMEOUT" })); }, ms));
}

export async function runWeeklyRefresh({ configFile, signal, timeoutMs = 12 * 60 * 1000, onStatus = () => {}, startBridge = startChromeBridge,
  importWorkbook, openResult = openWorkbook } = {}) {
  check(typeof configFile === "string" && path.isAbsolute(configFile), "PRIVATE_CONFIG_REQUIRED", "Choose the private collector configuration file before refreshing.");
  check(Number.isInteger(timeoutMs) && timeoutMs >= 60_000 && timeoutMs <= 30 * 60 * 1000, "INVALID_TIMEOUT", "The local refresh timeout is invalid.");
  const privateRoot = defaultPrivateRoot();
  await assertPrivateDirectory(privateRoot, { repositoryRoot });
  const sequence = createWeeklySequence();
  const store = await openPrivateEvidenceStore({ root: privateRoot, repositoryRoot });
  let bridge, settle;
  const completion = new Promise((resolve, reject) => { settle = { resolve, reject }; });
  const next = source => {
    const following = sequence.complete(source);
    onStatus({ state: sequence.status().state, source, next: following });
    if (following) bridge.queue(sourceCommand[following]); else settle.resolve();
  };
  const block = (source, code = "SOURCE_CAPTURE_BLOCKED") => {
    sequence.block(source); onStatus({ state: "blocked", source, code });
    settle.reject(Object.assign(new Error(code), { code }));
  };
  const capturedAt = () => new Date().toISOString();
  try {
    bridge = await startBridge({
      nextCommand: sourceCommand.wells,
      captureAfterAuth: true,
      onProgress: value => onStatus({ state: "collecting", source: sequence.current(), event: value.event }),
      onActivityCapture: async candidate => {
        if (sequence.current() !== "wells") return;
        const prior = await store.latestPayload({ source: "wells", kind: "wells_normalized_activity" });
        const at = capturedAt(); const reference = await store.save({ source: "wells", capturedAt: at, payload: candidate });
        const normalized = normalizeWellsActivity(candidate, reference, at, { hasPriorAnchor: prior !== null });
        const reconciled = prior === null ? normalized : reconcileWellsOverlap(normalized, prior);
        if (!reconciled.overlapVerified || reconciled.issues.length) return block("wells", "WELLS_RECONCILIATION_BLOCKED");
        await store.save({ source: "wells", capturedAt: at, payload: { ...reconciled, ledgerStage: mapWellsToLedgerStage(reconciled) } });
        next("wells");
      },
      onChaseActivityCapture: async candidate => {
        const source = sequence.current();
        if (!['chase_prime', 'chase_sapphire'].includes(source)) return;
        const at = capturedAt(); const reference = await store.save({ source: "chase", capturedAt: at, payload: candidate });
        const normalized = normalizeChaseActivity(candidate, reference);
        const expectedProduct = source === 'chase_prime' ? 'prime_visa' : 'sapphire_preferred';
        if (normalized.identity !== expectedProduct) return block(source, "CHASE_IDENTITY_BLOCKED");
        const prior = await store.latestPayload({ source: "chase", kind: "chase_anchor_snapshot", identity: normalized.identity });
        const decision = createChaseAnchorSession(prior?.normalized ?? null, { expectedProduct })(normalized);
        await store.save({ source: "chase", capturedAt: at, payload: normalized });
        if (decision.action === "load_more") return { nextPageToken: candidate.source.pageToken };
        if (!['baseline_only', 'stop'].includes(decision.action)) return block(source, "CHASE_RECONCILIATION_BLOCKED");
        await store.save({ source: "chase", capturedAt: at, payload: { kind: "chase_anchor_snapshot", identity: normalized.identity, normalized } });
        next(source);
      },
      onCitiActivityCapture: async candidate => {
        if (sequence.current() !== "citi") return;
        const normalized = normalizeCitiActivity(candidate, "pending:citi");
        if (!normalized.coverageVerified) return block("citi", "CITI_RECONCILIATION_BLOCKED");
        await store.save({ source: "citi", capturedAt: capturedAt(), payload: candidate }); next("citi");
      },
      onPaypalCapture: async candidate => {
        if (sequence.current() !== "paypal") return;
        if (!normalizePaypalFinancing(candidate).coverageVerified) return block("paypal", "PAYPAL_RECONCILIATION_BLOCKED");
        await store.save({ source: "paypal", capturedAt: capturedAt(), payload: candidate }); next("paypal");
      },
      onWealthfrontCapture: async candidate => {
        if (sequence.current() !== "wealthfront") return;
        if (!normalizeWealthfrontCash(candidate).activityCaptured) return block("wealthfront", "WEALTHFRONT_RECONCILIATION_BLOCKED");
        await store.save({ source: "wealthfront", capturedAt: capturedAt(), payload: candidate }); next("wealthfront");
      },
    });
    onStatus({ state: "collecting", source: sequence.current() });
    const abort = new Promise((_, reject) => signal?.addEventListener("abort", () => reject(Object.assign(new Error("REFRESH_CANCELLED"), { code: "REFRESH_CANCELLED" })), { once: true }));
    await Promise.race([completion, timeout(timeoutMs, () => sequence.cancel()), abort]);
    sequence.beginImport(); onStatus({ state: "importing" });
    const apply = importWorkbook ?? (async file => (await import("../../work/collector_workbook.mjs")).runWorkbookIntake(file, { apply: true }));
    const result = await apply(configFile);
    sequence.imported(); onStatus({ state: "complete" });
    openResult(result.output);
    return { status: "complete", output: result.output, backup: result.backup, completedSources: sequence.status().completed };
  } catch (error) {
    if (sequence.status().state === "importing") sequence.importBlocked();
    const issue = safeIssue(null, error); onStatus({ state: sequence.status().state, code: issue.code });
    throw error;
  } finally { if (bridge) await bridge.close().catch(() => {}); }
}
