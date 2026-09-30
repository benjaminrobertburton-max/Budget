import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CollectionError,requireEvidence as check} from './errors.mjs';

// No executable/desktop app is installed. This is the existing Node collector,
// detached from the conversational terminal, with a bounded IPC startup check.
export async function launchWeeklyRefresh(configFile,{spawnProcess=spawn,mode='import'}={}){
  check(['import','test'].includes(mode),'INVALID_RUN_MODE','Choose import or test.');
  const child=spawnProcess(process.execPath,[fileURLToPath(new URL('./weekly-worker.mjs',import.meta.url)),configFile,mode],{
    detached:true,windowsHide:true,shell:false,stdio:['ignore','ignore','ignore','ipc'],
  });
  return new Promise((resolve,reject)=>{
    const finish=(error,value)=>{
      clearTimeout(timer);child.removeListener('exit',exited);child.removeListener('error',failed);
      if(child.connected)child.disconnect();child.unref();
      if(error)reject(error);else resolve(value);
    };
    const failed=()=>finish(new CollectionError('LAUNCH_FAILED','The persistent collector could not start.'));
    const exited=()=>finish(new CollectionError('LAUNCH_FAILED','Collector preflight did not complete.'));
    const timer=setTimeout(()=>finish(new CollectionError('LAUNCH_STATUS_UNKNOWN','Startup status is unknown; inspect collector status before retrying.')),45000);
    child.once('error',failed);child.once('exit',exited);
    child.once('message',message=>{
      try{
        check(message?.state==='ready'&&Number.isInteger(message.pid),'PREFLIGHT_BLOCKED',
          'Collector preflight failed; no bank capture started.');
        finish(null,{status:'started',pid:message.pid});
      }catch(error){
        if(typeof message?.code==='string'&&/^[A-Z_]{3,80}$/.test(message.code))error=new CollectionError(message.code,'Collector preflight failed; no bank capture started.');
        finish(error);
      }
    });
  });
}
