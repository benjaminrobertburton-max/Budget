# Budget Collector bridge R&D record

## Decision

The bridge must remain local and read-only. It must not use a visible localhost
wake page, launch a second Chrome profile, copy browser state, read credentials,
or send raw banking data to the agent. The next live test is gated behind this
revision; this document is not a claim that a complete Wells import has passed.

## Failure inventory

| Failure | Evidence | Resolution or status |
| --- | --- | --- |
| Visible `127.0.0.1` trigger pages appeared repeatedly | Local refresh runs opened three helper tabs and the extension was not connected reliably | Removed external-message trigger pages and Chrome-launch handoff. MV3 alarm polling is now the only invisible wake path. |
| Existing Wells tab had no content-script receiver after extension reload | `tabs.sendMessage` failed on a pre-existing tab | The bridge probes and reloads the same Wells tab once; it never creates a duplicate tab. |
| Wells ignored a content-script `click()` on Everyday Checking | Authenticated summary reached `activity_capture_no_table`; a direct visible browser click reached checking activity | Trusted, rectangle-only click is now requested from the content script and performed by the extension with `chrome.debugger`; no URL, page text, or account data is returned. |
| Checking navigation regressed after reader hardening | The navigation selector only recognized `<a>` elements; Wells can render the product card as a button or ARIA link/button | Navigation now recognizes the bounded set of ordinary and ARIA clickable card elements in both the page script and trusted-click expression. |
| Direct `location.assign()` was not reliable on the Wells SPA | The same run still ended at `no_activity_table` | Retired as the navigation mechanism. |
| Reader was limited to literal HTML `table/tr/th/td` markup | Wells can render accessible table/grid semantics and spacing varies in headings | Reader now accepts HTML tables and ARIA table/grid rows/cells and normalizes header whitespace around `/`. |
| Authenticated run still reported no table after navigation/readiness wait | The reader searched only the top document; Wells account shells can place accessible grids inside open web-component roots or same-origin frames | Reader now performs a bounded semantic search across the document, open shadow roots, and accessible same-origin frames. Cross-origin frames remain untouched. |
| Ten-second render bound could report a false missing table | Authenticated Wells shell can appear before activity rows | Bound increased to 30 seconds; a missing table remains an exception, never zero activity. |
| Saved-credential/autofill approval-only path | Not yet proven through the supported extension | Remains an explicit acceptance gate. The extension never extracts or submits credentials. |
| Complete source coverage and workbook import | Not implemented by the bridge | Remains blocked until Wells identity, balance meanings, pending/posted coverage, date range, pagination and overlap checks pass. |

## External research applied

- [Wells Fargo Account Activity FAQs](https://www.wellsfargo.com/help/online-banking/activity-faqs/)
  confirms that Wells distinguishes pending and posted activity, that pending
  amounts can change before posting, and that account activity can be downloaded
  as comma-delimited/spreadsheet data for a selected date range. The future
  source adapter should prefer that structured export when it can be reached
  safely, rather than OCR or screenshots.
- [Chrome MV3 service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
  documents the 30-second minimum alarm period on current Chrome. This explains
  the invisible wake bound when no Wells tab is open.
- [Chrome `chrome.debugger` API](https://developer.chrome.com/docs/extensions/reference/api/debugger)
  documents tab-scoped CDP attachment and the required explicit `debugger`
  permission. The bridge uses only a short-lived, tab-scoped input click and
  detaches immediately; it does not enable a remote debugging endpoint.

## Acceptance gates for the next run

1. Extension reload shows version 0.3.3 and the new debugger permission.
2. `wells-refresh` produces no localhost/helper tabs.
3. Wells reaches the checking activity view without manual account navigation.
4. A candidate contains the activity headers and bounded rows; no raw values are
   printed in normal bridge status.
5. The run is still only a private candidate. No workbook update occurs until
   independent balance, pending/posted, date-window and overlap validation passes.
