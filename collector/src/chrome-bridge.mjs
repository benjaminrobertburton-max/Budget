import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { requireEvidence as check } from "./errors.mjs";

const extensionOrigin = /^chrome-extension:\/\/[a-p]{32}$/;
const events = new Set(["wells_opened", "auth_required", "authenticated_page"]);
const MAX_BODY_BYTES = 1024;

function response(res, status, origin, body = null) {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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

export async function startChromeBridge({ port = 43811, onProgress = () => {} } = {}) {
  check(Number.isInteger(port) && port >= 0 && port <= 65535, "INVALID_BRIDGE", "The local bridge port is invalid.");
  let origin = null;
  let session = null;
  let lastEvent = null;
  const server = createServer(async (req, res) => {
    const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : null;
    try {
      if (req.method === "OPTIONS") return response(res, 204, requestOrigin === origin ? origin : null);
      if (req.method !== "POST") return response(res, 405, requestOrigin);
      if (req.url === "/v1/session") {
        if (!extensionOrigin.test(requestOrigin ?? "")) return response(res, 403, null);
        origin = requestOrigin;
        session = randomBytes(32).toString("hex");
        return response(res, 200, origin, { version: 1, session });
      }
      if (req.url === "/v1/progress") {
        if (!origin || requestOrigin !== origin || req.headers["x-budget-collector-session"] !== session) return response(res, 403, null);
        const body = await readJson(req);
        if (!validProgress(body)) return response(res, 400, origin);
        lastEvent = body.event;
        onProgress({ event: body.event });
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
    status: () => ({ listening: server.listening, extensionConnected: session !== null, lastEvent }),
    close: () => new Promise(resolve => server.close(resolve)),
  };
}
