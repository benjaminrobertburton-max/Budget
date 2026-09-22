import {parseMoney,sumMinor} from './money.mjs';
import {validDate} from './contracts.mjs';
import {requireEvidence as check} from './errors.mjs';
export function validateWealthfrontCandidate(c){
  check(c?.version===1&&c.kind==='wealthfront_cash'&&['captured','not_ready','blocked'].includes(c.finding)
    &&Object.keys(c).filter(k=>k!=='stage').sort().join(',')==='accountId,available,finding,kind,pending,rows,title,total,unavailable,version'
    &&(c.stage===undefined||['account_page','page_limit','authentication','account_label','activity_rows_missing','activity_row_shape','activity_captured','balance_control_missing','balance_dialog_blocked','balance_dialog_missing','balance_fields_missing'].includes(c.stage))
    &&['accountId','title','total','available','unavailable','pending'].every(k=>typeof c[k]==='string'&&c[k].length<=200)
    &&Array.isArray(c.rows)&&c.rows.length<=100&&c.rows.every(r=>r&&Object.keys(r).sort().join(',')==='amount,date,description,runningBalance'
      &&Object.values(r).every(v=>typeof v==='string'&&v.length<=700)),
  'WEALTHFRONT_SOURCE_INVALID','Wealthfront source contract failed.');return c;
}
function date(s){const m=/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/.exec(s);
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d=m?`${m[3]}-${String(months.indexOf(m[1])+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`:null;return validDate(d)?d:null;}
export function normalizeWealthfrontCash(candidate){
  const c=validateWealthfrontCandidate(candidate),issues=[],rows=[],balances={};
  if(c.finding!=='captured'||c.title!=='Individual Cash Account'||!/^[A-Za-z0-9-]{4,100}$/.test(c.accountId))issues.push('account_not_ready');
  for(const key of ['total','available','unavailable','pending'])try{balances[key]=parseMoney(c[key],'USD');}catch{issues.push('invalid_balance');}
  for(const r of c.rows)try{
    const d=date(r.date);check(d&&r.description&&/^[+\-\u2212]/.test(r.amount),'INVALID_ROW','A source date or explicit sign is missing.');
    rows.push({date:d,description:r.description,amountMinor:parseMoney(r.amount,'USD'),runningMinor:parseMoney(r.runningBalance,'USD')});
  }catch{issues.push('invalid_activity');}
  // Nonzero pending/held funds need observed detail support, not an invented zero
  // or sign interpretation. Keep the raw evidence; block automatic publication.
  if(balances.pending!==0||balances.unavailable!==0)issues.push('pending_or_hold_detail_required');
  if(balances.total!==balances.available||!Number.isSafeInteger(balances.total))issues.push('balance_reconciliation_failed');
  if(!rows.length||rows.length!==c.rows.length||rows[0]?.runningMinor!==balances.total)issues.push('activity_balance_unverified');
  for(let i=0;i<rows.length-1;i++)if(rows[i].date<rows[i+1].date||sumMinor([rows[i+1].runningMinor,rows[i].amountMinor])!==rows[i].runningMinor)issues.push('running_balance_mismatch');
  const activityCaptured=c.finding==='captured'&&c.title==='Individual Cash Account'&&/^[A-Za-z0-9-]{4,100}$/.test(c.accountId)
    &&rows.length>0&&rows.length===c.rows.length&&!issues.includes('invalid_activity');
  return {accountId:c.accountId,rows,balances,activityCaptured,issues:[...new Set(issues)],coverageVerified:issues.length===0};
}
export const wealthfrontRowKey=r=>JSON.stringify([r.date,r.description,r.amountMinor]);
export function wealthfrontOverlap(current,anchors){
  const counts=new Map();for(const r of current.rows){const k=wealthfrontRowKey(r);counts.set(k,(counts.get(k)||0)+1);}
  return anchors.length>0&&anchors.every(r=>{const k=wealthfrontRowKey(r),n=counts.get(k)||0;if(!n)return false;counts.set(k,n-1);return true;});
}
export function prepareWealthfrontImport(item,binding,prior,now){
  check(binding&&Object.keys(binding).sort().join(',')==='accountId,initialAnchor'&&typeof binding.accountId==='string'
    &&/^[A-Za-z0-9-]{4,100}$/.test(binding.accountId)&&binding.initialAnchor
    &&Object.keys(binding.initialAnchor).sort().join(',')==='amountMinor,date,description'&&validDate(binding.initialAnchor.date)
    &&typeof binding.initialAnchor.description==='string'&&binding.initialAnchor.description.length<=700&&Number.isSafeInteger(binding.initialAnchor.amountMinor),
  'WEALTHFRONT_BINDING_REQUIRED','Configure the private account identity and accepted initial anchor.');
  const r=item?.record,age=now.getTime()-Date.parse(r?.capturedAt);
  check(r?.version===1&&r.kind==='budget-collector-source-evidence'&&r.source==='wealthfront'
    &&/^local:evidence:[a-f0-9-]{36}$/.test(item?.reference??'')&&Number.isFinite(age)&&age>=0,
  'WEALTHFRONT_CAPTURE_REQUIRED','Private Wealthfront evidence with a valid capture timestamp is required.');
  const n=normalizeWealthfrontCash(r.payload);
  check(n.coverageVerified&&n.accountId===binding.accountId,'WEALTHFRONT_CAPTURE_FAILED','Wealthfront balance/identity checks failed.');
  let anchors=[binding.initialAnchor];
  if(prior){check(prior.source==='wealthfront','WEALTHFRONT_ANCHOR_INVALID','Prior accepted source is invalid.');
    const p=normalizeWealthfrontCash(prior.payload);check(p.coverageVerified&&p.accountId===n.accountId,'WEALTHFRONT_ANCHOR_INVALID','Prior accepted account is invalid.');anchors=p.rows.slice(0,3);}
  check(wealthfrontOverlap(n,anchors),'WEALTHFRONT_ANCHOR_MISSING','Accepted overlap is missing from the first page; no older history requested.');
  return {...n,evidenceRef:item.reference,capturedAt:r.capturedAt};
}
