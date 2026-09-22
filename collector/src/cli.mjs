import { collectCandidate } from "./refresh.mjs";
import { makeRegistry, makeCaptures, fixtureAdapters, FIXTURE_NOW } from "../fixtures/synthetic.mjs";
import { storageDemo } from "./storage-demo.mjs";
import { safeIssue } from "./errors.mjs";
import { fileURLToPath } from "node:url";

const command = process.argv.slice(2);
if(command[0]==='workbook-import'){
  if(command.length!==2){console.error('Usage: workbook-import <absolute-private-config>');process.exitCode=1;}
  else{try{const {workbookImportCli}=await import('../../work/collector_workbook.mjs');process.exitCode=await workbookImportCli(command[1]);}
    catch{console.error('Workbook runtime unavailable; no workbook updated.');process.exitCode=1;}}
}
else if(command[0]==='workbook-intake'){
  if(command.length!==2){console.error('Usage: workbook-intake <absolute-private-config>');process.exitCode=1;}
  else{
  try{
    const {workbookIntakeCli}=await import('../../work/collector_workbook.mjs');
    process.exitCode=await workbookIntakeCli(command[1]);
  }catch{console.error('Collector workbook intake unavailable. Check the workbook runtime dependencies; no workbook was updated.');process.exitCode=1;}
  }
}
else if (command.length === 1 && command[0] === "collector-qc") {
  const { runCollectorQc, formatCollectorQc } = await import("./collector-qc.mjs");
  const report = await runCollectorQc({ repositoryRoot: fileURLToPath(new URL("../../", import.meta.url)) });
  console.log(formatCollectorQc(report));
  if (!report.ok) process.exitCode = 1;
}
else if (command.length === 1 && ["chase-work-test", "chase-prime-work-test", "chase-sapphire-work-test", "chase-pair-work-test"].includes(command[0])) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    const { runCollectorQc } = await import("./collector-qc.mjs");
    const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
    const qc = await runCollectorQc({ repositoryRoot });
    if (!qc.ok) throw new Error("COLLECTOR_QC_BLOCKED");
    const { runChaseWorkTest } = await import("./chase-work-test.mjs");
    console.log("Temporary Chase test: encrypted collector evidence is deleted after capture, cancellation or timeout.");
    console.log("Your ordinary Chrome profile, bank cookies and cache are NOT deleted. No workbook or home store is used.");
    console.log("Press Ctrl+C to cancel. The test expires after ten minutes; sign-in automation is not certified.");
    const target = command[0] === 'chase-pair-work-test'?'both':command[0] === "chase-prime-work-test" ? "prime_visa"
      : command[0] === "chase-sapphire-work-test" ? "sapphire_preferred" : "overview";
    const result = await runChaseWorkTest({ repositoryRoot, signal: controller.signal, target,
      onReady: () => console.log("One read-only Chase discovery is queued for the installed extension."),
      onStatus: event => console.log(`Chrome bridge state: ${event}.`),
    });
    console.log(`Temporary Chase result: ${result.status}.`);
    if (result.summary) console.log(`Structural result only: ${JSON.stringify(result.summary)}`);
    if (result.normalization) console.log(`Chase validation counts only: ${JSON.stringify(result.normalization)}`);
    if (result.overlap) console.log(`Chase incremental status: ${JSON.stringify(result.overlap)}`);
    if(result.checks?.length)console.log(`Temporary paired capture checks: ${JSON.stringify(result.checks)}`);
    console.log("Collector evidence was removed and deletion verified. Personal Chrome was not closed or cleared.");
    if (result.status !== "candidate_captured") process.exitCode = 1;
  } catch (error) {
    const issue = safeIssue(null, error);
    console.error(`${issue.code}: ${issue.message}`);
    process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
else if (command.length === 1 && ["chrome-bridge", "wells-refresh", "chase-refresh", "chase-sapphire-refresh", "chase-prime-refresh", "chase-pair-refresh", "citi-refresh", "paypal-refresh", "wealthfront-refresh"].includes(command[0])) {
  let bridge = null;
  try {
    const { runCollectorQc, formatCollectorQc } = await import("./collector-qc.mjs");
    const qc = await runCollectorQc({ repositoryRoot: fileURLToPath(new URL("../../", import.meta.url)) });
    if (!qc.ok) throw new Error(`COLLECTOR_QC_BLOCKED: ${formatCollectorQc(qc)}`);
    const { startChromeBridge } = await import("./chrome-bridge.mjs");
    const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
    let evidenceStore = null;
    let chasePlan = null;
    const chasePair=command[0]==='chase-pair-refresh';
    let chasePairPhase=0;
    bridge = await startChromeBridge({
      nextCommand: command[0] === 'wealthfront-refresh' ? 'capture_wealthfront_cash' : command[0] === 'paypal-refresh' ? 'capture_paypal_financing' : command[0] === 'citi-refresh' ? 'capture_citi_activity' : command[0] === "wells-refresh" ? "open_wells"
        : command[0] === "chase-refresh" ? "open_chase"
          : command[0] === "chase-sapphire-refresh" ? "open_chase_sapphire"
            : command[0] === "chase-prime-refresh" || chasePair ? "open_chase_prime" : "none",
      captureAfterAuth: ["wells-refresh", "chase-refresh"].includes(command[0]),
      onWealthfrontCapture: command[0]==='wealthfront-refresh'?async candidate=>{
        const [{defaultPrivateRoot},{openPrivateEvidenceStore},{normalizeWealthfrontCash}]=await Promise.all([
          import('./private-paths.mjs'),import('./private-evidence-store.mjs'),import('./wealthfront-normalize.mjs')]);
        const n=normalizeWealthfrontCash(candidate);
        if(!n.activityCaptured){console.log('Wealthfront activity could not be read; no workbook update.');return;}
        const store=await openPrivateEvidenceStore({root:defaultPrivateRoot(),repositoryRoot});
        await store.save({source:'wealthfront',capturedAt:new Date().toISOString(),payload:candidate});
        console.log('Wealthfront activity saved privately; workbook import separately checks balances and the accepted anchor.');
      }:null,
      onPaypalCapture: command[0]==='paypal-refresh'?async candidate=>{
        const [{defaultPrivateRoot},{openPrivateEvidenceStore},{normalizePaypalFinancing}]=await Promise.all([
          import('./private-paths.mjs'),import('./private-evidence-store.mjs'),import('./paypal-normalize.mjs')]);
        const n=normalizePaypalFinancing(candidate);
        if(!n.coverageVerified){console.log('PayPal financing incomplete; no workbook update.');return;}
        const store=await openPrivateEvidenceStore({root:defaultPrivateRoot(),repositoryRoot});
        await store.save({source:'paypal',capturedAt:new Date().toISOString(),payload:candidate});
        console.log('PayPal financing saved privately; workbook import must match the configured promotions.');
      }:null,
      onCitiActivityCapture: command[0]==='citi-refresh'?async candidate=>{
        const [{defaultPrivateRoot},{openPrivateEvidenceStore},{normalizeCitiActivity,citiSummary}]=await Promise.all([
          import('./private-paths.mjs'),import('./private-evidence-store.mjs'),import('./citi-normalize.mjs')]);
        const n=normalizeCitiActivity(candidate,'pending:citi');
        if(!n.coverageVerified){console.log(`Citi blocked: ${JSON.stringify(citiSummary(n))}`);return;}
        const store=await openPrivateEvidenceStore({root:defaultPrivateRoot(),repositoryRoot});
        await store.save({source:'citi',capturedAt:new Date().toISOString(),payload:candidate});
        console.log('Citi source saved privately. Workbook import will verify the accepted ledger anchors before applying it.');
      }:null,
      onActivityCapture: command[0] === "wells-refresh" ? async candidate => {
        if (!evidenceStore) {
          const [{ defaultPrivateRoot }, { openPrivateEvidenceStore }] = await Promise.all([
            import("./private-paths.mjs"), import("./private-evidence-store.mjs"),
          ]);
          evidenceStore = await openPrivateEvidenceStore({ root: defaultPrivateRoot(),
            repositoryRoot });
        }
        const prior = await evidenceStore.latestPayload({ source: 'wells', kind: 'wells_normalized_activity' });
        const capturedAt = new Date().toISOString();
        const reference = await evidenceStore.save({ source: "wells", capturedAt, payload: candidate });
        const { normalizeWellsActivity, normalizationSummary, reconcileWellsOverlap } = await import('./wells-normalize.mjs');
        const normalized = normalizeWellsActivity(candidate, reference, capturedAt, { hasPriorAnchor: prior !== null });
        const reconciled = prior === null ? normalized : reconcileWellsOverlap(normalized, prior);
        const { mapWellsToLedgerStage } = await import('./workbook-ledger-map.mjs');
        const staged = reconciled.overlapVerified && reconciled.issues.length === 0
          ? { ...reconciled, ledgerStage: mapWellsToLedgerStage(reconciled) } : reconciled;
        await evidenceStore.save({ source: 'wells', capturedAt, payload: staged });
        console.log(`Wells validation: ${JSON.stringify(normalizationSummary(staged))}`);
      } : null,
      onChaseActivityCapture: command[0].startsWith("chase-") ? async candidate => {
        const [{ defaultPrivateRoot }, { openPrivateEvidenceStore }, { activitySummary }] = await Promise.all([
          import("./private-paths.mjs"), import("./private-evidence-store.mjs"), import("./activity-probe.mjs"),
        ]);
        const store = await openPrivateEvidenceStore({ root: defaultPrivateRoot(), repositoryRoot });
        const capturedAt = new Date().toISOString();
        const reference = await store.save({ source: "chase", capturedAt, payload: candidate });
        const { normalizeChaseActivity, chaseNormalizationSummary } = await import('./chase-normalize.mjs');
        const { createChaseAnchorSession, chaseOverlapSummary } = await import('./chase-overlap.mjs');
        const normalized=normalizeChaseActivity(candidate,reference);
        if(!chasePlan){
          const prior=normalized.identity ? await store.latestPayload({source:'chase',kind:'chase_anchor_snapshot',identity:normalized.identity}) : null;
          chasePlan=createChaseAnchorSession(prior?.normalized??null,{expectedProduct:
            chasePair?['prime_visa','sapphire_preferred'][chasePairPhase]:
              command[0]==='chase-prime-refresh'?'prime_visa':command[0]==='chase-sapphire-refresh'?'sapphire_preferred':null});
        }
        const decision=chasePlan(normalized);
        await store.save({ source: 'chase', capturedAt, payload: normalized });
        if(decision.overlapVerified || decision.action==='baseline_only' && normalized.transactions.filter(t=>t.state==='posted').length>=3){
          // This is a local overlap baseline, never a verified import. Blocked
          // captures cannot overwrite the last usable anchor for either card.
          await store.save({source:'chase',capturedAt,payload:{kind:'chase_anchor_snapshot',identity:normalized.identity,normalized}});
        }
        console.log(`Chase discovery: ${JSON.stringify(activitySummary(candidate))}`);
        console.log(`Chase validation counts only: ${JSON.stringify(chaseNormalizationSummary(candidate))}`);
        console.log(`Chase incremental status: ${JSON.stringify(chaseOverlapSummary(decision))}`);
        if(decision.action==='load_more')return {nextPageToken:candidate.source.pageToken};
        if(chasePair&&chasePairPhase===0&&['baseline_only','stop'].includes(decision.action)){
          chasePairPhase=1;chasePlan=null;return {nextCard:'sapphire_preferred'};
        }
      } : null,
      onProgress: ({ event }) => console.log(`Chrome bridge state: ${event}.`),
    });
    console.log(`Local Chrome bridge is listening only on 127.0.0.1:${bridge.port}.`);
    if (command[0] === "wells-refresh") {
      console.log("One local Wells refresh is queued. The installed extension polls loopback and opens or reuses one Wells tab; no helper tab is created.");
    } else if (command[0] === "chase-refresh") {
      console.log("One local Chase discovery refresh is queued. The installed extension polls loopback and opens or reuses one Chase tab; no helper tab is created.");
    } else if (command[0] === "chase-sapphire-refresh") {
      console.log("One local Chase Sapphire Preferred activity discovery is queued. It reuses one Chase tab and selects only that visible product label.");
    } else if (command[0] === "chase-prime-refresh") {
      console.log("One local Chase Prime Visa activity discovery is queued. It reuses one Chase tab and selects only that visible product label.");
    } else {
      console.log("It accepts only the installed Budget Collector Bridge extension and reports no financial data.");
    }
    console.log(command[0] === "wells-refresh"
      ? "After the page reports an authenticated activity view, a bounded activity-table candidate is sealed locally for development. It is not a verified import or workbook update."
      : command[0].startsWith("chase-")
        ? "After authentication, Chase table evidence is captured only if one strict Date/Description/Amount-style table is recognized. It remains encrypted local discovery evidence, not a workbook update."
      : "Press Ctrl+C to stop it. This command does not install an extension, read credentials, capture financial data, or update the workbook.");
    await new Promise(resolve => {
      const stop = () => {
        process.removeListener("SIGINT", stop);
        process.removeListener("SIGTERM", stop);
        resolve();
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    });
    await bridge.close();
    console.log("Local Chrome bridge stopped.");
  } catch (error) {
    if (bridge) await bridge.close().catch(() => {});
    const issue = safeIssue(null, error);
    console.error(`${issue.code}: ${issue.message}`);
    process.exitCode = 1;
  }
} else if (command.length === 1 && ["wells-pilot", "pilot-rehearsal"].includes(command[0])) {
  try {
    const { runWellsPilot, runFictionalPilot } = await import("./pilot-session.mjs");
    console.log(command[0] === "wells-pilot"
      ? "Opening local Wells pilot controls. Nothing connects to Wells until you acknowledge the conditions and press Open Wells."
      : "Opening a fictional pilot rehearsal. Do not enter real credentials or account information.");
    console.log("Sign in only in the bank tab yourself. Do not sign into Chrome sync. Close the controls or press Stop & clean up to finish.");
    const options = { onActivityReport: report => console.log(`Activity reader structural result (no account text): ${JSON.stringify(report)}`) };
    const result = await (command[0] === "wells-pilot" ? runWellsPilot(options) : runFictionalPilot(options));
    console.log(`Pilot stopped. ${result.inspectionCount} structural outline(s) inspected; account coverage remains unverified.`);
    console.log(`${result.activityCount} private activity read(s). No verified import or workbook update was produced.`);
    console.log("The separate browser exited. Its temporary profile and encrypted test records were removed and deletion verified.");
    console.log("The financial workbook and personal Chrome profile were not changed.");
  } catch (error) {
    const issue = safeIssue(null, error);
    console.error(`${issue.code}: ${issue.message}`);
    process.exitCode = 1;
  }
} else if (command[0] === "recover-test" && (command.length === 1 || (command.length === 2 && command[1] === "--confirm-cleanup"))) {
  try {
    const { recoverDisposableTest, recoveryMessage } = await import("./test-recovery.mjs");
    const result = await recoverDisposableTest({ repositoryRoot: fileURLToPath(new URL("../../", import.meta.url)),
      confirm: command[1] === "--confirm-cleanup" });
    console.log(recoveryMessage(result));
    if (result.status === "blocked") process.exitCode = 1;
  } catch {
    console.error("Recovery is unavailable. No personal browser or financial workbook was changed.");
    process.exitCode = 1;
  }
} else if (command.length !== 1 || !["demo", "storage-demo", "browser-demo", "browser-interactive"].includes(command[0])) {
  console.error("Available commands: node collector/src/cli.mjs demo | storage-demo | browser-demo | browser-interactive | chrome-bridge | wells-refresh | chase-refresh | chase-sapphire-refresh | chase-prime-refresh");
  console.error("Live account collection is not installed. Collection demos use fictional data; the Wells development pilot can capture unverified activity tables privately.");
  console.error("Stopped-test inspection: node collector/src/cli.mjs recover-test [--confirm-cleanup]");
  console.error("Separate, manual pilot controls: node collector/src/cli.mjs pilot-rehearsal | wells-pilot");
  process.exitCode = 2;
} else if (command[0].startsWith("browser-")) {
  try {
    const { browserDemo } = await import("./browser-demo.mjs");
    console.log("Fictional browser test only. No bank is connected; do not enter credentials or sign into Chrome sync.");
    const result = await browserDemo({ interactive: command[0] === "browser-interactive" });
    console.log(result.status === "cancelled" ? "Test cancelled." : `Browser test passed: ${result.accountCount} fictional accounts across ${result.signInGroups} sign-in groups.`);
    console.log("The separate test browser exited. Its profile and encrypted test records were removed and deletion verified.");
    console.log("Your everyday Chrome profile, current workbook, and home financial store were not used.");
  } catch (error) {
    const issue = safeIssue(null, error);
    console.error(`${issue.code}: ${issue.message}`);
    process.exitCode = 1;
  }
} else if (command[0] === "storage-demo") {
  try {
    const result = await storageDemo();
    console.log(`Encrypted storage demo passed: ${result.accountCount} fictional accounts, ${result.savedVersions} retained versions, ${result.duplicateEntries} duplicate entries.`);
    console.log("A deliberately incomplete refresh left the previous saved version intact.");
    console.log("Disposable test records were removed. No real financial store, bank connection, workbook change, or Git sync was created.");
  } catch (error) {
    const issue = safeIssue(null, error);
    console.error(`${issue.code}: ${issue.message}`);
    process.exitCode = 1;
  }
} else {
  const registry = makeRegistry();
  const adapters = fixtureAdapters(makeCaptures(registry));
  const first = await collectCandidate({ registry, adapters, now: FIXTURE_NOW });
  const repeated = first.candidate && await collectCandidate({ registry, adapters, now: FIXTURE_NOW, previousState: first.candidate.nextState });
  if (first.status !== "candidate_ready" || repeated.status !== "candidate_ready") {
    console.error("Fictional-data demonstration blocked. No files were changed.");
    for (const issue of [...first.issues, ...(repeated?.issues ?? [])]) console.error(`${issue.accountId ?? "Collector"}: ${issue.code} - ${issue.message}`);
    process.exitCode = 1;
  } else {
    console.log(`Offline demonstration passed: ${first.candidate.accountCount} fictional accounts collected and checked.`);
    console.log(`Repeated refresh: ${Object.values(repeated.candidate.changes).reduce((sum, change) => sum + change.added, 0)} duplicate entries added.`);
    console.log("No browser opened, private data read, files written, workbook changed, or Git sync performed.");
    console.log("Remaining: workbook input boundary and live-bank integration, then approved disposable bank testing and home certification.");
  }
}
