import fs from 'node:fs/promises';
import path from 'node:path';
import {runWeeklyRefresh} from './weekly-refresh.mjs';
import {weeklyPreflight} from './weekly-preflight.mjs';
import {safeIssue} from './errors.mjs';
import {randomUUID} from 'node:crypto';

let statusFile=null,statusQueue=Promise.resolve(),ready=false;
let statusError=null;
const controller=new AbortController();
process.once('SIGINT',()=>controller.abort());process.once('SIGTERM',()=>controller.abort());
const status=event=>{
  // Deliberately discard all arbitrary fields, paths and error messages.
  const value={version:2,pid:process.pid,state:event.state,
    source:event.source??null,code:event.code??null,updatedAt:new Date().toISOString(),
    runId:event.runId??null,startedAt:event.startedAt??new Date().toISOString(),elapsedMs:event.elapsedMs??0,
    mode:process.argv[3]??'import',outcomes:event.outcomes??{}};
  if(statusFile)statusQueue=statusQueue.then(async()=>{
    const temporary=statusFile+'.'+randomUUID()+'.tmp';
    try{
      await fs.writeFile(temporary,JSON.stringify(value),{mode:0o600,flag:'wx'});
      for(let attempt=0;;attempt++){
        try{await fs.rename(temporary,statusFile);break;}
        catch(e){if(attempt>=3||!['EPERM','EACCES','EBUSY'].includes(e.code))throw e;
          await new Promise(r=>setTimeout(r,25*(attempt+1)));}
      }
    }finally{await fs.unlink(temporary).catch(()=>{});}
  }).catch(error=>{statusError=error;controller.abort();});
};
try{
  await runWeeklyRefresh({configFile:process.argv[2],mode:process.argv[3]??'import',signal:controller.signal,openResult:()=>{},onStatus:status,
    preflight:async file=>{
      const context=await weeklyPreflight(file);
      statusFile=path.join(context.privateRoot,'weekly-run-status.json');
      status({state:'preflight_passed'});await statusQueue;
      if(statusError){await context.release();throw statusError;}
      ready=true;process.send?.({state:'ready',pid:process.pid});return context;
    }});
}catch(error){
  const code=safeIssue(null,error).code;
  if(!ready&&process.connected)process.send?.({state:'blocked',code});
  // runWeeklyRefresh already recorded the source and its diagnostic details.
  if(!ready)status({state:'blocked',code});process.exitCode=1;
}finally{await statusQueue;if(statusError)process.exitCode=1;if(process.connected)process.disconnect();}
