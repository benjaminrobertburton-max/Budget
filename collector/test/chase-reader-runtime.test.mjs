import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {validateActivityCandidate} from '../src/activity-probe.mjs';

test('actual Chase content script acknowledges Chrome callbacks and captures both sections', async () => {
  const messages=[], listeners=[];
  const row = values => {
    const r={getClientRects:()=>[{}],closest:()=>r};
    r.querySelectorAll=()=>values.map(innerText=>({innerText,closest:()=>r}));
    return r;
  };
  const table = (id,data) => ({id,tagName:'TABLE',querySelectorAll:()=>[
    row(['Date','Description','Amount','Action']),row(data)],getAttribute:()=>null});
  const tables=[table('PENDING-dataTableId-mds-diy-data-table',['Pending','FICTIONAL A','$1.00','']),
    table('ACTIVITY-dataTableId-mds-diy-data-table',['Sep 1, 2031','FICTIONAL B','$2.00',''])];
  const document={documentElement:{},querySelector:()=>null,querySelectorAll:s=>s==='table,[role=table],[role=grid]'?tables:
    s==='a,button,[role=button],[role=link]'?[{innerText:'Sign out',getClientRects:()=>[{}]}]:[]};
  const context={document,getComputedStyle:()=>({visibility:'visible',display:'table-row'}),
    chrome:{runtime:{sendMessage:async m=>{messages.push(m);},onMessage:{addListener:f=>listeners.push(f)}}},
    MutationObserver:class{observe(){}},setInterval:()=>0,setTimeout:()=>0};
  vm.runInNewContext(await readFile(new URL('../chrome-bridge/chase-page-state.js',import.meta.url),'utf8'),context);
  let ack;
  listeners[0]({command:'capture_chase_activity'},{},v=>{ack=v;});
  assert.equal(ack.accepted,true);
  const candidate=JSON.parse(JSON.stringify(messages.find(m=>m.event==='chase_activity_capture').candidate));
  validateActivityCandidate(candidate);
  assert.equal(candidate.tables.length,2);
  assert.equal(candidate.tables[0].rows[0][0],'Pending Transactions');
  assert.equal(candidate.tables[1].rows[0][0],'Posted Transactions');
});
