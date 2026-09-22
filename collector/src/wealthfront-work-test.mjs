import {withDisposableTestRun} from './disposable-run.mjs';
import {startChromeBridge} from './chrome-bridge.mjs';
import {normalizeWealthfrontCash,wealthfrontOverlap} from './wealthfront-normalize.mjs';
import {fileURLToPath} from 'node:url';
// Temporary first-page/repeat check only. No workbook publication or accepted-anchor advancement.
export async function runWealthfrontWorkTest({repositoryRoot,parent,protector,port=43811,signal,durationMs=120000,onReady=()=>{}}={}){
  if(!Number.isInteger(durationMs)||durationMs<1||durationMs>120000)throw new Error('INVALID_TEST_DURATION');
  return withDisposableTestRun({repositoryRoot,parent,protector},async scope=>{
    await scope.saveEvidence({kind:'wealthfront_preflight',financialData:false});
    let finish,prior=null,closed=false,busy=false,result={status:'timeout',workbookReady:false};
    const done=new Promise(r=>{finish=r;}),stop=r=>{if(!closed){closed=true;result=r;finish();}};
    const timer=setTimeout(()=>stop(result),durationMs),abort=()=>stop({status:'cancelled',workbookReady:false});
    signal?.addEventListener('abort',abort,{once:true});scope.registerClose(async()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);});
    const bridge=await startChromeBridge({port,nextCommand:'capture_wealthfront_cash',onWealthfrontCapture:async candidate=>{
      if(closed||busy)return;busy=true;
      try{
        const n=normalizeWealthfrontCash(candidate);await scope.saveEvidence({kind:'wealthfront_test_capture',candidate});
        if(!n.activityCaptured){stop({status:'blocked',stage:candidate.stage??'unknown',loadedRows:n.rows.length,issues:n.issues,workbookReady:false});return;}
        if(!prior){prior=n;return {repeat:true};}
        const matched=n.accountId===prior.accountId&&wealthfrontOverlap(n,prior.rows.slice(0,3));
        stop({status:matched?'captured_and_repeated':'anchor_missing',stage:candidate.stage??'unknown',loadedRows:n.rows.length,balancesVerified:n.coverageVerified,issues:n.issues,olderPagesRequested:0,workbookReady:false});
      }catch{stop({status:'capture_failed',workbookReady:false});}finally{busy=false;}
    }});
    scope.registerClose(()=>bridge.close());if(signal?.aborted)abort();await onReady();await done;return result;
  });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const controller=new AbortController(),abort=()=>controller.abort();process.once('SIGINT',abort);process.once('SIGTERM',abort);
  try{
    const r=await runWealthfrontWorkTest({repositoryRoot:fileURLToPath(new URL('../../',import.meta.url)),signal:controller.signal,
      onReady:()=>console.log('Temporary first-page Wealthfront capture queued. No workbook changes.')});
    console.log(JSON.stringify(r));console.log('Temporary evidence deleted; removal verified.');if(r.status!=='captured_and_repeated')process.exitCode=1;
  }catch{console.error('Temporary test failed; inspect startup/cleanup before retrying.');process.exitCode=1;}
  finally{process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);}
}
