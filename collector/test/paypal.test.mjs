import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fictionalPaypal,fictionalPaypalBindings} from '../fixtures/paypal.mjs';
import {normalizePaypalFinancing,preparePaypalImport,validatePaypalCandidate} from '../src/paypal-normalize.mjs';
const now=new Date('2031-09-09T15:00:00Z');
const item=c=>({reference:`local:evidence:${randomUUID()}`,record:{version:1,kind:'budget-collector-source-evidence',source:'paypal',capturedAt:now.toISOString(),payload:c}});
test('financing parses balances, dates, paid off and explicit bindings',()=>{
  const c=fictionalPaypal(),n=normalizePaypalFinancing(c);assert.equal(n.coverageVerified,true);assert.equal(n.rows[3].amountMinor,0);
  assert.equal(preparePaypalImport(item(c),fictionalPaypalBindings(),now).rows.length,4);
});
for(const [name,mutate] of [
  ['missing section',c=>c.sections.pop()],['invalid date',c=>c.rows[0].expirationDate='February 30, 2031'],
  ['missing interest',c=>c.rows[0].accruedInterest=''],['wrong card detail',c=>c.rows[0].remainingBalance='$81.00'],
  ['false paid off',c=>c.rows[0].section='Paid off'],['duplicate promotion',c=>c.rows.push({...c.rows[0]})],
])test(name+' blocks verification',()=>{const c=fictionalPaypal();mutate(c);assert.equal(normalizePaypalFinancing(c).coverageVerified,false);});
test('promotion bindings remain required; saved captures do not expire and future times block',()=>{
  const c=fictionalPaypal();c.rows.pop();assert.throws(()=>preparePaypalImport(item(c),fictionalPaypalBindings(),now),{code:'PAYPAL_BINDING_MISMATCH'});
  assert.throws(()=>preparePaypalImport(item(fictionalPaypal()),fictionalPaypalBindings().slice(1),now),{code:'PAYPAL_UNMAPPED_PROMOTION'});
  assert.equal(preparePaypalImport(item(fictionalPaypal()),fictionalPaypalBindings(),new Date(now.getTime()+86400000)).capturedAt,now.toISOString());
  assert.throws(()=>preparePaypalImport(item(fictionalPaypal()),fictionalPaypalBindings(),new Date(now.getTime()-1)),{code:'PAYPAL_CAPTURE_REQUIRED'});
  assert.throws(()=>validatePaypalCandidate({...fictionalPaypal(),password:'forbidden'}),{code:'PAYPAL_SOURCE_INVALID'});
});
