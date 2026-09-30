import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('PayPal duplicate ready notices and stale replies cannot reopen panels',async()=>{
 let listener;const messages=[];
 const context={Date,Set,Number,JSON,Array,RegExp,setTimeout,setInterval(){},fetch:async()=>({ok:false}),
  chrome:{alarms:{create(){},onAlarm:{addListener(){}}},
   runtime:{id:'fictional',onStartup:{addListener(){}},onInstalled:{addListener(){}},onMessage:{addListener:f=>listener=f}},
   tabs:{query:async()=>[{id:7,status:'complete'}],sendMessage:async(id,m)=>{
    if(m.command.startsWith('capture_'))messages.push(m);
    return {accepted:true,build:'0.4.32',state:'authenticated'};
   }}}};
 vm.createContext(context);
 vm.runInContext(await readFile(new URL('../chrome-bridge/background.js',import.meta.url),'utf8'),context);
 vm.runInContext("paypalTabId=7;pendingPaypalCapture=true;paypalCaptureDeadline=Date.now()+45000;session='fictional';activeBank='paypal';activeRequest='request-a';nextCommand=async()=> 'none';send=async()=>true;",context);
 const sender={id:'fictional',tab:{id:7},frameId:0,url:'https://www.paypal.com/myaccount/credit/paypal-credit/us'};
 const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
 listener({event:'paypal_page_ready',pageInstance:'doc1'},sender);
 listener({event:'paypal_page_ready',pageInstance:'doc1'},sender);await settle();
 assert.equal(messages.length,1);assert.equal(vm.runInContext('paypalCaptureInFlight',context),true);
 listener({event:'paypal_financing_capture',requestId:'old-request',candidate:{finding:'captured'}},sender);
 assert.equal(vm.runInContext('paypalCaptureInFlight',context),true,'stale reply does not finish current capture');
 listener({event:'paypal_financing_capture',requestId:'request-a',candidate:{finding:'captured'}},sender);await settle();
 listener({event:'paypal_page_ready',pageInstance:'doc1'},sender);await settle();assert.equal(messages.length,1);
 vm.runInContext("paypalCaptureInFlight=true",context);
 listener({event:'paypal_page_ready',pageInstance:'doc2'},sender);await settle();
 assert.equal(messages.length,2,'a real navigation gets one delivery');
 listener({event:'paypal_page_ready',pageInstance:'doc2'},sender);await settle();assert.equal(messages.length,2);
});
