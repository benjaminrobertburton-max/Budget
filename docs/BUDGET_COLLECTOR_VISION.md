# Budget Collector — product vision, operating rules, and build handoff

## Status and authority

This document is the durable specification for the project's next major change: replace the screenshot-driven weekly import with a **local, read-only, direct-browser collector** and a one-button workbook refresh.

It records durable decisions, not a live financial snapshot. Do not treat any historical balance, payment amount, or dated workbook value as current just because it appears elsewhere in the repository. The user confirmed on September 18, 2026 that the finished system and persistent financial information stay on the home machine. They subsequently authorized temporary, read-only work-machine bank testing, conditional on deleting test data afterward and workplace permission. GitHub shares software, workbook structure, documentation, and fictional tests only. It is **not** a place for the real generated workbook, private financial settings, credentials, browser state, raw bank data, or collector databases.

Read this file together with `AGENTS.md` before working on the workbook or collector. Until the collector has passed its acceptance criteria, the existing audited screenshot workflow in `work/WEEKLY_RUNBOOK.md` remains the fallback.

Implementation has begun on `codex/budget-collector`. `collector/README.md` documents the offline foundation, Windows user-bound encrypted storage, disposable Chrome demonstrations, tests, and remaining production gates. Chrome integration currently reads fictional loopback pages only; no bank readers are installed. Its fictional-data candidate can be stored in disposable encrypted test records but is not a verified import and cannot update a workbook. Work-machine tests never initialize the real private financial store; that belongs on the home machine. The existing financial workbook and builder remain unchanged.

Existing real financial files and prior Git commits predate the local-only decision. Do not delete them, silently untrack the only working copy, or rewrite Git history as part of collector development. First preserve and verify a private local copy; resolve historical repository cleanup separately.

## The outcome the household wants

The budget system must become an aid rather than a second job.

- Normal weekly use is one visible **Refresh Budget** action on the home/local machine.
- That action collects current data, validates it, reconciles it, rebuilds the workbook, verifies it, saves a private local backup, and opens the verified local result. It never uploads financial data to GitHub.
- It must not require screenshot packets, email alerts, manual transcription, or an LLM-driven reconciliation during a normal run.
- It must never silently treat missing information as zero or “good enough.” A failed or incomplete source should produce a short, specific exception instead of changing the budget from stale or partial data.
- The target is a refresh that completes in minutes and is comfortably within the user's five-hour plan limit. Routine use must not consume multiple agent sessions.
- The collector is read-only. It must never initiate a card payment, transfer, purchase, account change, or any other financial action.

### Collection cadence: Tuesday on demand, not daily

Version 1 runs **once, when the user presses Refresh Budget on Tuesday**. It must not collect daily, consume model tokens daily, send daily prompts, or require daily MFA. The previous idea of a weekday prefetch/scheduler is explicitly out of scope for the initial build.

The collector's healthy Tuesday run should use no LLM/Codex participation and should finish in roughly **5–10 minutes** after already-authenticated pages are available. That is a performance target to measure during the pilot, not a promise: the first live run may take longer because of initial session setup and bank page variability. The user accepts manually signing in to institutions each Tuesday, but not an hour of serial collection with intermittent requests for text codes. Group required sign-ins; let already-authenticated institutions collect while the user signs in to the next. Share a legitimate institution session across its accounts where supported. Measure human-attended authentication time separately from background collection and total elapsed time. Bank security steps remain under the user's control. A normal run routinely taking longer than about 10–15 minutes needs usability review; no exact login-time guarantee has been established.

An optional preflight run may be reconsidered only after the Tuesday collector has proven reliable for several shadow cycles, and only if it is user-approved, entirely local/deterministic, requires no extra authentication, does not publish a workbook, and demonstrably reduces Tuesday time. It is not necessary to achieve the one-button goal.

This is deliberately not another generic budgeting app, a cloud data warehouse, a daily email parser, or a replacement for the household's actual bank controls. It is a private local collection and reconciliation layer that powers the existing workbook.

## Non-negotiable security and privacy boundary

The completed collector runs on the user's home/local machine. Finish all portable software and testing on the work machine. The user also uses personal Chrome at work and has now authorized live, read-only tests there, subject to workplace permission and the disposable-test rules below. A personal Chrome profile does not establish that an employer-managed computer is private. Home setup remains necessary for that computer's bank sessions, private storage/backup and workbook migration, and actual end-to-end acceptance; it must not be used as an excuse to defer portable development.

- The user performs any bank login, password-manager interaction, biometric approval, push approval, text-code entry, passkey use, or other MFA themselves. The collector must not read, store, retrieve, type, bypass, suppress, or attempt to work around credentials or MFA.
- On the home machine, a dedicated ordinary browser profile, named for example `Budget Collector`, may retain only bank-approved sessions and trusted-device choices that the user personally establishes. Work-machine tests use a new disposable, unsynced profile instead. The system must not promise that a bank will never require reauthentication; banks can revoke sessions or request MFA at any time.
- If authentication or a challenge is required, the collector stops safely and reports the exact account that needs the user's action. After the user completes the bank's normal security step, the run may resume. That is the only expected routine intervention, and it cannot be automated away safely or legitimately.
- Do not use headless-login tricks, stealth/anti-detection tools, CAPTCHA solving, saved password extraction, session-cookie export, browser-profile copying, or IP/ISP-based attempts to defeat bank security.
- Keep the real browser profile, cookies, credentials, raw page captures, source HTML, screenshots, logs containing financial data, encrypted local store, database files, and environment secrets outside Git. The local store should be encrypted with a user-bound Windows mechanism such as DPAPI.
- Never run real financial collection from a cloud runner or GitHub Action. Work-machine live testing must meet the explicit temporary-data conditions below. Never put account numbers, balances, transactions, or MFA artifacts in fixtures, commits, issues, pull requests, chat prompts, or agent tool outputs.

### Disposable work-machine tests — user-approved retention rule

- Use a fresh `%LOCALAPPDATA%\BudgetCollectorTesting\run-<random-id>` for each test session. This is outside the repository and known cloud-sync roots, and separate from the persistent home `%LOCALAPPDATA%\BudgetCollector` store. Validate the location before use.
- Collector evidence and normalized source records must be encrypted before disk writes. The existing candidate store still accepts fictional data only; this permission does not make it a live integration. Keep credentials/MFA out of the collector entirely.
- Use a new dedicated browser profile INSIDE that disposable run. Do not sign the profile into Chrome sync, import saved passwords, attach to the user's everyday profile, or copy its cookies. Bank login is separate from signing Chrome into a Google account. Browser-managed cookies/cache are not covered by the collector's record encryption; delete the entire test profile after browser exit. Disable unnecessary downloads, trace/video recording, screenshots, and financial debug logging when implementing the browser layer.
- Keep all newly generated test artifacts, including any future test workbook, in that owned run; never overwrite the current workbook. Do not retain real data as a development fixture. Save reusable generic selectors/navigation rules and invented regression examples only after checking they contain no account-specific identifiers or real values.
- After success, failure, or ordinary cancellation, close and await the test browser/processes, drain writes, delete only the exact owned run directory, and verify it is gone. Report cleanup separately from test correctness. An abrupt process/computer failure cannot guarantee immediate cleanup; block subsequent live testing until stopped processes and leftover paths are safely resolved. Never silently claim deletion after a cleanup error.
- `collector/src/disposable-run.mjs` implements the owned-run lifecycle, encrypted evidence helper, close hooks, leftover blocking, and verified removal. Both fictional storage and real-Chrome/fictional-page demonstrations exercise it. Browser process exit, grouped approval handoffs, the Cancel button, and profile removal have integration tests. A separately gated live transport, actual bank readers, real approval detection, and crash recovery must still be developed and validated before live collection is enabled.
- The user does not need a second Google account or to set up a profile manually. The test launcher creates its own empty profile. Do not sign it into Chrome sync; future live-bank login/MFA is performed by the user in that separate window. Do not modify the everyday personal Chrome setup.
- Deleting these new test files does not remove reusable code or fictional tests and does not interfere with home deployment. It does remove this work-machine test history and sessions, so another test needs fresh sign-ins. Perform multi-run reconciliation tests within one disposable session or with fictional history; persistent cross-week shadow validation belongs at home.
- Ordinary deletion is not guaranteed forensic erasure. Windows, employer monitoring/backups, bank access logs, and anything already uploaded to a chat are outside this cleanup's control. Do not place financial data in those outputs in the first place. Existing financial workbooks and historical Git commits are outside this test cleanup; removing them needs a separate explicit decision.

## Why direct local browser collection is the chosen design

Previous aggregate-data experiments were not good enough for a payment-day decision: they exposed partial history, incomplete pending activity, and missing status fields. A balance alone is not sufficient. The household needs exact current balance/available cash, new posted transactions, visible pending transactions, payment obligations, transfer activity, and PayPal promotional-plan details.

Therefore the chosen source is each institution's own authenticated site, read locally from the user-owned browser session. The collector should use account-specific, DOM-based adapters against the same summary and activity views a person sees. It should not rely on OCR or screenshot reading in normal operation.

Explicitly rejected as the primary design:

- **Empower or another generic aggregator:** prior coverage was incomplete; a different wrapper around the same incomplete feed does not solve that problem.
- **Plaid or a similar API as the source of truth:** useful only as an optional secondary health signal in the future. Pending coverage, refresh timing, liability data, and institution support vary too much for this workbook's Tuesday cash plan.
- **ChatGPT Finances:** it is not a programmatic, source-complete feed into this local workbook, and connected institutions can still omit history or payment detail.
- **Email alerts / Gmail parsing:** rejected by the user. They are delayed, incomplete, add another data store, and still require exception handling.
- **Manual screenshot importing:** the current fallback only, not the desired future experience.

## Household finance ideology the collector must preserve

The automation serves the existing financial model; it must not replace it with a generic “spend tracker.”

The user explicitly separated collection from budgeting. The collector validates source facts and transaction identity. The existing workbook and builder own budget categories, upcoming expenses, scheduled obligations, affordability, rent/savings rules, and payment decisions. Introducing a structured local input changes how bank facts enter the workbook; it does not transfer or rewrite its financial logic. Scheduled automatic transfers remain required cash actions until the user or source explicitly changes their schedule. Budget preferences and manual updates must survive regeneration.

### Start is today's cash decision

The **Start** tab answers one question: *Can the expenses that must be paid this week be covered by the verified Wells Fargo funds available now?*

- Its cash plan is based on verified Wells availability and required cash actions, not the weekly discretionary purchase cap.
- Start and Tuesday Review must reconcile to the same cash requirement. If one says there is money left and the other says additional funds are needed, that is a blocking reconciliation error.
- Preserve a minimum $1 Wells Fargo balance after planned actions unless the user deliberately changes that rule.
- Wife/personal safe cash is savings only. It is excluded from Wells availability, reliable income for bills, and purchase capacity.

### Tuesday Review is the once-per-week payment cockpit

The **Tuesday Review** tab is opened after the import and used to make payments. It should contain every source account with a payment due or nonzero balance; zero-balance, confirmed-clear accounts may appear as `Not due`.

- It tells the user what to pay or fund that Tuesday, why, and from which cash plan—not a copy of last week's closed review.
- Manual actions are separate from automatic actions. A manual action can become `Done` only after the user reports it or the source confirms it. An automatic transfer is only `Automatic / expected` until it is observed in a subsequent source refresh.
- The workbook must remain usable in the Codex previewer. Do not depend on native Excel checkbox controls that the previewer cannot click. Use clear, cell-based status values or an equally preview-compatible mechanism.
- Card payments and transfers are cash movements, not discretionary purchases; they must not be double-counted in the spending budget.

### This Week and Money Plan are analysis, not cash authorization

The purchase budget belongs in **This Week** / **Money Plan** as a review of category spending versus plan. It should not make Start's immediate cash decision harder to understand.

- Track posted, pending, committed, and remaining by category.
- Show a transaction's category only when supported by a deterministic rule or confirmed input. `Unknown` is correct when the merchant cannot be categorized safely.
- Income reliably available to bills is distinct from variable wife income and personal safe cash.

### Savings, rent, and emergency funding must remain honest

- Fidelity's weekly contribution is Roth IRA savings, not a bill payment.
- Cruise savings and future-expenses savings are general savings goals, but core bills, rent/car reserves, and promotional-debt targets must fit inside reliable Wells income before discretionary savings contributions are considered fundable.
- Preserve a rent reserve as its own tagged amount. Do not net it against unrelated Wealthfront withdrawals or Wells top-ups merely because money ultimately moves between the same two institutions.
- Wealthfront is emergency/general savings and may cover a verified Wells cash shortfall. Record the actual transfer and reduce the working Wealthfront balance by the actual amount. Do not leave the dashboard using a pre-transfer snapshot as if it were still live.
- A transfer in and a transfer out are two independently evidenced events. Match them only when both legs, dates, amounts, and purpose support the link.
- At month end, show the net emergency-fund draw separately from planned rent funding so the household can distinguish a true monthly deficit from movement between accounts.

## Known sources and required evidence

The account registry—not informal memory—must define the source set for each refresh. It must include active accounts such as:

- Wells Fargo checking: available balance, pending and posted activity, deposits, payments, transfers, and cash-plan source.
- Wealthfront cash/emergency savings: available balance and every transfer relevant to Wells or rent.
- Chase Sapphire and Prime Visa: current balance, payment-due information, statement/current balance, pending and posted purchases, payments, and refunds.
- Citi: current balance, due information, pending and posted purchases, payments, and refunds.
- Discover: current balance/payment requirement, pending and posted activity. A nonzero balance or due amount must never be omitted from Tuesday Review.
- Capital One / Quicksilver: current balance and payment requirement.
- PayPal Credit: current balance, payments, pending/posted activity, and all promotional financing plans with balance and expiration/payoff targets.
- Credit Union of Texas / car fund: current balance and applicable transfer evidence.
- RBC or any retained car/reserve account: current balance, due/payment data where applicable, and activity needed to explain a cash movement.
- Fidelity Roth IRA: confirmed automatic transfer evidence.
- Any additional current spending, debt, cash, or savings account that the user registers later.

Personal safe cash can be represented as a local manual event until it has a legitimate machine-readable source. It is **additive by default**: a user-reported amount increases the prior safe-cash total unless the user explicitly says it is a replacement balance. The collector must preserve the arithmetic and never overwrite it silently.

For every transaction or obligation included in a verified refresh, retain local evidence of:

`source • visible section • account • source event ID or stable fingerprint • transaction/effective date • capture time • signed amount • currency • posted/pending state • category/rule • inclusion decision • transfer/payment link • source snapshot/run ID`

For every account snapshot, retain:

`account • balance type (available/current/ledger) • amount • capture time • source page/section • obligation values (minimum/due date/statement/current balance where applicable) • freshness/coverage state`

## Data lifecycle and reconciliation rules

1. **Collect first.** A Refresh Budget run fetches every required source page before modifying local canonical state or the workbook.
2. **Validate coverage.** Check expected account count, page freshness, visible posted/pending counts or totals, source anchors, balance type, and obligation fields. Missing required source data is a failed run.
3. **Normalize without guessing.** Parse money as signed values; keep source merchant text; assign posted/pending precisely; preserve dates; apply deterministic merchant rules only. Never infer an unreadable digit, sign, category, due amount, or account state.
4. **Deduplicate and track lifecycle.** Use source IDs where available; otherwise use stable fingerprints with conservative collision handling. A pending transaction that posts is one lifecycle, not two purchases. Changed/recreated pending records require explicit links, not loose amount-only matches.
5. **Reconcile movements.** Detect card payments, transfers, refunds, payroll, automatic savings transfers, and cash funding separately from purchases. Pair both sides only with defensible evidence. Do not double-count card payments or transfers as expenses.
6. **Generate a verified local import snapshot.** It is immutable, versioned, encrypted locally, and is the sole input to the workbook builder.
7. **Rebuild once.** The workbook reads that verified snapshot, updates the ledger, Start, Tuesday Review, and the designated current historical row, runs formula/consistency checks, and renders Start and Tuesday Review only during an operational run.
8. **Save locally only on success.** Replace the current private workbook only when every hard validation passes, with a recoverable private local backup. A failed run must leave the previous verified workbook intact and explain what is missing. Git software updates are separate from financial refreshes; no financial output is committed or pushed.

### Hard-stop conditions

Stop rather than publish if any of these occur:

- required account/session cannot be read or is stale;
- a balance, due amount, or transaction is ambiguous;
- expected source coverage is incomplete;
- posted/pending totals or latest anchors do not reconcile;
- an unpaired transfer/payment would change cash or spending materiality;
- Start and Tuesday cash requirements disagree;
- a nonzero/due account is absent from Tuesday Review;
- formula scan, data-validation check, or workbook output verification fails.

The error display should name the account and missing evidence in plain language, for example: `Chase Sapphire — activity page requires reauthentication; no workbook changes made.`

## Lessons that become regression tests

Prior errors are not merely historical notes; each must become a fixture and an automated test before the collector is trusted:

- Multi-screen activity captures overlap. Deduplicate them; do not omit the entry between pages.
- A small negative refund (including a previously misread `-$5.40`) must preserve its sign and not be read as a positive charge.
- Fuel/gas must not be skipped because it appears in a crowded transaction list.
- Posted versus pending must be retained correctly and moved through a single lifecycle when the status changes.
- Discover or any other due/nonzero account must surface in the Tuesday plan even if it had been absent previously.
- Card payments, transfers, payroll, and savings movements must never be counted as purchase spending.
- A Wealthfront-to-Wells top-up must reduce the working Wealthfront snapshot; subsequent top-ups (such as an unanticipated bill coverage amount) must add to the transfer total rather than overwrite it.
- Rent funding and unrelated emergency transfers must remain distinct.
- A user-supplied safe-cash figure is additive unless expressly labeled replacement.
- An automatic transfer is not confirmed merely because it is scheduled.
- The source snapshot must cover both balances and transactions; no implementation may infer current balance from an old imported value.

## Local architecture

### Components

1. **Account registry and source contract**
   - One declarative record per account: required pages, fields, account type, expected cadence, whether it affects Wells cash, known obligations, and adapter name.
   - A refresh cannot silently skip a registry entry.

2. **Browser adapters**
   - One read-only adapter per institution/page family.
   - Adapters extract structured text/DOM fields, never use OCR as the normal data path.
   - Each returns raw local evidence reference, normalized records, coverage checks, and an explicit `needs_user_auth` state where appropriate.

3. **Encrypted local source store**
   - User-bound local store outside the repository.
   - Append-only run metadata, evidence references, account snapshots, transaction lifecycles, transfer links, manual safe-cash events, and exception resolution.
   - Retention policy should minimize exposure while preserving enough audit evidence to explain every workbook result.

4. **Deterministic reconciliation engine**
   - No AI model in a normal refresh.
   - Applies signed-money parsing, ID/fingerprint de-duplication, pending-to-posted linking, source-evidenced movement matching, and source coverage checks. Source-provided kinds can be retained; unknown kinds remain unknown. Budget categorization and cash-plan calculations stay in the workbook; the workbook adapter checks their resulting consistency.

5. **Workbook adapter**
   - Refactor the current hard-coded builder so it consumes a verified local import snapshot rather than manually edited values.
   - Preserve existing workbook structure, formulas, settings, manual updates, and history. Migrate the legacy canonical workbook at `outputs/01a04fdf-3751-72e2-88f1-daf19b8b9d1d/comprehensive_budget.xlsx` to a configured private location outside the repository and cloud-synced folders on the home machine, after verifying a backup. Do not regenerate the real workbook into Git as part of a refresh.

6. **Refresh Budget launcher and status panel**
   - A visible local button/shortcut invokes collection, validation, build, output checks, private backup, and local workbook opening. Software updates are separate; the launcher does not invoke Git.
   - It shows a simple state: `Collecting`, `Needs bank approval`, `Validating`, `Rebuilt`, `Saved locally`, or `Blocked` with a concise reason.
   - Version 1 has no background scheduler or weekday prefetch. It runs only from the user's Tuesday Refresh Budget action and validates freshness before publishing.

## Build order and acceptance criteria

Build on a dedicated feature branch such as `codex/budget-collector`. The work machine creates source code, schemas, fictional fixtures, tests, and documentation, then pushes those to GitHub. It may also perform explicitly authorized disposable live tests under the conditions above. The home machine pulls the software, creates its own private store/browser sessions, migrates the workbook locally with a verified backup, and performs home acceptance and shadow runs. Do not transfer work-machine test data or browser profiles to accomplish deployment.

1. **Foundation** — create collector project structure, strict TypeScript/JavaScript schemas, local-path configuration, `.gitignore` protections, account registry, sanitized fixtures, and test harness.
2. **Reconciliation first** — implement transaction lifecycle, signed amount, deduplication, classification, transfer matching, safe-cash additive events, and Start/Tuesdays cash consistency against fixtures before connecting a real browser.
3. **Workbook input boundary** — define and test the verified import snapshot format; refactor the builder to consume it while preserving the existing financial logic, settings, manual updates, history, and formula/layout protections. Verify private output and backups before migrating the real workbook on the home machine.
4. **Pilot adapter** — implement Wells Fargo summary + activity as the first direct browser adapter. Use the approved disposable work-machine test environment once browser lifecycle safeguards are ready; confirm it again at home. Prove it returns balance, pending, posted, deposits, transfers, and source coverage without making any account change.
5. **Expand adapters** — add high-impact active accounts and their payment/promo pages one at a time, with a fixture and regression test for each.
6. **One-button orchestration** — add the on-demand Tuesday launcher, status, retry/resume after user authentication, local encryption, formula/output verification, private backups, and local workbook opening. Do not add Git publication, a daily scheduler, or prefetch in Version 1. Human visual inspection belongs in development and shadow certification; routine automated checks must not require an AI or human review of every successful run.
7. **Shadow mode** — for at least three to four complete weekly cycles, compare collector output to user-visible institution pages and the existing audited workflow. Certify each source individually; do not retire the fallback until results reconcile consistently.

A build is not ready merely because it can scrape a balance. It is ready for weekly use only when a clean successful run:

- covers every registry account and required page;
- distinguishes available/current balance and posted/pending state;
- produces no unexplained coverage, balance, payment, or transfer exception;
- creates Start and Tuesday values that reconcile exactly;
- preserves the $1 Wells minimum and the household rules above;
- passes formula scan, workbook-preservation checks, and Start/Tuesday visual inspection;
- uploads no financial data, including the finished workbook, to Git;
- requires no LLM participation during the actual refresh;
- performs no money movement; and
- leaves an understandable audit trail for every imported result.

## Development and Git operating rules

- Pull and inspect `main` before beginning work. Do not reset, discard, overwrite, stash, or merge away someone else's uncommitted changes.
- Use a `codex/` feature branch for collector development. Commit atomic, non-sensitive changes with tests.
- Develop repeatable tests with entirely fictional fixtures. Authorized work-machine live tests must use the disposable lifecycle above; no private page contents or account-specific selectors may leak into source, fixtures, or development outputs. Never handle production credentials or copy existing browser profiles.
- The home machine owns the persistent private data and production sessions. The approved work-machine test exception permits temporary read-only bank access, not financial uploads or retention after testing.
- Do not install a third-party data aggregator as a shortcut without a new, explicit decision and a documented source-coverage test. It cannot replace direct evidence for the cash plan merely because it returns a balance.
- Do not reintroduce an email-alert architecture. It is a rejected path.
- Do not update financial facts while a source packet/collection is incomplete. Create a single consolidated reconciliation and a single verified workbook update.
- Closeout/analytical tabs remain a later phase after payment execution or the following day. Routine refresh should prioritize the current ledger, Start, Tuesday Review, and current history record.

## Definition of success

The finished system lets the user open the home machine, press **Refresh Budget**, and receive a truthful, source-backed cash plan and Tuesday payment plan without a multi-day screenshot process. If banks require security approvals, the system groups the required user sign-ins, resumes collection as each institution becomes ready, and never fabricates a result. Accuracy, privacy, and clarity win over apparent automation.
