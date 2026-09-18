import test from "node:test";
import assert from "node:assert/strict";
import { parseMoney, sumMinor } from "../src/money.mjs";

for (const [source, currency, expected] of [
  ["$1,234.56", "USD", 123456], ["-$7.43", "USD", -743], ["$-7.43", "USD", -743],
  ["(CA$12.50)", "CAD", -1250], ["+USD 3.2", "USD", 320], ["\u2212$0.01", "USD", -1],
  ["0.00", "USD", 0], [" $98 ", "USD", 9800], ["CAD -7.43", "CAD", -743],
]) {
  test(`exact signed money: ${source}`, () => assert.equal(parseMoney(source, currency), expected));
}

for (const value of ["", "Pending", "1,23", "12.345", "($-1.00)", "--1.00", "1e3", "1 234,50", "USD CAD 1", 12.34, null, "9007199254740991.00"]) {
  test(`reject ambiguous money: ${JSON.stringify(value)}`, () => assert.throws(() => parseMoney(value, "USD")));
}
test("currency cannot silently change", () => assert.throws(() => parseMoney("CA$7.43", "USD"), { code: "INVALID_CURRENCY" }));
test("money totals remain exact", () => assert.equal(sumMinor([10, 20, -7]), 23));
test("fractional minor units are rejected", () => assert.throws(() => sumMinor([1.5]), { code: "INVALID_MONEY" }));
test("overflow is rejected", () => assert.throws(() => sumMinor([Number.MAX_SAFE_INTEGER, 1]), { code: "INVALID_MONEY" }));
