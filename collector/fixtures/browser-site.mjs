import http from "node:http";
import { randomBytes } from "node:crypto";
import { makeRegistry, makeCaptures } from "./synthetic.mjs";

const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = minor => `${minor < 0 ? "-" : ""}$${Math.floor(Math.abs(minor) / 100)}.${String(Math.abs(minor) % 100).padStart(2, "0")}`;
const field = (key, value) => `<span data-field="${escape(key)}">${escape(value)}</span>`;
const shell = (title, body, ready = false) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Collector test · ${escape(title)}</title><style>
body{margin:0;background:#edf2f5;color:#1a3040;font:16px/1.5 "Segoe UI",sans-serif}main{max-width:1050px;margin:40px auto;background:white;padding:30px;border:1px solid #d8e1e7;border-radius:14px}header{color:#507084}h1{font-size:28px;margin:10px 0 20px}h2{font-size:20px}table{border-collapse:collapse;width:100%;margin:16px 0}td,th{text-align:left;padding:10px 12px;border-bottom:1px solid #d8e1e7}button,a{color:#155f6c}button{padding:12px 20px;border:0;border-radius:8px;background:#155f6c;color:white;font-size:16px}aside{padding:16px;background:#fff6dc;border-left:4px solid #c48e21;margin:18px 0}.controls{display:flex;gap:24px;padding:16px;background:#e9f2f2}.amount{text-align:right;font-variant-numeric:tabular-nums}
</style></head><body data-session-ready="${ready}"><main><header>Budget Collector · Fictional browser test</header><h1>${escape(title)}</h1>${body}</main></body></html>`;

// Real HTML tables, independent coverage captions, and overlapping pagination.
// No bank domains, credentials, account connections, external assets, or uploads.
export async function startFixtureSite({ responseDelayMs = 0 } = {}) {
  const registry = makeRegistry();
  registry.accounts = registry.accounts.filter(account => ["demo-wells", "demo-wealthfront", "demo-chase-sapphire", "demo-chase-prime", "demo-paypal"].includes(account.id));
  const captures = makeCaptures();
  const groups = [
    { id: "demo-checking", accountIds: ["demo-wells"] },
    { id: "demo-savings", accountIds: ["demo-wealthfront"] },
    { id: "demo-cards", accountIds: ["demo-chase-sapphire", "demo-chase-prime"] },
    { id: "demo-promos", accountIds: ["demo-paypal"] },
  ];
  const token = randomBytes(24).toString("hex");
  const prefix = `/${token}`;
  const approved = new Set();
  const timers = new Set();
  let origin;
  let snapshot = { groups: [] };
  let cancel = () => {};
  const server = http.createServer((request, response) => {
    const send = (status, text, type = "text/html") => {
      response.writeHead(status, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'self'",
        "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" });
      response.end(text);
    };
    if (request.headers.host !== new URL(origin).host || !["GET", "POST"].includes(request.method)) return send(403, "Unavailable");
    const url = new URL(request.url, origin);
    const parts = url.pathname.slice(prefix.length).split("/").filter(Boolean);
    if (!url.pathname.startsWith(`${prefix}/`)) return send(404, "Unavailable");
    if (request.method === "POST" && request.headers.origin !== origin) return send(403, "Unavailable");
    if (parts[0] === "progress" && request.method === "GET") return send(200, JSON.stringify(snapshot), "application/json");
    if (parts[0] === "cancel" && request.method === "POST") { cancel(); return send(200, shell("Stopping test", "The browser will close and its test data will be deleted.")); }
    if (parts[0] === "start" && request.method === "GET") return send(200, shell("Test collection", `<aside>No real bank is connected. Do not enter credentials. Each approval below is fictional.</aside>
<p>All sign-ins are available now. Collection starts as each institution becomes ready.</p><ul>${groups.map(group => `<li><a target="${group.id}" href="${prefix}/group/${group.id}/sign-in">${group.id}: ${group.accountIds.length} account(s)</a></li>`).join("")}</ul>
<pre id="progress">Preparing…</pre><form method="post" action="${prefix}/cancel"><button>Cancel test and delete its data</button></form><script>setInterval(async()=>{try{const s=await (await fetch('${prefix}/progress')).json();document.querySelector('#progress').textContent=s.groups.map(g=>g.groupId+' — '+g.status+' ('+g.collectedAccounts+'/'+g.accountCount+')').join(String.fromCharCode(10))}catch{}},300)</script>`));
    if (parts[0] !== "group") return send(404, "Unavailable");
    const group = groups.find(item => item.id === parts[1]);
    if (!group) return send(404, "Unavailable");
    if (parts[2] === "approve" && request.method === "POST") {
      approved.add(group.id);
      response.writeHead(303, { Location: `${prefix}/group/${group.id}/sign-in`, "Cache-Control": "no-store" });
      return response.end();
    }
    if (request.method !== "GET") return send(405, "Unavailable");
    if (parts[2] === "ready") return send(200, JSON.stringify({ ready: approved.has(group.id) }), "application/json");
    if (parts[2] === "sign-in" || !approved.has(group.id)) return send(200, shell(group.id, `<aside>This is a simulated approval, not a bank login. No password, Google account, or text code is needed.</aside>
<form method="post" action="${prefix}/group/${group.id}/approve"><button>Simulate approval</button></form><p id="state">${approved.has(group.id) ? "Ready for collection" : "Waiting for your fictional approval"}</p>
<script>setInterval(async()=>{try{const s=await(await fetch('${prefix}/group/${group.id}/ready')).json();document.body.dataset.sessionReady=String(s.ready);if(s.ready)document.querySelector('#state').textContent='Ready for collection'}catch{}},150)</script>`, approved.has(group.id)));
    const [, , accountId, pageId, pageText = "0"] = parts;
    const account = registry.accounts.find(item => item.id === accountId && group.accountIds.includes(item.id));
    if (!account || !account.requiredPages.includes(pageId) || !/^\d+$/.test(pageText)) return send(404, "Unavailable");
    const capture = captures[accountId];
    let content = `<div data-capture data-account="${accountId}" data-page="${pageId}" data-captured-at="${capture.capturedAt}">`;
    if (pageId === "summary") content += `<table><thead><tr><th>Balance type</th><th>Currency</th><th>Amount</th></tr></thead><tbody>${capture.balances.map(balance => `<tr data-balance><td>${balance.type}</td><td>${balance.currency}</td><td class="amount">${money(balance.amountMinor)}</td></tr>`).join("")}</tbody></table>`;
    else if (["posted", "pending"].includes(pageId)) {
      const coverage = capture.coverage[pageId];
      const rows = capture.transactions.filter(row => row.state === pageId);
      const page = Number(pageText);
      const visible = rows.slice(page, page + 2);
      content += `<div class="controls">Expected count: ${field("count", coverage.count)} Signed total: ${field("total", money(coverage.totalMinor))} ${pageId === "posted" ? `From ${field("fromDate", coverage.fromDate)} Through ${field("throughDate", coverage.throughDate)}` : `Scope ${field("scope", coverage.scope)}`}</div>`;
      content += `<table><thead><tr>${["ID", "Pending ID", "Effective", "Posted", "Merchant", "Amount", "Currency", "Status", "Kind"].map(label => `<th>${label}</th>`).join("")}</tr></thead><tbody>${visible.map(row => `<tr data-transaction>${[row.sourceId, row.pendingSourceId, row.effectiveDate, row.postedDate, row.merchant, money(row.amountMinor), row.currency, row.state, row.kind].map(value => `<td>${escape(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      if (page + 2 < rows.length) content += `<a data-next href="${prefix}/group/${group.id}/${accountId}/${pageId}/${page + 1}">Next activity page</a>`;
    } else if (pageId === "obligations") {
      content += `<p>Minimum ${field("minimum", money(capture.obligations.minimumMinor))}</p><p>Statement ${field("statement", money(capture.obligations.statementMinor))}</p><p>Due ${field("dueDate", capture.obligations.dueDate)}</p>`;
    } else {
      content += `<p>Expected plans: ${field("promoCount", capture.promoCount)}</p><table><thead><tr><th>Plan</th><th>Balance</th><th>Expires</th></tr></thead><tbody>${capture.promos.map(promo => `<tr data-promo><td>${escape(promo.sourceId)}</td><td>${money(promo.balanceMinor)}</td><td>${promo.expiresOn}</td></tr>`).join("")}</tbody></table>`;
    }
    content += "</div>";
    const timer = setTimeout(() => { timers.delete(timer); send(200, shell(`${account.label} · ${pageId}`, content, true)); }, Math.max(0, Math.min(1000, responseDelayMs)));
    timers.add(timer);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin, baseUrl: `${origin}${prefix}`, registry, groups,
    approve: id => { if (!groups.some(group => group.id === id)) throw new Error("Unknown fictional group"); approved.add(id); },
    revoke: id => approved.delete(id),
    setProgress: value => { snapshot = structuredClone(value); },
    onCancel: callback => { cancel = callback; },
    async close() {
      for (const timer of timers) clearTimeout(timer);
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    },
  };
}
