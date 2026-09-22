import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('PayPal request survives page readiness, completes once, and expires',async()=>{
 let listener;const messages=[];
 const context={Date,Set,Number,JSON,Array,RegExp,setTimeout,
  fetch:async()=>({ok:false}),
  chrome:{alarms:{create(){},onAlarm:{addListener(){}}},
   runtime:{id:'fictional',onStartup:{addListener(){}},onInstalled:{addListener(){}},onMessage:{addListener:f=>listener=f}},
   tabs:{sendMessage:async(id,m)=>{messages.push(m);return {accepted:true};}}}};
 vm.createContext(context);
 vm.runInContext(await readFile(new URL('../chrome-bridge/background.js',import.meta.url),'utf8'),context);
 vm.runInContext("paypalTabId=7;pendingPaypalCapture=true;paypalCaptureDeadline=Date.now()+45000;session='fictional'",context);
 const sender={id:'fictional',tab:{id:7},frameId:0,url:'https://www.paypal.com/myaccount/credit/paypal-credit/us'};
 listener({event:'paypal_page_ready'},sender);
 listener({event:'paypal_page_ready'},sender);
 assert.equal(messages.length,2);
 assert.equal(vm.runInContext('pendingPaypalCapture',context),true);
 listener({event:'paypal_financing_capture',candidate:{finding:'captured'}},sender);
 assert.equal(vm.runInContext('pendingPaypalCapture',context),false);
 vm.runInContext('pendingPaypalCapture=true;paypalCaptureDeadline=Date.now()-1',context);
 listener({event:'paypal_page_ready'},sender);
 assert.equal(vm.runInContext('pendingPaypalCapture',context),false);
 assert.equal(messages.length,2);
});
