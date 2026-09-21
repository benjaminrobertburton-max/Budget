# Collector workbook intake — September 21 checkpoint

## Current default: direct Wells/Chase import

**Citi integration added:** add `"citi": "4444"` (fictional example; use the actual
suffix privately) to the existing `bindings` object. The importer then requires
fresh Citi evidence too, applies it to the existing `Citi` ledger account, Citi
source-control row and `Citi card` debt inputs, including the bank's actual minimum
payment and due date. Existing three-account configurations still work unchanged;
they do not import or certify Citi. No financial setting belongs in Git.

At home, `node collector/src/cli.mjs citi-refresh` captures the one open signed-in
Citi tab to the same encrypted default private store used by Wells/Chase. As with
the existing capture commands, stop the bridge after capture before starting the
next institution. Use the normal `workbook-import` command after gathering fresh
evidence for all configured accounts. The same 15-minute freshness checks apply.
Configure `privateRoot` to that existing home store. Never run persistent capture
on the work machine; use `citi-work-test.mjs` for temporary evidence there.

The workbook's accepted ledger is the persistent anchor store. A successful import
updates it; the next import must match that accepted overlap. No separate proposed
capture baseline can authorize a workbook write. Missing anchors stop safely, with
no history sweep or guessed matches. Citi integration tests cover encrypted-source
selection through a saved workbook, replay, settlement, source counts/signed totals,
minimum/due date, backup integrity, preserved History and stale/missing-anchor refusal.

Using the private configuration below, run
`node collector/src/cli.mjs workbook-import <absolute-private-config>` or
`work/run_weekly_import.ps1 -CollectorConfig <absolute-private-config>`.
The builder equivalent is `--collector-import=<absolute-private-config>`.
This updates `baseWorkbook` itself; it does not add an intake tab. The original
bytes are retained as `before.xlsx` in the private run folder alongside an encrypted
receipt and previews. Keep Excel closed during publication. Financial files never
belong in GitHub or a cloud-synced directory.

All three fresh captures and their accepted workbook anchors are required. Matching
uses date, description, signed amount and duplicate occurrence, never display order
alone. A missing initial anchor or legacy/source mismatch blocks publication; resolve
that one-time private baseline against evidence, not fuzzy guesses. Current pending
is reconciled separately; disappeared pending remains recorded as previous pending,
not asserted cancelled. Unclear dates, merchants and matches remain flagged.

The import updates the ledger, existing classification rules' results, Wells cash,
Chase balances, independent source controls and the prior Tuesday–Monday analysis
period. It preserves the existing workbook layout and financial assumptions. With
the user's approval, recorded earlier History posted/pending totals become fixed
values so later settlement cannot rewrite closed weeks; downstream History formulas
remain. Unknown card payment requirements are not assumed zero; only explicit bank
no-payment-due evidence permits zero. Other account checks remain required.

Before replacement: recalculate, scan errors, verify source counts/signed totals,
compare saved values, preserve native workbook parts, render changed input sheets,
and check the original has not changed. Any failure leaves the workbook unchanged.
Tests cover replay, duplicate purchases, pending settlement/ambiguity, cleared dates,
backup integrity and failure cleanup. Actual-template compatibility passed with zero
formula errors and no change to the original. Private home acceptance remains.

`workbookReady: false` means the full household payment plan is not ready, **not**
that the Wells/Chase ledger import failed. The old optional `workbook-intake` command
still creates a review-only copy; the historical sections below describe that mode
and its former limitations, not the new direct import.

## Older optional review-only mode

The existing builder now has an explicit collector-intake mode. It reads fresh,
Windows-user-encrypted RAW Wells and both Chase card captures from private local
storage, checks the configured account bindings, re-runs the existing normalizers,
and makes a **separate review copy of the current local workbook**. It does not
rebuild that copy from the hardcoded September financial snapshot.

The copy adds `Support - Collector Intake` after the existing tabs. It contains
captured balances, posted/pending counts, source rows, missing/invalid information
and private evidence references. Unparsed non-marker rows remain visible, with no
invented amount or date. Chase absent-pending inference retains the approved
institution-wide provenance. Missing captures are unknown, not zero.

Start and Tuesday Review carry explicit incomplete/prior-review warnings. All
existing financial cells, formulas, validations, payment confirmations, history,
settings, links and native workbook parts are preserved. Existing sheet order is
unchanged. The extra support tab is necessary to keep unverified source rows out
of the accepted ledger and spending formulas.

Before publication the code compares the original workbook components, recalculates
and compares all original cell values except the deliberate warning labels, scans
for formula errors, and renders the three affected tabs. Publication is exclusive
into a new run folder; the configured original is never replaced. An encrypted
receipt records original/output hashes and the evidence references. Validation
failure removes that run's derived files, leaving the original unchanged.

## What this does NOT complete

This is a working **source-evidence-to-workbook review boundary**, not a verified
weekly budget refresh. `workbookReady` remains false. It does not accept rows into
the ledger, reconcile against accepted private history, classify new merchants,
roll the purchase week, update source verification, create a new payment plan or
mark a payment completed. Those are still portable development work, not tasks
being deferred to the user at home. The existing historical totals in a review
copy must not be treated as current.

Next implementation must migrate/bind accepted private history, reconcile duplicate
occurrences and pending-to-posted changes, encode required source freshness and
obligations, and connect verified facts to the workbook's existing calculations.
Do not remove these gates just to produce a completed-looking payment checklist.
The remaining account adapters and approval-only sign-in/launcher acceptance are
also unfinished. No new weekly manual-entry workflow is prescribed here.

## Private configuration and invocation

This is a development command, **not** the final one-button launcher. At home,
configure it once against the authoritative private workbook and the collector's
private evidence root. Never put this configuration, account bindings, evidence,
generated workbook or previews in the repository or a synced folder. The example
below uses entirely fictional account suffixes and an illustrative local path:

```json
{
  "version": 1,
  "baseWorkbook": "C:\\PrivateBudget\\current.xlsx",
  "privateRoot": "C:\\PrivateBudget\\collector",
  "outputRoot": "C:\\PrivateBudget\\reviews",
  "bindings": {
    "wells": "1111",
    "chase_sapphire": "2222",
    "chase_prime": "3333"
  }
}
```

Use the same private evidence root as the configured capture runner, not a second
empty store. The file supports exactly these fields. Account bindings must match
the captured accounts; both Chase bindings must differ. Present captures must be
no more than 15 minutes old and not future-dated. This is capture freshness, not
proof of anchor/history reconciliation. At least one capture is required. Missing
sources are shown explicitly; they do not authorize a payment plan.

From the repository root, either entry point reaches the same implementation:

```powershell
node .\collector\src\cli.mjs workbook-intake C:\PrivateBudget\intake.json
.\work\run_weekly_import.ps1 -CollectorConfig C:\PrivateBudget\intake.json
```

Do not use the legacy build without `-CollectorConfig` to import collector evidence;
that path still builds the existing dated snapshot. Do not use a previous intake
review as the next base: it is rejected to avoid accumulating duplicate intake tabs.

Output: a unique private `intake-*` directory containing
`budget_collector_review.xlsx`, `Start.png`, `Tuesday.png`, `Collector_Intake.png`
and `receipt.enc`. The workbook/previews contain financial information and are
ordinary local files; only the receipt and source evidence are encrypted. Keep the
directory private. Export also uses an owned local temporary file and inspection
sidecar, removed in `finally`; a killed process/OS crash cannot guarantee cleanup.
Do not claim forensic erasure or clearing of personal Chrome data.

## Runtime, portability and verification

No extension change/reload is needed (bridge remains 0.4.11). The implementation
uses the existing workbook runtime: Node 22+ and the locally installed
`@oai/artifact-tool`, `jszip`, `xml-js` available to `work/`. No work-machine absolute
paths or dependency junctions are committed. Portable dependency installation/
preflight is still a release gate; `pnpm install` in `collector/` alone does not
install the workbook runtime. The import operation itself makes no model call.

Tests use fictional financial inputs, temporary local files and ephemeral fixture
encryption; they never initialize the real home store. They cover source signs,
missing dates, malformed rows, freshness, account mismatch, inferred pending,
formula injection, preserved native parts/financial cells, formula-error cleanup,
empty input and prohibited repository/cloud output paths. Visual QA uses fictional
copies only; it is not a claim of testing the newest private home workbook or Excel.

Final checkpoint: 334/334 full core/browser tests passed (14 new intake tests),
collector QC/syntax/diff checks passed, and the existing builder reported zero
formula errors. A separate in-memory legacy-template check preserved all 719
formula results without saving a financial output. The rendered fictional fixture
preserved 4,858 original cell values and all original native parts except the
explicit warning labels/additive worksheet metadata. Concurrent edits and missing
CLI arguments also have fail-closed regressions.

The next home session must preserve its newer private workbook/settings/history,
sync `codex/budget-collector`, and read the newest handoff first. No financial data
is to be pushed, and no verified production update or deployment is claimed here.
# Optional PayPal financing integration

Home command: `node collector/src/cli.mjs paypal-refresh` with one signed-in
PayPal tab. Reader follows the observed Credit/See all links and reads promotion
details only. Reload bridge 0.4.15 and approve www.paypal.com access once.
Work-machine testing must instead use `node collector/src/paypal-work-test.mjs`;
never initialize the home store here.

Add `paypalPromotions` to the PRIVATE workbook-import configuration (outside Git).
It is an array of exact mappings, one per existing Promo Detail row. Each has:
`workbookMerchant` (existing worksheet label), `merchant` (exact source label),
`purchaseDate` and `expirationDate` (ISO YYYY-MM-DD). These are sensitive local
settings, not repository defaults. Normal weeks reuse them automatically.

Direct import requires fresh source evidence and matches these purchase identities
before updating C/D6:9 and reference date B3. It leaves deadlines, payoff formulas,
stage assumptions, debt-card balance/minimum, savings transfers and history intact.
Missing bound promos, changed deadlines, a changed four-row layout, or unbound
outstanding promos block publication. An explicitly Paid off record with zero
remaining balance may update the matching existing row to zero; disappearance alone
never does. Source controls reconcile promotion count and remaining-balance total.
`Promo verified` is intentionally narrower than payment/card verification.
