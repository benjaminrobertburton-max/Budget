import test from 'node:test';
import assert from 'node:assert/strict';
import { mapWellsToLedgerStage } from '../src/workbook-ledger-map.mjs';

const base = { overlapVerified:true, issues:[], newTransactions:[] };
test('Wells mapping preserves the legacy expense sign and classifies fixed transfer rules', () => {
  const [row] = mapWellsToLedgerStage({ ...base, newTransactions:[{effectiveDate:'2031-04-08',description:'ONLINE TRANSFER TO CREDIT UNION',amountMinor:-17226,state:'posted',evidenceRef:'local:evidence:fictional:row'}] });
  assert.equal(row.expenseAmount,172.26);
  assert.equal(row.category,'Car reserve / CUTX');
  assert.equal(row.treatment,'Transfer / verify');
  assert.equal(row.verification,'Verified');
  assert.doesNotMatch(JSON.stringify(row),/account number|password/i);
});
test('unknown Wells descriptions never enter spending totals automatically', () => {
  const [row] = mapWellsToLedgerStage({ ...base, newTransactions:[{effectiveDate:'2031-04-08',description:'FICTIONAL UNKNOWN',amountMinor:-1234,state:'pending',evidenceRef:'local:evidence:fictional:row'}] });
  assert.equal(row.expenseAmount,12.34);
  assert.equal(row.treatment,'Needs classification');
  assert.equal(row.verification,'Needs verification');
});
test('missing verified overlap cannot be staged', () => {
  assert.throws(() => mapWellsToLedgerStage({ ...base, overlapVerified:false }), /WELLS_STAGE_BLOCKED/);
});
