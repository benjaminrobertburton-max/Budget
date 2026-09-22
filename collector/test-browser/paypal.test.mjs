import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {withDisposableTestRun} from '../src/disposable-run.mjs';
import {startPilotInScope} from '../src/pilot-session.mjs';
import {repositoryRoot,tempDirectory} from '../test/store-helpers.mjs';
import {fictionalPaypalHtml,fictionalPaypal} from '../fixtures/paypal.mjs';
import {normalizePaypalFinancing} from '../src/paypal-normalize.mjs';
test('financing reader opens only promotion details and detects missing sections in Chrome',async t=>{
  const parent=path.join(await tempDirectory(t),'paypal-browser');
  await withDisposableTestRun({parent,repositoryRoot},async scope=>{
    const run=await startPilotInScope(scope,{mode:'fictional',headless:true});
    try{
      run.pilot.action({action:'start',acknowledged:true});await run.pilot.settled();
      const page=run.context.pages().find(p=>p!==run.controlPage);
      await page.setContent(fictionalPaypalHtml());
      await page.evaluate(()=>document.querySelectorAll('a').forEach(a=>a.append(document.createElement('p'))));
      // The loopback pilot's CSP correctly blocks inline scripts. Install only
      // this invented UI behavior through the test harness, not a bank page.
      await page.evaluate(rows=>document.querySelectorAll('a').forEach(a=>a.onclick=e=>{
        e.preventDefault();const r=rows[Number(a.dataset.card)],d=document.createElement('div');d.setAttribute('role','dialog');
        d.innerHTML='<button>close</button>'+[r.merchant,r.terms,r.amount,'Purchase date',r.purchaseDate,'Purchase amount',r.purchaseAmount,'Remaining balance',r.remainingBalance,'Expiration date',r.expirationDate,'Current accrued interest',r.accruedInterest].map(v=>'<p>'+v+'</p>').join('');
        d.querySelector('button').onclick=()=>d.remove();document.body.append(d);
      }),fictionalPaypal().rows);
      await page.evaluate(()=>history.replaceState(null,'','/myaccount/credit/paypal-credit/us/activities/financing'));
      await page.evaluate(await fs.readFile(new URL('../chrome-bridge/paypal-page-state.js',import.meta.url),'utf8'));
      const c=await page.evaluate(()=>capturePaypalFinancing());
      assert.equal(normalizePaypalFinancing(c).coverageVerified,true);
      assert.equal(await page.locator('[role="dialog"]').count(),0);
      assert.deepEqual(await page.evaluate(()=>capturePaypalFinancing()),c);
      await page.evaluate(()=>document.querySelector('section').remove());
      assert.equal((await page.evaluate(()=>capturePaypalFinancing())).finding,'not_ready');
      await page.setContent('<a href="/myaccount/credit/paypal-credit/us?fictional=1">PayPal Credit Card</a>');
      await page.evaluate(()=>{
        history.replaceState(null,'','/myaccount/summary');
        document.querySelector('a').onclick=e=>{e.preventDefault();document.body.dataset.navigated='yes';};
      });
      assert.equal((await page.evaluate(()=>capturePaypalFinancing())).finding,'not_ready');
      assert.equal(await page.locator('body').getAttribute('data-navigated'),'yes');
      await page.evaluate(()=>{document.body.removeAttribute('data-navigated');document.querySelector('a').href='https://example.invalid/myaccount/credit/paypal-credit/us';});
      await page.evaluate(()=>capturePaypalFinancing());
      assert.equal(await page.locator('body').getAttribute('data-navigated'),null);
    }catch(e){console.error('Fictional browser assertion:',e);throw e;}finally{run.stop();await run.done;}
  });assert.deepEqual(await fs.readdir(parent),[]);
});
