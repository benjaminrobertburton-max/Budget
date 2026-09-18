# Wells pilot visual-resource review — September 18, 2026

## Why this change exists

The first attended v0.5 pilot reached an account summary, but the user reported
unstyled content and missing images. No outline was saved. The browser exited and
the disposable profile/records were deleted with verification. No financial
values, account identifiers, session URLs or screenshot were copied into Git.

The previous policy rejected every separate media host. That is a confirmed
compatibility gap for publicly referenced Wells visual resources; the exact set
used by the authenticated summary was not captured. Fixing this gap is not a claim
that the authenticated summary or financial collection has passed verification.

## Public-source verification

Only fresh, signed-out HTTP requests were used. No bank cookies, copied browser
profile, credentials, authenticated URL or user screenshot content were used to
discover dependencies. TLS certificate verification remained enabled; the Node
check used the Windows/system trust store (`--use-system-ca`). No page bodies were
saved. The response and public CSS were examined in memory for resource references.

The [public Wells online-banking page](https://www.wellsfargo.com/mobile-online-banking/)
links to this [public sign-in entry](https://connect.secure.wellsfargo.com/auth/login/present?origin=cob).
The sign-in entry returned HTTP 200 and declared:

| Exact host | Public evidence |
| --- | --- |
| `www10.wellsfargomedia.com` | Explicit preconnect and DNS-prefetch declarations. This establishes a declared media host, not proof that a particular account page needs it. |
| `www15.wellsfargomedia.com` | Preconnect/DNS-prefetch plus font preload/prefetch references under `/wfui/css/fonts/`. The public CSS also references these fonts. |
| `www17.wellsfargomedia.com` | Font preload references under `/assets/fonts/`, font references in the public CSS, and image links on the public online-banking page. |

The sign-in page's public, same-origin `wfui` and `main` stylesheets were fetched
successfully and their font dependencies checked. Asset filenames are versioned;
do not hard-code those build hashes. `static.wellsfargo.com` was already covered
by the existing bank-domain policy. No other media hosts were added by guessing.

## Narrow permission, including redirects

The three exact media hosts may receive only HTTPS **GET** requests classified by
Chrome as `stylesheet`, `font`, or `image`, with a matching static file extension:

- stylesheet: `.css`;
- font: `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`;
- image: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.ico`, `.avif`.

No query string, URL credentials, nonstandard port or trailing-dot hostname is
allowed for this exception. Media-domain wildcarding is prohibited. Arbitrary
subdomains, scripts, documents/navigation, fetch/XHR, workers, other resource types
(including speculative prefetch), POST/other methods and mismatched extensions
remain denied. Real font requests can load even if a speculative prefetch is denied.

Redirect checks receive the resource type and **source** method, not just the
destination. A 303 must not convert a POST into eligibility for this exception.
An image/style redirect cannot escape the approved destinations. Bodies, cookie
values, credentials and authentication headers are not inspected or logged.

All existing controls remain: manual login/MFA, fresh disposable profile, no Chrome
sync, no security bypass, guarded top-level tabs only, blocked unknown popups and
child frames, no WebSockets/service workers/downloads, encrypted structure-only
records, bounded session, proven browser exit before deletion, and no workbook
writes. These are page-traffic restrictions, not an OS firewall or a way to prevent
a user manually making a payment on an allowed banking site.

## Verification and next check

Version 0.5.1 passed all **209** core/browser tests with no failures or skips on
the work Windows machine. The baseline passed all 205 before edits. Cleanup check
reported no remaining disposable test files; financial workbook/builder files
were unchanged. The following tests use entirely fictional data.

Offline tests cover exact hosts, resource types/extensions, URL spoofing, forbidden
methods, queries, redirects and method conversion. The Chrome integration test
renders invented CSS (including a cross-host CSS import) and an invented SVG after
the actual policy permits them. Responses are supplied locally; no bank/media
network is contacted by regression tests. Script, fetch and navigation attempts
to the same invented media URLs must still be blocked.

The attended v0.5.1 retry still showed broken styling, but the user could open
checking activity and see transactions. The run saved zero outlines and verified
shutdown/deletion. This does not verify extraction or source completeness.

The user explicitly deprioritized bank appearance. Do not repeat styling-only
tests; proceed to read-only navigation, extraction and reconciliation. A missing
dependency matters only if it blocks authentication, required data, pagination or
reliable controls. Review any such dependency narrowly, never use an unrestricted
fallback. No bank screenshot, private URL or account information is needed in chat.
