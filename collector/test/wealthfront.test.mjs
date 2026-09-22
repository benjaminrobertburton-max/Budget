import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWealthfrontCash,wealthfrontOverlap,prepareWealthfrontImport} from '../src/wealthfront-normalize.mjs';
const sample=()=>({version:1,kind:'wealthfront_cash',finding:'captured',accountId:'FICTIONAL-CASH',title:'Individual Cash Account',
  total:'$150.00',available:'$150.00',unavailable:'$0.00',pending:'$0.00',rows:[
    {description:'FICTIONAL TRANSFER',amount:'-$50.00',date:'Sep 9, 2031',runningBalance:'$150.00'},
    {description:'FICTIONAL DEPOSIT',amount:'+$100.00',date:'Sep 8, 2031',runningBalance:'$200.00'},
    {description:'FICTIONAL INTEREST',amount:'+$1.00',date:'Sep 1, 2031',runningBalance:'$100.00'}]});
test('first-page balances and exact overlap; missing anchor blocks without paging',()=>{
  const n=normalizeWealthfrontCash(sample());assert.equal(n.coverageVerified,true);
  assert.equal(wealthfrontOverlap(n,n.rows.slice(0,3)),true);
  assert.equal(wealthfrontOverlap(n,[{...n.rows[0],amountMinor:-1}]),false);
  assert.equal(wealthfrontOverlap(n,[n.rows[0],n.rows[0]]),false);
});
for(const [name,change] of [
  ['unsigned amount',c=>c.rows[0].amount='$50.00'],['running balance mismatch',c=>c.rows[1].runningBalance='$201.00'],
  ['missing date',c=>c.rows[0].date=''],['unobserved pending detail',c=>c.pending='$20.00'],
])test(name+' is not silently accepted',()=>{const c=sample();change(c);assert.equal(normalizeWealthfrontCash(c).coverageVerified,false);});

test('workbook boundary requires balanced evidence and an accepted anchor without elapsed expiry',()=>{
  const now=new Date('2031-09-09T12:00:00Z'),payload=sample();
  const item={reference:'local:evidence:11111111-1111-4111-8111-111111111111',record:{version:1,kind:'budget-collector-source-evidence',source:'wealthfront',capturedAt:now.toISOString(),payload}};
  const first=normalizeWealthfrontCash(payload).rows[0];
  const binding={accountId:payload.accountId,initialAnchor:{date:first.date,description:first.description,amountMinor:first.amountMinor}};
  assert.equal(prepareWealthfrontImport(item,binding,null,now).coverageVerified,true);
  assert.equal(prepareWealthfrontImport(item,binding,item.record,now).coverageVerified,true);
  assert.throws(()=>prepareWealthfrontImport(item,{...binding,initialAnchor:{...binding.initialAnchor,amountMinor:1}},null,now),/overlap is missing/);
  assert.equal(prepareWealthfrontImport(item,binding,null,new Date(now.getTime()+86400000)).capturedAt,now.toISOString());
  assert.throws(()=>prepareWealthfrontImport(item,binding,null,new Date(now.getTime()-1)),/valid capture timestamp/);
  const incomplete=structuredClone(item);incomplete.record.payload.available='';
  assert.throws(()=>prepareWealthfrontImport(incomplete,binding,null,now),/balance\/identity checks failed/);
});
