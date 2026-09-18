// Fictional visual QA only. The image stays inside its owned disposable run.
// Run with an interactive terminal. Send a newline (or Ctrl+C) after viewing.
// A two-minute fallback closes Chrome and removes all images even without input.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withDisposableTestRun } from "../src/disposable-run.mjs";
import { startPilotInScope } from "../src/pilot-session.mjs";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));
const controller = new AbortController();
const stop = () => controller.abort();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.stdin.once("data", stop);
try {
  await withDisposableTestRun({ repositoryRoot }, async scope => {
    const run = await startPilotInScope(scope, { mode: "fictional", headless: true, signal: controller.signal, durationMs: 120000 });
    await run.controlPage.setViewportSize({ width: 1280, height: 960 });
    await run.controlPage.waitForFunction(() => document.querySelector("#status-badge").textContent === "Not started");
    const filename = path.join(scope.paths.root, "fictional-pilot-preview.png");
    await run.controlPage.screenshot({ path: filename, fullPage: true });
    console.log(JSON.stringify({ fictionalPreview: filename }));
    await run.controlPage.locator("#ack").check();
    await run.controlPage.locator("#start").click();
    await run.controlPage.waitForFunction(() => document.querySelector("#status-badge").textContent === "Your turn");
    await run.controlPage.locator(".diagnostics summary").click();
    await run.controlPage.locator("#inspect").click();
    await run.controlPage.waitForFunction(() => document.querySelector("#outline-count").textContent === "1 / 12");
    const outline = path.join(scope.paths.root, "fictional-outline-preview.png");
    await run.controlPage.screenshot({ path: outline, fullPage: true });
    console.log(JSON.stringify({ fictionalPreview: outline }));
    await run.controlPage.locator(".diagnostics summary").click();
    await run.controlPage.locator("#capture-ack").check();
    await run.controlPage.locator("#capture").click();
    await run.controlPage.waitForFunction(() => document.querySelector("#status-badge").textContent === "Candidate read · unverified");
    await run.controlPage.locator("#review").click();
    await run.controlPage.locator("#private-rows table").waitFor();
    const activity = path.join(scope.paths.root, "fictional-activity-preview.png");
    await run.controlPage.screenshot({ path: activity, fullPage: true });
    console.log(JSON.stringify({ fictionalPreview: activity }));
    await run.controlPage.setViewportSize({ width: 700, height: 900 });
    const narrow = path.join(scope.paths.root, "fictional-narrow-preview.png");
    await run.controlPage.screenshot({ path: narrow, fullPage: true });
    console.log(JSON.stringify({ fictionalPreview: narrow }));
    await run.done;
  });
  console.log("Fictional preview and disposable browser files removed; deletion verified.");
} catch {
  console.error("Fictional preview failed. Use the recovery check if cleanup remains unresolved.");
  process.exitCode = 1;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  process.stdin.removeListener("data", stop);
  process.stdin.pause();
}
