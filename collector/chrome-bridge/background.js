// This bridge talks only to the loopback collector and reviewed bank sources. It never reads,
// fills, submits, stores, or transmits credentials, cookies, form values, or
// browser storage. Chrome's own alarm wakes the installed extension; no helper
// tab, Chrome launch, or external web message is used. Read-only navigation
// uses short-lived tab-scoped debugger clicks, never a remote debugging port.
const LOCAL_BRIDGE = "http://127.0.0.1:43811";
const WELLS_SIGN_ON = "https://connect.secure.wellsfargo.com/auth/login/present?origin=cob";
const CHASE_SIGN_ON = "https://www.chase.com/";
const POLL_ALARM = "budget-collector-local-command";
let session = null;
let pollInFlight = false;
let wellsTabId = null;
let chaseTabId = null;
let citiTabId = null;
let pendingCitiCapture = false;
let citiReloaded = false;
let pendingChaseCapture = false;
let chaseDeliveryInFlight = false;
let chaseReloadAttempted = false;
let chaseMoreToken = null;
let chaseAfterToken = null;
const checkingNavigation = new Set();

async function send(path, body) {
  if (!session) return false;
  try {
    const response = await fetch(`${LOCAL_BRIDGE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Budget-Collector-Session": session },
      body: JSON.stringify(body), cache: "no-store",
    });
    if (response.status === 403) session = null;
    return response.ok;
  } catch { session = null; return false; }
}

async function startSession() {
  if (session) return true;
  try {
    const response = await fetch(`${LOCAL_BRIDGE}/v1/session`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
    });
    if (!response.ok) return false;
    const body = await response.json();
    if (!body || typeof body.session !== "string" || !/^[a-f0-9]{64}$/.test(body.session)) return false;
    session = body.session;
    return true;
  } catch { return false; }
}

async function nextCommand() {
  if (!session) return "none";
  try {
    const response = await fetch(`${LOCAL_BRIDGE}/v1/command`, {
      headers: { "X-Budget-Collector-Session": session }, cache: "no-store",
    });
    if (response.status === 403) { session = null; return "none"; }
    if (!response.ok) return "none";
    const body = await response.json();
    if (body?.version===1 && body.command==='capture_chase_more' && /^[a-f0-9]{8}$/.test(body.pageToken)) {
      chaseMoreToken=body.pageToken; return body.command;
    }
    return body?.version === 1 && ["none", "open_wells", "capture_wells_activity", "open_chase", "capture_chase_activity", "open_chase_sapphire", "open_chase_prime", "capture_citi_activity"].includes(body.command)
      ? body.command : "none";
  } catch { session = null; return "none"; }
}

async function probe(tabId) {
  if (!Number.isInteger(tabId)) return false;
  wellsTabId = tabId;
  const delivered = await chrome.tabs.sendMessage(tabId, { command: "probe_wells_state" })
    .then(() => true)
    .catch(() => false);
  // An already-open Wells tab can predate an extension update. Reloading that
  // same tab is the only recovery; it creates no tab and cannot loop.
  if (!delivered) await chrome.tabs.reload(tabId).catch(() => {});
  return delivered;
}

async function openOrReuseWells() {
  const existing = await chrome.tabs.query({ url: ["https://connect.secure.wellsfargo.com/accounts/*"] });
  const reusable = existing.find(tab => Number.isInteger(tab.id));
  if (reusable?.id) {
    await probe(reusable.id);
    await send("/v1/progress", { version: 1, event: "wells_opened", tabId: reusable.id });
    return;
  }
  const tab = await chrome.tabs.create({ url: WELLS_SIGN_ON, active: true });
  wellsTabId = Number.isInteger(tab.id) ? tab.id : null;
  await send("/v1/progress", { version: 1, event: "wells_opened", tabId: wellsTabId });
}

async function openOrReuseChase() {
  const existing = await chrome.tabs.query({ url: ["https://*.chase.com/*"] });
  const reusable = existing.find(tab => Number.isInteger(tab.id));
  if (reusable?.id) {
    chaseTabId = reusable.id;
    const delivered = await chrome.tabs.sendMessage(reusable.id, { command: "probe_chase_state" })
      .then(() => true).catch(() => false);
    if (!delivered) await chrome.tabs.reload(reusable.id).catch(() => {});
    await send("/v1/progress", { version: 1, event: "chase_opened", tabId: reusable.id });
    return;
  }
  const tab = await chrome.tabs.create({ url: CHASE_SIGN_ON, active: true });
  chaseTabId = Number.isInteger(tab.id) ? tab.id : null;
  await send("/v1/progress", { version: 1, event: "chase_opened", tabId: chaseTabId });
}

// Runs inside the designated bank tab. Returns only a fixed state and a
// viewport rectangle, never source text or account identifiers.
function chaseNavigationStep(label, completed) {
  const roots=[document], nodes=[];
  for(let i=0;i<roots.length && i<256;i++)for(const n of roots[i].querySelectorAll('*')){
    nodes.push(n);if(n.shadowRoot)roots.push(n.shadowRoot);
  }
  const visible=n=>n.getClientRects().length>0&&getComputedStyle(n).display!=='none'&&getComputedStyle(n).visibility!=='hidden';
  const text=n=>(n.innerText||'').replace(/\s+/g,' ').trim();
  const controls=nodes.filter(n=>n.matches('a,button,[role=link],[role=button]')&&visible(n)&&!n.disabled&&n.getAttribute('aria-disabled')!=='true');
  if(!controls.some(n=>/^Sign out$/i.test(text(n)))){
    const auth=nodes.some(n=>n.tagName==='INPUT'&&visible(n)&&!n.disabled
      &&(n.type==='password'||/^(username|current-password|one-time-code)$/.test(n.autocomplete)));
    return {state:auth?'auth_required':'waiting'};
  }
  const headings=nodes.filter(n=>n.id==='mds-navigation-bar-exp-heading'&&visible(n));
  if(headings.length===1&&text(headings[0]).startsWith(label+' ('))return {state:'ready'};
  if(completed.includes('select'))return {state:'waiting'};
  const choices=controls.filter(n=>text(n).startsWith(label+' ('));
  let candidates=choices,action='select';
  if(!choices.length){
    if(completed.includes('overview'))return {state:'waiting'};
    candidates=controls.filter(n=>text(n)==='Overview');action='overview';
    if(!candidates.length){
      if(completed.includes('accounts'))return {state:'waiting'};
      candidates=controls.filter(n=>text(n)==='Accounts');action='accounts';
    }
  }
  if(candidates.length!==1)return {state:candidates.length?'ambiguous':'waiting'};
  const n=candidates[0];n.scrollIntoView({block:'center'});
  const r=n.getBoundingClientRect();return {state:'click',action,rect:[r.x,r.y,r.width,r.height]};
}

async function navigateChaseAccount(tabId, label) {
  if (!Number.isInteger(tabId) || !["Sapphire Preferred", "Prime Visa"].includes(label)) return false;
  const target = { tabId };
  try {
    await chrome.debugger.attach(target, "1.3");
    const completed=[];
    for(let attempt=0;attempt<60;attempt++){
      const response=await chrome.debugger.sendCommand(target,'Runtime.evaluate',{returnByValue:true,
        expression:`(${chaseNavigationStep.toString()})(${JSON.stringify(label)},${JSON.stringify(completed)})`});
      const step=response?.result?.value;
      if(step?.state==='ready'){await deliverChaseCapture(tabId);return true;}
      if(step?.state==='auth_required'||step?.state==='ambiguous')return false;
      if(step?.state==='click'){
        const rect=step.rect;
        if(!['accounts','overview','select'].includes(step.action)||completed.includes(step.action)
          ||!Array.isArray(rect)||rect.length!==4||!rect.every(Number.isFinite)||rect[2]<2||rect[3]<2)return false;
        const x=rect[0]+rect[2]/2,y=rect[1]+rect[3]/2;
        await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
        await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
        completed.push(step.action);
      }else if(step?.state!=='waiting')return false;
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    return false;
  } catch { return false; }
  finally { await chrome.debugger.detach(target).catch(() => {}); }
}

async function deliverChaseCapture(tabId) {
  if (!Number.isInteger(tabId) || chaseDeliveryInFlight) return false;
  chaseDeliveryInFlight = true;
  try {
  pendingChaseCapture = true;
  const frames = await chrome.webNavigation.getAllFrames({ tabId }).catch(() => []);
  const frameIds = frames.map(frame => frame.frameId).filter(Number.isInteger);
  const acknowledgements = await Promise.all((frameIds.length ? frameIds : [0]).map(frameId =>
    chrome.tabs.sendMessage(tabId, { command: "capture_chase_activity", afterPageToken:chaseAfterToken }, { frameId })
      .then(response => response?.accepted === true).catch(() => false)));
  if (acknowledgements.some(Boolean)) {
    pendingChaseCapture = false;
    await send("/v1/progress", { version: 1, event: "chase_capture_dispatched", tabId });
    return true;
  }
  // Extension reloads invalidate existing content-script contexts. Reload only
  // this same Chase tab; its ready event below performs one bounded retry.
  if (!chaseReloadAttempted) {
    chaseReloadAttempted = true;
    await chrome.tabs.reload(tabId).catch(() => {});
  } else {
    pendingChaseCapture = false;
    await send("/v1/progress", { version: 1, event: "chase_delivery_failed", tabId });
  }
  return false;
  } finally { chaseDeliveryInFlight = false; }
}

async function loadMoreChase(tabId,pageToken) {
  if(!Number.isInteger(tabId)||!/^[a-f0-9]{8}$/.test(pageToken))return;
  const guard=await chrome.tabs.sendMessage(tabId,{command:'check_chase_more',pageToken},{frameId:0}).catch(()=>null);
  if(guard?.accepted!==true){await send('/v1/progress',{version:1,event:'chase_delivery_failed',tabId});return;}
  const target={tabId};
  try {
    await chrome.debugger.attach(target,'1.3');
    const response=await chrome.debugger.sendCommand(target,'Runtime.evaluate',{returnByValue:true,
      expression:`(() => { const hosts=[...document.querySelectorAll('#activity_messages_id mds-button')]; const nodes=hosts.flatMap(h=>h.shadowRoot?[...h.shadowRoot.querySelectorAll('button')]:[]).filter(b=>!b.disabled&&/^(See more activity)(?: \\1)?$/.test((b.innerText||'').replace(/\\s+/g,' ').trim())); if(nodes.length!==1)return null; const b=nodes[0]; b.scrollIntoView({block:'center'}); const r=b.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; })()`});
    const rect=response?.result?.value;
    if(!Array.isArray(rect)||rect.length!==4||!rect.every(Number.isFinite)||rect[2]<2||rect[3]<2)throw new Error('NO_CONTROL');
    const x=rect[0]+rect[2]/2,y=rect[1]+rect[3]/2;
    await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
    await chrome.debugger.sendCommand(target,'Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
    chaseAfterToken=pageToken;
    await deliverChaseCapture(tabId);
  }catch{await send('/v1/progress',{version:1,event:'chase_delivery_failed',tabId});}
  finally{await chrome.debugger.detach(target).catch(()=>{});}
}

async function navigateChecking(tabId) {
  if (!Number.isInteger(tabId) || checkingNavigation.has(tabId)) return;
  checkingNavigation.add(tabId);
  const target = { tabId };
  try {
    await chrome.debugger.attach(target, "1.3");
    // Return only a viewport rectangle for the visible product link. No page
    // text, URL, account identifier, balance, cookie, or form value is read.
    const response = await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => { const a = [...document.querySelectorAll('a,button,[role="link"],[role="button"]')].find(x => /^\\s*everyday checking\\b/i.test(x.innerText || '')); if (!a) return null; const r = a.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`,
    });
    const rect = response?.result?.value;
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(value => typeof value === "number" && Number.isFinite(value)) || rect[2] < 2 || rect[3] < 2) return;
    const x = rect[0] + rect[2] / 2;
    const y = rect[1] + rect[3] / 2;
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  } catch {
    // A stale tab or unsupported page fails closed; no retry loop is allowed.
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
    checkingNavigation.delete(tabId);
  }
}

async function navigateNextActivityPage(tabId, pageToken) {
  if (!Number.isInteger(tabId) || !/^[a-f0-9]{8}$/.test(pageToken)) return false;
  const target = { tabId };
  try {
    await chrome.debugger.attach(target, "1.3");
    // Find only the visible pagination control and return its rectangle. The
    // extension never reads the table, account, or any form/credential value.
    const response = await chrome.debugger.sendCommand(target, "Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => { const a = [...document.querySelectorAll('a,button,[role="link"],[role="button"]')].filter(x => /^\\s*next\\s*$/i.test((x.innerText || '').trim())).find(x => !x.disabled && x.getAttribute('aria-disabled') !== 'true'); if (!a) return null; const r = a.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`,
    });
    const rect = response?.result?.value;
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(value => typeof value === "number" && Number.isFinite(value)) || rect[2] < 2 || rect[3] < 2) return false;
    const x = rect[0] + rect[2] / 2, y = rect[1] + rect[3] / 2;
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    // The content reader waits until the visible table has a new page token.
    // A bounded delay avoids issuing the next capture against the old page.
    setTimeout(() => { void chrome.tabs.sendMessage(tabId, { command: "capture_wells_after_next", pageToken }).catch(() => {}); }, 700);
    return true;
  } catch { return false; }
  finally { await chrome.debugger.detach(target).catch(() => {}); }
}

async function pollCommand() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    if (!await startSession()) return;
    const command = await nextCommand();
    if(command==='capture_citi_activity'){
      const tabs=await chrome.tabs.query({url:['https://*.citi.com/*']});
      // Never select an arbitrary account tab if more than one Citi page is open.
      if(tabs.length===1&&Number.isInteger(tabs[0].id)){
        citiTabId=tabs[0].id;pendingCitiCapture=true;
        const delivered=await chrome.tabs.sendMessage(citiTabId,{command:'capture_citi_activity'},{frameId:0}).then(r=>r?.accepted===true).catch(()=>false);
        if(delivered)pendingCitiCapture=false;
        else if(!citiReloaded){citiReloaded=true;await chrome.tabs.reload(citiTabId);}
      }
    }
    if (command === "open_wells") await openOrReuseWells();
    if (command === "open_chase") await openOrReuseChase();
    if (command === 'capture_chase_more') { const token=chaseMoreToken; chaseMoreToken=null; await loadMoreChase(chaseTabId,token); }
    if (['open_chase','open_chase_prime','open_chase_sapphire'].includes(command)) chaseAfterToken=null;
    if (["open_chase_sapphire", "open_chase_prime"].includes(command)) {
      if (!Number.isInteger(chaseTabId)) await openOrReuseChase();
      const navigated=Number.isInteger(chaseTabId)&&await navigateChaseAccount(chaseTabId, command === "open_chase_sapphire" ? "Sapphire Preferred" : "Prime Visa");
      if(!navigated)await send('/v1/progress',{version:1,event:'chase_delivery_failed',tabId:chaseTabId});
    }
    if (command === "capture_wells_activity" && Number.isInteger(wellsTabId)) {
      const frames = await chrome.webNavigation.getAllFrames({ tabId: wellsTabId }).catch(() => []);
      const frameIds = frames.map(frame => frame.frameId).filter(Number.isInteger);
      await Promise.all((frameIds.length ? frameIds : [0]).map(frameId =>
        chrome.tabs.sendMessage(wellsTabId, { command: "capture_wells_activity" }, { frameId }).catch(() => {})));
    }
    if (command === "capture_chase_activity" && Number.isInteger(chaseTabId)) await deliverChaseCapture(chaseTabId);
  } finally { pollInFlight = false; }
}

// Chrome permits a minimum 30-second repeating MV3 alarm. It is the supported
// invisible wake path while no Wells tab is open; once Wells is open, its page
// heartbeat calls pollCommand immediately.
chrome.alarms.create(POLL_ALARM, { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === POLL_ALARM) void pollCommand(); });
chrome.runtime.onStartup.addListener(() => void pollCommand());
chrome.runtime.onInstalled.addListener(() => void pollCommand());

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || typeof message !== "object" || sender.id !== chrome.runtime.id) return;
  const tabId = Number.isInteger(sender.tab?.id) ? sender.tab.id : null;
  if(message.event==='citi_page_ready'){
    if(tabId===citiTabId&&pendingCitiCapture){
      pendingCitiCapture=false;
      void chrome.tabs.sendMessage(tabId,{command:'capture_citi_activity'},{frameId:0}).catch(()=>{});
    }else void pollCommand();
    return;
  }
  if(message.event==='citi_activity_capture'){
    if(session&&tabId===citiTabId&&sender.frameId===0&&/^https:\/\/([a-z0-9-]+\.)*citi\.com\//i.test(sender.url||'')&&message.candidate)
      void send('/v1/citi-activity',message.candidate).then(()=>pollCommand());
    return;
  }
  if (message.event === "collector_page_ready") { void pollCommand(); return; }
  if (message.event === "chase_page_ready") {
    if (tabId === chaseTabId && pendingChaseCapture) void deliverChaseCapture(tabId);
    else void pollCommand();
    return;
  }
  if (message.event === "checking_navigation_required" && tabId !== null) {
    wellsTabId = tabId;
    void navigateChecking(tabId);
    return;
  }
  if (!session || tabId === null) return;
  if (message.event === "activity_capture" && tabId === wellsTabId && message.candidate) {
    // The top Wells shell often reports an empty candidate while the child
    // activity frame is still loading. That is not terminal; wait for the
    // frame that owns transaction-table to submit its candidate.
    if (sender.frameId === 0 && message.candidate.finding === "no_activity_table") return;
    // Weekly collection is incremental. The first visible page is sufficient
    // whenever it includes the locally saved prior-import anchor. A later
    // anchor-aware command may call navigateNextActivityPage only if that anchor
    // is absent; never sweep account history merely because Next is available.
    void send("/v1/activity", message.candidate);
    return;
  }
  if (message.event === "chase_activity_capture" && tabId === chaseTabId && message.candidate) {
    // Chase discovery needs an explicit fixed no-table outcome on the account
    // dashboard. Unlike Wells, its current reader has no known child-frame
    // table contract to wait for; later frame candidates can still supersede it.
    void send("/v1/chase-activity", message.candidate);
    return;
  }
  // Authentication/navigation status belongs to the top document. Activity
  // candidates may legitimately come from a Wells child frame.
  if (sender.frameId !== undefined && sender.frameId !== 0) return;
  if (!['auth_required', 'authenticated_page', 'chase_auth_required', 'chase_authenticated_page'].includes(message.event)) return;
  if (message.event.startsWith('chase_')) {
    chaseTabId = tabId;
    void send("/v1/progress", { version: 1, event: message.event, tabId }).then(sent => {
      if (sent) void pollCommand();
    });
    return;
  }
  wellsTabId = tabId;
  void send("/v1/progress", { version: 1, event: message.event, tabId }).then(sent => {
    if (sent) void pollCommand();
  });
});
