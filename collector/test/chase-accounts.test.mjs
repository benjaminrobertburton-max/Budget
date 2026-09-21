import test from "node:test";
import assert from "node:assert/strict";
import { CHASE_CARD_TARGETS, CHASE_COLLECTION_SEQUENCE, chaseCardTarget } from "../src/chase-accounts.mjs";

test("Chase product labels map to their fixed legacy workbook accounts", () => {
  assert.deepEqual(CHASE_CARD_TARGETS, [
    { key: "prime_visa", sourceLabel: "Prime Visa", workbookAccount: "Prime Visa" },
    { key: "sapphire_preferred", sourceLabel: "Sapphire Preferred", workbookAccount: "Chase" },
  ]);
  assert.equal(chaseCardTarget("sapphire_preferred").workbookAccount, "Chase");
  assert.throws(() => chaseCardTarget("chase"), /CHASE_CARD_TARGET_UNKNOWN/);
});

test("Chase collection returns to Overview between separately captured cards", () => {
  assert.deepEqual(CHASE_COLLECTION_SEQUENCE, [
    "overview", "prime_visa", "capture_prime_visa", "overview",
    "sapphire_preferred", "capture_sapphire_preferred", "validate_pair",
  ]);
});
