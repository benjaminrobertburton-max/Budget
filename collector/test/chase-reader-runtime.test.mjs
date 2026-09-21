import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {validateActivityCandidate} from '../src/activity-probe.mjs';

async function captureFixture({ pending = ['Pending','FICTIONAL A','$1.00',''],
  posted = ['Sep 1, 2031','FICTIONAL B','$2.00',''], single = false,
  duplicateHeader = false, headings = ['Date','Description','Amount','Action'], rangeReadyAfter = 0, elapsedMsPerTick = 0 } = {}) {
  const messages=[], listeners=[], timers=[];
  let elapsedTicks=0;
  const visibleText=innerText=>({innerText,getClientRects:()=>[{}]});
  const row = values => {
    const r={getClientRects:()=>[{}],closest:()=>r};
    r.querySelectorAll=()=>values.map(innerText=>({innerText,closest:()=>r}));
    return r;
  };
  const table = (id,data) => ({id,tagName:'TABLE',getClientRects:()=>[{}],querySelectorAll:()=>[
    row(headings),...(duplicateHeader ? [row(headings)] : []),row(data)],getAttribute:()=>null});
  const tables=[...(single ? [] : [table('PENDING-dataTableId-mds-diy-data-table',pending)]),
    table('ACTIVITY-dataTableId-mds-diy-data-table',posted)];
  const document={documentElement:{},querySelector:()=>null,querySelectorAll:s=>s==='table,[role=table],[role=grid]'?tables:
    s==='a,button,[role=button],[role=link]'?[visibleText('Sign out')]:
    s==='#mds-navigation-bar-exp-heading'?[visibleText('Prime Visa (...1234)')]:
    s==='#select-ACTIVITY-header-selector-label' && elapsedTicks>=rangeReadyAfter?[visibleText('Activity since last statement')]:[]};
  const context={document,Date:{now:()=>elapsedTicks*elapsedMsPerTick},getComputedStyle:()=>({visibility:'visible',display:'table-row'}),
    chrome:{runtime:{sendMessage:async m=>{messages.push(m);},onMessage:{addListener:f=>listeners.push(f)}}},
    MutationObserver:class{observe(){}},setInterval:()=>0,setTimeout:f=>{timers.push(f);return 1;}};
  vm.runInNewContext(await readFile(new URL('../chrome-bridge/chase-page-state.js',import.meta.url),'utf8'),context);
  let ack;
  listeners[0]({command:'capture_chase_activity'},{},v=>{ack=v;});
  assert.equal(ack.accepted,true);
  for(let i=0;timers.length && i<151;i++){elapsedTicks++;timers.shift()();}
  const candidate=JSON.parse(JSON.stringify(messages.find(m=>m.event==='chase_activity_capture').candidate));
  validateActivityCandidate(candidate);
  return candidate;
}

test('Chase waits for the range control after both activity tables render',async()=>{
  const candidate=await captureFixture({rangeReadyAfter:3});
  assert.equal(candidate.source.chase.range,'Activity since last statement');
  assert.equal(candidate.finding,'candidate_read');
});

test('Chase missing range stays unknown after the bounded readiness window',async()=>{
  const candidate=await captureFixture({rangeReadyAfter:999});
  assert.equal(candidate.source.chase.range,'');
  assert.equal(candidate.workbookReady,false);
});

test('Chase wall-clock deadline includes page-scan time, not only retry delays',async()=>{
  const candidate=await captureFixture({rangeReadyAfter:50,elapsedMsPerTick:1000});
  assert.equal(candidate.source.chase.range,''); // stop at 30s, not the 50th expensive scan
  assert.equal(candidate.workbookReady,false);
});

test('Chase recognizes observed repeated sortable headings without altering evidence', async () => {
  const headings=['Date, not sorted\nDate','Description, not sorted\nDescription','Amount, not sorted\nAmount','Action'];
  const candidate=await captureFixture({single:true,headings});
  assert.equal(candidate.finding,'candidate_read');
  assert.deepEqual(candidate.tables[0].columns,['date','description','amount','details_control']);
  assert.deepEqual(candidate.tables[0].headers,headings.map(h=>h.replace(/\s+/g,' ')));
  assert.deepEqual(candidate.tables[0].rows[1],['Sep 1, 2031','FICTIONAL B','$2.00','']);
  assert.equal(candidate.workbookReady,false);
});

test('Chase does not guess mismatched sortable labels', async () => {
  const candidate=await captureFixture({single:true,
    headings:['Date, not sorted Amount','Description','Amount','Action']});
  assert.equal(candidate.finding,'no_activity_table');
  assert.deepEqual(candidate.tables,[]);
});

test('actual Chase content script acknowledges Chrome callbacks and captures both sections', async () => {
  const candidate = await captureFixture();
  assert.equal(candidate.tables.length,2);
  assert.equal(candidate.tables[0].rows[0][0],'Pending Transactions');
  assert.equal(candidate.tables[1].rows[0][0],'Posted Transactions');
});

for (const single of [false, true]) {
  test(`Chase ${single ? 'single' : 'paired'} tables reject an incomplete row`, async () => {
    const candidate = await captureFixture({ single, posted: ['Sep 1, 2031', 'FICTIONAL INCOMPLETE'] });
    assert.equal(candidate.finding, 'no_activity_table');
    assert.deepEqual(candidate.tables, []);
  });
  test(`Chase ${single ? 'single' : 'paired'} tables report overlong text rather than silently cutting evidence`, async () => {
    const candidate = await captureFixture({ single, posted: ['Sep 1, 2031', 'X'.repeat(701), '$2.00', ''] });
    assert.equal(candidate.finding, 'page_limit');
    assert.deepEqual(candidate.tables, []);
  });
  test(`Chase ${single ? 'single' : 'paired'} tables reject ambiguous repeated column headings`, async () => {
    const candidate = await captureFixture({ single, duplicateHeader: true });
    assert.equal(candidate.finding, 'no_activity_table');
    assert.deepEqual(candidate.tables, []);
  });
}

test('Chase preserves exactly-at-limit text and signs without certifying coverage', async () => {
  const candidate = await captureFixture({posted: ['Sep 1, 2031', 'X'.repeat(700), '-$2.00', '']});
  assert.equal(candidate.finding, 'candidate_read');
  assert.equal(candidate.tables[1].rows[1][1].length, 700);
  assert.equal(candidate.tables[1].rows[1][2], '-$2.00');
  assert.equal(candidate.coverageVerified, false);
  assert.equal(candidate.workbookReady, false);
});
