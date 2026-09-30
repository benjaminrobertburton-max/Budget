import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {readWeeklyStatus} from '../src/weekly-status.mjs';
import {tempDirectory} from './store-helpers.mjs';

test('safe status distinguishes reused receipts from fresh collection',async t=>{
  const root=await tempDirectory(t),now=new Date().toISOString();
  await fs.writeFile(path.join(root,'weekly-run-status.json'),JSON.stringify({version:2,pid:process.pid,
    state:'validated',source:null,code:null,updatedAt:now,startedAt:now,elapsedMs:1234,mode:'test',
    outcomes:{wells:{state:'verified',reused:true},chase_prime:{state:'verified'},
      citi:{state:'blocked',code:'CITI_IDENTITY_BLOCKED',privateData:'must not be printed'}}}));
  const status=await readWeeklyStatus(root);
  assert.equal(status.outcomes.wells.reused,true);assert.equal(status.outcomes.chase_prime.reused,false);
  assert.equal(status.elapsedMs,1234);assert.ok(!JSON.stringify(status).includes('privateData'));
});
