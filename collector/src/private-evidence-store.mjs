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
      check(["wells", "chase", "citi"].includes(source) && typeof capturedAt === "string" && Number.isFinite(Date.parse(capturedAt))
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
        && ["wells", "chase", "citi"].includes(record.source) && typeof record.capturedAt === "string" && record.payload,
      "INVALID_EVIDENCE", "The private evidence record is invalid.");
      return structuredClone(record);
    },
    async latestPayload({ source, kind, identity = null }) {
      check(["wells", "chase"].includes(source) && typeof kind === "string" && /^[a-z_]+$/.test(kind),
      "INVALID_EVIDENCE", "The private evidence query is invalid.");
      check(identity === null || source === 'chase' && ['prime_visa','sapphire_preferred'].includes(identity.product)
        && /^\d{4}$/.test(identity.suffix), 'INVALID_EVIDENCE', 'The private account filter is invalid.');
      await verify();
      const names = (await fs.readdir(evidence)).filter(name => filePattern.test(name));
      // File names are random; inspect a bounded newest-first set locally and
      // fail closed on a damaged newest record rather than guessing an anchor.
      const candidates = await Promise.all(names.map(async name => ({ name, stat: await fs.stat(path.join(evidence, name)) })));
      candidates.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
      for (const { name } of candidates.slice(0, 32)) {
        const id = name.slice(0, -4);
        const record = await this.open(`local:evidence:${id}`);
        if (record.source === source && record.payload?.kind === kind
          && (identity === null || record.payload.identity?.product === identity.product
            && record.payload.identity?.suffix === identity.suffix)) return structuredClone(record.payload);
      }
      return null;
    },
    // Exact RAW capture selection for workbook intake. A normalized record is
    // never a substitute for evidence. Keep timestamp/reference with the payload
    // so the importer can enforce freshness and re-run source validation.
    async latestCapture({source,product=null,suffix}) {
      check(['wells','chase','citi'].includes(source)&&/^\d{4}$/.test(suffix??'')
        &&(source==='wells'?product===null:source==='citi'?product==='aadvantage':['prime_visa','sapphire_preferred'].includes(product)),
      'INVALID_EVIDENCE','The private capture binding is invalid.');
      await verify();
      const names=(await fs.readdir(evidence)).filter(name=>filePattern.test(name));
      const candidates=await Promise.all(names.map(async name=>{
        const stat=await assertRegularFile(path.join(evidence,name),MAX_RECORD_BYTES*2);
        return {name,time:stat.mtimeMs};
      }));
      candidates.sort((a,b)=>b.time-a.time||a.name.localeCompare(b.name));
      for(const {name} of candidates.slice(0,64)){
        const reference=`local:evidence:${name.slice(0,-4)}`;
        const record=await this.open(reference),c=record.payload;
        if(source==='citi'&&record.source==='citi'&&c?.kind==='citi_activity'
          &&c.identity===`Citi®/AAdvantage® Platinum Select® World Elite Mastercard® - ${suffix}`)return {reference,record};
        if(record.source===source&&c?.kind==='activity_candidate'
          &&c.source?.accountSuffix===suffix
          &&(source==='wells'?!c.source.chase:c.source.chase?.product===product))return {reference,record};
      }
      return null;
    },
  });
}
