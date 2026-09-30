import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tempDirectory} from './store-helpers.mjs';

test('detached launcher worker survives the launching Node process exiting',async t=>{
  const root=await tempDirectory(t),marker=path.join(root,'fictional-lifetime.txt');
  const launcher=new URL('../src/weekly-launch.mjs',import.meta.url).href;
  const fixture=fileURLToPath(new URL('../fixtures/detached-worker.mjs',import.meta.url));
  const code=`import {spawn} from 'node:child_process';
    const {launchWeeklyRefresh}=await import(${JSON.stringify(launcher)});
    await launchWeeklyRefresh(${JSON.stringify(marker)},{spawnProcess:(exe,args,options)=>spawn(exe,[${JSON.stringify(fixture)},args[1]],options)});`;
  const child=spawn(process.execPath,['--input-type=module','-e',code],{windowsHide:true,stdio:'ignore'});
  assert.equal(await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);}),0);
  let result;
  for(let i=0;i<50;i++){
    try{result=await fs.readFile(marker,'utf8');break;}catch(error){if(error.code!=='ENOENT')throw error;}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(result,'survived-parent-exit');
});
