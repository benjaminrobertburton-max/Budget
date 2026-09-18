import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { withDisposableTestRun } from "../src/disposable-run.mjs";
import { startPilotInScope } from "../src/pilot-session.mjs";
import { readActivityCandidate, activitySummary } from "../src/activity-probe.mjs";
import { repositoryRoot, tempDirectory } from "../test/store-helpers.mjs";
import { windowsProtector } from "../src/protection.mjs";

async function fixture(t, task) {
  const parent = path.join(await tempDirectory(t), "activity");
  let assertion;
  try {
    await withDisposableTestRun({ parent, repositoryRoot }, async scope => {
      const run = await startPilotInScope(scope, { mode: "fictional", headless: true });
      try {
        run.pilot.action({ action: "start", acknowledged: true }); await run.pilot.settled();
        const page = run.context.pages().find(page => page !== run.controlPage);
        await task({ run, page, scope });
      } catch (error) { if (error.code === "ERR_ASSERTION") assertion = error; throw error; }
      finally { run.stop(); }
      await run.done;
    });
  } catch (error) { throw assertion ?? error; }
  assert.deepEqual(await fs.readdir(parent), []);
}
const table = (rows, headers = "<th>Date</th><th>Description</th><th>Amount</th><th>Status</th>") =>
  `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;

test("Chrome reads invented activity exactly, encrypts evidence, and shows only an opt-in local preview", async t => {
  await fixture(t, async ({ run, scope }) => {
    await run.controlPage.waitForFunction(() => document.querySelector("#status-badge").textContent === "Your turn");
    assert.equal(await run.controlPage.locator("#capture").isDisabled(), true);
    await run.controlPage.locator("#capture-ack").check();
    await run.controlPage.locator("#capture").click();
    await run.controlPage.waitForFunction(() => document.querySelector("#status-badge").textContent === "Candidate read · unverified");
    assert.equal(await run.controlPage.locator("#private-rows").isVisible(), false);
    assert.doesNotMatch(await run.controlPage.locator("body").innerText(), /FICTIONAL SHOP|7\.43/);
    await run.controlPage.locator("#review").click();
    await run.controlPage.locator("#private-rows table").waitFor();
    assert.match(await run.controlPage.locator("#private-rows").innerText(), /FICTIONAL SHOP/);
    assert.match(await run.controlPage.locator("#private-rows").innerText(), /-\$7\.43/);
    assert.doesNotMatch(JSON.stringify(run.pilot.state()), /FICTIONAL SHOP|7\.43|234\.56|SECRET/);
    const blobs = await Promise.all((await fs.readdir(scope.paths.evidence)).map(name => fs.readFile(path.join(scope.paths.evidence, name))));
    assert.equal(blobs.length, 2);
    for (const blob of blobs) assert.ok(!blob.includes(Buffer.from("FICTIONAL")) && !blob.includes(Buffer.from("7.43")));
    const decoded = await windowsProtector().openMany(blobs);
    const saved = decoded.find(record => record.kind === "pilot_activity");
    assert.deepEqual(saved.candidate.tables[0].rows, [["2031-04-08", "FICTIONAL SHOP", "-$7.43", "Pending"]]);
    assert.doesNotMatch(JSON.stringify(saved), /SECRET|234\.56/);
    await run.controlPage.locator("#review").click();
    assert.equal(await run.controlPage.locator("#private-rows").isVisible(), false);
    assert.equal(await run.controlPage.locator("#private-rows").innerHTML(), "");
  });
});

test("reader preserves signed, split debit-credit, pending and posted text without inventing a meaning or year", async t => {
  await fixture(t, async ({ page }) => {
    await page.setContent(table('<tr><td>Apr 8</td><td>INVENTED REFUND</td><td>($4.62)</td><td>Pending</td></tr><tr><td>Apr 7</td><td>INVENTED SHOP</td><td>-$2.19</td><td>Posted</td></tr>')
      + table('<tr><td>04/06</td><td>INVENTED PAYROLL</td><td>$42.18</td><td></td><td>$84.36</td></tr>',
        '<th>Date</th><th>Description</th><th>Deposits/Additions</th><th>Withdrawals/Subtractions</th><th>Ending daily balance</th>'));
    const candidate = await readActivityCandidate(page);
    assert.equal(candidate.tables.length, 2);
    assert.deepEqual(candidate.tables[0].rows[0], ["Apr 8", "INVENTED REFUND", "($4.62)", "Pending"]);
    assert.deepEqual(candidate.tables[1].columns, ["date", "description", "credit", "debit", "balance"]);
    assert.equal(candidate.tables[1].rows[0][3], "");
    assert.equal(candidate.coverageVerified, false); assert.equal(candidate.workbookReady, false);
    assert.doesNotMatch(JSON.stringify(activitySummary(candidate)), /INVENTED|04\/06|42\.18/);
  });
});

test("password/MFA controls block reading; field values, forms, scripts and hidden rows never become activity text", async t => {
  await fixture(t, async ({ page }) => {
    const rows = '<tr><td>2031-04-08</td><td>FICTIONAL VISIBLE<input value="FORM-SECRET"><span contenteditable>EDITABLE-SECRET</span><script>"SCRIPT-SECRET"</script></td><td>-$1.29</td><td>Posted</td></tr><tr hidden><td>HIDDEN-SECRET</td></tr>';
    for (const input of ['<input type="password" value="PASSWORD-SECRET">', '<input autocomplete="one-time-code" value="OTP-SECRET">', '<input autocomplete="username" value="USERNAME-SECRET">']) {
      await page.setContent(input + table(rows));
      const blocked = await readActivityCandidate(page);
      assert.equal(blocked.finding, "authentication_controls"); assert.deepEqual(blocked.tables, []);
    }
    await page.setContent(table(rows) + `<form>${table('<tr><td>FORM-SECRET</td></tr>')}</form>`);
    await page.evaluate(() => {
      Object.defineProperty(HTMLInputElement.prototype, "value", { get() { throw new Error("DO NOT READ VALUES"); } });
      Object.defineProperty(document.body, "innerText", { get() { throw new Error("DO NOT READ BODY"); } });
    });
    const candidate = await readActivityCandidate(page);
    assert.equal(candidate.tables.length, 1); assert.equal(candidate.tables[0].rows.length, 1);
    assert.deepEqual(candidate.tables[0].issues.sort(), ["hidden_rows", "interactive_cells"]);
    assert.equal(candidate.tables[0].rows[0][1], "FICTIONAL VISIBLE");
    assert.doesNotMatch(JSON.stringify(candidate), /SECRET/);
  });
});

test("unknown layout, long cells, row limits and spans are explicit exceptions, never a coverage pass", async t => {
  await fixture(t, async ({ page }) => {
    await page.setContent(table('<tr><td>Invented</td></tr>', '<th>Unknown</th><th>Unknown</th><th>Unknown</th>'));
    assert.equal((await readActivityCandidate(page)).finding, "no_activity_table");
    await page.setContent(table('<tr><td>2031-04-08</td><td>' + "x".repeat(800) + '</td><td>-$1.29</td><td>Posted</td></tr>'));
    let candidate = await readActivityCandidate(page);
    assert.ok(candidate.tables[0].issues.includes("truncated"));
    assert.equal(candidate.tables[0].rows[0][1].length, 700);
    await page.setContent(table('<tr><td>2031-04-08</td><td>INVENTED</td><td>-$1.29</td><td>Posted</td></tr>'.repeat(501)));
    candidate = await readActivityCandidate(page);
    assert.equal(candidate.tables[0].rows.length, 500); assert.ok(candidate.tables[0].issues.includes("truncated"));
    await page.setContent(table('<tr><td colspan="2">INVENTED NOTICE</td><td>Unknown</td></tr>'));
    candidate = await readActivityCandidate(page);
    assert.ok(candidate.tables[0].issues.includes("uneven_rows")); assert.ok(candidate.tables[0].issues.includes("spanned_cells"));
    assert.equal(candidate.coverageVerified, false);
    await page.setContent("<span></span>".repeat(12001));
    assert.equal((await readActivityCandidate(page)).finding, "page_limit");
  });
});

test("accessible grids are read but nested tables and embedded frames are not mistaken for complete activity", async t => {
  await fixture(t, async ({ page }) => {
    await page.setContent('<div role="grid"><div role="row"><span role="columnheader">Date</span><span role="columnheader">Description</span><span role="columnheader">Amount</span></div><div role="row"><span role="gridcell">2031-04-08</span><span role="gridcell">INVENTED</span><span role="gridcell">-$1.29</span></div></div><iframe></iframe>');
    const candidate = await readActivityCandidate(page);
    assert.equal(candidate.tables.length, 1); assert.deepEqual(candidate.tables[0].columns, ["date", "description", "amount"]);
    assert.equal(candidate.hasFrames, true); assert.equal(candidate.coverageVerified, false);
  });
});

test("sortable heading labels and section headings do not prevent a private activity read", async t => {
  await fixture(t, async ({ page }) => {
    // Generic structure observed in the user's demonstration; all values invented.
    const headings = '<th>Expand or collapse details info</th><th><button>Date<span> sorted in descending order</span></button></th>'
      + '<th><button>Description<span> sort in descending order</span></button></th>'
      + '<th><button>Deposits/Credits sort in descending order</button></th>'
      + '<th><button>Withdrawals/Debits sort in descending order</button></th><th>Ending Daily Balance</th>';
    const rows = '<tr><th colspan="6">Pending Transactions</th></tr><tr><td colspan="6">No pending transactions to view.</td></tr>'
      + '<tr><th colspan="6">Posted Transactions</th></tr>'
      + '<tr><td><button>Expand Row1</button></td><td>04/08/31</td><td>INVENTED STORE</td><td></td><td>$3.17</td><td>$91.28</td></tr>';
    await page.setContent('<div style="height:4000px">Invented tall banner</div>' + table(rows, headings));
    let candidate = await readActivityCandidate(page);
    assert.equal(candidate.finding, "candidate_read");
    assert.deepEqual(candidate.tables[0].columns, ["details_control", "date", "description", "credit", "debit", "balance"]);
    assert.equal(candidate.layout.tables[0].headerRows, 3);
    assert.equal(candidate.tables[0].rows[0][0], "Pending Transactions");
    assert.equal(candidate.tables[0].rows[1][0], "No pending transactions to view.");
    assert.deepEqual(candidate.tables[0].rows[3], ["", "04/08/31", "INVENTED STORE", "", "$3.17", "$91.28"]);
    assert.equal(candidate.coverageVerified, false);
    assert.ok(candidate.tables[0].issues.includes("spanned_cells"));
    const original = candidate.tables;
    await page.evaluate(() => { document.body.style.zoom = "0.3"; window.scrollTo(0, document.body.scrollHeight); });
    candidate = await readActivityCandidate(page);
    assert.deepEqual(candidate.tables, original);
    assert.doesNotMatch(JSON.stringify(activitySummary(candidate)), /INVENTED|91\.28|04\/08/);
  });
});

test("diagnostics explain rejected tables without exporting labels, values or identifiers", async t => {
  await fixture(t, async ({ page }) => {
    await page.setContent(table('<tr><td>PRIVATE-FICTIONAL-ROW</td></tr>', '<th>PRIVATE-FICTIONAL-HEADER</th><th>Description</th><th>Amount</th>')
      + '<form>' + table('<tr><td>PRIVATE-FICTIONAL-FORM</td></tr>') + '</form>');
    const candidate = await readActivityCandidate(page);
    assert.equal(candidate.finding, "no_activity_table");
    assert.deepEqual(candidate.layout.tables.map(item => item.reason), ["unsupported_columns", "form_excluded"]);
    assert.deepEqual(candidate.layout.tables[0].columns, ["unknown", "description", "amount"]);
    assert.doesNotMatch(JSON.stringify(activitySummary(candidate)), /PRIVATE-FICTIONAL/);
    await page.setContent(table('<tr><th>Date</th><th>Description</th><th>Amount</th></tr>', '<th>Date</th><th>Description</th><th>Amount</th>'));
    const ambiguous = await readActivityCandidate(page);
    assert.equal(ambiguous.finding, "no_activity_table");
    assert.equal(ambiguous.layout.tables[0].reason, "ambiguous_headers");
  });
});
