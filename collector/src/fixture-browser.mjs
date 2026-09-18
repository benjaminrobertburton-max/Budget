import { requireEvidence as check } from "./errors.mjs";
import { openOwnedTestBrowser } from "./owned-browser.mjs";
import { createRedirectGuard } from "./redirect-guard.mjs";

// This transport deliberately permits FICTIONAL LOOPBACK PAGES ONLY.
// It is not a live-bank browser. Do not weaken this boundary to enable a pilot.
export async function openFixtureBrowser(scope, { origin, headless = true } = {}) {
  const url = new URL(origin);
  check(url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port
    && url.origin === origin && typeof headless === "boolean",
  "FIXTURE_ORIGIN_REQUIRED", "Browser testing requires one explicit local fictional-page origin.");
  return openOwnedTestBrowser(scope, { headless, configure: async context => {
    const guard = await createRedirectGuard(context, value => new URL(value).origin === origin);
    await context.route("**/*", async route => {
      try {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.origin === origin && guard(route.request())) {
          return await route.continue();
        }
      } catch { /* Fail closed; private protocol errors are not logged. */ }
      return route.abort("blockedbyclient");
    });
    await context.routeWebSocket("**/*", socket => socket.close());
  } });
}
