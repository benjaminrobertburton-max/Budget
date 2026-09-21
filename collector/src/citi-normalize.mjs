import {parseMoney} from './money.mjs';
import {validDate} from './contracts.mjs';
import {requireEvidence as check} from './errors.mjs';
const fields=['identity','range','transactionFilter','memberFilter','currentBalance','availableCredit','statementBalance','minimumDue','dueDate','pendingTotal','postedTotal'];
export function validateCitiCandidate(c){
  check(c&&Object.keys(c).sort().join(',')===['version','kind','finding',...fields,'rows','issues'].sort().join(',')
    &&c.version===1&&c.kind==='citi_activity'&&['not_ready','auth_required','page_limit','captured'].includes(c.finding)
    &&fields.every(k=>typeof c[k]==='string'&&c[k].length<=700)
    &&Array.isArray(c.issues)&&c.issues.length<=500&&c.issues.every(s=>['unsupported_headers','unrecognized_row','unsupported_row','row_limit'].includes(s))
    &&Array.isArray(c.rows)&&c.rows.length<=500&&c.rows.every(r=>r&&Object.keys(r).sort().join(',')==='amount,date,description,state'
      &&['posted','pending'].includes(r.state)&&['amount','date','description'].every(k=>typeof r[k]==='string'&&r[k].length<=700)),
    'CITI_SOURCE_INVALID','Citi source contract failed; no private details logged.');
  return c;
}
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function date(s){const m=/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/.exec(s);
  const d=m?`${m[3]}-${String(months.indexOf(m[1])+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`:null;return validDate(d)?d:null;}
export function normalizeCitiActivity(candidate,evidenceRef){
  const c=validateCitiCandidate(candidate),issues=new Set(c.issues),transactions=[],balances=[];
  if(c.finding!=='captured')issues.add(c.finding);
  const identity=/^Citi®\/AAdvantage® Platinum Select® World Elite Mastercard® - (\d{4})$/.exec(c.identity);
  if(!identity)issues.add('account_identity_missing');
  if(!/^Since /.test(c.range)||!date(c.range.slice(6)))issues.add('range_unverified');
  if(c.transactionFilter!=='All'||c.memberFilter!=='All')issues.add('filtered_activity');
  for(const key of ['currentBalance','availableCredit','statementBalance','minimumDue']){
    try{balances.push({type:key,amountMinor:parseMoney(c[key],'USD')});}catch{issues.add('missing_or_invalid_'+key);}
  }
  const dueDate=date(c.dueDate);if(!dueDate)issues.add('due_date_unverified');
  for(const [i,r] of c.rows.entries()){
    const d=date(r.date);if(!d||!r.description){issues.add('invalid_row');continue;}
    try{transactions.push({sourceDate:d,description:r.description,sourceAmountMinor:parseMoney(r.amount,'USD'),state:r.state,evidenceRef:`${evidenceRef}:row-${i}`});}
    catch{issues.add('invalid_row');}
  }
  const totals={};
  for(const state of ['posted','pending']){
    try{const expected=parseMoney(c[state+'Total'],'USD'),actual=transactions.filter(r=>r.state===state).reduce((s,r)=>s+r.sourceAmountMinor,0);
      totals[state]=Number.isSafeInteger(actual)&&actual===expected&&transactions.length===c.rows.length;
    }catch{totals[state]=false;}
    if(!totals[state])issues.add(state+'_total_unverified');
  }
  return {kind:'citi_normalized_activity',identity:identity?{product:'aadvantage',suffix:identity[1]}:null,range:c.range,
    transactions,balances,dueDate,totals,issues:[...issues],coverageVerified:issues.size===0,workbookReady:false};
}
export function citiSummary(n){return {accountIdentified:!!n.identity,postedRows:n.transactions.filter(r=>r.state==='posted').length,
  pendingRows:n.transactions.filter(r=>r.state==='pending').length,balances:n.balances.map(b=>b.type),dueDateVerified:!!n.dueDate,
  totals:n.totals,issues:n.issues,coverageVerified:n.coverageVerified,workbookReady:false};}
export function citiOverlap(current,prior){
  if(!current.coverageVerified)return {status:'blocked',reason:'source_checks',overlapVerified:false};
  if(!prior)return {status:'baseline_only',reason:'first_page_requires_acceptance',overlapVerified:false};
  if(!prior.coverageVerified||JSON.stringify(prior.identity)!==JSON.stringify(current.identity))return {status:'blocked',reason:'account_changed',overlapVerified:false};
  const key=r=>JSON.stringify([r.sourceDate,r.description,r.sourceAmountMinor]),counts=new Map();
  for(const r of current.transactions.filter(r=>r.state==='posted'))counts.set(key(r),(counts.get(key(r))??0)+1);
  const anchors=prior.transactions.filter(r=>r.state==='posted').sort((a,b)=>b.sourceDate.localeCompare(a.sourceDate)).slice(0,3);
  if(!anchors.length)return {status:'blocked',reason:'no_posted_anchor',overlapVerified:false};
  for(const a of anchors){const k=key(a),n=counts.get(k)??0;if(!n)return {status:'blocked',reason:'anchor_missing_from_range',overlapVerified:false};counts.set(k,n-1);}
  return {status:'matched',reason:'posted_overlap_found',overlapVerified:true};
}
