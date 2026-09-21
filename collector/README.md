# Local Budget Collector — controlled Wells pilot and encrypted storage

## Current checkpoint — September 21

### Temporary Chase testing on the work machine

Card-specific temporary commands are `node collector/src/cli.mjs
chase-prime-work-test` and `node collector/src/cli.mjs chase-sapphire-work-test`
(run each as one line). They request the existing product-selection path without
automatically capturing Overview on an authentication event. Product selection
is not evidence of captured account identity. Authentication/card navigation is
still not certified; these are development commands, not the weekly workflow.

The temporary runner now allows 35 seconds after capture dispatch for independent
frame responses. An early empty frame cannot reject a later valid candidate;
no response is incomplete, never zero activity. This changes the local runner,
not extension 0.4.4, and needs no extension reload. The attended Prime retry still
reported `activity_capture_no_table`; encrypted test evidence deletion was verified.
Do not change table selectors without establishing the actual destination/layout.

Use `node collector/src/cli.mjs chase-work-test` (or
`pnpm --dir collector chase:work-test`) for an explicitly attended development
capture. This queues one Chase discovery in the installed ordinary-Chrome bridge,
not a certified card import. Reload the extension to **0.4.4** before testing.
Normal home `chase-refresh` commands still use persistent storage; do not use
them for temporary work evidence.

The work command checks encryption before opening a bank-command connection,
stores only in an owned `BudgetCollectorTesting/run-<id>` outside Git/OneDrive,
and stops after a candidate, a terminal failure, Ctrl+C, or ten minutes. It drains
encrypted writes and closes the local bridge before verified removal. Cleanup
failure blocks further tests and never prints a false deletion confirmation.
Status is structural only; no raw financial text, workbook writes, or home-store
access. A crash requires the existing explicit recovery checks.

This mode does not own, close, copy or clear personal Chrome. Its bank cookies/
cache, employer/OS logs and previous chat images are NOT removed by collector
cleanup. The intended approval-only sign-in workflow is still unverified.

Latest extension: **0.4.4** (collector package remains 0.6.1). Chase now validates
row shape/text limits consistently for both activity sections and rejects ambiguous
column headings. Reload the unpacked extension once after syncing. The user
successfully loaded it on the work machine; this is not yet live source certification.
Do not run the home persistent-evidence refresh commands for temporary work tests;
the temporary encrypted storage/cleanup boundary must be used first.

Core development for all account adapters now takes place on the work machine;
tested code/extension is then synced to home. Follow the newest
[handoff checkpoint](../docs/HOME_MACHINE_HANDOFF.md), not older home-only or
disposable-pilot instructions below. Preserve the weekend implementation at
`45c8309`: extension **0.4.3**, collector package **0.6.1**.

Wells has a working home capture/normalization/overlap milestone reported in the
handoff, not complete source certification. Chase is the active next adapter:
separate pending/posted tables and per-card commands exist, but robust paired
navigation, account identity, obligations, normalization and coverage remain.
Other banks still need source-specific adapters. No production workbook update
or approval-only sign-in flow is certified. Work extension permission remains
unconfirmed; portable tests do not require installing it into personal Chrome.

The actual extension permits Wells, Chase and loopback. It uses short-lived
tab-scoped debugger clicks for account navigation, not a remote debugging endpoint.
Earlier statements below that it has Wells-only permissions, never uses debugger,
or cannot capture financial evidence describe older milestones, not version 0.4.3.

## September 20: live normalization checkpoint

The local `wells-refresh` callback now saves raw evidence, parses Wells section
rows into signed integer amounts and dates, validates an observed Totals footer,
and saves normalized evidence encrypted locally. Console output contains only
counts and fixed issue codes. Extension 0.3.13 does not automatically traverse
Next. A later refresh selects the newest encrypted normalized Wells capture,
requires a three-row overlap anchor on the current page, and identifies only
unmatched current-page rows. If that overlap is absent, collection blocks rather
than sweeping history or guessing.
Four fictional regression tests cover duplicates, date ambiguity, malformed rows,
privacy of diagnostics, and mismatched source totals; the full 217-test suite and
collector QC pass. This is page-level evidence, not certification of account-wide
coverage. Account identity, summary balances, pagination, history reconciliation,
and workbook mapping remain explicit gates. No workbook was changed.

## Chase discovery adapter — September 20

Extension `0.4.2` adds a separate, read-only Chase discovery path. It opens or
reuses one ordinary Chase tab, waits for the existing Chrome session/sign-in
flow, and only seals an encrypted local candidate when exactly one visible table
has Date, Description, and Amount-style columns. It does not reuse Wells
selectors, click a Chase account, guess account identity/balance meaning, page
history, or write the workbook. An unrecognized layout, authentication control,
or a source requiring account selection blocks capture rather than producing a
false import.

Run this development-only path with `pnpm --dir collector chase:auto` after one
extension reload. The first run records a private Chase table contract and fixed
structural outcome only. Account mapping, pending/posting treatment, overlap,
and ledger staging remain Chase-specific gates. Raw rows stay only in the local
encrypted store and never enter Git, command output, or the workbook.

Chase has two distinct card sources: **Prime Visa** maps to the existing
workbook account **Prime Visa**, and **Sapphire Preferred** maps to the legacy
workbook account **Chase**. A source label is never used to infer the workbook
target. The required future orchestration is Overview → Prime Visa capture →
Overview → Sapphire Preferred capture → paired validation. A failed return to
Overview blocks the pair; it cannot reuse one card's activity for the other.

Short source years are resolved only within the ten-year window ending in the
evidence capture year. Source IDs remain null when unavailable; identical rows
are preserved. No pending-to-posted match or spending category is inferred.

## Resume at home: development checkpoint, not a finished collector

### Direct-page-reader reset — September 20

The installed bridge polls the loopback collector through Chrome's supported
MV3 alarm while a local refresh is running. It opens or reuses one Wells tab and
uses the existing page content script; it never creates a localhost trigger tab,
launches a second Chrome profile, or attaches a debugger. This is still a
development capture only—not a complete Wells source verification or workbook
update. A content-script update requires one development-time extension reload;
that setup action does not belong in the eventual weekly routine.

Sync `codex/budget-collector`, not just `main`, and read the
[latest home continuation instructions](../docs/HOME_MACHINE_HANDOFF.md#home-development-resume--latest-decision-overrides-older-next-step-guidance).
Preserve local financial files and edits before any branch change. Work-machine
live testing has stopped because extensions cannot be installed there. Do not
repeat the old pilot or styling investigation as the default next action.

The existing code now has a supported, user-approved ordinary-Chrome bridge on
the home Windows machine. It never attaches to or copies a profile, and it never
extracts credentials, cookies, or form values. The bridge can open Wells from a
local command without a toolbar click and, after an authenticated page is reached,
seal a bounded activity-table candidate in the private local evidence store.
The collector must use Chrome's configured saved-credential/autofill flow for
ordinary sign-in; the intended weekly role is only text-code/2FA approval when
required. System/browser restrictions prevented the development agent from
selecting a saved password or submitting the sign-in form, so that exact
approval-only path remains an explicit home acceptance gate rather than a claim.
No complete, verified Wells run or workbook update has succeeded. The intended
weekly run uses local code without an AI session; that production workflow is
unfinished.
Older pilot instructions below are implementation reference, not the new plan.

### Ordinary Chrome bridge — installed home development connection

`chrome-bridge/` contains the reviewed Manifest V3 extension and
`src/chrome-bridge.mjs` contains its loopback-only local handshake. It is the
first candidate for a supported ordinary-Chrome connection; it does not attach to
or copy a browser profile, enable a debugging endpoint, or require Chrome sync.

- Its sole remote host permission is the Wells Fargo domain family; its only other
  host permission is `127.0.0.1` for the local collector process.
- A local `wells:auto` command creates an in-memory, per-run local session and
  instructs the installed extension to open the official Wells sign-on page. The
  extension action remains a development fallback, not a weekly requirement. It
  does not read, fill, submit,
  save, or transmit credentials, cookies, form values, page text, balances, or
  transactions.
- It may report only bounded connection state: Wells opened, authentication
  control visible, authenticated page visible, or encrypted activity capture
  complete. The local bridge rejects raw page content from normal status output
  and binds only to loopback.
- The user installed and approved the extension in ordinary home Chrome. A live
  automatic Wells opening and one encrypted activity-candidate capture have
  completed. This does not verify saved-credential submission, source completeness,
  or any workbook integration.

The bridge's connection tests are entirely local and fictional. They do not
access a bank page or browser profile.

For connection-development only, the loopback service can be started from the
repository root with `pnpm --dir collector bridge:chrome` (or
`node collector/src/cli.mjs chrome-bridge`). It binds exclusively to
`127.0.0.1:43811`, reports only the three bounded connection states, and exits on
Ctrl+C. It does not launch Chrome or Wells, install the extension, access any
profile or financial data, or change the workbook. It is not the future weekly
launcher. The user must be present and confirm at the exact Chrome-extension
installation step before this can connect to Chrome.

`pnpm --dir collector wells:auto` is the corresponding **development-only**
local command path. It queues one non-financial `open_wells` instruction; the
installed bridge polls the loopback process and opens the official sign-on page
without an extension-toolbar click. The command remains running until stopped so
it can report bounded sign-in state, but it cannot read credentials, capture
financial information, update the workbook, or schedule itself. The production
Tuesday launcher will replace this development command only after the encrypted
Wells adapter and complete source-validation gates exist.

Version `0.1.2` adds a bounded Wells activity-table candidate capture after an
authenticated local command. The candidate is sealed in the private local
evidence store before anything else can reference it. It remains unverified:
no balance mapping, pagination/coverage proof, normalized transactions or
workbook update is enabled.
After a source update, Chrome must reload the unpacked extension once from its
Extensions page before that code can run. Reloading the extension is a
development/setup action, not part of the intended Tuesday routine.

This is the development foundation for the user's Tuesday **Refresh Budget** workflow.
It is runnable software with fictional test data, a tested Windows encryption
layer, disposable Chrome demonstrations, and a separately gated manual Wells pilot.
The pilot can open Wells after user acknowledgement. Version 0.6 adds an explicit,
private activity-table read: raw table strings are encrypted in the disposable run
and optionally previewed in the local panel. It does not certify a real source,
create the user's home financial store, or update the workbook. The account examples describe
coverage targets, not certified integrations or current household balances.

For the complete home-deployment path, current compatibility unknowns, next live
pilot gates, and the required integration into `main`, read
[the home-machine handoff checklist](../docs/HOME_MACHINE_HANDOFF.md). A successful
fictional demonstration is not a finished or home-certified budget system.

## Run without an AI session

Requires Node.js 22 or newer (tested here on Node.js 24). The core demonstrations
and core tests require no downloaded packages, API keys, browser access, or
accounts. From the repository root:

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

### Browser demonstrations — still fictional, never a bank login

The browser features additionally require installed Google Chrome and the pinned
`playwright-core` dependency. Install once from `collector/` with
`pnpm install --frozen-lockfile --ignore-scripts`. This does not download another
browser. Then, from the repository root:

```powershell
.\collector\Test-Collector.ps1 -Mode BrowserTest
.\collector\Test-Collector.ps1 -Mode BrowserDemo
.\collector\Test-Collector.ps1 -Mode BrowserInteractive
```

`BrowserDemo` runs without a visible window. `BrowserInteractive` intentionally
opens a separate Chrome window and four fictional approval tabs. Press **Simulate
approval** on each fictional institution page, or **Cancel test and delete its
data** on the status page. There are no credential fields and no real MFA. Do not
enter real account information into this demonstration.

**No new Google account and no manual Chrome-profile setup are needed.** The
program creates the empty disposable profile automatically. Do not sign it into
Chrome sync or import passwords. Your normal personal Chrome profile is not
opened, copied, or cleared. Bank sign-ins in the separate Wells pilot are separate
from Google/Chrome sign-in; the user alone will perform them.

The demonstration reads five fictional accounts across four sign-in groups,
including two cards sharing one institution session. It uses actual DOM tables,
overlapping activity pages, independent counts/totals, obligation pages, and a
promotional-plan page. All sign-ins become available together; ready institutions
collect while others await approval, with at most two collecting concurrently.
Accounts sharing one session are collected sequentially. A final freshness check
prevents publishing a candidate if an earlier source has become stale.

The elapsed/login-wait/collection measurements are wall-clock diagnostics, not a
claim about actual human effort or real bank speeds. The reader has no real bank
selectors. Page requests are restricted to the fixture server's exact loopback
origin; real URLs are rejected. Chrome uses its normal sandbox and certificate
checks. The test does not circumvent workplace browser policies or bank security.

On success, task failure, or graceful cancellation, browser shutdown runs before
deletion. The launcher waits for the recorded Chrome processes to exit, then
removes the profile, any contained browser artifacts, and encrypted evidence.
Unknown shutdown/cleanup outcomes block another test. Ctrl+C is handled by the
demonstration launcher; forced process termination or power loss is still an
interrupted-run recovery case, not a guaranteed immediate cleanup.

Implementation references: [Playwright separate persistent contexts](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context),
[Chrome's dedicated debugging-profile requirement](https://developer.chrome.com/blog/remote-debugging-port).

### Controlled Wells pilot — temporary, private activity candidate

Version 0.6.1 recognizes sorting text in column-header buttons and keeps
pending/posted section headings from being mistaken for extra column rows.
It still requires exactly one recognizable column map and does not certify
account identity, balances, pending scope or pagination. Rejection reports now
include bounded structural reasons and recognized column roles, never arbitrary
page text. Off-screen loaded tables do not require zooming or scrolling to read.
The attended v0.6 attempt found no recognized table; actual Wells extraction
with this correction still needs verification. See the current handoff checkpoint.

Version 0.5 provides a local control window using the same tested disposable
lifecycle. Windows encryption, installed Chrome and the pinned browser dependency
are required. First rehearse without touching a bank:

```powershell
.\collector\Test-Collector.ps1 -Mode PilotRehearsal
```

Historical disposable pilot command (do not launch at work as the next step):

```powershell
.\collector\Test-Collector.ps1 -Mode WellsPilot
```

Equivalent commands are `node collector/src/cli.mjs pilot-rehearsal` and
`node collector/src/cli.mjs wells-pilot`. The second opens **only local controls**
initially. A non-financial encryption preflight must pass first. Then:

1. Confirm workplace permission/read-only use in the panel and press **Open Wells**.
2. Sign in and perform MFA yourself in the bank tab. Open one account page manually.
   Do not make payments/transfers, import passwords, or enable Chrome sync.
3. Open checking activity for this development test. Return to the controls,
   acknowledge temporary private table capture, and press **Read activity locally**.
   Recognizable HTML tables/accessibility grids are read without bank clicks.
   Displayed dates, descriptions, signs, statuses and other table cells are retained
   as text, not interpreted as normalized transactions. **Show captured rows here**
   is an optional, local-only preview; never screenshot it or export it to chat.
   Form values, credentials, URLs, HTML dumps and browser storage are not read.
   Active password/username/one-time-code controls block capture. Unsupported
   layouts, hidden/uneven/spanned rows, interactive cells and truncation are explicit.
   Login, account identity, balances, pending coverage, earlier pages, independent
   counts/totals and anchors remain **unverified**. Missing tables are not zero activity.
   Optional **Inspect page outline** remains text-free, under structure diagnostics.
4. Press **Stop & clean up**, or close the control/account tab. The launcher must
   confirm browser exit and removal of the owned profile and records. If it cannot,
   use RecoveryCheck; do not assume cleanup succeeded or switch temporary roots.

The session expires after 20 minutes; each operation is bounded to 20 seconds and
at most 12 activity reads and 12 outlines can be stored. Stop is available during an
operation. There are no certified Wells selectors, automatic bank clicks,
form entry/submission, payment actions, real-login verification, or workbook writes.
The generic table reader is an evidence-development aid, not the financial adapter.
The user must keep manual navigation read-only; destination restrictions cannot
prevent a user from manually making a payment on a permitted bank website.

The starting URL is the Sign On link from
[Wells Fargo's public online-banking page](https://www.wellsfargo.com/mobile-online-banking/).
Page traffic is limited to HTTPS `wellsfargo.com` and its true subdomains, the
random-capability loopback panel, and the narrow visual-resource exception below.
No URL credentials or nonstandard bank ports are permitted. Redirect responses
are checked before following Location, including the source method and resource
type, so a redirect cannot expand the visual exception. Unreviewed destinations,
WebSockets, child frames, workers without a supported
frame, and unprepared popup tabs are blocked. Service workers and downloads are
disabled. These are page-traffic restrictions, not an OS firewall or a guarantee
about Chrome's own background traffic. Normal TLS and browser security stay on.
Bank sign-in/MFA may depend on a blocked component: stop and review compatibility,
never weaken or bypass security controls to force a login.

**Version 0.5.1 visual-resource correction:** Wells' public sign-in page declares
`www10.wellsfargomedia.com`, `www15.wellsfargomedia.com`, and
`www17.wellsfargomedia.com`; its public CSS/font references confirm the latter two.
Only these exact hosts may receive GET stylesheet/font/image requests with matching
static extensions and no query strings. No media wildcard, navigation, scripts,
fetch/XHR, submissions or other methods are allowed. Font prefetch can remain
blocked while the actual font request works. See the
[public-source review and test scope](../docs/WELLS_ASSET_REVIEW.md).
The first attended v0.5 attempt reached an unstyled account summary, saved zero
outlines, and completed verified cleanup. The v0.5.1 retry remained unstyled, but
the user could manually open checking activity and see transactions. It also saved
zero outlines and verified cleanup; no financial extraction has been verified.
The user does not require normal bank styling. Do not repeat appearance-only
sign-ins: focus on the reader and complete data coverage. Investigate blocked
assets only when they prevent required functionality.

The control server binds only to loopback, checks Host/Origin and private action
tokens, accepts a tiny fixed command set, and exposes only non-financial status.
Private row preview uses a separate same-origin, token-protected POST endpoint,
not GET/state; all responses are no-store and raw strings render as text, never HTML.
Only fixed structural enums/counts reach the CLI. Evidence must be encrypted
successfully before preview becomes available; stop clears the in-memory preview.
No bank network bodies, credential headers, screenshots, traces, or financial
debug logs are read/exported by pilot inspection. Redirect handling examines only
status, destination URLs and Location in memory; it does not replay requests.
See [Chrome Fetch response interception](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/domains/Fetch.pdl).

Regression tests use entirely fictional pages for acknowledgement, controls,
encrypted outlines, cancellation/expiry, redirect chains, POST redirects, blocked
destinations, frames/popups, shutdown and directory removal. Run browser test files
serially (`--test-concurrency=1`) so an unrelated concurrent test browser cannot
confuse conservative crash-recovery ownership checks. An attended sign-in reached
the summary, but full page compatibility and financial coverage remain **unverified**.
This is not the production Refresh Budget button.

### Stopped-test recovery and private page-structure inspection

Version 0.4 adds recovery for new disposable test runs. It does **not** recover or
delete the persistent home store, the financial workbook, or a personal profile.
Inspect first; that command creates/deletes nothing:

```powershell
.\collector\Test-Collector.ps1 -Mode RecoveryCheck
```

If the result says cleanup is safe, explicitly confirm deletion of the stopped
test's temporary files:

```powershell
.\collector\Test-Collector.ps1 -Mode RecoverTest -ConfirmCleanup
```

Equivalent commands are `node collector/src/cli.mjs recover-test` and
`node collector/src/cli.mjs recover-test --confirm-cleanup`. Neither starts a bank
session. Do not respond to a blocked check by selecting another temporary parent.

Before launching Chrome, the test writes and flushes a startup journal containing
only an ownership token, boot timestamp, and pre-existing Chrome process IDs,
parent IDs, and creation timestamps. No command lines, profile paths, URLs, user
names, or account data are collected by the Windows process helper. Recovery
checks exact directory/marker ownership, rejects links/junctions, verifies the
owner is stopped, and repeats these checks under an exclusive recovery lock
before deletion. It never kills Chrome or any process identified by a marker.

New tabs descended from a proven pre-existing Chrome process do not block
recovery. An unknown new Chrome process, PID reuse, missing ancestry, failed
process lookup, malformed journal, old-format run, or unexpected file blocks it.
Close only the collector's test window and check again. If process ownership
cannot be resolved, a Windows restart can establish that old processes exited;
it does not authorize deletion of an invalid/unowned directory. A crashed recovery
operation or partially deleted ownership record still needs review. This is a
conservative command-line recovery tool, not a production recovery UI or a
guarantee against sudden power loss.

`src/page-structure.mjs` supplies a separate privacy boundary for reader
development. The browser exports only bounded topology and fixed tag/role words;
it does not read text, financial values, field values, IDs/classes, link targets,
labels, cookies, or browser storage. Form/editable subtrees are excluded, embedded
frames are flagged but not entered, open shadow roots are distinguished, and
large/deep outlines are marked truncated. A second strict schema check rejects
unexpected fields/strings before a caller receives the report. Errors are static.

**A structural outline is never transaction evidence, authentication proof, or a
verified account.** It cannot identify balance meanings or prove page coverage.
No raw financial HTML capture or bank adapter is enabled by these helpers. The
version 0.5 pilot above supplies gated navigation and local controls; actual
account mapping and source-evidence extraction remain separate unfinished work.

Tests include an actual forced collector-process exit with fictional Chrome
pages, subsequent stopped-run cleanup, PID/lineage uncertainty, tampered paths,
and fictional secrets deliberately placed in page fields and attributes.
Windows process semantics: [Microsoft Win32_Process](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-process).

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
- Real Chrome integration against a private loopback fictional site, grouped
  sign-in readiness, bounded concurrent collection, shared-session sequencing,
  consolidated incomplete-session states, cancellation, and final freshness checks.
- Explicit stopped-test recovery with a flushed browser-startup journal,
  read-only Windows process/lineage checks, ownership rechecks, and no process killing.
- Bounded structural page inspection with a fixed vocabulary, excluded form
  values/text/identifiers, and strict rejection of unexpected output fields.
- A visible manual Wells pilot and fictional rehearsal, explicit acknowledgement,
  pre-navigation/redirect restrictions, bounded controls, and verified cleanup.
- A bounded private activity-table reader and local preview, separate capture
  consent, encrypted evidence, credential/form exclusion and structural-only reports.

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

The earlier permission allowed live, read-only work-machine testing, subject to workplace
permission, **only if test financial data is deleted afterward**. The current CLI
supports fictional demonstrations and a private activity-candidate Wells pilot;
certified bank readers are not implemented.
Browser shutdown/profile removal have been tested with the fictional site.
Permission to test is not evidence that live
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
success. Existing runs/locks block another test. Use the explicit stopped-test
recovery commands above for supported new-format runs. Unknown ownership and
process state remain blocking; unattended recovery and a browser-aware recovery
UI are not implemented. Do not work around a cleanup warning by moving to a fresh
parent directory.

Both the fictional browser runner and gated pilot create a **new, unsynced disposable
Chrome profile** inside that run, never attaching to or copying the everyday personal profile. The user
signs into banks, not Chrome sync. Browser cookies/cache are browser-managed and
are not encrypted by the collector's record helper. Browser downloads, screenshots,
traces, videos, and financial debug logs must be disabled unless explicitly needed
and safely contained. Browser exit, the fictional Cancel button, profile removal,
and external-page blocking are integration-tested. Pilot controls and destination
restrictions are tested using fictional pages; real-bank compatibility, approval
detection and account-specific evidence coverage still require development/testing.
The fictional forced-process-exit recovery test does not certify live-bank coverage.

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
employer-managed computer private. Automated coverage tests use fictional data
only. The attended pilot can create a real temporary bank session; cleanup covers
its owned profile/records, not a screenshot a user separately uploads to chat.

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
4. **Wells reader and home certification.** Establish the supported home Chrome
   connection, then perform an attended read and implement account-specific mapping,
   navigation and completeness. Private table evidence is now supported, not source
   verification. Do not relax the fictional transport's loopback-only rule.
   Do not restart work-machine live testing. Verify read-only summary,
   pending, posted, pagination, identity, evidence,
   and authentication pause/resume. Group manual sign-ins instead of making the
   user wait for serial collection. Measure attended authentication, background
   collection, and total time separately. Confirm sessions and operation at home.
5. **Other institutions.** Certify each required account and its payment/promo
   pages. Never mark coverage complete merely because one balance was read.
6. **Refresh button and shadow runs.** Add a local launcher, progress, retry/resume,
   safe cancellation, guided lock recovery, same-week payment replay protection, local backup,
   and opening of the verified workbook. Run three to four complete weekly
   comparison cycles before retiring screenshot fallback. No daily scheduler.

The next gate is a supported home Chrome connection followed by an attended
functional read, source-specific mapping, navigation and completeness, not a styling
check. Normal weekly operation must not require the user to open every account or
page through transactions; those manual steps are development/onboarding only.
Continue the existing portable code at the home development checkpoint;
the pilot does not authorize a partial-source update to the real workbook.
Full one-button readiness requires every registered source, exact
workbook cash consistency, preserved history/settings, no financial uploads,
acceptable intervention/time, and no AI participation in a normal refresh.

The repository still contains legacy financial files and old financial commits.
This feature branch does not add new financial data or remove those older copies.
Ignore patterns do not untrack files. Historical cleanup is a separate decision.
# Chase 0.4.3 diagnostic correction

The September 21 audit found three concrete defects missed by source-only tests:
the private evidence store rejected the `chase` source; the content listener returned
an object instead of using Chrome's `sendResponse`; and the reader rejected the
observed pair of PENDING/ACTIVITY tables. These are corrected with runtime reader
and encrypted-store regression tests. Dashboard preview tables are no longer
accepted as account-detail evidence. Authentication requires a visible Sign out
control, and sign-out clears the bridge's remembered authentication state.

All 235 local tests and collector QC pass. This is NOT live acceptance: the bank
session expired before retesting. Both-card navigation, identity binding, source
coverage, normalization and workbook integration remain unverified. The collection
sequence constant is a specification, not implemented orchestration. Preserve
Prime Visa -> Prime Visa and Sapphire Preferred -> Chase as distinct mappings.

Reload the installed extension to 0.4.3 for the next attended live test. The desktop
tool could discover the existing Extensions tab, but could not click or activate
Chrome (geometry unavailable / activation failed). Do not claim that reload occurred.
No workbook or private financial values were changed by this correction.
