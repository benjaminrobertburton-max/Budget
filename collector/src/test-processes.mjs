import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CollectionError, requireEvidence as check } from "./errors.mjs";

const helper = fileURLToPath(new URL("../windows/Get-TestProcesses.ps1", import.meta.url));
const stamp = value => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3,7}Z$/.test(value)
  && Number.isFinite(Date.parse(value));
const keys = (value, expected) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(",") === [...expected].sort().join(",");
const validPid = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const failure = () => new CollectionError("PROCESS_CHECK_FAILED", "Test process state is unavailable. No files were removed and no processes were stopped.");

export function validateProcessSnapshot(value, ownerPid) {
  check(validPid(ownerPid) && keys(value, ["version", "bootId", "observedAt", "processes"])
    && value.version === 1 && stamp(value.bootId) && stamp(value.observedAt)
    && Date.parse(value.observedAt) >= Date.parse(value.bootId)
    && Array.isArray(value.processes) && value.processes.length <= 10000,
  "PROCESS_CHECK_FAILED", "Test process state is unavailable.");
  const seen = new Set();
  for (const row of value.processes) {
    check(keys(row, ["pid", "parentPid", "kind", "createdAt"]) && validPid(row.pid)
      && Number.isSafeInteger(row.parentPid) && row.parentPid >= 0 && row.parentPid <= 2147483647
      && ["chrome", "owner"].includes(row.kind) && (row.kind !== "owner" || row.pid === ownerPid)
      && stamp(row.createdAt) && Date.parse(row.createdAt) >= Date.parse(value.bootId)
      && Date.parse(row.createdAt) <= Date.parse(value.observedAt) && !seen.has(row.pid),
    "PROCESS_CHECK_FAILED", "Test process state is unavailable.");
    seen.add(row.pid);
  }
  return value;
}

export function validateBrowserGuard(value, ownerId, ownerPid) {
  check(keys(value, ["version", "owner", "bootId", "startedAfter", "baselineChrome"])
    && value.version === 2 && value.owner === ownerId && stamp(value.startedAfter)
    && Array.isArray(value.baselineChrome) && value.baselineChrome.every(row => row.kind === "chrome"),
  "PROCESS_CHECK_FAILED", "Browser startup state could not be established.");
  validateProcessSnapshot({ version: 1, bootId: value.bootId,
    observedAt: value.startedAfter, processes: value.baselineChrome }, ownerPid);
  return value;
}

export async function windowsTestProcesses(ownerPid) {
  check(process.platform === "win32" && validPid(ownerPid), "WINDOWS_REQUIRED", "Disposable browser recovery currently requires Windows.");
  const executable = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", helper], {
      windowsHide: true, shell: false, stdio: ["pipe", "pipe", "pipe"],
    });
    const chunks = [];
    let bytes = 0;
    let failed = false;
    const fail = () => {
      if (failed) return;
      failed = true;
      clearTimeout(timer);
      child.kill(); // Only this helper, never Chrome or a PID obtained from a marker.
      reject(failure());
    };
    const timer = setTimeout(fail, 15000);
    child.on("error", fail);
    child.stdin.on("error", fail);
    child.stderr.resume();
    child.stdout.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > 2 * 1024 * 1024) fail();
      else chunks.push(chunk);
    });
    child.on("close", code => {
      clearTimeout(timer);
      if (failed) return;
      if (code !== 0) return fail();
      try {
        resolve(validateProcessSnapshot(JSON.parse(Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "")), ownerPid));
      } catch { fail(); }
    });
    child.stdin.end(JSON.stringify({ version: 1, ownerPid }));
  });
}
