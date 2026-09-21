# Budget workbook operating rules

The user has a five-hour usage limit. Weekly imports must be completed in one session.

## Collector transition

**Newest approved scope — September 21:** preserve working Wells/Chase capture
milestones; do not rebuild them or confuse capture success with a production
workbook refresh. Prioritize shared verified workbook integration, then Citi
transactions, focused PayPal promo/debt evidence and lightweight Wealthfront cash/
transfers. Discover/Capital One get smaller automated checks, not equal full-history
engines. Fidelity contributions use Wells evidence; CUTX/RBC receive periodic
focused checks without removing their weekly scheduled obligations. See "Approved
reduced scope and completion status" in `docs/HOME_MACHINE_HANDOFF.md` for authority,
proven milestones and remaining work. No silently skipped accounts or new weekly
manual chores; the user's routine role remains ONLY necessary 2FA approval.

**September 21 user-approved Chase exception (newest):** for Chase as an
institution, including Prime Visa and Sapphire Preferred, an absent pending
section on a successfully loaded, identified activity page means inferred zero
pending. Record `user_approved_chase_absent_pending` provenance, not bank-displayed
zero or independently verified totals. Present pending still requires normal
capture/reconciliation. Failed, incomplete or contradictory pages remain unknown.
This supersedes earlier blanket missing-pending warnings for Chase only; other
institutions and unrelated verification gates are unchanged.

**Newest Chase continuation:** extension 0.4.11 adds automatic card switching,
labeled balance evidence, explicit no-payment-due evidence and independent pending
count/total reconciliation. A temporary paired command tests both cards and same-session
anchor replay without retaining home history. Read the newest handoff; do not
redo the earlier navigation/heading investigation or call candidate capture a
verified workbook import. Missing pending still means unknown.

**Latest Chase checkpoint:** extension 0.4.7 implements first-page/three-row
posted-overlap stopping and bounded additional loads only when overlap is missing.
Never sweep full history by default. Preserve all current pending separately;
missing pending is unknown. Read the newest handoff for live results, remaining
coverage/navigation gates and the distinction between an unverified comparison
baseline and accepted financial history. Workbooks remain untouched.

**September 21 work extension update:** the user loaded the unpacked bridge here
and reports it working. Do not keep treating extension installation as blocked.
This confirms setup, not source coverage or collector-led authentication.
Work-test evidence must remain temporary/encrypted and be removed after the test;
do not run the existing home refresh CLI here against its persistent default
store. Preserve ordinary personal Chrome and do not claim its cookies/cache are
erased by collector-evidence cleanup. Resolve that boundary before a live capture.

**Current direction — September 21, 2026:** develop the core functionality for
all required account adapters and the portable Chrome extension on this work
machine, then sync software to the home machine for installation and acceptance.
Home-plan usage made continued development there impractical. This supersedes
September 18 instructions to move development home or stop at Wells before doing
any other adapter work. Preserve the weekend progress pulled at `45c8309`:
ordinary-Chrome bridge 0.4.3, Wells capture/normalization/overlap, and Chase discovery.
Read the newest checkpoint in `docs/HOME_MACHINE_HANDOFF.md` and the evidence-first
protocol in `docs/COLLECTOR_RND.md`. Chase is the active next adapter; do not rebuild
Wells or revive the disposable live pilot. The previous work extension-installation
restriction is not assumed lifted: portable code/fictional browser testing can
proceed here without installing an extension or accessing a bank. Live verification
requires permitted browser access and source evidence, never invented selectors.
Git carries only code, docs and fictional fixtures; preserve home-private data.
The intended weekly role remains ONLY text-code/2FA approval; saved-credential
sign-in automation is still an acceptance gate, not a demonstrated capability.

**Latest authentication correction (September 18):** the collector, not the user,
must open institutions and complete ordinary sign-in via Chrome's user-configured
saved-credential/autofill flow, including normal sign-in navigation/submission.
The user's intended routine role is ONLY text-code/2FA approval when needed.
This supersedes older manual-sign-in requirements in these documents. Implement
and verify this at home; current code does not support it. Do not read/extract,
store, log or transmit passwords, copy cookies/profiles, bypass MFA/CAPTCHA, or
disable browser/bank security. If autofill is unavailable or the bank requires
another user gesture/challenge, stop and report the limitation; do not silently
redefine manual login as normal operation or promise approval-only operation
before each institution has been tested.

**Latest continuation decision (September 18, 2026):** live browser work moves
home because extensions cannot be installed at work. Stop work-machine live
pilots and appearance-only troubleshooting. Read the "Home development resume"
section in `docs/HOME_MACHINE_HANDOFF.md` first; it supersedes earlier next-pilot
instructions below. Sync `codex/budget-collector`, not just `main`, preserving
all local financial changes. This is a development continuation, not a completed
production handoff. Ordinary home Chrome is the user's preference, but a supported
connection is not implemented or selected. Do not claim an extension is installed
or approved, copy profiles/cookies, extract passwords, or weaken browser security.
Confirm the home OS and connection permissions, reuse existing code, and prove
one complete Wells collection before adding institutions. Normal weekly operation
must use deterministic local code with no AI session.

The project is transitioning from screenshot-based imports to a local, read-only, direct-browser collector. Read `docs/BUDGET_COLLECTOR_VISION.md` and `docs/HOME_MACHINE_HANDOFF.md` before any collector, workbook-architecture, or home-sync/deployment work. The vision records the one-button-refresh goal and financial/security rules; the handoff checklist records the complete portability requirements, justified home-only steps, current gaps, and main-release gates. Keep it current after relevant milestones; do not make the user reconstruct the plan from chat.

Until that collector passes its documented shadow-mode and acceptance checks, the screenshot workflow below remains the required fallback. Do not put credentials, browser state, raw financial data, screenshots, or collector databases in Git.

### Confirmed local-only boundary (September 18, 2026)

- The user confirmed that the finished system runs on the home machine. Real workbooks, financial inputs, transaction history, private settings, and backups stay local. Future GitHub updates contain software, documentation, and entirely fictional tests only.
- The collector gathers and validates account evidence. The existing workbook and builder retain budgeting calculations, categories, upcoming expenses, scheduled transfers, rent rules, and payment decisions.
- The collector must not decide to skip a scheduled transfer or change a budget rule. Its verified input will replace manual entry of bank facts, not the household financial model.
- Build collector changes on `codex/budget-collector`. Read `collector/README.md` for implemented scope and remaining gates. Live bank adapters are not installed yet. The persistent private store is initialized exclusively on the home machine.
- The user subsequently authorized live, read-only work-machine testing, subject to workplace permission, CONDITIONAL on deleting the test financial data afterward. Use `%LOCALAPPDATA%\BudgetCollectorTesting\run-<random-id>` outside Git/OneDrive, encrypted collector records, and a new disposable browser profile with no Chrome sync. Never attach to, copy, or clear the everyday personal Chrome profile. User handles credentials/MFA. Close the test browser before deleting its entire owned run; verify removal even after a failed test. A crash or failed cleanup blocks further live tests until remaining files and processes are resolved. No live test may run until browser shutdown and cleanup are integrated and demonstrated with fictional data.
- Keep software, generic navigation rules, entirely fictional fixtures, and non-sensitive test results; never keep real transactions, account identifiers, page dumps, cookies, screenshots, test workbooks, or financial debug logs in Git, chat, or agent tool output. Deletion of new test artifacts does not authorize deleting existing workbooks or Git history. Ordinary file deletion is not a forensic-erasure guarantee and cannot remove employer/OS logs or existing chat records.
- Weekly manual sign-ins are acceptable. Minimize attended time by grouping sign-ins and collecting already-authenticated institutions without waiting for every bank to finish. Measure attended authentication and collection time separately; do not promise an unmeasured duration. Complete all portable development/testing here; defer only home-specific sessions, storage/migration/backup setup, and home acceptance checks, each with a concrete reason.
- The fictional Chrome demo creates its separate disposable profile automatically. The user needs no new Google account and no manual profile setup; never ask them to sign into Chrome sync. The fictional transport remains loopback-only. Version 0.5 supplies a separate visible Wells pilot: the launcher opens only local controls; bank navigation requires the user's permission acknowledgement and **Open Wells** action. HTTPS Wells domain-family destinations and the private panel are permitted. Version 0.5.1 also permits GET-only stylesheet/font/image resources on three exact, publicly reviewed media hosts; read `docs/WELLS_ASSET_REVIEW.md`. This is not media-site navigation, script, fetch/XHR or submission permission. Redirects retain method/type checks. All unreviewed destinations, WebSockets, unknown popups, and child-frame requests remain blocked. Stop on incompatibility; do not bypass authentication/security controls. Browser features need the pinned dependency from `collector/pnpm-lock.yaml`.
- Stopped-test recovery (`recover-test` inspects; `--confirm-cleanup` authorizes only proven owned temporary files) never kills personal Chrome and must block on uncertain ownership/processes. The pilot offers text-free structure inspection, stop/cleanup, a 20-minute limit and at most 12 outlines. Outlines are not financial evidence or proof of login/coverage; no real transaction reader or workbook update is enabled. The first attended sign-in reached an unstyled summary; zero outlines were saved and cleanup was verified. Read the current handoff checklist before retrying. Full authenticated-page compatibility remains unverified; fictional tests do not certify it.
- User priority after the v0.5.1 retry: Wells styling remained broken, but the user could navigate to checking activity and see transactions. Do not spend further work or sign-in attempts solely on bank-page appearance. Prioritize deterministic read-only navigation, extraction and source completeness. Fix a blocked resource only when it prevents authentication, required data, pagination or reliable controls. The intended weekly role is manual sign-in/MFA and genuine exceptions, not opening each account or paging through transactions. Development/onboarding steps must not become routine weekly chores. This changes priorities, not the privacy, read-only or bank-security boundaries.
- Version 0.6 adds an explicitly consented private activity-table candidate read and optional local row preview. This supersedes the structure-only limitation above, NOT the verification or privacy gates. Raw table text is encrypted in the disposable run; only fixed structural enums/counts reach normal state/CLI/agent output. Never call the private preview endpoint from agent tools or inspect live private evidence. No actual source is certified, no automated bank navigation is installed, and no financial workbook update is enabled. The next attended test should test activity extraction, not appearance. Keep the immediate milestone narrow: obtain the actual structural result, implement missing mapping/coverage, then expand. Do not add unrelated infrastructure before validating Wells.
- Subsequent explicit user request: "why dont you just view it with me so you can figure this out faster?" For the attended Wells debugging session, the user now authorizes direct visual inspection of the disposable bank window after they complete sign-in/MFA. This is a narrow exception to the no-agent-view restriction, not permission for Git uploads, financial debug logs, credential access, personal-profile access, or money movement. Do not repeat account values in chat or save bank screenshots as files/fixtures. Explain that tool-visible screen captures enter the conversation and cannot be removed by disposable-file cleanup. Inspect only the designated pilot window; use the computer-use skill and leave authentication to the user.
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
