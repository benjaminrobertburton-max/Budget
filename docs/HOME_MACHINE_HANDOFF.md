# Collector home-machine handoff and release checklist

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

## Controlled Wells pilot: implemented controls and next attended step

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
