# Workbook UI review — September 17, 2026

Baseline: GitHub main at f891bd7. The current review is September 15; this design pass must not advance the period or confirm further payments.

## Existing workflow and inputs (recorded before UI edits)

| Sheet | Purpose and input locations | Calculation flow / review use |
| --- | --- | --- |
| 1. Start | Import command center; cash B5, source statuses E6:E14, anchors G6:G14, statement checks H6:H14 | Account Snapshots feeds cash and verification; readiness counts identify missing audit fields and dates. |
| 2. Tuesday Review | Payments D9:D22, execution statuses E9:E22, confirmation notes G9:G22 | Verified Wells snapshot, debt targets and required automatic actions feed the cash requirement and Wealthfront top-up. |
| 3. This Week | Purchase-week selector B3 | Verified, included ledger transactions feed posted/pending spending and category variances. No cash-payment decision. |
| 4. Money Plan | Weekly allocation guide; source assumptions are in Budget Inputs | Budget Inputs and Promo Detail feed allocations. Safe cash is shown separately and excluded from Wells income/buffer. |
| 5. Savings & Debt | Savings transfers B13:C16; rent contributions C27:C29; rent date/estimate/opening reserve/confirmed funding B34:B37 | Account Snapshots, Budget Inputs, Promo Detail and Tuesday Review feed savings, rent reserve and debt summaries. |
| 6. History | Review rows, execution check G5:G30 and notes M5:M30; current row 7 | Preserves prior plans and purchase-week ledger totals. September 15 remains Needs review. |
| Support - Ledger | Source rows A:G and I:M, including archive, visible section and verification; calculated week H | Audited transactions feed spending, history and source controls. |
| Support - Budget Inputs | Payroll C6; applicable amounts D12:D31; FX B39 | Monthly/weekly assumptions feed Money Plan, spending budgets and savings targets. Formula-driven amounts stay formulas. |
| Support - Funding Detail | Due dates D5:D11 | Reserve/payment routing reference and archived payment log. |
| Support - Debt Detail | Balance/minimum/date B5:D15 | Account balances, due dates and terms; missing dates feed Start readiness. |
| Support - Promo Detail | Reference date B3 and stage deadline E3; source promo balances | Calculates staged weekly PayPal payoff and deadline exposure. |
| Support - Account Snapshots | Balances A5:G7; independent source controls A12:J21 | Expected screenshot count/total and anchor reconcile to ledger before verification. |
| Support - Pending Review | Archived August 25–31 snapshot | Historical context only; not current exposure. |
| Support - Rules | Merchant mappings A5:C31; optional fallbacks D5:F14 | Categorization reference; transfers/card payments are excluded from purchases. |
| Support - Sources | Source descriptions A4:E13 | Source periods, caveats and provenance. |

## Baseline key outputs

- Wells import snapshot: $1,392.72. It is not the user's subsequently reported live balance.
- AT&T confirmed payment: $48.59; Tuesday cash required: $1,692.93; modeled total Wealthfront top-up: $301.21; Wells minimum: $1.00.
- September 15 History preserves the original $1,644.34 plan and Needs review status.
- Wealthfront snapshot: $12,026.13; personal-safe savings: $730.00, excluded from Wells spending capacity.
- Automatic savings: $403.36 weekly. PayPal promo balance: $1,170.31; weekly payoff: $148.62.
- Tagged rent reserve: $300.00. Existing emergency-draw calculation: $900.00.

## Existing issues outside this visual-only scope

- Start says manual actions complete / verify automatics, while Tuesday Review and History flag the corrected top-up for review. These values remain unchanged.
- The displayed emergency draw uses the $1,200 reserve target. With $300 tagged and a $1,169.46 rent estimate, the rent-only gap is $869.46. The existing $900 formula remains unchanged.
- Rent-funding rows labeled Tuesday contain Wednesday dates. The funding reference previously said this cycle's AT&T reserve was $88.59; the targeted follow-up now updates that reference to the confirmed $48.59 payment. No other financial logic was changed.
- The weekly runner still executes the full builder; quiet mode reduces printed output and import mode limits previews. This UI work does not claim to reduce model usage or change that architecture.

## Targeted follow-up

- Updated `Support - Funding Detail` row 8 to show the confirmed $48.59 AT&T cycle payment and the corresponding note.
- Preserved formulas, source data, payment statuses, historical records, and the existing workflow.

## UI implementation and verification

Use a single presentation layer in the existing builder. Preserve every existing populated cell and formula at its address, validations, conditional formatting, yellow input colors, historical values and tab order. Navigation-only hyperlinks may occupy previously blank cells.

Use unfilled titles, light section rules, readable body text, fitted wrapped notes and a clear amount/status hierarchy. Keep source detail visible. Render all sheets during design review; normal weekly runs keep their existing two-preview behavior.

Run `work/verify_ui_preservation.py BEFORE.xlsx AFTER.xlsx` with the bundled Python runtime to compare all original values/formulas, cached results, yellow input colors, validations, conditional formatting and native workbook features. Separately render and inspect every changed sheet.

### Implemented design

- Kept all 15 sheets in their existing order, with every original populated address intact. No rows, columns, source records or historical periods were relocated.
- Applied an isolated presentation module after the existing builder's formatting. It uses calm Arial typography, unfilled titles, light section separators, fitted wrapping, consistent currency formats and restrained emphasis on results. Original input colors and conditional status colors remain intact.
- Made Start's cash snapshot and workflow navigation easier to scan. Tuesday Review emphasizes payment names, amounts, completion status and cash totals. This Week remains exclusively purchase analysis.
- Aligned the savings and rent summaries, emphasized PayPal targets, and added direct navigation to rent details and the promotional schedule. Compact support-sheet headings and frozen identifying columns reduce effort when reading wide audit tables.
- Added 22 native internal links in previously empty cells. Links are inserted into the exported XLSX without changing formulas, cached results, worksheet values or external relationships. The existing bundled runtime supplies `jszip` and `xml-js`; no packages were installed or dependency directories changed.

### Verification results

- Both the untouched saved workbook and the original builder's regenerated baseline matched before editing.
- Final comparison preserves all 3,144 original populated cells, all 719 formula expressions and cached results, and the colors of all 3,955 originally yellow cells, including reserved inputs.
- Sheet order/visibility, validations, conditional formatting, filters, defined names, calculation settings and protected native parts compare unchanged. The source has no macros, connections, external-link parts, charts or pivots.
- Independent cached-error inspection reports zero Excel error cells. All 22 new navigation destinations exist and contain the intended title or section.
- The existing weekly PowerShell runner completes successfully in a disposable output folder and still renders only Start and Tuesday Review.
- Design mode (`node work/build_comprehensive_budget.mjs --phase=design`) renders all 15 sheets, plus remaining populated ledger rows in manageable sections. Normal import and closeout modes keep their previous preview selection.

### Remaining limitations

- Audit-rich History, Ledger, Funding Detail and Account Snapshots still need horizontal scrolling at normal zoom. Their evidence and notes remain visible rather than hidden or compressed into unreadable type.
- Existing long instructions and source notes were retained to preserve their meaning. This pass did not rewrite financial guidance or resolve the pre-existing inconsistencies listed above.
- All changed sheets were checked in generated previews. Native internal-link targets and workbook structure were checked, but interactive link behavior and recalculation in desktop Excel or the Codex workbook viewer were not independently exercised.
- Formula equality and matching cached outputs establish preservation, not a new audit of the underlying financial assumptions or screenshot evidence.

## App-style revision following visual feedback

Baseline: commit 6bd4368. The user found the first design too white and visually flat and authorized the stronger navy-and-slate direction. This revision supersedes the unfilled-title styling above; the workflow/input map and financial limitations are unchanged.

- Replaced the white title treatment with compact navy app headers. Support tabs use smaller, muted slate headers.
- Added bounded white content panels, visibly contrasting section headers, horizontal row separators, and smooth slate gutters. No full-sheet background fills or floating shapes were introduced.
- Restyled the 22 existing native links as blue navigation buttons without changing their labels or destinations.
- Emphasized Wells cash on Start and the existing payment/funding totals on Tuesday Review. Automatic-payment rows have their own subtle background, with their original statuses intact.
- Gave Savings & Debt identifiable savings, rent, automatic-transfer, promotional-debt and forecast panels. This Week remains purchase analysis; Money Plan retains savings-only safe cash treatment.
- Kept the existing cell layout, input colors, validations, conditional formatting, freeze panes, formulas, source values, dates and historical records. No worksheet content or financial assumptions were added or replaced.
- Baseline build and preservation checks passed before editing. Post-edit comparisons preserve 3,166 populated cells (including existing navigation), all 719 formulas and cached results, all 3,955 yellow input cells, and all 22 native links. The existing formula-error scan and independent error-cell inspection report zero errors.
- Preview review covers all 15 sheets and all populated ledger rows. Wider audit sheets still require horizontal scrolling, and Savings & Debt remains vertically long because existing sections and addresses are preserved.
- Desktop Excel recalculation and interactive link navigation in the Codex viewer were not tested. Existing completion-status, AT&T-reference and rent-exposure inconsistencies remain documented above and unchanged.
