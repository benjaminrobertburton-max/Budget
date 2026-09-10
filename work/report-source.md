# Custom Budget Tracking System Research Brief

**Audience:** household budget owner using multiple U.S. bank and credit-card accounts

**Date:** 2026-08-30

**Scope:** A custom, phone-friendly system that tracks actual spending against weekly targets, captures pending charges honestly, avoids dependence on a single incomplete aggregation feed, and preserves the existing budgeting logic.

## Executive answer

Use an alert-ledger system: issuer-originated transaction alert emails feed a controlled ledger; a custom budget scorecard compares pending plus posted activity to the weekly plan; a small manual capture/reconciliation process catches the inevitable exceptions. This is a custom system rather than a generic budgeting app. It cannot guarantee charges that a bank neither alerts nor exposes, so it must make missing data visible rather than silently treating it as zero.

## Evidence summary

- Chase lets customers choose email, text, and push alerts for charges, refunds, payments, balances, and deposits. Chase alerts are generally processed at the end of each business day, with timing varying by alert type. Source: Chase, *Account Alerts*, accessed 2026-08-30, https://www.chase.com/personal/mobile-online-banking/login-alerts
- Wells Fargo supports eligible checking, savings, debit, credit, and loan alerts. It says near-real-time alerts can be sent when a transaction is authorized, but timing can be delayed and is subject to merchant/system processing. Source: Wells Fargo, *Alerts Questions*, accessed 2026-08-30, https://www.wellsfargo.com/help/online-banking/alerts-faqs/
- Capital One says instant purchase notifications can be configured for push, email, or SMS. Source: Capital One, *Protect Your Identity and Information Online*, accessed 2026-08-30, https://www.capitalone.com/learn-grow/privacy-security/protect-digital-identity/
- Gmail filters can label or automatically forward matching messages. Google Apps Script can search Gmail, retrieve a stable message ID, and append data to a Google Sheet. Sources: Google, *Create rules to filter your emails*, https://support.google.com/mail/answer/6579; Google, *GmailApp*, https://developers.google.com/apps-script/reference/gmail/gmail-app; Google, *Sheet.appendRow*, https://developers.google.com/apps-script/reference/spreadsheet/sheet
- A feed-derived pending list remains incomplete if the bank does not expose every pending item; the previously tested Empower export also demonstrated partial history and missing status fields. This is an observed limitation of the user-provided CSV and Empower’s documentation. Source: Empower, *Why can't I see my pending transactions?*, accessed 2026-08-30, https://support-personalwealth.empower.com/hc/en-us/articles/201170060-Why-can-t-I-see-my-pending-transactions

## Recommended design

1. Banks send direct account-activity emails to a dedicated Gmail label. Use the lowest available alert threshold and enable deposit, purchase/charge, payment, and transfer alerts for each active spending account.
2. A private Google Apps Script reads only the labeled messages, assigns a stable event ID from the Gmail message ID, parses bank-specific templates, and appends records to a raw ledger in a Google Sheet.
3. A visible merchant-rules table maps known merchants to the budget categories. It excludes card payments and transfers from spending while separately confirming savings/rent/tuition funding.
4. The current-week scorecard calculates Target, Posted, Pending, Committed, and Remaining by category. A 52-row history summarizes each Tuesday-Monday week; it never needs 52 tabs.
5. A lightweight mobile web form handles exceptions: an email alert that did not parse, an institution that only sends push, cash spending, tips/amount corrections, and intentional transfer confirmation.
6. On Tuesday, reconcile a short exception list and enter current balances for active cash/credit accounts. The system flags unmatched or stale pending items; it never assumes a missing alert means zero spending.

## Known limitations

- Some banks can delay or omit alerts; the ledger must surface coverage and exceptions.
- Email contents are financial data. The user should use a dedicated Gmail label, two-factor authentication, and a script scoped only to the user’s own Gmail and sheet.
- A transfer may produce two bank alerts. Matching rules must pair both sides so it is not double-counted as spending.
- The first version should parse only the institutions that drive day-to-day spending and then expand after each parser is tested.

## Decision

Proceed only if the user approves a private Gmail + Google Sheets system and can route account-activity emails to a Gmail label. Start with Wells Fargo, Chase, Citi, Capital One, Discover, and PayPal Credit where alerts are available; use the mobile exception form for anything not captured.

