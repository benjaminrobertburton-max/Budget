import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { CollectionError, requireEvidence as check } from "./errors.mjs";
import { assertPrivateDirectory, assertRegularFile } from "./private-paths.mjs";
import { windowsProtector, MAX_RECORD_BYTES } from "./protection.mjs";

const MAX_BLOB_BYTES = MAX_RECORD_BYTES * 2;
const filenamePattern = /^(\d{12})-([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.enc$/;
const partialPattern = /^\d{12}-[a-f0-9-]{36}\.enc\.[a-f0-9-]{36}\.partial$/;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const failure = () => new CollectionError("LOCAL_STORAGE_ERROR", "The local save could not complete. Previous committed records remain available; inspect local storage before retrying.");

function assertCandidate(payload) {
  check(payload?.registry?.mode === "synthetic" && payload?.candidate?.mode === "synthetic"
    && payload.registry.schemaVersion === 1 && payload.candidate.schemaVersion === 1
    && payload.candidate.workbookReady === false && Array.isArray(payload.candidate.captures)
    && payload.candidate.nextState?.mode === "synthetic",
  "INVALID_LOCAL_RECORD", "This milestone can store only synthetic collection candidates, never a live or workbook-ready snapshot.");
}

export async function openLocalStore({ root, repositoryRoot, cloudRoots = [], protector = windowsProtector(), onCheckpoint = async () => {} }) {
  const policy = { repositoryRoot, cloudRoots };
  root = await assertPrivateDirectory(root, policy);
  check(typeof protector?.sealMany === "function" && typeof protector?.openMany === "function",
    "PROTECTION_REQUIRED", "An authenticated local encryption provider is required.");
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const runsDir = path.join(root, "runs");
  const commitsDir = path.join(root, "commits");
  const lockFile = path.join(root, "refresh.lock");
  for (const directory of [runsDir, commitsDir]) {
    await assertPrivateDirectory(directory, policy);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  }

  async function verifyPaths() {
    for (const directory of [root, runsDir, commitsDir]) await assertPrivateDirectory(directory, policy);
  }

  async function readBlob(directory, filename) {
    check(filenamePattern.test(filename), "INVALID_LOCAL_RECORD", "An encrypted record has an invalid filename.");
    const filenamePath = path.join(directory, filename);
    await assertRegularFile(filenamePath, MAX_BLOB_BYTES);
    return fs.readFile(filenamePath);
  }

  // Only encrypted bytes reach this writer. A flushed file becomes visible under
  // its final name without overwriting an existing record. Partial files are ignored.
  async function writeImmutable(directory, filename, bytes) {
    check(Buffer.isBuffer(bytes) && bytes.length <= MAX_BLOB_BYTES, "INVALID_LOCAL_RECORD", "The encryption provider returned an invalid record.");
    const destination = path.join(directory, filename);
    const temporary = `${destination}.${randomUUID()}.partial`;
    const handle = await fs.open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.link(temporary, destination);
    // A failed cleanup must not report a committed save as failed. This contains
    // ciphertext only and can be identified by its generated .partial name.
    await fs.unlink(temporary).catch(() => {});
  }

  async function loadLatest() {
    await verifyPaths();
    const entries = await fs.readdir(commitsDir);
    check(entries.every(name => filenamePattern.test(name) || partialPattern.test(name)),
      "CORRUPT_LOCAL_HISTORY", "The local commit directory contains an unexpected entry.");
    const files = entries.filter(name => filenamePattern.test(name)).sort();
    if (!files.length) return null;
    // Batch DPAPI operations avoid launching one helper per historical commit.
    const blobs = await Promise.all(files.map(file => readBlob(commitsDir, file)));
    const manifests = await protector.openMany(blobs);
    check(manifests.length === files.length, "CORRUPT_LOCAL_HISTORY", "The encrypted commit history is incomplete.");
    let previousHash = null;
    for (let index = 0; index < files.length; index += 1) {
      const manifest = manifests[index];
      const [, digits, id] = files[index].match(filenamePattern);
      check(manifest?.version === 1 && manifest.kind === "budget-collector-candidate-commit"
        && manifest.sequence === index + 1 && Number(digits) === manifest.sequence
        && manifest.runId === id && manifest.runFile === files[index]
        && manifest.previousHash === previousHash && /^[a-f0-9]{64}$/.test(manifest.runHash),
      "CORRUPT_LOCAL_HISTORY", "Local commit history is inconsistent. An older snapshot will not be silently substituted.");
      previousHash = digest(blobs[index]);
    }
    const manifest = manifests.at(-1);
    const runBlob = await readBlob(runsDir, manifest.runFile);
    check(digest(runBlob) === manifest.runHash, "CORRUPT_LOCAL_HISTORY", "The current encrypted snapshot does not match its committed checksum.");
    const [record] = await protector.openMany([runBlob]);
    check(record?.version === 1 && record.kind === "budget-collector-candidate"
      && record.sequence === manifest.sequence && record.runId === manifest.runId,
    "CORRUPT_LOCAL_HISTORY", "The encrypted snapshot does not match its commit.");
    assertCandidate(record.payload);
    return { sequence: manifest.sequence, runId: manifest.runId, commitHash: previousHash, payload: record.payload };
  }

  return {
    root,
    async readLatest() {
      try { return await loadLatest(); } catch (error) { throw error instanceof CollectionError ? error : failure(); }
    },
    async withLock(operation) {
      await verifyPaths();
      let handle;
      try {
        handle = await fs.open(lockFile, "wx", 0o600);
      } catch (error) {
        if (error.code === "EEXIST") throw new CollectionError("REFRESH_LOCKED", "Another refresh or an interrupted refresh owns the local lock. Do not run a second refresh until it is resolved.");
        throw failure();
      }
      const token = randomUUID();
      let active = true;
      let pendingWrites = Promise.resolve();
      try {
        await handle.writeFile(JSON.stringify({ version: 1, token, pid: process.pid }));
        await handle.sync();
        return await operation({
          async latest() {
            check(active, "LOCK_EXPIRED", "The local refresh lock has already been released.");
            await pendingWrites;
            check(active, "LOCK_EXPIRED", "The local refresh lock has already been released.");
            return loadLatest();
          },
          async appendCandidate(payload) {
            check(active, "LOCK_EXPIRED", "The local refresh lock has already been released.");
            assertCandidate(payload);
            const snapshot = structuredClone(payload);
            // A single lock owner can still accidentally request parallel writes.
            // Serialize them so two records cannot claim the same sequence.
            const job = pendingWrites.then(async () => {
              check(active, "LOCK_EXPIRED", "The local refresh lock has already been released.");
              const previous = await loadLatest();
              const sequence = (previous?.sequence ?? 0) + 1;
              check(sequence <= 999999999999, "LOCAL_HISTORY_FULL", "The local history sequence is exhausted.");
              const runId = randomUUID();
              const filename = `${String(sequence).padStart(12, "0")}-${runId}.enc`;
              const [runBytes] = await protector.sealMany([{ version: 1, kind: "budget-collector-candidate", sequence, runId, payload: snapshot }]);
              await writeImmutable(runsDir, filename, runBytes);
              await onCheckpoint("snapshot-written-before-commit");
              const manifest = { version: 1, kind: "budget-collector-candidate-commit", sequence, runId,
                runFile: filename, runHash: digest(runBytes), previousHash: previous?.commitHash ?? null };
              const [commitBytes] = await protector.sealMany([manifest]);
              await writeImmutable(commitsDir, filename, commitBytes);
              return { sequence, runId, workbookReady: false };
            });
            pendingWrites = job.catch(() => {});
            return job;
          },
        });
      } catch (error) {
        throw error instanceof CollectionError ? error : failure();
      } finally {
        active = false;
        await pendingWrites;
        await handle.close();
        // Remove only the exact lock created by this call; never remove a foreign lock.
        await assertRegularFile(lockFile, 4096);
        const current = JSON.parse(await fs.readFile(lockFile, "utf8"));
        check(current.token === token, "LOCK_CHANGED", "The local refresh lock changed unexpectedly and was left in place.");
        await fs.unlink(lockFile);
      }
    },
  };
}
