import { readFile } from "node:fs/promises";
import path from "node:path";

const required = Object.freeze([
  ["bridge manifest", "chrome-bridge/manifest.json"],
  ["bridge worker", "chrome-bridge/background.js"],
  ["Wells page reader", "chrome-bridge/wells-page-state.js"],
  ["Chase page reader", "chrome-bridge/chase-page-state.js"],
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
      if (manifest.version === "0.4.4") pass("extension version", "0.4.4 Chase shared row and text validation");
      else fail("extension version", `expected 0.4.4, found ${String(manifest.version)}`);
      if (permissions.has("webNavigation")) pass("frame command delivery", "capture commands can reach every Wells frame");
      else fail("frame command delivery", "webNavigation permission is missing");
      if (manifest.content_scripts?.some(script => script.all_frames === true)) pass("child-frame reader coverage", "Wells activity frames receive the reader");
      else fail("child-frame reader coverage", "content script is not enabled for Wells frames");
    } catch { fail("manifest JSON", "manifest is not valid JSON"); }
  }
  if (files["Chase page reader"]) {
    const reader = files["Chase page reader"];
    for (const [id, pattern, detail] of [
      ["Chase generic table gate", /activityHeader|transaction activity|transactions/i, "separate Chase activity-table recognition"],
      ["Chase bounded render wait", /captureAttempts < 150/, "30-second maximum"],
      ["Chase privacy boundary", /document\.cookie|localStorage|sessionStorage|\.value/, "must not read browser secrets"],
    ]) {
      if (id === "Chase privacy boundary") {
        if (!pattern.test(reader)) pass(id, detail); else fail(id, detail);
      } else if (pattern.test(reader)) pass(id, detail); else fail(id, `missing ${detail}`);
    }
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
      ["Wells transaction test IDs", /transaction-heading-|transaction-table/, "stable Wells transaction table identifiers"],
      ["composed DOM search", /const roots = \(\) =>|deepQueryAll/, "open shadow-root and same-origin-frame traversal"],
      ["flexible activity headings", /headerKind|deposits\?\\s\*\//, "heading spacing around slash"],
      ["bounded rendering wait", /readinessAttempts < 150/, "30-second maximum"],
      ["capture render wait", /captureAttempts < 150|captureWhenReady/, "capture waits for rendered activity"],
    ]) {
      if (pattern.test(reader)) pass(id, detail); else fail(id, `missing ${detail}`);
    }
  }
  if (files["R&D record"]) {
    if (/Failure inventory/.test(files["R&D record"]) && /External research applied/.test(files["R&D record"])) pass("lessons learned", "failure inventory and external research recorded");
    else fail("lessons learned", "R&D record is incomplete");
    if (/Practical debugging protocol/.test(files["R&D record"]) && /DevTools Elements\/Frames/.test(files["R&D record"]) && /Do not stop at the first error/.test(files["R&D record"])) pass("practical debugging", "evidence-first root-cause tracing is required");
    else fail("practical debugging", "evidence-first protocol is missing");
    if (/event sequence:\s*top-frame\s+status/.test(files["R&D record"]) && /early top-frame empty result/.test(files["R&D record"])) pass("frame lifecycle", "top-frame and child-frame sequencing is an explicit gate");
    else fail("frame lifecycle", "frame event sequencing gate is missing");
  }
  return { ok: results.every(result => result.status === "pass"), results };
}

export function formatCollectorQc(report) {
  const lines = [`Collector QC: ${report.ok ? "PASS" : "BLOCKED"}`];
  for (const result of report.results) lines.push(`${result.status === "pass" ? "PASS" : "FAIL"} ${result.id}: ${result.detail}`);
  return lines.join("\n");
}
