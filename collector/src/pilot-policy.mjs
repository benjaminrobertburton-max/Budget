import { requireEvidence as check } from "./errors.mjs";
import { createRedirectGuard } from "./redirect-guard.mjs";

// Public Sign On destination linked by Wells Fargo's own online-banking page.
// No CLI-provided bank URL, wildcard third-party domain or insecure TLS override.
export const WELLS_SIGN_ON = "https://connect.secure.wellsfargo.com/auth/login/present?origin=cob";
const family = (hostname, domain) => hostname === domain || hostname.endsWith(`.${domain}`);

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

export function wellsRequestAllowed({ url }) {
  const target = parseHttps(url);
  if (!target) return false;
  return family(target.hostname, "wellsfargo.com");
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
  const allowedDestination = value => {
    const url = new URL(value);
    return url.origin === panel.origin
      ? !url.username && !url.password && url.pathname.startsWith(panel.pathname) && !url.search
      : isWellsDocument(value);
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
