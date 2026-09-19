import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
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

test("Chrome bridge CLI starts on loopback without opening a browser", async () => {
  const child = spawn(process.execPath, [cli, "chrome-bridge"], { stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  let errors = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { errors += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Chrome bridge CLI did not start.")), 5000);
    child.on("error", reject);
    child.stdout.on("data", () => {
      if (output.includes("Local Chrome bridge is listening only on 127.0.0.1:43811.")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  const stopped = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Chrome bridge CLI did not stop.")), 5000);
    child.on("exit", (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
  child.kill("SIGINT");
  const result = await stopped;
  // On Windows, child.kill("SIGINT") terminates the process rather than
  // emulating the console Ctrl+C event an interactive user sends. Either outcome
  // proves this test did not leave a bridge process running.
  assert.ok(result.code === 0 || result.signal === "SIGINT");
  assert.equal(errors, "");
  assert.match(output, /reports no financial data/);
  assert.doesNotMatch(output, /Wells sign-on|balance|transaction/i);
});
