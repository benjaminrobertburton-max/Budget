import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('PayPal page readiness delivers one active capture, then expires safely',async()=>{
 let listener;const messages=[];
 const context={Date,Set,Number,JSON,Array,RegExp,setTimeout,
  fetch:async()=>({ok:false}),
  chrome:{alarms:{create(){},onAlarm:{addListener(){}}},
   runtime:{id:'fictional',onStartup:{addListener(){}},onInstalled:{addListener(){}},onMessage:{addListener:f=>listener=f}},
   tabs:{sendMessage:async(id,m)=>{if(m.command!=='probe_collector_build')messages.push(m);return {accepted:true,build:'0.4.29'};}}}};
 vm.createContext(context);
 vm.runInContext(await readFile(new URL('../chrome-bridge/background.js',import.meta.url),'utf8'),context);
 vm.runInContext("paypalTabId=7;pendingPaypalCapture=true;paypalCaptureDeadline=Date.now()+45000;session='fictional'",context);
 const sender={id:'fictional',tab:{id:7},frameId:0,url:'https://www.paypal.com/myaccount/credit/paypal-credit/us'};
  listener({event:'paypal_page_ready'},sender);
  listener({event:'paypal_page_ready'},sender);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(messages.length,1);
  assert.equal(vm.runInContext('pendingPaypalCapture',context),false);
  assert.equal(vm.runInContext('paypalCaptureInFlight',context),true);
  listener({event:'paypal_financing_capture',candidate:{finding:'captured'}},sender);
  assert.equal(vm.runInContext('pendingPaypalCapture',context),false);
  assert.equal(vm.runInContext('paypalCaptureInFlight',context),false);
  // A same-tab navigation creates a new document and gets exactly one fresh
  // delivery. Ordinary ready events from the same document do not.
  vm.runInContext("paypalCaptureInFlight=true;paypalPageInstance='old-document'",context);
  listener({event:'paypal_page_ready',pageInstance:'new-document'},sender);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(messages.length,2);
  assert.equal(vm.runInContext('paypalCaptureInFlight',context),true);
 vm.runInContext('pendingPaypalCapture=true;paypalCaptureDeadline=Date.now()-1',context);
 listener({event:'paypal_page_ready'},sender);
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(vm.runInContext('pendingPaypalCapture',context),false);
  assert.equal(messages.length,2);
});
