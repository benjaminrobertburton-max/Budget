import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { requireEvidence as check } from "./errors.mjs";

const extensionId = /^[a-p]{32}$/;
const profileName = /^[A-Za-z0-9 ._-]{1,80}$/;

export async function readLocalRefreshConfig({ localAppData = process.env.LOCALAPPDATA } = {}) {
  check(typeof localAppData === "string" && path.isAbsolute(localAppData), "LOCAL_TRIGGER_UNAVAILABLE", "The local refresh route is unavailable.");
  try {
    const value = JSON.parse(await readFile(path.join(localAppData, "BudgetCollector", "bridge-launch.json"), "utf8"));
    if (!value || !extensionId.test(value.extensionId) || !profileName.test(value.profileDirectory)) return null;
    return { extensionId: value.extensionId, profileDirectory: value.profileDirectory };
  } catch { return null; }
}

export function launchLocalRefresh({ config, triggerUrl, executable = path.join(process.env.PROGRAMFILES ?? "", "Google", "Chrome", "Application", "chrome.exe"), spawnProcess = spawn }) {
  check(config && extensionId.test(config.extensionId) && profileName.test(config.profileDirectory), "LOCAL_TRIGGER_UNAVAILABLE", "The local refresh route is unavailable.");
  check(typeof triggerUrl === "string" && /^http:\/\/127\.0\.0\.1:\d+\/v1\/trigger$/.test(triggerUrl), "LOCAL_TRIGGER_UNAVAILABLE", "The local refresh route is unavailable.");
  // This opens only a local page; Chrome's supported external message closes it
  // immediately after the installed extension acknowledges the refresh.
  const child = spawnProcess(executable, [`--profile-directory=${config.profileDirectory}`, triggerUrl], {
    detached: true, stdio: "ignore", windowsHide: true,
  });
  child.unref();
}
