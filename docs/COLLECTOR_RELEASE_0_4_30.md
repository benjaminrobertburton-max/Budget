# Collector 0.4.30: reliability checkpoint

This document supersedes conflicting historical launch/version/retry directions
in the collector README and home handoff. Use `codex/budget-collector`, not only
`main`. Read the September 29 home run report as incident evidence, not a list of
proved causes. Do not copy work-machine private configuration or DPAPI evidence
onto the home machine.

## What changed

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
are now retained in the private checkpoint. Wealthfront required normal sign-in.

Final import initially stopped with POSTED_HISTORY_CHANGED on older Chase rows
before the accepted anchor window. The user approved the narrow importer
correction above. Four anchor-scope regression tests and ten existing real-XLSX
import tests passed, covering preservation, replay, pending settlement, Citi,
PayPal, Wealthfront, backups and formula checks; the workbook-anchor test also
passed. QC and diff checks passed. Retrying all six saved receipts (without any
new browser capture) then stopped at WORKBOOK_FORMULA_ERROR before publication.
The failing formula cell has not yet been identified. Do not bypass the scan or
change financial formulas merely to publish. Next: identify the exact formula
failure in a private diagnostic run and compare it to the unchanged original;
propose any material financial-logic repair before implementing it. Preserve the
six-source checkpoint and retry import only after the relevant correction.

No private workbook update has yet been published. Required next: two attended
work-machine passes with the exact release, then one home smoke test at the same
Git commit. Verify account coverage/anchors, no unintended panel loops, no duplicate
rows on replay, no workbook mutation before reconciliation, and zero saved formula
errors. Do not describe non-live passing tests as either of those attended runs.

Do not promise identical behavior merely from the same model/Chrome account.
Record the tested Git commit, extension build, runtime, source outcome codes and
whether import committed on each machine. Keep all financial results local. The
remaining home check exists because its Windows encryption context, runtime,
extension installation and bank sessions cannot be certified from work.

Private workbook portability needs a local check too: the Wealthfront snapshot
currently references encrypted evidence in that machine's store. Before using a
workbook transferred from another machine, verify the referenced accepted evidence
exists and decrypts locally. Do not copy Windows-bound ciphertext, silently fall
back to a stale initial anchor, erase the reference or reset financial history.
If unavailable, an explicit, verified machine-neutral accepted-anchor migration
is still needed; a Git pull alone cannot supply private evidence.
