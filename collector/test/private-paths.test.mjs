import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { assertPrivateDirectory } from "../src/private-paths.mjs";
import { tempDirectory, repositoryRoot } from "./store-helpers.mjs";

test("repository folders are not private storage even when ignored", async () => {
  await assert.rejects(assertPrivateDirectory(path.join(repositoryRoot, "collector", "local"), { repositoryRoot }), { code: "UNSAFE_STORAGE_PATH" });
});
test("broad roots and relative paths are rejected", async () => {
  for (const root of [path.parse(repositoryRoot).root, os.homedir(), "relative-store", path.dirname(repositoryRoot)]) {
    await assert.rejects(assertPrivateDirectory(root, { repositoryRoot }), { code: "UNSAFE_STORAGE_PATH" });
  }
});
test("dedicated test storage is allowed outside the repository", async t => {
  const root = await tempDirectory(t);
  assert.equal(await assertPrivateDirectory(root, { repositoryRoot }), root);
});
test("known cloud sync directories are rejected before anything is created", async t => {
  const root = await tempDirectory(t);
  for (const name of ["OneDrive", "OneDrive - Fictional Company", "Dropbox", "Google Drive", "iCloudDrive"]) {
    await assert.rejects(assertPrivateDirectory(path.join(root, name, "BudgetCollector"), { repositoryRoot }), { code: "UNSAFE_STORAGE_PATH" });
  }
  await assert.rejects(assertPrivateDirectory(path.join(root, "CustomSync", "BudgetCollector"), {
    repositoryRoot, cloudRoots: [path.join(root, "CustomSync")],
  }), { code: "UNSAFE_STORAGE_PATH" });
  assert.deepEqual(await fs.readdir(root), []);
});
test("another Git working directory is also excluded", async t => {
  const root = await tempDirectory(t);
  await fs.mkdir(path.join(root, ".git"));
  await assert.rejects(assertPrivateDirectory(path.join(root, "store"), { repositoryRoot }), { code: "UNSAFE_STORAGE_PATH" });
});
test("directory junctions or symlinks cannot redirect private storage", async t => {
  const root = await tempDirectory(t);
  const target = path.join(root, "target");
  const link = path.join(root, "link");
  await fs.mkdir(target);
  try {
    await fs.symlink(target, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (["EPERM", "ENOTSUP"].includes(error.code)) return t.skip("This test host does not permit temporary filesystem links.");
    throw error;
  }
  await assert.rejects(assertPrivateDirectory(path.join(link, "store"), { repositoryRoot }), { code: "UNSAFE_STORAGE_PATH" });
});
