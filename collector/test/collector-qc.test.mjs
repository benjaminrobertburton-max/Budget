import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runCollectorQc } from "../src/collector-qc.mjs";

test("collector QC gate passes for the current researched bridge", async () => {
  const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
  const report = await runCollectorQc({ repositoryRoot });
  assert.equal(report.ok, true, report.results.map((result) => `${result.id}: ${result.detail}`).join("\n"));
});
