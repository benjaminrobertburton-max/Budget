import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/cli.mjs", import.meta.url));
test("offline CLI completes without printing fictional balances or merchants", () => {
  const result = spawnSync(process.execPath, [cli, "demo"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /11 fictional accounts/);
  assert.match(result.stdout, /0 duplicate entries/);
  assert.doesNotMatch(result.stdout, /FICTIONAL PAYROLL|250000|230000/);
});
test("live and arbitrary input commands fail closed", () => {
  for (const args of [["live"], ["demo", "--input=private.json"],
    ["wells-pilot", "--url=https://unreviewed.example"], ["pilot-rehearsal", "--headless"], []]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Live account collection is not installed/);
  }
});
