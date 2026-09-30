import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const script=await readFile(new URL('../chrome-bridge/account-readiness.js',import.meta.url),'utf8');
function node({tagName='BUTTON',innerText='',type='',autocomplete='',autofilled=false,href='',id=''}={}){
  return {tagName,innerText,type,autocomplete,href,id,children:[],get value(){throw Error('Credentials must never be inspected');},
    getClientRects:()=>[{}],getBoundingClientRect:()=>({x:10,y:20,width:100,height:30}),scrollIntoView(){},getAttribute:()=>null,closest:()=>null,
    matches:s=>s===':-webkit-autofill'?autofilled:s.includes(tagName.toLowerCase())};
}
async function fixture(hostname,items,pathname='/'){
  let listener;const c={location:{hostname,pathname},document:{querySelectorAll:()=>items},getComputedStyle:()=>({visibility:'visible',display:'block'}),
    URL,Set,chrome:{runtime:{onMessage:{addListener:f=>listener=f}}}};
  vm.createContext(c);vm.runInContext(script,c);
  return ()=>{let result;listener({command:'prepare_collector_account',requestId:'fictional'},null,r=>result=r);return result;};
}
test('empty public pages never imply signed in; every bank recognizes explicit signed-in evidence',async()=>{
  for(const host of ['secure.wellsfargo.com','secure.chase.com','www.citi.com','www.paypal.com','www.wealthfront.com']){
    assert.equal((await fixture(host,[]))().state,'waiting');
    assert.equal((await fixture(host,[node({innerText:'Sign out'})]))().state,'authenticated');
  }
});
test('autofill sign-in is one exact permitted click, never a credential read or repeated submission',async()=>{
  const inspect=await fixture('secure.chase.com',[node({tagName:'INPUT',type:'password',autofilled:true}),node({innerText:'Sign in'})]);
  assert.equal(inspect().action,'autofill_submit');assert.equal(inspect().state,'auth_required');
  const missing=await fixture('secure.chase.com',[node({tagName:'INPUT',type:'password'}),node({innerText:'Sign in'})]);
  assert.equal(missing().state,'auth_required');
});
test('MFA waits, ambiguity and off-domain login links cannot click',async()=>{
  assert.equal((await fixture('www.citi.com',[node({tagName:'INPUT',autocomplete:'one-time-code'})]))().state,'auth_required');
  assert.equal((await fixture('www.paypal.com',[node({tagName:'A',innerText:'Log in',href:'https://example.com/login'})]))().state,'waiting');
  const buttons=[node({tagName:'INPUT',type:'password',autofilled:true}),node({innerText:'Sign in'}),node({innerText:'Sign in'})];
  assert.equal((await fixture('secure.chase.com',buttons))().state,'auth_required');
});

test('signed-out SPA sign-in links without href and buttons work once, then wait for authentication',async()=>{
  for(const tagName of ['A','BUTTON']){
    const inspect=await fixture('connect.secure.wellsfargo.com',[node({tagName,innerText:'Sign On'})]);
    assert.equal(inspect().action,'open_sign_in');assert.equal(inspect().state,'auth_required');
  }
  const inspect=await fixture('www.chase.com',[node({innerText:'Sign in'}),node({innerText:'Sign in'})]);
  assert.equal(inspect().state,'auth_required');
});
