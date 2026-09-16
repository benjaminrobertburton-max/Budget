# Budget workbook operating rules

The user has a five-hour usage limit. Weekly imports must be completed in one session.

## Weekly workflow

1. **Collect one complete import packet.** The user sends every screenshot needed for an account's current balance, pending activity, and new posted activity. Multi-screen account captures must be stitched together; deduplicate overlap and use the saved anchor to identify only new rows.
2. **Do not modify the workbook during packet collection.** Do not rebuild, render, commit, push, or ask account-by-account questions while screenshots are still arriving.
3. **Return one consolidated reconciliation.** Include account balances, pending totals, categorized transactions, and only genuinely unreadable or ambiguous items. Never ask for information already visible elsewhere in the received packet.
4. **Apply one import update after the user resolves exceptions.** Update the transaction ledger and Start tab. Rebuild, verify, and commit once.
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

- GitHub is the shared source of truth, but sync only at the end of an import, payment, or closeout phase—not after every screenshot.
- The canonical workbook is `outputs/01a04fdf-3751-72e2-88f1-daf19b8b9d1d/comprehensive_budget.xlsx`.
- Render only Start and Tuesday Review for import/payment phases. Render analytical and support sheets only at closeout or when explicitly requested.
