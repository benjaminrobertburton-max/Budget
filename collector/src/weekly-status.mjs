import fs from 'node:fs/promises';
import path from 'node:path';
import {defaultPrivateRoot,assertPrivateDirectory,assertRegularFile} from './private-paths.mjs';
import {fileURLToPath} from 'node:url';
import {requireEvidence as check} from './errors.mjs';
import {WEEKLY_SOURCES} from './weekly-sequence.mjs';

export async function readWeeklyStatus(root=defaultPrivateRoot()){
  await assertPrivateDirectory(root,{repositoryRoot:fileURLToPath(new URL('../../',import.meta.url))});
  const file=path.join(root,'weekly-run-status.json');await assertRegularFile(file,24000);
  const v=JSON.parse(await fs.readFile(file,'utf8'));
  check([1,2].includes(v?.version)
    &&Number.isInteger(v.pid)&&v.pid>0
    &&['preflight_passed','collecting','waiting_for_sign_in','ready_to_import','importing','validating','validated','complete','blocked','cancelled'].includes(v.state)
    &&(v.source===null||WEEKLY_SOURCES.includes(v.source))
    &&(v.code===null||typeof v.code==='string'&&/^[A-Z_]{3,80}$/.test(v.code))
    &&typeof v.updatedAt==='string'&&Number.isFinite(Date.parse(v.updatedAt)),
    'STATUS_INVALID','The private collector status is invalid.');
  let running=true;try{process.kill(v.pid,0);}catch(e){running=e.code!=='ESRCH';}
  const outcomes={};
  for(const [source,o] of Object.entries(v.outcomes??{})){
    if(!WEEKLY_SOURCES.includes(source)||!['collecting','waiting_for_sign_in','verified','blocked'].includes(o?.state))continue;
    outcomes[source]={state:o.state,reused:o.reused===true,code:typeof o.code==='string'&&/^[A-Z_]{3,80}$/.test(o.code)?o.code:null,
      issues:Array.isArray(o.issues)?o.issues.filter(i=>typeof i==='string'&&/^[a-z_]{3,80}$/i.test(i)).slice(0,30):[],
      rowIssues:Array.isArray(o.rowIssues)?o.rowIssues.filter(r=>Number.isInteger(r.row)&&r.row>=0&&r.row<2000).map(r=>({row:r.row})):[]};
  }
  return {state:!running&&!['complete','validated','blocked','cancelled'].includes(v.state)?'interrupted':v.state,source:v.source,code:v.code,
    ...(v.version===2?{startedAt:Number.isFinite(Date.parse(v.startedAt))?v.startedAt:null,
      elapsedMs:running&&!['complete','validated','blocked','cancelled'].includes(v.state)&&Number.isFinite(Date.parse(v.startedAt))
        ?Math.max(0,Date.now()-Date.parse(v.startedAt)):(Number.isSafeInteger(v.elapsedMs)&&v.elapsedMs>=0?v.elapsedMs:0),mode:v.mode==='test'?'test':'import',outcomes}:{})};
}
