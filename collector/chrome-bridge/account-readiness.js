// Shared gate, not a financial reader. Never read input values or credentials.
// Chrome owns saved-login autofill. Only exact sign-in controls may be clicked.
(() => {
  const source=location.hostname.endsWith('wellsfargo.com')?'wells':location.hostname.endsWith('chase.com')?'chase'
    :location.hostname.endsWith('citi.com')?'citi':location.hostname==='www.paypal.com'?'paypal'
      :location.hostname==='www.wealthfront.com'?'wealthfront':null;
  const clicked=new Set();
  const visible=n=>n.getClientRects().length>0&&getComputedStyle(n).visibility!=='hidden'&&getComputedStyle(n).display!=='none';
  const text=n=>(n.innerText||'').replace(/\s+/g,' ').trim();
  const nodes=()=>{
    const roots=[document],out=[];
    for(let i=0;i<roots.length&&i<64;i++)for(const n of roots[i].querySelectorAll('*')){out.push(n);if(n.shadowRoot)roots.push(n.shadowRoot);}
    return out.filter(visible);
  };
  const inspect=()=>{
    const all=nodes(),inputs=all.filter(n=>n.tagName==='INPUT'&&!n.disabled);
    if(inputs.some(n=>n.autocomplete==='one-time-code'||/^(otp|verificationcode|securitycode)$/i.test(n.name||''))
      ||all.some(n=>n.matches('h1,h2,[role=heading],label')&&/^(verify (your|it's you)|confirm your identity|verification code|security code|check your (phone|text)|two.step verification)/i.test(text(n))))return {state:'auth_required'};
    const controls=all.filter(n=>n.matches('a,button,[role=button],[role=link]')&&!n.disabled&&n.getAttribute('aria-disabled')!=='true');
    const passwords=inputs.filter(n=>n.type==='password');
    if(!passwords.length){
      const signOutControl=controls.some(n=>/^(sign (out|off)|log out)$/i.test(text(n)));
      const account=source==='wells'?all.some(n=>n.matches('a,button,h1,h2,[role=link]')&&/^(everyday checking|account summary|account activity)\b/i.test(text(n)))
        :source==='chase'?all.some(n=>n.id==='mds-navigation-bar-exp-heading'&&/^(Prime Visa|Sapphire Preferred) \(/.test(text(n)))
          :source==='citi'?all.some(n=>n.id==='signOffmainAnchor')
            :source==='paypal'?location.pathname.startsWith('/myaccount/')&&all.some(n=>n.matches('a,button,h1,h2')&&/^(PayPal Credit|PayPal Credit Card|Special financing|See all)$/i.test(text(n)))
              :source==='wealthfront'?all.some(n=>n.children.length===0&&text(n)==='Individual Cash Account'):false;
      if(signOutControl||account)return {state:'authenticated'};
    }
    let targets=[],action;
    if(passwords.length===1){
      // Check CSS autofill state, not .value, length, contents, or browser storage.
      const autofilled=n=>{try{return n.matches(':-webkit-autofill');}catch{return false;}};
      const names=inputs.filter(n=>n.autocomplete==='username'||n.type==='email'||/^(user(name|id)?|loginid|j_username)$/i.test(n.name||n.id||''));
      if(!autofilled(passwords[0])||names.some(n=>!autofilled(n)))return {state:'auth_required'};
      const form=passwords[0].closest('form');
      targets=controls.filter(n=>n.tagName==='BUTTON'&&(!form||form.contains(n))&&/^(sign (in|on)|log in|login)$/i.test(text(n)));
      action='autofill_submit';
    }else{
      targets=controls.filter(n=>/^(sign (in|on)|log in|login)$/i.test(text(n))&&(()=>{
        // Bank SPA sign-in links can be anchors without href or buttons.
        // They are still exact, visible controls in this bank's document.
        if(!n.href)return true;
        try{const u=new URL(n.href);return u.protocol==='https:'&&(u.hostname===location.hostname||u.hostname.endsWith('.'+(source==='wells'?'wellsfargo':source)+'.com'));}catch{return false;}
      })());action='open_sign_in';
    }
    if(targets.length!==1||clicked.has(action))return {state:passwords.length||targets.length?'auth_required':'waiting'};
    const n=targets[0];n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();
    if(r.width<2||r.height<2)return {state:'waiting'};
    clicked.add(action);return {state:'click',action,rect:[r.x,r.y,r.width,r.height]};
  };
  chrome.runtime.onMessage.addListener((m,s,reply)=>{
    if(m?.command!=='prepare_collector_account')return;
    if(typeof m.requestId==='string')globalThis.budgetCollectorRequest=m.requestId;
    reply({...inspect(),accepted:true});
  });
})();
