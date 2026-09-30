import fs from 'node:fs/promises';
import path from 'node:path';
import {defaultPrivateRoot,assertPrivateDirectory,assertRegularFile} from './private-paths.mjs';
import {fileURLToPath} from 'node:url';
import {requireEvidence as check} from './errors.mjs';
import {WEEKLY_SOURCES} from './weekly-sequence.mjs';

export async function readWeeklyStatus(root=defaultPrivateRoot()){
  await assertPrivateDirectory(root,{repositoryRoot:fileURLToPath(new URL('../../',import.meta.url))});
  const file=path.join(root,'weekly-run-status.json');await assertRegularFile(file,2048);
  const v=JSON.parse(await fs.readFile(file,'utf8'));
  check(v?.version===1&&Object.keys(v).sort().join(',')==='code,pid,source,state,updatedAt,version'
    &&Number.isInteger(v.pid)&&v.pid>0
    &&['preflight_passed','collecting','ready_to_import','importing','complete','blocked','cancelled'].includes(v.state)
    &&(v.source===null||WEEKLY_SOURCES.includes(v.source))
    &&(v.code===null||typeof v.code==='string'&&/^[A-Z_]{3,80}$/.test(v.code))
    &&typeof v.updatedAt==='string'&&Number.isFinite(Date.parse(v.updatedAt)),
    'STATUS_INVALID','The private collector status is invalid.');
  let running=true;try{process.kill(v.pid,0);}catch(e){running=e.code!=='ESRCH';}
  return {state:!running&&!['complete','blocked','cancelled'].includes(v.state)?'interrupted':v.state,source:v.source,code:v.code};
}
