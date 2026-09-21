# Collector workbook intake — September 21 checkpoint

## What works

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
