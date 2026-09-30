import {fileURLToPath} from 'node:url';
import {weeklyPreflight} from './weekly-preflight.mjs';
import {openPrivateEvidenceStore} from './private-evidence-store.mjs';
import {readWeeklySession} from './weekly-session.mjs';
import {WEEKLY_SOURCES} from './weekly-sequence.mjs';
import {verifySourceCandidate} from './source-verification.mjs';
import {safeIssue} from './errors.mjs';

export async function diagnoseCollector(configFile){
  const started=Date.now(),context=await weeklyPreflight(configFile);
  try{
    const store=await openPrivateEvidenceStore({root:context.privateRoot,repositoryRoot:fileURLToPath(new URL('../../',import.meta.url)),protector:context.protector});
    const session=await readWeeklySession({privateRoot:context.privateRoot,configFile:context.sessionKey,sources:WEEKLY_SOURCES,details:true});
    const sources=[];
    for(const source of WEEKLY_SOURCES){
      try{
        const reference=session.captured?.[source]??session.references?.[source];
        const item=reference?{reference,record:await store.open(reference)}:source==='paypal'?await store.latestPaypalCapture()
          :source==='wealthfront'?await store.latestWealthfrontCapture(context.config.wealthfront.accountId)
          :await store.latestCapture({source:source.startsWith('chase_')?'chase':source,
            product:source==='chase_prime'?'prime_visa':source==='chase_sapphire'?'sapphire_preferred':source==='citi'?'aadvantage':null,suffix:context.config.bindings[source]});
        if(!item){sources.push({source,ok:false,code:'NO_SAVED_CAPTURE'});continue;}
        const v=verifySourceCandidate(source,item,context);
        // UI dictionary tokens describe unexplained single-cell headings only.
        // Everything else is redacted, including unknown words and numbers.
        if(source==='wells'&&v.rowIssues.length){
          const vocabulary=new Set('scheduled bill pay payment payments deposits deposit checks withdrawals authorized transactions received processing electronic holds incoming outgoing opens a dialog'.split(' '));
          v.headingTokens=v.rowIssues.map(r=>({row:r.row,tokens:(item.record.payload.tables[r.table]?.rows[r.row]?.length===1
            ?item.record.payload.tables[r.table].rows[r.row][0].toLowerCase().split(/[^a-z]+/).filter(w=>vocabulary.has(w)):[])}));
        }
        sources.push({...v,receipt:reference?'session':'latest_diagnostic_only'});
      }catch(e){sources.push({source,ok:false,code:safeIssue(null,e).code});}
    }
    return {mode:'offline_diagnostic',elapsedMs:Date.now()-started,workbookWritten:false,sources};
  }finally{await context.release();}
}
