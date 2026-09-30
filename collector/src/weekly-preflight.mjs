import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {assertPrivateDirectory, assertRegularFile} from './private-paths.mjs';
import {validateIntakeBindings} from './workbook-intake.mjs';
import {windowsProtector} from './protection.mjs';
import {CollectionError, requireEvidence as check} from './errors.mjs';
import {runCollectorQc} from './collector-qc.mjs';

const repositoryRoot=fileURLToPath(new URL('../../',import.meta.url));
export async function acquireWeeklyLock(root, {pid=process.pid, alive=value=>{
  try{process.kill(value,0);return true;}catch(e){return e.code!=='ESRCH';}
}}={}){
  const filename=path.join(root,'weekly-refresh.lock'),token=randomUUID();
  // Never kill a process. Recover only a regular, valid lock whose owner is
  // provably gone. PID reuse is conservatively treated as an active owner.
  for(let attempt=0;attempt<2;attempt++){
    try{
      const handle=await fs.open(filename,'wx',0o600);
      try{await handle.writeFile(JSON.stringify({version:1,pid,token}));await handle.sync();}
      finally{await handle.close();}
      return async()=>{
        const value=JSON.parse(await fs.readFile(filename,'utf8'));
        check(value.token===token,'LOCK_CHANGED','Collector lock ownership changed.');
        await fs.unlink(filename);
      };
    }catch(error){
      if(error.code!=='EEXIST')throw error;
      await assertRegularFile(filename,1024);
      let value;try{value=JSON.parse(await fs.readFile(filename,'utf8'));}catch{}
      check(value?.version===1&&Number.isInteger(value.pid)&&value.pid>0&&typeof value.token==='string',
        'LOCK_INVALID','The collector lock requires review.');
      check(!alive(value.pid),'COLLECTOR_ALREADY_RUNNING','A collector already owns the private store.');
      // Serialize stale-lock recovery, then re-read ownership. A competing
      // recovery must not remove a freshly acquired replacement lock.
      const recovery=filename+'.recovery';let guard;
      try{
        guard=await fs.open(recovery,'wx',0o600);
        const current=JSON.parse(await fs.readFile(filename,'utf8'));
        check(current.token===value.token&&!alive(current.pid),'LOCK_CHANGED','Retry collector preflight.');
        await fs.unlink(filename);
      }catch{throw new CollectionError('LOCK_CHANGED','Collector lock recovery requires review.');}
      finally{if(guard){await guard.close();await fs.unlink(recovery);}}
    }
  }
  throw new CollectionError('COLLECTOR_ALREADY_RUNNING','A collector already owns the private store.');
}

export async function assertLoopbackAvailable(port=43811){
  const server=createServer();
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port},resolve);});
  }catch{throw new CollectionError('LOCAL_BRIDGE_IN_USE','The collector loopback port is already in use.');}
  finally{if(server.listening)await new Promise(resolve=>server.close(resolve));}
}

export async function weeklyPreflight(configFile,{protector=windowsProtector(),checkRuntime=true}={}){
  check(Number(process.versions.node.split('.')[0])>=20,'NODE_UNSUPPORTED','Node 20 or newer is required.');
  const qc=await runCollectorQc({repositoryRoot});
  check(qc.ok,'COLLECTOR_QC_BLOCKED','Collector release files disagree; sync the software before collecting.');
  const policy={repositoryRoot};
  check(typeof configFile==='string'&&path.isAbsolute(configFile),'PRIVATE_CONFIG_REQUIRED','An absolute private configuration is required.');
  await assertPrivateDirectory(path.dirname(configFile),policy);await assertRegularFile(configFile,16000);
  const configBytes=await fs.readFile(configFile);
  let config;try{config=JSON.parse(configBytes);}catch{throw new CollectionError('INVALID_INTAKE_CONFIG','The private configuration is invalid.');}
  check(config?.version===1&&Object.keys(config).filter(k=>!['paypalPromotions','wealthfront'].includes(k)).sort().join(',')==='baseWorkbook,bindings,outputRoot,privateRoot,version',
    'INVALID_INTAKE_CONFIG','The private configuration is incomplete.');
  validateIntakeBindings(config.bindings);
  check(config.bindings.citi&&Array.isArray(config.paypalPromotions)&&config.paypalPromotions.length>0&&config.wealthfront,
    'WEEKLY_SOURCES_UNCONFIGURED','All six weekly sources must have private bindings.');
  check(typeof config.baseWorkbook==='string'&&path.isAbsolute(config.baseWorkbook)&&path.extname(config.baseWorkbook).toLowerCase()==='.xlsx',
    'UNSUPPORTED_WORKBOOK','A private XLSX workbook is required.');
  for(const folder of [config.privateRoot,config.outputRoot,path.dirname(config.baseWorkbook)])await assertPrivateDirectory(folder,policy);
  await assertRegularFile(config.baseWorkbook,40*1024*1024);
  const workbookBytes=await fs.readFile(config.baseWorkbook);
  const workbookHash=createHash('sha256').update(workbookBytes).digest('hex');
  await fs.mkdir(config.privateRoot,{recursive:true,mode:0o700});
  const release=await acquireWeeklyLock(config.privateRoot);
  try{
    await assertLoopbackAvailable();
    for(const folder of [config.privateRoot,config.outputRoot,path.dirname(config.baseWorkbook)]){
      await fs.mkdir(folder,{recursive:true,mode:0o700});
      const probe=path.join(folder,'.collector-write-check-'+randomUUID());
      const handle=await fs.open(probe,'wx',0o600);
      try{await handle.writeFile('Collector permission check');await handle.sync();}
      finally{await handle.close();await fs.unlink(probe);}
    }
    const sealed=await protector.sealMany([{probe:'fictional preflight'}]);
    check((await protector.openMany(sealed))[0]?.probe==='fictional preflight','PROTECTION_FAILED','Local encryption check failed.');
    const workbookAnchors=checkRuntime?await (await import('../../work/collector_workbook.mjs')).readCollectorWorkbookAnchors(workbookBytes,config.bindings):undefined;
    if(checkRuntime){
      const {openPrivateEvidenceStore}=await import('./private-evidence-store.mjs');
      const {resolveWealthfrontPrior}=await import('../../work/wealthfront_checkpoint.mjs');
      await resolveWealthfrontPrior(workbookBytes,config.wealthfront,
        await openPrivateEvidenceStore({root:config.privateRoot,repositoryRoot,protector}));
    }
    const fingerprint=createHash('sha256').update(configBytes).update(workbookHash).digest('hex');
    const assertUnchanged=async()=>{
      check((await fs.readFile(configFile)).equals(configBytes)
        &&createHash('sha256').update(await fs.readFile(config.baseWorkbook)).digest('hex')===workbookHash,
        'WORKBOOK_CHANGED','The private workbook or configuration changed during collection.');
    };
    return {config,privateRoot:config.privateRoot,sessionKey:configFile+'\0'+fingerprint,release,protector,workbookHash,workbookAnchors,assertUnchanged};
  }catch(error){await release();throw error;}
}
