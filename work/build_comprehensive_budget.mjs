import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const workDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(workDir, "..", "outputs", "01a04fdf-3751-72e2-88f1-daf19b8b9d1d");
await fs.mkdir(outDir, { recursive: true });
const wb = Workbook.create();
// Sheet creation order is the product-style navigation order.
// The first six sheets are the weekly workflow; the remaining sheets are traceable support detail.
const dash = wb.worksheets.add("1. Start");
const tuesday = wb.worksheets.add("2. Tuesday Review");
const scorecard = wb.worksheets.add("3. This Week");
const weekly = wb.worksheets.add("4. Money Plan");
const savings = wb.worksheets.add("5. Savings & Debt");
const history = wb.worksheets.add("6. History");
const importSheet = wb.worksheets.add("Support - Ledger");
const budget = wb.worksheets.add("Support - Budget Inputs");
const funding = wb.worksheets.add("Support - Funding Detail");
const bills = wb.worksheets.add("Support - Debt Detail");
const payplan = wb.worksheets.add("Support - Promo Detail");
const cash = wb.worksheets.add("Support - Account Snapshots");
const pending = wb.worksheets.add("Support - Pending Review");
const rules = wb.worksheets.add("Support - Rules");
const sources = wb.worksheets.add("Support - Sources");

const navy="#18324A", teal="#087E8B", mint="#DFF3EF", pale="#F4F7FA", yellow="#FFF2CC", red="#FDE9E7", gray="#64748B", green="#167C3B";
const operations="#173F5F", reserves="#0F766E", planning="#6B4F9B", debt="#9A4D1D", audit="#566575";
const usd='$#,##0.00;[Red]($#,##0.00);-'; const cad='CA$#,##0.00;[Red](CA$#,##0.00);-';
const title=(s,r,t,fill=navy)=>{s.getRange(r).merge();s.getRange(r.split(":")[0]).values=[[t]];s.getRange(r).format={fill,font:{bold:true,color:"#FFFFFF",size:16},verticalAlignment:"center"};s.getRange(r).format.rowHeight=30};
const sec=(s,r,t)=>{s.getRange(r).merge();s.getRange(r.split(":")[0]).values=[[t]];s.getRange(r).format={fill:teal,font:{bold:true,color:"#FFFFFF"},verticalAlignment:"center"}};
const input=(s,r)=>s.getRange(r).format={fill:yellow,font:{color:"#0000FF"}};
const headers=(s,r)=>s.getRange(r).format={fill:mint,font:{bold:true},borders:{preset:"outside",style:"thin",color:"#A7C9C8"}};
const colNumber=(letters)=>letters.split("").reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0);
const colLetters=(n)=>{let r="";while(n){const m=(n-1)%26;r=String.fromCharCode(65+m)+r;n=Math.floor((n-1)/26)}return r};
const widths=(s, cols)=>cols.forEach(([r,w])=>{const [first,last=first]=r.split(":");for(let n=colNumber(first);n<=colNumber(last);n++)s.getRange(`${colLetters(n)}1`).format.columnWidth=w;});

// Weekly Budget: input-focused plan with formula-driven availability.
title(budget,"A1:F1","Budget Inputs",planning);
budget.getRange("A2:F2").merge(); budget.getRange("A2").values=[["Yellow cells are editable inputs. Blue text = your inputs; black = formulas. Amounts are USD unless marked CAD."]]; budget.getRange("A2:F2").format={font:{italic:true,color:gray},wrapText:true};
sec(budget,"A4:F4","Income");
budget.getRange("A5:D5").values=[["Income source","Frequency","Amount","Weekly amount"]]; headers(budget,"A5:D5");
budget.getRange("A6:C6").values=[["Kiewit payroll (net)","Weekly",1343.37]];
budget.getRange("D6").formulas=[["=C6"]];
budget.getRange("A7:D7").values=[["Wife income (personal safe — Sep 9 total)","Weekly",220,null]]; budget.getRange("D7").formulas=[["=IF(B7=\"Weekly\",C7,C7*12/52)"]];
budget.getRange("A8:D8").values=[["Total net income",null,null,null]]; budget.getRange("D8").formulas=[["=SUM(D6:D7)"]];
sec(budget,"A10:F10","Known weekly bills and targets");
budget.getRange("A11:F11").values=[["Category","Bill / target","Frequency","Amount","Weekly amount","Status"]]; headers(budget,"A11:F11");
const planRows=[
 ["Housing","Rent / Pearl Point set-aside", "Weekly",300,null,"Maximum weekly rent target. Fund only from verified Wells capacity after required actions; record the actual amount in Savings & Debt."],
 ["Auto loan","Genesis G70 loan (CUTX)","Monthly",746.47,null,"Confirmed"],
 ["Utilities","Direct Energy electric","Monthly",65.72,null,"Confirmed"],
  ["Phone","AT&T","Monthly",65.00,null,"User-confirmed monthly bill"],
 ["Internet","Spectrum","Monthly",110.58,null,"Confirmed"],
 ["Mobile","Visible","Monthly",29.00,null,"Observed - confirm"],
 ["Subscriptions","Spotify, Amazon Prime, YouTube Premium Lite","Monthly",48.78,null,"Max cancelled; includes user-confirmed $11.99 YouTube Premium Lite billed through Apple"],
 ["Personal","Invincibles + other discretionary Apple purchases","Weekly",50,null,"Budget cap - $50/week; excludes YouTube Premium Lite"],
 ["PayPal","PayPal promotional payoff plan","Weekly",0,null,"Formula linked below"],
 ["Student loan","RBC Canada student loan","Monthly",80.00,null,"CAD - separate conversion"],
 ["Insurance","Life insurance","Monthly",102.33,null,"CAD - separate conversion"],
 ["Food","H-E-B groceries","Monthly",345.70,null,"Historical average across the supplied Chase statements"],
 ["Food","DoorDash","Weekly",25.00,null,"Hard weekly cap; reduced from historical $160/month average"],
 ["Transport","Citi / Chase fuel","Monthly",350.00,null,"Citi statement baseline; includes PCC and Exxon"],
 ["Pet","Grooming, BudgetPetCare, routine costs + pet insurance","Monthly",205.75,null,"Grooming ~$95.33/mo + BudgetPetCare $12.15/mo + routine costs $50/mo + Nationwide pet insurance $48.27/mo"],
 ["Savings","Fidelity + PayPal savings buckets","Weekly",0,null,"$75 Fidelity plus automatic PayPal savings for cruise, tuition, and future expenses"],
 ["Coffee","Starbucks","Weekly",30,null,"Reduction target; all three Chase periods averaged $52.62/week"],
 ["Snacks","365 Market / work snacks","Weekly",10,null,"Conservative target; historical Chase average was $18.71/week"],
 ["Shopping","Shopping, personal care & car washes","Weekly",50,null,"Target/Walmart/Old Navy/haircuts/car washes; conservative target"],
 ["Vapes","Vapes","Weekly",30,null,"Hard weekly cap"]
];
budget.getRange("A12:F31").values=planRows;
budget.getRange("E12").formulas=[["=IF(C12=\"Weekly\",D12,IF(C12=\"Every 5 weeks\",D12/5,D12*12/52))"]]; budget.getRange("E12:E31").fillDown();
budget.getRange("D20").formulas=[["='Support - Promo Detail'!F12"]]; budget.getRange("E20").formulas=[["=D20"]];
budget.getRange("A32:F32").values=[["Total weekly plan",null,null,null,null,null]]; budget.getRange("E32").formulas=[["=SUM(E12:E31)"]];
budget.getRange("A34:F34").values=[["Amount left after plan",null,null,null,null,null]]; budget.getRange("E34").formulas=[["=D8-E32"]];
budget.getRange("A38:F38").values=[["CAD conversion reference",null,null,null,null,null]]; budget.getRange("A39:C40").values=[["CAD-to-USD rate",0.73,null],["Original CAD bills (monthly)",182.33,null]]; budget.getRange("C40").formulas=[["=SUM(E21:E22)"]];
budget.getRange("A41:C41").values=[["Weekly plan including converted CAD items",null,null]]; budget.getRange("C41").formulas=[["=E32"]];
budget.getRange("D21").formulas=[["=80*$B$39"]];budget.getRange("D22").formulas=[["=102.33*$B$39"]];
budget.getRange("D27").formulas=[["='5. Savings & Debt'!B17"]];
budget.getRange("B21:B22").values=[["RBC Canada student loan (CA$80)"],["Life insurance (CA$102.33)"]];budget.getRange("F21:F22").values=[["Converted from CAD at input rate"],["Converted from CAD at input rate"]];
input(budget,"C6:C7");input(budget,"D12:D31");input(budget,"B39");budget.getRange("D20:D22").format={fill:pale,font:{color:"#000000"}};budget.getRange("D27").format={fill:pale,font:{color:"#000000"}};
budget.getRange("D6:D8").format.numberFormat=usd;budget.getRange("D12:E34").format.numberFormat=usd;budget.getRange("B39").format.numberFormat="0.0000";budget.getRange("B40").format.numberFormat=cad;budget.getRange("C40:C41").format.numberFormat=usd;
budget.getRange("A8:D8").format={fill:pale,font:{bold:true},borders:{preset:"doubleBottom",style:"medium",color:navy}};budget.getRange("A32:F32").format={fill:pale,font:{bold:true},borders:{preset:"doubleBottom",style:"medium",color:navy}};budget.getRange("A34:F34").format={fill:mint,font:{bold:true},borders:{preset:"outside",style:"medium",color:teal}};
budget.getRange("E34").conditionalFormats.add("cellIs",{operator:"lessThan",formula:0,format:{fill:red,font:{bold:true,color:"#B91C1C"}}});
widths(budget,[["A:A",18],["B:B",34],["C:C",13],["D:E",16],["F:F",19]]); budget.getRange("A1:F41").format.wrapText=true; budget.showGridLines=false; budget.freezePanes.freezeRows(11);

// PayPal promotional payoff planning. Reference date makes assumptions visible and editable.
title(payplan,"A1:G1","PayPal Promotional Payoff Plan",debt);
payplan.getRange("A2:G2").merge();payplan.getRange("A2").values=[["Stage 1 funds only promos due by the Stage 1 deadline. After that date, the weekly target automatically switches to the later promos. Update balances before each payoff; every deferred-interest balance must be $0 by its deadline."]];payplan.getRange("A2:G2").format={font:{italic:true,color:gray},wrapText:true};
payplan.getRange("A3:B3").values=[["Reference date",new Date("2026-09-09")]];payplan.getRange("D3:E3").values=[["Stage 1 deadline",new Date("2026-10-10")]];input(payplan,"B3");input(payplan,"E3");payplan.getRange("B3").format.numberFormat="mmm d, yyyy";payplan.getRange("E3").format.numberFormat="mmm d, yyyy";
payplan.getRange("A5:G5").values=[["Merchant","Deadline","Balance","Accrued deferred interest","Weeks remaining","Weekly payoff target","Priority"]];headers(payplan,"A5:G5");
payplan.getRange("A6:D9").values=[["Progressive car insurance","2026-10-10",169.37,105.51],["Best Buy","2026-10-10",573.71,69.30],["eBay","2027-01-10",406.05,20.70],["Plaud.ai","2027-01-10",169.80,8.37]];
payplan.getRange("B6:B9").values=[[new Date("2026-10-10")],[new Date("2026-10-10")],[new Date("2027-01-10")],[new Date("2027-01-10")]];
payplan.getRange("E6").formulas=[["=MAX(1,ROUNDUP((B6-$B$3)/7,0))"]];payplan.getRange("E6:E9").fillDown();payplan.getRange("F6").formulas=[["=IF($B$3>B6,0,IF(B6<=$E$3,C6/E6,IF($B$3>$E$3,C6/E6,0)))"]];payplan.getRange("F6:F9").fillDown();payplan.getRange("G6").formulas=[["=IF(B6<=$E$3,\"Stage 1 - pay now\",IF($B$3<=$E$3,\"Stage 2 - begins after Oct. 10\",\"Stage 2 - pay now\"))"]];payplan.getRange("G6:G9").fillDown();
payplan.getRange("A11:G11").values=[["Total",null,null,null,null,null,null]];payplan.getRange("C11").formulas=[["=SUM(C6:C9)"]];payplan.getRange("D11").formulas=[["=SUM(D6:D9)"]];payplan.getRange("F11").formulas=[["=SUM(F6:F9)"]];
payplan.getRange("A12:G12").values=[["Suggested weekly payment",null,null,null,null,null,null]];payplan.getRange("F12").formulas=[["=F11"]];
payplan.getRange("A5:G5").format.wrapText=true;payplan.getRange("B6:B9").format.numberFormat="mmm d, yyyy";payplan.getRange("C6:D11").format.numberFormat=usd;payplan.getRange("F6:F12").format.numberFormat=usd;payplan.getRange("A11:G11").format={fill:pale,font:{bold:true},borders:{preset:"doubleBottom",style:"medium",color:navy}};payplan.getRange("A12:G12").format={fill:yellow,font:{bold:true},borders:{preset:"outside",style:"medium",color:teal}};
payplan.getRange("G6:G7").conditionalFormats.add("containsText",{text:"Stage 1",format:{fill:red,font:{bold:true,color:"#B91C1C"}}});widths(payplan,[["A:A",18],["B:B",16],["C:D",20],["E:E",16],["F:F",20],["G:G",30]]);payplan.showGridLines=false;

// Bills and debt: current snapshot, not a payment calendar.
title(bills,"A1:G1","Debt Detail",debt);
bills.getRange("A2:G2").merge();bills.getRange("A2").values=[["Statement figures are a starting point. On payday, update the yellow balance, minimum, and due-date cells directly from each account app—no new statement needed."]];bills.getRange("A2:G2").format={font:{italic:true,color:gray},wrapText:true};
bills.getRange("A4:G4").values=[["Account / bill","Balance","Minimum / required payment","Due date","APR / terms","Currency","Source / status"]];headers(bills,"A4:G4");
const billRows=[
 ["Chase card",266.96,0,null,"27.49% purchases (statement)","USD","Current balance from Sep. 9 Chase screenshot. $500.33 pending activity is tracked separately. No payment due was shown."],
 ["Citi card",132.09,0,null,"APR not rechecked","USD","Current balance from Sep. 9 Citi screenshot. Closing date Oct. 7; payment due date was not shown."],
 ["Discover card",0,0,null,"26.49% purchases","USD","Current posted balance $0; Nationwide Pet $48.27 is pending and recorded separately in the ledger"],
 ["Capital One card",0,0,null,"28.99% purchases","USD","Current balance $0 in Sep. 9 app screenshot"],
 ["Prime Visa card",0,0,null,"27.49% purchases","USD","Current balance $0 in Sep. 9 app screenshot; no payment due"],
 ["PayPal Credit",1318.93,0,null,"Promos: 29.64% deferred interest if not paid by deadlines","USD","Sep. 9 app screenshot; Sep. 2 payment of $148.65 reduced Progressive to $169.37. App warns displayed amounts may be delayed."],
 ["Genesis G70 auto loan",21784.21,746.47,new Date("2026-09-27"),"6.70% APR","USD","User-confirmed recurring due date; August payment complete. Fund $172.26/week in a reserve, then pay the exact $746.47 on the 27th."],
 ["RBC Canada student loan",null,80,null,"Balance and terms pending","CAD","Monthly payment confirmed; balance unknown"],
 ["Life insurance",null,102.33,null,"Monthly premium","CAD","Monthly amount confirmed"],
 ["Direct Energy",0,0,null,"Next bill not supplied","USD","Prior $65.72 bill posted to Chase. Do not treat the old Sep. 14 due date as current."],
 ["Nationwide pet insurance",48.27,48.27,null,"Monthly premium","USD","Pending Sep. 8 on Discover; tracked separately from flexible pet costs"]
];
bills.getRange("A5:G15").values=billRows; input(bills,"B5:C15"); input(bills,"D5:D15");
bills.getRange("B5:C15").format.numberFormat=usd;bills.getRange("D5:D15").format.numberFormat="mmm d, yyyy";bills.getRange("A5:G15").format.wrapText=true;widths(bills,[["A:A",24],["B:B",20],["C:C",25],["D:D",16],["E:E",40],["F:F",12],["G:G",44]]);bills.showGridLines=false;

// Chase pending charges: reconciles current activity against the weekly plan.
title(pending,"A1:F1","Historical Pending Review — Aug 25–31",audit);
pending.getRange("A2:F2").merge();pending.getRange("A2").values=[["Archived historical context only. Do not use these totals as current Chase exposure; current pending activity is captured in Support - Ledger and the active source-control section."]];pending.getRange("A2:F2").format={font:{italic:true,color:gray},wrapText:true};
pending.getRange("A4:F4").values=[["Date","Merchant","Amount","Category","Plan treatment","Note"]];headers(pending,"A4:F4");
const pendingRows=[
 [new Date("2026-08-29"),"Direct Energy",65.72,"Electricity","Already budgeted","Matches current electricity invoice"],
 [new Date("2026-08-29"),"Coastal Cuts Groom",89.00,"Pet grooming","Already budgeted","Covered by pet/grooming reserve"],
 [new Date("2026-08-29"),"Starbucks",5.90,"Coffee / discretionary","Not covered / confirm","No separate Starbucks budget"],
 [new Date("2026-08-28"),"Royal Caribbean",382.18,"Cruise travel","Not covered / confirm","Cruise fund transfer begins Sep. 1; this charge predates funding"],
 [new Date("2026-08-28"),"H-E-B",130.07,"Groceries","Already budgeted","Covered by H-E-B weekly envelope"],
 [new Date("2026-08-28"),"ARKPERFORMA",52.95,"Unknown merchant","Not covered / confirm","Need merchant confirmation"],
 [new Date("2026-08-28"),"Invincible app charge",36.71,"Games / apps","Already budgeted","Part of $50 weekly games cap"],
 [new Date("2026-08-27"),"DoorDash",30.53,"DoorDash","Already budgeted","Covered by DoorDash weekly envelope"],
 [new Date("2026-08-27"),"McWhorter Service",216.51,"Vehicle service","Not covered / confirm","Auto costs currently excluded from weekly plan"],
 [new Date("2026-08-27"),"Gas Fusion",5.03,"Fuel","Already budgeted","Covered by fuel weekly envelope"],
 [new Date("2026-08-27"),"Invincible app charge",18.35,"Games / apps","Already budgeted","Combined pending Invincible charges are $55.06, $5.06 above cap"],
 [new Date("2026-08-27"),"Starbucks",12.91,"Coffee / discretionary","Not covered / confirm","No separate Starbucks budget"],
 [new Date("2026-08-27"),"Mariner of the Seas",181.67,"Cruise travel","Not covered / confirm","Cruise charge"],
 [new Date("2026-08-26"),"Mariner of the Seas",25.95,"Cruise travel","Not covered / confirm","Cruise charge"],
 [new Date("2026-08-25"),"Mariner of the Seas",82.73,"Cruise travel","Not covered / confirm","Cruise charge"],
 [new Date("2026-08-25"),"Mariner of the Seas",15.93,"Cruise travel","Not covered / confirm","Cruise charge"]
];
pending.getRange("A5:F20").values=pendingRows;pending.getRange("A5:A20").format.numberFormat="mmm d, yyyy";pending.getRange("C5:C26").format.numberFormat=usd;pending.getRange("A5:F20").format.wrapText=true;
pending.getRange("A22:B22").merge();pending.getRange("A22").values=[["Total pending charges"]];pending.getRange("C22").formulas=[["=SUM(C5:C20)"]];
pending.getRange("A23:B23").merge();pending.getRange("A23").values=[["Already budgeted in weekly plan"]];pending.getRange("C23").formulas=[["=SUMIF(E5:E20,\"Already budgeted\",C5:C20)"]];
pending.getRange("A24:B24").merge();pending.getRange("A24").values=[["Not covered / needs confirmation"]];pending.getRange("C24").formulas=[["=C22-C23"]];
pending.getRange("A26:B26").merge();pending.getRange("A26").values=[["Historical snapshot only — not a current Chase exposure measure"]];pending.getRange("C26").values=[[null]];
pending.getRange("A22:C24").format={fill:pale,font:{bold:true},borders:{preset:"outside",style:"thin",color:"#A7C9C8"}};pending.getRange("A26:C26").format={fill:mint,font:{bold:true},borders:{preset:"outside",style:"medium",color:teal}};
pending.getRange("E5:E20").conditionalFormats.add("containsText",{text:"Already budgeted",format:{fill:mint,font:{color:green}}});pending.getRange("E5:E20").conditionalFormats.add("containsText",{text:"Not covered",format:{fill:red,font:{color:"#B91C1C"}}});
widths(pending,[["A:A",14],["B:B",26],["C:C",16],["D:D",22],["E:E",24],["F:F",58]]);pending.showGridLines=false;pending.freezePanes.freezeRows(4);

// Source Notes records audit context without exposing source documents or sensitive details.
title(sources,"A1:E1","Sources & Notes",audit);
sources.getRange("A3:E3").values=[["Source","What was used","Period / date","Recorded items","Notes"]];headers(sources,"A3:E3");
sources.getRange("A4:E13").values=[
 ["Wells Fargo checking","Sep. 9 balance + operating history", "Sep 9, 2026", "Available Wells $1,227.78 after pending Fidelity debit; pending payroll $1,343.38; wife’s $220 total income is held in the personal safe", "The earlier Jul–Aug account history establishes the $1,343.37 recurring-payroll baseline and $75 weekly Fidelity transfer. The Sep. 9 balance controls this live review. Rent funding is limited to verified Wells capacity after required actions, not a forced $300 deposit."],
 ["Capital One statement","Card balance", "Jul 3-Aug 2, 2026", "$0.00 balance; $238.76 spending in period", "Current balance should be refreshed if new charges occurred"],
 ["Discover statement","Card balance", "Aug 9, 2026", "$48.27 balance; $20 minimum due Sep 6", ""],
 ["PayPal Credit statement","Promo debt", "Aug 18, 2026", "$1,618.58 balance; $30 minimum; four deferred-interest promos", "Payoff plan tab prioritizes deadlines"],
 ["Citi statement","Card balance", "Aug 7, 2026", "$0.00 balance", "No monthly payment assumed"],
 ["CUTX statement","Auto loan", "Jul 31, 2026", "$21,784.21 balance; $746.47 payment; 6.70% APR", ""],
 ["Direct Energy invoice","Electric bill", "Aug 2026", "$65.72 due Sep 14", ""],
 ["Chase statements","Card balance, spending, subscriptions", "Jun-Aug 2026", "Invincibles app charges: $596.43, $605.63, then $972.68 across the three statement periods; Spectrum internet, Max, dog grooming, and BudgetPetCare observed", "BudgetPetCare last charged $36.45 on Jul. 29 and recurs every 3 months (next Oct. 16). Spectrum Mobile $672.29 was a one-time phone payoff funded from Wealthfront. Game/app budget cap set to $50/week. SiriusXM, NordVPN, HWBTPLUS, and Max are cancelled and excluded."],
 ["Prime Visa statement","Card balance and subscription", "Aug 26, 2026", "$109.51 balance; $35 minimum due Sep 23; Amazon Prime $16.23", "Prime Visa added to Bills & Debt"],
 ["Del Mar College","Sonography tuition planning", "Spring 2027 calendar", "Current semester paid; $2,707 target funded by weekly savings", "Tuition is due Dec. 2, 2026 at 6 p.m. for early registration, or Jan. 6, 2027 at 6 p.m. if registering later. Plan uses 14 Tuesday transfers of $193.36 to meet Dec. 2. https://www.delmar.edu/current-students/calendar.html"],
];
sources.getRange("A4:E13").format.wrapText=true;widths(sources,[["A:A",24],["B:B",27],["C:C",20],["D:D",46],["E:E",55]]);sources.showGridLines=false;

// Savings & Debt: a compact action-oriented overview. Supporting detail remains on the audit tabs.
title(savings,"A1:F1","Savings & Debt",reserves);
savings.getRange("A2:F2").merge();savings.getRange("A2").values=[["Read this as three questions: Is savings protected? Is next month’s rent funded from real cash? Are the priority debts on track?"]];savings.getRange("A2:F2").format={font:{italic:true,color:gray},wrapText:true};
sec(savings,"A4:F4","Savings health");
savings.getRange("A5:B9").values=[["Wealthfront available now",null],["Personal safe cash",null],["Confirmed liquid savings",null],["13-week core-needs benchmark",null],["Gap to core-needs benchmark",null]];
savings.getRange("B5").formulas=[["='Support - Account Snapshots'!F6"]];savings.getRange("B6").formulas=[["='Support - Account Snapshots'!F7"]];savings.getRange("B7").formulas=[["=SUM(B5:B6)"]];savings.getRange("B8").formulas=[["=SUM('Support - Budget Inputs'!E12:E17,'Support - Budget Inputs'!E20:E23,'Support - Budget Inputs'!E25:E26)*13"]];savings.getRange("B9").formulas=[["=B7-B8"]];
savings.getRange("A5:B9").format={fill:pale,borders:{preset:"inside",style:"thin",color:"#D9E5E7"}};savings.getRange("B5:B9").format={fill:"#FFFFFF",font:{bold:true,size:14},numberFormat:usd};savings.getRange("A7:B7").format={fill:mint,font:{bold:true}};savings.getRange("A8:B8").format={fill:yellow,font:{bold:true}};savings.getRange("B9").conditionalFormats.add("cellIs",{operator:"lessThan",formula:0,format:{fill:red,font:{bold:true,color:"#B91C1C"}}});
savings.getRange("C5:D9").values=[["Next rent due",null],["Rent due estimate",null],["Tagged rent reserve",null],["Emergency draw if no more funding",null],["Confirmed funding vs. monthly plan",null]];
savings.getRange("D5").formulas=[["=B34"]];savings.getRange("D6").formulas=[["=B35"]];savings.getRange("D7").formulas=[["=B39"]];savings.getRange("D8").formulas=[["=E36"]];savings.getRange("D9").formulas=[["=E34"]];
savings.getRange("C5:D9").format={fill:pale,borders:{preset:"inside",style:"thin",color:"#D9E5E7"}};savings.getRange("D5").format={fill:"#FFFFFF",font:{bold:true,size:14},numberFormat:"mmm d, yyyy"};savings.getRange("D6:D9").format={fill:"#FFFFFF",font:{bold:true,size:14},numberFormat:usd};savings.getRange("C5:D5").format={fill:mint,font:{bold:true}};savings.getRange("D8").conditionalFormats.add("cellIs",{operator:"greaterThan",formula:0,format:{fill:red,font:{bold:true,color:"#B91C1C"}}});savings.getRange("D9").conditionalFormats.add("cellIs",{operator:"lessThan",formula:0,format:{fill:red,font:{bold:true,color:"#B91C1C"}}});
sec(savings,"A11:D11","Automatic savings — weekly transfers");
savings.getRange("A12:D16").values=[["Item","Weekly amount","Weeks confirmed","Saved since tracker began"],["Fidelity 401(k)",75,0,null],["PayPal cruise fund",85,0,null],["Del Mar tuition savings",193.36,0,null],["Future-expenses fund",50,0,null]];headers(savings,"A12:D12");savings.getRange("D13").formulas=[["=B13*C13"]];savings.getRange("D13:D16").fillDown();input(savings,"B13:C16");savings.getRange("B13:B16").format.numberFormat=usd;savings.getRange("D13:D16").format.numberFormat=usd;
savings.getRange("A17:D17").values=[["Total automatic savings",null,null,null]];savings.getRange("B17").formulas=[["=SUM(B13:B16)"]];savings.getRange("D17").formulas=[["=SUM(D13:D16)"]];savings.getRange("A17:D17").format={fill:mint,font:{bold:true},borders:{preset:"doubleBottom",style:"medium",color:teal}};savings.getRange("B17:D17").format.numberFormat=usd;
sec(savings,"A19:D19","Priority debt payoff");
savings.getRange("A20:B22").values=[["Active PayPal promo balance",null],["Weekly payoff target",null],["First promo deadline",null]];savings.getRange("B20").formulas=[["='Support - Promo Detail'!C11"]];savings.getRange("B21").formulas=[["='Support - Promo Detail'!F12"]];savings.getRange("B22").formulas=[["='Support - Promo Detail'!B6"]];savings.getRange("A20:B22").format={fill:pale,borders:{preset:"inside",style:"thin",color:"#D9E5E7"}};savings.getRange("B20:B21").format={fill:"#FFFFFF",font:{bold:true,size:14},numberFormat:usd};savings.getRange("B22").format={fill:"#FFFFFF",font:{bold:true},numberFormat:"mmm d, yyyy"};
savings.getRange("C20:D22").merge();savings.getRange("C20").values=[["The weekly payoff is an expense paid from Wells, not savings. The detailed promo schedule is on Support - Promo Detail."]];savings.getRange("C20:D22").format={fill:yellow,font:{italic:true,color:gray},wrapText:true,verticalAlignment:"center"};
sec(savings,"A24:F24","Rent reserve — October");
savings.getRange("A25:F25").values=[["Tuesday","Normal cap","Actual funded","Variance","Funding source","Note"]];headers(savings,"A25:F25");
savings.getRange("A26:A29").values=[[new Date("2026-09-09")],[new Date("2026-09-16")],[new Date("2026-09-23")],[new Date("2026-09-30")]];
savings.getRange("B26").formulas=[["='Support - Budget Inputs'!$E$12"]];savings.getRange("B26:B29").fillDown();savings.getRange("C26").formulas=[["='2. Tuesday Review'!D13"]];savings.getRange("D26").formulas=[["=C26-B26"]];savings.getRange("D26:D29").fillDown();
savings.getRange("E26:F29").values=[["Wells cash capacity","Calculated from verified Tuesday plan"],["Enter after review","No catch-up assumed"],["Enter after review","No catch-up assumed"],["Enter after review","No catch-up assumed"]];
savings.getRange("A30:F30").values=[["Total before October rent",null,null,null,null,null]];savings.getRange("B30").formulas=[["=SUM(B26:B29)"]];savings.getRange("C30").formulas=[["=SUM(C26:C29)"]];savings.getRange("D30").formulas=[["=C30-B30"]];savings.getRange("A30:F30").format={fill:mint,font:{bold:true},borders:{preset:"doubleBottom",style:"medium",color:teal}};
savings.getRange("A25:F30").format.wrapText=true;savings.getRange("A26:F29").format={fill:pale,borders:{preset:"inside",style:"thin",color:"#D9E5E7"}};savings.getRange("C26").format={fill:"#FFFFFF",font:{bold:true}};input(savings,"C27:C29");savings.getRange("A26:A29").format.numberFormat="mmm d";savings.getRange("B26:D30").format.numberFormat=usd;savings.getRange("D26:D30").conditionalFormats.add("cellIs",{operator:"lessThan",formula:0,format:{fill:red,font:{bold:true,color:"#B91C1C"}}});
sec(savings,"A32:F32","Rent reserve forecast");
savings.getRange("A34:B39").values=[["Next rent due",new Date("2026-10-01")],["Rent due estimate",1169.46],["Opening tagged rent reserve",0],["Confirmed future rent funding",0],["Target rent reserve",null],["Tagged reserve before rent",null]];
savings.getRange("B38").formulas=[["=MAX(B35,B30)"]];savings.getRange("B39").formulas=[["=B36+C30+B37"]];
savings.getRange("D34:E38").values=[["Confirmed funding vs. monthly plan",null],["Remaining rent funding gap",null],["Emergency draw if no more funding",null],["Cushion if rent paid today",null],["Next Tuesday rent cap",null]];
savings.getRange("E34").formulas=[["=D30"]];savings.getRange("E35").formulas=[["=MAX(0,$B$38-$B$39)"]];savings.getRange("E36").formulas=[["=E35"]];savings.getRange("E37").formulas=[["=MAX(0,$B$39-$B$35)"]];savings.getRange("E38").formulas=[["=B27"]];
savings.getRange("D39:F39").merge();savings.getRange("D39").values=[["No catch-up is assumed. Enter future funding only after it is real or truly arranged."]];savings.getRange("D39:F39").format={fill:yellow,font:{italic:true,color:gray},wrapText:true,verticalAlignment:"center"};
savings.getRange("A34:B39").format={fill:pale,borders:{preset:"inside",style:"thin",color:"#D9E5E7"}};savings.getRange("D34:E38").format={fill:pale,borders:{preset:"inside",style:"thin",color:"#D9E5E7"}};input(savings,"B34:B37");savings.getRange("B34").format.numberFormat="mmm d, yyyy";savings.getRange("B35:B39").format={fill:"#FFFFFF",font:{bold:true,size:12},numberFormat:usd};savings.getRange("E34:E38").format={fill:"#FFFFFF",font:{bold:true,size:12},numberFormat:usd};savings.getRange("E35:E36").conditionalFormats.add("cellIs",{operator:"greaterThan",formula:0,format:{fill:red,font:{bold:true,color:"#B91C1C"}}});
widths(savings,[["A:A",30],["B:B",18],["C:C",18],["D:D",29],["E:E",22],["F:F",34]]);savings.getRange("A1:F39").format.wrapText=true;savings.getRange("A1:F39").format.font={size:12};savings.getRange("A5:D9").format.rowHeight=29;savings.getRange("A12:D17").format.rowHeight=25;savings.getRange("A20:D22").format.rowHeight=27;savings.getRange("A26:F30").format.rowHeight=28;savings.getRange("A34:F39").format.rowHeight=28;savings.showGridLines=false;savings.freezePanes.freezeRows(4);

// Weekly Payday Plan: statement-free operating routine tied to the monthly assumptions.
title(weekly,"A1:F1","Money Plan",planning);
weekly.getRange("A2:F2").merge();weekly.getRange("A2").values=[["Use this ongoing guide after the live Tuesday Review. It reflects the Sep. 9 import inputs; the current rent contribution is calculated in Tuesday Review and recorded in Savings & Debt."]];weekly.getRange("A2:F2").format={font:{italic:true,color:gray},wrapText:true};
weekly.getRange("A4:D4").values=[["Payday allocation","Weekly amount","How it is handled","Status"]];headers(weekly,"A4:D4");
weekly.getRange("A5:D21").values=[
["Rent reserve — maximum",null,"Use only verified Wells capacity after required actions","Actual contribution is recorded in Savings & Debt; no catch-up is assumed"],["Auto loan",null,"Keep available for monthly payment","Formula from weekly budget"],["Electricity",null,"Keep available","Formula from weekly budget"],["AT&T + Visible",null,"Keep available","Formula from weekly budget"],["Spectrum internet",null,"Keep available","Formula from weekly budget"],["Subscriptions",null,"Keep available","Formula from weekly budget"],["Games / app purchases",null,"Hard weekly cap","Formula from weekly budget"],["Starbucks",null,"Hard weekly cap","Formula from weekly budget"],["365 Market / work snacks",null,"Hard weekly cap","Formula from weekly budget"],["Shopping, personal care & car washes",null,"Hard weekly cap","Formula from weekly budget"],["PayPal promotional payoff",null,"Pay weekly","Formula from payoff plan"],["H-E-B groceries",null,"Use as weekly envelope","Formula from weekly budget"],["DoorDash",null,"Hard weekly cap","Formula from weekly budget"],["Fuel",null,"Use as weekly envelope","Formula from weekly budget"],["Pet",null,"Use as weekly envelope","Formula from weekly budget"],["RBC loan + life insurance",null,"Keep available","Converted CAD amount"],["Fidelity + PayPal savings buckets",null,"$75 Fidelity plus $85 cruise, $193.36 tuition, and $50 future fund automatically","Formula from weekly budget"]
];
weekly.getRange("B5").formulas=[["='Support - Budget Inputs'!E12"]];weekly.getRange("B6").formulas=[["='Support - Budget Inputs'!E13"]];weekly.getRange("B7").formulas=[["='Support - Budget Inputs'!E14"]];weekly.getRange("B8").formulas=[["=SUM('Support - Budget Inputs'!E15,'Support - Budget Inputs'!E17)"]];weekly.getRange("B9").formulas=[["='Support - Budget Inputs'!E16"]];weekly.getRange("B10").formulas=[["='Support - Budget Inputs'!E18"]];weekly.getRange("B11").formulas=[["='Support - Budget Inputs'!E19"]];weekly.getRange("B12").formulas=[["='Support - Budget Inputs'!E28"]];weekly.getRange("B13").formulas=[["='Support - Budget Inputs'!E29"]];weekly.getRange("B14").formulas=[["='Support - Budget Inputs'!E30"]];weekly.getRange("B15").formulas=[["='Support - Promo Detail'!F12"]];weekly.getRange("B16").formulas=[["='Support - Budget Inputs'!E23"]];weekly.getRange("B17").formulas=[["='Support - Budget Inputs'!E24"]];weekly.getRange("B18").formulas=[["='Support - Budget Inputs'!E25"]];weekly.getRange("B19").formulas=[["='Support - Budget Inputs'!E26"]];weekly.getRange("B20").formulas=[["='Support - Budget Inputs'!C40"]];weekly.getRange("B21").formulas=[["='Support - Budget Inputs'!E27"]];
weekly.getRange("A22:D22").values=[["Vapes",null,"Hard weekly cap","Formula from weekly budget"]];weekly.getRange("B22").formulas=[["='Support - Budget Inputs'!E31"]];
weekly.getRange("A23:D23").values=[["Total weekly allocation",null,null,null]];weekly.getRange("B23").formulas=[["=SUM(B5:B22)"]];weekly.getRange("A25:D25").values=[["Total weekly household income",null,null,null]];weekly.getRange("B25").formulas=[["='Support - Budget Inputs'!D8"]];weekly.getRange("A26:D26").values=[["Personal-safe income — included in household total",null,null,null]];weekly.getRange("B26").formulas=[["='Support - Budget Inputs'!D7"]];weekly.getRange("A27:D27").values=[["Banking income available for Wells plan",null,null,null]];weekly.getRange("B27").formulas=[["=B25-B26"]];weekly.getRange("A28:D28").values=[["Household weekly buffer / shortfall",null,null,null]];weekly.getRange("B28").formulas=[["=B25-B23"]];
weekly.getRange("B5:B28").format.numberFormat=usd;weekly.getRange("A23:D23").format={fill:pale,font:{bold:true},borders:{preset:"doubleBottom",style:"medium",color:navy}};weekly.getRange("A26:D26").format={fill:yellow,font:{bold:true}};weekly.getRange("A27:D27").format={fill:pale,font:{bold:true}};weekly.getRange("A28:D28").format={fill:mint,font:{bold:true},borders:{preset:"outside",style:"medium",color:teal}};weekly.getRange("B28").conditionalFormats.add("cellIs",{operator:"lessThan",formula:0,format:{fill:red,font:{bold:true,color:"#B91C1C"}}});
sec(weekly,"A30:F30","How this page fits the weekly process");
weekly.getRange("A31:B34").values=[["1. Fund the plan","The allocation is the weekly funding guide; it is not a list of immediate bills due."],["2. Spend within limits","Use This Week for actual purchases and pending charges."],["3. Execute payments","Create or replace Tuesday Review when the next payment plan is due."],["4. Preserve history","History receives the verified weekly result; do not overwrite prior weeks."]];weekly.getRange("B31:F34").merge(true);weekly.getRange("A31:F34").format={fill:pale,borders:{preset:"inside",style:"thin",color:"#D9E5E7"},wrapText:true};weekly.getRange("A31:A34").format.font={bold:true,color:planning};
widths(weekly,[["A:A",34],["B:B",18],["C:C",34],["D:D",26],["E:E",18],["F:F",34]]);weekly.getRange("A1:F42").format.wrapText=true;weekly.showGridLines=false;weekly.freezePanes.freezeRows(4);

// Import Rules: mapping reference for direct issuer CSVs and authorization alerts.
title(rules,"A1:F1","Import Rules",audit);
rules.getRange("A2:F2").merge();rules.getRange("A2").values=[["Edit yellow cells only when a new merchant needs a rule. Exact merchant rules take priority; the optional category fallback supports native bank CSV labels. Transfers and card payments are excluded from spending totals."]];rules.getRange("A2:F2").format={font:{italic:true,color:gray},wrapText:true};
rules.getRange("A4:F4").values=[["Exact merchant / description","Workbook category","Treatment","Bank category fallback","Fallback category","Fallback treatment"]];headers(rules,"A4:F4");
const merchantRules=[
 ["H-E-B","H-E-B / groceries","Include","","",""],
 ["DoorDash","DoorDash","Include","","",""],
 ["Starbucks","Starbucks","Include","","",""],
 ["INVINCIBLE APPCHARGE","Apple & Invincibles","Include","","",""],
 ["Apple","Apple & Invincibles","Include","","",""],
 ["OpenAI","Subscriptions","Include","","",""],
 ["AMAZON MARKETPLACE","Shopping / personal care","Include","","",""],
 ["AMAZON PRIME MEMBERSHIP","Subscriptions","Include","","",""],
 ["365 MARKET","Work snacks","Include","","",""],
 ["Vape","Vapes","Include","","",""],
 ["Direct Energy","Electricity","Include","","",""],
 ["Spectrum","Spectrum internet","Include","","",""],
 ["AT&T","Phone + Visible","Include","","",""],
 ["Visible","Phone + Visible","Include","","",""],
 ["BudgetPetCare","Pet costs","Include","","",""],
 ["Nationwide Pet","Pet costs","Include","","",""],
 ["Coastal Cuts","Pet costs","Include","","",""],
 ["Gas Fusion","Fuel","Include","","",""],
 ["Exxon","Fuel","Include","","",""],
 ["Citi","Fuel","Include","","",""],
 ["Fidelity","Fidelity 401(k)","Transfer / verify","","",""],
 ["UMB","Rent set-aside","Transfer / verify","","",""],
 ["Wealthfront","Savings transfer","Transfer / verify","","",""],
 ["PayPal","Cruise / PayPal","Transfer / verify","","",""],
 ["Chase Payment","Credit-card payment","Exclude","","",""],
 ["Discover Payment","Credit-card payment","Exclude","","",""],
 ["Capital One Payment","Credit-card payment","Exclude","","",""]
];
rules.getRange("A5:F31").values=merchantRules;
rules.getRange("D5:F14").values=[
 ["Groceries","H-E-B / groceries","Include"],
 ["Restaurants","DoorDash","Include"],
 ["Coffee Shops","Starbucks","Include"],
 ["Gas","Fuel","Include"],
 ["Pet Care","Pet costs","Include"],
 ["Utilities","Electricity","Include"],
 ["Internet","Spectrum internet","Include"],
 ["Mobile Phone","Phone + Visible","Include"],
 ["Shopping","Shopping / personal care","Include"],
 ["Entertainment","Invincibles + other Apple","Include"]
];
input(rules,"A5:C31");input(rules,"D5:F14");rules.getRange("A4:F31").format.wrapText=true;rules.getRange("A4:F31").format.borders={preset:"inside",style:"thin",color:"#D9E5E7"};widths(rules,[["A:A",28],["B:B",24],["C:C",18],["D:D",24],["E:E",24],["F:F",18]]);rules.showGridLines=false;rules.freezePanes.freezeRows(4);

// Transaction Ledger: normalized rows from Chase/Citi CSVs and authorization alerts; never an aggregator export.
title(importSheet,"A1:M1","Transaction Ledger",audit);
importSheet.getRange("A2:M2").merge();importSheet.getRange("A2").values=[["Every transaction must name its archived screenshot and visible section before it can be Verified. Only Verified Include rows feed This Week and History. Never estimate a hard-to-read amount: mark Needs verification and resolve it first."]];importSheet.getRange("A2:M2").format={font:{italic:true,color:gray},wrapText:true};
importSheet.getRange("A4:M4").values=[["Account","Transaction date","Description","Expense amount","Status","Budget category","Treatment","Week start (Tue)","Unique key","Review note","Source archive","Visible section","Verification"]];headers(importSheet,"A4:M4");
const ledgerRows=[
 ["Chase",new Date("2026-08-25"),"CLIP MX*LOCAL SOUVENIR",115.65,"Posted","Shopping / personal care","Include","chase-2026-08-25-clip-11565","Visible in Sep. 1 Chase screenshot"],
 ["Chase",new Date("2026-08-25"),"Payment Thank You",-140.20,"Posted","Credit-card payment","Exclude","chase-2026-08-25-payment-14020","Payment transfer; excluded from spending"],
 ["Chase",new Date("2026-08-26"),"Apple Digital Services",64.91,"Posted","Invincibles + other Apple","Include","chase-2026-08-26-apple-6491","Apple charge; not assumed to be YouTube"],
 ["Chase",new Date("2026-08-27"),"MCWHORTER SERVICE",216.51,"Posted","Automotive","Include","chase-2026-08-27-mcwhorter-21651","Track-only category; no weekly target set"],
 ["Chase",new Date("2026-08-27"),"GAS FUSION",5.03,"Posted","Fuel","Include","chase-2026-08-27-gasfusion-503","Visible in Sep. 1 Chase screenshot"],
 ["Chase",new Date("2026-08-27"),"Starbucks",12.91,"Posted","Starbucks","Include","chase-2026-08-27-starbucks-1291","Visible in Sep. 1 Chase screenshot"],
 ["Chase",new Date("2026-08-27"),"Royal Caribbean",200.00,"Posted","Travel / cruise","Include","chase-2026-08-27-royalcaribbean-20000","Track-only category; no weekly target set"],
 ["Chase",new Date("2026-08-27"),"Payment Thank You",-139.00,"Posted","Credit-card payment","Exclude","chase-2026-08-27-payment-13900","Payment transfer; excluded from spending"],
 ["Chase",new Date("2026-08-27"),"INVINCIBLE APPCHARGE",18.35,"Posted","Invincibles + other Apple","Include","chase-2026-08-27-invincible-1835","Visible in Sep. 1 Chase screenshot"],
 ["Chase",new Date("2026-08-28"),"INVINCIBLE APPCHARGE",18.35,"Posted","Invincibles + other Apple","Include","chase-2026-08-28-invincible-1835","Visible in Sep. 1 Chase screenshot"],
 ["Chase",new Date("2026-08-28"),"INVINCIBLE APPCHARGE",36.71,"Posted","Invincibles + other Apple","Include","chase-2026-08-28-invincible-3671","Visible in Sep. 1 Chase screenshot"],
 ["Chase",new Date("2026-08-28"),"Royal Caribbean",382.18,"Posted","Travel / cruise","Include","chase-2026-08-28-royalcaribbean-38218","Track-only category; no weekly target set"],
 ["Chase",new Date("2026-08-28"),"Apple Digital Services",53.00,"Posted","Invincibles + other Apple","Include","chase-2026-08-28-apple-5300","Apple charge; not assumed to be YouTube"],
 ["Chase",new Date("2026-08-29"),"Payment Thank You",-952.91,"Posted","Credit-card payment","Exclude","chase-2026-08-29-payment-95291","Payment transfer; excluded from spending"],
 ["Chase",new Date("2026-08-29"),"H-E-B",131.09,"Posted","H-E-B / groceries","Include","chase-2026-08-29-heb-13109","Visible in Sep. 1 Chase screenshot"],
 ["Chase",new Date("2026-08-29"),"DoorDash McDonald's",30.53,"Posted","DoorDash","Include","chase-2026-08-29-doordash-3053","Visible in Sep. 1 Chase screenshot"],
 ["Chase",new Date("2026-08-29"),"COASTAL CUTS GROOMING",102.35,"Posted","Pet costs","Include","chase-2026-08-29-coastalcuts-10235","Dog grooming"],
 ["Chase",new Date("2026-08-29"),"Direct Energy",65.72,"Posted","Electricity","Include","chase-2026-08-29-directenergy-6572","Visible in Sep. 1 Chase screenshot"],
 ["Chase",new Date("2026-08-29"),"ARKPERFORMA",52.95,"Posted","Automotive","Include","chase-2026-08-29-arkperforma-5295","Track-only category; no weekly target set"],
 ["Chase",new Date("2026-08-29"),"Starbucks",5.90,"Posted","Starbucks","Include","chase-2026-08-29-starbucks-590","Visible in Sep. 1 Chase screenshot"],
 ["Chase",new Date("2026-08-30"),"Apple Digital Services",0.99,"Posted","Invincibles + other Apple","Include","chase-2026-08-30-apple-099","Apple charge; not assumed to be YouTube"],
 ["Chase",new Date("2026-08-31"),"Payment Thank You",-988.61,"Posted","Credit-card payment","Exclude","chase-2026-08-31-payment-98861","Payment transfer; excluded from spending"],
 ["Chase",new Date("2026-08-31"),"DMC TBC",5.08,"Pending","Education / school supplies","Include","chase-2026-08-31-dmctbc-508","Scantron sheets for wife's school semester; track-only category"],
 ["Chase",new Date("2026-08-31"),"Starbucks",6.55,"Pending","Starbucks","Include","chase-2026-08-31-starbucks-655","Pending in Sep. 1 Chase screenshot"],
 ["Chase",new Date("2026-09-01"),"Apple Digital Services",32.44,"Posted","Invincibles + other Apple","Include","chase-2026-09-01-apple-3244","Posted under Sep. 1 in the Sep. 9 Chase activity; not assumed to be YouTube"],
 ["Chase",new Date("2026-09-01"),"365 MARKET",6.91,"Posted","Work snacks","Include","chase-2026-09-01-365-691","Posted in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-01"),"Target",-71.46,"Posted","Shopping / personal care","Include","chase-2026-09-01-target-refund-7146","Posted refund in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-01"),"365 MARKET",2.36,"Posted","Work snacks","Include","chase-2026-09-01-365-236","Posted in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-01"),"Starbucks",12.45,"Posted","Starbucks","Include","chase-2026-09-01-starbucks-1245","Posted in Sep. 9 Chase activity"],
 ["Citi",new Date("2026-08-25"),"ONLINE PAYMENT, THANK YOU",-218.44,"Posted","Credit-card payment","Exclude","citi-2026-08-25-payment-21844","Card payment; excluded from spending"],
 ["Citi",new Date("2026-08-27"),"SPEEDY STOP 111 BAY CITY TX",30.54,"Posted","Fuel","Include","citi-2026-08-27-speedystop-3054","Visible in Sep. 1 Citi screenshot"],
 ["Citi",new Date("2026-08-28"),"EXXON CHECKOUT #70 ROCKPORT TX",32.25,"Posted","Fuel","Include","citi-2026-08-28-exxon-3225","Visible in Sep. 1 Citi screenshot"],
 ["Citi",new Date("2026-08-29"),"OPENAI *CHATGPT SUBSCR SAN FRA",16.67,"Posted","Subscriptions","Include","citi-2026-08-29-openai-1667","Subscription charge; included in actuals, confirm recurrence before adding to plan"],
 ["Citi",new Date("2026-09-01"),"EXXON CHECKOUT #70 ROCKPORT USA",63.34,"Posted","Fuel","Include","citi-2026-09-01-exxon-6334","Posted in Sep. 9 Citi activity"],
 ["Citi",new Date("2026-09-02"),"ONLINE PAYMENT, THANK YOU",-79.46,"Posted","Credit-card payment","Exclude","citi-2026-09-02-payment-7946","Card payment; excluded from spending. Verified in Sep. 9 Citi activity"],
 ["Citi",new Date("2026-09-03"),"PCC 9394 INGLESIDE TX",68.75,"Posted","Fuel","Include","citi-2026-09-03-pcc-6875","Fuel purchase verified in Sep. 9 Citi activity"],
 ["Prime Visa",new Date("2026-08-25"),"AMAZON PRIME MEMBERSHIP",16.23,"Posted","Subscriptions","Include","prime-2026-08-25-membership-1623","Recurring Prime membership; visible in Sep. 1 Prime screenshot"],
 ["Prime Visa",new Date("2026-08-29"),"AMAZON MARKETPLACE",8.65,"Posted","Shopping / personal care","Include","prime-2026-08-29-amazon-865","Visible in Sep. 1 Prime screenshot"],
 ["Prime Visa",new Date("2026-08-29"),"AMAZON MARKETPLACE",7.78,"Posted","Shopping / personal care","Include","prime-2026-08-29-amazon-778","Visible in Sep. 1 Prime screenshot"],
 ["Prime Visa",new Date("2026-08-30"),"AMAZON MARKETPLACE",7.57,"Posted","Shopping / personal care","Include","prime-2026-08-30-amazon-757","Visible in Sep. 1 Prime screenshot"],
 ["Prime Visa",new Date("2026-08-30"),"AMAZON MARKETPLACE",15.14,"Posted","Shopping / personal care","Include","prime-2026-08-30-amazon-1514","Visible in Sep. 1 Prime screenshot"],
 ["Chase",new Date("2026-09-03"),"365 MARKET",2.36,"Posted","Work snacks","Include","chase-2026-09-03-365-236","Visible in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-03"),"Starbucks",11.26,"Posted","Starbucks","Include","chase-2026-09-03-starbucks-1126","Visible in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-02"),"ROYAL CARIBBEAN",1081.18,"Posted","Travel / cruise","Exclude","chase-2026-09-02-royalcaribbean-108118","Friend reimbursement pass-through; excluded. $0.18 recorded separately."],
 ["Chase",new Date("2026-09-02"),"Royal Caribbean unreimbursed amount",0.18,"Posted","Travel / cruise","Include","chase-2026-09-02-royalcaribbean-net-018","Net amount after the $1,081.00 Wells reimbursement"],
 ["Chase",new Date("2026-09-02"),"365 MARKET",2.36,"Posted","Work snacks","Include","chase-2026-09-02-365-236b","Visible in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-02"),"Starbucks",12.94,"Posted","Starbucks","Include","chase-2026-09-02-starbucks-1294","Visible in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-02"),"INVINCIBLE APPCHARGE",9.17,"Posted","Invincibles + other Apple","Include","chase-2026-09-02-invincible-917","Visible in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-02"),"HWBTPLUS",11.99,"Posted","Subscriptions","Include","chase-2026-09-02-hwbtplus-1199","Cancelled after this one-time final charge"],
 ["Chase",new Date("2026-09-02"),"Visible",35.00,"Posted","Phone + Visible","Include","chase-2026-09-02-visible-3500","Visible mobile service"],
 ["Chase",new Date("2026-09-02"),"Payment Thank You",-72.61,"Posted","Credit-card payment","Exclude","chase-2026-09-02-payment-7261","Card payment; excluded from spending"],
 ["Chase",new Date("2026-09-02"),"Apple Digital Services",-5.40,"Posted","Invincibles + other Apple","Include","chase-2026-09-02-apple-refund-540","Posted credit/refund; amount verified against source image"],
 ["Chase",new Date("2026-09-04"),"GAS",27.05,"Posted","Fuel","Include","chase-2026-09-04-gas-2705","Visible in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-04"),"INVINCIBLE APPCHARGE",18.35,"Posted","Invincibles + other Apple","Include","chase-2026-09-04-invincible-1835","Visible in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-04"),"Starbucks",5.90,"Posted","Starbucks","Include","chase-2026-09-04-starbucks-590","Visible in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-05"),"H-E-B",33.50,"Posted","H-E-B / groceries","Include","chase-2026-09-05-heb-3350","Visible in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-05"),"CSC Serviceworks",3.00,"Posted","Automotive","Include","chase-2026-09-05-csc-300","Tire air; user-confirmed"],
 ["Chase",new Date("2026-09-06"),"Payment Thank You",-1141.57,"Posted","Credit-card payment","Exclude","chase-2026-09-06-payment-114157","Card payment; excluded from spending"],
 ["Chase",new Date("2026-09-06"),"H-E-B",165.54,"Posted","H-E-B / groceries","Include","chase-2026-09-06-heb-16554","Visible in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-08"),"MCWHORTER SERVICE",471.61,"Pending","Emergency car repair","Exclude","chase-2026-09-08-mcwhorter-47161","Emergency expense; tracked separately from core scorecard"],
 ["Chase",new Date("2026-09-08"),"Starbucks",12.45,"Pending","Starbucks","Include","chase-2026-09-08-starbucks-1245","Pending in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-09"),"Starbucks",7.22,"Pending","Starbucks","Include","chase-2026-09-09-starbucks-722","Pending in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-09"),"Starbucks",6.55,"Pending","Starbucks","Include","chase-2026-09-09-starbucks-655","Pending in Sep. 9 Chase activity"],
 ["Chase",new Date("2026-09-05"),"CSC Serviceworks",2.50,"Pending","Automotive","Include","chase-2026-09-05-csc-250","Tire air; pending in Sep. 9 Chase activity"],
 ["Discover",new Date("2026-09-08"),"NATIONWIDE PET",48.27,"Pending","Pet costs","Include","discover-2026-09-08-nationwidepet-4827","Monthly pet insurance; confirmed by user from Sep. 9 Discover screenshot"]
];
const ledgerEnd=4+ledgerRows.length;
const sourceForRow=(r)=>{
 const dateKey=r[1].toISOString().slice(0,10);
 if(r[7]==="chase-2026-09-02-royalcaribbean-net-018") return ["Cross-account reconciliation — Sep 9","Chase charge less Wells reimbursement","Verified"];
 if(r[0]==="Chase" && dateKey>="2026-09-01") return r[4]==="Pending" ? ["Chase pending — Sep 9","Pending list","Verified"] : ["Chase activity — Sep 9","Posted activity","Verified"];
 if(r[0]==="Citi" && dateKey>="2026-09-01") return ["2026-09-09 Citi activity","Posted activity","Verified"];
 if(r[0]==="Discover" && dateKey>="2026-09-01") return ["2026-09-09 Discover balance / activity","Recent activity","Verified"];
 if(r[0]==="Prime Visa") return ["2026-09-01 Prime Visa activity","Recent activity","Verified"];
 return ["Archived prior-cycle screenshot","Visible transaction section","Verified"];
};
importSheet.getRange(`A5:G${ledgerEnd}`).values=ledgerRows.map(r=>r.slice(0,7));
importSheet.getRange(`I5:J${ledgerEnd}`).values=ledgerRows.map(r=>[r[7],r[8]]);
importSheet.getRange(`K5:M${ledgerEnd}`).values=ledgerRows.map(sourceForRow);
importSheet.getRange("H5").formulas=[["=IF(B5=\"\",\"\",B5-WEEKDAY(B5-2,1)+1)"]];importSheet.getRange("H5:H304").fillDown();
input(importSheet,"A5:G304");input(importSheet,"I5:M304");importSheet.getRange("B5:B304").format.numberFormat="mmm d, yyyy";importSheet.getRange("D5:D304").format.numberFormat=usd;importSheet.getRange("H5:H304").format.numberFormat="mmm d, yyyy";importSheet.getRange("A4:M304").format.wrapText=true;importSheet.getRange("H5:H304").format={fill:pale,font:{color:"#000000"}};
importSheet.getRange("A5:M304").conditionalFormats.addCustom('=AND($C5<>"",$G5="Exclude")',{fill:red,font:{bold:true,color:"#B91C1C"}});
importSheet.getRange("A5:M304").conditionalFormats.addCustom('=AND($C5<>"",$G5="Transfer / verify")',{fill:"#E8EEF5",font:{color:"#475569"}});
importSheet.getRange("G5:G304").conditionalFormats.add("containsText",{text:"Include",format:{fill:mint,font:{bold:true,color:green}}});
importSheet.getRange("M5:M304").conditionalFormats.add("containsText",{text:"Verified",format:{fill:mint,font:{bold:true,color:green}}});
importSheet.getRange("M5:M304").conditionalFormats.add("containsText",{text:"Needs verification",format:{fill:yellow,font:{bold:true,color:"#7C5E10"}}});
widths(importSheet,[["A:A",14],["B:B",15],["C:C",30],["D:D",14],["E:E",15],["F:F",24],["G:G",19],["H:H",17],["I:I",20],["J:J",30],["K:K",32],["L:L",24],["M:M",18]]);importSheet.showGridLines=false;importSheet.freezePanes.freezeRows(4);

// Weekly Scorecard: a selectable Tuesday–Monday view of actual, pending, and committed spending.
title(scorecard,"A1:G1","This Week — Spending Analysis",operations);
scorecard.getRange("A2:G2").merge();scorecard.getRange("A2").values=[["Review new purchases against their weekly category limits here. Pending charges count so the week cannot look safer than it is. This is analysis, not the cash decision for today; payments and transfers do not belong here. Only source-verified ledger rows are counted."]];scorecard.getRange("A2:G2").format={font:{italic:true,color:gray},wrapText:true};
scorecard.getRange("A3:B3").values=[["Week beginning (Tuesday)",new Date("2026-09-01")]];input(scorecard,"B3");scorecard.getRange("B3").format.numberFormat="mmm d, yyyy";
scorecard.getRange("D3:G3").values=[["Week ends",null,"Budget status",null]];scorecard.getRange("E3").formulas=[["=B3+6"]];scorecard.getRange("G3").formulas=[["=IF(COUNTIFS('Support - Ledger'!$H$5:$H$304,$B$3,'Support - Ledger'!$G$5:$G$304,\"Include\",'Support - Ledger'!$M$5:$M$304,\"<>Verified\")>0,\"Source check needed\",IF(F23<0,\"Over plan\",\"Within plan\"))"]];scorecard.getRange("E3").format.numberFormat="mmm d, yyyy";
scorecard.getRange("A5:G5").values=[["Category","Weekly target","Posted actual","Pending","Committed","Remaining / over","Status"]];headers(scorecard,"A5:G5");
const scoreRows=[
 ["H-E-B / groceries","='Support - Budget Inputs'!E23"],
 ["DoorDash","='Support - Budget Inputs'!E24"],
 ["Starbucks","='Support - Budget Inputs'!E28"],
 ["Invincibles + other Apple","='Support - Budget Inputs'!E19"],
 ["Work snacks","='Support - Budget Inputs'!E29"],
 ["Shopping / personal care","='Support - Budget Inputs'!E30"],
 ["Vapes","='Support - Budget Inputs'!E31"],
 ["Fuel","='Support - Budget Inputs'!E25"],
 ["Pet costs","='Support - Budget Inputs'!E26"],
 ["Electricity","='Support - Budget Inputs'!E14"],
 ["Spectrum internet","='Support - Budget Inputs'!E16"],
 ["Phone + Visible","=SUM('Support - Budget Inputs'!E15,'Support - Budget Inputs'!E17)"],
 ["Subscriptions","='Support - Budget Inputs'!E18"],
 ["Automotive","=0"],
 ["Travel / cruise","=0"],
 ["Education / school supplies","=0"]
];
scorecard.getRange("A6:A21").values=scoreRows.map(r=>[r[0]]);scorecard.getRange("B6").formulas=[[scoreRows[0][1]]];scorecard.getRange("B6:B21").fillDown();
// Individual formula references are assigned after fill-down so each category remains auditable.
scoreRows.forEach((r,i)=>scorecard.getRange(`B${6+i}`).formulas=[[r[1]]]);
scorecard.getRange("C6").formulas=[["=SUMIFS('Support - Ledger'!$D$5:$D$304,'Support - Ledger'!$F$5:$F$304,A6,'Support - Ledger'!$H$5:$H$304,$B$3,'Support - Ledger'!$E$5:$E$304,\"Posted\",'Support - Ledger'!$G$5:$G$304,\"Include\",'Support - Ledger'!$M$5:$M$304,\"Verified\")"]];scorecard.getRange("C6:C21").fillDown();
scorecard.getRange("D6").formulas=[["=SUMIFS('Support - Ledger'!$D$5:$D$304,'Support - Ledger'!$F$5:$F$304,A6,'Support - Ledger'!$H$5:$H$304,$B$3,'Support - Ledger'!$E$5:$E$304,\"Pending\",'Support - Ledger'!$G$5:$G$304,\"Include\",'Support - Ledger'!$M$5:$M$304,\"Verified\")"]];scorecard.getRange("D6:D21").fillDown();
scorecard.getRange("E6").formulas=[["=C6+D6"]];scorecard.getRange("E6:E21").fillDown();scorecard.getRange("F6").formulas=[["=IF(B6=0,\"\",B6-E6)"]];scorecard.getRange("F6:F21").fillDown();scorecard.getRange("G6").formulas=[["=IF(B6=0,\"No target set\",IF(E6=0,\"No activity\",IF(F6<0,\"Over plan\",\"On track\")))"]];scorecard.getRange("G6:G21").fillDown();
scorecard.getRange("A23:G23").values=[["All tracked spending",null,null,null,null,null,null]];scorecard.getRange("B23").formulas=[["=SUM(B6:B21)"]];scorecard.getRange("C23").formulas=[["=SUM(C6:C21)"]];scorecard.getRange("D23").formulas=[["=SUM(D6:D21)"]];scorecard.getRange("E23").formulas=[["=SUM(E6:E21)"]];scorecard.getRange("F23").formulas=[["=B23-E23"]];scorecard.getRange("A23:G23").format={fill:pale,font:{bold:true},borders:{preset:"doubleBottom",style:"medium",color:navy}};
scorecard.getRange("A25:G26").merge();scorecard.getRange("A25").values=[["Transfer confirmation belongs in History after the following Tuesday’s account screens arrive. Keeping it out of this sheet makes this page one thing only: this Tuesday–Monday’s new-purchase limits."]];scorecard.getRange("A25:G26").format={fill:pale,font:{italic:true,color:gray},wrapText:true,verticalAlignment:"center"};scorecard.getRange("B6:F23").format.numberFormat=usd;scorecard.getRange("F6:F23").conditionalFormats.add("cellIs",{operator:"lessThan",formula:0,format:{fill:red,font:{bold:true,color:"#B91C1C"}}});scorecard.getRange("G6:G21").conditionalFormats.add("containsText",{text:"Over plan",format:{fill:red,font:{bold:true,color:"#B91C1C"}}});widths(scorecard,[["A:A",29],["B:F",18],["G:G",18]]);scorecard.getRange("A1:G26").format.wrapText=true;scorecard.getRange("A1:G26").format.font={size:12};scorecard.getRange("A5:G5").format.rowHeight=24;scorecard.getRange("A6:G21").format.rowHeight=23;scorecard.showGridLines=false;scorecard.freezePanes.freezeRows(5);

// Weekly History: each row is labeled by the settlement Tuesday, then records the prior Tuesday–Monday purchase week.
title(history,"A1:M1","History — Weekly Record",audit);
history.getRange("A2:M2").merge();history.getRange("A2").values=[["This is the historical record. A settlement Tuesday pays the prior Tuesday–Monday’s purchases; its Wells balance is therefore never treated as money available for the new purchase week. At the following Tuesday review, mark the execution check and reconcile transfers/screenshots."]];history.getRange("A2:M2").format={font:{italic:true,color:gray},wrapText:true};
history.getRange("A4:M4").values=[["Review Tuesday","Purchase week start","Purchase week end","Wells available at review","Wealthfront rent transfer","Total Wells plan","Execution check","Purchase budget","Posted spend","Pending spend","Committed spend","Remaining / over","Notes"]];headers(history,"A4:M4");
const settlementStart=new Date("2026-09-01");history.getRange("A5:A30").values=Array.from({length:26},(_,i)=>[new Date(settlementStart.getTime()+i*7*86400000)]);history.getRange("B5").formulas=[["=A5-7"]];history.getRange("B5:B30").fillDown();history.getRange("C5").formulas=[["=A5-1"]];history.getRange("C5:C30").fillDown();
history.getRange("D5:H5").values=[[1583.08,631.34,2194.42,"Legacy — not source-audited",435.52]];
history.getRange("I5").formulas=[["=SUMIFS('Support - Ledger'!$D$5:$D$304,'Support - Ledger'!$H$5:$H$304,B5,'Support - Ledger'!$E$5:$E$304,\"Posted\",'Support - Ledger'!$G$5:$G$304,\"Include\",'Support - Ledger'!$M$5:$M$304,\"Verified\")"]];history.getRange("I5:I30").fillDown();history.getRange("J5").formulas=[["=SUMIFS('Support - Ledger'!$D$5:$D$304,'Support - Ledger'!$H$5:$H$304,B5,'Support - Ledger'!$E$5:$E$304,\"Pending\",'Support - Ledger'!$G$5:$G$304,\"Include\",'Support - Ledger'!$M$5:$M$304,\"Verified\")"]];history.getRange("J5:J30").fillDown();history.getRange("K5").formulas=[["=I5+J5"]];history.getRange("K5:K30").fillDown();history.getRange("L5").formulas=[["=IF(H5=\"\",\"\",H5-K5)"]];history.getRange("L5:L30").fillDown();
history.getRange("D6:F6").values=[[1227.78,0,1226.78]];history.getRange("H6").values=[[476.6607692307693]];history.getRange("G6").values=[["Plan created — Sep 9"]];history.getRange("M5:M6").values=[["Legacy baseline: no full line-level source archive existed before the Sep. 9 audit. Do not treat this row as source-certified."],["Reviewed Wed Sep. 9 because of the holiday delay. The source-controlled import is verified and the $1,226.78 cash plan is ready for execution; it is not marked completed yet."]];history.getRange("G5:G30").dataValidation={rule:{type:"list",values:["In progress","Plan created — Sep 9","Data verified — Sep 9","Legacy — not source-audited","✓ Completed","Needs review"]}};input(history,"D7:H30");input(history,"G5:G30");input(history,"M5:M30");history.getRange("A5:C30").format.numberFormat="mmm d, yyyy";history.getRange("D5:F30").format.numberFormat=usd;history.getRange("H5:L30").format.numberFormat=usd;history.getRange("L5:L30").conditionalFormats.add("cellIs",{operator:"lessThan",formula:0,format:{fill:red,font:{bold:true,color:"#B91C1C"}}});widths(history,[["A:C",17],["D:F",19],["G:G",24],["H:L",17],["M:M",42]]);history.getRange("A1:M30").format.wrapText=true;history.getRange("A1:M30").format.font={size:12};history.getRange("A5:M30").format.rowHeight=24;history.getRange("A5:M6").format.rowHeight=42;history.showGridLines=false;history.freezePanes.freezeRows(4);

// Account snapshots and source-control checks for the recurring screenshot import.
title(cash,"A1:J1","Account Snapshots & Source Control",audit);
cash.getRange("A2:J2").merge();cash.getRange("A2").values=[["Cash snapshots are point-in-time values. The source-control section is the import gate: an independent screenshot count and total must match the ledger before Start can show Verified."]];cash.getRange("A2:J2").format={font:{italic:true,color:gray},wrapText:true};
cash.getRange("A4:G4").values=[["As-of date","Account","Available balance","Pending credits","Pending debits","Usable cash now","Source / note"]];headers(cash,"A4:G4");
cash.getRange("A5:E7").values=[[new Date("2026-09-09"),"Wells Fargo checking",1227.78,1343.38,75],[new Date("2026-09-09"),"Wealthfront savings",11847.64,0,0],[new Date("2026-09-09"),"Personal safe cash",220,0,0]];cash.getRange("F5:F7").values=[[1227.78],[11847.64],[220]];cash.getRange("G5:G7").values=[["Available balance from Sep. 9 screenshot; posted balance was −$40.60 before pending payroll and Fidelity activity"],["Sep. 9 screenshot; no activity after the Sep. 2 Wells transfer is visible"],["Wife’s Sep. 9 income held as cash; $160 added to the prior $60. Excluded from Wells/Wealthfront funding."]];
cash.getRange("A4:G7").format.wrapText=true;cash.getRange("A5:A7").format.numberFormat="mmm d, yyyy";cash.getRange("C5:F7").format.numberFormat=usd;cash.getRange("A5:G7").format.rowHeight=45;
sec(cash,"A10:J10","Screenshot source control");
cash.getRange("A11:J11").values=[["Account","Capture","Ledger scope","Expected entries","Entered","Expected visible total","Ledger visible total","Anchor reached?","Control status","Next action"]];headers(cash,"A11:J11");
cash.getRange("A12:J21").values=[
 ["Wells Fargo","Wells snapshot — Sep 9","Balance + transfers","","","","","Yes","Verified","Capture a newer balance and activity view next review"],
 ["Wealthfront","Wealthfront snapshot — Sep 9","Balance","","","","","Yes","Verified","Capture newer activity only when it changes"],
 ["Chase Sapphire","Chase activity — Sep 9","Posted ledger rows",22,null,182.72,null,"Yes",null,"Capture activity through the saved anchor"],
 ["Chase Sapphire","Chase pending — Sep 9","Pending ledger rows",5,null,500.33,null,"Yes",null,"Capture all current pending activity"],
 ["Citi AAdvantage","2026-09-09 Citi activity","Posted ledger rows",3,null,52.63,null,"Yes",null,"Capture activity through the saved anchor"],
 ["Prime Visa","Prime balance — Sep 9","Balance only","","","","","Yes","Verified","Capture activity only when balance is not $0"],
 ["Discover","2026-09-09 Discover balance / activity","Pending ledger rows",1,null,48.27,null,"Yes",null,"Capture balance and all recent activity"],
 ["Capital One","Capital One balance — Sep 9","Balance only","","","","","Yes","Verified","Capture activity only when balance is not $0"],
 ["PayPal Credit","PayPal balance + promos — Sep 9","Debt / promo detail","","","","","Yes","Verified","Full active promo list captured; recheck when a promo changes"],
 ["RBC Canada","Month-end","Not due","","","","","","Not due","Review at month-end"]
];
cash.getRange("E14").formulas=[["=COUNTIF('Support - Ledger'!$K$5:$K$304,B14)"]];cash.getRange("G14").formulas=[["=SUMIF('Support - Ledger'!$K$5:$K$304,B14,'Support - Ledger'!$D$5:$D$304)"]];cash.getRange("E15").formulas=[["=COUNTIF('Support - Ledger'!$K$5:$K$304,B15)"]];cash.getRange("G15").formulas=[["=SUMIF('Support - Ledger'!$K$5:$K$304,B15,'Support - Ledger'!$D$5:$D$304)"]];cash.getRange("E16").formulas=[["=COUNTIF('Support - Ledger'!$K$5:$K$304,B16)"]];cash.getRange("G16").formulas=[["=SUMIF('Support - Ledger'!$K$5:$K$304,B16,'Support - Ledger'!$D$5:$D$304)"]];cash.getRange("E18").formulas=[["=COUNTIF('Support - Ledger'!$K$5:$K$304,B18)"]];cash.getRange("G18").formulas=[["=SUMIF('Support - Ledger'!$K$5:$K$304,B18,'Support - Ledger'!$D$5:$D$304)"]];
cash.getRange("I14").formulas=[["=IF(E14<>D14,\"Missing entry\",IF(ABS(G14-F14)>0.005,\"Total mismatch\",IF(H14<>\"Yes\",\"Anchor not reached\",\"Verified\")))"]];cash.getRange("I15").formulas=[["=IF(E15<>D15,\"Missing entry\",IF(ABS(G15-F15)>0.005,\"Total mismatch\",IF(H15<>\"Yes\",\"Anchor not reached\",\"Verified\")))"]];cash.getRange("I16").formulas=[["=IF(E16<>D16,\"Missing entry\",IF(ABS(G16-F16)>0.005,\"Total mismatch\",IF(H16<>\"Yes\",\"Anchor not reached\",\"Verified\")))"]];cash.getRange("I18").formulas=[["=IF(E18<>D18,\"Missing entry\",IF(ABS(G18-F18)>0.005,\"Total mismatch\",IF(H18<>\"Yes\",\"Anchor not reached\",\"Verified\")))"]];
cash.getRange("A11:J21").format.wrapText=true;cash.getRange("A12:J21").format.rowHeight=30;cash.getRange("F14:G18").format.numberFormat=usd;cash.getRange("I12:I21").conditionalFormats.add("containsText",{text:"Verified",format:{fill:mint,font:{bold:true,color:green}}});cash.getRange("I12:I21").conditionalFormats.add("containsText",{text:"Missing",format:{fill:red,font:{bold:true,color:"#B91C1C"}}});cash.getRange("I12:I21").conditionalFormats.add("containsText",{text:"mismatch",format:{fill:red,font:{bold:true,color:"#B91C1C"}}});cash.getRange("I12:I21").conditionalFormats.add("containsText",{text:"Needs",format:{fill:yellow,font:{bold:true,color:"#7C5E10"}}});
widths(cash,[["A:A",18],["B:B",29],["C:C",22],["D:E",15],["F:F",18],["G:G",52],["H:H",18],["I:I",20],["J:J",38]]);cash.showGridLines=false;cash.freezePanes.freezeRows(11);

// Funding calendar: every weekly budget line has a home for cash and a due-date action.
title(funding,"A1:H1","Funding & Due-Date Detail",reserves);
funding.getRange("A2:H2").merge();funding.getRange("A2").values=[["This is the bridge between the weekly budget and Tuesday payments. A reserve transfer is not new spending. Keep future-dated reserves in Wealthfront; move money to Wells only ahead of a Wells autopay or card payoff."]];funding.getRange("A2:H2").format={font:{italic:true,color:gray},wrapText:true};
funding.getRange("A4:H4").values=[["Category","Bill / reserve","Weekly funding","Next due / action","Where cash lives","Payment route","This Tuesday","Note"]];headers(funding,"A4:H4");
funding.getRange("A5:A12").values=[["Housing"],["Auto loan"],["PayPal promo"],["Phone"],["Student loan"],["Insurance"],["Pet"],["Card-funded spending"]];
funding.getRange("B5:B12").values=[["Rent — next month"],["Genesis G70 / CUTX"],["October deferred-interest payoff"],["AT&T wireless"],["RBC Canada student loan"],["Life insurance"],["BudgetPetCare + grooming"],["Weekly Scorecard categories"]];
funding.getRange("C5").formulas=[["='2. Tuesday Review'!D13"]];funding.getRange("C6").formulas=[["='Support - Budget Inputs'!E13"]];funding.getRange("C7").formulas=[["='Support - Budget Inputs'!E20"]];funding.getRange("C8").formulas=[["='Support - Budget Inputs'!E15"]];funding.getRange("C9").formulas=[["='Support - Budget Inputs'!E21"]];funding.getRange("C10").formulas=[["='Support - Budget Inputs'!E22"]];funding.getRange("C11").formulas=[["='Support - Budget Inputs'!E26"]];funding.getRange("C12").formulas=[["='3. This Week'!B23"]];
funding.getRange("D5:D12").values=[[new Date("2026-10-01")],[new Date("2026-09-27")],[new Date("2026-10-10")],[new Date("2026-09-16")],[new Date("2026-09-30")],[new Date("2026-09-27")],[new Date("2026-10-16")],["Every Tuesday — next card payoff"]];
funding.getRange("E5:H12").values=[
 ["Wealthfront rent bucket","Wealthfront to rent payment","Fund only Wells capacity, up to $300","Track the actual Tuesday contribution in Savings & Debt. Do not assume a catch-up contribution is feasible."],
 ["Wealthfront car reserve","Wealthfront to CUTX on the 27th","Set aside the displayed weekly amount","Pay the exact $746.47 monthly amount. Do not reduce a direct weekly payment to $172.26 unless the reserve already bridges four-Tuesday months"],
 ["Wells until paid","Wells to PayPal Credit","Pay scheduled promo amount","Funded separately from purchases so deferred interest is avoided"],
 ["Wealthfront AT&T reserve","Wealthfront to Wells; Wells AutoPay","Reserve this cycle's $88.59","Normal baseline remains $65/month; this cycle includes roaming"],
 ["Wealthfront Canada-bills reserve","Wealthfront to Wise to RBC","Continue weekly reserve","Debit occurs on the last day of each month; use Wise lead time"],
 ["Wealthfront Canada-bills reserve","Wealthfront to Wise to RBC","Continue weekly reserve","Debit occurs on the 27th; use Wise lead time"],
 ["Wealthfront pet reserve","Card / scheduled order","No separate transfer unless order is imminent","BudgetPetCare expected Oct. 16; grooming cadence is every five weeks"],
 ["Wells available cash until card payoff","Chase / Citi / Prime then weekly payoff","Spend only within Scorecard targets","Do not create a duplicate reserve for items charged to a card and paid next Tuesday"]
];
funding.getRange("A13:B14").values=[["Education","Del Mar tuition savings"],["Future expenses","PayPal future-expenses fund"]];funding.getRange("C13").formulas=[["='5. Savings & Debt'!B15"]];funding.getRange("C14").formulas=[["='5. Savings & Debt'!B16"]];funding.getRange("D13:D14").values=[["Every Tuesday"],["Every Tuesday"]];funding.getRange("E13:H14").values=[["PayPal savings","Automatic PayPal savings transfer","No manual action","New automated weekly tuition bucket; cumulative amount is on Savings & Debt"],["PayPal savings","Automatic PayPal savings transfer","No manual action","New automated weekly future-expenses bucket; cumulative amount is on Savings & Debt"]];
input(funding,"D5:D11");funding.getRange("C5:C14").format={fill:pale,font:{color:"#000000"},numberFormat:usd};funding.getRange("D5:D11").format.numberFormat="mmm d, yyyy";funding.getRange("A1:H14").format.wrapText=true;funding.getRange("A1:H14").format.font={size:12};funding.getRange("A5:H14").format.rowHeight=32;widths(funding,[["A:A",18],["B:B",28],["C:C",16],["D:D",20],["E:E",28],["F:F",31],["G:G",32],["H:H",52]]);funding.showGridLines=false;funding.freezePanes.freezeRows(4);
sec(funding,"A16:H16","Archived payment log — Sep 2");
funding.getRange("A18:G18").values=[["Type","Payment or transfer","Basis","Planned","Completed","Status","Confirmation"]];headers(funding,"A18:G18");
funding.getRange("A19:G29").values=[["Card payment","Chase Sapphire","Balance at Sep. 2 review",72.61,72.61,"✓ Done","Paid Sep. 2"],["Card payment","Citi card","Balance at Sep. 2 review",79.46,79.46,"✓ Done","Paid Sep. 2"],["Card payment","Prime Visa","No balance due",0,0,"✓ Done","Not due"],["Debt payment","PayPal promotional payoff","Weekly promo payoff",148.65,148.65,"✓ Done","Paid Sep. 2"],["Transfer","Rent fund — next month","Rent-payment Tuesday",0,0,"✓ Done","No deposit on rent-payment Tuesday"],["Rent payment","September rent — current month","Due Sep. 1",1169.46,1169.46,"✓ Done","Paid from Wells after Wealthfront transfer"],["Automatic","Fidelity 401(k)","Weekly automatic transfer",75,75,"✓ Done","Confirmed at later review"],["Automatic","PayPal cruise savings","Weekly automatic transfer",85,85,"✓ Done","Confirmed at later review"],["Automatic","PayPal tuition savings","Weekly automatic transfer",193.36,193.36,"✓ Done","Confirmed at later review"],["Automatic","PayPal future-expenses savings","Weekly automatic transfer",50,50,"✓ Done","Confirmed at later review"],["Transfer","Car fund / CUTX","Weekly reserve funding",172.26230769230767,172.26230769230767,"✓ Done","Reserve funding completed"]];
funding.getRange("D19:E29").format.numberFormat=usd;funding.getRange("A18:G29").format.wrapText=true;funding.getRange("A19:G29").format.rowHeight=24;funding.getRange("A1:H29").format.wrapText=true;funding.getRange("A1:H29").format.font={size:12};funding.showGridLines=false;funding.freezePanes.freezeRows(4);

// Live payment review: use after the source-controlled weekly import; archived Sep. 2 actions remain in Support - Funding Detail.
title(tuesday,"A1:G1","Tuesday Review — Live Sep 9",operations);
tuesday.getRange("A2:G2").merge();tuesday.getRange("A2").values=[["Use this live checklist after Start is verified. Planned amounts come from the Sep. 9 account snapshots and funding rules. Done means no further action is needed from you; a bank transaction may still be pending settlement. Scheduled means a transfer is expected but not yet confirmed."]];tuesday.getRange("A2:G2").format={font:{italic:true,color:gray},wrapText:true};
sec(tuesday,"A4:G4","Sep 9 payment and funding plan");
tuesday.getRange("A5:G5").values=[["Source sets verified","Review period","Actions completed","Live plan",null,null,null]];headers(tuesday,"A5:G5");
tuesday.getRange("A6:G6").values=[[null,"Sep 1–Sep 7 purchases","", "Use now",null,null,null]];
tuesday.getRange("A6").formulas=[["=COUNTIF('1. Start'!E6:E13,\"Verified\")&\" of \"&(COUNTA('1. Start'!F6:F14)-COUNTIF('1. Start'!E6:E14,\"Not due\"))&\" source sets verified\""]];tuesday.getRange("C6").formulas=[["=COUNTIF(F9:F19,\"✓ Done\")&\" / \"&COUNTA(B9:B19)&\" actions completed\""]];
tuesday.getRange("A6:G6").format={fill:pale,font:{bold:true},wrapText:true};
tuesday.getRange("A8:G8").values=[["Type","Payment or transfer","Basis","Planned amount","Completed amount","Done?","Confirmation note"]];headers(tuesday,"A8:G8");
tuesday.getRange("A9:C19").values=[["Card payment","Chase Sapphire","Current Sep. 9 balance"],["Card payment","Citi card","Current Sep. 9 balance"],["Card payment","Prime Visa","No balance due"],["Debt payment","PayPal promotional payoff","Stage 1 payoff target"],["Transfer","Rent fund — October","Wells capacity after required actions; capped at normal plan"],["Transfer","Car fund / CUTX","Weekly reserve toward Sep. 27 due date"],["Automatic","Fidelity 401(k)","Pending; already in Wells available balance"],["Automatic","PayPal cruise savings","Flexible savings contribution"],["Automatic","PayPal tuition savings","Weekly scheduled transfer"],["Automatic","PayPal future-expenses savings","Flexible savings contribution"],["Transfer","Wealthfront to Wells","Cover a remaining cash shortfall"]];
tuesday.getRange("D9").formulas=[["='Support - Debt Detail'!B5"]];tuesday.getRange("D10").formulas=[["='Support - Debt Detail'!B6"]];tuesday.getRange("D11").values=[[0]];tuesday.getRange("D12").formulas=[["='Support - Promo Detail'!F12"]];tuesday.getRange("D13").formulas=[["=MIN('5. Savings & Debt'!$B$26,MAX(0,$E$22-SUM($D$9:$D$12,$D$14,$D$16:$D$18)-$E$23))"]];tuesday.getRange("D14").formulas=[["='Support - Budget Inputs'!E13"]];tuesday.getRange("D15").values=[[75]];tuesday.getRange("D16").values=[[85]];tuesday.getRange("D17").values=[[193.36]];tuesday.getRange("D18").values=[[50]];tuesday.getRange("D19").formulas=[["=MAX(0,E21+E23-E22)"]];
tuesday.getRange("E9:E19").values=Array.from({length:11},()=>[null]);
tuesday.getRange("F9:F19").values=[["Not done"],["Not done"],["Not due"],["Not done"],["Not done"],["Not done"],["✓ Done"],["Scheduled"],["Scheduled"],["Scheduled"],["Not done"]];tuesday.getRange("F9:F19").dataValidation={rule:{type:"list",values:["Not done","✓ Done","Not due","Scheduled","Deferred","Partial"]}};
tuesday.getRange("G9:G18").values=[["Pay the current balance if maintaining the weekly payoff routine"],["Pay the current balance if maintaining the weekly payoff routine"],["No payment needed"],["Five weekly payments remain before Oct. 10"],["Move only this calculated amount to rent reserve; it records today’s actual funding"],["Move to CUTX reserve; do not pay the loan early"],["Do not count again in cash required"],["Included in cash required; confirm after it posts"],["Included in cash required; confirm after it posts"],["Included in cash required; confirm after it posts"]];tuesday.getRange("G19").formulas=[["=IF(D19=0,\"No transfer needed after net rent funding\",\"Transfer this amount from Wealthfront so Wells retains $1 after all actions\")"]];
tuesday.getRange("D9:E19").format={fill:pale,font:{color:"#000000"}};input(tuesday,"E9:E19");input(tuesday,"F9:F19");
tuesday.getRange("A20:C20").merge();tuesday.getRange("A20").values=[["Planned subtotal (cash actions)"]];tuesday.getRange("A20:C20").format={fill:pale,font:{bold:true,color:teal}};tuesday.getRange("D20").formulas=[["=SUM(D9:D14,D16:D18)"]];tuesday.getRange("D20").format={fill:pale,font:{bold:true,color:teal},numberFormat:usd,borders:{preset:"doubleBottom",style:"medium",color:teal}};
tuesday.getRange("A21:D21").merge();tuesday.getRange("A21").values=[["Cash required for payments and transfers"]];tuesday.getRange("A21:D21").format={fill:mint,font:{bold:true,color:teal}};tuesday.getRange("E21").formulas=[["=SUM(D9:D14,D16:D18)"]];
tuesday.getRange("A22:D22").merge();tuesday.getRange("A22").values=[["Wells available now after pending Fidelity"]];tuesday.getRange("A22:D22").format={fill:mint,font:{bold:true,color:teal}};tuesday.getRange("E22").values=[[1227.78]];
tuesday.getRange("A23:D23").merge();tuesday.getRange("A23").values=[["Minimum Wells balance after all actions"]];tuesday.getRange("A23:D23").format={fill:yellow,font:{bold:true,color:navy}};tuesday.getRange("E23").values=[[1]];
tuesday.getRange("A24:D24").merge();tuesday.getRange("A24").values=[["Move from Wealthfront to Wells if needed"]];tuesday.getRange("A24:D24").format={fill:mint,font:{bold:true,color:teal}};tuesday.getRange("E24").formulas=[["=D19"]];
tuesday.getRange("E21:E24").format={fill:pale,font:{bold:true,size:14},numberFormat:usd,borders:{preset:"outside",style:"medium",color:"#A7C9C8"}};tuesday.getRange("D9:E19").format.numberFormat=usd;tuesday.getRange("A1:G24").format.wrapText=true;tuesday.getRange("A9:G19").format.rowHeight=25;widths(tuesday,[["A:A",18],["B:B",28],["C:C",21],["D:E",18],["F:F",15],["G:G",41]]);tuesday.getRange("A1:G24").format.font={size:12};tuesday.showGridLines=false;tuesday.freezePanes.freezeRows(8);

// Start: compact decision page for the Codex viewer. Actions live only on Tuesday Review.
title(dash,"A1:C1","Start — Weekly Cash Plan",operations);
dash.getRange("A2:C2").merge();dash.getRange("A2").values=[["Open this page first. It answers whether this week’s plan can be funded from Wells and the exact transfer needed. Use Tuesday Review to complete the actions; use This Week only for spending analysis."]];dash.getRange("A2:C2").format={font:{italic:true,color:gray},wrapText:true};
sec(dash,"A4:C4","Today’s cash plan — Sep 9");
dash.getRange("A5:C8").values=[["Wells available now",null,"After pending Fidelity debit"],["Cash required today",null,"Rent uses only Wells capacity after required actions"],["Move from Wealthfront",null,"Only if still short after net rent funding; retain $1 in Wells"],["Wells left after plan",null,"This must match Tuesday Review"]];
dash.getRange("B5").formulas=[["='2. Tuesday Review'!E22"]];dash.getRange("B6").formulas=[["='2. Tuesday Review'!E21"]];dash.getRange("B7").formulas=[["='2. Tuesday Review'!E24"]];dash.getRange("B8").formulas=[["=B5+B7-B6"]];
dash.getRange("A5:C8").format={fill:pale,borders:{preset:"inside",style:"thin",color:"#D9E5E7"},wrapText:true};dash.getRange("B5:B8").format={fill:"#FFFFFF",font:{bold:true,size:14},numberFormat:usd};dash.getRange("A6:C6").format={fill:yellow,font:{bold:true}};dash.getRange("A7:C7").format={fill:yellow,font:{bold:true}};dash.getRange("A8:C8").format={fill:mint,font:{bold:true}};
// Spending analysis, funding detail, and historical workflow remain on their dedicated sheets.

// Start: source checkpoints. Each anchor is the last posted transaction that the next capture must include.
title(dash,"E1:H1","Import checkpoints",operations);
dash.getRange("E2:H2").merge();dash.getRange("E2").values=[["Green is formula-based: the expected visible entry count, pending total, and anchor check must match the ledger. A received screenshot alone is not verification."]];dash.getRange("E2:H2").format={font:{italic:true,color:gray},wrapText:true};
sec(dash,"E4:H4","Source checkpoints");
dash.getRange("E5:H5").values=[["Import status","Account","Latest posted anchor","Next statement check"]];headers(dash,"E5:H5");
dash.getRange("E6:H14").values=[
  [null,"Wells Fargo","Sep 8 · Chase ePay · $1,141.57","Statement received Sep 8"],
  [null,"Wealthfront","Sep 2 · Wells transfer · $631.34","Confirm statement date"],
  [null,"Chase Sapphire","Sep 6 · Card payment · $1,141.57","Check after Sep 27"],
  [null,"Citi AAdvantage","Sep 3 · PCC Ingleside · $68.75","Check after Oct 7"],
  [null,"Prime Visa","No activity shown · $0 balance","Confirm statement date"],
  [null,"Discover","Aug 11 · internet payment · $48.27","Confirm statement date"],
  [null,"Capital One","No activity shown · $0 balance","Confirm statement date"],
  [null,"PayPal Credit","Sep 2 · payment · $148.65","Confirm statement date"],
  ["Not due","RBC Canada","Month-end loan + insurance","Check at month-end"]
];
dash.getRange("E6").formulas=[["='Support - Account Snapshots'!I12"]];dash.getRange("E7").formulas=[["='Support - Account Snapshots'!I13"]];dash.getRange("E8").formulas=[["=IF(AND('Support - Account Snapshots'!I14=\"Verified\",'Support - Account Snapshots'!I15=\"Verified\"),\"Verified\",\"Source check needed\")"]];dash.getRange("E9").formulas=[["='Support - Account Snapshots'!I16"]];dash.getRange("E10").formulas=[["='Support - Account Snapshots'!I17"]];dash.getRange("E11").formulas=[["='Support - Account Snapshots'!I18"]];dash.getRange("E12").formulas=[["='Support - Account Snapshots'!I19"]];dash.getRange("E13").formulas=[["='Support - Account Snapshots'!I20"]];
dash.getRange("E6:H14").format={fill:pale,borders:{preset:"inside",style:"thin",color:"#D9E5E7"},wrapText:true,verticalAlignment:"center"};
dash.getRange("E6:E14").format={font:{bold:true},horizontalAlignment:"center"};
dash.getRange("E6:E13").format={fill:mint,font:{bold:true,color:teal},horizontalAlignment:"center"};
dash.getRange("E6:E13").conditionalFormats.add("containsText",{text:"Needs",format:{fill:yellow,font:{bold:true,color:"#7C5E10"}}});dash.getRange("E6:E13").conditionalFormats.add("containsText",{text:"Source check",format:{fill:red,font:{bold:true,color:"#B91C1C"}}});
dash.getRange("E14").format={fill:"#E8EEF5",font:{bold:true,color:gray},horizontalAlignment:"center"};
dash.getRange("H6").format={fill:yellow,font:{bold:true,color:"#7C5E10"}};
dash.getRange("E16:H17").merge();dash.getRange("E16").values=[["Fidelity is verified through Wells Fargo transfers. PayPal Credit is reviewed weekly because its promotional balances have payment deadlines."]];dash.getRange("E16:H17").format={fill:"#E8EEF5",font:{italic:true,color:gray},wrapText:true,verticalAlignment:"center"};

dash.getRange("A1:H17").format.wrapText=true;dash.getRange("A1:H17").format.font={size:12};dash.getRange("A5:C8").format.rowHeight=29;dash.getRange("E6:H14").format.rowHeight=30;dash.getRange("E16:H17").format.rowHeight=28;widths(dash,[["A:A",29],["B:B",22],["C:C",28],["D:D",3],["E:E",12],["F:F",19],["G:G",33],["H:H",21]]);dash.showGridLines=false;dash.freezePanes.freezeRows(4);

wb.recalculate();
const check=await wb.inspect({kind:"table",range:"1. Start!A1:H17",include:"values,formulas",tableMaxRows:17,tableMaxCols:8});console.log(check.ndjson);
const tuesdayCheck=await wb.inspect({kind:"table",range:"2. Tuesday Review!A1:G24",include:"values,formulas",tableMaxRows:24,tableMaxCols:7});console.log(tuesdayCheck.ndjson);
const historyCheck=await wb.inspect({kind:"table",range:"6. History!A4:M7",include:"values,formulas",tableMaxRows:4,tableMaxCols:13});console.log(historyCheck.ndjson);
const errors=await wb.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",options:{useRegex:true,maxResults:100},summary:"formula error scan"});console.log(errors.ndjson);
const renderRanges={"1. Start":"A1:H17","2. Tuesday Review":"A1:G24","3. This Week":"A1:G26","4. Money Plan":"A1:F42","5. Savings & Debt":"A1:F39","6. History":"A1:M18","Support - Ledger":"A1:M18","Support - Budget Inputs":"A1:F41","Support - Funding Detail":"A1:H29","Support - Debt Detail":"A1:G15","Support - Promo Detail":"A1:G12","Support - Account Snapshots":"A1:J21","Support - Pending Review":"A1:F26","Support - Rules":"A1:F31","Support - Sources":"A1:E13"};
for(const [sheetName,range] of Object.entries(renderRanges)){const image=await wb.render({sheetName,range,scale:1,format:"png"});await fs.writeFile(`${outDir}/${sheetName.replaceAll(" ","_")}.png`,new Uint8Array(await image.arrayBuffer()));}
const file=await SpreadsheetFile.exportXlsx(wb);await file.save(`${outDir}/comprehensive_budget.xlsx`);
