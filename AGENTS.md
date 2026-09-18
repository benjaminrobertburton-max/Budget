# Budget workbook operating rules

The user has a five-hour usage limit. Weekly imports must be completed in one session.

## Collector transition

The project is transitioning from screenshot-based imports to a local, read-only, direct-browser collector. Read `docs/BUDGET_COLLECTOR_VISION.md` before any collector or workbook-architecture work. It records the user’s one-button-refresh goal, financial-model rules, rejected aggregator/email approaches, privacy boundary, and hard acceptance criteria.

Until that collector passes its documented shadow-mode and acceptance checks, the screenshot workflow below remains the required fallback. Do not put credentials, browser state, raw financial data, screenshots, or collector databases in Git.

### Confirmed local-only boundary (September 18, 2026)

- The user confirmed that the finished system runs on the home machine. Real workbooks, financial inputs, transaction history, private settings, and backups stay local. Future GitHub updates contain software, documentation, and entirely fictional tests only.
- The collector gathers and validates account evidence. The existing workbook and builder retain budgeting calculations, categories, upcoming expenses, scheduled transfers, rent rules, and payment decisions.
- The collector must not decide to skip a scheduled transfer or change a budget rule. Its verified input will replace manual entry of bank facts, not the household financial model.
- Build collector changes on `codex/budget-collector`. The current implementation is an offline, fictional-data foundation; read `collector/README.md` for the implemented scope and remaining gates. No live collection is supported yet.
- Do not commit a regenerated real workbook or new financial values in builder code. Existing tracked financial files and Git history predate this decision; ignoring a file does not untrack it. Preserve them locally while planning the migration. Do not delete them or rewrite Git history without explicit authorization.

## Codex execution preference

- For the main weekly import/reconciliation task, prefer GPT-5.6 Terra with Medium reasoning when it is available.
- Use the lightweight weekly workflow below; do not rebuild or render supporting tabs during screenshot collection or routine payment updates.
- Use Luna for narrow read-only checks or small, clearly scoped edits when Terra is unavailable; preserve the same audit standards.
- Do not ask the user to restate this operating model. Read this file and `work/WEEKLY_RUNBOOK.md` before beginning repository work.

## Weekly workflow

1. **Collect one complete import packet.** The user sends every screenshot needed for an account's current balance, pending activity, and new posted activity. Multi-screen account captures must be stitched together; deduplicate overlap and use the saved anchor to identify only new rows.
2. **Do not modify the workbook during packet collection.** Do not rebuild, render, commit, push, or ask account-by-account questions while screenshots are still arriving.
3. **Return one consolidated reconciliation.** Include account balances, pending totals, categorized transactions, and only genuinely unreadable or ambiguous items. Never ask for information already visible elsewhere in the received packet.
4. **Apply one import update after the user resolves exceptions.** Update the transaction ledger and Start tab locally. Rebuild and verify once. Financial changes remain local under the privacy boundary above.
5. **Build Tuesday Review once.** Do this only after the import is complete. The user reports completed manual payments in one message; then make one payment-status update.
6. **Close out later.** Refresh This Week, Money Plan, Savings & Debt, History, and support sheets only after payment execution or the following day. Do not refresh them during live import work.

## Accuracy rules

- Never estimate unreadable amounts. Mark them as requiring clarification.
- Every transaction needs source, visible section, account, date, amount, category, and posted/pending state before it becomes verified.
- Treat a user-reported safe-cash amount as an **addition** unless they explicitly say it is a replacement balance. Preserve the prior balance and show the arithmetic.
- Wife/personal-safe cash is savings only. It is excluded from Wells cash availability, income available for bills, and spending capacity.
- Keep rent contributions separate from unrelated Wealthfront movements. Do not net them.
- Keep automatic transfer status separate from manual payment completion. Confirm automatics only from the next import.
- Include every account with a payment due or nonzero balance in Tuesday Review. Zero-balance accounts can be labeled Not due.

## GitHub and output rules

- GitHub shares software, documentation, and fictional tests. Never sync financial updates as part of an import, payment, or closeout phase.
- The legacy workbook is `outputs/01a04fdf-3751-72e2-88f1-daf19b8b9d1d/comprehensive_budget.xlsx`. Preserve it until the home-machine migration verifies a private local replacement and backup. Its tracked status does not authorize future financial commits.
- Render only Start and Tuesday Review for import/payment phases. Render analytical and support sheets only at closeout or when explicitly requested.
