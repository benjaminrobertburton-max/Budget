import fs from 'node:fs/promises';
import path from 'node:path';
import {runWeeklyRefresh} from './weekly-refresh.mjs';
import {weeklyPreflight} from './weekly-preflight.mjs';
import {safeIssue} from './errors.mjs';

let statusFile=null,statusQueue=Promise.resolve(),ready=false;
const status=event=>{
  // Deliberately discard all arbitrary fields, paths and error messages.
  const value={version:1,pid:process.pid,state:event.state,
    source:event.source??null,code:event.code??null,updatedAt:new Date().toISOString()};
  if(statusFile)statusQueue=statusQueue.then(async()=>{
    const temporary=statusFile+'.'+process.pid+'.tmp';
    await fs.writeFile(temporary,JSON.stringify(value),{mode:0o600});
    await fs.rename(temporary,statusFile);
  });
};
try{
  await runWeeklyRefresh({configFile:process.argv[2],openResult:()=>{},onStatus:status,
    preflight:async file=>{
      const context=await weeklyPreflight(file);
      statusFile=path.join(context.privateRoot,'weekly-run-status.json');
      status({state:'preflight_passed'});await statusQueue;
      ready=true;process.send?.({state:'ready',pid:process.pid});return context;
    }});
}catch(error){
  const code=safeIssue(null,error).code;
  if(!ready&&process.connected)process.send?.({state:'blocked',code});
  status({state:'blocked',code});process.exitCode=1;
}finally{await statusQueue.catch(()=>{process.exitCode=1;});if(process.connected)process.disconnect();}
