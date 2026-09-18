import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { openLocalStore } from "../src/local-store.mjs";

export const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

// Test-only encryption makes filesystem fault tests independent of Windows.
// No key is persisted, and this provider is never selected by production code.
export function fixtureProtector() {
  const key = randomBytes(32);
  return {
    id: "fixture-only-ephemeral-encryption",
    async sealMany(values) {
      return values.map(value => {
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", key, iv);
        const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
        return Buffer.concat([iv, cipher.getAuthTag(), body]);
      });
    },
    async openMany(blobs) {
      return blobs.map(blob => {
        const decipher = createDecipheriv("aes-256-gcm", key, blob.subarray(0, 12));
        decipher.setAuthTag(blob.subarray(12, 28));
        return JSON.parse(Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]).toString("utf8"));
      });
    },
  };
}

export async function tempDirectory(t) {
  const temporaryParent = await fs.realpath(os.tmpdir());
  const root = await fs.mkdtemp(path.join(temporaryParent, "budget-collector-store-test-"));
  t.after(async () => {
    const resolved = await fs.realpath(root);
    const info = await fs.lstat(root);
    // Recursive cleanup is restricted to this exact owned temporary directory.
    if (info.isSymbolicLink() || path.dirname(resolved) !== temporaryParent
      || !path.basename(resolved).startsWith("budget-collector-store-test-")) {
      throw new Error("Refusing unsafe fixture cleanup.");
    }
    await fs.rm(resolved, { recursive: true, force: false });
  });
  return root;
}

export async function testStore(t, options = {}) {
  const root = await tempDirectory(t);
  const protector = options.protector ?? fixtureProtector();
  const store = await openLocalStore({ root, repositoryRoot, protector, ...options });
  return { root, protector, store };
}
