import {withDisposableTestRun} from './disposable-run.mjs';
import {startChromeBridge} from './chrome-bridge.mjs';
import {normalizeCitiActivity,citiSummary,citiOverlap} from './citi-normalize.mjs';
import {fileURLToPath} from 'node:url';

export async function runCitiWorkTest({repositoryRoot,parent,protector,port=43811,signal,durationMs=120000,onReady=()=>{}}={}){
  if(!Number.isInteger(durationMs)||durationMs<1||durationMs>120000)throw new Error('INVALID_TEST_DURATION');
  return withDisposableTestRun({repositoryRoot,parent,protector},async scope=>{
    await scope.saveEvidence({kind:'citi_preflight',financialData:false});
    let finish,prior=null,result={status:'timeout',workbookReady:false};
    const done=new Promise(resolve=>{finish=resolve;});
    let closed=false,busy=false;
    const stop=value=>{if(!closed){closed=true;result=value;finish();}};
    const timer=setTimeout(()=>stop(result),durationMs),abort=()=>stop({status:'cancelled',workbookReady:false});
    signal?.addEventListener('abort',abort,{once:true});
    scope.registerClose(async()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);});
    const bridge=await startChromeBridge({port,nextCommand:'capture_citi_activity',onCitiActivityCapture:async candidate=>{
      if(closed||busy)return;busy=true;
      try{
        const n=normalizeCitiActivity(candidate,'temporary:citi'),overlap=citiOverlap(n,prior);
        await scope.saveEvidence({kind:'citi_work_capture',candidate,normalized:n});
        if(!n.coverageVerified){stop({status:'blocked',summary:citiSummary(n),overlap,workbookReady:false});return;}
        if(!prior){prior=n;return {repeat:true};}
        stop({status:overlap.overlapVerified?'captured_and_repeated':'blocked',summary:citiSummary(n),overlap,workbookReady:false});
      }catch{stop({status:'capture_failed',workbookReady:false});throw new Error('CITI_CAPTURE_FAILED');}
      finally{busy=false;}
    }});
    scope.registerClose(()=>bridge.close());
    if(signal?.aborted)abort();
    await onReady({port:bridge.port});await done;return result;
  });
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const controller=new AbortController(),abort=()=>controller.abort();
  process.once('SIGINT',abort);process.once('SIGTERM',abort);
  try{
    const result=await runCitiWorkTest({repositoryRoot:fileURLToPath(new URL('../../',import.meta.url)),signal:controller.signal,
      onReady:()=>console.log('Citi temporary capture queued; expires in two minutes. No workbook changes. Personal Chrome stays intact.')});
    console.log(JSON.stringify(result));console.log('Temporary collector evidence deleted; removal verified.');
    if(result.status!=='captured_and_repeated')process.exitCode=1;
  }catch{console.error('Citi temporary test failed; cleanup or startup requires inspection.');process.exitCode=1;}
  finally{process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);}
}
