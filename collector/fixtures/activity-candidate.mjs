// Entirely invented; never replace this fixture with bank page contents.
export const fictionalActivityCandidate = () => ({ version: 1, kind: "activity_candidate",
  coverageVerified: false, workbookReady: false, finding: "candidate_read", hasFrames: false,
  source: { accountSuffix: "1234", balances: [{ type: "available", text: "$125.00" }, { type: "ledger", text: "$125.00" }], nextPage: "next_disabled", pageToken: "f1c7a321" },
  layout: { tableCount: 1, rowCount: 2, headerCount: 4, hasShadowRoots: false,
    tables: [{ kind: "html_table", rows: 2, headerRows: 1, reason: "candidate_read", columns: ["date", "description", "amount", "status"] }] },
  tables: [{ columns: ["date", "description", "amount", "status"], headers: ["Date", "Description", "Amount", "Status"],
    rows: [["2031-04-08", "FICTIONAL SHOP", "-$7.43", "Pending"]], issues: [] }] });
