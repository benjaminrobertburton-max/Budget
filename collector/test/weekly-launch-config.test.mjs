import assert from "node:assert/strict";
import test from "node:test";
import { normalizeWeeklyLaunchConfig } from "../src/weekly-refresh.mjs";

test("weekly launch config accepts only one private workbook configuration path", () => {
  assert.deepEqual(normalizeWeeklyLaunchConfig({ workbookConfig: "C:\\BudgetCollector\\config.json" }),
    { workbookConfig: "C:\\BudgetCollector\\config.json" });
  for (const value of [{}, { workbookConfig: "relative.json" }, { workbookConfig: "C:\\x.json", extra: true }, null])
    assert.throws(() => normalizeWeeklyLaunchConfig(value), { code: "INVALID_LAUNCH_CONFIG" });
});
