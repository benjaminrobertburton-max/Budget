import test from 'node:test';
import assert from 'node:assert/strict';
import {money,weeklyPromo,monthlyDue} from './build_bill_pay.mjs';

test('blank or ambiguous amounts never become zero',()=>{
  assert.equal(money('$1,234.56'),1234.56);
  assert.equal(money('-$2.50'),-2.5);
  assert.equal(money('$0.00'),0);
  for(const value of ['',null,undefined,'Pending','1.234','12 dollars'])assert.throws(()=>money(value));
});
test('promo final payment precedes deadline, including a Tuesday deadline',()=>{
  assert.equal(weeklyPromo(80,'2027-01-10','2026-11-17'),10);
  assert.equal(weeklyPromo(80,'2026-11-24','2026-11-17'),80);
  assert.equal(weeklyPromo(80,'2026-11-17','2026-11-17'),80);
  assert.equal(weeklyPromo(80,'2026-11-01','2026-11-17'),80);
});
test('rent and car dates roll across months and years',()=>{
  assert.equal(monthlyDue('2026-11-17',1),'2026-12-01');
  assert.equal(monthlyDue('2026-12-01',1),'2026-12-01');
  assert.equal(monthlyDue('2026-12-29',1),'2027-01-01');
  assert.equal(monthlyDue('2026-11-24',26),'2026-11-26');
  assert.equal(monthlyDue('2026-09-29',26),'2026-10-26');
});
