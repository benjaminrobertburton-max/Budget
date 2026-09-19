import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readBridgeLaunchConfig, saveBridgeLaunchConfig, wakeInstalledBridge } from "../src/chrome-launcher.mjs";

test("local Chrome wake configuration stores only extension routing metadata outside the repository", async t => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "collector-launch-"));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const repositoryRoot = path.join(parent, "repository");
  const root = path.join(parent, "private");
  await fs.mkdir(repositoryRoot);
  assert.equal(await readBridgeLaunchConfig({ root, repositoryRoot }), null);
  const saved = await saveBridgeLaunchConfig({ root, repositoryRoot,
    extensionOrigin: "chrome-extension://abcdefghijklmnopabcdefghijklmnop", profileDirectory: "Person 1" });
  assert.deepEqual(saved, { version: 1, extensionId: "abcdefghijklmnopabcdefghijklmnop", profileDirectory: "Person 1" });
  assert.deepEqual(await readBridgeLaunchConfig({ root, repositoryRoot }), saved);
  assert.doesNotMatch(await fs.readFile(path.join(root, "bridge-launch.json"), "utf8"), /password|cookie|balance|transaction/i);
});

test("wake starts only the configured Chrome profile and local extension page", async t => {
  const executable = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "collector-chrome-")), "chrome.exe");
  t.after(() => fs.rm(path.dirname(executable), { recursive: true, force: true }));
  await fs.writeFile(executable, "fictional");
  const calls = [];
  const result = await wakeInstalledBridge({ executable,
    config: { version: 1, extensionId: "abcdefghijklmnopabcdefghijklmnop", profileDirectory: "Person 1" },
    spawnProcess: (...args) => { calls.push(args); return { unref() {} }; } });
  assert.equal(result, true);
  assert.deepEqual(calls[0][1], ["--profile-directory=Person 1", "http://127.0.0.1:43811/v1/wake"]);
  assert.equal(calls[0][2].windowsHide, true);
});
