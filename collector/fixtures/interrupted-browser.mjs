// Test harness only: intentionally exit without finally after an IPC instruction.
// It can open fictional loopback pages only, never a bank or an existing profile.
import { fileURLToPath } from "node:url";
import { withDisposableTestRun } from "../src/disposable-run.mjs";
import { openFixtureBrowser } from "../src/fixture-browser.mjs";
import { startFixtureSite } from "./browser-site.mjs";

if (!process.send || process.argv.length !== 3) process.exit(2);
const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
try {
  await withDisposableTestRun({ repositoryRoot, parent: process.argv[2] }, async scope => {
    const site = await startFixtureSite();
    scope.registerClose(() => site.close());
    const browser = await openFixtureBrowser(scope, { origin: site.origin });
    const page = browser.context.pages()[0];
    await page.goto(`${site.baseUrl}/start`);
    await scope.saveEvidence({ fictional: true, marker: "INVENTED-CRASH-TEST-ONLY" });
    process.send({ ready: true, pids: browser.processIds() });
    await new Promise(resolve => {
      process.once("message", async message => {
        if (message === "crash") process.exit(17);
        else resolve();
      });
    });
  });
} catch {
  process.send?.({ failed: true });
  process.exitCode = 1;
}
process.disconnect();
