# Chase collector incident — September 29, 2026

## Purpose

Hand this report to the home machine to continue the Chase collection problem
without repeating the failed full-weekly-refresh loop.  It contains no bank
values, transactions, screenshots, credentials, browser cookies, capture
contents, or private workbook data.

## Confirmed environment

- Shared Git branch: `codex/budget-collector`
- Shared commit used for this run: `03a52bff6db4afd99ede27a4f40bcd097a717baa`
- Shared extension manifest version: `0.4.20`
- Local bridge protocol version: `1` (this is the bridge configuration schema,
  not the extension version)
- Browser: ordinary home Chrome, profile `Person 1`
- The extension connected successfully to the loopback-only bridge.
- The authoritative workbook was moved to the private local collector folder,
  verified byte-for-byte against its private pre-install backup, and referenced
  by local-only configuration.  No financial files were committed or uploaded.

## What happened

1. The weekly coordinator was started with:

   ```text
   node collector/src/cli.mjs weekly-refresh
   ```

2. Wells completed and a new encrypted private capture was available.  No
   workbook import began.
3. The coordinator advanced to `chase_prime`.
4. Chrome already had an authenticated Chase account-overview tab.
5. The local bridge status, which exposes only fixed structural state, reported:

   ```json
   {
     "extensionConnected": true,
     "lastEvent": "activity_capture_no_table",
     "commandQueued": false
   }
   ```

6. The weekly process then waited rather than failing fast.  It was cancelled
   with Ctrl+C.  The workbook remained unchanged.

## Important conclusion

The user reports that the exact `.4.20` extension build completed successfully
on the other machine under Astra.  The collection reader is local deterministic
code; the selected Codex model does not alter its DOM reader.  Therefore this
is **not evidence that Terra Medium or extension version `.4.20` is incapable
of collecting Chase**.

The unresolved issue is specific to this machine/session or to a timing/state
transition.  The most plausible explanation is that the capture attempt ran
while Chase was still on the SPA account overview or before the selected card's
activity-detail table had rendered.  This remains a hypothesis, not a proven
root cause.

## Actual coordinator defect

`collector/src/chrome-bridge.mjs` converts a non-table Chase candidate into the
fixed progress event `activity_capture_no_table`.  It does not call
`onChaseActivityCapture` for that outcome.  `collector/src/weekly-refresh.mjs`
only logs `onProgress`; it neither blocks nor retries the active source for this
terminal capture state.  The result is an otherwise idle coordinator until its
12-minute timeout.

Fix this before the next full run: map terminal read outcomes for the active
source—at least `activity_capture_no_table` and `activity_capture_page_limit`—
to an immediate, source-specific blocked result.  Do not allow a silent wait.
Authentication-required states should remain a pause for user sign-in/MFA, not
a source failure.

## Citi follow-up — confirmed September 29

The initial Citi command exposed a separate functional gap: it only searched
for an already-open Citi tab.  When no Citi tab existed, it did nothing.  A
local-only correction was prepared to open one official Citi start tab or reuse
exactly one existing tab, then wait for post-authentication navigation before
requesting a read-only capture.  The displayed extension version was retained
at `.4.20`; therefore the visible version label is not a reliable proof that
two machines execute identical local source.

After the user reloaded that local correction, Citi opened its signed-in
dashboard successfully.  Two bounded reader attempts reached the same
non-financial structural result:

```json
{
  "accountIdentified": true,
  "postedRows": 10,
  "pendingRows": 0,
  "balancesPresent": true,
  "dueDateVerified": true,
  "postedTotalVerified": true,
  "pendingTotalVerified": false,
  "result": "pending_total_unverified"
}
```

The Citi reader requires an explicit rendered pending total.  It deliberately
does not infer a zero from zero visible pending rows.  This is a safe
verification gate, but it is the immediate reason the current machine could
not certify the Citi capture.

The user reports Citi worked flawlessly on the other machine.  Do **not** use
the shared `.4.20` manifest label to conclude the implementations match.  On
the other machine, compare the exact Git commit and the hashes/content of
`collector/chrome-bridge/background.js` and
`collector/chrome-bridge/citi-page-state.js`.  Look specifically for a
reviewed, explicit zero-pending signal rather than adding a general inference
from an absent pending-total element.

## Focused implementation and verification plan

1. **Do not rebuild or downgrade the collector.** Keep branch commit
   `03a52bf` as the baseline and preserve the already-working other-machine
   behavior.
2. **Add non-sensitive lifecycle tracing.** Record only fixed stages for a
   Chase command: `command_received`, `overview_detected`,
   `requested_card_opened`, `detail_identity_seen`, `activity_table_seen`,
   `capture_sent`, or a bounded fixed failure code.  Never log DOM text,
   account numbers, URLs containing tokens, balances, or transaction rows.
3. **Gate Chase capture on readiness, not a time delay.** After requesting
   Prime Visa or Sapphire Preferred, wait for the requested detail identity and
   then for the activity table.  The previously observed Wells/Chase DOM work
   showed a stable Chase activity-table contract (`table[data-testid="transaction-table"]`)
   with labelled headers.  Query this contract only after the requested-detail
   state is confirmed; retry bounded DOM readiness checks, not navigation.
4. **Fail fast with a diagnostic stage.** If the expected detail/table does not
   appear inside the bounded readiness window, report a fixed stage such as
   `CHASE_DETAIL_NOT_READY` or `CHASE_ACTIVITY_TABLE_MISSING`, stop the active
   source, and leave the workbook untouched.
5. **Test Chase alone first.** With the user already normally signed in, run
   the Chase Prime reader only.  Verify the result using structural counts and
   lifecycle states only.  Then repeat for Sapphire Preferred.  Do not start a
   six-source weekly refresh until both card readers complete from this machine.
6. **Only then run the full weekly sequence.** Wells, both Chase cards, Citi,
   PayPal, and Wealthfront must each complete before the existing private
   workbook importer is allowed to run.

7. **Reconcile the Citi implementation from the other machine before changing
   its rules.** Port only the proven zero-pending behavior, with fictional
   coverage tests.  It must distinguish an explicitly rendered no-pending
   state from a delayed, filtered, or incomplete dashboard.

## Guardrails

- The user handles normal sign-in and MFA only.
- Do not extract, log, store, or transmit credentials, cookies, or browser
  profiles; do not bypass security controls.
- Keep all raw activity, screenshots, private configuration, encrypted evidence,
  workbook files, and backups local.  Git contains only code, this sanitized
  report, and fictional tests.
- A failed collection must not update the workbook, payment statuses, ledger,
  or budget plan.

