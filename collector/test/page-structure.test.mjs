import test from "node:test";
import assert from "node:assert/strict";
import { inspectPageStructure, validatePageStructure } from "../src/page-structure.mjs";

const report = () => ({ version: 1, kind: "structure_only", coverageVerified: false,
  truncated: false, hasFrames: false, hasShadowRoots: false, redactedSubtrees: 0,
  nodes: [{ id: 0, parent: -1, position: 1, tag: "body", role: "none", shadow: false }] });

test("a structural outline is explicitly not verified financial evidence", async () => {
  const result = await inspectPageStructure({ evaluate: async () => report() });
  assert.equal(result.coverageVerified, false);
  assert.equal(result.kind, "structure_only");
});

for (const [label, mutate] of [
  ["unexpected page text", v => { v.text = "FICTIONAL-SECRET"; }],
  ["URLs", v => { v.url = "https://example.com/FICTIONAL-SECRET"; }],
  ["node identifiers", v => { v.nodes[0].accountId = "FICTIONAL-SECRET"; }],
  ["custom tag names", v => { v.nodes[0].tag = "FICTIONAL-SECRET"; }],
  ["custom role values", v => { v.nodes[0].role = "FICTIONAL-SECRET"; }],
  ["private values disguised as numbers", v => { v.nodes[0].position = "FICTIONAL-SECRET"; }],
  ["invalid topology", v => { v.nodes[0].parent = 0; }],
  ["unbounded topology", v => { v.nodes = Array(1501).fill(v.nodes[0]); }],
  ["verified flag", v => { v.coverageVerified = true; }],
]) {
  test(`inspection rejects ${label} without including rejected values in errors`, async () => {
    const value = report();
    mutate(value);
    assert.throws(() => validatePageStructure(value), { code: "STRUCTURE_INSPECTION_BLOCKED" });
    await assert.rejects(inspectPageStructure({ evaluate: async () => value }), error => error.code === "STRUCTURE_INSPECTION_BLOCKED" && !error.message.includes("FICTIONAL"));
  });
}

test("evaluation errors containing private page text are never forwarded", async () => {
  await assert.rejects(inspectPageStructure({ evaluate: async () => { throw new Error("FICTIONAL-PRIVATE-PASSWORD"); } }), error => error.code === "STRUCTURE_INSPECTION_BLOCKED" && !error.message.includes("FICTIONAL"));
});
