import test from 'node:test';
import assert from 'node:assert/strict';
import {money,weeklyPromo,monthlyDue,applyLevelPayoff} from './build_bill_pay.mjs';
import {Workbook} from '@oai/artifact-tool';

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

function levelFixture(rows){
  const wb=Workbook.create(),p=wb.worksheets.add('Pay This Week'),s=wb.worksheets.add('Bills & Settings');
  s.getRange('B4').values=[[46000]];
  s.getRange(`A36:C${35+rows.length}`).values=rows;
  p.getRange('B16').formulas=[[`='Bills & Settings'!E${36+rows.length}`]];
  p.getRange('B20').values=[[0]];p.getRange('C11').values=[['Done']];
  applyLevelPayoff(wb);return {s,p};
}
test('level payment meets cumulative deadlines without summing parallel rates',()=>{
  const {s,p}=levelFixture([['Late',800,46070],['Early',200,46014]]);
  assert.equal(p.getRange('B16').values[0][0],100);
  assert.equal(s.getRange('A36').values[0][0],'Early');
  assert.equal(s.getRange('E36').values[0][0],100);
  assert.equal(s.getRange('E37').values[0][0],0);
  assert.equal(p.getRange('C11').values[0][0],'Done');
  assert.equal(p.getRange('C18').values[0][0],'Scheduled');
  assert.equal(p.getRange('C19').values[0][0],'Scheduled');
});
test('an earlier deadline can determine the steady payment',()=>{
  const {p}=levelFixture([['Early',250,46007],['Later',750,46070]]);
  assert.equal(p.getRange('B16').values[0][0],250);
});
test('payment rolls into the next promo and rounds up enough to cover cents',()=>{
  const {s,p}=levelFixture([['First',5,46007],['Second',95.01,46070]]);
  assert.equal(p.getRange('B16').values[0][0],10.01);
  assert.equal(s.getRange('E36').values[0][0],5);
  assert.ok(Math.abs(s.getRange('E37').values[0][0]-5.01)<1e-8);
});
