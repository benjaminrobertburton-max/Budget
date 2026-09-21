import { validateActivityCandidate } from './activity-probe.mjs';
import { parseMoney, sumMinor } from './money.mjs';
import { validDate } from './contracts.mjs';

// Parses private evidence without claiming that one page covers an account.
// No inferred bank IDs, duplicate removal, or budget categories.
export function normalizeWellsActivity(candidate, evidenceRef, capturedAt, { hasPriorAnchor = false } = {}) {
  validateActivityCandidate(candidate);
  const transactions = [], issues = new Set();
  const balances = [];
  let pendingEmpty = false;
  const sections = new Set();
  if (candidate.tables.length !== 1) issues.add('ambiguous_table');
  for (const [ti, table] of candidate.tables.entries()) {
    let section = null;
    const columns = table.columns;
    const index = name => columns.indexOf(name);
    if (['date', 'description', 'credit', 'debit'].some(name => columns.filter(c => c === name).length !== 1)) {
      issues.add('unsupported_columns'); continue;
    }
    for (const issue of table.issues) issues.add(issue);
    let totals = null;
    for (const [ri, row] of table.rows.entries()) {
      const nonempty = row.map(s => s.trim()).filter(Boolean);
      if (nonempty.length === 1 && /^(Pending|Posted) Transactions$/i.test(nonempty[0])) {
        section = nonempty[0].split(' ')[0].toLowerCase(); sections.add(section); continue;
      }
      if (nonempty.length === 1 && /^No pending transactions to view\.?$/i.test(nonempty[0])) {
        if (section !== 'pending') issues.add('misplaced_empty_pending');
        else pendingEmpty = true;
        continue;
      }
      if (!section) { issues.add('missing_section'); continue; }
      if (row.length !== columns.length) { issues.add('unrecognized_row'); continue; }
      try {
        const dateText = row[index('date')].trim();
        if (/^Totals$/i.test(dateText) && !row[index('description')].trim()) {
          if (totals || section !== 'posted') { issues.add('ambiguous_totals'); continue; }
          totals = {credit: parseMoney(row[index('credit')], 'USD'), debit: parseMoney(row[index('debit')], 'USD')};
          continue;
        }
        const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText);
        // Resolve short years only inside the current 10-year collection window.
        const short = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(dateText);
        const captureYear = new Date(capturedAt).getUTCFullYear();
        const years = short && Number.isInteger(captureYear) ? Array.from({length: 10}, (_, i) => captureYear - i).filter(y => y % 100 === Number(short[3])) : [];
        if (!match && years.length !== 1) { issues.add(short ? 'ambiguous_year' : !dateText ? 'empty_date' : 'invalid_date'); continue; }
        const parts = match || short;
        const date = `${match ? match[3] : years[0]}-${parts[1]}-${parts[2]}`;
        if (!validDate(date)) { issues.add('invalid_date'); continue; }
        const description = row[index('description')].trim();
        const credit = row[index('credit')].trim(), debit = row[index('debit')].trim();
        if (!description || Boolean(credit) === Boolean(debit)) { issues.add('ambiguous_amount'); continue; }
        const amount = parseMoney(credit || debit, 'USD');
        if (amount < 0) { issues.add('conflicting_sign'); continue; }
        transactions.push({ effectiveDate: date, postedDate: section === 'posted' ? date : null,
          description, amountMinor: credit ? amount : -amount, currency: 'USD', state: section,
          sourceId: null, evidenceRef: `${evidenceRef}:table-${ti}:row-${ri}` });
      } catch { issues.add('invalid_money'); }
    }
    if (totals) {
      const posted = transactions.filter(row => row.state === 'posted' && row.evidenceRef.startsWith(`${evidenceRef}:table-${ti}:`));
      if (totals.credit !== sumMinor(posted.filter(r => r.amountMinor >= 0).map(r => r.amountMinor))
        || totals.debit !== sumMinor(posted.filter(r => r.amountMinor < 0).map(r => -r.amountMinor))) issues.add('source_totals_mismatch');
    }
  }
  if (!sections.has('posted')) issues.add('missing_posted_section');
  if (!sections.has('pending')) issues.add('missing_pending_section');
  if (pendingEmpty && transactions.some(row => row.state === 'pending')) issues.add('contradictory_pending');
  if (candidate.source.accountSuffix === null) issues.add('missing_account_identity');
  for (const balance of candidate.source.balances) {
    try { balances.push({ type: balance.type, amountMinor: parseMoney(balance.text, 'USD') }); }
    catch { issues.add(`invalid_${balance.type}_balance`); }
  }
  if (!balances.some(balance => balance.type === 'available')) issues.add('missing_available_balance');
  if (!balances.some(balance => balance.type === 'ledger')) issues.add('missing_ledger_balance');
  if (candidate.source.nextPage !== 'next_disabled' && !hasPriorAnchor) issues.add(candidate.source.nextPage === 'next_stalled' ? 'pagination_stalled' : 'pagination_anchor_required');
  return { version: 1, kind: 'wells_normalized_activity', transactions, balances,
    accountSuffix: candidate.source.accountSuffix, nextPage: candidate.source.nextPage,
    pendingEmpty, issues: [...issues], workbookReady: false,
    remainingGates: ['history_reconciliation', 'workbook_mapping'] };
}

function transactionKey(row) {
  return `${row.state}\u0000${row.effectiveDate}\u0000${row.amountMinor}\u0000${row.description}`;
}

// Compare only encrypted local evidence. The three newest prior posted rows are
// an overlap anchor, not a claim that the table covers an entire account.
export function reconcileWellsOverlap(current, prior) {
  const block = code => ({ ...current, issues: [...current.issues, code],
    remainingGates: ['history_reconciliation', 'workbook_mapping'], workbookReady: false,
    overlapVerified: false, addedRows: 0 });
  if (!prior || prior.kind !== 'wells_normalized_activity') return block('missing_prior_anchor');
  if (prior.accountSuffix !== current.accountSuffix) return block('anchor_account_mismatch');
  const anchors = prior.transactions.filter(row => row.state === 'posted').slice(0, 3);
  if (anchors.length < 3) return block('insufficient_prior_anchor');
  const available = new Map();
  for (const row of current.transactions) available.set(transactionKey(row), (available.get(transactionKey(row)) ?? 0) + 1);
  for (const row of anchors) {
    const key = transactionKey(row);
    const count = available.get(key) ?? 0;
    if (!count) return block('anchor_missing_from_current_page');
    available.set(key, count - 1);
  }
  const priorCounts = new Map();
  for (const row of prior.transactions) priorCounts.set(transactionKey(row), (priorCounts.get(transactionKey(row)) ?? 0) + 1);
  const additions = [];
  for (const row of current.transactions) {
    const key = transactionKey(row), count = priorCounts.get(key) ?? 0;
    if (count) priorCounts.set(key, count - 1);
    else additions.push(row);
  }
  return { ...current, overlapVerified: true, addedRows: additions.length, newTransactions: additions,
    remainingGates: ['workbook_mapping'], workbookReady: false };
}

export function normalizationSummary(result) {
  return { parsedRows: result.transactions.length,
    postedRows: result.transactions.filter(row => row.state === 'posted').length,
    pendingRows: result.transactions.filter(row => row.state === 'pending').length,
    explicitEmptyPending: result.pendingEmpty, balanceTypes: result.balances.map(balance => balance.type),
    accountIdentified: result.accountSuffix !== null, nextPage: result.nextPage, issues: result.issues,
    overlapVerified: result.overlapVerified ?? false, addedRows: result.addedRows ?? null,
    stagedRows: result.ledgerStage?.length ?? 0,
    remainingGates: result.remainingGates, workbookReady: false };
}
