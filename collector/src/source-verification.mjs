import {normalizeWellsActivity,reconcileWellsOverlap} from './wells-normalize.mjs';
import {normalizeChaseActivity} from './chase-normalize.mjs';
import {createChaseAnchorSession} from './chase-overlap.mjs';
import {normalizeCitiActivity} from './citi-normalize.mjs';
import {normalizePaypalFinancing,preparePaypalImport} from './paypal-normalize.mjs';
import {normalizeWealthfrontCash,prepareWealthfrontImport} from './wealthfront-normalize.mjs';
import {safeIssue} from './errors.mjs';

// Shared by live collection and offline replay. Results contain fixed codes and
// structural counts only; source fields remain in the encrypted record.
export function verifySourceCandidate(source,item,context,{chasePlans=new Map()}={}){
  const {config,workbookAnchors}=context,c=item.record.payload;
  const result={source,ok:false,code:null,issues:[],rowIssues:[],posted:0,pending:0,overlap:null};
  const reject=code=>({...result,code});
  try{
    if(!Number.isFinite(Date.parse(item.record.capturedAt))||Date.parse(item.record.capturedAt)>Date.now())return reject('CAPTURE_TIMESTAMP_INVALID');
    if(source==='wells'){
      if(c.source?.accountSuffix!==config.bindings.wells)return reject('WELLS_IDENTITY_BLOCKED');
      const prior=workbookAnchors?.wells??context.legacyWellsPrior??null;
      const n=normalizeWellsActivity(c,item.reference,item.record.capturedAt,{hasPriorAnchor:!!prior});
      result.issues=n.issues;result.rowIssues=n.rowIssues??[];
      result.posted=n.transactions.filter(r=>r.state==='posted').length;result.pending=n.transactions.length-result.posted;
      const r=prior?reconcileWellsOverlap(n,prior):null;
      result.overlap=r?.overlapVerified??null;
      if(n.issues.length)return reject('WELLS_ROW_VALIDATION_FAILED');
      if(workbookAnchors&&!prior)return reject('WELLS_ACCEPTED_ANCHOR_REQUIRED');
      if(r&&!r.overlapVerified){result.issues=r.issues;return reject('WELLS_ANCHOR_MISSING');}
    }else if(source.startsWith('chase_')){
      const product=source==='chase_prime'?'prime_visa':'sapphire_preferred';
      const n=normalizeChaseActivity(c,item.reference);
      result.issues=n.issues;result.posted=n.transactions.filter(r=>r.state==='posted').length;result.pending=n.transactions.length-result.posted;
      if(n.identity?.product!==product||n.identity?.suffix!==config.bindings[source])return reject('CHASE_IDENTITY_BLOCKED');
      if(n.issues.length)return reject('CHASE_ROW_VALIDATION_FAILED');
      if(workbookAnchors&&!workbookAnchors[source])return reject('CHASE_ACCEPTED_ANCHOR_REQUIRED');
      if(!chasePlans.has(source))chasePlans.set(source,createChaseAnchorSession(workbookAnchors?.[source]??null,{expectedProduct:product}));
      const decision=chasePlans.get(source)(n);result.overlap=decision.overlapVerified;
      if(decision.action==='load_more')return {...reject('CHASE_MORE_ACTIVITY_REQUIRED'),nextPageToken:c.source.pageToken};
      if(!['stop','baseline_only'].includes(decision.action)){result.issues=[...result.issues,decision.code];return reject('CHASE_ANCHOR_MISSING');}
    }else if(source==='citi'){
      const n=normalizeCitiActivity(c,item.reference,{acceptedAnchors:workbookAnchors?.citi});
      result.issues=n.issues;result.posted=n.transactions.filter(r=>r.state==='posted').length;result.pending=n.transactions.length-result.posted;
      if(n.identity?.suffix!==config.bindings.citi)return reject('CITI_IDENTITY_BLOCKED');
      if(!n.coverageVerified)return reject('CITI_SOURCE_VALIDATION_FAILED');
    }else if(source==='paypal'){
      const n=normalizePaypalFinancing(c);result.issues=n.issues;
      if(!n.coverageVerified)return reject('PAYPAL_SOURCE_VALIDATION_FAILED');
      if(config.paypalPromotions)preparePaypalImport(item,config.paypalPromotions,new Date());
    }else if(source==='wealthfront'){
      const n=normalizeWealthfrontCash(c);result.issues=n.issues;
      if(n.accountId!==config.wealthfront.accountId)return reject('WEALTHFRONT_IDENTITY_BLOCKED');
      if(!n.coverageVerified)return reject('WEALTHFRONT_SOURCE_VALIDATION_FAILED');
      if(context.wealthfrontPrior!==undefined)prepareWealthfrontImport(item,config.wealthfront,context.wealthfrontPrior,new Date());
    }else return reject('UNKNOWN_SOURCE');
    return {...result,ok:true};
  }catch(error){return reject(safeIssue(null,error).code);}
}
