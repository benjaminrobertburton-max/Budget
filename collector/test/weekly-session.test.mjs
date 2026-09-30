import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { clearWeeklySession, readWeeklySession, saveWeeklySession } from "../src/weekly-session.mjs";

const sources = ["wells", "chase_prime", "chase_sapphire", "citi", "paypal", "wealthfront"];
test('v3 checkpoints retain verified accounts around a failed source and bind raw receipts',async t=>{
  const {root,configFile}=await fixture(t),a='local:evidence:11111111-1111-4111-8111-111111111111',b='local:evidence:22222222-2222-4222-8222-222222222222';
  const args={privateRoot:root,configFile,sources,completed:['chase_prime'],references:{chase_prime:b},captured:{wells:a,chase_prime:b}};
  await saveWeeklySession(args);
  const value=await readWeeklySession({...args,details:true});assert.deepEqual(value.completed,['chase_prime']);assert.equal(value.captured.wells,a);
  await assert.rejects(saveWeeklySession({...args,captured:{wells:a,chase_prime:a}}),{code:'WEEKLY_SESSION_INVALID'});
  await assert.rejects(readWeeklySession({...args,configFile:configFile+'changed'}),{code:'WEEKLY_SESSION_INVALID'});
});

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(tmpdir(), "budget-weekly-session-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, configFile: path.join(root, "weekly-refresh.json") };
}

test("weekly resume checkpoint stores only a validated source prefix", async t => {
  const { root, configFile } = await fixture(t);
  assert.deepEqual(await readWeeklySession({ privateRoot: root, configFile, sources }), []);
  await saveWeeklySession({ privateRoot: root, configFile, sources, completed: ["wells"] });
  await saveWeeklySession({ privateRoot: root, configFile, sources, completed: ["wells", "chase_prime"] });
  assert.deepEqual(await readWeeklySession({ privateRoot: root, configFile, sources }), ["wells", "chase_prime"]);
  const stored = await fs.readFile(path.join(root, "weekly-refresh-session.json"), "utf8");
  assert.doesNotMatch(stored, /weekly-refresh\.json/);
  await clearWeeklySession({ privateRoot: root });
  assert.deepEqual(await readWeeklySession({ privateRoot: root, configFile, sources }), []);
});

test("weekly resume checkpoint fails closed when tampered or out of order", async t => {
  const { root, configFile } = await fixture(t);
  await fs.writeFile(path.join(root, "weekly-refresh-session.json"), JSON.stringify({ version: 1, configFingerprint: "wrong", completed: ["citi"] }));
  await assert.rejects(readWeeklySession({ privateRoot: root, configFile, sources }), { code: "WEEKLY_SESSION_INVALID" });
  await assert.rejects(saveWeeklySession({ privateRoot: root, configFile, sources, completed: ["citi"] }), { code: "WEEKLY_SESSION_INVALID" });
});
