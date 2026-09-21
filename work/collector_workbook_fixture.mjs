// Entirely fictional template. Never replace with a copy of a financial workbook.
import {Workbook} from '@oai/artifact-tool';
import {workbookBytes} from './workbook_bytes.mjs';
export async function fictionalWorkbook(){
  const wb=Workbook.create();
  const names=['1. Start','2. Tuesday Review','3. This Week','4. Money Plan','5. Savings & Debt','6. History',
    'Support - Ledger','Support - Budget Inputs','Support - Funding Detail','Support - Debt Detail','Support - Promo Detail',
    'Support - Account Snapshots','Support - Pending Review','Support - Rules','Support - Sources'];
  for(const name of names){
    const s=wb.worksheets.add(name);s.getRange('A1:I1').merge();s.getRange('A1').values=[['FICTIONAL TEST — '+name]];
    s.getRange('A1:I35').format={font:{name:'Arial',size:10},verticalAlignment:'center',wrapText:true};
    s.getRange('A1:I1').format={fill:'#173F5F',font:{color:'#FFFFFF',bold:true,size:14},rowHeight:32};
    s.getRange('A:I').format.columnWidth=20;s.getRange('A2:I35').format.rowHeight=28;s.showGridLines=false;
  }
  const s=wb.worksheets.getItem('1. Start');s.getRange('A2:C2').merge();s.getRange('A2').values=[['Prior fictional import']];s.getRange('A2:C2').format.rowHeight=60;
  s.getRange('A4:C8').values=[['Prior review',null,null],['Wells',null,'Fictional balance'],['Import','Verified','Fictional audit'],['Cash plan','Complete','Fictional prior plan'],['Next action','Review','Fictional note']];
  s.getRange('B5').formulas=[["='Support - Account Snapshots'!F5"]];s.getRange('E4').values=[['Prior source checks']];
  s.getRange('C8').format={fill:'#FFF2CC'};
  const t=wb.worksheets.getItem('2. Tuesday Review');t.getRange('A2:G2').merge();t.getRange('A2').values=[['Prior fictional checklist']];t.getRange('A2:G2').format.rowHeight=40;
  t.getRange('A8:G8').values=[['Type','Account','Basis','Amount','Status','Action','Note']];
  t.getRange('A9:G9').values=[['Card payment','Fictional card','Prior review',25,'Done','Manual','Prior confirmation']];
  t.getRange('D15').formulas=[['=MAX(0,100-SUM(D9:D14)-1)']];t.getRange('E9:E22').dataValidation={rule:{type:'list',values:['Done','Not due','Automatic']}};
  const l=wb.worksheets.getItem('Support - Ledger');l.getRange('A4:M4').values=[['Account','Transaction date','Description','Expense amount','Status','Budget category','Treatment','Week start (Tue)','Unique key','Review note','Source archive','Visible section','Verification']];
  l.getRange('A4:M4').format={fill:'#173F5F',font:{color:'#FFFFFF',bold:true}};
  l.getRange('A5:G5').values=[['Chase',new Date('2031-09-01'),'FICTIONAL LEGACY SHOP',2,'Posted','Shopping','Include']];
  l.getRange('B5').setNumberFormat('mmm d, yyyy');l.getRange('D5').setNumberFormat('$#,##0.00;[Red]($#,##0.00);-');
  l.getRange('I5:M5').values=[['fictional-old-row','Keep this note','fictional:evidence','posted','Verified']];
  l.getRange('H5').formulas=[['=B5-WEEKDAY(B5-2,1)+1']];
  const h=wb.worksheets.getItem('6. History');h.getRange('A4:C5').values=[['Review','Status','Total'],[new Date('2031-09-02'),'Completed',50]];
  h.getRange('D5').formulas=[['=SUM(C5)']];
  wb.worksheets.getItem('Support - Account Snapshots').getRange('F5').values=[[100]];
  wb.worksheets.getItem('5. Savings & Debt').getRange('B6').values=[[20]];
  wb.worksheets.getItem('4. Money Plan').getRange('B28').formulas=[['=100-50']];
  wb.recalculate();
  return workbookBytes(wb);
}
