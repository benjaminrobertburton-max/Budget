import { readFile } from "node:fs/promises";
import path from "node:path";

const required = Object.freeze([
  ["bridge manifest", "chrome-bridge/manifest.json"],
  ["bridge worker", "chrome-bridge/background.js"],
  ["Wells page reader", "chrome-bridge/wells-page-state.js"],
  ["R&D record", "../docs/COLLECTOR_RND.md"],
]);

async function load(root, relative) {
  return readFile(path.join(root, "collector", relative), "utf8");
}

export async function runCollectorQc({ repositoryRoot }) {
  const results = [];
  const fail = (id, detail) => results.push({ id, status: "fail", detail });
  const pass = (id, detail) => results.push({ id, status: "pass", detail });
  const files = {};
  for (const [id, relative] of required) {
    try { files[id] = await load(repositoryRoot, relative); pass(id, "present"); }
    catch { fail(id, "required QC record or bridge file is missing"); }
  }
  if (files["bridge manifest"]) {
    try {
      const manifest = JSON.parse(files["bridge manifest"]);
      const permissions = new Set(manifest.permissions ?? []);
      for (const permission of ["tabs", "alarms", "debugger"]) {
        if (!permissions.has(permission)) fail(`manifest permission: ${permission}`, "required for the researched bridge path");
      }
      if (manifest.externally_connectable) fail("no visible trigger route", "externally_connectable is still configured");
      else pass("no visible trigger route", "no externally-connectable localhost page");
      if (manifest.version === "0.3.3") pass("extension version", "0.3.3 researched bridge");
      else fail("extension version", `expected 0.3.3, found ${String(manifest.version)}`);
      if (manifest.content_scripts?.some(script => script.all_frames === true)) pass("child-frame reader coverage", "Wells activity frames receive the reader");
      else fail("child-frame reader coverage", "content script is not enabled for Wells frames");
    } catch { fail("manifest JSON", "manifest is not valid JSON"); }
  }
  if (files["bridge worker"]) {
    const worker = files["bridge worker"];
    if (/v1\/trigger|onMessageExternal|chrome-launcher|local-refresh-trigger/.test(worker)) fail("worker wake path", "stale trigger-tab or external-message path remains");
    else pass("worker wake path", "loopback polling only");
    if (/chrome\.debugger\.attach/.test(worker) && /chrome\.debugger\.detach/.test(worker)) pass("trusted navigation lifecycle", "attach/detach are both bounded");
    else fail("trusted navigation lifecycle", "trusted click must attach and detach explicitly");
  }
  if (files["Wells page reader"]) {
    const reader = files["Wells page reader"];
    for (const [id, pattern, detail] of [
      ["checking navigation request", /checking_navigation_required/, "summary-to-detail navigation"],
      ["checking clickable variants", /a,button,\[role=link\],\[role=button\]/, "anchor, button and ARIA link/button cards"],
      ["ARIA activity support", /\[role=grid\]|\[role=table\]/, "Wells accessible table/grid variants"],
      ["composed DOM search", /const roots = \(\) =>|deepQueryAll/, "open shadow-root and same-origin-frame traversal"],
      ["flexible activity headings", /headerKind|deposits\?\\s\*\//, "heading spacing around slash"],
      ["bounded rendering wait", /readinessAttempts < 150/, "30-second maximum"],
    ]) {
      if (pattern.test(reader)) pass(id, detail); else fail(id, `missing ${detail}`);
    }
  }
  if (files["R&D record"]) {
    if (/Failure inventory/.test(files["R&D record"]) && /External research applied/.test(files["R&D record"])) pass("lessons learned", "failure inventory and external research recorded");
    else fail("lessons learned", "R&D record is incomplete");
  }
  return { ok: results.every(result => result.status === "pass"), results };
}

export function formatCollectorQc(report) {
  const lines = [`Collector QC: ${report.ok ? "PASS" : "BLOCKED"}`];
  for (const result of report.results) lines.push(`${result.status === "pass" ? "PASS" : "FAIL"} ${result.id}: ${result.detail}`);
  return lines.join("\n");
}
