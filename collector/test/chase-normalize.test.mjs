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

test('labeled Chase balances preserve signs and remain private evidence, not cash capacity',()=>{
  const c=fixture();c.source.chase={product:'prime_visa',range:'Activity since last statement',postedFooter:'',pendingObserved:false};
  c.source.balances=[{type:'current_balance',text:'-$12.34'},{type:'remaining_statement_balance',text:'($2.00)'},
    {type:'available_credit',text:'$800.00'}];
  const r=normalizeChaseActivity(c,'fictional');
  assert.deepEqual(r.balances.map(b=>b.sourceAmountMinor),[-1234,-200,80000]);
  assert.equal(r.workbookReady,false);
  assert.doesNotMatch(JSON.stringify(chaseNormalizationSummary(c)),/12\.34|80000|800\.00/);
  c.source.balances[1]={type:'current_balance',text:'$1.00'};
  assert.ok(normalizeChaseActivity(c,'fictional').issues.includes('invalid_balance_evidence'));
});

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

test('independent pending heading must match captured rows; absence is never zero',()=>{
  const c=fixture(undefined,[['Pending','FICTIONAL AUTH','','$1.00','']]);
  c.source.chase={product:'prime_visa',range:'Activity since last statement',postedFooter:'',pendingObserved:true,pendingHeader:'Pending (1)',obligation:'no_payment_due'};
  let r=normalizeChaseActivity(c,'fictional');
  assert.equal(r.pendingCountVerified,true);assert.equal(r.bankPaymentStatus,'no_payment_due');
  assert.ok(r.remainingGates.includes('obligations_unverified')); // no minimum due is not a statement-payoff decision
  assert.equal(r.workbookReady,false);
  c.source.chase.pendingHeader='Pending (2)';r=normalizeChaseActivity(c,'fictional');
  assert.equal(r.pendingCountVerified,false);assert.ok(r.issues.includes('pending_count_mismatch'));
  c.source.chase.pendingHeader='';assert.equal(normalizeChaseActivity(c,'fictional').pendingCountVerified,false);
  c.tables.shift();c.source.chase.pendingHeader='Pending (0)';c.source.chase.pendingObserved=false;
  assert.equal(normalizeChaseActivity(c,'fictional').pendingCountVerified,true);
});

test('independent pending charges reconcile exact signed totals without inferring missing values',()=>{
  const c=fixture(undefined,[['Pending','FICTIONAL A','','$4.00',''],['Pending','FICTIONAL B','','-$1.00','']]);
  c.source.chase={product:'prime_visa',range:'Activity since last statement',postedFooter:'',pendingObserved:true,
    pendingHeader:'Pending (2)',pendingSummary:'Pending (2) Pending charges: $3.00'};
  assert.equal(normalizeChaseActivity(c,'fictional').pendingTotalVerified,true);
  c.source.chase.pendingSummary='Pending (2) Pending charges: $3.01';
  assert.ok(normalizeChaseActivity(c,'fictional').issues.includes('pending_total_mismatch'));
  c.source.chase.pendingSummary='';assert.equal(normalizeChaseActivity(c,'fictional').pendingTotalVerified,false);
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
