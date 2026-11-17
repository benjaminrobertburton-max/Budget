# Weekly bill-payment workflow

## User decision, November 17

The workbook is now for paying bills each Tuesday. The user explicitly retired
history, transaction categorization and reconciliation from the active workbook.
Keep an exact backup of the former workbook; do not delete the only old copy.
Use two tabs: **Pay This Week** and **Bills & Settings**. No old source-verification
gate is required to import an unambiguous captured balance. This does not authorize
inventing missing balances or payment confirmations.

## Import saved captures

Use the bundled Node runtime and existing `work/node_modules` runtime junction.
From the repository, run:

```powershell
node work/build_bill_pay.mjs --base <absolute-private-workbook.xlsx> --date <review-Tuesday-YYYY-MM-DD> --capture-date <capture-YYYY-MM-DD> --output <new-absolute-private-workbook.xlsx> --discover <current-balance> --capital-one <current-balance>
```

`--capture-date` defaults to the review date. `--root` optionally selects the private
collector root. Discover and Capital One are user-supplied each review, including
explicit zeroes. The base may be the former comprehensive workbook or the new
two-tab workbook, whose bill settings are reused. Output must be a new path so an
existing checklist with confirmations cannot be accidentally reset. The original
is preserved and backed up privately. Refresh the Codex preview after publication.

The importer reads the latest raw Wells, both Chase, Citi, PayPal and Wealthfront
records on the specified capture date. There is no fifteen-minute expiry and no
transaction reconciliation, pagination requirement, ledger, categorization, or
anchor requirement. Source timestamps remain in the private import receipt and
capture dates in the workbook. Privacy and encryption are unchanged.

## Payment rules

- Pay positive posted/current card balances weekly. Pending card purchases are not
  current card payments. Card-funded bills are not added again as separate expenses.
- Use Wells available cash, which already reflects current pending debits. Keep
  the configured minimum. Never subtract a pending AT&T debit twice.
- Keep Fidelity and tuition. This week's captured corresponding Wells debits
  reduce the amount still reserved. A recurring tuition debit differing by at
  most five cents updates that schedule; larger changes require an explicit edit.
- Automatic rows say Done only for the manual-action checklist. They do not assert
  bank settlement. Keep their not-yet-reflected cash reserved.
- Weekly car funding is monthly / 4, rounded to cents. Skip it in the Tuesday–Monday
  week containing the 26th; display the full payment from the car reserve instead.
  The reserve balance is not captured: confirm sufficient reserve in that week.
- Rent is due on the first. In the due week, show the configured rent estimate as
  the payment and confirm the actual bill. Otherwise fund only leftover Wells cash,
  capped at the existing maximum. Do not borrow savings to fund a rent contribution.
- Calculate one net Wealthfront-to-Wells top-up only when required. A calculated
  transfer is a proposed action, not an executed bank transfer.
- User approved weekly PayPal payments toward each promo deadline. Divide each
  remaining balance by the number of review Tuesdays strictly before its deadline,
  with at least one payment, and round to cents. Refresh next week from actual
  remaining balances. Already-captured current-week repayments reduce the new
  payment. PayPal minimum is not captured; enter it if greater than this schedule.
- Personal safe cash is excluded. Canceled cruise and general savings stay removed.
- Canada bills remain a month-end/27th reminder, not an inferred current Wells debit.
  Confirm necessary funding in their due week. Other direct bills have a visible
  editable input. Do not assume the collector can discover every future obligation.

Changing Done statuses tracks actions; it does not rewrite the captured opening
cash or recalculate the initial rent allocation. That avoids using money from an
already-planned payment twice. A new collection requires a new checklist.

## Home handoff and limits

Sync `codex/budget-collector`, and transfer the latest private XLSX separately.
Use that XLSX as the base for the next import; never replace it from Git. The XLSX
contains the needed bill settings. DPAPI-encrypted captures stay on their originating
Windows machine. Collect new home evidence there. No extension permission change
is needed for this workbook-only importer.

November 17 used already-saved captures, including Citi's raw capture and manually
read PayPal promotions. Existing Citi/PayPal automated capture limitations were not
fixed by this change. Old `weekly-start` still uses ledger-based publication; do
not call it a bill-only runner. Use the saved-capture importer above after collection.
Do not repeat all-bank debugging or a full historical test suite for a routine import.

Private output has no transaction ledger, history tabs or audit tabs. Small software
checks for malformed amounts, broken formulas, private paths and accidental file
overwrites protect the file; they are not a weekly financial reconciliation step.
