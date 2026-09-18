import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { requireEvidence as check } from "./errors.mjs";

function within(parent, target) {
  const relative = path.relative(parent, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function defaultPrivateRoot() {
  check(process.platform === "win32" && typeof process.env.LOCALAPPDATA === "string",
    "PRIVATE_PATH_REQUIRED", "A Windows private local-data directory must be configured.");
  return path.join(process.env.LOCALAPPDATA, "BudgetCollector");
}

export async function assertPrivateDirectory(directory, { repositoryRoot, cloudRoots = [] } = {}) {
  check(typeof directory === "string" && path.isAbsolute(directory), "UNSAFE_STORAGE_PATH", "Private storage requires an absolute local directory.");
  const target = path.resolve(directory);
  check(target !== path.parse(target).root && target !== path.resolve(os.homedir()) && !/^[/\\]{2}/.test(directory),
    "UNSAFE_STORAGE_PATH", "Private storage must use a dedicated directory on a local drive.");
  check(typeof repositoryRoot === "string" && path.isAbsolute(repositoryRoot), "UNSAFE_STORAGE_PATH", "The repository boundary must be known before opening private storage.");
  const repo = path.resolve(repositoryRoot);
  check(!within(repo, target) && !within(target, repo), "UNSAFE_STORAGE_PATH", "Financial storage must be separate from the repository.");
  const knownCloudRoots = [...cloudRoots, process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial].filter(Boolean);
  check(!knownCloudRoots.some(root => within(path.resolve(root), target) || within(target, path.resolve(root))),
    "UNSAFE_STORAGE_PATH", "Private storage cannot be in a known cloud-synced location.");
  check(!target.split(path.sep).some(part => /^(onedrive(?: - .*)?|dropbox|google drive|googledrive|icloud ?drive|box)$/i.test(part)),
    "UNSAFE_STORAGE_PATH", "Private storage cannot be in a known cloud-synced location.");
  for (let ancestor = target; ; ancestor = path.dirname(ancestor)) {
    try {
      const info = await fs.lstat(ancestor);
      check(info.isDirectory() && !info.isSymbolicLink(), "UNSAFE_STORAGE_PATH", "Private storage must not follow symbolic links or directory junctions.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    try {
      await fs.lstat(path.join(ancestor, ".git"));
      check(false, "UNSAFE_STORAGE_PATH", "Private storage cannot be inside any Git working directory.");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (ancestor === path.dirname(ancestor)) break;
  }
  return target;
}

export async function assertRegularFile(filename, maxBytes) {
  const info = await fs.lstat(filename);
  check(info.isFile() && !info.isSymbolicLink() && info.size <= maxBytes,
    "UNSAFE_STORAGE_FILE", "A local data file is not a regular bounded file.");
  return info;
}
