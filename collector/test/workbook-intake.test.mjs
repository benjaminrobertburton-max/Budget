import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {prepareWorkbookIntake} from '../src/workbook-intake.mjs';
import {intakeRecords,INTAKE_NOW,INTAKE_BINDINGS} from '../fixtures/workbook-intake.mjs';
import {tempDirectory,fixtureProtector,repositoryRoot} from './store-helpers.mjs';
import {openPrivateEvidenceStore} from '../src/private-evidence-store.mjs';

test('workbook intake preserves source signs and missing pending dates without certifying or classifying rows',()=>{
  const records=intakeRecords(),before=structuredClone(records);
  const r=prepareWorkbookIntake({records,bindings:INTAKE_BINDINGS,now:INTAKE_NOW});
  assert.deepEqual(records,before);assert.equal(r.workbookReady,false);
  assert.equal(r.accounts.length,3);assert.equal(r.rows.length,5);
  assert.deepEqual(r.rows.slice(0,2).map(t=>t.amountMinor),[50000,-2500]);
  assert.equal(r.rows.find(t=>t.state==='pending').date,null);
  assert.equal(r.accounts[2].pendingBasis,'Zero inferred — approved Chase rule');
  assert.equal(r.accounts[1].pendingBasis,'Source count and total matched');
  assert.ok(r.rows.every(r=>r.sourceCategory===null));
});
test('missing source remains missing, not a zero balance or verified empty account',()=>{
  const r=prepareWorkbookIntake({records:{},bindings:INTAKE_BINDINGS,now:INTAKE_NOW});
  assert.ok(r.accounts.every(a=>a.status==='Not captured'&&a.balances.length===0));assert.equal(r.rows.length,0);
});
test('stale, future, wrong-account, normalized-only and malformed evidence is refused',()=>{
  for(const change of [r=>r.wells.record.capturedAt='2031-09-09T12:00:00Z',r=>r.wells.record.capturedAt='2031-09-10T14:00:00Z',
    r=>r.wells.record.payload.source.accountSuffix='9999',r=>r.chase_prime.record.payload.source.chase.product='sapphire_preferred',
    r=>r.chase_prime.record.payload={kind:'chase_normalized_activity',workbookReady:true},
    r=>r.wells.reference='not-private-evidence',r=>r.wells.record.payload.tables[0].rows[3][0]='bad\n'.repeat(1000)]){
    const records=intakeRecords();change(records);
    assert.throws(()=>prepareWorkbookIntake({records,bindings:INTAKE_BINDINGS,now:INTAKE_NOW}));
  }
});
test('malformed amounts stay visible as source exceptions rather than verified ledger omissions',()=>{
  const records=intakeRecords();records.chase_sapphire.record.payload.tables[0].rows[1][2]='bad';
  const r=prepareWorkbookIntake({records,bindings:INTAKE_BINDINGS,now:INTAKE_NOW});
  assert.equal(r.accounts[1].status,'Source checks needed');assert.ok(r.accounts[1].issues.includes('invalid_amount'));
  assert.ok(r.rows.some(row=>row.state==='Unparsed source row'&&row.description.includes('bad')&&row.amountMinor===null));
  assert.equal(r.workbookReady,false);
});
test('private capture selection retains timestamp/reference and separates both Chase bindings',async t=>{
  const root=await tempDirectory(t),store=await openPrivateEvidenceStore({root,repositoryRoot,protector:fixtureProtector()});
  for(const {record} of Object.values(intakeRecords()))await store.save(record);
  await store.save({source:'chase',capturedAt:INTAKE_NOW.toISOString(),payload:{kind:'chase_normalized_activity'}});
  for(const [product,suffix] of [['prime_visa','3333'],['sapphire_preferred','2222']]){
    const result=await store.latestCapture({source:'chase',product,suffix});
    assert.equal(result.record.payload.source.chase.product,product);assert.equal(result.record.capturedAt,INTAKE_NOW.toISOString());
    assert.match(result.reference,/^local:evidence:/);
  }
  assert.equal(await store.latestCapture({source:'wells',suffix:'9999'}),null);
  assert.ok((await fs.readdir(path.join(root,'source-evidence'))).every(n=>n.endsWith('.enc')));
});
