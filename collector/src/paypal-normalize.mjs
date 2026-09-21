import {parseMoney} from './money.mjs';
import {validDate} from './contracts.mjs';
import {requireEvidence as check} from './errors.mjs';
const sections=['Expiring','Active','Paid off'];
const fields=['merchant','terms','amount','purchaseDate','purchaseAmount','remainingBalance','expirationDate','accruedInterest'];
export function validatePaypalCandidate(c){
  check(c?.version===1&&c.kind==='paypal_financing'&&['captured','not_ready','blocked'].includes(c.finding)
    &&Object.keys(c).sort().join(',')==='finding,kind,rows,sections,version'
    &&Array.isArray(c.sections)&&c.sections.length<=3&&c.sections.every(s=>sections.includes(s))
    &&Array.isArray(c.rows)&&c.rows.length<=40&&c.rows.every(r=>r&&Object.keys(r).sort().join(',')===[...fields,'section'].sort().join(',')
      &&sections.includes(r.section)&&fields.every(k=>typeof r[k]==='string'&&r[k].length<=700)),
  'PAYPAL_SOURCE_INVALID','PayPal financing source contract failed.');return c;
}
function date(s){
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const m=/^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(s),i=m?months.indexOf(m[1]):-1;
  const d=i>=0?`${m[3]}-${String(i+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`:null;return validDate(d)?d:null;
}
export function normalizePaypalFinancing(candidate){
  const c=validatePaypalCandidate(candidate),issues=[],rows=[],keys=new Set();
  if(c.finding!=='captured'||JSON.stringify(c.sections)!==JSON.stringify(sections))issues.push('sections_incomplete');
  for(const r of c.rows){
    try{
      const purchaseDate=date(r.purchaseDate),expirationDate=date(r.expirationDate);
      const amountMinor=parseMoney(r.remainingBalance,'USD'),interestMinor=parseMoney(r.accruedInterest,'USD'),purchaseMinor=parseMoney(r.purchaseAmount,'USD');
      const key=JSON.stringify([r.merchant,purchaseDate,expirationDate]);
      check(r.merchant&&purchaseDate&&expirationDate&&purchaseDate<=expirationDate&&amountMinor>=0&&interestMinor>=0&&purchaseMinor>=amountMinor
        &&parseMoney(r.amount,'USD')===amountMinor&&r.terms===`No interest if paid in full by ${r.expirationDate}`
        &&(r.section!=='Paid off'||amountMinor===0)&&!keys.has(key),'PAYPAL_ROW_INVALID','Invalid financing record.');
      keys.add(key);rows.push({merchant:r.merchant,purchaseDate,expirationDate,amountMinor,interestMinor,section:r.section});
    }catch{issues.push('invalid_promotion');}
  }
  if(!rows.length)issues.push('empty_snapshot_requires_review');
  return {rows,issues,coverageVerified:issues.length===0};
}

// Private, explicit purchase-to-workbook bindings: never fuzzy-match debt names.
export function preparePaypalImport(item,bindings,now){
  check(Array.isArray(bindings)&&bindings.length>0&&bindings.length<=40&&bindings.every(b=>b
    &&Object.keys(b).sort().join(',')==='expirationDate,merchant,purchaseDate,workbookMerchant'
    &&typeof b.merchant==='string'&&b.merchant.length>0&&b.merchant.length<=700
    &&typeof b.workbookMerchant==='string'&&b.workbookMerchant.length>0&&b.workbookMerchant.length<=700
    &&validDate(b.purchaseDate)&&validDate(b.expirationDate)),'PAYPAL_BINDINGS_REQUIRED','Configure private promotion bindings.');
  const r=item?.record,age=now.getTime()-Date.parse(r?.capturedAt);
  check(r?.source==='paypal'&&r.version===1&&r.kind==='budget-collector-source-evidence'
    &&/^local:evidence:[a-f0-9-]{36}$/.test(item?.reference??'')&&Number.isFinite(age)&&age>=0&&age<=900000,
  'PAYPAL_CAPTURE_REQUIRED','Fresh private PayPal financing evidence is required.');
  const n=normalizePaypalFinancing(r.payload);
  check(n.coverageVerified,'PAYPAL_CAPTURE_FAILED','PayPal financing is incomplete.');
  const used=new Set(),mapped=bindings.map(b=>{
    const matches=n.rows.filter(p=>p.merchant===b.merchant&&p.purchaseDate===b.purchaseDate&&p.expirationDate===b.expirationDate);
    check(matches.length===1&&!used.has(matches[0]),'PAYPAL_BINDING_MISMATCH','A bound promotion is missing or ambiguous; no paid-off inference.');
    used.add(matches[0]);return {...matches[0],workbookMerchant:b.workbookMerchant};
  });
  check(new Set(mapped.map(p=>p.workbookMerchant)).size===mapped.length&&n.rows.every(p=>used.has(p)||p.section==='Paid off'),
    'PAYPAL_UNMAPPED_PROMOTION','An outstanding promotion needs an explicit workbook binding.');
  return {rows:mapped,evidenceRef:item.reference,capturedAt:r.capturedAt};
}
