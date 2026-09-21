import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

test("Chase reader is a separate bounded discovery reader with no secret access", async () => {
  const reader = await readFile(fileURLToPath(new URL("../chrome-bridge/chase-page-state.js", import.meta.url)), "utf8");
  assert.match(reader, /capture_chase_activity/);
  assert.match(reader, /accepted: true/);
  assert.match(reader, /activityHeader/);
  assert.match(reader, /captureAttempts < 150/);
  assert.match(reader, /accountSuffix: null/);
  assert.doesNotMatch(reader, /document\.cookie|localStorage|sessionStorage|\.value/);
  assert.doesNotMatch(reader, /\.click\(|dispatchMouseEvent|chrome\.debugger/);
});

test("bridge restricts Chase navigation to the two configured read-only product labels", async () => {
  const worker = await readFile(fileURLToPath(new URL("../chrome-bridge/background.js", import.meta.url)), "utf8");
  assert.match(worker, /open_chase_sapphire/);
  assert.match(worker, /open_chase_prime/);
  assert.match(worker, /\["Sapphire Preferred", "Prime Visa"\]/);
  assert.doesNotMatch(worker, /transfer|pay bills|schedule payment/i);
});
