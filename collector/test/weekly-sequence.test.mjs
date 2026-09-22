import assert from "node:assert/strict";
import test from "node:test";
import { createWeeklySequence, WEEKLY_SOURCES } from "../src/weekly-sequence.mjs";

test("weekly sequence never permits a partial workbook import", () => {
  const sequence = createWeeklySequence(["wells", "chase"]);
  assert.equal(sequence.current(), "wells");
  assert.throws(() => sequence.beginImport(), { code: "SEQUENCE_INCOMPLETE" });
  assert.equal(sequence.complete("wells"), "chase");
  assert.equal(sequence.complete("chase"), null);
  assert.equal(sequence.status().state, "ready_to_import");
  sequence.beginImport(); sequence.imported();
  assert.deepEqual(sequence.status(), { state: "complete", current: null, completed: ["wells", "chase"] });
});

test("weekly sequence rejects out-of-order capture and stays fail-closed", () => {
  const sequence = createWeeklySequence(WEEKLY_SOURCES);
  assert.throws(() => sequence.complete("citi"), { code: "SEQUENCE_ORDER" });
  sequence.block("wells");
  assert.equal(sequence.status().state, "blocked");
  assert.throws(() => sequence.beginImport(), { code: "SEQUENCE_INCOMPLETE" });
});
