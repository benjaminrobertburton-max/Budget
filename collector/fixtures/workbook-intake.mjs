// Entirely fictional source evidence for the portable workbook boundary.
import {randomUUID} from 'node:crypto';
export const INTAKE_NOW=new Date('2031-09-09T14:00:00Z');
export const INTAKE_BINDINGS={wells:'1111',chase_sapphire:'2222',chase_prime:'3333'};
export function intakeRecords(){
  const wrap=(source,payload)=>({reference:`local:evidence:${randomUUID()}`,
    record:{version:1,kind:'budget-collector-source-evidence',source,capturedAt:INTAKE_NOW.toISOString(),payload}});
  const base={version:1,kind:'activity_candidate',coverageVerified:false,workbookReady:false,
    finding:'candidate_read',hasFrames:false,layout:{tableCount:1,rowCount:3,headerCount:4,hasShadowRoots:false,tables:[]}};
  const wells={...base,source:{accountSuffix:'1111',balances:[{type:'available',text:'$950.00'},{type:'ledger',text:'$950.00'}],nextPage:'next_disabled',pageToken:'01234567'},
    tables:[{columns:['date','description','credit','debit'],headers:['Date','Description','Deposits/Credits','Withdrawals/Debits'],
      rows:[['Pending Transactions'],['No pending transactions to view.'],['Posted Transactions'],
        ['09/08/2031','FICTIONAL PAYROLL','$500.00',''],['09/07/2031','FICTIONAL TRANSFER','','$25.00']],issues:[]}]};
  const card=(product,suffix,pending)=>({...base,source:{accountSuffix:suffix,balances:[{type:'current_balance',text:'$25.00'},
    {type:'remaining_statement_balance',text:'$0.00'},{type:'available_credit',text:'$475.00'}],nextPage:'next_disabled',pageToken:'12345678',
    chase:{product,range:'Activity since last statement',postedFooter:"You've reached the end of your account activity.",pendingObserved:pending,
      pendingHeader:pending?'Pending (1)':'',pendingSummary:pending?'Pending (1) Pending charges: $3.00':'',obligation:'no_payment_due'}},
    tables:[...(pending?[{columns:['date','description','amount'],headers:['Date','Description','Amount'],
      rows:[['Pending Transactions'],['Pending','FICTIONAL PENDING','$3.00']],issues:[]}]:[]),
      {columns:['date','description','amount'],headers:['Date','Description','Amount'],
        rows:[['Posted Transactions'],['Sep 8, 2031','FICTIONAL SHOP','$4.00']],issues:[]}]});
  return {wells:wrap('wells',wells),chase_sapphire:wrap('chase',card('sapphire_preferred','2222',true)),chase_prime:wrap('chase',card('prime_visa','3333',false))};
}
