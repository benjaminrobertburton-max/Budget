import {createHash} from 'node:crypto';
import {requireEvidence as check} from './errors.mjs';

export const LEDGER_ACCOUNTS={wells:'Wells Fargo',chase_sapphire:'Chase',chase_prime:'Prime Visa',citi:'Citi'};
export const serialDate=iso=>(Date.parse(iso+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000;
export const isoDate=value=>value instanceof Date?value.toISOString().slice(0,10):typeof value==='number'
  ?new Date(Date.UTC(1899,11,30)+value*86400000).toISOString().slice(0,10):null;
const text=value=>String(value??'').trim().replace(/\s+/g,' ').toUpperCase();
const cents=value=>Math.round(value*100);
const signature=(date,description,amount)=>JSON.stringify([date,text(description),amount]);
const sourceDate=row=>String(row[8]??'').startsWith('collector|')?row[8].split('|')[3]||null:isoDate(row[1]);
const oldSignature=row=>signature(sourceDate(row),row[2],cents(row[3]));

function classify(description,category,rules,oldRows){
  const exact=rules.filter(r=>text(r[0])===text(description)&&r[1]&&r[2]);
  const past=oldRows.filter(r=>text(r[2])===text(description)&&r[12]==='Verified').map(r=>[null,r[5],r[6]]);
  const fallback=category?rules.filter(r=>text(r[3])===text(category)&&r[4]&&r[5]).map(r=>[null,r[4],r[5]]):[];
  const candidates=exact.length?exact:past.length?past:fallback;
  const choices=new Set(candidates.map(r=>JSON.stringify([r[1],r[2]])));
  return choices.size===1?JSON.parse([...choices][0]):['Needs classification','Needs classification'];
}

// The authoritative workbook is the accepted baseline. Exact multiset matching
// keeps identical purchases distinct; pending is a fresh snapshot, not another
// set of expenses appended on every run. Never infer a cancellation or a date.
export function reconcileWorkbookLedger(intake,ledger,rules){
  check([3,4].includes(intake?.accounts?.length)&&['wells','chase_sapphire','chase_prime'].every(k=>intake.accounts.some(a=>a.key===k))
    &&new Set(intake.accounts.map(a=>a.key)).size===intake.accounts.length&&intake.accounts.every(a=>a.capturedAt&&LEDGER_ACCOUNTS[a.key]),
    'MISSING_CAPTURE','Fresh captures for all configured accounts are required.');
  check(intake.accounts.every(a=>a.issues.every(i=>i==='pagination_anchor_required')),
    'SOURCE_CHECK_FAILED','Source parsing or coverage checks must be resolved before import.');
  check(intake.rows.every(r=>['posted','pending'].includes(r.state)&&Number.isSafeInteger(r.amountMinor)),
    'SOURCE_CHECK_FAILED','Unparsed source rows cannot enter the accepted ledger.');
  const rows=structuredClone(ledger),reports=[];let added=0,promoted=0,retired=0;
  for(const account of intake.accounts){
    const name=LEDGER_ACCOUNTS[account.key];
    const previous=rows.map((r,i)=>({r,i})).filter(x=>x.r[0]===name);
    const oldPosted=previous.filter(x=>x.r[4]==='Posted');
    const oldPending=previous.filter(x=>x.r[4]==='Pending');
    const incoming=intake.rows.filter(r=>r.account===account.label).map(r=>({...r,
      expense:account.key==='wells'?-r.amountMinor:r.amountMinor}));
    const posted=incoming.filter(r=>r.state==='posted');
    const available=new Map();
    for(const r of posted){const key=signature(r.date,r.description,r.expense);available.set(key,(available.get(key)??0)+1);}
    const anchors=oldPosted.filter(x=>x.r[12]==='Verified').sort((a,b)=>(sourceDate(b.r)??'').localeCompare(sourceDate(a.r)??'')).slice(0,3);
    check(anchors.length>0||posted.length===0&&oldPosted.length===0,'MISSING_ACCEPTED_ANCHOR','The workbook needs its first accepted account anchor before automatic merging.');
    for(const {r} of anchors){const key=oldSignature(r),count=available.get(key)??0;
      check(count>0,'ANCHOR_MISSING','An accepted posted anchor is absent; do not guess or duplicate history.');available.set(key,count-1);}
    // Missing/edited posted rows in the observed overlap must not disappear.
    const oldest=posted.map(r=>r.date).sort()[0],counts=new Map();
    for(const r of posted){const k=signature(r.date,r.description,r.expense);counts.set(k,(counts.get(k)??0)+1);}
    for(const {r} of oldPosted.filter(x=>sourceDate(x.r)>=oldest)){
      const k=oldSignature(r),n=counts.get(k)??0;check(n>0,'POSTED_HISTORY_CHANGED','Accepted activity is missing or changed in the captured overlap.');counts.set(k,n-1);
    }
    const used=new Set(),occurrences=new Map(),scope={posted:[],pending:[]};
    const anchorStart=anchors.map(x=>sourceDate(x.r)).filter(Boolean).sort()[0];
    const acceptedSignatures=new Set(oldPosted.map(x=>oldSignature(x.r)));
    for(const r of incoming){
      // Inspect all loaded rows above, but do not backfill unrelated old history.
      if(r.state==='posted'&&anchorStart&&r.date<anchorStart
        &&!acceptedSignatures.has(signature(r.date,r.description,r.expense)))continue;
      const sig=signature(r.date,r.description,r.expense),group=r.state+'|'+sig;
      const occurrence=(occurrences.get(group)??0)+1;occurrences.set(group,occurrence);
      const hash=createHash('sha256').update(sig).digest('hex').slice(0,20);
      const id=`collector|${account.key}|${r.state}|${r.date??''}|${hash}|${occurrence}`;
      const pool=r.state==='posted'?oldPosted:oldPending;
      let match=pool.find(x=>!used.has(x.i)&&x.r[8]===id)
        ??pool.find(x=>!used.has(x.i)&&oldSignature(x.r)===sig);
      let ambiguous=false;
      if(!match){
        const pendingMatches=oldPending.filter(x=>!used.has(x.i)&&text(x.r[2])===text(r.description)&&cents(x.r[3])===r.expense);
        if(pendingMatches.length===1){
          const previousDate=isoDate(pendingMatches[0].r[1]);
          if(previousDate&&r.date&&previousDate!==r.date)ambiguous=true;
          else match=pendingMatches[0];
        }
        else if(pendingMatches.length>1)ambiguous=true;
      }
      const row=match?structuredClone(match.r):Array(13).fill(null);
      const [category,treatment]=match&&row[5]&&row[5]!=='Needs classification'&&['Include','Exclude','Transfer / verify'].includes(row[6])
        ?[row[5],row[6]]:classify(r.description,r.sourceCategory,rules,previous.map(x=>x.r));
      const date=match&&isoDate(row[1])?isoDate(row[1]):r.date;
      const verified=!!date&&!ambiguous&&category!=='Needs classification';
      const archive=`${account.evidenceRef}:${r.state}`;
      row[0]=name;row[1]=date?serialDate(date):null;row[2]=r.description;row[3]=r.expense/100;
      row[4]=r.state==='posted'?'Posted':'Pending';row[5]=category;row[6]=treatment;row[8]=id;
      // Preserve user notes; replace only the prior collector suffix on replay.
      row[9]=String(row[9]??'').split('\nCollector:')[0]+`\nCollector: source date ${r.date??'not supplied'}; ${r.evidenceRef}${ambiguous?'; ambiguous prior pending match':''}`;
      row[10]=archive;row[11]=r.state==='posted'?'Posted transactions':'Pending transactions';row[12]=verified?'Verified':'Needs verification';
      if(match){used.add(match.i);if(match.r[4]==='Pending'&&r.state==='posted')promoted++;rows[match.i]=row;scope[r.state].push(match.i);}
      else{rows.push(row);scope[r.state].push(rows.length-1);added++;}
    }
    for(const {r,i} of oldPending)if(!used.has(i)){
      rows[i]=[...r];rows[i][4]='Previous pending';rows[i][12]='Superseded';
      rows[i][8]=String(r[8])+'|retired|'+intake.createdAt;
      rows[i][9]=String(r[9]??'')+'\nCollector: absent from the fresh pending snapshot; posting/cancellation not asserted.';retired++;
    }
    reports.push({...account,scope,needsReview:[...scope.posted,...scope.pending].some(i=>rows[i][12]!=='Verified')});
  }
  check(rows.length<=10000,'LEDGER_LIMIT','The ledger exceeds the supported import size.');
  return {rows,reports,added,promoted,retired};
}
