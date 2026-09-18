import http from "node:http";
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { requireEvidence as check } from "./errors.mjs";

export async function startPilotPanel({ controller, mode, fictionalPage = null }) {
  check(["wells", "fictional"].includes(mode) && (fictionalPage === null || mode === "fictional"),
    "INVALID_PILOT", "Pilot mode must be explicit.");
  const prefix = `/${randomBytes(24).toString("hex")}/`;
  const actionKey = randomBytes(24).toString("hex");
  const css = await fs.readFile(new URL("../ui/pilot.css", import.meta.url), "utf8");
  const script = await fs.readFile(new URL("../ui/pilot.js", import.meta.url), "utf8");
  const fictional = mode === "fictional";
  const title = fictional ? "Rehearse the Wells pilot" : "Wells Fargo pilot";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="collector-control" content="${actionKey}"><title>Budget Collector · ${title}</title><link rel="stylesheet" href="${prefix}pilot.css"><script src="${prefix}pilot.js" defer></script></head><body>
<header class="topbar"><div class="brand"><span class="brand-mark" aria-hidden="true">B</span><span>Budget Collector<small>PRIVATE DEVELOPMENT PILOT</small></span></div><div class="top-actions"><span class="badge">${fictional ? "Fictional pages only" : "Local · temporary session"}</span><button id="stop-top" class="top-stop">Stop & clean up</button></div></header>
<main><div class="intro"><p class="eyebrow">ONE ACCOUNT · NO WORKBOOK CHANGES</p><h1>${title}</h1><p class="lead">${fictional ? "Try the controls safely. This rehearsal cannot connect to a bank." : "A controlled first step toward your Tuesday refresh."}</p></div>
<div class="layout"><section class="card workflow" aria-labelledby="workflow-title"><div class="section-head"><h2 id="workflow-title">Your test session</h2><span id="status-badge" class="badge muted">Not started</span></div>
<ol class="steps"><li><span class="step-number">1</span><div><h3>${fictional ? "Open the fictional account" : "Open Wells & sign in yourself"}</h3><p>${fictional ? "No passwords or real account information belong in this rehearsal." : "Use the separate bank tab for sign-in and MFA. View accounts only; do not make payments or transfers."}</p></div></li><li><span class="step-number">2</span><div><h3>Inspect a page outline</h3><p>Return here after opening an account page. Only the page structure is inspected—not text, amounts, account numbers, or form values.</p></div></li><li><span class="step-number">3</span><div><h3>Finish & remove test data</h3><p>The test browser closes before its temporary profile and encrypted outlines are deleted.</p></div></li></ol>
<label id="ack-row" class="ack"><input id="ack" type="checkbox"><span>${fictional ? "I understand these are fictional pages. I will not enter real information." : "I am permitted to test on this computer. I will handle sign-in myself and keep this session read-only."}</span></label>
<div class="actions"><button id="start" class="primary" disabled>${fictional ? "Open fictional account" : "Open Wells"}</button><button id="inspect" class="secondary" disabled>Inspect page outline</button></div>
<div id="status-message" class="status" role="status" aria-live="polite">Nothing has connected. Review the steps to begin.</div>
<div id="network-warning" class="warning" hidden>A request was blocked by the pilot's destination policy. If sign-in or a page does not work, stop and report the issue. Do not bypass security controls.</div>
<div id="outline" class="outline" hidden><div><span class="label">Outlines inspected</span><strong id="outline-count">0 / 12</strong></div><div><span class="label">Page elements</span><strong id="element-count">—</strong></div><div><span class="label">Tables / grids</span><strong id="table-count">—</strong></div><p id="outline-note"></p></div>
<div class="finish"><button id="stop" class="stop">Stop & clean up</button><span>Closing this control tab also stops the test.</span></div></section>
<aside><section class="card boundary"><p class="eyebrow">WHAT STAYS PROTECTED</p><h2>Your normal browser stays separate.</h2><ul><li>New, disposable Chrome profile</li><li>No Google account or Chrome sync</li><li>No stored credential access</li><li>No account text in logs or chat</li><li>No financial data sent to GitHub</li></ul><p class="small">Browser cookies/cache are browser-managed. The whole test profile is removed after the browser exits.</p></section>
<section class="card limitation"><span class="badge muted">Not a budget refresh</span><h2>Account coverage is not verified.</h2><p>This pilot does not read transactions, prove a successful login, or update your workbook. An outline is a development aid, not financial evidence.</p></section></aside></div>
<footer>Session limit: 20 minutes · At most 12 outlines · Cleanup is confirmed by the launcher after the browser closes.<br>Ordinary deletion does not erase bank, operating-system, employer, or backup records.</footer></main></body></html>`;
  let origin;
  const headers = {
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  };
  const server = http.createServer(async (request, response) => {
    const send = (status, body, type = "text/plain") => {
      if (!response.writableEnded) { response.writeHead(status, { ...headers, "Content-Type": `${type}; charset=utf-8` }); response.end(body); }
    };
    try {
      if (request.headers.host !== new URL(origin).host) return send(403, "Unavailable");
      if (!request.url?.startsWith(prefix) || request.url.includes("?")) return send(404, "Unavailable");
      const suffix = request.url.slice(prefix.length);
      if (request.method === "GET") {
        if (request.headers.origin && request.headers.origin !== origin) return send(403, "Unavailable");
        if (suffix === "") return send(200, html, "text/html");
        if (suffix === "pilot.css") return send(200, css, "text/css");
        if (suffix === "pilot.js") return send(200, script, "text/javascript");
        if (suffix === "state") return send(200, JSON.stringify(controller.state()), "application/json");
        if (fictional && suffix === "fictional-bank" && fictionalPage) return send(200, fictionalPage, "text/html");
        return send(404, "Unavailable");
      }
      if (request.method !== "POST" || suffix !== "action" || request.headers.origin !== origin
        || request.headers["x-collector-control"] !== actionKey || request.headers["content-type"] !== "application/json") return send(403, "Unavailable");
      let bytes = 0;
      const chunks = [];
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 256) { request.resume(); return send(413, "Unavailable"); }
        chunks.push(chunk);
      }
      let command;
      try { command = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { return send(400, "Unavailable"); }
      const accepted = controller.action(command);
      return send(accepted ? 202 : 409, JSON.stringify({ accepted }), "application/json");
    } catch { send(500, "Pilot action unavailable. No private details were logged."); }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.maxHeadersCount = 30;
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, address: `${origin}${prefix}`, actionKey,
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
