import { validateActivityCandidate } from './activity-probe.mjs';
import { parseMoney } from './money.mjs';
import { validDate } from './contracts.mjs';

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const gates = ['account_binding_unverified','balances_unverified','obligations_unverified',
  'pending_coverage_unverified','posted_coverage_unverified','history_reconciliation_required'];

// Only observed full-year date forms. Never infer a posting date from display
// order or a date's unspecified meaning; Pending is a status, not a date.
function sourceDate(text) {
  const numeric = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const named = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/.exec(text);
  const value = numeric ? `${numeric[3]}-${numeric[1]}-${numeric[2]}`
    : named ? `${named[3]}-${String(months.indexOf(named[1])+1).padStart(2,'0')}-${named[2].padStart(2,'0')}` : null;
  return validDate(value) ? value : null;
}

// Private evidence processing, not a ledger import. sourceAmountMinor retains
// Chase's displayed sign; it is NOT a Wells cash-flow sign or a spending category.
// Original strings/duplicates/row references are retained, never deduplicated.
export function normalizeChaseActivity(candidate, evidenceRef) {
  validateActivityCandidate(candidate);
  const issues = new Set(), transactions = [], sections = new Set();
  let observedRows = 0, rejectedRows = 0;
  if (candidate.finding !== 'candidate_read') issues.add('missing_activity_candidate');
  for (const [ti, table] of candidate.tables.entries()) {
    const columns = table.columns.map((column,i) => column === 'unknown' && table.headers[i].trim() === 'Category'
      ? 'source_category' : column);
    const index = name => columns.indexOf(name);
    const validColumns = ['date','description','amount'].every(name => columns.filter(c=>c===name).length===1)
      && columns.filter(c=>c==='source_category').length<=1
      && columns.every(c=>['date','description','amount','source_category','details_control'].includes(c));
    if (!validColumns) issues.add('unsupported_columns');
    for (const issue of table.issues) {
      // Category is source evidence, never a household-budget classification.
      if (issue !== 'unknown_columns' || columns.includes('unknown')) issues.add('table_validation_issue');
    }
    const marker = table.rows[0];
    const section = marker?.length===1 && marker[0]==='Posted Transactions' ? 'posted'
      : marker?.length===1 && marker[0]==='Pending Transactions' ? 'pending' : null;
    const repeated = section && sections.has(section);
    if (!section || repeated) issues.add('ambiguous_section');
    if (section) sections.add(section);
    for (let ri=section ? 1 : 0;ri<table.rows.length;ri++) {
      observedRows++;
      const row=table.rows[ri];
      if (!validColumns || !section || repeated || row.length!==columns.length) {
        rejectedRows++; issues.add('unrecognized_row'); continue;
      }
      const dateText=row[index('date')].trim(), description=row[index('description')].trim();
      const date=sourceDate(dateText);
      if (!date && !(section==='pending' && dateText==='Pending')) {
        rejectedRows++; issues.add('invalid_or_missing_date'); continue;
      }
      if (!description) { rejectedRows++; issues.add('missing_description'); continue; }
      let amount;
      try { amount=parseMoney(row[index('amount')], 'USD'); }
      catch { rejectedRows++; issues.add('invalid_amount'); continue; }
      transactions.push({ sourceDate:date, sourceDateText:row[index('date')],
        description:row[index('description')], sourceAmountMinor:amount, sourceAmountText:row[index('amount')],
        sourceCategory:index('source_category')<0 ? null : row[index('source_category')],
        state:section, sourceId:null, postedDate:null, budgetCategory:null,
        evidenceRef:`${evidenceRef}:table-${ti}:row-${ri}` });
    }
  }
  const pendingMatch=/^Pending \((\d+)\)$/.exec(candidate.source.chase?.pendingHeader??'');
  const pendingExpected=pendingMatch?Number(pendingMatch[1]):null;
  const pendingActual=transactions.filter(t=>t.state==='pending').length;
  const pendingCountVerified=Number.isSafeInteger(pendingExpected)&&pendingExpected===pendingActual
    &&rejectedRows===0&&(sections.has('pending')||pendingExpected===0);
  if(pendingExpected!==null&&!pendingCountVerified)issues.add('pending_count_mismatch');
  const pendingSummary=/^Pending \((\d+)\) Pending charges: (.+)$/.exec(candidate.source.chase?.pendingSummary??'');
  let pendingTotalVerified=false;
  if(pendingSummary){
    try{
      const expected=parseMoney(pendingSummary[2],'USD');
      let actual=0;
      for(const row of transactions.filter(t=>t.state==='pending')){
        actual+=row.sourceAmountMinor;if(!Number.isSafeInteger(actual))throw new Error('OVERFLOW');
      }
      pendingTotalVerified=pendingCountVerified&&Number(pendingSummary[1])===pendingExpected&&actual===expected;
      if(!pendingTotalVerified)issues.add('pending_total_mismatch');
    }catch{issues.add('invalid_pending_total');}
  }
  if (!sections.has('pending')&&!pendingCountVerified) issues.add('pending_section_not_observed');
  if (!sections.has('posted')) issues.add('posted_section_not_observed');
  const balances=[];
  for(const balance of candidate.source.balances){
    if(!['current_balance','remaining_statement_balance','available_credit'].includes(balance.type)
      || balances.some(b=>b.type===balance.type)){issues.add('invalid_balance_evidence');continue;}
    try{balances.push({type:balance.type,sourceAmountMinor:parseMoney(balance.text,'USD'),sourceAmountText:balance.text,evidenceRef});}
    catch{issues.add('invalid_balance_evidence');}
  }
  // No current reader supplies an independently verified account/range/count
  // contract. Neither a requested product nor an end-of-view footer clears it.
  return {version:1,kind:'chase_normalized_activity',transactions,balances,observedRows,rejectedRows,
    identity: candidate.source.chase?.product && candidate.source.accountSuffix
      ? {product:candidate.source.chase.product, suffix:candidate.source.accountSuffix} : null,
    range: candidate.source.chase?.range ?? null, nextPage:candidate.source.nextPage,
    pageToken:candidate.source.pageToken,
    pendingCountVerified,pendingTotalVerified,bankPaymentStatus:candidate.source.chase?.obligation??'unobserved',
    issues:[...issues],remainingGates:[...gates],coverageVerified:false,workbookReady:false};
}

// Recompute from validated evidence so arbitrary private issue strings cannot
// be forwarded. Only fixed codes/counts are allowed into normal CLI output.
export function chaseNormalizationSummary(candidate) {
  const result=normalizeChaseActivity(candidate,'private');
  return {parsedRows:result.transactions.length,observedRows:result.observedRows,rejectedRows:result.rejectedRows,
    pendingRows:result.transactions.filter(t=>t.state==='pending').length,
    postedRows:result.transactions.filter(t=>t.state==='posted').length,
    pendingCountVerified:result.pendingCountVerified,
    pendingTotalVerified:result.pendingTotalVerified,
    bankPaymentStatus:result.bankPaymentStatus,
    balanceTypes:result.balances.map(b=>b.type),issues:result.issues,remainingGates:result.remainingGates,coverageVerified:false,workbookReady:false};
}
