import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChaseActivity, chaseNormalizationSummary } from '../src/chase-normalize.mjs';

function fixture(posted=[['Sep 1, 2031','FICTIONAL SHOP','Shopping','$4.21','']],pending=null) {
  const table=(section,rows)=>({columns:['date','description','unknown','amount','details_control'],
    headers:['Date, not sorted Date','Description, not sorted Description','Category','Amount, not sorted Amount','Action'],
    rows:[[section],...rows],issues:['unknown_columns']});
  return {version:1,kind:'activity_candidate',coverageVerified:false,workbookReady:false,
    finding:'candidate_read',hasFrames:false,
    source:{accountSuffix:null,balances:[],nextPage:'next_unavailable',pageToken:'00000000'},
    layout:{tableCount:pending?2:1,rowCount:1,headerCount:5,hasShadowRoots:false,tables:[]},
    tables:[...(pending?[table('Pending Transactions',pending)]:[]),table('Posted Transactions',posted)]};
}

test('Chase preserves source signs, category, dates and duplicate purchases without ledger assumptions',()=>{
  const row=['09/01/2031','FICTIONAL DUPLICATE','Shopping','$4.21',''];
  const candidate=fixture([row,row,['Aug 31, 2031','FICTIONAL CREDIT','','−$2.87','']],
    [['Pending','FICTIONAL AUTH','Food & drink','$1.11','']]);
  const before=structuredClone(candidate), r=normalizeChaseActivity(candidate,'fictional:evidence');
  assert.deepEqual(candidate,before);
  assert.equal(r.transactions.length,4);
  assert.deepEqual(r.transactions.map(t=>t.sourceAmountMinor),[111,421,421,-287]);
  assert.deepEqual(r.transactions.map(t=>t.sourceDate),[null,'2031-09-01','2031-09-01','2031-08-31']);
  assert.equal(r.transactions[1].sourceCategory,'Shopping');
  assert.equal(r.transactions[3].sourceCategory,'');
  assert.ok(r.transactions.every(t=>t.postedDate===null && t.budgetCategory===null && t.sourceId===null));
  assert.notEqual(r.transactions[1].evidenceRef,r.transactions[2].evidenceRef);
  assert.deepEqual(r.issues,[]);
  assert.ok(r.remainingGates.includes('account_binding_unverified'));
  assert.equal(r.workbookReady,false);
  assert.doesNotMatch(JSON.stringify(chaseNormalizationSummary(candidate)),/FICTIONAL|Shopping|Food|2031|287|421/);
});

test('posted-only Chase capture never means zero pending or verified coverage',()=>{
  const r=normalizeChaseActivity(fixture(),'fictional');
  assert.ok(r.issues.includes('pending_section_not_observed'));
  assert.ok(r.remainingGates.includes('pending_coverage_unverified'));
  assert.ok(r.remainingGates.includes('posted_coverage_unverified'));
  assert.equal(r.coverageVerified,false);
});

for(const date of ['02/30/2031','Sep 31, 2031','09/01/31','','Pending','2031-09-01']) {
  test(`Chase flags unsupported posted date ${JSON.stringify(date)}`,()=>{
    const r=normalizeChaseActivity(fixture([[date,'FICTIONAL','Shopping','$2','']]),'fictional');
    assert.equal(r.rejectedRows,1); assert.equal(r.transactions.length,0);
    assert.ok(r.issues.includes('invalid_or_missing_date'));
  });
}

test('malformed amounts and rows stay counted as exceptions, not silently dropped',()=>{
  const r=normalizeChaseActivity(fixture([
    ['Sep 1, 2031','FICTIONAL','','--$2',''],['Sep 1, 2031','FICTIONAL'],
    ['Sep 1, 2031','','','$2','']]),'fictional');
  assert.equal(r.observedRows,3); assert.equal(r.rejectedRows,3);
  assert.ok(r.issues.includes('invalid_amount'));
  assert.ok(r.issues.includes('unrecognized_row'));
  assert.ok(r.issues.includes('missing_description'));
});

test('unknown or duplicate amount columns and sections cannot normalize silently',()=>{
  for(const mutate of [c=>{c.tables[0].headers[2]='Mystery';},
    c=>{c.tables[0].columns[2]='amount';},c=>{c.tables[0].rows[0]=['Unknown section'];}]) {
    const c=fixture(); mutate(c);
    const r=normalizeChaseActivity(c,'fictional');
    assert.equal(r.transactions.length,0); assert.ok(r.issues.length>0);
  }
  const c=fixture(); c.tables.push(structuredClone(c.tables[0]));
  const r=normalizeChaseActivity(c,'fictional');
  assert.ok(r.issues.includes('ambiguous_section')); assert.equal(r.rejectedRows,1);
});
