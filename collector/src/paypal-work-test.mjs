import {withDisposableTestRun} from './disposable-run.mjs';
import {startChromeBridge} from './chrome-bridge.mjs';
import {normalizePaypalFinancing} from './paypal-normalize.mjs';
import {fileURLToPath} from 'node:url';
export async function runPaypalWorkTest({repositoryRoot,parent,protector,port=43811,signal,durationMs=120000,onReady=()=>{}}={}){
  if(!Number.isInteger(durationMs)||durationMs<1||durationMs>120000)throw new Error('INVALID_TEST_DURATION');
  return withDisposableTestRun({repositoryRoot,parent,protector},async scope=>{
    await scope.saveEvidence({kind:'paypal_preflight',financialData:false});
    let finish,prior=null,closed=false,busy=false,result={status:'timeout',workbookReady:false};
    const done=new Promise(r=>{finish=r;}),stop=r=>{if(!closed){closed=true;result=r;finish();}};
    const timer=setTimeout(()=>stop(result),durationMs),abort=()=>stop({status:'cancelled',workbookReady:false});
    signal?.addEventListener('abort',abort,{once:true});scope.registerClose(async()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);});
    const bridge=await startChromeBridge({port,nextCommand:'capture_paypal_financing',onPaypalCapture:async candidate=>{
      if(closed||busy)return;busy=true;
      try{
        const n=normalizePaypalFinancing(candidate);await scope.saveEvidence({kind:'paypal_test_capture',candidate});
        if(!n.coverageVerified){stop({status:'blocked',issues:n.issues,workbookReady:false});return;}
        const snapshot=JSON.stringify(n.rows);
        if(!prior){prior=snapshot;return {repeat:true};}
        stop({status:prior===snapshot?'captured_and_repeated':'snapshot_changed',promotions:n.rows.length,workbookReady:false});
      }catch{stop({status:'capture_failed',workbookReady:false});}finally{busy=false;}
    }});
    scope.registerClose(()=>bridge.close());if(signal?.aborted)abort();await onReady({port:bridge.port});await done;return result;
  });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const controller=new AbortController(),abort=()=>controller.abort();process.once('SIGINT',abort);process.once('SIGTERM',abort);
  try{
    const result=await runPaypalWorkTest({repositoryRoot:fileURLToPath(new URL('../../',import.meta.url)),signal:controller.signal,
      onReady:()=>console.log('Temporary PayPal financing capture queued. No workbook or personal Chrome data changes.')});
    console.log(JSON.stringify(result));console.log('Temporary collector evidence deleted; removal verified.');
    if(result.status!=='captured_and_repeated')process.exitCode=1;
  }catch{console.error('PayPal test failed; cleanup/startup requires inspection.');process.exitCode=1;}
  finally{process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);}
}
