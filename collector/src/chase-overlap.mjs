// Local-only incremental planning. No source data is returned by summary().
// Pending is a fresh snapshot, never deduplicated against last week's pending.
const key = row => JSON.stringify([row.state,row.sourceDate,row.description,row.sourceAmountMinor]);
const identityValid = i => i && ['prime_visa','sapphire_preferred'].includes(i.product) && /^\d{4}$/.test(i.suffix);
const sameIdentity = (a,b) => identityValid(a) && identityValid(b) && a.product===b.product && a.suffix===b.suffix;
const usable = r => r?.kind==='chase_normalized_activity' && Array.isArray(r.transactions)
  && r.rejectedRows===0 && Array.isArray(r.issues)
  && r.issues.every(code=>code==='pending_section_not_observed')
  && r.transactions.every(t => ['posted','pending'].includes(t.state) && typeof t.description==='string'
    && Number.isSafeInteger(t.sourceAmountMinor) && (t.state==='pending' || /^\d{4}-\d{2}-\d{2}$/.test(t.sourceDate)));

export function reconcileChaseOverlap(current, prior, {expectedProduct=null}={}) {
  const block = code => ({action:'blocked',code,overlapVerified:false,workbookReady:false});
  if (!usable(current)) return block('current_rows_unusable');
  if (!identityValid(current.identity)) return block('missing_account_identity');
  if (expectedProduct && current.identity.product!==expectedProduct) return block('requested_account_mismatch');
  if (!current.range) return block('missing_activity_range');
  const posted=current.transactions.filter(t=>t.state==='posted');
  if (!prior) return {action:'baseline_only',code:'first_page_baseline_requires_review',
    overlapVerified:false,workbookReady:false}; // Never sweep history to bootstrap.
  if (!sameIdentity(current.identity,prior.identity)) return block('anchor_account_mismatch');
  if (!usable(prior)) return block('prior_rows_unusable');
  const priorPosted=prior.transactions.filter(t=>t.state==='posted');
  // Persisted overlap is a multiset, not a guessed date cutoff or display-order
  // stopping point. Inspect every loaded posted row, including out-of-order posts.
  const anchors=priorPosted.slice(0,3);
  if (anchors.length<3) return block('insufficient_prior_anchor');
  const counts=new Map();
  for(const t of posted)counts.set(key(t),(counts.get(key(t))??0)+1);
  for(const t of anchors){
    const k=key(t),n=counts.get(k)??0;
    if(!n) return current.nextPage==='next_enabled'
      ? {action:'load_more',code:'anchor_missing_from_current_page',overlapVerified:false,workbookReady:false}
      : block('anchor_missing_from_selected_range');
    counts.set(k,n-1);
  }
  const priorCounts=new Map();
  for(const t of priorPosted)priorCounts.set(key(t),(priorCounts.get(key(t))??0)+1);
  const unmatchedPosted=[];
  for(const t of posted){
    const k=key(t),n=priorCounts.get(k)??0;
    if(n)priorCounts.set(k,n-1); else unmatchedPosted.push(t);
  }
  return {action:'stop',code:'posted_overlap_found',overlapVerified:true,
    unmatchedPosted,currentPending:current.transactions.filter(t=>t.state==='pending'),workbookReady:false};
}

// Drives bounded cumulative "See more" reads. Every page must retain the same
// account/range and all earlier posted occurrences, or the sequence is blocked.
export function createChaseAnchorSession(prior,{expectedProduct=null,maxMore=4}={}) {
  if(!Number.isInteger(maxMore)||maxMore<0||maxMore>8)throw new Error('INVALID_CHASE_PAGE_BOUND');
  let previous=null,requests=0,finished=false;
  return candidate => {
    const block=code=>{finished=true;return {action:'blocked',code,overlapVerified:false,workbookReady:false};};
    if(finished)return block('collection_already_finished');
    if(previous){
      if(!sameIdentity(previous.identity,candidate.identity)||previous.range!==candidate.range)return block('source_changed_during_paging');
      if(previous.pageToken===candidate.pageToken)return block('load_more_stalled');
      const counts=new Map();
      for(const t of candidate.transactions??[])if(t.state==='posted')counts.set(key(t),(counts.get(key(t))??0)+1);
      for(const t of previous.transactions.filter(t=>t.state==='posted')){
        const k=key(t),n=counts.get(k)??0;if(!n)return block('posted_rows_changed_during_paging');counts.set(k,n-1);
      }
    }
    const result=reconcileChaseOverlap(candidate,prior,{expectedProduct});
    if(result.action==='load_more'){
      if(requests>=maxMore)return block('anchor_page_limit');
      requests++;previous=structuredClone(candidate);
    }else finished=true;
    return result;
  };
}
export function chaseOverlapSummary(result) {
  return {action:result.action,code:result.code,overlapVerified:result.overlapVerified,
    unmatchedPosted:result.unmatchedPosted?.length??null,pendingRows:result.currentPending?.length??null,workbookReady:false};
}
