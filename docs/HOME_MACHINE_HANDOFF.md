# Collector home-machine handoff and release checklist

## September 21 — work-machine development resumes (current authority)

### Citi first-page collector — current development checkpoint

**Workbook integration now implemented:** private `bindings.citi` enables Citi in
the same `workbook-import` path as Wells/both Chase cards. `citi-refresh` stores RAW
Citi capture evidence in the existing private encrypted store; importer revalidates
it, matches accepted ledger anchors, reconciles pending, and updates ledger, source
controls, balance, actual minimum and due date. Workbook save retains the original
backup and native parts. The accepted workbook ledger persists anchors between
runs; failed imports never advance it. See `COLLECTOR_WORKBOOK_INTAKE.md` for the
one-time private configuration addition. No extension reload needed. Fictional
end-to-end and actual-template compatibility passed; fresh live capture through the
current home workbook has not yet been acceptance-tested.

Extension **0.4.13** adds the observed Citi single-card dashboard reader on
`citi.com` and reuses the existing loopback bridge, money parser and encrypted
disposable-test lifecycle. It reads the labeled account suffix, current/available
credit/last-statement balances, minimum payment and due date, separate pending and
posted transactions, selected date range and the source's signed section totals.
It opens only the observed **Filter By** panel when collapsed; selections remain
unchanged. No financial actions, credential reads or broad account navigation.

Run `node collector/src/citi-work-test.mjs` with exactly one authenticated Citi
tab and the reloaded extension. The two-minute temporary test captures the first
page and repeats it against its in-memory posted anchors, then verifies deletion
of encrypted test evidence. It does not clear ordinary Chrome cookies/cache,
touch the home store or update any workbook. Only structural checks/counts appear
in output. The initial live capture matched both section totals and read identity,
balances and due date; it safely blocked on collapsed filter labels. The targeted
fix passed 23 focused normalizer/bridge/worker/real-Chrome fictional tests.

**Live 0.4.13 acceptance:** captured the identified account, all four labeled
balance/payment amounts and due date; both posted and pending source totals matched
with no parsing/coverage issues. Same-session repeat matched posted overlap without
loading older activity. Temporary encrypted evidence deletion was verified. This
proves the observed dashboard reader and replay, not cross-week home acceptance.

Always collect new posted activity through accepted overlap plus all current
pending. Never sweep history. "All" type/member filters prevent omitted payments,
refunds or cardmembers, not an unlimited history request. Missing overlap stops
with `anchor_missing_from_range`; older-range navigation is not yet supported.
First capture is a proposed baseline, not accepted financial history. Citi's
absent pending section remains unknown (the Chase exception does not apply).
The temporary reader test itself does not configure the private home binding or
perform saved sign-in and cross-week acceptance. Workbook mapping/storage are now
implemented as described above. Preserve the working
Wells/Chase paths; do not rebuild them to add Citi.

### Direct Wells/Chase workbook import (supersedes review-only checkpoint)

`work/run_weekly_import.ps1 -CollectorConfig <private-config>` now applies fresh
Wells and both Chase captures to the existing private workbook, with an exact
pre-import backup. Ledger matching, classification using existing rules, pending
transitions, source counts/totals, cash/card inputs and prior-week selection are
connected. Closed History spending totals are preserved (user-approved). Native
workbook parts and other financial assumptions remain intact. No extension reload.

Read the direct-mode section of `COLLECTOR_WORKBOOK_INTAKE.md`. Home acceptance
still must bind the actual private workbook/captures and verify its accepted anchors;
missing/mismatched legacy anchors stop safely rather than guess. The home workbook
has not been changed on this work machine. Remaining account collection, final
payment-plan refresh and approval-only sign-in/launcher are outside this completed
Wells/Chase ledger integration. Do not rebuild working capture adapters.

### Workbook intake connection (newest implementation checkpoint)

The builder/collector now share a working encrypted-source-to-review-workbook path.
It creates a separate private copy, adds source balances/rows and explicit missing
information, preserves original financial cells/history/formulas/native components,
and warns that Start/Tuesday are the prior plan. It recalculates, compares original
outputs, scans formulas and renders affected sheets before exclusive publication.
See [configuration, checks and exact limitations](COLLECTOR_WORKBOOK_INTAKE.md).

This closes the **review intake** connection, NOT production verified workbook
updates. Accepted-history reconciliation, classification, required-source registry,
weekly rollover/new-plan creation, runtime packaging and the one-button launcher
remain development work. Do not mark the production rows in the status table below
complete. No real workbook/evidence was uploaded; the private home workbook was
not tested or overwritten. Existing capture code and extension 0.4.11 are unchanged.

Validation: **334/334** serial core/browser regressions passed, including 14 new
workbook/source-boundary cases. Collector QC and syntax checks passed. The legacy
builder passed before/after integration with zero formula errors; a separate
in-memory merge against the existing template preserved all **719** calculated
formula results and left the source file unchanged. Fictional end-to-end import
compared 4,858 original cells; Start, Tuesday and Intake previews were visually
reviewed. Temporary visual-QA files were deleted. No latest-home/private-data or
native-Excel acceptance is claimed. `git diff --check` passed.

### Approved reduced scope and completion status (newest)

The user approved prioritizing useful account coverage rather than implementing
an equally extensive transaction collector for every institution. This supersedes
older instructions to expand all adapters uniformly. It changes the development
plan, not the current runtime registry, collection cadence or financial rules.
Do not reopen completed Wells/Chase navigation and reader work without a concrete
regression. Do not call a successful capture test a completed budget refresh.

| Milestone | Wells | Chase (both cards) |
| --- | --- | --- |
| Source capture and parsing | Working capture, normalization, footer and repeat-anchor checks reported by the home checkpoint; preserve them | Live paired navigation/capture, labeled balances, no-payment-due evidence and repeat anchors passed here; Sapphire pending count/total passed live |
| Incremental handling | Existing overlap comparison and provisional ledger-row mapping | Existing bounded overlap/paging; same-session repeat proven live, anchor-missing paging covered by fictional tests |
| Production workbook update | Not completed: staged rows are not a verified workbook write | Not completed: normalized evidence is not a verified workbook write |
| Approval-only sign-in and end-to-end home acceptance | Not certified | Not certified |

The Chase-wide absent-pending inference is implemented and regression-tested
as documented below; it needs no extension reload. It is not a remaining policy
blocker. The latest full code suite passed 320/320. Wells live results above are
reported from the home handoff, not newly retested on this machine.

#### Prioritized scope

1. **Chase and Wells: retain the working source-capture milestones.** Close only
   identified coverage/reconciliation gaps and the shared verified-input-to-builder
   path. Do not wait for every low-activity adapter before testing that integration
   with fictional inputs. Preserve balances, current pending, posted overlap,
   account binding and the workbook's existing financial model.
2. **Citi: next new transaction adapter.** Capture balance/payment requirements,
   current pending and posted purchases/payments/refunds through the saved anchor.
3. **PayPal Credit: focused debt/promo adapter.** Capture current balance, payment
   requirements/receipts, all active promo balances/deadlines and source-visible
   allocation evidence needed by the payoff plan. Avoid unrelated shopping-history
   expansion. Existing cruise, tuition and future-expenses transfers remain required;
   verify their cash movements through existing source evidence and add bucket
   details only where the workbook actually needs them. Never guess allocation.
4. **Wealthfront: lightweight cash reader.** Available balance and recent transfers
   relevant to Wells/rent/reserves; no investment/trade-history project.
5. **Discover: smaller automated check, lower priority.** Balance, pending, due
   requirements and relevant recent activity, including recurring insurance.
   **Capital One: defer a full transaction engine**, retain an automated balance/
   payment-status check and enough change detection to surface new obligations.
6. **Fidelity: no separate weekly portal adapter for now.** Use Wells evidence for
   the scheduled contribution; an outgoing debit is not proof of portfolio value
   or settlement at Fidelity. **CUTX/RBC: periodic focused checks** for payment
   receipt, current obligations and relevant reserve/cash movements. Keep their
   scheduled payments/reserves in the workbook every week, even between checks.

"Lightweight" describes extraction scope, not a recurring manual chore. The final
routine user role remains ONLY required 2FA approval. Authentication/navigation
still need implementation/testing per institution. Do not infer no activity from
a zero or unchanged balance. Do not silently drop deferred accounts from the
verified source set: encode required fields/cadence/freshness explicitly when the
registry is implemented. Until covered, retain the existing fallback or report
the missing source; do not label a partial budget refresh complete. Unknown new
activity must trigger further collection/review, not be silently ignored.

#### Shared remaining work, not another reader redesign

- Bind captures to the private account registry and accepted prior history;
  reconcile pending-to-posted changes, duplicate occurrences and changed history.
  Account-specific missing source fields (including positive Chase payment-due
  layouts) still require actual evidence or an explicit exception, not guesses.
- Connect verified inputs to the existing builder, preserving manual settings,
  historical records, scheduled transfers and all financial logic; verify atomic
  private save/backup, formulas and matching Start/Tuesday cash outputs.
- Complete ordinary saved-credential sign-in and continuation after user 2FA,
  one-button orchestration and existing shadow/home acceptance checks. Develop
  portable code here; only machine-private setup/data/sessions and genuine home
  acceptance remain home-specific. Never extract credentials or copy profiles.

This checkpoint is a documentation/scope update only. No account adapter, bank
session, financial data, workbook, registry requirement or refresh schedule changed.

### User-approved Chase absent-pending rule — supersedes the gap below

The user explicitly authorized this for Chase as a whole, including BOTH Prime
Visa and Sapphire Preferred: no pending section on a loaded account activity page
means zero pending. The local normalizer now records `pendingZeroInferred` and
`pendingInference` with rule `user_approved_chase_absent_pending`, zero count/amount
and its private evidence reference. Independent source-count/total verification
flags remain false for this inference; the pending-coverage gate alone is cleared.
All account binding, posted history, obligations and workbook gates remain intact.

The supported Chase adapters require observed account/product, range, footer and
pagination state, all three valid labeled balances, clean posted rows, and no
pending table/header/summary or contradictory evidence. The existing 0.4.11 reader
still waits its bounded rendering window. Incomplete/authentication/error captures
do not become zero. If pending appears, normal count/total reconciliation wins.
Future Chase adapters must carry this institution-wide policy with equivalent
page-readiness checks; it does not apply to other banks. No extension change or
reload is needed. Earlier statements that Prime absence must always remain unknown
are historical and superseded by this explicit user decision.

Validation: **320/320** full serial core/browser tests passed, no failures or
skips, plus collector QC and `git diff --check`. New fictional regressions cover
both cards' inferred zero, present pending, mismatched totals, missing identity,
incomplete/error captures and privacy-safe summaries. The initial restricted
targeted run could not exercise Windows encryption; the properly authorized full
run passed that test unchanged. This policy change has not had a new live bank
retest; the extension reader and its rendering wait are unchanged.

### Paired Chase capture — extension 0.4.11

This supersedes the navigation/balance gaps in the preceding 0.4.7 checkpoint.
Navigation now uses the observed Accounts -> Overview -> requested card route,
requires the actual requested detail heading before capture, and rejects ambiguous
controls. Each navigation action is issued once with bounded readiness polling;
explicit authentication controls stop it. A rendering page is not mistaken for a
password prompt. Post-authentication resumption and saved-credential sign-in are
still separate unfinished capabilities.

The reader captures Current balance, Remaining statement balance and Available
credit only from the observed detail containers, matching visible labels and one
exact monetary span. Signs are preserved; available credit never becomes cash.
It records the explicit no-payment-due alert from its visible shadow-root heading,
not the alert element's name or a balance inference. This bank status does NOT
mean there is no statement balance to pay under the household's budget rules.
Positive minimum-payment/due-date layouts remain unobserved and unsupported.

Pending (N) is captured from the observed pending accordion heading and compared
against parsed pending rows. A mismatch blocks overlap acceptance. Missing heading
or section stays unknown; an explicit Pending (0) can evidence zero in the parser,
but that zero-state layout has not yet been observed live. Count verification is
reported separately and does not silently certify every coverage/history gate.

Version 0.4.11 additionally captures the Pending (N) / Pending charges summary in
`#custom-accordion-heading-container-pending-activity-accordion` and reconciles
the independent source total against exact signed pending-row amounts. Mismatch,
invalid money or overflow blocks overlap acceptance; missing total remains unknown.
It never substitutes an internally computed sum for a missing bank control.

`node collector/src/cli.mjs chase-pair-work-test` is temporary and encrypted. It
captures Prime, repeats against an in-memory comparison anchor, navigates to
Sapphire and repeats there, then deletes all evidence. It never reads the home
store. Version 0.4.8 passed this complete live sequence: both card identities,
all three balance types, repeat overlap with no unmatched posted rows, and no
unnecessary history loads. Pending was observed on Sapphire; Prime pending stayed
unknown. Cleanup was verified. This proves same-session replay, not cross-week
reconciliation or bank-driven posting changes.

Home-only `chase-pair-refresh` queues Prime then Sapphire with separate existing
encrypted baselines. This command must not be used for temporary work testing.
It is a development source-capture command, not the finished Refresh Budget button.
It does not write a workbook or turn an unverified baseline into accepted history.

Version 0.4.9 added source-count/status evidence, but its live retest exceeded the
temporary response window. Review found the reader's nominal 30-second wait was
150 delays PLUS all DOM-scan time. Version 0.4.10 enforces an elapsed-time deadline
and reuses the discovered DOM roots only within a single synchronous capture;
each subsequent capture rediscovers them. A regression covers expensive scans.
Do not increase runner timeouts to conceal unbounded work.

The 0.4.10 final live paired retest PASSED after the timing correction: automatic
card navigation, both repeat anchors, all labeled balances, explicit no-payment-due
status on both cards, and the independent pending count on Sapphire. Temporary
evidence deletion was verified. Full serial tests at that stage passed 313/313.
No pending-zero evidence was available on Prime. Attended inspection of its normal
activity filters and Download Account Activity options found no pending-only view
or explicit empty-pending statement; the export was cancelled without a download.
Do not infer zero from absence or ask for another screenshot of the same empty
layout. Positive payment-due layout, cross-week changes, live anchor-missing paging,
registry binding, authentication automation and workbook integration remain gates.

Version 0.4.11 live Sapphire acceptance passed: every visible row normalized,
the independent pending count AND signed pending-dollar total matched, all three
labeled balances were captured, the explicit no-payment-due status was read, and
the first-page baseline stopped without older-history loading. Collector evidence
deletion was verified. After an extension reload, an initial navigation attempt
still failed during the authentication-unavailable -> ready transition; a settled
retry succeeded. The local bridge now retries that same read-only card once only
if authentication has become ready and capture has not begun. Regression tests
reject repeated retries, active authentication and failures after dispatch. This
local-code correction needs no further extension reload and is not saved-password
sign-in automation. Live forced-transition retry remains unverified; do not log
out of the bank merely to create that test.

Run full tests with no live collector using port 43811. One concurrent full run
failed the CLI startup check because the live collector was using that port;
test fixtures/readers otherwise passed. Do not weaken that startup assertion.

Final 0.4.11 validation, including the bounded local retry: **315/315** full
serial core/browser tests passed, with zero failures or skips. Collector QC and
`git diff --check` passed. Stopped-test recovery inspection found no disposable
test files remaining. No workbook, financial source data or home store was changed.

### Incremental Chase continuation — extension 0.4.7

Current collection scope is **first page / saved posted overlap, not full history**.
Capture every current pending row separately. For posted activity, inspect every
loaded row (including out-of-order postings), match the prior three-row overlap
as a multiset, and stop as soon as it is present. Load more only when that overlap
is absent, with a four-load bound. Missing overlap at the end of a selected range,
changed account/range, replaced rows, stalled loading or the bound blocks the run.
Do not expand filters or invent a historical bootstrap to force a pass.

The reader now records the observed product/suffix, selected activity range,
posted footer and a change token covering both activity sections. It waits within
the existing bounded rendering window for independently loaded pending and
account/range context. No missing context or absent pending section becomes zero.
The trusted read-only See-more click is guarded by the captured page token; it
cannot initiate a payment. Extension host permissions are unchanged.

Home commands keep separate encrypted overlap snapshots by observed card identity.
A first page with at least three usable posted rows can seed an **unverified
comparison baseline**, not accepted financial history. Blocked captures do not
replace it. The current store searches only the newest 32 evidence records;
an older baseline outside that window is not found and requires baseline review.
Temporary work commands never read home history or retain these snapshots after
cleanup. Their injected prior-record option is for controlled temporary testing.

Version 0.4.6 live testing captured both sections with no rejected rows, identified
the account, and stopped at the first-page baseline without loading older history.
The first navigation capture had a missing range; inspection and a second capture
showed the same selector works once loaded. Version 0.4.7 adds context readiness
and fictional delayed/missing-range regressions. Switching directly from a detail
page to the other card did not complete: return-to-Overview orchestration remains
unfinished. The stopped test's owned files were recovered and deletion verified.

Validation: **305/305** full serial core/browser tests passed, no skips/failures,
with the required Chrome/Windows-encryption permissions. The initial restricted
run could not complete those environment-dependent checks; no tests were removed
or weakened. Collector QC and `git diff --check` pass. The user reloaded 0.4.7;
after returning to Overview, the collector navigated to Prime, captured and
normalized its first posted page without rejection, recorded identity/range,
and stopped as `baseline_only`. Pending was not observed and remained explicitly
unknown. Temporary evidence deletion was verified. Live previous-week overlap
and collector-triggered See-more remain unverified; fictional tests cover them.

Still NOT certified: registry/account binding, independent pending/posted coverage,
balances, obligations, changed-history reconciliation, pending-to-posted linking,
paired-card orchestration, post-auth navigation, saved-credential sign-in, and
workbook integration. Pending capture is not proof of pending completeness. The
user's intended weekly role remains ONLY required text/2FA approval; manual
development sign-in/navigation is not the final accepted workflow. No workbook
or real financial fixture was changed. Sync `codex/budget-collector`, not `main`.

### Private Chase normalization continuation

`collector/src/chase-normalize.mjs` now parses the observed full-year named and
numeric dates, exact displayed amount signs, section status and source Category.
It preserves duplicates and raw strings. Source dates are NOT asserted to be
posting dates; bank categories are NOT household budget categories; displayed
card signs are NOT converted into Wells cash-flow signs. Unknown dates/columns,
malformed rows, ambiguous sections and amounts become explicit exceptions.
Missing pending activity is unknown, never zero.

The existing temporary work commands encrypt raw plus normalized evidence in
the same disposable record and remove it on cleanup. Normal home Chase refresh
commands save raw and normalized records in the existing private encrypted store;
do not run those persistent commands at work. Output contains fixed issue codes
and counts only. Neither path can update a workbook. Extension remains 0.4.5;
this local-code change does not need an extension reload.

Identity binding, balance meanings, obligations, independent posted/pending
coverage and prior-anchor reconciliation remain blocking gates. Internal row
counts are not independent source controls. The prior live success established
table capture only; this continuation must not relabel it as a verified import.
The previously inspected Chase tab was no longer a Chase page at continuation;
no unrelated work page was changed. A fresh official Chase tab was opened for
renewed authenticated inspection; Sapphire/context validation still needs it.

Validation: full serial suite **292/292 passed**, no skips/failures; QC passes.
After the user signed in to Overview, the temporary Sapphire command navigated
to that card and captured/normalized posted rows without rejection. Direct DOM
inspection confirmed the Sapphire heading. However, the pending table appeared
later and the posted footer reported a partial `N of M transactions` view.
Do not treat that first-candidate event as readiness/completeness.

The read-only `See more activity` button lives in an `MDS-BUTTON` open shadow
root under `#activity_messages_id`; its accessible text is repeated. One attended
click loaded the remaining posted view and changed the footer to
`You've reached the end of your account activity.` A subsequent temporary capture
parsed both sections with no rejected rows; the posted row count matched the
earlier footer total. Both test runs verified collector evidence deletion. No
workbook changed. This was attended UI verification, NOT collector pagination.

Next implement source-context evidence and readiness/coverage controls, then
anchor-aware bounded loading. Generic observed context containers are
`#currentBalance`, `#remainingStatementBalance-dataItem`,
`#availableCredit-dataItem`; do not identify values just by child position.
Activity-range control is `#select-ACTIVITY-header-selector-label`, displayed
`Activity since last statement`. End of that filtered view is not account-wide
history or proof of pending completeness. Capture both sections after readiness;
no guessed zero-pending, unconditional history sweep, or arbitrary delay as proof.
Bind product/suffix/expected account independently of the requested navigation
target and preserve prior anchors only in the private home store. The current
reader's paired-table page token remains a placeholder; fix before pagination.

### Observed Chase heading mismatch — extension 0.4.5

The user confirmed Prime Visa transactions were visible during the failed retry,
then explicitly authorized direct inspection of that authenticated Chase page
with the understanding that visible financial information enters the conversation.
Keep this exception narrow: no credential inspection, account changes, financial
actions, saved bank screenshots/page dumps, or real-data Git fixtures.

Read-only DOM inspection found the actual blocker: sortable column cells expose
`Date, not sorted` followed by a duplicate `Date` (likewise Description/Amount).
The old exact classifier rejects the combined text. A fictional regression
reproduced `no_activity_table` before the fix. Version 0.4.5 recognizes only this
matching-label format, retaining original evidence text, row validation and limits.
Unknown/mismatched labels still fail closed. Other sort-state wording is not yet
supported. Wells and financial workbooks are unchanged. Reload the extension
before a live retry; offline success is not a verified live import.

Verification: full serial core/browser suite **281/281 passed**, zero skips or
failures; QC and diff checks pass. User reloaded 0.4.5. A temporary `chase-work-test`
against the already-open Prime detail page returned `candidate_captured`, with
one recognized table. Encrypted collector evidence deletion was verified; ordinary
Chrome was not closed or cleared. This resolves the observed table-recognition
blocker, not source certification. Category remains an `unknown` column with its
text retained; identity, balances, pagination and coverage remain unverified.
Do not infer zero pending from this posted-only view. No workbook was changed.
The successful reader test does not certify Overview-to-card orchestration or
post-auth navigation recovery. Continue with identity/context/coverage and the
second card using source evidence, not a repeat of heading troubleshooting.

Also observed: a card-target request made before sign-in did not resume card
selection after authentication. Cancelling with verified evidence cleanup and
restarting after sign-in dispatched capture. This is a development workaround,
not the intended weekly workflow; post-auth navigation recovery remains a task.

### Chase frame-window continuation

Reviewed the successful Wells history before changing Chase: trusted account
clicks, frame/shadow-root traversal, stable Wells header test IDs (`b382ff3`),
child-frame response handling (`16b9890`), bounded rendering wait, and encrypted
normalization/posted-anchor overlap. Wells did not switch to a CSV/API reader.
Its bank-specific header IDs must not be guessed for Chase.

A failing fictional regression proved the temporary Chase runner stopped on the
first empty frame and rejected a later valid candidate. It now waits a bounded
35-second response window after dispatch; silence is incomplete, not zero.
New temporary per-card commands are `chase-prime-work-test` and
`chase-sapphire-work-test`; they use the existing extension navigation and do not
auto-capture Overview on authentication. Extension remains 0.4.4, unchanged.

Validation for this continuation: targeted runner/bridge/CLI tests **27/27**;
QC and `git diff --check` pass. Full serial suite: **278 passed / 1 failed**
(279 total). The existing fictional manual-approval concurrency test asserted
`firstCollected === true` but observed false; its isolated rerun passed. Cause
is not established, and the full suite must not be called green. Recovery
inspection reports no disposable test files remain. Preserve this failure for
follow-up rather than weakening the test or increasing timeouts speculatively.

Live results: overview discovery and the subsequent Prime-targeted retry both
reported `activity_capture_no_table`. Each run verified deletion of its temporary
collector evidence, without closing/clearing personal Chrome. No financial data
was retained, no workbook changed, and no Chase account was verified. The runner
bug is fixed, but is NOT established as the cause of the live failure. Next,
establish whether Prime activity actually opened before changing the reader.
The worker's capture-dispatched event proves delivery, not successful navigation
or correct card identity. Do not repeat sign-ins or stack speculative selectors.

### Recovery and temporary work capture continuation

Validation: **273/273** serial core/browser tests passed with zero failures or
skips, including actual Chrome crash recovery and Windows encryption. QC and
`git diff --check` pass. Extension version remains 0.4.4; this continuation
changes the local launcher/recovery/tests, not the extension reader.

Reproduced the intermittent crash-test failure as `tree:ENOENT`: the startup
PID list had exited but Chrome descendants could still mutate cache files.
Process readiness is now checked before tree traversal and again under the
recovery lock. The crash regression waits boundedly for the full read-only
readiness decision; it does not bypass an unknown/running process or unsafe tree.

New `chase-work-test` CLI uses the existing owned disposable lifecycle for
encrypted evidence, not the persistent home store. It preflights encryption,
stops after a candidate/failure/cancellation/ten-minute timeout, drains writes
and bridge connections under bounded cleanup, and verifies deletion. Fictional
tests cover actual Windows encryption, failure, cancellation during writing,
timeout and failed preflight. Ordinary Chrome is not collector-owned and its
cookies/cache are not cleared. No source is certified by these tests.

Before the next live attempt, confirm the running extension was reloaded to
0.4.4; on-disk QC alone does not prove Chrome loaded the updated reader. Keep
real source contents out of agent output. Use only the new temporary command at
work and retain only fixed structural results after cleanup.

### Work extension QC and first Chase fix

The user has now loaded the unpacked extension at work and reports it working.
Baseline QC and all 257 core/browser tests passed on the repeat full run, including
the previously intermittent recovery test. This does not establish its earlier
root cause or prove live account coverage.

Bridge 0.4.4 applies common row-width/text-size checks to both single and paired
Chase tables. It rejects ambiguous repeated column headings and reports overlong
text as a limit instead of silently cutting it. Five new failing regressions
reproduced the prior gaps before the fix. No Wells reader, financial formula or
workbook changed. Reload the unpacked extension once after syncing this code.

Before live testing here, use an explicitly temporary encrypted evidence path
with verified cleanup, not the home refresh CLI's persistent default store.
Evidence cleanup must never delete the personal Chrome profile or claim to erase
its browser-managed bank sessions/cache. No live capture was performed during QC.

Post-change validation: QC and all **242 core tests** pass. The added actual-Chrome
Chase reader test passes after correcting the test injection method (inline page
scripts were blocked by the fictional page CSP; test-injected execution now models
the content script). The full rerun also reproduced the pre-existing forced-exit
recovery failure, this time `ownership_or_process_check_failed`. Do not call the
complete post-change suite green or the recovery issue fixed. Default recovery
inspection reports no disposable test files remain. Next work: diagnose the
recovery failure without weakening ownership checks, then provide temporary
encrypted evidence/cleanup for ordinary-Chrome work testing before live capture.

The user moved core development for **all required accounts** back to the work
machine because home-plan usage prevented practical progress. Port the existing
code/extension to home through `codex/budget-collector`; do not start over or
shift ordinary implementation back home. This supersedes earlier home-only
development and Wells-only expansion instructions. Financial verification gates
and read-only/privacy protections remain unchanged.

### Imported weekend checkpoint

- Fast-forwarded the clean work checkout from `8a50dcb` to `45c8309`.
  Extension manifest is **0.4.3**; collector package is **0.6.1**. These version
  numbers describe different components, not a failed sync.
- Home notes report ordinary-Chrome Wells capture, encrypted normalization,
  observed-footer checking and a repeat-run three-posted-row overlap check.
  Preserve that progress; it is page-level evidence, not complete source or
  workbook certification. Do not transfer the private home evidence/anchors.
- Chase now recognizes separate PENDING and ACTIVITY tables, saves encrypted
  candidate evidence and contains per-card navigation commands. The older 0.4.2
  "no account navigation / exactly one table" description is historical.
  Reliable Overview → Prime Visa → Overview → Sapphire Preferred orchestration,
  identity binding, balances/obligations, normalization, pagination and coverage
  are still incomplete. Product choice alone must not certify captured identity.
- Other institutions still need live adapters. The synthetic registry/fixtures
  are coverage targets, not implemented bank integrations. No verified production
  workbook update or approval-only automated sign-in has been demonstrated.

### Development sequence

September 21 work baseline: collector QC passed. Full serial tests returned
256 passes / 1 failure (257 total): forced-exit recovery reported
`browser_may_be_running`. The isolated rerun passed; the cause is not established
and the full suite must not be recorded as green. Recovery inspection afterward
reported no disposable test files remaining. No live bank test was run.

1. Run current QC plus core/browser tests locally before code changes. Read
   actual extension, reader, bridge and CLI paths, not only historical notes.
2. Finish Chase using reproducible fictional tests of the observed table contract
   and the full command/frame/reader/storage sequence. Diagnose the dependent path,
   not just the first visible error; do not stack guessed fixes or repeat logins.
3. Preserve/fill Wells coverage gaps and build remaining registered institutions
   with separate evidence contracts, sign/status handling, identity, obligations/
   promos, pagination/anchors, and explicit blocked states. Do not fabricate bank
   selectors when source evidence is unavailable.
4. Complete verified local workbook inputs, preservation checks, safe backup/save
   and the one-button launcher. Budget calculations stay in the existing workbook.
5. Publish tested software/extension and clear versioned reload instructions.
   Home setup, bank sessions, private data/backup configuration and end-to-end
   acceptance remain machine-specific. Use home time for those checks, not for
   rebuilding portable functionality.

The prior work-machine extension restriction has not been assumed lifted.
Fictional tests and portable implementation proceed here; do not install/load an
extension or bypass workplace controls without permission. Where live page
evidence cannot be obtained here, explicitly identify that narrow verification gap.
Never call fictional coverage proof that a live institution works.

All dated sections below are historical unless consistent with this checkpoint.

## September 20 Chase adapter start

Bridge 0.4.2 adds a separate Chase discovery command and content reader. It is
not a Chase import: it can only capture one strict visible activity-table
candidate into the encrypted private store. It does not navigate into accounts,
paginate, infer a balance/account identity, or stage any workbook row. Validate
the first live Chase table contract before implementing those source-specific
rules; keep Wells and Chase evidence/reconciliation paths separate.

## September 20 local continuation: normalization implemented

Ordinary-Chrome bridge 0.3.13 captures live Wells activity and source context.
It never automatically traverses Next. The local CLI normalizes private table
evidence, checks the observed totals footer, then uses the newest encrypted
normalized capture as a three-row overlap anchor on the next refresh. Missing
overlap blocks instead of sweeping history or guessing. A live rerun completed
that overlap check with no newly unmatched current-page rows. Raw and normalized
records remain encrypted outside Git. The full 223-test suite and QC pass. This
does not certify account-wide pagination or the workbook input boundary; those
remain explicit development tasks.
Continue from `collector/src/wells-normalize.mjs`; preserve the working reader.

## Purpose and authority

The user entrusts this project to preserve the complete path from work-machine
development to successful home-machine use. Do not rely on conversation memory,
make the user re-explain decisions, or hand off a prototype as a finished product.
Read this document with `AGENTS.md`, `docs/BUDGET_COLLECTOR_VISION.md`, and
`collector/README.md`. Update this checklist after each relevant milestone.

Build and test all portable functionality on the current machine. The home
handoff should be installation, private-data setup/migration, sign-in, and
acceptance testing, not a second implementation project. An item deferred to home
must have a concrete machine-, session-, or private-data-specific reason.

GitHub transfers software and instructions, not banking data. Disposable work
tests must delete their financial records and browser profile after shutdown;
preserve only reusable code, generic navigation rules, invented regression data,
and non-sensitive test outcomes. Production history and reconciliation anchors
must persist privately at home and must never use the disposable cleanup mode.

## Current checkpoint — September 18, 2026

### Home development resume — latest decision, overrides older next-step guidance

**Authentication correction:** the user is NOT agreeing to manually sign in each
week. The collector must open the institution, use Chrome's normal configured
saved-credential/autofill flow, and complete ordinary sign-in navigation/submission.
The user's intended routine role is only text-code/2FA approval if required.
This supersedes all older manual-sign-in wording, including historical pilot steps.
No saved-password extraction, credential logging/storage, cookie/profile copying,
security bypass or programmatic MFA interception is authorized. A missing autofill,
required browser gesture, CAPTCHA or other challenge must produce an honest
exception, not a bypass or a silent return to weekly manual login. This capability
is unimplemented and must be established and tested on the home machine before
claiming the approval-only experience works. First-time connection/setup permission
may still be needed; it is distinct from the desired weekly routine.

This checkpoint is ready to transfer **development**, not a finished weekly
collector. Earlier requirements for a complete production handoff remain release
gates, not claims that they have been met. The user now wants to continue live
browser integration at home: extensions cannot be installed at work. Do not
restart work-machine live pilots, repeat screenshots, or chase bank styling.
Portable code and fictional tests remain reusable; this is not an architecture reset.

- **Sync path:** `codex/budget-collector` on the shared repository, not `main`.
  Inspect local status before fetching/switching. Preserve all local workbook,
  builder financial inputs, history, private settings and uncommitted changes.
  Never reset, auto-stash, publish private changes, or overwrite the home workbook
  with the repository snapshot. If switching would overlap local edits, use a
  separate clean software checkout outside cloud-synced private-data folders and
  leave the existing checkout untouched. Do not migrate private data during sync.
- **First home step:** confirm OS, Node and installed Chrome, then establish a
  supported, least-privilege local browser connection. Current code launches a
  separate disposable Chrome profile; it cannot yet attach to ordinary Chrome.
  The user prefers normal Chrome with browser-managed saved sign-ins. This is a
  preference, not proof that a safe connection exists. Extension/native messaging
  was researched only; no extension or connector was implemented or installed.
  Ask before installing an extension or granting persistent access. Do not bypass
  policy, expose a debugging endpoint, extract passwords, or copy profiles/cookies.
  If the supported route requires a different profile, explain the tradeoff before
  changing the user's setup. The current encryption layer requires Windows;
  non-Windows support is unverified and needs implementation/testing.
- **First functional milestone:** reuse the activity reader and reconciliation
  foundation to prove one full, read-only Wells collection: account identity,
  balance meanings, all current pending activity, posted overlap/anchor, pagination
  and independent coverage checks. Unknown or missing evidence blocks verification.
  A captured table alone is not a complete source. Collector handles normal
  sign-in via the approved browser flow; user handles required text-code/2FA;
  navigation should become code-driven, not a repeated weekly user chore.
- **Privacy:** real evidence stays in a private local location outside Git/cloud
  sync with encryption and explicit retention. Never use disposable cleanup on
  persistent home history. Never send private page text or screenshots to the
  agent by default; anything viewed by an AI enters that conversation. Git carries
  code, docs and entirely invented fixtures only. No workbook update until all
  relevant sources and preservation/financial checks pass.
- **Scope:** stop expanding institutions until Wells is verified. No new workbook
  design, infrastructure detour or repeated cosmetic troubleshooting. Routine
  Tuesday execution must run locally without an AI session or Git operation.
  The audited screenshot workflow remains the fallback until acceptance passes.

**Not yet verified:** ordinary home Chrome connection, home OS compatibility,
successful complete Wells collection, other live adapters, private migration/
backup/restore, workbook integration, production launcher and weekly shadow cycles.
No actual workbook has been updated by this collector.

### Home preflight — September 19, 2026

- Synced the local checkout to `codex/budget-collector` at `8a50dcb` before
  implementation and confirmed the working tree was clean. No local workbook or
  private financial file was migrated, overwritten, or published.
- Confirmed Windows, Node.js 24.19.0, installed Chrome 152.0.7977.84 and the
  pinned `playwright-core` dependency. The full local fictional core suite
  (204 tests) and serial browser suite (15 tests) now pass on this machine.
  No bank page, browser profile, account, workbook, or financial evidence was
  accessed by those tests.
- This Windows profile blocks `.ps1` files through execution policy. The private
  DPAPI and process-inspection helpers were made compatible without changing the
  policy, adding an execution-policy bypass, or placing pipe payloads on a command
  line. They continue to fail closed with no plaintext fallback. This is only an
  environment/preflight correction; it does not establish an ordinary-Chrome
  collector connection.
- The next gate is still a least-privilege connection to ordinary home Chrome.
  The feature branch now contains an **uninstalled** manifest-V3 Chrome bridge
  and a loopback-only session handshake, both covered by fictional tests. Its
  permissions are restricted to Wells Fargo and `127.0.0.1`; it can report only
  bounded non-financial connection state and rejects raw page data. No collector
  extension, persistent browser permission, debugging endpoint or profile
  attachment has been installed or enabled. Obtain the user's approval at the
  exact installation/permission step, then prove one full read-only Wells
  collection before creating another institution adapter.
- The bridge now also has an explicit local development launcher
  (`pnpm --dir collector bridge:chrome`). It binds only to `127.0.0.1`, exposes
  no bank or financial data, and is intentionally separate from the future
  Tuesday launcher. It was tested with fictional HTTP clients only. Starting it
  does not open Chrome or Wells; extension installation and its permission remain
  a present-user confirmation gate.
- **Attended connection check (September 19):** the user installed the reviewed
  extension into ordinary home Chrome and initiated Wells through its action.
  Chrome reached an authenticated checking activity page without the collector
  reading, storing, logging, or exporting credentials. This establishes that the
  supported extension/loopback connection and ordinary Chrome session path can
  reach Wells. It is not a Wells collection pass: the bridge intentionally has
  no financial capture endpoint, source-specific mapping, pagination coverage,
  encrypted persistent evidence, or workbook update. No source values were saved
  by collector code or added to Git.
- **Automatic opening and encrypted capture check (September 19):** the installed
  extension consumed a one-shot local `open_wells` command, opened Wells without
  a toolbar action, and completed one bounded activity-table candidate capture
  after authentication. The candidate was written directly to the home private
  encrypted evidence store; normal bridge status exposed only fixed connection
  states, not source text, amounts, account details, or a preview. The one-time
  launcher and loopback bridge were then stopped. No workbook was read or changed,
  and no financial data was added to Git.
- The approval-only sign-in objective is still not certified. The automatic
  opening worked, but the development agent could not select Chrome's saved
  password or submit bank authentication; those actions remain protected browser
  interactions. Test ordinary Chrome's allowed autofill/sign-in behavior during
  home acceptance without extracting credentials or bypassing security. Any
  additional required gesture/challenge must be recorded as an exception.
- This is a replacement for the manual extension-action step, not the completed
  Tuesday refresh: balance mapping, complete pending/posted coverage, pagination,
  source-specific validation, normalized reconciliation, workbook gates, and a
  local scheduler/launcher still remain.

For the publishing commit, use the Git commit containing this section and version
0.6.1; verify the exact local HEAD equals the remote feature-branch hash. Do not
mistake the older 0.6.0 commit `8b8ac16` or the current main branch for this update.

### Version 0.6.1 heading recognition and structural diagnostics

- Publication validation on September 18: full serial core/browser suite passed
  **223 tests**, zero failures, cancellations or skips (Node 24 on work Windows,
  installed Chrome). This includes actual DPAPI, fictional browser extraction,
  privacy boundaries and interrupted-run cleanup; no bank was accessed by tests.
  Workbook/builder were unchanged, so workbook builds/formula scans were not rerun.
  No UI styling changed in this patch; previous fictional visual QA remains the
  recorded baseline, not a new home or Wells visual verification.

- The attended v0.6 reader returned `no_activity_table`; this was not evidence of
  zero transactions. Its disposable browser and records were removed and deletion
  verified. Subsequent demonstration sessions made no activity captures and were
  also closed with verified cleanup before the reader update.
- The user demonstrated: sign in; zoom out and scroll to Everyday Checking;
  open checking; zoom out and scroll to the transaction section. Repeated uploaded
  images were duplicates, not additional pages or separate coverage evidence.
- The user explicitly requested joint visual inspection. This narrowly permits
  viewing the designated pilot after authentication, not credential/session-token
  exposure or financial Git uploads. Computer Use could not safely support the
  address-bar/full-screen combination; do not repeat that loop or bypass its
  checks. Cropped user-provided webpage images supplied the generic layout.
- Reader correction: recognize sortable heading-button labels, strip only known
  sorting suffixes for column matching, and distinguish a unique column-heading
  row from pending/posted section headings. Keep source strings and section rows
  in private evidence; do not infer coverage, zero pending or transaction status
  merely from successful recognition. Multiple qualifying header rows still block.
- New bounded diagnostics report only fixed structural reasons, recognized column
  roles, counts and shadow-root presence. They explain hidden/form/nested/unknown
  tables without exporting private labels, URLs, identifiers or account values.
- Fixtures use generic visible labels and entirely invented transactions, not
  uploaded financial data. The parser is tested with tall banners, off-screen
  tables, zoom and scroll. This does not implement automatic bank navigation or
  prove real-page extraction; the next gate remains an attended activity read.
- Workbook/builder unchanged; software remains on `codex/budget-collector`, not main.

### Version 0.6 activity-reading milestone (supersedes structure-only scope below)

- Implemented a bounded generic activity-table/grid reader, separate local capture
  consent, encrypted disposable evidence and opt-in local row preview. It preserves
  displayed text rather than guessing date years, signs, status or missing values.
  Normal state/CLI receives only validated structural enums/counts. The private
  preview is token-protected, same-origin POST, no-store, rendered as text only.
- Authentication controls block reading. Forms/field values, scripts, browser
  storage, URLs and HTML dumps are excluded. Unknown layouts, hidden/interactive/
  uneven/spanned rows and truncation remain explicit. No bank controls are clicked.
- This does not implement a certified Wells adapter or claim source completeness.
  Account identity, current/available balances, pending coverage, posted overlap,
  pagination and independent controls still need actual source-specific mapping.
- Next attended step: open checking activity once for development, use **Read
  activity locally**, optionally compare the private preview, and use the
  structural-only result to finish source mapping. No bank screenshots or private
  text should be sent to the agent. Stop/cleanup retains only reusable software.
- Keep the immediate milestone narrow. The user challenged the slow progress;
  prioritize one successful real Wells read before further infrastructure or
  multi-institution expansion. Weekly manual navigation is not the intended product.
- Workbook/builder unchanged. Home deployment and integration into main remain gated.
- Validation: all **221** core/browser tests passed with no failures or skips.
  Fictional start and activity-preview layouts were visually inspected at 1280px
  and 700px; table values and controls were readable. The generic reader still
  needs an attended Wells extraction test; these results do not certify it.

### Prior milestones and unchanged release gates

- Current implementation: collector version `0.5.1`, the Wells visual-resource
  correction, on `codex/budget-collector`. Pre-edit baseline `647be20` / `0.5.0`
  passed all 205 tests again before this work. The exact media-host exception and
  public evidence are documented in `docs/WELLS_ASSET_REVIEW.md`. Workbook/builder
  files were unchanged, so no financial workbook was rebuilt or uploaded.
- Version 0.5.1 validation: **209** core/browser tests passed, zero failures/skips,
  on the work Windows machine. New checks cover exact media hosts, matching static
  resource types/extensions, denied submissions and type-aware redirects. Chrome
  rendered fictional CSS/cross-host CSS import/SVG through the real permission
  handler while denying scripts, fetches and navigation. RecoveryCheck reported no
  disposable test files remaining. No bank assets were fetched by regression tests.
- First attended v0.5 attempt: sign-in reached an unstyled summary, zero outlines
  were saved, and browser shutdown/profile-record deletion were verified. No
  account values, identifiers, private URL or screenshot were retained in Git.
  The old policy blocked publicly referenced media resources. Version 0.5.1 adds
  GET-only visual types on three exact reviewed hosts, with matching extensions,
  no queries and method/type-aware redirects. This is not a successful collection.
- Attended v0.5.1 retry: the user reports styling still broken, but checking
  activity and its transactions were accessible manually. The launcher confirmed
  **zero outlines saved**, browser exit and removal of the owned profile/records.
  No transactions were extracted or reconciled and the workbook was not changed.
  User explicitly deprioritized bank-page styling: success is complete, accurate
  collection with automatic read-only navigation, not a visually normal bank page.
  Do not request another sign-in merely to troubleshoot appearance.
- Visual QA: fictional start/results screens at 1280px and results at 700px were
  inspected for readable controls, wrapping and clipping. Previews were deleted.
  One preview lost its input pipe; only its verified helper was stopped, Chrome
  exited, and the explicit recovery tool verified removal. The repeat interactive
  preview shut down normally; its helper now also expires after two minutes.
- Implemented: synthetic source contracts/reconciliation, Windows user-bound
  encrypted storage, disposable test cleanup, actual Chrome against fictional
  local pages, grouped sign-in readiness, bounded collection, cancellation,
  explicit stopped-test recovery, bounded text-free page-structure inspection,
  and a separately gated visible Wells pilot with private local controls.
- Not implemented: real bank readers, verified authenticated navigation,
  production refresh-lock/recovery UI, verified-input/workbook integration, full
  movement reconciliation, private migration/backup/restore, and production
  one-button deployment. A candidate is not a verified workbook update.
- No real bank has been read by the collector. No actual workbook has been
  updated by it. No home deployment or home compatibility test has occurred.
- Home operating system is **unconfirmed**. The current encryption implementation
  is Windows-specific. Resolve this before claiming home compatibility; if home
  is not Windows, adapt and test the storage/platform layer here first. This
  unknown does not prevent portable reader and workbook-boundary development.
- Collector work is **not yet on main**. Pulling main alone does not retrieve this
  branch. Do not tell the user that their usual main-sync routine includes it.

## Controlled Wells pilot: historical implementation reference

The commands and sequence below document the existing disposable pilot, not an
instruction to restart it at work. The Home development resume section above
controls the next action and where live testing occurs.

1. **Implemented and fictional-tested:** a separate visible browser path with a
   reviewed Wells destination restriction; the fictional transport stays
   loopback-only. `Test-Collector.ps1 -Mode WellsPilot` opens local controls, not a
   bank. After encryption preflight, the user's acknowledgement and **Open Wells**
   action open the public Wells Sign On page. HTTPS Wells domain-family
   destinations, the private panel and the reviewed GET visual-asset exception
   are permitted; redirects retain source-method/resource-type checks. Unreviewed domains,
   WebSockets, unknown popups and child-frame requests are blocked. No automatic
   bank clicks, field entry, transfers or security bypasses. Real sign-in may need
   a blocked component; stop and review, do not bypass it. These page restrictions
   are not an OS firewall or a prevention mechanism for user-initiated payments.
2. Implement and test interruption recovery before collecting live records:
   identify only owned test processes/directories, handle cancellation and failed
   startup, preserve unrelated profiles, and verify cleanup. Unknown ownership or
   a running process blocks deletion and another test; never claim success.
   **Implemented for supported disposable runs:** `recover-test` is inspection
   only; `recover-test --confirm-cleanup` checks ownership and current process
   ancestry again before removal. A fictional Chrome test deliberately exits the
   collector without cleanup, then verifies recovery after browser exit. No
   process is killed by recovery. Unknown ancestry/legacy or damaged markers and
   an interrupted recovery itself still block and need review.
3. Keep page contents, sensitive URLs, IDs, balances, and transactions out of
   agent output, logs, Git, and chat. Establish local encrypted source evidence
   and a safe structural-inspection method for reader development. Do not treat
   redacted page inspection as proof of financial coverage.
   **Implemented structural boundary:** only a fixed tag/role vocabulary and
   bounded topology leave the page. No text, values, attributes identifying the
   account, link destinations or form contents are exported. Frames/truncation
   remain explicit limitations. Financial source-evidence extraction is not yet
   implemented; the structural report always says coverage is unverified.
4. **Next development step: functional reader, not styling.** Build/test the
   local-only evidence/mapping boundary and bounded read-only navigation needed
   for the Wells reader. Then use an attended session to validate the actual
   account layout and capture completeness. An outline may help map the page but
   is not itself a transaction extraction test. Do not guess selectors or ask for
   bank screenshots/private URLs; keep real source evidence encrypted locally.
   Unstyled pages are acceptable if required data, controls and pagination work.
   Investigate blocked dependencies only when they prevent those functions.
   Use PilotRehearsal for a fictional walkthrough first if useful. No new Google
   account or manual Chrome-profile setup is required; do not use Chrome sync.
   The panel has Stop & clean up; closing the account/control tab, interruption,
   a 20-minute expiry or a stuck operation stops the session. At most 12 outlines
   are accepted; encrypted records and the profile are removed after proven exit.
   Launcher confirmation is required. Visible transactions alone are not a
   completeness pass. Manual account selection during development/onboarding must
   not become a weekly requirement: normal operation should need sign-in/MFA plus
   genuine exceptions, with the collector handling account navigation/pagination.
5. Inspect the actual account views locally, implement the reader, and verify
   account identity, balance meanings, all current pending activity, posted
   activity through the anchor/overlap window, and complete pagination. Reconcile
   independent counts/totals or a documented equivalent coverage method. Missing
   evidence blocks verification; do not invent a control the bank does not show.
6. Record non-sensitive coverage outcomes and timing measurements, not actual
   financial values. Distinguish login-wait time from collection time; a waiting
   duration is not a measurement of the user's active effort. Verify removal of
   the complete disposable test directory. Keep only generic code and entirely
   fictional tests for regression and home deployment.

This first pilot does not authorize a partial-source update to the real workbook.
The full source set, workbook checks, and preservation gates still apply.
The controls are implemented and fictional-tested; the next work is the local-only
evidence/mapping boundary and read-only navigation/reader, followed by an attended
functional source-validation test. A text-free outline alone cannot identify merchants, balances, labels,
pagination semantics or account identity. Design and validate the next local-only
evidence/mapping boundary here; never export real page text to the agent as a
shortcut or ask the user to rebuild this functionality on the home machine.
Public-only research on September 18 confirmed the Sign On link from
[Wells Fargo's online-banking page](https://www.wellsfargo.com/mobile-online-banking/)
targets `https://connect.secure.wellsfargo.com/auth/login/present?origin=cob`.
The implemented domain restriction is deliberately conservative, not certification
of authenticated redirects/supporting domains or account navigation. Do not
substitute guessed selectors or call the financial reader implemented on this basis.

## Portable work required before home handoff

- [ ] Confirm the target operating system; document/test supported runtime and
  Chrome versions. Supply a repeatable dependency installation and preflight
  path. Current core requires Node.js 22+ (tested on 24); the Chrome demonstration
  pins `playwright-core` in `collector/pnpm-lock.yaml` and uses installed Chrome.
- [ ] Remove reliance on this work machine's username, absolute paths, bundled
  runtime locations, development junctions, or account-specific browser state.
  Inventory and package the existing workbook builder's dependencies as well as
  the collector's; a working browser demo alone is not a deployable budget tool.
- [ ] Complete the controlled Wells pilot above and retain reproducible fictional
  regression tests for the observed source layouts and edge cases.
- [ ] Implement/test every required institution and obligation/promo page against
  the explicit registry. Do not call an account covered because its balance loads.
- [ ] Add safe sign-in/session-expiry recovery and retry of failed sources, with
  freshness checks for earlier captures. Minimize serial login waiting without
  bypassing MFA. Test cancellation, timeouts, changed layouts, and lost sessions.
- [ ] Complete encrypted evidence retention, explicit transfer/payment links,
  exception handling, transaction lifecycle history, and idempotent repeated runs.
  Keep categorization and financial decisions in the existing workbook model.
- [ ] Build the verified local-input boundary and private settings/manual-event
  storage. Preserve actual home inputs, categories, safe-cash additions, scheduled
  transfers, payment statuses, history, rent rules, AT&T treatment, formulas,
  sheet order, formatting, validations, and audit infrastructure.
- [ ] Replace any informational-only formula-scan message with actual blocking
  formula/consistency checks. Compare Start/Tuesday cash outputs exactly, require
  all relevant sources, and leave the prior workbook untouched on any failure.
- [ ] Implement one verified build/save, recoverable private backups, restore
  testing, and software rollback compatibility. Windows-user-bound encryption is
  not by itself a hardware-loss backup or a cross-machine migration format.
- [ ] Build migration/dry-run tools here using fictional workbooks and settings.
  They must preserve the latest home workbook and history, not replace them with
  an older repository snapshot. Verify a backup before any real migration.
- [ ] Supply the home launcher, clear consolidated status, private configuration,
  guided recovery, local opening of the verified workbook, and same-week replay
  protection. Routine refresh must require no AI session and must never run Git.
- [ ] Exercise a clean installation using an alternate username/path and no work
  profile/cache assumptions. Use fictional data here; document remaining home
  verification without declaring untested compatibility.

## The only justified home-specific steps

| Step | Why it must be confirmed on the home machine |
| --- | --- |
| Run packaged installation/preflight | Actual OS, runtime, Chrome, permissions, and policies are properties of that computer. Develop the installer/checks here. |
| Create private store and backup configuration | Encryption binds to that Windows user; home storage paths and recovery targets are private/local. Do not copy the work test store. |
| Establish bank sessions | Device trust, passkeys, MFA, and session expiry belong to the user's home browser. Do not export cookies or copy the work profile. |
| Migrate the latest actual workbook/settings/history | The authoritative home copy may contain newer private edits than the repository. Develop/test migration here, execute against the real private copy there. |
| Verify a complete home refresh and recovery | Actual browser/network behavior, workbook rendering/runtime, permissions, and storage behavior require a home test. |
| Complete three to four weekly shadow cycles | Cross-week transaction transitions, source coverage, and real Tuesday usability require successive real periods. Keep the audited fallback until these pass. |

Missing code, unimplemented readers, or an unfinished launcher are not valid
reasons to shift development to the home machine.

## GitHub release and ordinary-sync gate

- [ ] Review the complete branch diff for financial data, private settings,
  credentials/session state, captured HTML, screenshots, generated workbooks,
  machine-specific dependencies, and untracked sensitive artifacts.
- [ ] Run core/browser/preservation checks, the genuine formula-error scan where
  workbook code changed, affected visual checks, and `git diff --check`. Record
  what passed and what remains unverified without saving financial test results.
- [ ] Preserve the latest local financial files before syncing or migration.
  Never reset, discard, auto-stash/publish, or overwrite local financial changes.
  An ignored legacy workbook can still be tracked; ignoring is not migration.
- [ ] Integrate the reviewed portable software and these operating instructions
  into `main`, push, and verify the exact remote commit. Do not merge merely to
  imply production readiness; keep unfinished live/production features gated.
- [ ] Test the documented main-sync/install path from a clean checkout. Separate
  software updates from private data; a Git pull does not migrate financial data,
  establish bank sessions, or prove successful installation.
- [ ] Record the released commit, supported platform/dependency versions,
  installed capabilities, remaining home actions/reasons, rollback procedure,
  and acceptance results here. Keep user-specific values in private local state.

**Ready for home handoff** means the portable software is implemented, tested,
available through the documented sync path, and accompanied by working setup and
migration tooling. **Ready for weekly use** additionally requires home acceptance
and shadow-cycle success. Neither means merely passing fictional collector tests.
# September 21 Chase audit continuation

Bridge source is now 0.4.3. Corrected real blockers: Chase disallowed in encrypted
store, invalid Chrome listener acknowledgment, and rejection of separate pending
and posted tables. Runtime regression tests plus complete suite: 235 passed; QC
passed. Unknown/dashboard preview tables cannot pass as account detail. Signed-out
pages cannot be inferred authenticated merely because no password field is present.

Live result remains unverified: Chase signed out during the pause. Desktop reload
attempt failed with unavailable input geometry, then failed activation. User reload
and renewed session are needed unless desktop control recovers. No claim of either
card's successful collection is justified yet. Pair sequencing is not implemented
just because `CHASE_COLLECTION_SEQUENCE` exists. Continue on real detail-page
evidence, verify separate card identity and capture coverage before workbook use.
