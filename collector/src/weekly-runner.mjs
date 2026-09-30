import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {startChromeBridge} from './chrome-bridge.mjs';
import {openPrivateEvidenceStore} from './private-evidence-store.mjs';
import {CollectionError,requireEvidence as check,safeIssue} from './errors.mjs';
import {createWeeklySequence,WEEKLY_SOURCES} from './weekly-sequence.mjs';
import {weeklyPreflight} from './weekly-preflight.mjs';
import {readWeeklySession,saveWeeklySession,clearWeeklySession} from './weekly-session.mjs';
import {verifySourceCandidate} from './source-verification.mjs';
import {terminalCaptureProgressCode} from './weekly-refresh.mjs';

const repositoryRoot=fileURLToPath(new URL('../../',import.meta.url));
const sourceCommand={wells:'open_wells',chase_prime:'open_chase_prime',chase_sapphire:'open_chase_sapphire',
  citi:'capture_citi_activity',paypal:'capture_paypal_financing',wealthfront:'capture_wealthfront_cash'};
const bankOf=source=>source?.startsWith('chase_')?'chase':source;

export async function runWeeklyRefresh({configFile,signal,timeoutMs=30*60*1000,sourceTimeoutMs=90_000,authTimeoutMs=5*60*1000,
  mode='import',onStatus=()=>{},startBridge=startChromeBridge,importWorkbook,openResult=()=>{},
  preflight=weeklyPreflight,openStore=openPrivateEvidenceStore}={}){
  check(typeof configFile==='string'&&path.isAbsolute(configFile),'PRIVATE_CONFIG_REQUIRED','Choose the private collector configuration.');
  check(Number.isInteger(timeoutMs)&&timeoutMs>=60_000&&timeoutMs<=30*60*1000,'INVALID_TIMEOUT','The run timeout is invalid.');
  check(['import','test'].includes(mode),'INVALID_RUN_MODE','Choose import or test.');
  const started=Date.now(),runId=randomUUID(),startedAt=new Date(started).toISOString(),outcomes={};
  let context,bridge,sequence,store,sourceTimer,timer,abortHandler,active=true,inFlight=Promise.resolve(),lastSource=null,authWaiting=false;
  let settle;const completion=new Promise((resolve,reject)=>{settle={resolve,reject};});completion.catch(()=>{});
  const chasePlans=new Map(),captured={},references={},failures={};
  const emit=event=>onStatus({...event,source:Object.hasOwn(event,'source')?event.source:lastSource,runId,startedAt,elapsedMs:Date.now()-started,mode,outcomes:structuredClone(outcomes)});
  const persist=()=>saveWeeklySession({privateRoot:context.privateRoot,configFile:context.sessionKey,sources:WEEKLY_SOURCES,
    completed:WEEKLY_SOURCES.filter(s=>references[s]),references,captured});
  const fatal=code=>{active=false;settle.reject(new CollectionError(code,'Collection stopped; private receipts are retained.'));};
  const serial=(source,fn)=>{
    const result=inFlight.then(()=>active&&sequence.current()===source?fn():undefined)
      .catch(error=>{fatal(safeIssue(null,error).code);});
    inFlight=result;return result;
  };
  const watch=(authentication=false)=>{
    clearTimeout(sourceTimer);authWaiting=authentication;
    const source=sequence.current();
    if(source)sourceTimer=setTimeout(()=>{void serial(source,()=>fail(source,authentication?'AUTHENTICATION_REQUIRED':'SOURCE_RESPONSE_TIMEOUT'));},authentication?authTimeoutMs:sourceTimeoutMs);
  };
  const advance=()=>{
    clearTimeout(sourceTimer);authWaiting=false;
    const next=sequence.current();
    if(next){lastSource=next;outcomes[next]={state:'collecting'};emit({state:'collecting',source:next});watch();bridge.queue(sourceCommand[next],{replace:true});}
    else settle.resolve();
  };
  const fail=async(source,code,details={})=>{
    failures[source]=code;outcomes[source]={state:'blocked',code,...details};lastSource=source;
    sequence.defer(source);await persist();emit({state:'collecting',source,code});advance();
  };
  const receive=(source,candidate)=>serial(source,async()=>{
    const at=new Date().toISOString(),reference=await store.save({source:bankOf(source),capturedAt:at,payload:candidate});
    captured[source]=reference;await persist();
    const item={reference,record:{version:1,kind:'budget-collector-source-evidence',source:bankOf(source),capturedAt:at,payload:candidate}};
    const v=verifySourceCandidate(source,item,context,{chasePlans});
    if(v.nextPageToken){outcomes[source]={state:'collecting',code:v.code};watch();return {nextPageToken:v.nextPageToken};}
    const detail={issues:v.issues,rowIssues:v.rowIssues,posted:v.posted,pending:v.pending,overlap:v.overlap};
    if(!v.ok)return fail(source,v.code,detail);
    references[source]=reference;sequence.complete(source);outcomes[source]={state:'verified',...detail};
    await persist();emit({state:'collecting',source});advance();
  });
  try{
    context=await preflight(configFile);
    store=await openStore({root:context.privateRoot,repositoryRoot,protector:context.protector});
    let resumed;
    try{resumed=await readWeeklySession({privateRoot:context.privateRoot,configFile:context.sessionKey,sources:WEEKLY_SOURCES,details:true});}
    catch{
      resumed=await readWeeklySession({privateRoot:context.privateRoot,configFile,sources:WEEKLY_SOURCES,details:true});
      check(resumed.references===null,'WEEKLY_SESSION_INVALID','The saved session belongs to a different workbook.');
    }
    Object.assign(captured,resumed.captured);
    for(const source of resumed.completed){
      if(!captured[source]){
        const saved=source==='paypal'?await store.latestPaypalCapture():source==='wealthfront'?await store.latestWealthfrontCapture(context.config.wealthfront.accountId)
          :await store.latestCapture({source:bankOf(source),product:source==='chase_prime'?'prime_visa':source==='chase_sapphire'?'sapphire_preferred':source==='citi'?'aadvantage':null,suffix:context.config.bindings[source]});
        check(saved,'RESUME_EVIDENCE_MISSING','A saved source has no bound evidence.');captured[source]=saved.reference;
      }
    }
    // Replay receipts from this exact workbook session before requesting a bank.
    for(const source of WEEKLY_SOURCES.filter(s=>captured[s])){
      const item={reference:captured[source],record:await store.open(captured[source])};
      check(item.record.source===bankOf(source),'RESUME_IDENTITY_MISMATCH','Saved source differs.');
      const v=verifySourceCandidate(source,item,context);
      if(v.ok){references[source]=captured[source];outcomes[source]={state:'verified',reused:true,issues:[],overlap:v.overlap};}
      else if(resumed.completed.includes(source))throw new CollectionError('RESUME_EVIDENCE_INVALID','An accepted source no longer passes verification.');
    }
    sequence=createWeeklySequence(WEEKLY_SOURCES,WEEKLY_SOURCES.filter(s=>references[s]));
    await persist();
    if(sequence.current()){
      lastSource=sequence.current();outcomes[lastSource]={state:'collecting'};
      bridge=await startBridge({nextCommand:sourceCommand[lastSource],captureAfterAuth:'wells',requireRequestId:true,
        onProgress:value=>{
          const source=sequence.current();if(!active||!source)return;
          if(value.event==='extension_build_mismatch'){fatal('EXTENSION_BUILD_MISMATCH');return;}
          if(value.source&&value.source!==bankOf(source))return;
          if(/(?:^auth_required$|_auth_required$|_authentication_required$)/.test(value.event)){
            if(!authWaiting)watch(true);outcomes[source]={state:'waiting_for_sign_in'};emit({state:'waiting_for_sign_in',source});return;
          }
          if(/authenticated_page$/.test(value.event)&&authWaiting){watch();outcomes[source]={state:'collecting'};emit({state:'collecting',source});return;}
          const code=terminalCaptureProgressCode(source,value.event)
            ??(/(?:_delivery_failed|_capture_rejected|_evidence_save_failed|_tab_ambiguous|_navigation_blocked|_reader_unavailable)$/.test(value.event)?value.event.toUpperCase():null);
          if(code)void serial(source,()=>fail(source,code));
        },
        onActivityCapture:c=>receive('wells',c),
        onChaseActivityCapture:c=>{const s=sequence.current();return ['chase_prime','chase_sapphire'].includes(s)?receive(s,c):undefined;},
        onCitiActivityCapture:c=>receive('citi',c),onPaypalCapture:c=>receive('paypal',c),onWealthfrontCapture:c=>receive('wealthfront',c)});
      emit({state:'collecting',source:sequence.current()});watch();
      abortHandler=()=>fatal('REFRESH_CANCELLED');signal?.addEventListener('abort',abortHandler,{once:true});if(signal?.aborted)abortHandler();
      timer=setTimeout(()=>fatal('REFRESH_TIMEOUT'),timeoutMs);await completion;await inFlight;
    }
    clearTimeout(timer);clearTimeout(sourceTimer);active=false;
    if(Object.keys(failures).length)lastSource=WEEKLY_SOURCES.find(s=>failures[s]);
    check(Object.keys(failures).length===0,'SOURCES_INCOMPLETE','Some sources need attention; verified sources are saved.');
    check(!signal?.aborted,'REFRESH_CANCELLED','Collection cancelled before publication.');
    sequence.beginImport();emit({state:mode==='test'?'validating':'importing'});await context.assertUnchanged?.();
    const apply=importWorkbook??((file,options)=>import('../../work/collector_workbook.mjs').then(m=>m.runWorkbookIntake(file,{apply:true,...options})));
    const result=await apply(configFile,{evidenceReferences:references,validateOnly:mode==='test'});
    if(mode==='import')await clearWeeklySession({privateRoot:context.privateRoot});
    sequence.imported();emit({state:mode==='test'?'validated':'complete',source:null});
    if(mode==='import')try{openResult(result.output);}catch{emit({state:'complete',code:'PREVIEW_OPEN_FAILED'});}
    return {status:mode==='test'?'validated':'complete',output:result.output,backup:result.backup,completedSources:sequence.status().completed};
  }catch(error){emit({state:'blocked',source:lastSource,code:safeIssue(null,error).code});throw error;}
  finally{
    active=false;clearTimeout(timer);clearTimeout(sourceTimer);if(abortHandler)signal?.removeEventListener('abort',abortHandler);
    await inFlight.catch(()=>{});if(bridge)await bridge.close().catch(()=>{});await context?.release();
  }
}
