import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("fictional Wells fixture preserves the observed transaction-table contract", async () => {
  const fixture = await readFile(fileURLToPath(new URL("../fixtures/wells-transaction-page.html", import.meta.url)), "utf8");
  for (const id of ["transaction-table", "DATE", "DESCRIPTION", "DEPOSITS_OR_CREDITS", "WITHDRAWALS_OR_DEBITS", "ENDING_DAILY_BALANCE"]) {
    assert.match(fixture, new RegExp(`data-testid=\\"(?:transaction-heading-)?${id}\\"`));
  }
  assert.match(fixture, /Pending Transactions/);
  assert.match(fixture, /Posted Transactions/);
});
