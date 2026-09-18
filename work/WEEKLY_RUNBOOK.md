# Local weekly budget runbook — screenshot fallback only

The intended replacement is the local direct-browser collector documented in `docs/BUDGET_COLLECTOR_VISION.md`. Do not revive the earlier email-alert approach or substitute a generic aggregator for it. This runbook remains only until the collector is proven in shadow mode.

Use one Codex task for the entire weekly import. Collect the complete screenshot packet first; do not rebuild while screenshots are still arriving.

Recommended local prompt:

> Pull the latest `main`, inspect git status, and process the attached weekly screenshot packet as one audited batch. Update only the current ledger, Start, Tuesday Review, and current History row. Reconcile visible counts, posted totals, pending totals, latest-posted anchors, balances, and statuses. Flag unclear items instead of guessing. Run `work\\run_weekly_import.ps1`, inspect only Start and Tuesday Review, run the formula scan, commit, and push to `main`. Do not run closeout formatting or render supporting tabs.

Run the lightweight operational build locally from the repository root:

```powershell
.\work\run_weekly_import.ps1
```

For the occasional full review after payments or at closeout:

```powershell
node .\work\build_comprehensive_budget.mjs --phase=closeout --quiet
```

The builder still supports the existing full inspection output when `--quiet` is omitted. The quiet mode reduces terminal/context output; it does not change workbook formulas, source data, validations, or rendered operational sheets.
