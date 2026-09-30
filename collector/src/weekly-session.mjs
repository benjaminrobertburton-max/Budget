import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { CollectionError, requireEvidence as check } from "./errors.mjs";
import {randomUUID} from 'node:crypto';

const filename = root => path.join(root, "weekly-refresh-session.json");
const fingerprint = configFile => createHash("sha256").update(configFile).digest("hex");

function valid(value, sources, configFile) {
  return value && typeof value === "object" && !Array.isArray(value)
    && ((value.version === 1 && Object.keys(value).sort().join(",") === "completed,configFingerprint,version")
      || ([2,3].includes(value.version) && Object.keys(value).sort().join(',') === (value.version===3?'captured,completed,configFingerprint,references,version':'completed,configFingerprint,references,version')
        && value.references && Object.keys(value.references).length === value.completed?.length
        && value.completed.every(s => /^local:evidence:[a-f0-9-]{36}$/.test(value.references[s]??''))))
    && (value.version!==3 || value.captured&&Object.keys(value.captured).every(s=>sources.includes(s)&&/^local:evidence:[a-f0-9-]{36}$/.test(value.captured[s]))
      &&value.completed.every(s=>value.captured[s]===value.references[s]))
    && value.configFingerprint === fingerprint(configFile)
    && Array.isArray(value.completed) && value.completed.length <= sources.length
    && new Set(value.completed).size===value.completed.length
    && value.completed.every((source, index) => value.version===3?sources.includes(source)&&(index===0||sources.indexOf(value.completed[index-1])<sources.indexOf(source)):source === sources[index]);
}

// This local checkpoint deliberately excludes account identifiers, browser
// state, transaction data and workbook paths. Version 2 pins opaque local
// encrypted-evidence references so retry cannot substitute a newer test capture.
// It prevents completed sources from being needlessly recollected after interruption.
export async function readWeeklySession({ privateRoot, configFile, sources, details = false }) {
  const file = filename(privateRoot);
  try {
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    check(valid(value, sources, configFile), "WEEKLY_SESSION_INVALID", "The local weekly resume checkpoint is invalid.");
    return details ? {completed:[...value.completed],references:value.references??null,captured:value.captured??value.references??{}} : [...value.completed];
  } catch (error) {
    if (error?.code === "ENOENT") return details ? {completed:[],references:{},captured:{}} : [];
    if (error instanceof CollectionError) throw error;
    throw new CollectionError("WEEKLY_SESSION_INVALID", "The local weekly resume checkpoint is invalid.");
  }
}

export async function saveWeeklySession({ privateRoot, configFile, sources, completed, references, captured }) {
  const value = { version: captured ? 3 : references ? 2 : 1, configFingerprint: fingerprint(configFile), completed: [...completed], ...(references?{references}:{}),...(captured?{captured}:{}) };
  check(valid(value, sources, configFile), "WEEKLY_SESSION_INVALID", "The local weekly resume checkpoint is invalid.");
  const file = filename(privateRoot);
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value), { encoding: "utf8", flag: "wx", mode: 0o600 });
    // Windows virus scanners can briefly hold a just-written checkpoint. Retry
    // only the atomic rename, never remove/overwrite the accepted checkpoint.
    for(let attempt=0;;attempt++){
      try{await fs.rename(temporary,file);break;}
      catch(e){if(attempt>=3||!['EPERM','EACCES','EBUSY'].includes(e.code))throw e;
        await new Promise(r=>setTimeout(r,25*(attempt+1)));}
    }
  } catch {
    await fs.unlink(temporary).catch(() => {});
    throw new CollectionError("WEEKLY_SESSION_SAVE_FAILED", "The local weekly resume checkpoint could not be saved.");
  }
}

export async function clearWeeklySession({ privateRoot }) {
  try { await fs.unlink(filename(privateRoot)); }
  catch (error) {
    if (error?.code !== "ENOENT") throw new CollectionError("WEEKLY_SESSION_CLEAR_FAILED", "The local weekly resume checkpoint could not be cleared.");
  }
}
