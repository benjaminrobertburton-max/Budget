import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileChaseOverlap,createChaseAnchorSession,chaseOverlapSummary} from '../src/chase-overlap.mjs';
const row=(description,state='posted')=>({description,state,sourceDate:'2031-09-01',sourceAmountMinor:123});
const capture=(names,extra={})=>({kind:'chase_normalized_activity',identity:{product:'prime_visa',suffix:'1234'},
  range:'Activity since last statement',nextPage:'next_enabled',pageToken:'a0000001',rejectedRows:0,issues:[],
  transactions:names.map(n=>row(n)),...extra});
test('first-page overlap stops even when more historical activity is available',()=>{
  const prior=capture(['A','B','C']);
  const current=capture(['NEW','C','A','B']); // out of order, no date cutoff
  current.transactions.push(row('PENDING','pending'));
  const r=reconcileChaseOverlap(current,prior);
  assert.equal(r.action,'stop');assert.equal(r.overlapVerified,true);
  assert.deepEqual(r.unmatchedPosted.map(t=>t.description),['NEW']);
  assert.equal(r.currentPending.length,1);
  assert.doesNotMatch(JSON.stringify(chaseOverlapSummary(r)),/NEW|PENDING|1234/);
});
test('first run stops at a proposed first-page baseline instead of sweeping history',()=>{
  assert.equal(reconcileChaseOverlap(capture(['A','B','C']),null).action,'baseline_only');
});
test('anchor matching counts repeated transactions separately',()=>{
  const p=capture(['A','A','B']);
  assert.equal(reconcileChaseOverlap(capture(['A','B','C']),p).action,'load_more');
  assert.equal(reconcileChaseOverlap(capture(['A','A','B','A']),p).unmatchedPosted.length,1);
});
test('pending snapshot is never subtracted against prior pending or matched to posted',()=>{
  const p=capture(['A','B','C']);p.transactions.push(row('NEW','pending'));
  const c=capture(['NEW','A','B','C']);c.transactions.push(row('NEW','pending'),row('NEW','pending'));
  const r=reconcileChaseOverlap(c,p);
  assert.equal(r.unmatchedPosted.length,1);assert.equal(r.currentPending.length,2);
});
test('different cards, missing identity, rejected rows and missing range block',()=>{
  const p=capture(['A','B','C']);
  for(const patch of [{identity:null},{identity:{product:'sapphire_preferred',suffix:'1234'}},
    {identity:{product:'prime_visa',suffix:'5678'}},{rejectedRows:1},{range:null}]) {
    assert.equal(reconcileChaseOverlap(capture(['A','B','C'],patch),p).action,'blocked');
  }
  assert.equal(reconcileChaseOverlap(p,p,{expectedProduct:'sapphire_preferred'}).code,'requested_account_mismatch');
});
test('missing anchor at end of selected range blocks rather than guessing history',()=>{
  assert.equal(reconcileChaseOverlap(capture(['NEW'],{nextPage:'next_disabled'}),capture(['A','B','C'])).code,'anchor_missing_from_selected_range');
});
test('bounded cumulative paging requests more only until posted overlap is present',()=>{
  const plan=createChaseAnchorSession(capture(['A','B','C']));
  assert.equal(plan(capture(['NEW'])).action,'load_more');
  assert.equal(plan(capture(['NEW','A','B','C'],{pageToken:'a0000002'})).action,'stop');
  assert.equal(plan(capture(['NEW','A','B','C'])).code,'collection_already_finished');
});
test('stalled, replaced, changed-account and excessive pages fail closed',()=>{
  for(const [patch,code,names] of [[{},'load_more_stalled',['NEW']],
    [{pageToken:'a0000002'},'posted_rows_changed_during_paging',['OTHER']],
    [{pageToken:'a0000002',range:'Different'},'source_changed_during_paging',['NEW']],
    [{pageToken:'a0000002'},'anchor_page_limit',['NEW','OTHER']]]) {
    const plan=createChaseAnchorSession(capture(['A','B','C']),{maxMore:1});
    assert.equal(plan(capture(['NEW'])).action,'load_more');
    assert.equal(plan(capture(names,patch)).code,code);
  }
});
