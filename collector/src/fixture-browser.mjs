import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright-core";
import { requireEvidence as check, CollectionError } from "./errors.mjs";

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== "ESRCH"; }
}

// This transport deliberately permits FICTIONAL LOOPBACK PAGES ONLY.
// It is not a live-bank browser. Do not weaken this boundary to enable a pilot.
export async function openFixtureBrowser(scope, { origin, headless = true } = {}) {
  const url = new URL(origin);
  check(url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port
    && url.origin === origin && typeof headless === "boolean",
  "FIXTURE_ORIGIN_REQUIRED", "Browser testing requires one explicit local fictional-page origin.");
  check(!process.env.DEBUG && !process.env.PWDEBUG && !process.env.SSLKEYLOGFILE,
    "DEBUG_LOGGING_DISABLED", "Browser debug and key logging must be disabled for disposable tests.");
  check(path.dirname(scope.paths.browserProfile) === scope.paths.root
    && (await fs.readdir(scope.paths.browserProfile)).length === 0,
  "FRESH_PROFILE_REQUIRED", "Browser testing requires a new, empty disposable profile.");
  const artifacts = path.join(scope.paths.root, "browser-artifacts");
  await fs.mkdir(artifacts);
  let context;
  let connection;
  let launchFailed = false;
  const pids = new Set();
  const rememberProcesses = async () => {
    const { processInfo } = await connection.send("SystemInfo.getProcessInfo");
    for (const entry of processInfo) {
      check(Number.isSafeInteger(entry.id) && entry.id > 0, "BROWSER_PROCESS_UNKNOWN", "Browser process identity is unavailable.");
      pids.add(entry.id);
    }
  };
  scope.registerClose(async () => {
    check(!launchFailed, "BROWSER_CLOSE_UNVERIFIED", "Browser launch failed; shutdown needs verification before cleanup.");
    if (!context) return;
    let processCheckFailed = false;
    try { if (context.browser()?.isConnected()) await rememberProcesses(); }
    catch { processCheckFailed = true; }
    finally { await context.close(); }
    const deadline = performance.now() + 10000;
    while ([...pids].some(alive) && performance.now() < deadline) await delay(50);
    check(!processCheckFailed && pids.size > 0 && ![...pids].some(alive), "BROWSER_CLOSE_UNVERIFIED", "A test browser process may still be running.");
  });
  try {
    context = await chromium.launchPersistentContext(scope.paths.browserProfile, {
      channel: "chrome", headless, chromiumSandbox: true, acceptDownloads: false,
      artifactsDir: artifacts, downloadsPath: artifacts,
      handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
      serviceWorkers: "block", timeout: 30000,
      // Use ordinary Playwright defaults: no stealth, certificate bypass, or credential access.
    });
  } catch {
    launchFailed = true;
    throw new CollectionError("BROWSER_START_FAILED", "The separate test browser could not start. Private browser diagnostics were not logged.");
  }
  connection = await context.browser().newBrowserCDPSession();
  await rememberProcesses();
  await context.route("**/*", route => {
    const requestUrl = new URL(route.request().url());
    return requestUrl.origin === origin ? route.continue() : route.abort("blockedbyclient");
  });
  context.setDefaultTimeout(5000);
  context.setDefaultNavigationTimeout(10000);
  // No network/console/page-error listeners, screenshots, traces, or video recording.
  return { context, processIds: () => [...pids] };
}
