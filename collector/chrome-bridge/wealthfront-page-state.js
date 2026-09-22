// Observed Individual Cash Account summary. Never loads older activity or moves money.
const wfVisible=n=>n&&n.getClientRects().length>0&&getComputedStyle(n).visibility!=='hidden';
const wfText=n=>(n?.innerText||'').trim();
async function captureWealthfrontCash(){
  const c={version:1,kind:'wealthfront_cash',finding:'not_ready',stage:'account_page',accountId:'',title:'',total:'',available:'',unavailable:'',pending:'',rows:[]};
  const all=s=>[...document.querySelectorAll(s)].filter(wfVisible);
  if(document.querySelectorAll('*').length>15000){c.stage='page_limit';return c;}
  if(all('input[type="password"]').length){c.stage='authentication';return c;}
  const route=/^\/accounts\/([A-Za-z0-9-]+)(?:\/cash-activity)?\/?$/.exec(location.pathname);
  if(!route){
    const buttons=all('button').filter(n=>/^Individual Cash Account/.test(wfText(n)));
    if(buttons.length===1)buttons[0].click();return c;
  }
  // Use the visible account label, not its heading level or modal wrapper.
  const title=all('*').filter(n=>n.children.length===0&&wfText(n)==='Individual Cash Account');
  const balance=all('button').filter(n=>wfText(n)==='Available balance');
  if(!title.length){c.stage='account_label';return c;}
  c.accountId=route[1];c.title=wfText(title[0]);
  const readRows=()=>all('button').filter(n=>n.querySelector('h2')).map(n=>wfText(n).split(/\n+/).map(s=>s.trim()).filter(Boolean));
  const before=readRows();if(!before.length){c.stage='activity_rows_missing';return c;}
  if(before.length>100||before.some(r=>r.length!==4)){c.stage='activity_row_shape';return c;}
  // Keep the visible transaction snapshot immediately. Balance-dialog animation
  // must never erase rows that were already read successfully.
  c.rows=before.map(([description,amount,date,runningBalance])=>({description,amount,date,runningBalance}));
  c.finding='captured';
  c.stage='activity_captured';
  const until=async fn=>{const end=Date.now()+4000;while(Date.now()<end){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100));}return null;};
  const balanceDialogs=()=>all('[role="dialog"]').filter(n=>[...n.querySelectorAll('h1')].some(h=>wfText(h)==='Cash Account balances'));
  let dialogs=balanceDialogs(),opened=false;
  if(!dialogs.length){
    if(balance.length!==1){c.stage='balance_control_missing';return c;}
    // The activity page itself can be a dialog. Only allow that wrapper when
    // it contains both the observed balance control and activity rows; never
    // click behind a separate, unknown modal.
    const unrelated=all('[role="dialog"]').some(n=>!n.contains(balance[0])||!n.querySelector('button h2'));
    if(unrelated){c.stage='balance_dialog_blocked';return c;}
    balance[0].click();opened=true;
    await until(()=>balanceDialogs().length);
    dialogs=balanceDialogs();
  }
  // Nested activity wrappers may contain the same balance heading. Select the
  // innermost matching dialog, rejecting ambiguous independent dialogs.
  dialogs=dialogs.filter(n=>!dialogs.some(other=>other!==n&&n.contains(other)));
  if(dialogs.length!==1){c.stage='balance_dialog_missing';return c;}
  const dialog=dialogs[0];
  for(const [label,key] of [['Total balance','total'],['Available','available'],['Unavailable','unavailable'],['Pending','pending']]){
    const leaves=[...dialog.querySelectorAll('*')].filter(n=>wfVisible(n)&&n.children.length===0&&wfText(n)===label);
    if(leaves.length===1){const lines=wfText(leaves[0].parentElement.parentElement).split(/\n+/).map(s=>s.trim()).filter(Boolean);
      if(lines.length===2&&lines[0]===label)c[key]=lines[1];}
  }
  const close=[...dialog.querySelectorAll('button[aria-label="dismiss"]')].filter(wfVisible);
  if(opened&&close.length===1){close[0].click();await until(()=>!wfVisible(dialog));}
  if(['total','available','unavailable','pending'].some(k=>!c[k]))c.stage='balance_fields_missing';
  return c;
}
if(typeof chrome!=='undefined'&&chrome.runtime){
  let busy=false;const send=m=>chrome.runtime.sendMessage(m).catch(()=>{});
  chrome.runtime.onMessage.addListener((m,s,reply)=>{
    if(m?.command!=='capture_wealthfront_cash')return;reply({accepted:true});if(busy)return;busy=true;const start=Date.now();
    const attempt=async()=>{let candidate;try{candidate=await captureWealthfrontCash();}catch{candidate={version:1,kind:'wealthfront_cash',finding:'blocked',accountId:'',title:'',total:'',available:'',unavailable:'',pending:'',rows:[]};}
      if(candidate.finding==='not_ready'&&Date.now()-start<30000){setTimeout(attempt,350);return;}
      busy=false;void send({event:'wealthfront_cash_capture',candidate});};void attempt();
  });void send({event:'wealthfront_page_ready'});setInterval(()=>void send({event:'wealthfront_page_ready'}),3000);
}
