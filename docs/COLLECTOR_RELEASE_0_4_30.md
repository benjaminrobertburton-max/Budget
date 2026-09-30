# Collector 0.4.30: reliability checkpoint

This document supersedes conflicting historical launch/version/retry directions
in the collector README and home handoff. Use `codex/budget-collector`, not only
`main`. Read the September 29 home run report as incident evidence, not a list of
proved causes. Do not copy work-machine private configuration or DPAPI evidence
onto the home machine.

## What changed

- Wealthfront's accepted three-row overlap now travels inside the authoritative
  private workbook as native custom-property metadata. It is bound to the account,
  accepted evidence reference, capture time, cash balance, activity count and
  signed total. New verified imports refresh it automatically. Preflight checks
  portability before starting bank collection; malformed or mismatched metadata
  never falls back to a stale initial anchor. The old evidence reference remains
  for provenance, but a migrated workbook no longer requires that originating
  machine's encrypted file. This is importer/preflight code only; no extension
  update or new bank permission is required.

- Current Start dashboard compatibility: its B7/B8 cells are numeric plan and
  transfer values, not the legacy status-message cells. The importer preserves
  those values/formulas and the B17 balance formula, and writes unreviewed-plan
  warnings in labels/notes instead. The observed B17 #VALUE! was caused by the
  importer writing text over its numeric dependencies, not a defective budget
  calculation. The recognized numeric dashboard and legacy status dashboard
  are handled separately; unknown formulas in legacy target cells block rather
  than being overwritten. Local formula diagnostics identify failing sheet/cell
  locations; ordinary CLI/status retains its fixed privacy-safe error code.

- September 30 approved importer correction: required posted-history coverage
  begins at the oldest of the accepted posted anchors, not the oldest incidental
  row on the loaded page. A page can end midway through an older date. Older
  accepted posted ledger rows remain unchanged, including their notes/provenance;
  unrelated older source rows are not backfilled. All current pending and loaded
  postings matching prior pending remain in scope. Missing/changed/duplicate
  history at or after the anchor boundary still blocks. Replaying a receipt
  retains source-control counts for its already-imported late postings. This is
  an importer-only change: extension 0.4.30 remains current, with no reload needed.

- PayPal retries no longer click the same observed account/financing destination
  repeatedly while an SPA route loads. Each destination gets one click per
  explicit request; a new document still uses the existing single-delivery guard.
  An attended trusted click reached financing from the Credit dashboard, while
  the old retry path had stopped there. Repeated clicks are a code-confirmed
  hazard, not proof of every prior incident's cause. A fictional Chrome test
  verifies a delayed route transition receives exactly one click.

- User-approved Citi incremental verification: when the source explicitly shows
  Load More Transactions, its full-period posted total is retained separately.
  A partial first page can pass only with clean source fields/filters/rows,
  complete pending total reconciliation, matching visible posted count, and all
  three exact accepted workbook anchors (including duplicate occurrences).
  The global posted total is NOT labeled matched. Missing anchors/counts, wrong
  identity, malformed totals, or pending discrepancies still block. Coordinator,
  resume and final import independently use the authoritative workbook anchors;
  no development capture becomes accepted history. No older page is loaded when
  the accepted anchors are already present. This is verification logic only,
  not a change to household calculations or source amounts.

- User-requested sequential site opening: just before each institution's capture,
  reuse its one existing tab without changing its URL, or open its official entry
  site if absent. Do not open every institution at startup. Duplicate institution
  tabs are a fixed, source-specific exception. Normal sign-in/MFA is still required;
  opening a website does not certify automatic login. Completed sources stay skipped.

- Attended testing found Chase's default activity-since-last-statement range
  excluded the accepted workbook anchors after statement rollover. Account
  navigation now selects the observed All transactions first-page filter once.
  The observed Date / sorted-by-most-recent header is recognized exactly. This
  does not authorize full-history paging: stop as soon as overlap is present.
  Paging anchors come from verified posted rows in the authoritative workbook,
  not a machine-local development capture.

- The weekly coordinator correctly compares Chase's structured product/suffix
  identity with the private binding. Previously it compared the object with a
  string, rejecting a valid account. A six-source coordinator test now covers it.
- Source callbacks are serialized. Chase paging retains its bounded overlap
  state. Automatic Wells capture cannot accidentally start a Chase capture before
  card navigation. Late source events cannot block another institution.
- Version 2 checkpoints bind the exact configuration and original workbook hash,
  source sequence, and encrypted capture references. All six sources are retained
  if import fails. Retry imports those receipts, not whatever other test capture
  happens to be newest. The previous Wells-only checkpoint is migrated only after
  its bound evidence is reopened and revalidated. Missing evidence or a changed
  workbook/configuration blocks automatic resume; do not delete the checkpoint
  or recollect Wells to bypass it.
- Preflight checks Node, release consistency, private paths/configuration, all six
  source bindings, workbook readability, write permissions, DPAPI round-trip,
  import runtime availability, store ownership and the loopback port before bank
  commands. It never prints financial values or account bindings.
- `weekly-start` detaches the existing Node collector with hidden Windows process
  options. No desktop app/executable is installed. It acknowledges startup over
  IPC and writes bounded local status. Duplicate owners are refused; a provably
  dead lock owner can be recovered without killing any process.
- Manifest, worker, all five readers and bridge must agree on 0.4.30. QC checks
  each literal. The worker probes reader build **before** sending a capture and
  reloads only the requested tab, at most once per session. Extension installation
  no longer reloads every bank tab. Pairing also rejects a second extension origin.
- Chase absent pending still uses the approved Chase-only inference, with intact
  activity, identity, range/footer and labeled balances. The reader waits for a
  stable rendered snapshot before using absence. A last statement balance keeps
  its own label; it is never relabeled as remaining statement balance.
- A posted item matching prior pending is reconciled even behind the latest
  posted anchor. Superseded pending remains historical evidence but is removed
  from the active snapshot count. Existing workbook settlement/history tests pass.

## Operation on either machine

1. Inspect local changes, sync this branch without overwriting private financial
   work, and run `node collector/src/cli.mjs collector-qc` from the repository.
2. Load the extension from **that checkout's** `collector/chrome-bridge` folder.
   The installed manifest must show 0.4.30. A shared Chrome account is not proof
   that unpacked extension files match. Reload only when the version check proves
   it necessary. Do not copy cookies, sessions, credentials or browser profiles.
3. Keep the authoritative local XLSX, exact backup, import configuration, evidence
   and output directory outside Git and synced folders. Use existing local account
   bindings. Preserve manual additions and prior payment confirmations.
4. Run `node collector/src/cli.mjs weekly-start <absolute-private-config>`.
   With the existing optional local `weekly-refresh.json` pointer, omit the path.
   Do not start a second collector while the first is running. Approve normal
   sign-in/MFA only in the bank browser. A missing site now opens when its turn
   arrives; supported signed-in pages are still required for capture. A sign-in
   taking longer than the bounded attempt resumes from saved sources on rerun.
   This release does not claim unattended login certification.
5. Inspect `node collector/src/cli.mjs collector-status`. The default private
   root exposes persistent state plus live bridge state. A custom private root
   stores the same bounded `weekly-run-status.json` there. No response is a
   timeout, not proof of zero transactions or sign-out.
6. On interruption, use the same command/configuration; it resumes the next
   unfinished source. If all sources completed, it retries import without Chrome.
   `WEEKLY_SESSION_INVALID` requires comparing the local workbook/configuration
   with the interrupted run, not resetting financial data.

No age expiry was restored. Captures keep their timestamps. The 90-second source
response watchdog and 12-minute coordinator timeout limit a running attempt, not
the validity of saved captures. Explicit authentication can pause the source
watchdog; the overall attempt remains bounded and preserves completed work.

`complete` means capture/import finished, not that payments were made or Tuesday
Review is financially approved. The importer preserves the separate source,
classification and payment-review workflow and exact backup. The persistent
worker does not automatically open desktop Excel; the agent should refresh the
configured private workbook in the Codex viewer after successful import.

## Validation and remaining gate

On this work machine, the full fictional suite passed 372/372 before the
sequential-site-opening addition. After that addition, 32 focused tab-opening,
bridge, lifecycle and coordinator tests passed with build 0.4.28. The real-Chrome
fictional Chase test also passed the observed sorted-header and delayed-pending
cases. The subsequent Citi change passed 8 focused tests including actual Chrome,
encrypted source-to-XLSX import, exact backup, zero-new-row replay, rejected changed
anchors and formula checks, plus 12 coordinator/intake/anchor checks. These are
software checks, not complete live import certification.

Non-live tests cover six-source coordination, interruption after Wells, final
import retry, mismatched identity, duplicate ownership, stale reader refusal,
build/session rejection, real Windows encryption, detached process survival, and
real XLSX formula/native-part/history preservation. Fictional Chrome tests cover
Chase delayed pending and alternate statement labels, Citi, PayPal and Wealthfront.

**Live certification is pending.** The 0.4.26 handshake passed after reload.
An initial attempt stopped on Chase's public homepage; after user sign-in,
capture exposed the statement-period/header defects above. In 0.4.27, both Chase
cards passed capture/anchor checks automatically. The sequence then reached Citi;
Citi, PayPal and Wealthfront tabs were absent. The timeout preserved Wells and both
Chase receipts and left the workbook unchanged. This prompted the explicit user
request for sequential missing-site opening in 0.4.28. Its retry found Citi's
pending total and all three workbook anchors matched, but the full-period posted
total differed from the visible first page, with Load More Transactions present.
The user explicitly approved the scoped 0.4.29 repair described above. Its live
retry passed Citi and preserved four completed-source receipts. PayPal initially
failed while its observed tab was on the public site. A later direct check
confirmed the same tab on an authenticated account route; resume starts at PayPal,
not Wells. Do not infer global sign-in state from an earlier page snapshot.
Subsequent 0.4.30 resume saved PayPal and Wealthfront successfully. The user
reported extra PayPal panels despite a valid four-promotion result, and then
explicitly stopped PayPal diagnosis. Do not claim that panel repeatability is
proved or restart that investigation without direction. All six exact receipts
were retained in the private checkpoint. Wealthfront required normal sign-in.

Final import initially stopped with POSTED_HISTORY_CHANGED on older Chase rows
before the accepted anchor window. The user approved the narrow importer
correction above. Four anchor-scope regression tests and ten existing real-XLSX
import tests passed, covering preservation, replay, pending settlement, Citi,
PayPal, Wealthfront, backups and formula checks; the workbook-anchor test also
passed. QC and diff checks passed. Retrying all six saved receipts (without any
new browser capture) then stopped at WORKBOOK_FORMULA_ERROR before publication.
The user authorized fixing that failure and completing today's import. Local
diagnostics located Start B17; the older importer had overwritten its numeric
B7/B8 dependencies with status text. The dashboard compatibility correction
above passed three focused tests, then all 17 anchor/import tests passed.

**September 30 saved-data import completed on the work machine.** The normal
persistent weekly runner consumed the six pinned receipts without new bank
captures, passed source controls, formula scans and export-preservation checks,
saved an exact original backup, published the private working XLSX, and cleared
the resume checkpoint. Independent saved-file checks found zero error cells and
confirmed the dashboard formulas and the two affected older ledger rows were
preserved. Start and the full Tuesday header/checklist were visually inspected;
the actual private workbook was requested in the Codex viewer. The import week
is September 29; the local folder's older date does not define the reporting week.

This is a completed data import, NOT a new approved payment plan. Classification
exceptions, current manual-source updates and applicable payment requirements
remain for review. Prior Tuesday confirmations stay historical; its header
explicitly warns that it is not the current payment plan. Do not reset them or
make transfers based on the unreviewed dashboard comparison.

**Repeatability certification remains pending.** This was a resumed run with
repairs, not two uninterrupted attended passes at one commit. The two work-machine
passes and same-commit home smoke test are still needed before claiming that
certification. Verify coverage/anchors, no unintended panel loops, no duplicates
on replay, safe publication and zero saved formula errors. Do not recollect merely
to repair today's now-completed import or label fictional tests as live passes.

Do not promise identical behavior merely from the same model/Chrome account.
Record the tested Git commit, extension build, runtime, source outcome codes and
whether import committed on each machine. Keep all financial results local. The
remaining home check exists because its Windows encryption context, runtime,
extension installation and bank sessions cannot be certified from work.

## Portable workbook handoff — September 30

The current private work-machine workbook has been migrated successfully. Three
accepted Wealthfront anchors resolved with originating-machine evidence access
deliberately unavailable, and normal weekly preflight passed without bank capture.
An exact pre-migration backup was kept. Every original worksheet and financial
part stayed byte-identical, so prior formula/visual QC remains applicable. The
visible workbook was not redesigned or reimported. Send this updated workbook,
not a previously exported copy without its portable checkpoint.

Software validation: 23 focused Wealthfront/preflight/workbook tests passed.
After tightening Excel-compatible metadata encoding, the cross-machine import
test passed again. It uses different test encryption keys, no originating source
file on the simulated home machine, and a deliberately stale bootstrap anchor.
The copied workbook imports/replays without added duplicates; wrong identity,
changed metadata, changed snapshot totals and missing exact overlap still block.
Actual live home acceptance remains pending.

Home continuation:

1. Preserve local changes and sync `codex/budget-collector`, not just `main`.
   Read AGENTS, this release document and the September 29 incident report.
2. Receive the newly provided private workbook separately from Git. Keep an exact
   backup of the existing home workbook; compare any newer home changes instead
   of overwriting them blindly. Put the supplied workbook outside Git/OneDrive
   and point the existing home import configuration at it. Keep home-specific
   paths, encryption setup and account bindings; do not copy work configuration,
   passwords, profiles, cookies, encrypted evidence, locks or resume sessions.
3. Confirm the extension's loaded checkout and build 0.4.30, runtime and private
   paths. Run normal preflight. The portable Wealthfront identity must match the
   home binding; the exact saved overlap remains mandatory on the next capture.
4. Run one attended home smoke test with `weekly-start <private-config>` and
   inspect status. Resume failures rather than resetting checkpoints. Do not
   claim home certification solely from the simulated two-store test here.

For an older accepted workbook that lacks metadata, run
`node collector/src/cli.mjs workbook-portability <absolute-private-config>` **on
the originating machine**, where its exact accepted Wealthfront evidence can
still decrypt. It refuses an active/saved weekly session, validates the accepted
source against the workbook, creates an exact backup and changes only metadata.
Running it again on a valid migrated workbook is a no-op. Missing evidence blocks
with `WEALTHFRONT_PORTABILITY_REQUIRED`; never replace the accepted checkpoint
with an initial anchor or newest unaccepted test capture to bypass that failure.

The metadata is private financial information in the already-private XLSX, not
encrypted separately or suitable for Git. Its digest detects incomplete/changed
parts, not malicious forgery; the workbook remains the trusted financial baseline,
as with other accounts' ledger anchors. Preserve its native custom properties
when editing or moving it. Removing them can block a later cross-machine import.
Each string property is kept below Excel's documented 255-character limit.
See [Microsoft's custom-document-property documentation](https://learn.microsoft.com/en-us/office/vba/api/excel.workbook.customdocumentproperties).
