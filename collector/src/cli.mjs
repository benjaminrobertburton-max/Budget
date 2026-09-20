import { collectCandidate } from "./refresh.mjs";
import { makeRegistry, makeCaptures, fixtureAdapters, FIXTURE_NOW } from "../fixtures/synthetic.mjs";
import { storageDemo } from "./storage-demo.mjs";
import { safeIssue } from "./errors.mjs";
import { fileURLToPath } from "node:url";

const command = process.argv.slice(2);
if (command.length === 1 && ["chrome-bridge", "wells-capture"].includes(command[0])) {
  let bridge = null;
  try {
    const { startChromeBridge } = await import("./chrome-bridge.mjs");
    const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
    let evidenceStore = null;
    bridge = await startChromeBridge({
      nextCommand: command[0] === "wells-capture" ? "capture_wells_activity" : "none",
      onActivityCapture: command[0] === "wells-capture" ? async candidate => {
        if (!evidenceStore) {
          const [{ defaultPrivateRoot }, { openPrivateEvidenceStore }] = await Promise.all([
            import("./private-paths.mjs"), import("./private-evidence-store.mjs"),
          ]);
          evidenceStore = await openPrivateEvidenceStore({ root: defaultPrivateRoot(),
            repositoryRoot });
        }
        await evidenceStore.save({ source: "wells", capturedAt: new Date().toISOString(), payload: candidate });
      } : null,
      onProgress: ({ event }) => console.log(`Chrome bridge state: ${event}.`),
    });
    console.log(`Local Chrome bridge is listening only on 127.0.0.1:${bridge.port}.`);
    if (command[0] === "wells-capture") {
      console.log("One read-only capture is queued for an already-open Wells page. This command never opens, reloads, or navigates a browser tab.");
    } else {
      console.log("It accepts only the installed Budget Collector Bridge extension and reports no financial data.");
    }
    console.log(command[0] === "wells-capture"
      ? "After the already-open page reports an authenticated activity view, a bounded activity-table candidate is sealed locally for development. It is not a verified import or workbook update."
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
  console.error("Available commands: node collector/src/cli.mjs demo | storage-demo | browser-demo | browser-interactive | chrome-bridge | wells-capture");
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
