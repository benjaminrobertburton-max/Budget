import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function worker({accepted=true,rectangle=[0,0,100,30]}={}) {
  const calls=[],timers=[];
  const context={Set,Number,JSON,Array,RegExp,fetch:async()=>({ok:false}),setTimeout:f=>timers.push(f),
    chrome:{alarms:{create(){},onAlarm:{addListener(){}}},
      runtime:{onStartup:{addListener(){}},onInstalled:{addListener(){}},onMessage:{addListener(){}}},
      tabs:{sendMessage:async(tab,message)=>{calls.push({type:'message',message});return {accepted};},reload:async()=>{}},
      webNavigation:{getAllFrames:async()=>[{frameId:0}]},debugger:{
        attach:async()=>calls.push({type:'attach'}),detach:async()=>calls.push({type:'detach'}),
        sendCommand:async(target,command,args)=>{calls.push({type:command,args});return {result:{value:rectangle}};}}}};
  vm.createContext(context);
  vm.runInContext(await readFile(new URL('../chrome-bridge/background.js',import.meta.url),'utf8'),context);
  return {context,calls};
}
test('actual worker guards more-activity click by page token and requests a changed-page capture',async()=>{
  const {context,calls}=await worker();
  await vm.runInContext("loadMoreChase(7,'a0000001')",context);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].message)),{command:'check_chase_more',pageToken:'a0000001'});
  const script=calls.find(c=>c.type==='Runtime.evaluate').args.expression;
  assert.match(script,/#activity_messages_id mds-button/);
  assert.match(script,/See more activity/);
  assert.equal(calls.filter(c=>c.type==='Input.dispatchMouseEvent').length,2);
  const capture=calls.find(c=>c.type==='message'&&c.message.command==='capture_chase_activity');
  assert.equal(capture.message.afterPageToken,'a0000001');
  assert.equal(calls.at(-1).type,'detach');
});
test('stale page token or invalid control cannot trigger a more-activity click',async()=>{
  for(const options of [{accepted:false},{rectangle:null}]){
    const {context,calls}=await worker(options);
    await vm.runInContext("loadMoreChase(7,'a0000001')",context);
    assert.equal(calls.some(c=>c.type==='Input.dispatchMouseEvent'),false);
    if(options.rectangle===null)assert.equal(calls.at(-1).type,'detach');
  }
});
