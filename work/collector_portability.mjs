import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import JSZip from 'jszip';
import {assertPrivateDirectory,assertRegularFile} from '../collector/src/private-paths.mjs';
import {acquireWeeklyLock} from '../collector/src/weekly-preflight.mjs';
import {openPrivateEvidenceStore} from '../collector/src/private-evidence-store.mjs';
import {windowsProtector} from '../collector/src/protection.mjs';
import {requireEvidence as check} from '../collector/src/errors.mjs';
import {readWealthfrontCheckpoint,resolveWealthfrontPrior,embedWealthfrontCheckpoint} from './wealthfront_checkpoint.mjs';

// Explicit migration uses only the accepted workbook reference, never latest
// evidence or initialAnchor. No bank capture or financial-cell edit occurs.
export async function migrateWealthfrontCheckpoint(configFile,{protector=windowsProtector()}={}){
  const repositoryRoot=fileURLToPath(new URL('../',import.meta.url)),policy={repositoryRoot};
  check(path.isAbsolute(configFile),'UNSAFE_STORAGE_PATH','An absolute private configuration is required.');
  await assertPrivateDirectory(path.dirname(configFile),policy);await assertRegularFile(configFile,16000);
  const configBytes=await fs.readFile(configFile),c=JSON.parse(configBytes);
  check(c?.version===1&&c.wealthfront&&typeof c.baseWorkbook==='string'&&path.isAbsolute(c.baseWorkbook)
    &&path.extname(c.baseWorkbook).toLowerCase()==='.xlsx','INVALID_INTAKE_CONFIG','A configured private XLSX and Wealthfront binding are required.');
  for(const folder of [c.privateRoot,c.outputRoot,path.dirname(c.baseWorkbook)])await assertPrivateDirectory(folder,policy);
  await assertRegularFile(c.baseWorkbook,40*1024*1024);
  const release=await acquireWeeklyLock(c.privateRoot);let temporary;
  try{
    const interrupted=await fs.stat(path.join(c.privateRoot,'weekly-refresh-session.json')).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});
    check(!interrupted,'WEEKLY_SESSION_ACTIVE','Complete the saved import before changing workbook portability metadata.');
    const original=await fs.readFile(c.baseWorkbook);
    if(await readWealthfrontCheckpoint(original,c.wealthfront))return {status:'already_portable',output:c.baseWorkbook};
    const store=await openPrivateEvidenceStore({root:c.privateRoot,repositoryRoot,protector});
    const checkpoint=await resolveWealthfrontPrior(original,c.wealthfront,store);
    check(checkpoint,'WEALTHFRONT_ACCEPTED_CAPTURE_REQUIRED','An accepted Wealthfront import is required before migration.');
    const bytes=await embedWealthfrontCheckpoint(original,checkpoint);
    await readWealthfrontCheckpoint(bytes,c.wealthfront);
    const before=await JSZip.loadAsync(original),after=await JSZip.loadAsync(bytes);
    const allowed=new Set(['docProps/custom.xml','_rels/.rels','[Content_Types].xml']);
    for(const [name,file] of Object.entries(before.files))if(!file.dir&&!allowed.has(name))
      check(after.file(name)&&(await file.async('nodebuffer')).equals(await after.file(name).async('nodebuffer')),
        'WORKBOOK_PRESERVATION_FAILED','Portability migration must preserve all financial workbook parts.');
    const unchanged=async()=>check((await fs.readFile(c.baseWorkbook)).equals(original)
      &&(await fs.readFile(configFile)).equals(configBytes),'WORKBOOK_CHANGED','The workbook or configuration changed during migration.');
    await unchanged();await fs.mkdir(c.outputRoot,{recursive:true,mode:0o700});
    const folder=await fs.mkdtemp(path.join(c.outputRoot,'portability-')),backup=path.join(folder,'before.xlsx');
    await fs.writeFile(backup,original,{flag:'wx',mode:0o600});
    temporary=path.join(path.dirname(c.baseWorkbook),'.budget-portability-'+randomUUID()+'.xlsx');
    const handle=await fs.open(temporary,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
    await unchanged();await fs.rename(temporary,c.baseWorkbook);temporary=null;
    return {status:'portable_checkpoint_added',output:c.baseWorkbook,backup,financialPartsUnchanged:true};
  }finally{if(temporary)await fs.unlink(temporary).catch(()=>{});await release();}
}
