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

test('posted-only Chase capture without complete account context remains unknown',()=>{
  const r=normalizeChaseActivity(fixture(),'fictional');
  assert.ok(r.issues.includes('pending_section_not_observed'));
  assert.ok(r.remainingGates.includes('pending_coverage_unverified'));
  assert.ok(r.remainingGates.includes('posted_coverage_unverified'));
  assert.equal(r.coverageVerified,false);
});

test('independent pending heading must match captured rows',()=>{
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

function completePrime() {
  const c=fixture();
  c.source.accountSuffix='1234';c.source.nextPage='next_disabled';
  c.source.chase={product:'prime_visa',range:'Activity since last statement',
    postedFooter:"You've reached the end of your account activity.",pendingObserved:false,
    pendingHeader:'',pendingSummary:''};
  c.source.balances=[{type:'current_balance',text:'$4.21'},
    {type:'remaining_statement_balance',text:'$0.00'},{type:'available_credit',text:'$800.00'}];
  return c;
}

for(const product of ['prime_visa','sapphire_preferred'])test(`${product} absent-pending layout uses explicit user-approved zero provenance`,()=>{
  const c=completePrime();c.source.chase.product=product;
  const before=structuredClone(c),r=normalizeChaseActivity(c,'fictional');
  assert.deepEqual(c,before);assert.equal(r.pendingZeroInferred,true);
  assert.deepEqual(r.pendingInference,{rule:'user_approved_chase_absent_pending',count:0,amountMinor:0,evidenceRef:'fictional'});
  assert.equal(r.pendingCountVerified,false);assert.equal(r.pendingTotalVerified,false);
  assert.deepEqual(r.issues,[]);assert.ok(!r.remainingGates.includes('pending_coverage_unverified'));
  assert.ok(r.remainingGates.includes('posted_coverage_unverified'));
  assert.ok(r.remainingGates.includes('account_binding_unverified'));
  assert.equal(r.workbookReady,false);assert.equal(r.coverageVerified,false);
  const summary=chaseNormalizationSummary(c);assert.equal(summary.pendingZeroInferred,true);
  assert.doesNotMatch(JSON.stringify(summary),/1234|800|fictional|4\.21/);
});

test('Chase zero exception never masks unidentified accounts, incomplete pages or contradictory evidence',()=>{
  const changes=[c=>c.source.chase.product=null,
    c=>c.source.accountSuffix=null,c=>c.source.chase.range='',c=>c.source.chase.postedFooter='',
    c=>c.source.nextPage='next_unavailable',c=>c.source.balances.pop(),
    c=>c.source.balances[0].text='bad',c=>c.source.chase.pendingObserved=true,
    c=>c.source.chase.pendingHeader='Pending (1)',c=>c.source.chase.pendingHeader='Unrecognized pending',
    c=>delete c.source.chase.pendingHeader,c=>delete c.source.chase.pendingSummary,
    c=>c.source.chase.pendingSummary='Pending (1) Pending charges: $1.00',
    c=>c.tables[0].rows[1][3]='bad',c=>c.tables[0].rows.pop(),
    c=>c.tables[0].issues.push('truncated'),c=>c.tables.push(structuredClone(c.tables[0])),
    c=>{c.finding='authentication_controls';c.tables=[];},
    c=>{c.finding='no_activity_table';c.tables=[];},c=>{c.finding='page_limit';c.tables=[];}];
  for(const change of changes){const c=completePrime();change(c);const r=normalizeChaseActivity(c,'fictional');
    assert.equal(r.pendingZeroInferred,false,change.toString());assert.equal(r.pendingInference,null);
    assert.ok(r.remainingGates.includes('pending_coverage_unverified'));
  }
});

for(const product of ['prime_visa','sapphire_preferred'])test(`${product} actual pending activity overrides the absent-section exception`,()=>{
  const c=completePrime();c.source.chase.product=product;
  c.tables.unshift(fixture(undefined,[['Pending','FICTIONAL AUTH','','$1.00','']]).tables[0]);
  c.source.chase.pendingObserved=true;c.source.chase.pendingHeader='Pending (1)';
  c.source.chase.pendingSummary='Pending (1) Pending charges: $1.00';
  let r=normalizeChaseActivity(c,'fictional');assert.equal(r.pendingZeroInferred,false);
  assert.equal(r.pendingCountVerified,true);assert.equal(r.pendingTotalVerified,true);
  assert.equal(r.transactions.filter(t=>t.state==='pending').length,1);
  c.source.chase.pendingSummary='Pending (1) Pending charges: $2.00';r=normalizeChaseActivity(c,'fictional');
  assert.ok(r.issues.includes('pending_total_mismatch'));assert.equal(r.pendingZeroInferred,false);
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
