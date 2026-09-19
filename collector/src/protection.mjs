import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CollectionError, requireEvidence as check } from "./errors.mjs";

const helper = fileURLToPath(new URL("../windows/Protect-LocalData.ps1", import.meta.url));
const MAX_BATCH_BYTES = 32 * 1024 * 1024;
export const MAX_RECORD_BYTES = 8 * 1024 * 1024;
const base64 = value => typeof value === "string" && value.length > 0
  && /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, "base64").toString("base64") === value;

function protectionError() {
  return new CollectionError("PROTECTION_FAILED", "Windows could not protect or open local data for this user. No plaintext fallback is allowed.");
}

function scriptCommand(scriptPath, operation) {
  // Some locked-down home Windows profiles permit PowerShell commands but block
  // .ps1 files via execution policy. Run the checked-in helper as a script block
  // without changing that policy or passing any private payload on the command
  // line; the JSON request remains on stdin.
  const literalPath = scriptPath.replaceAll("'", "''");
  return "$ErrorActionPreference='Stop'; $collectorScript=[IO.File]::ReadAllText('"
    + literalPath + "'); & ([scriptblock]::Create($collectorScript)) -Operation '"
    + operation + "'";
}

async function callWindows(operation, items) {
  check(process.platform === "win32", "WINDOWS_REQUIRED", "User-bound local encryption requires Windows.");
  const executable = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const input = JSON.stringify({ version: 1, items });
  check(Buffer.byteLength(input) <= MAX_BATCH_BYTES, "RECORD_TOO_LARGE", "The local encryption batch exceeds its supported size.");
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", scriptCommand(helper, operation)], {
      windowsHide: true, stdio: ["pipe", "pipe", "pipe"], shell: false,
    });
    const chunks = [];
    let outputBytes = 0;
    let failed = false;
    const fail = () => {
      if (failed) return;
      failed = true;
      clearTimeout(timer);
      child.kill();
      reject(protectionError());
    };
    const timer = setTimeout(fail, 30000);
    child.on("error", fail);
    child.stdin.on("error", fail);
    child.stdout.on("data", chunk => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_BATCH_BYTES) fail();
      else chunks.push(chunk);
    });
    child.stderr.resume(); // Discard private errors; never forward helper diagnostics.
    child.on("close", code => {
      clearTimeout(timer);
      if (failed) return;
      if (code !== 0) return fail();
      try {
        const response = JSON.parse(Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, ""));
        if (response.version !== 1 || !Array.isArray(response.items)
          || response.items.length !== items.length || !response.items.every(base64)) return fail();
        resolve(response.items);
      } catch {
        fail();
      }
    });
    child.stdin.end(input);
  });
}

export function windowsProtector() {
  return {
    id: "windows-dpapi-current-user-v1",
    async sealMany(values) {
      let encoded;
      try {
        encoded = values.map(value => {
          const bytes = Buffer.from(JSON.stringify(value), "utf8");
          check(bytes.length <= MAX_RECORD_BYTES, "RECORD_TOO_LARGE", "A local record exceeds its supported size.");
          return bytes.toString("base64");
        });
      } catch (error) {
        if (error instanceof CollectionError) throw error;
        throw new CollectionError("INVALID_LOCAL_RECORD", "The local record cannot be serialized safely.");
      }
      const ciphertext = await callWindows("Protect", encoded);
      return ciphertext.map(payload => Buffer.from(JSON.stringify({ version: 1, protection: this.id, payload }), "utf8"));
    },
    async openMany(blobs) {
      let encoded;
      try {
        encoded = blobs.map(blob => {
          if (!Buffer.isBuffer(blob) || blob.length > MAX_RECORD_BYTES * 2) throw protectionError();
          const envelope = JSON.parse(blob.toString("utf8"));
          if (envelope.version !== 1 || envelope.protection !== this.id || !base64(envelope.payload)
            || Object.keys(envelope).length !== 3) throw protectionError();
          return envelope.payload;
        });
        const plaintext = await callWindows("Unprotect", encoded);
        return plaintext.map(item => JSON.parse(Buffer.from(item, "base64").toString("utf8")));
      } catch {
        throw protectionError();
      }
    },
  };
}
