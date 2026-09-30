import assert from "node:assert/strict";
import test from "node:test";
import { reconcileWeeklyWells, terminalCaptureProgressCode } from "../src/weekly-refresh.mjs";

test("first home refresh defers Wells anchor matching to the transferred workbook", () => {
  const normalized = { issues: [], transactions: [{ state: "posted" }] };
  const result = reconcileWeeklyWells(normalized, null);
  assert.equal(result.handoffBaseline, true);
  assert.throws(() => reconcileWeeklyWells({ issues: ["pagination_anchor_required"] }, null),
    { code: "WELLS_RECONCILIATION_BLOCKED" });
});

test("only fixed Wells and Chase activity-reader outcomes terminate a weekly source", () => {
  assert.equal(terminalCaptureProgressCode("wells", "activity_capture_no_table"), "WELLS_ACTIVITY_TABLE_MISSING");
  assert.equal(terminalCaptureProgressCode("chase_prime", "activity_capture_page_limit"), "CHASE_PRIME_ACTIVITY_PAGE_LIMIT");
  assert.equal(terminalCaptureProgressCode("wells", "activity_capture_rejected"), "WELLS_CAPTURE_REJECTED");
  assert.equal(terminalCaptureProgressCode("chase_sapphire", "authenticated_page"), null);
  assert.equal(terminalCaptureProgressCode("citi", "activity_capture_no_table"), null);
});
