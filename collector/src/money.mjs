import { requireEvidence } from "./errors.mjs";

export function assertMinorUnits(value) {
  requireEvidence(Number.isSafeInteger(value), "INVALID_MONEY", "Money must be an exact, safe integer in minor units.");
  return value;
}

export function sumMinor(values) {
  const sum = values.reduce((total, value) => total + BigInt(assertMinorUnits(value)), 0n);
  requireEvidence(sum <= BigInt(Number.MAX_SAFE_INTEGER) && sum >= BigInt(Number.MIN_SAFE_INTEGER),
    "INVALID_MONEY", "The money total exceeds the supported exact range.");
  return Number(sum);
}

// Currency and the source's sign convention must be known by the adapter.
// This parser never decides whether an unsigned source amount is a purchase or credit.
export function parseMoney(text, currency) {
  requireEvidence(["USD", "CAD"].includes(currency), "INVALID_CURRENCY", "An explicit supported currency is required.");
  requireEvidence(typeof text === "string", "INVALID_MONEY", "Money must be supplied as source text.");
  let value = text.trim().replaceAll("\u2212", "-");
  let negative = false;
  let signed = false;
  if (value.startsWith("(") && value.endsWith(")")) {
    negative = true;
    signed = true;
    value = value.slice(1, -1).trim();
  }
  const takeSign = () => {
    if (/^[+-]/.test(value)) {
      requireEvidence(!signed, "INVALID_MONEY", "Money contains conflicting signs.");
      negative = value[0] === "-";
      signed = true;
      value = value.slice(1).trim();
    }
  };
  takeSign();
  const prefix = value.match(/^(USD|CAD|US\$|CA\$|\$)\s*/)?.[1];
  if (prefix) {
    requireEvidence(prefix === "$" || (currency === "USD" ? ["USD", "US$"] : ["CAD", "CA$"]).includes(prefix),
      "INVALID_CURRENCY", "Source currency does not match the registered account.");
    value = value.slice(prefix.length).trim();
  }
  takeSign();
  requireEvidence(/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value),
    "INVALID_MONEY", "Money is missing, ambiguous, or uses an unsupported number format.");
  const [whole, fraction = ""] = value.replaceAll(",", "").split(".");
  let minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (negative) minor = -minor;
  requireEvidence(minor <= BigInt(Number.MAX_SAFE_INTEGER) && minor >= BigInt(Number.MIN_SAFE_INTEGER),
    "INVALID_MONEY", "Money exceeds the supported exact range.");
  return Number(minor);
}
