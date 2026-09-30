import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('stale readers receive no capture command and only one same-tab reload',async()=>{
  const commands=[],reloads=[];let build='old';
  const context={setTimeout,fetch:async()=>({ok:false}),chrome:{
    alarms:{create(){},onAlarm:{addListener(){}}},runtime:{onStartup:{addListener(){}},onInstalled:{addListener(){}},onMessage:{addListener(){}}},
    tabs:{sendMessage:async(id,m)=>{commands.push(m.command);return {accepted:true,build};},reload:async id=>reloads.push(id)}}};
  vm.createContext(context);vm.runInContext(await readFile(new URL('../chrome-bridge/background.js',import.meta.url),'utf8'),context);
  await vm.runInContext('deliverPaypalCapture(7)',context);await vm.runInContext('deliverPaypalCapture(7)',context);
  assert.deepEqual(reloads,[7]);assert.ok(commands.every(c=>c==='probe_collector_build'));
  build='0.4.30';await vm.runInContext('deliverPaypalCapture(7)',context);await vm.runInContext('deliverPaypalCapture(7)',context);
  assert.equal(commands.filter(c=>c==='capture_paypal_financing').length,1);
  assert.deepEqual(reloads,[7]);
});
