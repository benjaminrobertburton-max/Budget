import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileWorkbookLedger,serialDate} from '../src/workbook-reconcile.mjs';
test('loaded older history is checked but not backfilled beyond accepted anchor',()=>{
 const accounts=[['wells','Wells Fargo'],['chase_sapphire','Chase'],['chase_prime','Prime Visa']];
 const ledger=accounts.map(([key,name])=>[name,serialDate('2031-09-08'),'FICTIONAL ANCHOR',5,'Posted','Other','Include',null,key,'','','','Verified']);
 const intake={createdAt:'2031-09-09T12:00:00Z',accounts:accounts.map(([key,label])=>({key,label,capturedAt:'2031-09-09T12:00:00Z',issues:[]})),rows:accounts.flatMap(([key,account])=>[
  {account,state:'posted',date:'2031-09-08',description:'FICTIONAL ANCHOR',amountMinor:key==='wells'?-500:500},
  {account,state:'posted',date:'2031-01-01',description:'UNRELATED OLD ROW',amountMinor:key==='wells'?-200:200},
  {account,state:'pending',date:null,description:'FICTIONAL PENDING',amountMinor:key==='wells'?-300:300}])};
 const r=reconcileWorkbookLedger(intake,ledger,[]);assert.equal(r.added,3);assert.ok(!r.rows.some(row=>row[2]==='UNRELATED OLD ROW'));assert.equal(r.rows.filter(row=>row[4]==='Pending').length,3);
});
