import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { CollectionError, requireEvidence as check } from "./errors.mjs";

const filename = root => path.join(root, "weekly-refresh-session.json");
const fingerprint = configFile => createHash("sha256").update(configFile).digest("hex");

function valid(value, sources, configFile) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === "completed,configFingerprint,version"
    && value.version === 1 && value.configFingerprint === fingerprint(configFile)
    && Array.isArray(value.completed) && value.completed.length < sources.length
    && value.completed.every((source, index) => source === sources[index]);
}

// This local checkpoint deliberately excludes account identifiers, browser
// state, evidence references, transaction data and workbook paths. It only
// prevents a safe, completed source from being needlessly recollected after an
// interrupted weekly coordinator.
export async function readWeeklySession({ privateRoot, configFile, sources }) {
  const file = filename(privateRoot);
  try {
    const value = JSON.parse(await fs.readFile(file, "utf8"));
    check(valid(value, sources, configFile), "WEEKLY_SESSION_INVALID", "The local weekly resume checkpoint is invalid.");
    return [...value.completed];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    if (error instanceof CollectionError) throw error;
    throw new CollectionError("WEEKLY_SESSION_INVALID", "The local weekly resume checkpoint is invalid.");
  }
}

export async function saveWeeklySession({ privateRoot, configFile, sources, completed }) {
  const value = { version: 1, configFingerprint: fingerprint(configFile), completed: [...completed] };
  check(valid(value, sources, configFile), "WEEKLY_SESSION_INVALID", "The local weekly resume checkpoint is invalid.");
  const file = filename(privateRoot);
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value), { encoding: "utf8", flag: "wx", mode: 0o600 });
    await fs.rename(temporary, file);
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
