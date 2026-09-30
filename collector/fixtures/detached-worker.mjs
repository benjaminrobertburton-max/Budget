// Nonfinancial launcher-lifetime fixture. No browser, workbook or bridge.
import fs from 'node:fs/promises';
process.send({state:'ready',pid:process.pid});
process.once('disconnect',()=>setTimeout(async()=>{
  await fs.writeFile(process.argv[2],'survived-parent-exit',{flag:'wx'});
},700));
