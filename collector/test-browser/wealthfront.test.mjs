import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {withDisposableTestRun} from '../src/disposable-run.mjs';
import {startPilotInScope} from '../src/pilot-session.mjs';
import {repositoryRoot,tempDirectory} from '../test/store-helpers.mjs';
import {normalizeWealthfrontCash} from '../src/wealthfront-normalize.mjs';

test('visible Wealthfront rows survive a persistent balance-popup shell',async t=>{
  const parent=path.join(await tempDirectory(t),'wealthfront-browser');
  await withDisposableTestRun({parent,repositoryRoot},async scope=>{
    const run=await startPilotInScope(scope,{mode:'fictional',headless:true});
    try{
      run.pilot.action({action:'start',acknowledged:true});await run.pilot.settled();
      const page=run.context.pages().find(p=>p!==run.controlPage);
      await page.setContent('<h2>Individual Cash Account</h2><button id="balances">Available balance</button>'+
        '<button class="row"><h2>FICTIONAL TRANSFER</h2><div>-$50.00</div><div>Sep 9, 2031</div><div>$150.00</div></button>'+
        '<button class="row"><h2>FICTIONAL DEPOSIT</h2><div>+$100.00</div><div>Sep 8, 2031</div><div>$200.00</div></button>');
      await page.evaluate(()=>{
        history.replaceState(null,'','/accounts/FICTIONAL-CASH');
        const wrapper=document.createElement('div');wrapper.setAttribute('role','dialog');wrapper.id='activity-wrapper';
        while(document.body.firstChild)wrapper.append(document.body.firstChild);document.body.append(wrapper);
        document.getElementById('balances').onclick=()=>{
          const d=document.createElement('div');d.setAttribute('role','dialog');
          d.innerHTML='<h1>Cash Account balances</h1>'+[['Total balance','$150.00'],['Available','$150.00'],['Unavailable','$0.00'],['Pending','$0.00']]
            .map(([label,value])=>`<div><div><div>${label}</div></div><div>${value}</div></div>`).join('')+'<button aria-label="dismiss">close</button>';
          document.getElementById('activity-wrapper').append(d);
          // Models an exiting portal shell and temporarily obscured rows.
          d.querySelector('button').onclick=()=>{d.textContent='Closing';document.querySelectorAll('.row').forEach(n=>n.style.display='none');};
        };
      });
      await page.evaluate(await fs.readFile(new URL('../chrome-bridge/wealthfront-page-state.js',import.meta.url),'utf8'));
      const c=await page.evaluate(()=>captureWealthfrontCash()),n=normalizeWealthfrontCash(c);
      assert.equal(c.rows.length,2);assert.equal(c.finding,'captured');
      assert.equal(n.activityCaptured,true);assert.equal(n.coverageVerified,true);
      c.available='';const missing=normalizeWealthfrontCash(c);
      assert.equal(missing.activityCaptured,true);assert.equal(missing.coverageVerified,false);
      await page.evaluate(()=>{
        document.querySelector('#activity-wrapper [role="dialog"]').remove();
        document.querySelectorAll('.row').forEach(n=>n.style.display='');
        document.getElementById('balances').remove();
        const heading=document.querySelector('h2'),label=document.createElement('span');label.textContent=heading.textContent;heading.replaceWith(label);
        history.replaceState(null,'','/accounts/FICTIONAL-CASH/cash-activity');
      });
      const activity=normalizeWealthfrontCash(await page.evaluate(()=>captureWealthfrontCash()));
      assert.equal(activity.rows.length,2);assert.equal(activity.activityCaptured,true);assert.equal(activity.coverageVerified,false);
    }catch(e){console.error('Fictional reader test:',e);throw e;}finally{run.stop();await run.done;}
  });assert.deepEqual(await fs.readdir(parent),[]);
});
