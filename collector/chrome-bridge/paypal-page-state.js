// Financing only. No credentials, payments, transaction-history or hidden state.
const paypalVisible=n=>n&&n.getClientRects().length>0&&getComputedStyle(n).visibility!=='hidden';
const paypalText=n=>(n?.innerText||'').replace(/\s+/g,' ').trim();
function paypalCards(){
  return [...document.querySelectorAll('section')].filter(paypalVisible).flatMap(s=>{
    const h=s.querySelector('h2'),section=paypalText(h);
    if(!['Expiring','Active','Paid off'].includes(section))return [];
    return [...s.querySelectorAll('a[role="link"]')].filter(paypalVisible).map(link=>{
      const p=[...link.querySelectorAll('p')].filter(paypalVisible).map(paypalText).filter(Boolean);
      return {link,section,merchant:p[0]||'',terms:p[1]||'',amount:p[2]||'',valid:p.length===3};
    });
  });
}
async function capturePaypalFinancing(){
  const deadline=Date.now()+30000;
  const out={version:1,kind:'paypal_financing',finding:'not_ready',sections:[],rows:[]};
  const pause=()=>new Promise(r=>setTimeout(r,150));
  const until=async predicate=>{const start=Date.now();while(Date.now()-start<5000&&Date.now()<deadline){const value=predicate();if(value)return value;await pause();}return null;};
  const all=s=>[...document.querySelectorAll(s)].filter(paypalVisible);
  if(document.querySelectorAll('*').length>15000||all('input[type="password"]').length)return out;
  // Only follow exact links observed in the signed-in Credit dashboard/home.
  if(location.pathname!=='/myaccount/credit/paypal-credit/us/activities/financing'){
    const hrefs=['/myaccount/credit/paypal-credit/us/activities/financing','/myaccount/credit/paypal-credit/us'];
    for(const href of hrefs){const links=all('a[href]').filter(a=>{
      try { const url=new URL(a.href);return url.origin===location.origin&&url.pathname===href; }
      catch { return false; }
    });if(links.length===1){links[0].click();return out;}}
    return out;
  }
  if(all('[role="dialog"]').length)return out;
  const headings=all('section h2').map(paypalText);
  out.sections=headings.filter(s=>['Expiring','Active','Paid off'].includes(s));
  if(JSON.stringify(out.sections)!==JSON.stringify(['Expiring','Active','Paid off']))return out;
  const cards=paypalCards();if(!cards.length||cards.length>40||cards.some(c=>!c.valid))return out;
  const signature=()=>JSON.stringify(paypalCards().map(({link,valid,...c})=>c));
  const initial=signature();
  for(const card of cards){
    if(Date.now()>=deadline){out.finding='blocked';return out;}
    card.link.click();
    const dialog=await until(()=>{const ds=all('[role="dialog"]');return ds.length===1?ds[0]:null;});
    if(!dialog){out.finding='blocked';return out;}
    const ps=[...dialog.querySelectorAll('p')].filter(paypalVisible).map(paypalText);
    const value=label=>{const indices=ps.flatMap((p,i)=>p===label?[i]:[]);return indices.length===1?ps[indices[0]+1]||'':'';};
    if(ps[0]!==card.merchant||ps[1]!==card.terms||ps[2]!==card.amount){out.finding='blocked';return out;}
    const {link,valid,...row}=card;
    out.rows.push({...row,purchaseDate:value('Purchase date'),purchaseAmount:value('Purchase amount'),remainingBalance:value('Remaining balance'),expirationDate:value('Expiration date'),accruedInterest:value('Current accrued interest')});
    const close=[...dialog.querySelectorAll('button')].filter(n=>paypalVisible(n)&&paypalText(n)==='close');
    if(close.length!==1){out.finding='blocked';return out;}close[0].click();
    if(!await until(()=>all('[role="dialog"]').length===0)){out.finding='blocked';return out;}
    if(signature()!==initial){out.finding='blocked';return out;}
  }
  out.finding='captured';return out;
}
if(typeof chrome!=='undefined'&&chrome.runtime){
  let busy=false;
  const send=m=>chrome.runtime.sendMessage(m).catch(()=>{});
  chrome.runtime.onMessage.addListener((m,s,reply)=>{
    if(m?.command!=='capture_paypal_financing')return;reply({accepted:true});if(busy)return;busy=true;
    const start=Date.now();
    const attempt=async()=>{let candidate;try{candidate=await capturePaypalFinancing();}catch{candidate={version:1,kind:'paypal_financing',finding:'blocked',sections:[],rows:[]};}
      if(candidate.finding==='not_ready'&&Date.now()-start<30000){setTimeout(attempt,350);return;}
      busy=false;void send({event:'paypal_financing_capture',candidate});};void attempt();
  });
  void send({event:'paypal_page_ready'});setInterval(()=>void send({event:'paypal_page_ready'}),3000);
}
