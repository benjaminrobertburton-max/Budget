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

function windowFixture(){
 const accounts=[['wells','Wells Fargo'],['chase_sapphire','Chase'],['chase_prime','Prime Visa']];
 const ledger=accounts.flatMap(([key,name])=>[8,7,6].map(day=>[name,serialDate(`2031-09-0${day}`),`ANCHOR ${day}`,5,'Posted','Other','Include',null,`${key}-${day}`,'Keep note','old evidence','Posted transactions','Verified']));
 const intake={createdAt:'2031-09-09T12:00:00Z',accounts:accounts.map(([key,label])=>({key,label,capturedAt:'2031-09-09T12:00:00Z',issues:[]})),rows:accounts.flatMap(([key,account])=>[8,7,6].map(day=>({account,state:'posted',date:`2031-09-0${day}`,description:`ANCHOR ${day}`,amountMinor:key==='wells'?-500:500})))};
 const old=(description,day=1,status='Posted')=>['Chase',serialDate(`2031-09-0${day}`),description,2,status,'Other','Include',null,description,'Historical note','old evidence',status,'Verified'];
 return {ledger,intake,old};
}

test('older missing, renamed and matching posted history stays unchanged; no old backfill on replay',()=>{
 const {ledger,intake,old}=windowFixture();
 const history=[old('OLDER PAGE BOUNDARY',2),old('OLD LABEL',3),old('UNCHANGED',4)];ledger.push(...history);
 for(const [date,description] of [['2031-09-02','OTHER PAGE ROW'],['2031-09-03','BANK LABEL'],['2031-09-04','UNCHANGED']])intake.rows.push({account:'Chase',state:'posted',date,description,amountMinor:200});
 const original=structuredClone(ledger),result=reconcileWorkbookLedger(intake,ledger,[]);
 assert.deepEqual(ledger,original);assert.deepEqual(result.rows.slice(-3),history);assert.equal(result.added,0);
 const replay=reconcileWorkbookLedger(intake,result.rows,[]);assert.equal(replay.added,0);assert.deepEqual(replay.rows.slice(-3),history);
});

test('missing or changed posted history within the anchor window still blocks, including boundary duplicates',()=>{
 for(const [description,day,verified] of [['EXTRA BOUNDARY',6,true],['ANCHOR 6',6,true],['NEWER UNVERIFIED',9,false]]){
  const {ledger,intake,old}=windowFixture(),row=old(description,day);row[3]=5;if(!verified)row[12]='Needs verification';ledger.push(row);
  assert.throws(()=>reconcileWorkbookLedger(intake,ledger,[]),{code:'POSTED_HISTORY_CHANGED'});
 }
 const {ledger,intake}=windowFixture();intake.rows=intake.rows.filter(r=>!(r.account==='Chase'&&r.description==='ANCHOR 7'));
 assert.throws(()=>reconcileWorkbookLedger(intake,ledger,[]),{code:'ANCHOR_MISSING'});
});

test('all current pending and posting behind anchors remain in scope and replay without duplicates',()=>{
 const {ledger,intake,old}=windowFixture();ledger.push(old('LATE POST',2,'Pending'));
 intake.rows.push({account:'Chase',state:'posted',date:'2031-09-02',description:'LATE POST',amountMinor:200},
  {account:'Chase',state:'pending',date:null,description:'NEW PENDING',amountMinor:300});
 const result=reconcileWorkbookLedger(intake,ledger,[]);assert.equal(result.promoted,1);assert.equal(result.added,1);
 assert.equal(result.rows.filter(r=>r[2]==='LATE POST').length,1);assert.equal(result.rows.find(r=>r[2]==='LATE POST')[4],'Posted');
 assert.equal(result.rows.filter(r=>r[4]==='Pending').length,1);
 const replay=reconcileWorkbookLedger(intake,result.rows,[]);assert.equal(replay.added,0);assert.equal(replay.promoted,0);
 assert.deepEqual(replay.reports.find(r=>r.key==='chase_sapphire').scope.posted.slice().sort(),result.reports.find(r=>r.key==='chase_sapphire').scope.posted.slice().sort());
});
