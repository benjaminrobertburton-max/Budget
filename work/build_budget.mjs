import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outDir = "C:/Users/Home/Documents/Codex/2026-08-29/help/outputs/01a04fdf-3751-72e2-88f1-daf19b8b9d1d";
await fs.mkdir(outDir, { recursive: true });

const wb = Workbook.create();
const dashboard = wb.worksheets.add("Dashboard");
const budget = wb.worksheets.add("Monthly Budget");
const spending = wb.worksheets.add("Spending Log");
const debt = wb.worksheets.add("Card Plan");
const lists = wb.worksheets.add("Lists");

const navy = "#18324A", teal = "#0F766E", mint = "#DFF3EF", pale = "#F5F8FA", yellow = "#FFF2CC", red = "#FDE9E7", gray = "#64748B";
const money = "$#,##0;[Red]($#,##0);-";
const title = (sheet, text, range) => {
  sheet.getRange(range).merge();
  sheet.getRange(range.split(":")[0]).values = [[text]];
  sheet.getRange(range).format = { fill: navy, font: { bold: true, color: "#FFFFFF", size: 16 }, horizontalAlignment: "left", verticalAlignment: "center" };
  sheet.getRange(range).format.rowHeight = 30;
};
const section = (sheet, range, text) => {
  sheet.getRange(range).merge();
  sheet.getRange(range.split(":")[0]).values = [[text]];
  sheet.getRange(range).format = { fill: teal, font: { bold: true, color: "#FFFFFF" }, verticalAlignment: "center" };
};
const input = (sheet, range) => { sheet.getRange(range).format = { fill: yellow, font: { color: "#0000FF" } }; };
const formula = (sheet, range) => { sheet.getRange(range).format.font = { color: "#000000" }; };

// Lists
lists.getRange("A1:A14").values = [["Categories"],["Housing"],["Utilities"],["Groceries"],["Dining"],["Transport"],["Health"],["Pet"],["Subscriptions"],["Fun"],["Travel"],["Debt payment"],["Savings"],["Other"]];
lists.getRange("B1:B3").values = [["Type"],["Expense"],["Income"]];
lists.getRange("A1:B1").format = { fill: navy, font: { bold: true, color: "#FFFFFF" } };
lists.getRange("A1:B14").format.columnWidth = 18;
lists.showGridLines = false;

// Monthly Budget
title(budget, "Monthly Budget", "A1:F1");
budget.getRange("A2:F2").merge();
budget.getRange("A2").values = [["Enter your take-home income and monthly targets in yellow. Actuals pull from Spending Log."]];
budget.getRange("A2:F2").format = { font: { italic: true, color: gray }, wrapText: true };
section(budget, "A4:F4", "Income");
budget.getRange("A5:D5").values = [["Category", "Monthly budget", "Actual", "Difference"]];
budget.getRange("A6:D7").values = [["Paycheck 1", 0, null, null],["Paycheck 2", 0, null, null]];
budget.getRange("C6").formulas = [["=SUMIFS('Spending Log'!$F$6:$F$205,'Spending Log'!$C$6:$C$205,A6,'Spending Log'!$B$6:$B$205,\"Income\")"];
budget.getRange("C6:C7").fillDown();
budget.getRange("D6").formulas = [["=B6-C6"]]; budget.getRange("D6:D7").fillDown();
budget.getRange("A8:D8").values = [["Total income", null, null, null]];
budget.getRange("B8").formulas = [["=SUM(B6:B7)"]]; budget.getRange("C8").formulas = [["=SUM(C6:C7)"]]; budget.getRange("D8").formulas = [["=B8-C8"]];
section(budget, "A10:F10", "Spending plan");
budget.getRange("A11:D11").values = [["Category", "Monthly budget", "Actual", "Left to spend"]];
const cats = ["Housing","Utilities","Groceries","Dining","Transport","Health","Pet","Subscriptions","Fun","Travel","Debt payment","Savings","Other"];
budget.getRange("A12:A24").values = cats.map(x => [x]);
budget.getRange("B12:B24").values = cats.map(() => [0]);
budget.getRange("C12").formulas = [["=SUMIFS('Spending Log'!$F$6:$F$205,'Spending Log'!$C$6:$C$205,A12,'Spending Log'!$B$6:$B$205,\"Expense\")"];
budget.getRange("C12:C24").fillDown();
budget.getRange("D12").formulas = [["=B12-C12"]]; budget.getRange("D12:D24").fillDown();
budget.getRange("A25:D25").values = [["Total planned spending", null, null, null]];
budget.getRange("B25").formulas = [["=SUM(B12:B24)"]]; budget.getRange("C25").formulas = [["=SUM(C12:C24)"]]; budget.getRange("D25").formulas = [["=B25-C25"]];
budget.getRange("A27:D27").values = [["Monthly cushion", null, null, null]];
budget.getRange("B27").formulas = [["=B8-B25"]]; budget.getRange("C27").formulas = [["=C8-C25"]]; budget.getRange("D27").formulas = [["=B27-C27"]];
budget.getRange("A5:D5").format = { fill: mint, font: { bold: true } };
budget.getRange("A11:D11").format = { fill: mint, font: { bold: true } };
budget.getRange("A8:D8").format = { fill: pale, font: { bold: true }, borders: { preset: "doubleBottom", style: "medium", color: navy } };
budget.getRange("A25:D25").format = { fill: pale, font: { bold: true }, borders: { preset: "doubleBottom", style: "medium", color: navy } };
budget.getRange("A27:D27").format = { fill: mint, font: { bold: true }, borders: { preset: "outside", style: "medium", color: teal } };
input(budget, "B6:B7"); input(budget, "B12:B24"); formula(budget, "C6:D8"); formula(budget, "C12:D27");
budget.getRange("B6:D27").format.numberFormat = money;
budget.getRange("A1:F27").format.wrapText = true;
budget.getRange("A1:A27").format.columnWidth = 22; budget.getRange("B1:D27").format.columnWidth = 16; budget.getRange("E1:F27").format.columnWidth = 3;
budget.getRange("D12:D24").conditionalFormats.add("cellIs", { operator: "lessThan", formula: 0, format: { fill: red, font: { color: "#B91C1C", bold: true } } });
budget.showGridLines = false;

// Spending log
title(spending, "Spending Log", "A1:G1");
spending.getRange("A2:G2").merge();
spending.getRange("A2").values = [["Add purchases and deposits here. Keep pending Chase charges marked as Pending until they post."]];
spending.getRange("A2:G2").format = { font: { italic: true, color: gray } };
spending.getRange("A5:G5").values = [["Date", "Type", "Category", "Merchant / note", "Status", "Amount", "Month"]];
spending.getRange("A6:G8").values = [[null, "Expense", "Debt payment", "Chase payment — posted balance paid", "Completed", 952.91, null],[null, "Expense", "Debt payment", "Chase pending charges — expected if they post", "Pending", 1348.96, null],[null, null, null, null, null, null, null]];
spending.getRange("G6").formulas = [["=IF(A6=\"\",\"\",TEXT(A6,\"mmm yyyy\"))"]]; spending.getRange("G6:G205").fillDown();
spending.getRange("A6:A205").format.numberFormat = "mmm d, yyyy"; spending.getRange("F6:F205").format.numberFormat = money;
spending.getRange("A5:G5").format = { fill: mint, font: { bold: true } };
input(spending, "A6:F205"); formula(spending, "G6:G205");
spending.getRange("B6:B205").dataValidation = { rule: { type: "list", formula1: "'Lists'!$B$2:$B$3" } };
spending.getRange("C6:C205").dataValidation = { rule: { type: "list", formula1: "'Lists'!$A$2:$A$14" } };
spending.getRange("E6:E205").dataValidation = { rule: { type: "list", values: ["Pending","Completed"] } };
spending.getRange("E6:E205").conditionalFormats.add("containsText", { text: "Pending", format: { fill: yellow } });
spending.getRange("A5:G205").format.borders = { preset: "outside", style: "thin", color: "#CBD5E1" };
spending.getRange("A1:A205").format.columnWidth = 15; spending.getRange("B1:C205").format.columnWidth = 16; spending.getRange("D1:D205").format.columnWidth = 35; spending.getRange("E1:E205").format.columnWidth = 14; spending.getRange("F1:G205").format.columnWidth = 15;
spending.freezePanes.freezeRows(5); spending.showGridLines = false;

// Card Plan
title(debt, "Chase Card Plan", "A1:E1");
debt.getRange("A2:E3").merge();
debt.getRange("A2").values = [["Based on your prior conversation: $952.91 was paid toward the posted Chase balance. The $1,348.96 is newer pending activity and should stay separate until it posts or disappears."]];
debt.getRange("A2:E3").format = { fill: pale, font: { color: gray }, wrapText: true, verticalAlignment: "center" };
section(debt, "A5:E5", "Current card snapshot");
debt.getRange("A6:C9").values = [["Item", "Amount", "Status"],["Posted Chase balance paid", 952.91, "Payment submitted"],["Newer pending Chase activity", 1348.96, "Pending — verify after posting"],["Expected future balance if all pending charges post", null, "Estimate"]];
debt.getRange("B9").formulas = [["=B8"]];
debt.getRange("A6:C6").format = { fill: mint, font: { bold: true } };
debt.getRange("A9:C9").format = { fill: pale, font: { bold: true }, borders: { preset: "doubleBottom", style: "medium", color: navy } };
input(debt, "B7:B8"); formula(debt, "B9"); debt.getRange("B7:B9").format.numberFormat = money;
section(debt, "A12:E12", "Paydown goal");
debt.getRange("A13:B17").values = [["Monthly payment you can afford", 0],["Months to pay off", 0],["Suggested monthly payment", null],["Extra amount above your planned payment", null],["Notes", "Update the yellow cells once you know your income and bills."]];
debt.getRange("B15").formulas = [["=IF(B14>0,B9/B14,0)"]]; debt.getRange("B16").formulas = [["=B15-B13"]];
input(debt, "B13:B14"); formula(debt, "B15:B16"); debt.getRange("B13:B16").format.numberFormat = money;
debt.getRange("B14").format.numberFormat = "#,##0";
debt.getRange("A13:A17").format = { fill: mint, font: { bold: true } }; debt.getRange("B17").format.wrapText = true;
debt.getRange("A1:A17").format.columnWidth = 42; debt.getRange("B1:B17").format.columnWidth = 18; debt.getRange("C1:E17").format.columnWidth = 22;
debt.showGridLines = false;

// Dashboard
title(dashboard, "Budget Dashboard", "A1:H1");
dashboard.getRange("A2:H2").merge(); dashboard.getRange("A2").values = [["Your monthly view. Yellow cells on the other tabs are the places to update."]]; dashboard.getRange("A2:H2").format = { font: { italic: true, color: gray } };
const cards = [["Planned income", "='Monthly Budget'!B8"],["Planned spending", "='Monthly Budget'!B25"],["Planned cushion", "='Monthly Budget'!B27"],["Actual spending", "='Monthly Budget'!C25"],["Chase pending activity", "='Card Plan'!B8"],["Total card amount to watch", "='Card Plan'!B9"]];
for (let i=0; i<cards.length; i++) { const col = i%3*3+1; const row = i<3?5:10; const label = String.fromCharCode(64+col); const end = String.fromCharCode(64+col+1); dashboard.getRange(`${label}${row}:${end}${row}`).merge(); dashboard.getRange(`${label}${row}`).values=[[cards[i][0]]]; dashboard.getRange(`${label}${row}:${end}${row}`).format={fill:mint,font:{bold:true,color:teal},horizontalAlignment:"center"}; dashboard.getRange(`${label}${row+1}:${end}${row+2}`).merge(); dashboard.getRange(`${label}${row+1}`).formulas=[[cards[i][1]]]; dashboard.getRange(`${label}${row+1}:${end}${row+2}`).format={fill:pale,font:{bold:true,size:18,color:"#000000"},horizontalAlignment:"center",verticalAlignment:"center",numberFormat:money,borders:{preset:"outside",style:"medium",color:"#B7D9D3"}}; }
section(dashboard, "A15:H15", "How to use this workbook");
dashboard.getRange("A16:H18").merge(); dashboard.getRange("A16").values = [["1. Set monthly income and category targets in Monthly Budget.  2. Record transactions in Spending Log.  3. Re-check Chase pending activity once it posts and update the Card Plan.  4. Use the cushion number to decide how much extra you can send to the card."]]; dashboard.getRange("A16:H18").format={fill:pale,wrapText:true,verticalAlignment:"center"};
dashboard.getRange("A1:H18").format.columnWidth = 15; dashboard.getRange("A1:A18").format.columnWidth = 22; dashboard.showGridLines=false;

for (const s of [dashboard,budget,spending,debt,lists]) { const used = s.getUsedRange(); used.format.verticalAlignment = "center"; }

const check = await wb.inspect({ kind: "table", range: "Dashboard!A1:H18", include: "values,formulas", tableMaxRows: 18, tableMaxCols: 8 });
console.log(check.ndjson);
const errors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log(errors.ndjson);
for (const sheetName of ["Dashboard","Monthly Budget","Spending Log","Card Plan","Lists"]) {
  const png = await wb.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outDir}/${sheetName.replaceAll(" ", "_")}.png`, new Uint8Array(await png.arrayBuffer()));
}
const file = await SpreadsheetFile.exportXlsx(wb);
await file.save(`${outDir}/personal_budget.xlsx`);
