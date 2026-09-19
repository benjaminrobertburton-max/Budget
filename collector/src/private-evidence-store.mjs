import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { CollectionError, requireEvidence as check } from "./errors.mjs";
import { assertPrivateDirectory, assertRegularFile } from "./private-paths.mjs";
import { windowsProtector, MAX_RECORD_BYTES } from "./protection.mjs";

const filePattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.enc$/;

// Live source text is accepted only here, immediately sealed with the current
// Windows user's DPAPI key, and never returned to ordinary status/CLI output.
// This is evidence plumbing only: it does not normalize transactions, certify
// coverage, decide any budget rule, or write a workbook.
export async function openPrivateEvidenceStore({ root, repositoryRoot, cloudRoots = [], protector = windowsProtector() }) {
  check(typeof protector?.sealMany === "function" && typeof protector?.openMany === "function",
    "PROTECTION_REQUIRED", "An authenticated local encryption provider is required.");
  const policy = { repositoryRoot, cloudRoots };
  root = await assertPrivateDirectory(root, policy);
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const evidence = path.join(root, "source-evidence");
  await assertPrivateDirectory(evidence, policy);
  await fs.mkdir(evidence, { recursive: true, mode: 0o700 });

  async function verify() {
    await assertPrivateDirectory(root, policy);
    await assertPrivateDirectory(evidence, policy);
  }

  return Object.freeze({
    async save({ source, capturedAt, payload }) {
      check(source === "wells" && typeof capturedAt === "string" && Number.isFinite(Date.parse(capturedAt))
        && payload && typeof payload === "object" && !Array.isArray(payload),
      "INVALID_EVIDENCE", "The private source evidence is incomplete.");
      const record = { version: 1, kind: "budget-collector-source-evidence", source, capturedAt, payload };
      const bytes = Buffer.from(JSON.stringify(record), "utf8");
      check(bytes.length <= MAX_RECORD_BYTES, "RECORD_TOO_LARGE", "The private source evidence exceeds its supported size.");
      const [ciphertext] = await protector.sealMany([record]);
      check(Buffer.isBuffer(ciphertext) && ciphertext.length <= MAX_RECORD_BYTES * 2,
        "PROTECTION_FAILED", "The private evidence could not be protected.");
      await verify();
      const id = randomUUID();
      const filename = path.join(evidence, `${id}.enc`);
      const handle = await fs.open(filename, "wx", 0o600);
      try { await handle.writeFile(ciphertext); await handle.sync(); }
      finally { await handle.close(); }
      return `local:evidence:${id}`;
    },
    async open(reference) {
      check(typeof reference === "string" && /^local:evidence:[a-f0-9-]{36}$/.test(reference),
        "INVALID_EVIDENCE", "The private evidence reference is invalid.");
      const id = reference.slice("local:evidence:".length);
      const filename = path.join(evidence, `${id}.enc`);
      await verify();
      await assertRegularFile(filename, MAX_RECORD_BYTES * 2);
      const [record] = await protector.openMany([await fs.readFile(filename)]);
      check(record?.version === 1 && record.kind === "budget-collector-source-evidence"
        && record.source === "wells" && typeof record.capturedAt === "string" && record.payload,
      "INVALID_EVIDENCE", "The private evidence record is invalid.");
      return structuredClone(record);
    },
  });
}
