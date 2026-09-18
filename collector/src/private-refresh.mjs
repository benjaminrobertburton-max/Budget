import { collectCandidate } from "./refresh.mjs";
import { safeIssue, requireEvidence as check } from "./errors.mjs";

// Saves a checked synthetic intake candidate only. Budget logic and the real
// workbook are deliberately outside this development milestone.
export async function refreshToLocalStore({ store, registry, adapters, now = new Date(), timeoutMs = 30000 }) {
  try {
    return await store.withLock(async transaction => {
      const previous = await transaction.latest();
      if (previous) {
        check(JSON.stringify(previous.payload.registry) === JSON.stringify(registry),
          "REGISTRY_CHANGED", "Account collection requirements changed; explicit onboarding is needed before accepting new local history.");
      }
      const result = await collectCandidate({ registry, adapters, now, timeoutMs,
        previousState: previous?.payload.candidate.nextState ?? null });
      if (result.status !== "candidate_ready") return result;
      const receipt = await transaction.appendCandidate({ registry, candidate: result.candidate });
      return {
        status: "candidate_saved_locally",
        issues: [],
        accountCount: result.candidate.accountCount,
        addedTransactions: Object.values(result.candidate.changes).reduce((total, change) => total + change.added, 0),
        receipt,
        workbookReady: false,
      };
    });
  } catch (error) {
    return { status: "blocked", issues: [safeIssue(null, error)], candidate: null };
  }
}
