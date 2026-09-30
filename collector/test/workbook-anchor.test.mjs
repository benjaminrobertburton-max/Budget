import test from 'node:test';
import assert from 'node:assert/strict';
import {chaseWorkbookAnchors,serialDate} from '../src/workbook-reconcile.mjs';
test('Chase paging anchors come from newest verified posted workbook rows, not display order or pending',()=>{
  const row=(date,label,amount,state='Posted',verified='Verified')=>[
    'Prime Visa',serialDate(date),label,amount,state,'','','','','','','',verified];
  const rows=[row('2031-09-01','FICTIONAL OLDER',1),row('2031-09-03','FICTIONAL REFUND',-2.34),
    row('2031-09-02','FICTIONAL MID',3),row('2031-09-04','FICTIONAL PENDING',4,'Pending'),
    row('2031-09-05','FICTIONAL UNVERIFIED',5,'Posted','Needs review')];
  const original=structuredClone(rows),result=chaseWorkbookAnchors(rows,{chase_prime:'1234',chase_sapphire:'5678'});
  assert.deepEqual(result.chase_prime.transactions.map(r=>r.sourceDate),['2031-09-03','2031-09-02','2031-09-01']);
  assert.equal(result.chase_prime.transactions[0].sourceAmountMinor,-234);
  assert.deepEqual(result.chase_prime.identity,{product:'prime_visa',suffix:'1234'});
  assert.equal(result.chase_sapphire,null);assert.deepEqual(rows,original);
});
