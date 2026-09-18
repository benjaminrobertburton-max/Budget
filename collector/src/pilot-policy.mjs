import { requireEvidence as check } from "./errors.mjs";
import { createRedirectGuard } from "./redirect-guard.mjs";

// Public Sign On destination linked by Wells Fargo's own online-banking page.
// No CLI-provided bank URL, wildcard third-party domain or insecure TLS override.
export const WELLS_SIGN_ON = "https://connect.secure.wellsfargo.com/auth/login/present?origin=cob";
const family = (hostname, domain) => hostname === domain || hostname.endsWith(`.${domain}`);
// Exact hosts declared by the PUBLIC, signed-out Wells sign-in page. See
// docs/WELLS_ASSET_REVIEW.md for provenance. Never wildcard the media domain.
const visualHosts = new Set(["www10.wellsfargomedia.com", "www15.wellsfargomedia.com", "www17.wellsfargomedia.com"]);
const visualExtensions = {
  stylesheet: /\.css$/i,
  font: /\.(?:woff2?|ttf|otf|eot)$/i,
  image: /\.(?:png|jpe?g|gif|svg|webp|ico|avif)$/i,
};

function parseHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.port && !url.username && !url.password
      && !url.hostname.endsWith(".") ? url : null;
  } catch { return null; }
}

export function isWellsDocument(value) {
  const url = parseHttps(value);
  return Boolean(url && family(url.hostname, "wellsfargo.com"));
}

export function wellsRequestAllowed({ url, method, resourceType }) {
  const target = parseHttps(url);
  if (!target) return false;
  if (family(target.hostname, "wellsfargo.com")) return true;
  // A visual-resource exception, NOT permission for bank navigation, scripts,
  // fetch/XHR, workers, uploads or form submissions. No query-string payloads.
  const extension = Object.hasOwn(visualExtensions, resourceType) ? visualExtensions[resourceType] : null;
  return visualHosts.has(target.hostname) && method === "GET" && !target.search && !target.hash
    && Boolean(extension?.test(target.pathname));
}

export function assertPanelAddress(address) {
  let url;
  try { url = new URL(address); } catch { /* Static error below. */ }
  check(url && url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port
    && !url.username && !url.password && !url.search && !url.hash
    && /^\/[a-f0-9]{48}\/$/.test(url.pathname),
  "PILOT_PANEL_REQUIRED", "A private loopback pilot control panel is required.");
  return url;
}

export async function installPilotNetworkPolicy(context, { panelAddress, onBlocked = () => {} }) {
  const panel = assertPanelAddress(panelAddress);
  const allowedDestination = (value, request) => {
    const url = new URL(value);
    return url.origin === panel.origin
      ? !url.username && !url.password && url.pathname.startsWith(panel.pathname) && !url.search
      : wellsRequestAllowed({ url: value, method: request?.method, resourceType: request?.resourceType });
  };
  const guard = await createRedirectGuard(context, allowedDestination, onBlocked);
  await context.route("**/*", async route => {
    let allowed = false;
    try {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === panel.origin) {
        allowed = !url.username && !url.password && url.pathname.startsWith(panel.pathname) && !url.search;
      } else {
        allowed = wellsRequestAllowed({ url: request.url(), resourceType: request.resourceType(), method: request.method() });
      }
      if (allowed) allowed = guard(request);
    } catch { allowed = false; /* Unsupported guards/unknown frames never weaken policy. */ }
    if (!allowed) onBlocked();
    await (allowed ? route.continue() : route.abort("blockedbyclient"));
  });
  await context.routeWebSocket("**/*", socket => { onBlocked(); return socket.close(); });
  context.on("requestfailed", request => {
    if (request.failure()?.errorText === "net::ERR_BLOCKED_BY_CLIENT") onBlocked();
  });
}
