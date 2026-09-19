import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { requireEvidence as check } from "./errors.mjs";
import { assertPrivateDirectory, assertRegularFile, defaultPrivateRoot } from "./private-paths.mjs";

const name = "bridge-launch.json";
const valid = value => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(",") === "extensionId,profileDirectory,version"
  && value.version === 1 && /^[a-p]{32}$/.test(value.extensionId)
  && typeof value.profileDirectory === "string" && /^[^\\/:*?\"<>|]{1,80}$/.test(value.profileDirectory);

export async function readBridgeLaunchConfig({ root = defaultPrivateRoot(), repositoryRoot }) {
  root = await assertPrivateDirectory(root, { repositoryRoot });
  const filename = path.join(root, name);
  try { await assertRegularFile(filename, 1024); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
  const value = JSON.parse(await fs.readFile(filename, "utf8"));
  check(valid(value), "INVALID_LAUNCH_CONFIG", "The local Chrome bridge configuration is invalid.");
  return value;
}

export async function saveBridgeLaunchConfig({ extensionOrigin, profileDirectory = "Person 1", root = defaultPrivateRoot(), repositoryRoot }) {
  const origin = new URL(extensionOrigin);
  const value = { version: 1, extensionId: origin.hostname, profileDirectory };
  check(origin.protocol === "chrome-extension:" && valid(value), "INVALID_LAUNCH_CONFIG", "The local Chrome bridge configuration is invalid.");
  root = await assertPrivateDirectory(root, { repositoryRoot });
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const filename = path.join(root, name);
  await fs.writeFile(filename, JSON.stringify(value), { encoding: "utf8", mode: 0o600, flag: "w" });
  return structuredClone(value);
}

export async function wakeInstalledBridge({ config, port = 43811, executable = path.join(process.env.PROGRAMFILES ?? "", "Google", "Chrome", "Application", "chrome.exe"), spawnProcess = spawn }) {
  check(valid(config), "INVALID_LAUNCH_CONFIG", "The local Chrome bridge configuration is invalid.");
  check(Number.isInteger(port) && port > 0 && port <= 65535, "INVALID_LAUNCH_CONFIG", "The local Chrome bridge configuration is invalid.");
  await fs.access(executable);
  const child = spawnProcess(executable, [`--profile-directory=${config.profileDirectory}`,
    `http://127.0.0.1:${port}/v1/wake`], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref?.();
  return true;
}
