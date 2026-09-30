import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fictionalCiti} from '../fixtures/citi.mjs';
import {normalizeCitiActivity,citiOverlap,validateCitiCandidate} from '../src/citi-normalize.mjs';
import {runCitiWorkTest} from '../src/citi-work-test.mjs';
import {fixtureProtector,repositoryRoot,tempDirectory} from './store-helpers.mjs';
const normalize=c=>normalizeCitiActivity(c,'fictional');
test('Citi preserves posted/pending signs, payment facts and repeated anchors',()=>{
  const n=normalize(fictionalCiti());assert.equal(n.coverageVerified,true);assert.equal(n.transactions[2].sourceAmountMinor,-200);
  assert.equal(n.dueDate,'2031-10-01');assert.equal(citiOverlap(n,null).status,'baseline_only');assert.equal(citiOverlap(n,n).overlapVerified,true);
});
test('Citi rejects missing pending evidence, partial totals, wrong filters and ambiguous dates',()=>{
  for(const change of [c=>c.pendingTotal='',c=>c.postedTotal='$99.00',c=>c.transactionFilter='Purchases',c=>c.identity='Unidentified',c=>c.rows[0].date='Sep 8',c=>c.issues.push('unrecognized_row')]){
    const c=fictionalCiti();change(c);assert.equal(normalize(c).coverageVerified,false);
  }
  const c=fictionalCiti();c.rows=c.rows.filter(r=>r.state==='posted');c.pendingTotal='$0.00';assert.equal(normalize(c).coverageVerified,true);
});
test('Citi duplicate occurrences and missing/account-changed anchors fail closed',()=>{
  const c=fictionalCiti();c.rows.push({...c.rows[1]});c.postedTotal='$22.00';const prior=normalize(c);
  assert.equal(citiOverlap(normalize(fictionalCiti()),prior).overlapVerified,false);
  const other=fictionalCiti();other.identity=other.identity.replace('1234','5678');assert.equal(citiOverlap(normalize(other),normalize(fictionalCiti())).reason,'account_changed');
  assert.throws(()=>validateCitiCandidate({...fictionalCiti(),secret:'not allowed'}));
});

test('Citi incremental scope requires exact authoritative anchors and complete pending; global total stays unverified',()=>{
  const c=fictionalCiti();c.rows.push({date:'Sep 5, 2031',description:'FICTIONAL THIRD',amount:'$1.00',state:'posted'});
  c.postedTotal='$11.00';
  const prior=normalize(c),acceptedAnchors={identity:prior.identity,transactions:prior.transactions.filter(r=>r.state==='posted')};
  c.postedTotal='$100.00';c.postedPage={rowCount:3,hasMore:true};
  const n=normalizeCitiActivity(c,'fictional',{acceptedAnchors});
  assert.equal(n.coverageVerified,true);assert.equal(n.totals.posted,false);assert.equal(n.totals.pending,true);
  assert.equal(n.postedBasis,'accepted_workbook_overlap');assert.equal(n.workbookReady,false);
  assert.equal(normalize(c).coverageVerified,false);
  for(const mutate of [x=>x.postedPage.hasMore=false,x=>x.postedPage.rowCount=2,x=>x.pendingTotal='$6.00',
    x=>x.postedTotal='',x=>x.transactionFilter='Purchases',x=>x.rows[1].amount='$11.00',
    x=>x.rows[2].description='FICTIONAL CHANGED',x=>x.issues.push('unrecognized_row')]){
    const changed=structuredClone(c);mutate(changed);
    assert.equal(normalizeCitiActivity(changed,'fictional',{acceptedAnchors}).coverageVerified,false);
  }
  const wrong=structuredClone(acceptedAnchors);wrong.identity.suffix='9999';
  assert.equal(normalizeCitiActivity(c,'fictional',{acceptedAnchors:wrong}).coverageVerified,false);
  const duplicate=structuredClone(acceptedAnchors);duplicate.transactions[2]=duplicate.transactions[1];
  assert.equal(normalizeCitiActivity(c,'fictional',{acceptedAnchors:duplicate}).coverageVerified,false);
});
test('Citi local bridge requires session, repeats capture, encrypts and removes test evidence',async t=>{
  const parent=path.join(await tempDirectory(t),'citi');
  const result=await runCitiWorkTest({repositoryRoot,parent,protector:fixtureProtector(),port:0,onReady:async({port})=>{
    const base=`http://127.0.0.1:${port}`,origin='chrome-extension://abcdefghijklmnopabcdefghijklmnop';
    assert.equal((await fetch(base+'/v1/citi-activity',{method:'POST',body:JSON.stringify(fictionalCiti())})).status,403);
    const {session}=await(await fetch(base+'/v1/session',{method:'POST',headers:{Origin:origin,'X-Budget-Collector-Build':'0.4.30'}})).json();
    const headers={Origin:origin,'X-Budget-Collector-Session':session,'Content-Type':'application/json'};
    for(let i=0;i<2;i++){
      assert.equal((await(await fetch(base+'/v1/command',{headers})).json()).command,'capture_citi_activity');
      assert.equal((await fetch(base+'/v1/citi-activity',{method:'POST',headers,body:JSON.stringify(fictionalCiti())})).status,204);
    }
  }});
  assert.equal(result.status,'captured_and_repeated');assert.equal(result.workbookReady,false);assert.deepEqual(await fs.readdir(parent),[]);
});
