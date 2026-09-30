# Local weekly budget runbook — collector first, screenshots as fallback

**September 30 collector checkpoint:** before a collector run, read
`docs/COLLECTOR_RELEASE_0_4_32.md` (Routine operation). Read the September 29 home
incident report only when investigating that incident, not on every weekly run.
Use the private authoritative workbook and the existing local import configuration.
`weekly-start` survives its terminal closing and resumes saved source receipts.
`weekly-test` exercises collection and import validation without changing the
workbook. `collector-diagnose` replays local evidence without new bank captures.
Reload extension **0.4.32** after syncing. See the current release's explicit
fresh-run/home-acceptance limits; a successful software check is not certification.
Do not run the dated builder below or replace the private workbook from Git.
Software validation does not replace the two attended work passes and home smoke
test. Manual Discover/Capital One, Wells-only CUTX evidence, and excluded RBC scope
remain unchanged. No payment confirmation or safe-cash addition is inferred.

## Rent timing

The direct importer writes the review Tuesday into the private workbook's Tuesday
Review control cell. The checklist treats rent as a full payment only when the
first of the month falls from that Tuesday through the following Monday. On every
other review it shows the normal capacity-limited weekly contribution. Actual rent
payment/funding remains user-confirmed; the date rule never marks it paid.

For a transferred private workbook, follow the release document's **Portable
workbook handoff** section. The latest supplied work workbook includes accepted
Wealthfront checkpoint metadata; preserve it, back up the existing home file and
keep home-local configuration/evidence. Normal preflight checks this before bank
collection. Do not reset anchors or copy Windows-bound encrypted files.

Collector development now has a direct private-workbook entry point:
`work/run_weekly_import.ps1 -CollectorConfig <absolute-private-config>`.
Read `docs/COLLECTOR_WORKBOOK_INTAKE.md` before using it. It reconciles Wells/Chase
into the ledger and balance inputs, keeping a backup. It does not create a new
payment plan before remaining sources are checked. The ordinary
builder below still contains dated snapshots; never use it to replace the newer
home workbook during collector setup. Financial files remain private.

The intended replacement is the local direct-browser collector documented in `docs/BUDGET_COLLECTOR_VISION.md`. Do not revive the earlier email-alert approach or substitute a generic aggregator for it. This runbook remains only until the collector is proven in shadow mode.

Use one Codex task for the entire weekly import. Collect the complete screenshot packet first; do not rebuild while screenshots are still arriving.

The September 18 local-only decision overrides earlier workbook-sync instructions. Keep real financial updates, including any changed workbook or financial values in builder code, local. GitHub is now for software, documentation, and fictional tests only. Existing tracked financial history requires a separate migration; do not remove local files or rewrite history during a weekly import.

Recommended local prompt:

> Pull the latest software updates without overwriting local financial changes, inspect git status, and process the attached weekly screenshot packet as one audited batch. Update only the current ledger, Start, Tuesday Review, and current History row. Reconcile visible counts, posted totals, pending totals, latest-posted anchors, balances, and statuses. Flag unclear items instead of guessing. Run `work\\run_weekly_import.ps1`, inspect only Start and Tuesday Review, and verify the formula scan. Keep the resulting workbook and any financial changes local; do not commit or push them. Do not run closeout formatting or render supporting tabs.

Run the lightweight operational build locally from the repository root:

```powershell
.\work\run_weekly_import.ps1
```

For the occasional full review after payments or at closeout:

```powershell
node .\work\build_comprehensive_budget.mjs --phase=closeout --quiet
```

The builder still supports the existing full inspection output when `--quiet` is omitted. The quiet mode reduces terminal/context output; it does not change workbook formulas, source data, validations, or rendered operational sheets.
