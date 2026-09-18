import { fileURLToPath } from "node:url";
import { openLocalStore } from "./local-store.mjs";
import { refreshToLocalStore } from "./private-refresh.mjs";
import { requireEvidence as check } from "./errors.mjs";
import { makeRegistry, makeCaptures, fixtureAdapters, FIXTURE_NOW } from "../fixtures/synthetic.mjs";
import { withDisposableTestRun } from "./disposable-run.mjs";

// A development demonstration only. Never opens the configured private home store.
export async function storageDemo() {
  check(process.platform === "win32", "WINDOWS_REQUIRED", "The encrypted storage demo needs Windows user-bound protection.");
  const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
  return withDisposableTestRun({ repositoryRoot }, async ({ paths }) => {
    const store = await openLocalStore({ root: paths.store, repositoryRoot });
    const registry = makeRegistry();
    const captures = makeCaptures(registry);
    const first = await refreshToLocalStore({ store, registry, adapters: fixtureAdapters(captures), now: FIXTURE_NOW });
    check(first.status === "candidate_saved_locally", first.issues[0]?.code ?? "DEMO_FAILED",
      first.issues[0]?.message ?? "The fictional encrypted storage demo did not complete.");
    const reopened = await openLocalStore({ root: paths.store, repositoryRoot });
    const second = await refreshToLocalStore({ store: reopened, registry, adapters: fixtureAdapters(captures), now: FIXTURE_NOW });
    check(second.status === "candidate_saved_locally" && second.addedTransactions === 0, "DEMO_FAILED", "The repeated fictional refresh did not preserve transaction identity.");
    captures["demo-wells"].coverage.posted.totalMinor = 0;
    const failed = await refreshToLocalStore({ store: reopened, registry, adapters: fixtureAdapters(captures), now: FIXTURE_NOW });
    check(failed.status === "blocked" && (await reopened.readLatest()).sequence === 2,
      "DEMO_FAILED", "The failed fictional refresh did not preserve the prior saved state.");
    return { accountCount: second.accountCount, savedVersions: 2, duplicateEntries: 0 };
  });
}
