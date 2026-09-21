// Observed Citi single-card dashboard. Read only rendered account/activity fields;
// never form values, cookies, storage, hidden dialogs or transaction-name columns.
function readCitiPage() {
  const visible=n=>n&&n.getClientRects().length>0&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden';
  const all=s=>[...document.querySelectorAll(s)].filter(visible);
  const text=n=>(n?.innerText||'').replace(/\s+/g,' ').trim();
  const one=s=>{const n=all(s);return n.length===1?text(n[0]):'';};
  const result={version:1,kind:'citi_activity',finding:'not_ready',identity:'',range:'',transactionFilter:'',memberFilter:'',
    currentBalance:'',availableCredit:'',statementBalance:'',minimumDue:'',dueDate:'',pendingTotal:'',postedTotal:'',rows:[],issues:[]};
  if(document.querySelectorAll('*').length>12000){result.finding='page_limit';return result;}
  if(all('input').some(n=>!n.disabled&&(n.type==='password'||/^(username|current-password|one-time-code)$/.test(n.autocomplete)))){
    result.finding='auth_required';return result;
  }
  if(!all('#signOffmainAnchor').length)return result;
  result.identity=one('#cardsBalanceTile .card-title');
  result.currentBalance=one('#cardsBalanceTile .current-balance');
  result.availableCredit=one('#cardsBalanceTile .available-credit-amount');
  result.range=one('#ums-timePeriodDropdown');
  result.transactionFilter=one('#ums-transactionTypeDropdown');
  result.memberFilter=one('#ums-cardMemberDropdown');
  for(const [label,key] of [['Last Statement Balance','statementBalance'],['Minimum Payment Due','minimumDue']]){
    const boxes=all('.balance-box').filter(n=>text(n.querySelector('.balance-label-text'))===label);
    if(boxes.length===1)result[key]=text(boxes[0].querySelector('.balance-amount'));
  }
  const dates=all('.payment-value').filter(n=>/^Payment due on /i.test(text(n.parentElement)));
  if(dates.length===1)result.dueDate=text(dates[0]);
  const tables=all('table.transaction-table');if(tables.length!==1)return result;
  const table=tables[0],headers=[...table.querySelectorAll('th')].map(text);
  if(JSON.stringify(headers)!==JSON.stringify(['','Date','Description','Name','Amount','Running Balance'])){
    result.issues.push('unsupported_headers');return result;
  }
  for(const [section,key] of [['pending','pendingTotal'],['posted','postedTotal']]){
    const totals=[...table.querySelectorAll('tr.total-header')].filter(n=>visible(n)&&n.classList.contains('pending')===(section==='pending'));
    if(totals.length===1){const labels=[...totals[0].querySelectorAll('.total-title')].filter(visible).map(text);
      if(labels[0]===(section==='pending'?'Pending Total':'Posted Total')&&labels.length===2)result[key]=labels[1];}
  }
  for(const row of table.querySelectorAll('tr')){
    if(!visible(row)||row.classList.contains('table-headers')||row.classList.contains('total-header')||row.classList.contains('gam-row'))continue;
    if(!row.classList.contains('transaction-row')){result.issues.push('unrecognized_row');continue;}
    const cells=[...row.querySelectorAll('td')];
    if(cells.length!==6||cells.some(c=>!visible(c))){result.issues.push('unsupported_row');continue;}
    result.rows.push({date:text(cells[1]),description:text(cells[2]),amount:text(cells[4]),state:row.classList.contains('pending')?'pending':'posted'});
    if(result.rows.length>=500){result.issues.push('row_limit');break;}
  }
  result.finding='captured';return result;
}

function revealCitiFilters(candidate){
  if(candidate.finding!=='captured'||candidate.transactionFilter&&candidate.memberFilter)return false;
  const buttons=[...document.querySelectorAll('#filter-by-cta')].filter(n=>n.getClientRects().length>0
    &&!n.disabled&&(n.innerText||'').trim()==='Filter By');
  if(buttons.length!==1)return false;
  // Expand the observed read-only panel; never change its selections/date range.
  buttons[0].click();return true;
}

if(typeof chrome!=='undefined'&&chrome.runtime){
  let busy=false;
  const send=m=>chrome.runtime.sendMessage(m).catch(()=>{});
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message?.command!=='capture_citi_activity')return;
    reply({accepted:true});if(busy)return;busy=true;
    const started=Date.now();
    let expanded=false;
    const attempt=()=>{
      const candidate=readCitiPage();
      if(!expanded&&revealCitiFilters(candidate)){expanded=true;setTimeout(attempt,350);return;}
      const ready=candidate.finding==='captured'&&candidate.identity&&candidate.currentBalance&&candidate.minimumDue&&candidate.pendingTotal&&candidate.postedTotal&&candidate.transactionFilter&&candidate.memberFilter;
      if(ready||candidate.finding==='auth_required'||Date.now()-started>=30000){
        busy=false;void send({event:'citi_activity_capture',candidate});
      }else setTimeout(attempt,350);
    };attempt();
  });
  void send({event:'citi_page_ready'});
  setInterval(()=>void send({event:'citi_page_ready'}),3000);
}
