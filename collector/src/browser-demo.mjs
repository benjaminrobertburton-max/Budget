import { fileURLToPath } from "node:url";
import { withDisposableTestRun } from "./disposable-run.mjs";
import { openFixtureBrowser } from "./fixture-browser.mjs";
import { collectWithSessions } from "./session-collection.mjs";
import { startFixtureSite } from "../fixtures/browser-site.mjs";
import { fixtureBrowserReader } from "../fixtures/browser-reader.mjs";
import { FIXTURE_NOW } from "../fixtures/synthetic.mjs";
import { requireEvidence as check } from "./errors.mjs";

export async function browserDemo({ interactive = false, parent, signal, onProgress = () => {} } = {}) {
  const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
  const controller = new AbortController();
  const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  // Graceful interruption waits for collection/browser shutdown and directory cleanup.
  const stop = () => controller.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    return await withDisposableTestRun({ repositoryRoot, ...(parent ? { parent } : {}) }, async scope => {
      const site = await startFixtureSite();
      scope.registerClose(() => site.close());
      site.onCancel(stop);
      const { context } = await openFixtureBrowser(scope, { origin: site.origin, headless: !interactive });
      if (interactive) {
        const page = context.pages()[0] ?? await context.newPage();
        await page.goto(`${site.baseUrl}/start`);
      } else {
        for (const group of site.groups) site.approve(group.id);
      }
      const result = await collectWithSessions({
        registry: site.registry, groups: site.groups,
        reader: fixtureBrowserReader({ context, site, saveEvidence: scope.saveEvidence }),
        now: () => FIXTURE_NOW, signal: combined,
        onProgress: progress => { site.setProgress(progress); onProgress(progress); },
      });
      if (result.status === "cancelled") return { status: "cancelled", accountCount: 0 };
      check(result.status === "candidate_ready", "BROWSER_DEMO_BLOCKED", "The fictional browser demonstration did not produce a complete candidate.");
      // Return no financial evidence to the CLI; it is removed with the test run.
      return { status: "passed", accountCount: result.candidate.accountCount,
        signInGroups: site.groups.length, elapsedMs: result.elapsedMs };
    });
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  }
}
