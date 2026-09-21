import { requireEvidence as check } from './errors.mjs';
import { normalizeWellsActivity } from './wells-normalize.mjs';
import { normalizeChaseActivity } from './chase-normalize.mjs';

export const INTAKE_ACCOUNTS=Object.freeze([
  {key:'wells',source:'wells',product:null,label:'Wells Fargo'},
  {key:'chase_sapphire',source:'chase',product:'sapphire_preferred',label:'Chase Sapphire'},
  {key:'chase_prime',source:'chase',product:'prime_visa',label:'Prime Visa'},
]);
export function validateIntakeBindings(bindings){
  check(bindings&&typeof bindings==='object'&&!Array.isArray(bindings)
    &&Object.keys(bindings).sort().join(',')===INTAKE_ACCOUNTS.map(a=>a.key).sort().join(',')
    &&Object.values(bindings).every(s=>typeof s==='string'&&/^\d{4}$/.test(s)),
  'INTAKE_BINDINGS_REQUIRED','Configure the three private account suffixes before importing collector evidence.');
  check(bindings.chase_sapphire!==bindings.chase_prime,'INTAKE_BINDINGS_REQUIRED','Chase account bindings must be distinct.');
}

// Source intake is NOT accepted financial history. Re-normalize encrypted RAW
// evidence instead of trusting persisted summaries, staged rows or ready flags.
// Missing dates and classifications remain missing. All current pending stays
// separate; no ledger mutation, inferred posting date or payment completion.
export function prepareWorkbookIntake({records,bindings,now=new Date()}){
  validateIntakeBindings(bindings);
  check(now instanceof Date&&Number.isFinite(now.getTime())&&records&&typeof records==='object'
    &&Object.keys(records).every(k=>INTAKE_ACCOUNTS.some(a=>a.key===k)),
  'INVALID_INTAKE','Collector intake requires a bounded set of source records.');
  const accounts=[],rows=[];
  for(const account of INTAKE_ACCOUNTS){
    const item=records[account.key];
    const base={key:account.key,label:account.label,capturedAt:null,balances:[],posted:null,pending:null,
      pendingBasis:'Unknown',issues:[],evidenceRef:null};
    if(!item){accounts.push({...base,status:'Not captured',issues:['current_capture_missing']});continue;}
    const {record,reference}=item;
    check(/^local:evidence:[a-f0-9-]{36}$/.test(reference??'')&&record?.version===1
      &&record.kind==='budget-collector-source-evidence'&&record.source===account.source,
    'INVALID_INTAKE','The selected evidence record does not match the source contract.');
    const age=now.getTime()-Date.parse(record.capturedAt);
    check(Number.isFinite(age)&&age>=0&&age<=15*60*1000,
      'STALE_INTAKE','Collector evidence is stale or future-dated; collect fresh evidence before importing.');
    const candidate=record.payload;
    check(candidate?.source?.accountSuffix===bindings[account.key]
      &&(account.source==='wells'?!candidate.source.chase:candidate.source.chase?.product===account.product),
    'INTAKE_ACCOUNT_MISMATCH','The captured account does not match its private workbook binding.');
    const normalized=account.source==='wells'
      ?normalizeWellsActivity(candidate,reference,record.capturedAt)
      :normalizeChaseActivity(candidate,reference);
    check(candidate.finding==='candidate_read','INTAKE_CAPTURE_FAILED','A failed page capture cannot enter the workbook.');
    const data=normalized.transactions;
    const pending=data.filter(r=>r.state==='pending');
    const balances=normalized.balances.map(b=>({type:b.type,amountMinor:account.source==='wells'?b.amountMinor:b.sourceAmountMinor}));
    const pendingBasis=account.source==='wells'
      ?normalized.pendingEmpty?'Bank displays no pending':'Captured; coverage needs review'
      :normalized.pendingZeroInferred?'Zero inferred — approved Chase rule'
        :normalized.pendingCountVerified&&normalized.pendingTotalVerified?'Source count and total matched':'Captured; coverage needs review';
    accounts.push({...base,capturedAt:record.capturedAt,balances,posted:data.length-pending.length,
      pending:pending.length,pendingBasis,evidenceRef:reference,
      status:normalized.issues.length?'Source checks needed':'Captured — not imported',
      issues:[...normalized.issues]});
    for(const row of data)rows.push({account:account.label,state:row.state,
      date:account.source==='wells'?row.effectiveDate:row.sourceDate,
      description:row.description,
      // Intake explicitly labels source signs; do not reinterpret card amounts
      // as Wells cash flow or silently assign household categories.
      amountMinor:account.source==='wells'?row.amountMinor:row.sourceAmountMinor,
      sourceCategory:row.sourceCategory??null,evidenceRef:row.evidenceRef,
      note:account.source==='wells'?'Cash-flow sign; not a spending classification':
        row.sourceDate===null?'Source displays Pending; date not supplied':'Source date; posting date not asserted'});
    const parsed=new Set(data.map(row=>row.evidenceRef));
    candidate.tables.forEach((table,ti)=>table.rows.forEach((raw,ri)=>{
      const ref=`${reference}:table-${ti}:row-${ri}`;
      // Keep non-marker source rows that could not be parsed visible for review.
      // This includes source footers/totals; never reinterpret them as purchases.
      if(raw.length>1&&!parsed.has(ref))rows.push({account:account.label,state:'Unparsed source row',date:null,
        description:raw.join(' | '),amountMinor:null,sourceCategory:null,evidenceRef:ref,
        note:'Source row retained verbatim; may be invalid activity or a total/footer. Not imported.'});
    }));
  }
  check(rows.length<=1500,'INTAKE_LIMIT','The captured row count exceeds the supported intake bound.');
  return {version:1,kind:'workbook_collector_intake',workbookReady:false,createdAt:now.toISOString(),
    accounts,rows,remaining:['Reconcile with accepted ledger and pending history',
      'Verify remaining required account sources','Create the new payment plan only after verification']};
}
