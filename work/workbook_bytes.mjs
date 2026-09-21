// Export through the documented save API, with an owned, short-lived local file.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SpreadsheetFile} from '@oai/artifact-tool';
import {assertPrivateDirectory} from '../collector/src/private-paths.mjs';

export async function workbookBytes(workbook){
  const policy={repositoryRoot:fileURLToPath(new URL('../',import.meta.url))};
  await assertPrivateDirectory(os.tmpdir(),policy);
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'budget-xlsx-export-'));
  const file=path.join(folder,'export.xlsx');
  try{
    await assertPrivateDirectory(folder,policy);
    await (await SpreadsheetFile.exportXlsx(workbook)).save(file);
    return await fs.readFile(file);
  }finally{
    for(const target of [file,file+'.inspect.ndjson'])
      await fs.unlink(target).catch(e=>{if(e.code!=='ENOENT')throw e;});
    await fs.rmdir(folder);
  }
}
