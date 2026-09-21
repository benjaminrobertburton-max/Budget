export function fictionalCiti(){return {version:1,kind:'citi_activity',finding:'captured',
  identity:'Citi®/AAdvantage® Platinum Select® World Elite Mastercard® - 1234',range:'Since Sep 1, 2031',
  transactionFilter:'All',memberFilter:'All',currentBalance:'$15.00',availableCredit:'$985.00',statementBalance:'$0.00',minimumDue:'$0.00',dueDate:'Oct 1, 2031',
  pendingTotal:'$5.00',postedTotal:'$10.00',issues:[],rows:[
    {date:'Sep 8, 2031',description:'FICTIONAL PENDING',amount:'$5.00',state:'pending'},
    {date:'Sep 7, 2031',description:'FICTIONAL SHOP',amount:'$12.00',state:'posted'},
    {date:'Sep 6, 2031',description:'FICTIONAL REFUND',amount:'-$2.00',state:'posted'}]};}
export function fictionalCitiHtml(){const c=fictionalCiti();return `<button id="signOffmainAnchor">Sign Off</button>
<div id="cardsBalanceTile"><div class="card-title">${c.identity}</div><div class="current-balance">${c.currentBalance}</div><p class="available-credit-amount">${c.availableCredit}</p></div>
<div class="balance-box"><div class="balance-label-text">Last Statement Balance</div><div class="balance-amount">${c.statementBalance}</div></div>
<div class="balance-box"><div class="balance-label-text">Minimum Payment Due</div><div class="balance-amount">${c.minimumDue}</div></div>
<p>Payment due on <span class="payment-value">${c.dueDate}</span></p>
<button id="ums-timePeriodDropdown">${c.range}</button><button id="ums-transactionTypeDropdown">All</button><button id="ums-cardMemberDropdown">All</button>
<table class="transaction-table"><tr class="table-headers"><th></th><th>Date</th><th>Description</th><th>Name</th><th>Amount</th><th>Running Balance</th></tr>
${['pending','posted'].map(s=>`<tr class="total-header ${s==='pending'?'pending':''}"><td colspan="6"><span class="total-title">${s==='pending'?'Pending':'Posted'} Total</span><span class="total-title">${c[s+'Total']}</span></td></tr>`+c.rows.filter(r=>r.state===s).map(r=>`<tr class="transaction-row desktop ${s==='pending'?'pending':''}"><td></td><td>${r.date}</td><td>${r.description}</td><td>FICTIONAL PERSON</td><td>${r.amount}</td><td>-----</td></tr>`).join('')).join('')}</table>`;}
