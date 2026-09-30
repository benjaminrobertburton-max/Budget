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
import { CollectionError, requireEvidence as check, safeIssue } from "./errors.mjs";
import { createWeeklySequence, WEEKLY_SOURCES } from "./weekly-sequence.mjs";
import { weeklyPreflight } from './weekly-preflight.mjs';
import { readWeeklySession, saveWeeklySession, clearWeeklySession } from "./weekly-session.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const sourceCommand = Object.freeze({
  wells: "open_wells", chase_prime: "open_chase_prime", chase_sapphire: "open_chase_sapphire",
  citi: "capture_citi_activity", paypal: "capture_paypal_financing", wealthfront: "capture_wealthfront_cash",
});

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

function openWorkbook(filename, spawnProcess = spawn) {
  // Shell open receives a locally validated output path only. It does not pass
  // arguments to a workbook or enable macros.
  const child = spawnProcess("cmd.exe", ["/d", "/s", "/c", "start", "", filename], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
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

export async function runWeeklyRefresh({ configFile, signal, timeoutMs = 12 * 60 * 1000, onStatus = () => {}, startBridge = startChromeBridge,
  importWorkbook, openResult = openWorkbook, preflight = weeklyPreflight, openStore = openPrivateEvidenceStore } = {}) {
  check(typeof configFile === "string" && path.isAbsolute(configFile), "PRIVATE_CONFIG_REQUIRED", "Choose the private collector configuration file before refreshing.");
  check(Number.isInteger(timeoutMs) && timeoutMs >= 60_000 && timeoutMs <= 30 * 60 * 1000, "INVALID_TIMEOUT", "The local refresh timeout is invalid.");
  const context = await preflight(configFile);
  const {privateRoot,sessionKey,config}=context;
  let resumed, store;
  try {
    store = await openStore({ root: privateRoot, repositoryRoot, protector:context.protector });
    try { resumed = await readWeeklySession({ privateRoot, configFile:sessionKey, sources:WEEKLY_SOURCES, details:true }); }
    catch {
      // One-time migration of the original source-name-only checkpoint. It
      // cannot be trusted until the corresponding bound evidence revalidates.
      resumed = await readWeeklySession({privateRoot,configFile,sources:WEEKLY_SOURCES,details:true});
      check(resumed.references===null,'WEEKLY_SESSION_INVALID','Checkpoint belongs to a different workbook or configuration.');
    }
    const references=resumed.references??{};
    for(const source of resumed.completed){
      const bank=source.startsWith('chase_')?'chase':source;
      const product=source==='chase_prime'?'prime_visa':source==='chase_sapphire'?'sapphire_preferred':source==='citi'?'aadvantage':null;
      const saved=references[source]?{reference:references[source],record:await store.open(references[source])}
        :source==='paypal'?await store.latestPaypalCapture():source==='wealthfront'?await store.latestWealthfrontCapture(config.wealthfront.accountId)
        :await store.latestCapture({source:bank,product,suffix:config.bindings[source]});
      check(saved&&saved.record.source===bank,'RESUME_EVIDENCE_MISSING','A completed source has no readable bound evidence.');
      const c=saved.record.payload;
      if(source==='wells'){
        check(c.source?.accountSuffix===config.bindings.wells,'RESUME_IDENTITY_MISMATCH','Saved Wells identity differs.');
        const n=normalizeWellsActivity(c,saved.reference,saved.record.capturedAt,{hasPriorAnchor:true});
        check(n.issues.every(i=>i==='pagination_anchor_required'),'RESUME_EVIDENCE_INVALID','Saved Wells evidence needs review.');
      }else if(bank==='chase'){
        const n=normalizeChaseActivity(c,saved.reference);
        check(n.identity?.product===product&&n.identity?.suffix===config.bindings[source]&&n.issues.length===0,'RESUME_EVIDENCE_INVALID','Saved Chase evidence needs review.');
      }else if(source==='citi')check(normalizeCitiActivity(c,saved.reference,{acceptedAnchors:context.workbookAnchors?.citi}).coverageVerified,'RESUME_EVIDENCE_INVALID','Saved Citi evidence needs review.');
      else if(source==='paypal')check(normalizePaypalFinancing(c).coverageVerified,'RESUME_EVIDENCE_INVALID','Saved financing evidence needs review.');
      else check(c.accountId===config.wealthfront.accountId&&normalizeWealthfrontCash(c).activityCaptured,'RESUME_EVIDENCE_INVALID','Saved cash evidence needs review.');
      references[source]=saved.reference;
    }
    resumed.references=references;
    await saveWeeklySession({privateRoot,configFile:sessionKey,sources:WEEKLY_SOURCES,...resumed});
  }catch(error){await context.release();throw error;}
  const sequence = createWeeklySequence(undefined, resumed.completed);
  const references={...resumed.references},chasePlans=new Map();
  let bridge, settle, timer, sourceTimer, abortHandler, active=true, inFlight=Promise.resolve();
  const completion = new Promise((resolve, reject) => { settle = { resolve, reject }; });
  // Attach rejection handling before Chrome can return a very fast failure.
  completion.catch(()=>{});
  const watchSource=()=>{
    clearTimeout(sourceTimer);
    const source=sequence.current();
    if(source)sourceTimer=setTimeout(()=>block(source,'SOURCE_RESPONSE_TIMEOUT'),90_000);
  };
  const next = async (source,reference) => {
    if(!active)return;
    references[source]=reference;
    try { await saveWeeklySession({ privateRoot, configFile:sessionKey, sources:WEEKLY_SOURCES,
      completed:[...sequence.status().completed,source],references }); }
    catch { return block(source, "WEEKLY_SESSION_SAVE_FAILED"); }
    const following = sequence.complete(source);
    watchSource();
    onStatus({ state: sequence.status().state, source, next: following });
    if (following) bridge.queue(sourceCommand[following]); else settle.resolve();
  };
  const block = (source, code = "SOURCE_CAPTURE_BLOCKED") => {
    if(!active||sequence.current()!==source)return;
    sequence.block(source); onStatus({ state: "blocked", source, code });
    active=false;settle.reject(new CollectionError(code,'The active source requires review; no workbook import started.'));
  };
  const serial=handler=>candidate=>{
    const expected=sequence.current();
    const result=inFlight.then(()=>active&&sequence.current()===expected?handler(candidate):undefined)
      .catch(error=>block(expected,error instanceof CollectionError?error.code:'SOURCE_CAPTURE_FAILED'));
    inFlight=result;return result;
  };
  const capturedAt = () => new Date().toISOString();
  try {
    if(sequence.current())try { bridge = await startBridge({
      nextCommand: sourceCommand[sequence.current()],
      captureAfterAuth: 'wells',
      onProgress: value => {
        const source = sequence.current();
        onStatus({ state: "collecting", source, event: value.event });
        const owner=value.source;
        if(owner&&owner!==(source?.startsWith('chase_')?'chase':source))return;
        if(['auth_required','chase_auth_required','activity_capture_auth_required'].includes(value.event))clearTimeout(sourceTimer);
        const code = value.event==='extension_build_mismatch'?'EXTENSION_BUILD_MISMATCH'
          :['chase_delivery_failed','chase_evidence_save_failed','paypal_capture_rejected','wealthfront_capture_rejected','citi_capture_rejected',
            'wells_tab_ambiguous','chase_tab_ambiguous','citi_tab_ambiguous','paypal_tab_ambiguous','wealthfront_tab_ambiguous'].includes(value.event)
            ?value.event.toUpperCase():terminalCaptureProgressCode(source, value.event);
        if (code) block(source, code);
      },
      onActivityCapture: serial(async candidate => {
        if (sequence.current() !== "wells") return;
        const prior = await store.latestPayload({ source: "wells", kind: "wells_normalized_activity" });
        const at = capturedAt(); let reference, normalized;
        try { reference = await store.save({ source: "wells", capturedAt: at, payload: candidate }); }
        catch { return block("wells", "WELLS_EVIDENCE_SAVE_FAILED"); }
        try { normalized = normalizeWellsActivity(candidate, reference, at, { hasPriorAnchor: prior !== null }); }
        catch { return block("wells", "WELLS_NORMALIZATION_REJECTED"); }
        try { reconcileWeeklyWells(normalized, prior); }
        catch { return block("wells", "WELLS_RECONCILIATION_BLOCKED"); }
        // Keep the raw source candidate as the newest evidence. The direct
        // importer—not this coordinator—reconciles it with the accepted ledger
        // inside the transferred workbook and decides which rows can publish.
        if (prior !== null) {
          try { await store.save({ source: "wells", capturedAt: at, payload: reconcileWeeklyWells(normalized, prior) }); }
          catch { return block("wells", "WELLS_RECONCILED_SAVE_FAILED"); }
        }
        check(candidate.source.accountSuffix===config.bindings.wells,'WELLS_IDENTITY_BLOCKED','Wells identity does not match the private binding.');
        await next("wells",reference);
      }),
      onChaseActivityCapture: serial(async candidate => {
        const source = sequence.current();
        if (!['chase_prime', 'chase_sapphire'].includes(source)) return;
        const packetSource=candidate.source?.chase?.product==='prime_visa'?'chase_prime':'chase_sapphire';
        if(packetSource!==source&&sequence.status().completed.includes(packetSource)
          &&candidate.source.accountSuffix===config.bindings[packetSource])return;
        const at = capturedAt(); const reference = await store.save({ source: "chase", capturedAt: at, payload: candidate });
        const normalized = normalizeChaseActivity(candidate, reference);
        const expectedProduct = source === 'chase_prime' ? 'prime_visa' : 'sapphire_preferred';
        if (normalized.identity?.product !== expectedProduct || normalized.identity?.suffix!==config.bindings[source]) return block(source, "CHASE_IDENTITY_BLOCKED");
        if(!chasePlans.has(source)){
          const prior=context.workbookAnchors
            ?context.workbookAnchors[source]
            :(await store.latestPayload({source:'chase',kind:'chase_anchor_snapshot',identity:normalized.identity}))?.normalized??null;
          chasePlans.set(source,createChaseAnchorSession(prior,{expectedProduct}));
        }
        const decision = chasePlans.get(source)(normalized);
        await store.save({ source: "chase", capturedAt: at, payload: normalized });
        if (decision.action === "load_more") return { nextPageToken: candidate.source.pageToken };
        if (!['baseline_only', 'stop'].includes(decision.action)) return block(source, "CHASE_RECONCILIATION_BLOCKED");
        // Do not advance accepted anchors before the workbook commits.
        await next(source,reference);
      }),
      onCitiActivityCapture: serial(async candidate => {
        if (sequence.current() !== "citi") return;
        const normalized = normalizeCitiActivity(candidate, "pending:citi",{acceptedAnchors:context.workbookAnchors?.citi});
        if (!normalized.coverageVerified) return block("citi", "CITI_RECONCILIATION_BLOCKED");
        const reference=await store.save({ source: "citi", capturedAt: capturedAt(), payload: candidate }); await next("citi",reference);
      }),
      onPaypalCapture: serial(async candidate => {
        if (sequence.current() !== "paypal") return;
        if (!normalizePaypalFinancing(candidate).coverageVerified) return block("paypal", "PAYPAL_RECONCILIATION_BLOCKED");
        const reference=await store.save({ source: "paypal", capturedAt: capturedAt(), payload: candidate }); await next("paypal",reference);
      }),
      onWealthfrontCapture: serial(async candidate => {
        if (sequence.current() !== "wealthfront") return;
        if (!normalizeWealthfrontCash(candidate).activityCaptured) return block("wealthfront", "WEALTHFRONT_RECONCILIATION_BLOCKED");
        const reference=await store.save({ source: "wealthfront", capturedAt: capturedAt(), payload: candidate }); await next("wealthfront",reference);
      }),
    }); }
    catch { throw new CollectionError("LOCAL_BRIDGE_UNAVAILABLE", "The local collector bridge could not start."); }
    onStatus({ state: "collecting", source: sequence.current() });
    watchSource();
    if(sequence.current()){
      abortHandler=()=>{active=false;sequence.cancel();settle.reject(new CollectionError('REFRESH_CANCELLED','Refresh cancelled; completed sources were saved.'));};
      signal?.addEventListener('abort',abortHandler,{once:true});
      if(signal?.aborted)abortHandler();
      timer=setTimeout(()=>{active=false;sequence.cancel();settle.reject(new CollectionError('REFRESH_TIMEOUT','Refresh timed out; completed sources were saved.'));},timeoutMs);
      await completion;
    }
    clearTimeout(timer);clearTimeout(sourceTimer);if(abortHandler)signal?.removeEventListener('abort',abortHandler);
    active=false;await inFlight;
    sequence.beginImport(); onStatus({ state: "importing" });
    await context.assertUnchanged?.();
    const apply = importWorkbook ?? (async file => (await import("../../work/collector_workbook.mjs")).runWorkbookIntake(file, { apply: true, evidenceReferences:references }));
    const result = await apply(configFile,{evidenceReferences:references});
    await clearWeeklySession({ privateRoot });
    sequence.imported(); onStatus({ state: "complete" });
    try{openResult(result.output);}catch{onStatus({state:'complete',code:'PREVIEW_OPEN_FAILED'});}
    return { status: "complete", output: result.output, backup: result.backup, completedSources: sequence.status().completed };
  } catch (error) {
    if (sequence.status().state === "importing") sequence.importBlocked();
    const issue = safeIssue(null, error); onStatus({ state: sequence.status().state, code: issue.code });
    throw error;
  } finally {
    active=false;clearTimeout(timer);clearTimeout(sourceTimer);if(abortHandler)signal?.removeEventListener('abort',abortHandler);
    await inFlight.catch(()=>{});
    if (bridge) await bridge.close().catch(() => {});
    await context.release();
  }
}
