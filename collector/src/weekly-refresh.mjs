import path from "node:path";
import { defaultPrivateRoot, assertRegularFile } from "./private-paths.mjs";
import { readFile } from "node:fs/promises";
import { reconcileWellsOverlap } from "./wells-normalize.mjs";
import { CollectionError, requireEvidence as check } from "./errors.mjs";

// The bridge reports these as fixed, non-financial reader outcomes.  They are
// terminal for the active Wells/Chase source and must not leave the weekly run
// waiting for its overall timeout. Authentication remains a separate pause.
export function terminalCaptureProgressCode(source, event) {
  if (!['wells', 'chase_prime', 'chase_sapphire'].includes(source)) return null;
  const suffix = event === 'activity_capture_no_table' ? 'ACTIVITY_TABLE_MISSING'
    : event === 'activity_capture_page_limit' ? 'ACTIVITY_PAGE_LIMIT'
      : event === 'activity_capture_rejected' ? 'CAPTURE_REJECTED' : null;
  return suffix ? `${source.toUpperCase()}_${suffix}` : null;
}

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

// A transferred private workbook already owns the accepted transaction anchors.
// On its first run on another local machine there is deliberately no prior
// encrypted browser record to copy.  Let the existing workbook importer compare
// the fresh raw capture with those accepted anchors; do not demand a second,
// machine-specific anchor store before the first home refresh.
export function reconcileWeeklyWells(normalized, prior) {
  if (prior === null) {
    check(normalized.issues.length === 0, "WELLS_RECONCILIATION_BLOCKED", "Wells capture has an unresolved source check.");
    return { ...normalized, handoffBaseline: true };
  }
  const reconciled = reconcileWellsOverlap(normalized, prior);
  check(reconciled.overlapVerified && reconciled.issues.length === 0,
    "WELLS_RECONCILIATION_BLOCKED", "Wells capture does not match the prior accepted overlap.");
  return reconciled;
}

export {runWeeklyRefresh} from './weekly-runner.mjs';
