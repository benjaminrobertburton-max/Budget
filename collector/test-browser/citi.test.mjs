import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {withDisposableTestRun} from '../src/disposable-run.mjs';
import {startPilotInScope} from '../src/pilot-session.mjs';
import {repositoryRoot,tempDirectory} from '../test/store-helpers.mjs';
import {fictionalCitiHtml} from '../fixtures/citi.mjs';
import {normalizeCitiActivity} from '../src/citi-normalize.mjs';
test('Citi real content reader in Chrome excludes hidden copies, detects missing totals and authentication',async t=>{
  const parent=path.join(await tempDirectory(t),'citi-browser');
  await withDisposableTestRun({parent,repositoryRoot},async scope=>{
    const run=await startPilotInScope(scope,{mode:'fictional',headless:true});
    try{
      run.pilot.action({action:'start',acknowledged:true});await run.pilot.settled();
      const page=run.context.pages().find(p=>p!==run.controlPage);
      await page.setContent(fictionalCitiHtml());
      await page.evaluate(await fs.readFile(new URL('../chrome-bridge/citi-page-state.js',import.meta.url),'utf8'));
      const capture=()=>page.evaluate(()=>readCitiPage());
      assert.equal(normalizeCitiActivity(await capture(),'fictional').coverageVerified,true);
      await page.evaluate(()=>{
        const filters=['ums-transactionTypeDropdown','ums-cardMemberDropdown'].map(id=>document.getElementById(id));
        filters.forEach(n=>n.style.display='none');
        const button=document.createElement('button');button.id='filter-by-cta';button.textContent='Filter By';
        button.addEventListener('click',()=>filters.forEach(n=>n.style.display=''));document.body.append(button);
      });
      assert.equal(await page.evaluate(()=>revealCitiFilters(readCitiPage())),true);
      assert.equal(normalizeCitiActivity(await capture(),'fictional').coverageVerified,true);
      assert.equal(await page.evaluate(()=>revealCitiFilters(readCitiPage())),false);
      await page.evaluate(()=>{const t=document.querySelector('table').cloneNode(true);t.style.display='none';document.body.append(t);});
      assert.equal(normalizeCitiActivity(await capture(),'fictional').transactions.length,3);
      // Fictional partial first-page layout observed in Citi; no older-page click.
      await page.evaluate(()=>{
        const t=document.querySelector('table.transaction-table');
        const row=t.querySelector('tr.transaction-row:not(.pending)').cloneNode(true);
        row.children[1].textContent='Sep 5, 2031';row.children[2].textContent='FICTIONAL THIRD';row.children[4].textContent='$1.00';t.append(row);
        t.querySelector('tr.total-header:not(.pending) .total-title:last-child').textContent='$100.00';
        const more=document.createElement('button');more.textContent='Load More Transactions';
        more.addEventListener('click',()=>{throw Error('Must not page with anchors present');});document.body.append(more);
      });
      const partial=await capture(),parsed=normalizeCitiActivity(partial,'fictional');
      assert.deepEqual(partial.postedPage,{rowCount:3,hasMore:true});
      const acceptedAnchors={identity:parsed.identity,transactions:parsed.transactions.filter(r=>r.state==='posted')};
      assert.equal(normalizeCitiActivity(partial,'fictional',{acceptedAnchors}).coverageVerified,true);
      assert.equal(parsed.coverageVerified,false);
      await page.evaluate(()=>document.querySelector('tr.pending.total-header').remove());
      assert.equal(normalizeCitiActivity(await capture(),'fictional').coverageVerified,false);
      await page.evaluate(()=>{const p=document.createElement('input');p.type='password';document.body.append(p);});
      assert.equal((await capture()).finding,'auth_required');
    }finally{run.stop();await run.done;}
  });
  assert.deepEqual(await fs.readdir(parent),[]);
});
