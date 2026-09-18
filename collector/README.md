# Local Budget Collector — offline collection and encrypted storage

This is the offline foundation for the user's Tuesday **Refresh Budget** workflow.
It is runnable software with fictional test data and a tested Windows encryption
layer. It does not yet connect to banks, collect real financial data, create the
user's home financial store, or update the workbook. The account examples describe
coverage targets, not certified integrations or current household balances.

## Run without an AI session

Requires Node.js 22 or newer (tested here on Node.js 24). No downloaded packages,
API keys, browser access, or accounts are required. From the repository root:

```powershell
node collector/src/cli.mjs demo
node collector/src/cli.mjs storage-demo
node --test collector/test/*.test.mjs
```

On Windows, the equivalent wrapper is:

```powershell
.\collector\Test-Collector.ps1 -Mode Demo
.\collector\Test-Collector.ps1 -Mode StorageDemo
.\collector\Test-Collector.ps1 -Mode Test
```

The in-memory `demo` collects eleven entirely fictional accounts, validates them,
and repeats the refresh to check that entries are not duplicated. It prints only
summary counts. It never opens a browser, writes data, changes a workbook, or runs
Git. The Windows-only `storage-demo` also encrypts and saves fictional candidates
in a newly created disposable directory under `%LOCALAPPDATA%\BudgetCollectorTesting`,
reopens them, verifies a repeat refresh and a deliberately failed collection, then
removes that exact owned directory and verifies removal.
It does not initialize the real private store or access bank sessions. Unsupported
commands (including `live`) fail explicitly.

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
- Windows current-user encryption, append-only encrypted candidate versions, and
  separately encrypted commit records linking versions by checksum.
- A complete encrypted snapshot is committed only after it has been written and
  flushed. An interrupted pre-commit write does not replace the prior committed
  state. Uncommitted ciphertext is retained but never treated as accepted history.
- An exclusive refresh lock and path checks excluding repositories, known cloud
  folders, broad roots, and symbolic links/junctions.
- A separate disposable work-test lifecycle: exclusive ownership, encrypted
  evidence writes, bounded resource-close hooks, verified removal after success or
  task failure, and blocking when an earlier run or failed cleanup remains.

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
state from this function is in memory only. `refreshToLocalStore()` can save that
synthetic candidate encrypted and resume from it later, returning
`candidate_saved_locally`. Neither result is a production verified import or
authorization to update the workbook. The adapter
interface has `collect(account, { signal })`; any eventual live adapter must stop
its work when that signal is aborted and must remain strictly read-only.

## Private storage behavior and limits

The real private store is reserved for the home machine. Its proposed default is
`%LOCALAPPDATA%\BudgetCollector`, outside the repository and cloud-synced folders.
This implementation does not create that store as part of tests or demos.
Custom sync roots must be declared as excluded paths; the program cannot discover
every third-party sync application automatically.

### Disposable testing on the work machine

The user now permits live, read-only work-machine testing, subject to workplace
permission, **only if test financial data is deleted afterward**. The current CLI
still supports fictional demonstrations only; bank readers and browser shutdown
integration are not yet implemented. Permission to test is not evidence that live
collection already works.

`src/disposable-run.mjs` supplies `withDisposableTestRun()`. Its default parent is
`%LOCALAPPDATA%\BudgetCollectorTesting`, separate from the persistent home store.
Each invocation creates an owned `run-<random-id>` with `store`, `evidence`, and
`browser-profile` subdirectories. It does not initialize the home store. The parent
may remain empty after success; no account names or financial values appear in
its ownership markers.

The encrypted evidence helper uses Windows user-bound protection by default and
has no plaintext fallback. Tasks must await all work and register shutdown hooks
for any owned processes. Hooks run in reverse order, each with a maximum 30-second
wait; the browser hook must resolve only after the browser has actually exited.
Tracked evidence writes finish before removal. Only the exact owned run can be
deleted, after checking ownership, paths, and absence of links/junctions. A task
error is sanitized and its directory still removed when cleanup is safe.

If a process crashes, a resource will not close, paths change unexpectedly, or
deletion fails, the program reports `TEST_CLEANUP_REQUIRED`, never a false deletion
success. Existing runs/locks block another test. Guided recovery must check exact
ownership and ensure all associated processes have stopped; automatic crash
recovery and a browser-aware recovery UI are not implemented yet. Do not work
around a cleanup warning by moving to a fresh parent directory.

The future browser runner must create a **new, unsynced disposable Chrome profile**
inside that run, never attach to or copy the everyday personal profile. The user
signs into banks, not Chrome sync. Browser cookies/cache are browser-managed and
are not encrypted by the collector's record helper. Browser downloads, screenshots,
traces, videos, and financial debug logs must be disabled unless explicitly needed
and safely contained. Prove browser exit, ordinary cancellation, profile removal,
and leftover handling with fictional pages before enabling live tests.

Retain only generic source code, account-independent navigation rules, invented
fixtures, and non-sensitive test outcomes. Never print private page contents into
agent tool outputs or retain them in chat. Delete any future test workbook along
with its test run, not the legacy workbook or the home production history. Multiple
refresh/reconciliation tests may run within one session before final deletion.
Deleting test history does not hinder code deployment; home onboarding starts with
its own private data and sessions, and cross-week shadow checks happen at home.

Ordinary file deletion is not a forensic-erasure guarantee. This cleanup cannot
erase employer/OS monitoring, backups outside its control, bank logs, or data
already uploaded to a conversation. A personal Chrome profile does not make an
employer-managed computer private. No real bank data has been used to test this
lifecycle; its coverage is entirely fictional.

`windows/Protect-LocalData.ps1` uses Windows DPAPI with `CurrentUser` scope. The
helper receives data over pipes, not command arguments or plaintext temporary
files. It is launched without a visible window or an execution-policy bypass.
There is no plaintext or machine-wide encryption fallback. Windows user/profile
access must work; the program fails if encryption is unavailable.

References: [Microsoft DPAPI documentation](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata?view=windowsdesktop-9.0),
[Node filesystem documentation](https://nodejs.org/docs/latest-v24.x/api/fs.html).

All financial content, account aliases, transaction history, and source references
are inside encrypted records. The only plaintext lock metadata is an owner token,
process ID, and format version. File names contain a sequence and random ID.

`runs/` holds immutable encrypted candidates; `commits/` holds encrypted commit
records. A commit checksum binds the accepted snapshot, and a previous-commit hash
links history. Readers reject damaged or missing required records rather than
silently rolling back. These checks do not make files undeletable or constitute
protection against an attacker controlling the same Windows user account.

Retained prior versions support recovery from an application failure. They are
not an off-device backup. Hardware-loss recovery and Windows profile/key recovery
still need a home-machine backup plan before real use. Do not copy an encrypted
store between this work PC and the home PC; establish the real store under the
home Windows user instead.

A stopped/crashed process can leave `refresh.lock` behind. The current code blocks
and preserves that lock rather than guessing whether it is safe to remove. A
guided recovery action must verify the owner is stopped before removing a stale
lock; that user-facing recovery flow remains part of the launcher milestone.
Filesystem writes use flushed files and no-overwrite hard links on the same local
volume. Sudden-power-loss behavior and home-drive compatibility remain acceptance
checks; no power-loss guarantee is claimed from unit tests.

Tests use disposable fictional records only. Most fault tests use an ephemeral
test-only encryption key for portability; Windows integration tests also exercise
actual DPAPI, on-disk round trips, and tamper rejection. Restricted agent execution
environments may prohibit DPAPI even though the normal Windows account supports
it. Do not skip those failures when claiming Windows integration is verified.

## Remaining milestones

1. **Private migration and home certification.** Certify the implemented encrypted
   store on the home Windows account, add guided stale-lock recovery and a private
   backup plan, and preserve existing workbook settings and history during the
   migration. Raw source-evidence capture, retention, and exception records remain
   to be implemented; this store currently holds synthetic normalized candidates.
2. **Workbook boundary.** Move private financial inputs out of the builder code.
   Supply verified local inputs and preserve financial logic, manual changes,
   history, formatting, and validations. Make actual formula/consistency failures
   stop the save. The existing quiet-mode message is not an acceptance gate.
3. **Movement and evidence acceptance.** Implement explicit transfer/payment links
   without double-counting, local user-confirmed exception resolution, and tests
   against workbook cash outputs. Budget rules remain in the workbook.
4. **Wells disposable pilot and home certification.** First integrate and verify
   browser shutdown/cancellation and disposable-profile cleanup using fictional
   pages. Then use the approved work-machine live-test boundary to develop the
   reader. Verify read-only summary, pending, posted, pagination, identity, evidence,
   and authentication pause/resume. Group manual sign-ins instead of making the
   user wait for serial collection. Measure attended authentication, background
   collection, and total time separately. Confirm sessions and operation at home.
5. **Other institutions.** Certify each required account and its payment/promo
   pages. Never mark coverage complete merely because one balance was read.
6. **Refresh button and shadow runs.** Add a local launcher, progress, retry/resume,
   safe cancellation, guided lock recovery, same-week payment replay protection, local backup,
   and opening of the verified workbook. Run three to four complete weekly
   comparison cycles before retiring screenshot fallback. No daily scheduler.

The next acceptance milestone is one verified Wells-to-workbook refresh on the
home machine. Full one-button readiness requires every registered source, exact
workbook cash consistency, preserved history/settings, no financial uploads,
acceptable intervention/time, and no AI participation in a normal refresh.

The repository still contains legacy financial files and old financial commits.
This feature branch does not add new financial data or remove those older copies.
Ignore patterns do not untrack files. Historical cleanup is a separate decision.
