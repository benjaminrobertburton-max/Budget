# Collector 0.4.32 — deterministic recovery and repeat-run validation

This is the current operating checkpoint on `codex/budget-collector`. It
supersedes older launch/version/retry directions, not financial rules. Keep the
authoritative private workbook and home-local configuration. Never replace the
private workbook from Git or copy machine-bound encrypted evidence between PCs.

## Routine operation (read this section first)

1. Sync this branch. Run `node collector/src/cli.mjs collector-qc` once after a
   software update. This is a release-file check, not live bank certification.
2. Reload the unpacked Chrome extension once after updates; manifest, worker,
   readers and server must agree on **0.4.32**. No new permissions were added.
3. Use `node collector/src/cli.mjs weekly-start [absolute-private-config]` for an
   authorized import, or `weekly-test [absolute-private-config]` to collect and
   validate the full import in memory **without publishing a workbook**.
   An existing home `weekly-refresh.json` can supply the config automatically.
4. Use `collector-status` for one compact progress/outcome report. Do not start
   another worker while one owns the lock. Do not launch per-bank legacy tools
   alongside the weekly runner or manually click repeatedly through panels.
5. If a source fails, run `collector-diagnose [absolute-private-config]` once.
   This replays encrypted evidence offline, prints fixed validation codes and
   structural row indexes, and never opens a bank or writes the workbook.
   A diagnostic may examine the latest stored receipt: it is **not** permission
   to treat that receipt as belonging to an active import session.
6. Retry the same weekly command after resolving the reported blocker. It
   revalidates session-bound receipts against the unchanged workbook/config and
   requests only sources still unresolved. A completed test leaves its verified
   receipts available for the subsequent authorized import, without recapture.

Private writes and Windows encryption must be available to the launched process.
If the coding environment denies them, request the narrow permission needed to
run the installed collector. Do not rebuild/debug bank readers for a filesystem
permission failure. No LLM is involved in the bank traversal/parser/import loop;
the assistant launches it, handles reported exceptions, and opens the resulting
workbook. Routine execution should not reread historical R&D or whole bank DOMs.

## Causes addressed

- The failed Luna Wells capture contained readable activity and accepted anchor
  overlap. Two known pending help headings were not recognized reliably. The
  parser now explicitly recognizes those headings, preserves every transaction,
  and reports the location of any *other* unexplained row. It does not ignore
  arbitrary single-cell rows or accept an unbalanced/ambiguous capture.
- Wells authentication formerly meant “no password control visible.” It now
  requires positive account/table evidence. A shared pre-capture gate covers all
  five websites, including sign-in/MFA waits. Existing tabs are reused; missing
  sites open individually at their reviewed official entry points.
- A fresh repeat exposed Wells' session-expired page: its exact Sign On control
  is an SPA anchor without an href, not a regular URL link. Version 0.4.32 handles
  exact sign-in controls with or without href, rejects off-domain links, and
  reports an authentication wait instead of silently waiting for transactions.
- Saved Chrome credentials stay inside Chrome. The shared gate can open an exact
  sign-in link and submit an explicitly autofilled sign-in form, once per observed
  document/action and at most three sign-in actions per source request. It never
  reads field values, passwords, cookies, browser storage or MFA codes. It does not
  invent selectors to choose an MFA channel. If autofill requires a user gesture
  or a bank presents an unsupported challenge, it reports an authentication wait;
  fully hands-off sign-in is **not yet certified** on either machine.
- Each weekly command has a request identity. Old-card/old-source responses are
  refused, even when both Chase cards use the same tab. Page readiness does not
  authorize repeated PayPal/Wealthfront capture. Read-only navigation remains
  bounded and requires observed, unambiguous controls.
- Wells anchors now come from the accepted private workbook, not the most recent
  local test capture. Chase/Citi workbook anchors and portable Wealthfront
  checkpoint checks remain. Capture is incremental/first-page with accepted
  overlap and current pending, not an all-history sweep. Missing coverage still
  blocks rather than guessing or marking the source verified.
- One failed source no longer discards the opportunity to collect other sources.
  Each verified receipt is checkpointed, with unfinished raw receipts retained
  encrypted for offline diagnosis. No partial workbook publication is permitted.
- Status preserves start time, elapsed time, source outcomes and specific
  validation issues. Generic downstream errors no longer erase the failing source.
  Defaults: 90 seconds per active source, up to five minutes for authentication,
  and 30 minutes overall. Waiting does not consume model reasoning.
- Repeated evidence lookups reuse an in-memory decrypted cache with file-metadata
  invalidation. No plaintext index is written. Windows checkpoint replacement has
  a short, bounded retry for transient file locks, without deleting the old file.
- Full import validation found a date represented as a Date object on re-import
  and as an Excel serial after calculation. Export comparison now compares the
  same date value using the workbook's date system. Changed dates, blanks, numbers,
  formulas and native structures still fail preservation checks. No budget
  formula was changed for this correction.

## Validation and release limits

Automated checks cover full six-source orchestration, failed-source recovery,
test-to-import reuse, stale same-bank replies, authentication gates, ambiguous
controls, malformed activity, exact backup/native preservation and formula errors.
The actual Wells reader is also exercised in Chrome at 75%, 100% and 125% zoom,
including a negative available balance and a logged-out page. Existing fictional
Chrome tests exercise Chase, Citi, PayPal, Wealthfront, privacy and cleanup.

September 30 measured checks:

- First fresh work-machine capture: all six sources verified, 375 seconds including
  sign-in waits and the initial date-representation validation failure.
- After the date-comparison fix, all six pinned receipts passed full in-memory
  workbook validation in 24 seconds, without bank recapture. The authoritative
  workbook's SHA-256 remained identical. This is receipt replay, not a second
  live navigation pass.
- The attempted fresh repeat found the expired-login control described above.
  Version 0.4.32 reached the Wells sign-in form correctly; Chrome did not supply
  an autofilled login. The user was asked to select the saved login locally.
  The owned non-publishing worker was stopped at this authentication boundary;
  receipts were preserved. This was an authentication interruption, not a
  successful uninterrupted repeat.
- After the user renewed sign-ins, the fresh repeat resumed at 21:16:41 UTC.
  Wells and both Chase cards verified with fresh receipts. Citi then displayed
  its explicit inactivity sign-out notice and entered the authentication wait.
  That segment ended after 377 seconds with Wells, both Chase cards and
  Wealthfront verified. Citi required authentication; PayPal returned an
  incomplete financing snapshot. Both blocked publication, preserving the four
  successful source receipts.
- After Citi sign-in, the 21:23:52 UTC retry collected only Citi and PayPal and
  passed full workbook validation in 44 seconds. The other four receipts were
  reused from this second collection session, not from the first-pass archive.
  All six second-session evidence references differ from the first capture set.
  The authoritative workbook's SHA-256 is unchanged. Two distinct complete
  capture sets now pass validation, but the second required authentication and
  a PayPal retry; this is not proof of an uninterrupted all-account run or home
  acceptance. The PayPal transient failure must remain visible in this record.
- Final automated validation: 403 core/CLI tests passed (400 core and 3 CLI,
  separated so the CLI bridge test did not compete for the live runner's port).
  All 27 real-Chrome fixture tests passed with the repository's documented
  `--test-concurrency=1`. A parallel experiment correctly blocked disposable
  profile cleanup because another test Chrome was still running; do not relax
  the process-ownership guard or run this suite concurrently.
- Collector release QC and `git diff --check` passed. Real financial workbook
  preservation was verified by SHA-256; no live import was published.

Test mode verifies the full workbook calculation path and exact source-file
preservation before reporting `validated`; `complete` means actual publication.

Acceptance still requires a home smoke test with the home-private workbook/config.
Uninterrupted, no-assistance sign-in is not certified. A resumed receipt-only pass
is not a fresh navigation pass. Record elapsed times, per-source outcomes,
whether evidence was reused, and any MFA/autofill exception. Do not guarantee
repeatability merely because Chrome account/settings match or a larger model was
used to develop the code. Website changes and unsupported challenges remain
explicit exceptions, not permission to weaken reconciliation.

## Resume this checkpoint

The work-machine test is now `validated`, with the worker stopped normally and
all six second-session receipts pinned. Do not collect again just to finish the
test. An explicitly authorized `weekly-start` can use these exact receipts to
publish the import without revisiting banks, if workbook/config still match.
No actual publication was authorized or performed in this reliability test.
The first successful six-source session is preserved separately in the private
root as a validated test checkpoint. Do not restore it and count it as fresh work.
Never commit or transfer its encrypted receipts to another machine.

On the home machine, sync this branch, reload 0.4.32, retain the home-private
workbook and configuration, run release QC and `weekly-test`, and record whether
each source was fresh or reused. A home authentication failure is not permission
to reset anchors or replace the workbook. If no compatible home runtime is
available, use the existing setup instructions rather than improvising new
dependencies during a weekly run. Do not publish until all source and workbook
checks pass; manual-account confirmation and Tuesday payment-plan review remain
separate from bank collection.

No workbook data, amounts, categories, financial formulas, manual account scope,
payment confirmations or historical records were changed for this release.
