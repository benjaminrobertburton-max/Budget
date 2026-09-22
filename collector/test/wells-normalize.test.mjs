import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWellsActivity, normalizationSummary, reconcileWellsOverlap } from '../src/wells-normalize.mjs';
function candidate(rows) {
  return {version:1, kind:'activity_candidate', coverageVerified:false, workbookReady:false,
    finding:'candidate_read', hasFrames:false,
    source:{accountSuffix:'1234',balances:[{type:'available',text:'$100.00'},{type:'ledger',text:'$100.00'}],nextPage:'next_disabled',pageToken:'f1c7a321'},
    layout:{tableCount:1,rowCount:rows.length,headerCount:1,hasShadowRoots:false,tables:[]},
    tables:[{columns:['unknown','date','description','credit','debit','balance'],
      headers:['','Date','Description','Deposits/Credits','Withdrawals/Debits','Ending Daily Balance'],rows,issues:[]}]};
}
const base = [['Pending Transactions'],['No pending transactions to view.'],['Posted Transactions']];
test('Wells help labels retain pending rows and totals cover pending plus posted',()=>{
 const rows=[['Pending Transactions - Opens a dialog'],
 ['Authorized Transactions Opens a dialog Note: Debit card transaction amounts may change.'],
 ['','04/08/2031','FICTIONAL PENDING','','$7',''],['Posted Transactions'],
 ['','04/07/2031','FICTIONAL POSTED','','$2',''],['','Totals','','$0','$9','']];
 const result=normalizeWellsActivity(candidate(rows),'fictional:evidence','2031-04-08T12:00:00Z');
 assert.deepEqual(result.issues,[]);
 assert.deepEqual(result.transactions.map(r=>r.state),['pending','posted']);
 rows.at(-1)[4]='$2';
 assert.ok(normalizeWellsActivity(candidate(rows),'fictional:evidence','2031-04-08T12:00:00Z').issues.includes('source_totals_mismatch'));
 rows[1]=['Unrecognized pending content'];
 assert.ok(normalizeWellsActivity(candidate(rows),'fictional:evidence','2031-04-08T12:00:00Z').issues.includes('unrecognized_row'));
});
test('Wells sections and short dates normalize without leaking private content in summary',()=>{
  const r=normalizeWellsActivity(candidate([...base,['','04/07/31','FICTIONAL SHOP','','$12.34','$80.00'],['','04/07/31','FICTIONAL SHOP','','$12.34','']]),'fictional:evidence','2031-04-08T12:00:00Z');
  assert.equal(r.transactions.length,2); // identical purchases are retained
  assert.equal(r.transactions[0].amountMinor,-1234);
  assert.equal(r.transactions[0].effectiveDate,'2031-04-07');
  assert.deepEqual(r.issues,[]);
  assert.equal(r.workbookReady,false);
  assert.doesNotMatch(JSON.stringify(normalizationSummary(r)),/FICTIONAL SHOP|1234|80.00/);
});
test('ambiguous money, invalid dates, and unexplained rows block rather than disappear',()=>{
  const r=normalizeWellsActivity(candidate([...base,['','04/07/2031','SHOP','$1','$2',''],['','02/30/2031','SHOP','','$2',''],['unrecognized']]),'fictional:evidence','2031-04-08T12:00:00Z');
  assert.equal(r.transactions.length,0);
  assert.deepEqual(r.issues,['ambiguous_amount','invalid_date','unrecognized_row']);
});
test('short year without dated evidence is not inferred',()=>{
 const r=normalizeWellsActivity(candidate([...base,['','04/07/31','SHOP','','$2','']]),'fictional:evidence');
 assert.deepEqual(r.issues,['ambiguous_year']);
});
test('source totals are checked separately and are never parsed as transactions',()=>{
 const rows=[...base,['','04/07/2031','SHOP','','$2',''],['','Totals','','$0','$2','']];
 assert.deepEqual(normalizeWellsActivity(candidate(rows),'fictional:evidence').issues,[]);
 rows.at(-1)[4]='$3';
 assert.deepEqual(normalizeWellsActivity(candidate(rows),'fictional:evidence').issues,['source_totals_mismatch']);
});
test('missing account evidence and pagination remain explicit gates',()=>{
 const value=candidate(base); value.source.accountSuffix=null; value.source.nextPage='next_enabled';
 const r=normalizeWellsActivity(value,'fictional:evidence');
 assert.deepEqual(r.issues,['missing_account_identity','pagination_anchor_required']);
});
test('a saved page overlap permits incremental row detection without a history sweep',()=>{
 const prior=normalizeWellsActivity(candidate([...base,['','04/07/2031','OLD A','','$2',''],['','04/06/2031','OLD B','','$3',''],['','04/05/2031','OLD C','','$4','']]),'old','2031-04-08T12:00:00Z');
 const current=normalizeWellsActivity(candidate([...base,['','04/08/2031','NEW','','$5',''],['','04/07/2031','OLD A','','$2',''],['','04/06/2031','OLD B','','$3',''],['','04/05/2031','OLD C','','$4','']]),'new','2031-04-09T12:00:00Z',{hasPriorAnchor:true});
 const reconciled=reconcileWellsOverlap(current,prior);
 assert.equal(reconciled.overlapVerified,true);
 assert.equal(reconciled.addedRows,1);
 assert.deepEqual(reconciled.issues,[]);
 assert.doesNotMatch(JSON.stringify(normalizationSummary(reconciled)),/OLD A|NEW|\$5/);
});
test('missing overlap blocks incremental collection rather than paging or guessing',()=>{
 const prior=normalizeWellsActivity(candidate([...base,['','04/07/2031','OLD A','','$2',''],['','04/06/2031','OLD B','','$3',''],['','04/05/2031','OLD C','','$4','']]),'old','2031-04-08T12:00:00Z');
 const current=normalizeWellsActivity(candidate([...base,['','04/08/2031','NEW','','$5','']]),'new','2031-04-09T12:00:00Z',{hasPriorAnchor:true});
 assert.match(reconcileWellsOverlap(current,prior).issues.join(','),/anchor_missing_from_current_page/);
});
