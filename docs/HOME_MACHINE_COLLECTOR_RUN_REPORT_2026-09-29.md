# Home-machine collector run report — September 29, 2026

## Purpose and privacy boundary

This is the complete technical handoff from the home-machine collector run.
It is intentionally sanitized: it contains **no** transaction text, balances,
account identifiers, source URLs, screenshots, cookies, credentials, MFA codes,
private configuration, workbook content, or encrypted evidence references.

The objective for the other machine is to diagnose and repair the collector so
the home machine can perform a complete weekly capture with the user's normal
role limited to sign-in/MFA exceptions.  Do not copy browser profiles or
cookies, weaken security controls, log live page text, or upload private
financial artifacts.

## Repository and deployment state

| Item | State |
|---|---|
| Shared branch at start | `codex/budget-collector` |
| Shared base commit | `03a52bff6db4afd99ede27a4f40bcd097a717baa` |
| Documentation commit pushed during this run | `1b484eb033b3b2ed23a2cd1fa0f4a66464cc8933` |
| Displayed extension version | `.4.20` |
| Browser profile used | ordinary home Chrome, `Person 1` |
| Bridge transport | loopback only; extension connected successfully on every source run |
| Financial workbook | private local working copy only; no import was run |

**Critical clarification:** the extension's displayed `.4.20` version is not a
reliable source-equivalence identifier.  During this run, local source changes
were intentionally made without incrementing the displayed version.  The other
machine may also have local changes while showing `.4.20`.  Compare Git commit
and file hashes, not the extension label.

At handoff, the following source files are modified locally on the home machine
and are **not committed or pushed**:

```text
collector/chrome-bridge/background.js
collector/chrome-bridge/paypal-page-state.js
collector/src/chrome-bridge.mjs
```

Those changes add experimental Citi/PayPal start-tab/authentication handoff and
PayPal structural diagnostics.  They passed syntax checks and the focused
loopback bridge test, but they are not a completed or accepted implementation.
Do not assume they exist on the other machine.

## Global result

- No real workbook import, payment action, ledger update, or budget-plan update
  occurred.
- Every source run was read-only and its bridge process was stopped after the
  result.
- Wells and both Chase cards produced encrypted private captures.
- Citi, PayPal, and Wealthfront were not certified for workbook use.
- Discover and Capital One remain manual chat sources by user choice.  Fidelity
  and CUTX evidence is Wells-based; RBC is out of scope.

## Source-by-source timeline

### Wells — resolved for this run

1. The full weekly coordinator was launched.
2. The user completed normal Wells sign-in/MFA.
3. Wells advanced successfully and an encrypted private capture was confirmed
   available.
4. No source values were exposed in terminal output or Git.

**Conclusion:** Wells capture functioned on this machine during this run.  Do
not rebuild it while addressing unrelated sources.

### Chase Prime Visa and Sapphire Preferred — initial coordinator issue, then resolved capture

#### First full-weekly attempt

1. After Wells, the coordinator advanced to Chase Prime.
2. The loopback bridge reported the non-financial state
   `activity_capture_no_table` and no command remained queued.
3. `weekly-refresh.mjs` did not treat that terminal outcome as a source block;
   it waited until its overall timeout.  The run was cancelled safely.

**Coordinator defect:** terminal states such as `activity_capture_no_table` and
`activity_capture_page_limit` must fail the active source immediately with a
fixed code.  They must not leave a twelve-minute idle coordinator.  An
authentication-required state is different: it should wait for the user's
normal sign-in/MFA.

#### Chase-only retry

1. The unchanged displayed `.4.20` collector was started with the paired Chase
   command, not the weekly coordinator.
2. It reached the expected structural lifecycle: card opening, authentication
   transition, authenticated page, and capture dispatch.
3. It captured both card activity pages as encrypted local evidence.  The
   terminal reported only structural/validation counts and gates.
4. Both were first-page comparison baselines, not certified imports: accepted
   anchor/coverage and workbook gates still apply.

**Conclusion:** the Chase reader is viable on this machine.  The earlier
failure was a coordinator/session-handoff problem, not proof that Terra Medium
or `.4.20` cannot read Chase.  Preserve this reader and repair the coordinator
failure handling separately.

### Citi — reader reaches dashboard; source-total contract remains unverified

#### Initial behavior

The shared `.4.20` background implementation only searched for an already-open
Citi tab.  When none existed, the `citi-refresh` command consumed its command
and did nothing.  This was a real missing start-tab behavior.

#### Local experimental correction

The local-only `background.js` change adds an official Citi start tab when no
Citi tab exists, reuses exactly one tab, fails closed on multiple tabs, and
waits for post-authentication navigation before re-requesting the content
reader.  It does not read/fill/submit credentials or bypass MFA.  The user
reloaded the extension to test it.

#### Observed post-sign-in results

The collector opened Citi and reached a signed-in dashboard.  Across bounded
retries, it identified the account, required balance fields, due-date field,
and activity rows, but certification varied as the page state changed:

- One read showed no pending rows but no explicit pending-total element.  The
  reader correctly refused to infer a zero for Citi.
- A later read showed current pending activity and an explicit pending total,
  but no verifiable posted-total element.

Neither candidate was saved as a verified workbook input.  This is correct
fail-closed behavior, but Citi's source contract is too strict for this
machine's currently rendered dashboard variant.

**Citi next diagnostic:** record fixed structural booleans/counts only:
whether the signed-in dashboard is present, whether pending/posted section
markers exist, whether their total elements exist, and whether the reader is on
the expected filters.  Do not log labels, amounts, dates, merchant text, or
account data.  Compare the exact Citi reader file hash/content with the other
machine's working version before broadening zero-pending logic.  A correct fix
must distinguish an explicit bank no-pending state from an incomplete, delayed,
or filtered page.

### PayPal Credit promotions — layout contract mismatch diagnosed

#### Initial behavior

The shared background code also only captured an existing PayPal tab.  With no
tab, it did nothing.

#### Local experimental correction

The local-only background change opens/reuses one official PayPal tab, fails
closed on multiple tabs, and preserves a pending capture through normal
sign-in navigation.  The user signed in and reached the approved PayPal Credit
Special Financing view.

#### Early misleading diagnosis corrected

The first two signed-in attempts were silent.  It was initially described as a
missing page-reader acknowledgement.  That conclusion was **not justified**:
the existing runner collapsed a generic `not_ready` result into an
authentication-wait state and did not expose the actual structural reason.

#### Targeted safe diagnostic result

A local-only diagnostic was added that reports only one of several fixed states
and never sends financial text.  The PayPal run reported:

```text
paypal_financing_sections_missing
```

This proves all of the following:

- the PayPal content script was present and responded;
- the collector was on the signed-in approved financing route;
- the strict expected three-section contract did not match the rendered page.

The current reader expects the exact visible section-heading sequence
`Expiring`, `Active`, `Paid off`.  The home-machine page does not render that
contract as expected.  Possible causes include responsive layout, browser zoom,
Windows display scaling, an A/B page variant, or a changed PayPal DOM.  The
diagnostic does **not** prove which one.

**PayPal next diagnostic:** compare only sanitized structural information from
both machines: viewport dimensions, device-pixel ratio, Chrome site zoom,
visible heading count, recognized-section count, card-container count, and
whether relevant content is in shadow DOM/iframe.  Do not copy or upload the
heading text, card text, screenshots, or DOM dumps.  Then adapt the reader to a
stable structural contract and test it with fictional fixtures plus one
attended local read.

### Wealthfront — signed-in page reached, content-reader handoff unconfirmed

1. An initial run used a public/unsigned Wealthfront tab and correctly returned
   no usable activity.
2. The user signed in; browser state showed an Individual Cash Account page.
3. A second `wealthfront-refresh` run found that page, but the bridge received
   no content-reader acknowledgement or structured capture result.
4. The run was stopped safely.  No evidence or workbook change was produced.

**Wealthfront next diagnostic:** add the same bounded, non-financial lifecycle
tracing used for PayPal: content-script injected, command delivered, reader
started, signed-in account shell seen, activity structure seen, candidate sent,
or fixed failure stage.  First determine whether the issue is stale
content-script injection after extension reload, message delivery, or selector
compatibility.  Do not inspect or log account content.

## Why the other machine may behave differently

Possible environmental differences include:

1. exact collector source/commit, despite identical displayed extension version;
2. Chrome version and extension-runtime state;
3. Windows display scaling, monitor resolution, and browser zoom;
4. responsive or experiment-driven bank page variants;
5. content scripts injected before versus after an extension reload;
6. installed content blockers or privacy extensions interfering with page assets
   or scripts; and
7. different sign-in/session transitions.

Do not assume resolution is the cause without the safe structural comparison.
Resolution/zoom can plausibly affect the Citi/PayPal readers because both use
rendered-visibility checks, but it would not by itself prove a missing
content-script acknowledgement.

## Most useful additional data to collect tomorrow

Collect only the following non-financial metadata.  It can be shared in Git or
chat if it contains none of the excluded private content above.

| Category | Useful data |
|---|---|
| Collector identity | Git commit; SHA-256 hashes of `background.js`, `citi-page-state.js`, `paypal-page-state.js`, and `wealthfront-page-state.js`; extension ID and displayed version |
| Browser | Chrome version; operating-system version; profile name only; whether each target tab was opened before or after the most recent extension reload |
| Display | active monitor resolution; Windows display scale; Chrome zoom for Citi, PayPal, and Wealthfront; browser window state (maximized/not) |
| Safe extension diagnostics | extension error titles/stack locations with any page URL/query, account number, or source text redacted; service-worker lifecycle state; whether content-script injection acknowledgement occurred |
| Safe reader diagnostics | fixed stage enum; table/section/card counts; presence/absence booleans for expected controls; shadow-root/iframe presence; no source text or values |
| Comparison | whether the other machine sees the exact same fixed diagnostic state at the same source step |

Do **not** send screenshots, HTML/DOM dumps, network traces, cookies, browser
storage, copied profiles, credentials, OTPs, or source URLs with tokens.

## Recommended other-machine repair sequence

1. Fetch `codex/budget-collector` and begin at documentation commit `1b484eb`.
2. Preserve any local code before syncing; compare local source hashes first.
3. Do not change Wells or the working paired Chase reader.
4. Repair the weekly coordinator so terminal non-table/page-limit outcomes fail
   immediately with a fixed source code rather than waiting for the overall
   timeout.
5. Add bounded lifecycle tracing to Citi and Wealthfront, matching the new
   PayPal diagnostic style.  Keep it structural and non-financial.
6. Compare the working other-machine Citi/PayPal/Wealthfront reader contracts
   with this machine before changing selectors or verification rules.
7. Test each source individually after sign-in, then verify its encrypted
   evidence/normalization gates.  Do not run a six-source weekly refresh until
   each individual source reaches a deterministic outcome.
8. Only after all required sources pass should the private workbook importer be
   invoked.  It must retain its exact backup and leave the workbook unchanged on
   any source/identity/anchor/count/total/formula failure.

## Related report

See `docs/CHASE_IMPORT_INCIDENT_2026-09-29.md` for the earlier Chase/Citi
incident report.  This document supersedes it as the complete run handoff while
retaining the same privacy boundaries.
