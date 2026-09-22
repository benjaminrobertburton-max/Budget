import assert from "node:assert/strict";
import test from "node:test";
import { reconcileWeeklyWells } from "../src/weekly-refresh.mjs";

test("first home refresh defers Wells anchor matching to the transferred workbook", () => {
  const normalized = { issues: [], transactions: [{ state: "posted" }] };
  const result = reconcileWeeklyWells(normalized, null);
  assert.equal(result.handoffBaseline, true);
  assert.throws(() => reconcileWeeklyWells({ issues: ["pagination_anchor_required"] }, null),
    { code: "WELLS_RECONCILIATION_BLOCKED" });
});
