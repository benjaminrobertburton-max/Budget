import { collectCandidate } from "./refresh.mjs";
import { makeRegistry, makeCaptures, fixtureAdapters, FIXTURE_NOW } from "../fixtures/synthetic.mjs";

const command = process.argv.slice(2);
if (command.length !== 1 || command[0] !== "demo") {
  console.error("Available command: node collector/src/cli.mjs demo");
  console.error("Live account collection is not installed. This milestone uses fictional data only.");
  process.exitCode = 2;
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
    console.log("Next milestone: private storage and workbook input boundary, followed by the Wells home-machine pilot.");
  }
}
