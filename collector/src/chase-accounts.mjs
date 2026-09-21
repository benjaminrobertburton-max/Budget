// Explicit local aliases prevent a Chase product name from being confused with
// the legacy workbook account label. This registry contains no account numbers,
// balances, credentials, or transaction data.
export const CHASE_CARD_TARGETS = Object.freeze([
  Object.freeze({ key: "prime_visa", sourceLabel: "Prime Visa", workbookAccount: "Prime Visa" }),
  Object.freeze({ key: "sapphire_preferred", sourceLabel: "Sapphire Preferred", workbookAccount: "Chase" }),
]);

export function chaseCardTarget(key) {
  const target = CHASE_CARD_TARGETS.find(entry => entry.key === key);
  if (!target) throw new Error("CHASE_CARD_TARGET_UNKNOWN");
  return target;
}

// One authenticated Chase session must collect each card separately. Returning
// to Overview is a required navigation gate, not an optional convenience and
// never a reason to treat the prior card's rows as the next card's evidence.
export const CHASE_COLLECTION_SEQUENCE = Object.freeze([
  "overview", "prime_visa", "capture_prime_visa", "overview",
  "sapphire_preferred", "capture_sapphire_preferred", "validate_pair",
]);
