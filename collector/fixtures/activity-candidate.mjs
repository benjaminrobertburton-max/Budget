// Entirely invented; never replace this fixture with bank page contents.
export const fictionalActivityCandidate = () => ({ version: 1, kind: "activity_candidate",
  coverageVerified: false, workbookReady: false, finding: "candidate_read", hasFrames: false,
  layout: { tableCount: 1, rowCount: 2, headerCount: 4, hasShadowRoots: false,
    tables: [{ kind: "html_table", rows: 2, headerRows: 1, reason: "candidate_read", columns: ["date", "description", "amount", "status"] }] },
  tables: [{ columns: ["date", "description", "amount", "status"], headers: ["Date", "Description", "Amount", "Status"],
    rows: [["2031-04-08", "FICTIONAL SHOP", "-$7.43", "Pending"]], issues: [] }] });
