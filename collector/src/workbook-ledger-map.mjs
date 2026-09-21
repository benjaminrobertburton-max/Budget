import { createHash } from 'node:crypto';

const fixedRules = [
  [/CHASE CREDIT CRD EPAY|CITI CARD ONLINE PAYMENT/i, 'Credit-card payment', 'Exclude'],
  [/PAYPAL INST XFER/i, 'PayPal promotional payoff', 'Exclude'],
  [/FID BKG SVC/i, 'Fidelity Roth IRA', 'Transfer / verify'],
  [/ONLINE TRANSFER TO CREDIT UNION/i, 'Car reserve / CUTX', 'Transfer / verify'],
  [/ONLINE TRANSFER TO UMB/i, 'Rent reserve', 'Transfer / verify'],
  [/INSTANT PMT FROM WEALTHFRONT/i, 'Savings transfer', 'Transfer / verify'],
];

function classification(description) {
  const found = fixedRules.find(([pattern]) => pattern.test(description));
  return found ? { category: found[1], treatment: found[2], verification: 'Verified' }
    : { category: 'Needs classification', treatment: 'Needs classification', verification: 'Needs verification' };
}

// Explicitly maps normalized Wells cash-flow signs to the legacy workbook's
// expense-column convention. Unknown descriptions remain non-counting rows.
export function mapWellsToLedgerStage(reconciled) {
  if (!reconciled?.overlapVerified || reconciled.issues?.length) throw new Error('WELLS_STAGE_BLOCKED');
  const seen = new Map();
  return (reconciled.newTransactions ?? []).map(transaction => {
    const rule = classification(transaction.description);
    const base = `${transaction.effectiveDate}\u0000${transaction.amountMinor}\u0000${transaction.description}`;
    const occurrence = (seen.get(base) ?? 0) + 1; seen.set(base, occurrence);
    const digest = createHash('sha256').update(base).digest('hex').slice(0, 16);
    return {
      account: 'Wells Fargo', transactionDate: transaction.effectiveDate, description: transaction.description,
      // Collector cash-flow: outflow negative. Legacy ledger: expense positive.
      expenseAmount: -transaction.amountMinor / 100, status: transaction.state === 'pending' ? 'Pending' : 'Posted',
      category: rule.category, treatment: rule.treatment,
      uniqueKey: `wells-${digest}-${occurrence}`, reviewNote: 'Collected locally; source rule applied.',
      sourceArchive: transaction.evidenceRef, visibleSection: transaction.state === 'pending' ? 'Pending transactions' : 'Posted transactions',
      verification: rule.verification,
    };
  });
}
