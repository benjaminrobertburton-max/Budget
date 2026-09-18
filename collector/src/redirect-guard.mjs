// Playwright routing alone does not re-run the handler for a server redirect.
// Pause redirect responses BEFORE Chrome follows Location. Never read response
// bodies, request bodies, authentication headers, cookie values or credentials.
// Only status, URL and Location metadata are evaluated in memory, never logged.
export async function createRedirectGuard(context, allowedUrl, onBlocked = () => {}) {
  const prepared = new WeakSet();
  const prepare = async page => {
    const session = await context.newCDPSession(page);
    session.on("Fetch.requestPaused", async event => {
      try {
        let allowed = true;
        if (event.responseStatusCode >= 300 && event.responseStatusCode < 400) {
          const locations = (event.responseHeaders ?? []).filter(header => header.name.toLowerCase() === "location");
          if (locations.length) allowed = locations.length === 1 && allowedUrl(new URL(locations[0].value, event.request.url).href);
        }
        if (allowed) await session.send("Fetch.continueResponse", { requestId: event.requestId });
        else { onBlocked(); await session.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "BlockedByClient" }); }
      } catch {
        // Do not allow a failed guard to fall through to an unrestricted response.
        onBlocked();
        await page.close().catch(() => {});
      }
    });
    await session.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Response" }] });
    prepared.add(page);
  };
  for (const page of context.pages()) await prepare(page);
  // Configure program-created tabs before callers receive them or can navigate.
  // Unexpected popups, workers and child frames remain blocked in this pilot.
  const newPage = context.newPage.bind(context);
  context.newPage = async () => {
    const page = await newPage();
    try { await prepare(page); return page; }
    catch (error) { await page.close().catch(() => {}); throw error; }
  };
  return request => {
    const frame = request.frame();
    return frame.parentFrame() === null && prepared.has(frame.page());
  };
}
