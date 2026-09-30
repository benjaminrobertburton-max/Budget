import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function fixture(initial=[]){
  const tabs=[...initial],created=[],sent=[];
  const context={setTimeout,fetch:async()=>({ok:false}),chrome:{
    alarms:{create(){},onAlarm:{addListener(){}}},
    runtime:{onStartup:{addListener(){}},onInstalled:{addListener(){}},onMessage:{addListener(){}}},
    tabs:{query:async()=>tabs,create:async o=>{created.push(o);const t={id:123,status:'loading'};tabs.push(t);return t;},
      sendMessage:async()=>assert.fail('Opening must not start capture'),reload:async()=>assert.fail('Opening must not reload')},
  }};
  context.setInterval=()=>{};vm.createContext(context);vm.runInContext(await readFile(new URL('../chrome-bridge/background.js',import.meta.url),'utf8'),context);
  context.recordEvent=x=>sent.push(x);vm.runInContext('send=async(path,body)=>{recordEvent(body.event);return true;}',context);
  return {context,created,sent};
}
for(const [source,url] of Object.entries({wells:'https://connect.secure.wellsfargo.com/auth/login/present?origin=cob',
  chase:'https://www.chase.com/',citi:'https://www.citi.com/',paypal:'https://www.paypal.com/',wealthfront:'https://www.wealthfront.com/'})){
  test(`${source} opens only its own missing website, then reuses without navigation`,async()=>{
    const f=await fixture();
    assert.equal((await vm.runInContext(`openInstitutionTab('${source}')`,f.context)).id,123);
    await vm.runInContext(`openInstitutionTab('${source}')`,f.context);
    assert.equal(f.created.length,1);assert.equal(f.created[0].url,url);
    const reused=await fixture([{id:456}]);
    assert.equal((await vm.runInContext(`openInstitutionTab('${source}')`,reused.context)).id,456);
    assert.equal(reused.created.length,0);
  });
  test(`${source} duplicate tabs stop rather than choosing an arbitrary page`,async()=>{
    const f=await fixture([{id:1},{id:2}]);
    assert.equal(await vm.runInContext(`openInstitutionTab('${source}')`,f.context),null);
    assert.deepEqual(f.sent,[source+'_tab_ambiguous']);assert.equal(f.created.length,0);
  });
}
