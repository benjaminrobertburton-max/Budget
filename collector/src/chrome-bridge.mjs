import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { requireEvidence as check } from "./errors.mjs";
import { validateActivityCandidate } from "./activity-probe.mjs";

const extensionOrigin = /^chrome-extension:\/\/[a-p]{32}$/;
const events = new Set(["wells_opened", "auth_required", "authenticated_page", "chase_opened", "chase_auth_required", "chase_authenticated_page", "chase_capture_dispatched", "chase_delivery_failed"]);
const captureStates = Object.freeze({
  candidate_read: "activity_candidate_captured",
  authentication_controls: "activity_capture_auth_required",
  no_activity_table: "activity_capture_no_table",
  page_limit: "activity_capture_page_limit",
});
const MAX_BODY_BYTES = 300000;
const commands = new Set(["none", "open_wells", "capture_wells_activity", "open_chase", "capture_chase_activity", "open_chase_sapphire", "open_chase_prime"]);

function response(res, status, origin, body = null) {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Budget-Collector-Session",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  res.writeHead(status, headers);
  res.end(body === null ? "" : JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    req.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) reject(new Error("BODY_TOO_LARGE"));
      else chunks.push(chunk);
    });
    req.on("error", reject);
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new Error("INVALID_JSON")); }
    });
  });
}

function validProgress(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === "event,tabId,version"
    && value.version === 1 && events.has(value.event)
    && (value.tabId === null || Number.isInteger(value.tabId) && value.tabId > 0);
}

export async function startChromeBridge({ port = 43811, nextCommand = "none", captureAfterAuth = false, onProgress = () => {}, onConnected = () => {}, onActivityCapture = null, onChaseActivityCapture = null } = {}) {
  check(Number.isInteger(port) && port >= 0 && port <= 65535, "INVALID_BRIDGE", "The local bridge port is invalid.");
  check(commands.has(nextCommand), "INVALID_BRIDGE", "The local bridge command is invalid.");
  check(onActivityCapture === null || typeof onActivityCapture === "function", "INVALID_BRIDGE", "The local capture handler is invalid.");
  check(onChaseActivityCapture === null || typeof onChaseActivityCapture === "function", "INVALID_BRIDGE", "The local Chase capture handler is invalid.");
  let origin = null;
  let session = null;
  let lastEvent = null;
  let chaseAuthenticated = false;
  let nextPageToken = null;
  let lastChaseCard=null, chaseCaptureDispatched=false, chaseRetryUsed=false, chaseAuthInterrupted=false;
  const server = createServer(async (req, res) => {
    const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : null;
    try {
      if (req.method === "OPTIONS") return response(res, 204, requestOrigin === origin ? origin : null);
      if (req.url === "/v1/status") {
        // Deliberately bounded local diagnostic. It is not CORS-enabled and
        // contains no page, account, credential, or financial information.
        if (req.method !== "GET" || requestOrigin) return response(res, 403, null);
        return response(res, 200, null, { version: 1, listening: server.listening,
          extensionConnected: session !== null, lastEvent, commandQueued: nextCommand !== "none" });
      }
      if (req.url === "/v1/command") {
        if (req.method !== "GET") return response(res, 405, requestOrigin === origin ? origin : null);
        // Chromium may omit Origin for an extension GET with a host permission.
        // The unguessable, in-memory per-run session remains mandatory; reject a
        // present mismatched origin rather than requiring a header Chromium does
        // not consistently provide.
        if (!origin || (requestOrigin && requestOrigin !== origin) || req.headers["x-budget-collector-session"] !== session) return response(res, 403, null);
        const command = nextCommand;
        if(['open_chase_prime','open_chase_sapphire'].includes(command)){
          lastChaseCard=command;chaseCaptureDispatched=false;
        }
        nextCommand = "none"; // One-shot command: a later retry never opens a second Wells tab.
        const pageToken=nextPageToken; nextPageToken=null;
        return response(res, 200, origin, { version: 1, command, ...(command==='capture_chase_more'?{pageToken}:{}) });
      }
      if (req.method !== "POST") return response(res, 405, requestOrigin === origin ? origin : null);
      if (req.url === "/v1/session") {
        if (!extensionOrigin.test(requestOrigin ?? "")) return response(res, 403, null);
        origin = requestOrigin;
        session = randomBytes(32).toString("hex");
        await onConnected({ origin });
        return response(res, 200, origin, { version: 1, session });
      }
      if (req.url === "/v1/progress") {
        if (!origin || requestOrigin !== origin || req.headers["x-budget-collector-session"] !== session) return response(res, 403, null);
        const body = await readJson(req);
        if (!validProgress(body)) return response(res, 400, origin);
        lastEvent = body.event;
        if (body.event === "chase_authenticated_page") chaseAuthenticated = true;
        if (body.event === "chase_auth_required") {chaseAuthenticated = false;chaseAuthInterrupted=true;}
        if(body.event==='chase_capture_dispatched')chaseCaptureDispatched=true;
        // A just-reloaded tab can report authentication unavailable then ready
        // before its navigation attempt fails. Retry that same read-only card
        // once per local run, never an active challenge, capture or paging error.
        if(body.event==='chase_delivery_failed'&&lastChaseCard&&chaseAuthInterrupted&&chaseAuthenticated
          &&!chaseCaptureDispatched&&!chaseRetryUsed&&nextCommand==='none'){
          chaseRetryUsed=true;nextCommand=lastChaseCard;lastEvent='chase_navigation_retry';
          onProgress({event:lastEvent});return response(res,204,origin);
        }
        if (captureAfterAuth && body.event === "authenticated_page" && nextCommand === "none") nextCommand = "capture_wells_activity";
        if (captureAfterAuth && body.event === "chase_authenticated_page" && nextCommand === "none") nextCommand = "capture_chase_activity";
        // On an already-authenticated Chase tab the content-script state can
        // arrive while its one-shot open command is still being consumed. Queue
        // the safe capture when the matching open acknowledgement arrives too.
        if (captureAfterAuth && body.event === "chase_opened" && chaseAuthenticated && nextCommand === "none") nextCommand = "capture_chase_activity";
        onProgress({ event: body.event });
        return response(res, 204, origin);
      }
      if (req.url === "/v1/activity") {
        if (!origin || requestOrigin !== origin || req.headers["x-budget-collector-session"] !== session) return response(res, 403, null);
        if (!onActivityCapture) return response(res, 503, origin);
        const candidate = validateActivityCandidate(await readJson(req));
        // A source table is the only candidate that can contain private activity
        // text. Empty/unsupported outcomes become fixed, non-financial states;
        // they are not represented as a successful capture.
        if (candidate.finding === "candidate_read") await onActivityCapture(candidate);
        lastEvent = captureStates[candidate.finding];
        onProgress({ event: lastEvent });
        return response(res, 204, origin);
      }
      if (req.url === "/v1/chase-activity") {
        if (!origin || requestOrigin !== origin || req.headers["x-budget-collector-session"] !== session) return response(res, 403, null);
        if (!onChaseActivityCapture) return response(res, 503, origin);
        const candidate = validateActivityCandidate(await readJson(req));
        if (candidate.finding === "candidate_read") {
          try {
            const decision = await onChaseActivityCapture(candidate);
            if(decision?.nextCard!==undefined){
              check(['prime_visa','sapphire_preferred'].includes(decision.nextCard)
                &&decision.nextPageToken===undefined&&nextCommand==='none','INVALID_BRIDGE','The next card request is invalid.');
              nextCommand=decision.nextCard==='prime_visa'?'open_chase_prime':'open_chase_sapphire';
            }
            if (decision?.nextPageToken !== undefined) {
              check(/^[a-f0-9]{8}$/.test(decision.nextPageToken) && nextCommand==='none',
                'INVALID_BRIDGE','The incremental request is invalid.');
              nextPageToken=decision.nextPageToken;
              nextCommand='capture_chase_more';
            }
          }
          catch {
            lastEvent = "chase_evidence_save_failed";
            onProgress({ event: lastEvent });
            return response(res, 500, origin);
          }
        }
        lastEvent = captureStates[candidate.finding];
        onProgress({ event: lastEvent });
        return response(res, 204, origin);
      }
      return response(res, 404, requestOrigin === origin ? origin : null);
    } catch {
      return response(res, 400, requestOrigin === origin ? origin : null);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port }, resolve);
  });
  const address = server.address();
  check(address && typeof address === "object" && address.address === "127.0.0.1", "BRIDGE_BIND_FAILED", "The local bridge did not bind to loopback.");
  return {
    port: address.port,
    status: () => ({ listening: server.listening, extensionConnected: session !== null, lastEvent, commandQueued: nextCommand !== "none" }),
    close: () => new Promise(resolve => server.close(resolve)),
  };
}
