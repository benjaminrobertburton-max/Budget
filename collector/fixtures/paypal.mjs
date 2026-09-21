// Entirely invented records. No live account data.
export const fictionalPaypal=()=>({version:1,kind:'paypal_financing',finding:'captured',sections:['Expiring','Active','Paid off'],rows:[
  ['FICTIONAL ALPHA','Expiring','October 10, 2031','$80.00','$2.00'],
  ['FICTIONAL BETA','Active','January 10, 2032','$120.00','$3.00'],
  ['FICTIONAL GAMMA','Active','January 20, 2032','$60.00','$1.00'],
  ['FICTIONAL DELTA','Paid off','October 10, 2031','$0.00','$0.00'],
].map(([merchant,section,expirationDate,amount,accruedInterest])=>({merchant,section,expirationDate,amount,accruedInterest,
  terms:`No interest if paid in full by ${expirationDate}`,purchaseDate:'March 10, 2031',purchaseAmount:'$200.00',remainingBalance:amount}))});
export const fictionalPaypalBindings=()=>fictionalPaypal().rows.map((r,i)=>({merchant:r.merchant,workbookMerchant:`Fictional promo ${i+1}`,purchaseDate:'2031-03-10',expirationDate:i===1?'2032-01-10':i===2?'2032-01-20':'2031-10-10'}));
export function fictionalPaypalHtml(){
  const c=fictionalPaypal();
  return '<!doctype html><html><body>'+c.sections.map(section=>`<section><div><div><h2>${section}</h2></div></div>${c.rows.filter(r=>r.section===section).map(r=>`<a role="link" href="" data-card="${c.rows.indexOf(r)}"><p>${r.merchant}</p><p>${r.terms}</p><p>${r.amount}</p></a>`).join('')}</section>`).join('')+
    `<script>const rows=${JSON.stringify(c.rows)};document.querySelectorAll('a').forEach(a=>a.onclick=e=>{e.preventDefault();const r=rows[Number(a.dataset.card)],d=document.createElement('div');d.setAttribute('role','dialog');d.innerHTML='<button>close</button>'+[r.merchant,r.terms,r.amount,'Purchase date',r.purchaseDate,'Purchase amount',r.purchaseAmount,'Remaining balance',r.remainingBalance,'Expiration date',r.expirationDate,'Current accrued interest',r.accruedInterest].map(v=>'<p>'+v+'</p>').join('');d.querySelector('button').onclick=()=>d.remove();document.body.append(d);});</script></body></html>`;
}
