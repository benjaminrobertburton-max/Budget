# Local Budget Collector — first implementation milestone

This is the offline foundation for the user's Tuesday **Refresh Budget** workflow.
It is runnable software with fictional test data. It does not yet connect to banks,
store private financial data, or update the workbook. The account examples describe
coverage targets, not certified integrations or current household balances.

## Run without an AI session

Requires Node.js 22 or newer (tested here on Node.js 24). No downloaded packages,
API keys, browser access, or accounts are required. From the repository root:

```powershell
node collector/src/cli.mjs demo
node --test collector/test/*.test.mjs
```

On Windows, the equivalent wrapper is:

```powershell
.\collector\Test-Collector.ps1 -Mode Demo
.\collector\Test-Collector.ps1 -Mode Test
```

The demonstration collects eleven entirely fictional accounts, validates them,
and repeats the refresh to check that entries are not duplicated. It prints only
summary counts. It never opens a browser, writes data, changes a workbook, or runs
Git. Unsupported commands (including `live`) fail explicitly.

## Responsibilities

- The collector gathers and validates source facts and transaction identities.
- The existing workbook/builder retains budgeting formulas, categories, upcoming
  expenses, transfer schedules, rent/savings rules, payment decisions, and history.
- Real financial data and the finished workbook stay on the home machine. GitHub
  carries software, documentation, and fictional test cases only.

## Implemented

- Strict versioned JavaScript contracts for account requirements and captured data.
- An example registry for Wells, Wealthfront, both Chase cards, Citi, Discover,
  Capital One, PayPal Credit, CUTX, RBC, and Fidelity. Actual home accounts need
  explicit onboarding; the examples do not establish active accounts.
- Exact signed minor-unit money parsing, currency checks, and overflow protection.
- All-or-nothing collection: missing readers, incomplete pages, missing balance
  types, missing due details, and missing promo plans prevent a candidate.
- Independent posted/pending counts and signed totals, source-local dates,
  freshness checks, saved anchors, and a complete overlapping activity window.
- Source-ID deduplication, conservative fingerprint collision handling, and
  evidenced pending-to-posted transitions with preserved observation history.
- Explicit cancellation evidence; disappearing pending activity is not silently
  dropped. Actual bank behavior must be assessed during the pilot.
- Consolidated, account-specific exceptions, sanitized reader failures, bounded
  reader execution, and abort signals for timed-out collection.
- Repeatable updates that preserve prior state and do not duplicate transactions.

No budgeting calculation, purchase categorization, payment confirmation, or
transfer pairing is inferred from amount alone. A reader may retain a transaction
kind only when supported by its source evidence; otherwise it supplies `unknown`.

## Contract and data conventions

`src/contracts.mjs` is the runtime contract. Unknown fields are rejected. Every
account explicitly declares required pages, currency, source timezone, balance
types, and obligation/promo requirements. An unavailable value is never defaulted
to zero. A zero needs evidence just like a nonzero value.

Transaction amounts use a normalized **cash-flow sign**: outflows are negative,
inflows are positive. For cards, a purchase is negative and a refund/payment credit
is positive. This is an intake convention, not a change to the workbook's purchase
ledger convention; the future workbook adapter must explicitly map signs with
preservation tests. Balances retain their declared source type and meaning.

Readers must retain a source reference explaining sign/status interpretation.
Independent coverage controls must come from source evidence, not be computed
from the same parsed rows being checked. A bank page without sufficient controls
needs a documented, tested coverage method; this foundation cannot certify it.

An exact source ID can deduplicate repeated pages. Identical rows without stable
IDs are ambiguous, since two purchases can genuinely match. Pending/posting links
require a stable source ID or an explicit source link. Mere date/amount similarity
does not establish a match. Changed posted history requires review.

`collectCandidate()` returns either a consolidated `blocked` result with no
candidate, or a `candidate_ready` result with `workbookReady: false`. Candidate
state is in memory only. It is **not** a production verified import, encrypted
snapshot, audit database, or authorization to update the workbook. The adapter
interface has `collect(account, { signal })`; any eventual live adapter must stop
its work when that signal is aborted and must remain strictly read-only.

## Remaining milestones

1. **Private storage and migration.** Define a private home-machine directory
   outside Git/cloud sync; implement user-bound encryption, atomic writes, recovery,
   local backups, and append-only evidence. Preserve existing workbook settings and
   financial history during migration. No live capture until this exists.
2. **Workbook boundary.** Move private financial inputs out of the builder code.
   Supply verified local inputs and preserve financial logic, manual changes,
   history, formatting, and validations. Make actual formula/consistency failures
   stop the save. The existing quiet-mode message is not an acceptance gate.
3. **Movement and evidence acceptance.** Implement explicit transfer/payment links
   without double-counting, local user-confirmed exception resolution, and tests
   against workbook cash outputs. Budget rules remain in the workbook.
4. **Wells home pilot.** Set up the user-owned browser normally on the home machine.
   Verify read-only summary, pending, posted, pagination, identity, evidence,
   authentication pause/resume, and elapsed time. No live banking on this work PC.
5. **Other institutions.** Certify each required account and its payment/promo
   pages. Never mark coverage complete merely because one balance was read.
6. **Refresh button and shadow runs.** Add a local launcher, progress, retry/resume,
   safe cancellation, a single-run lock, same-week replay protection, local backup,
   and opening of the verified workbook. Run three to four complete weekly
   comparison cycles before retiring screenshot fallback. No daily scheduler.

The next acceptance milestone is one verified Wells-to-workbook refresh on the
home machine. Full one-button readiness requires every registered source, exact
workbook cash consistency, preserved history/settings, no financial uploads,
acceptable intervention/time, and no AI participation in a normal refresh.

The repository still contains legacy financial files and old financial commits.
This feature branch does not add new financial data or remove those older copies.
Ignore patterns do not untrack files. Historical cleanup is a separate decision.
