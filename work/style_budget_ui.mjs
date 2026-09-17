// Presentation only. Keep original data, financial formulas and audit rules at their addresses.
// The only cell content added here is navigation in previously empty cells.
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { xml2js } from "xml-js";

export function applyBudgetUi(s) {
  const navigation = [];
  const ink = "#243447", muted = "#64748B", line = "#AEBFD2", soft = "#E5EDF7";
  const navy = "#172D49", section = "#304F70", canvas = "#EEF2F7", accent = "#285A91";
  const money = '$#,##0.00"  ";[Red]($#,##0.00)"  ";"-  "';
  const row = (sheet, range, height) => { sheet.getRange(range).format.rowHeight = height; };
  const fill = (sheet, range, color) => { sheet.getRange(range).format.fill = color; };
  const font = (sheet, range, settings) => { sheet.getRange(range).format.font = settings; };
  const cols = (sheet, widths) => widths.forEach((width, i) => {
    sheet.getCell(0, i).format.columnWidth = width;
  });
  const band = (sheet, range) => {
    fill(sheet, range, section);
    font(sheet, range, {name:"Arial", size:11, bold:true, color:"#FFFFFF"});
    sheet.getRange(range).format.borders = {bottom:{style:"thin", color:line}};
    row(sheet, range, 24);
  };
  const head = (sheet, range, height=30) => {
    band(sheet, range);
    fill(sheet, range, soft);
    font(sheet, range, {size:10, color:ink});
    sheet.getRange(range).format.horizontalAlignment = "left";
    row(sheet, range, height);
  };
  const total = (sheet, range) => {
    fill(sheet, range, soft);
    font(sheet, range, {bold:true});
    sheet.getRange(range).format.borders = {top:{style:"thin", color:line}};
  };
  const nav = (sheet, cell, target, caption, address="A1") => {
    if (sheet.getRange(cell).values[0][0] != null) throw new Error(`Navigation would overwrite ${cell}`);
    sheet.getRange(cell).values = [[caption]];
    navigation.push({sheet:sheet.name, cell, location:`'${target.replaceAll("'", "''")}'!${address}`, caption});
    font(sheet, cell, {name:"Arial", size:10, color:"#365F83", bold:false, italic:false});
    row(sheet, cell, 25);
  };
  const specs = [
    [s.dash,"A1:H17","A1:C1"],[s.tuesday,"A1:G27","A1:G1"],
    [s.scorecard,"A1:G26","A1:G1"],[s.weekly,"A1:F42","A1:F1"],
    [s.savings,"A1:F39","A1:F1"],[s.history,"A1:M30","A1:M1"],
    [s.importSheet,"A1:M304","A1:M1"],[s.budget,"A1:F41","A1:F1"],
    [s.funding,"A1:H29","A1:H1"],[s.bills,"A1:G15","A1:G1"],
    [s.payplan,"A1:G12","A1:G1"],[s.cash,"A1:J21","A1:J1"],
    [s.pending,"A1:F26","A1:F1"],[s.rules,"A1:F31","A1:F1"],
    [s.sources,"A1:E13","A1:E1"],
  ];
  specs.forEach(([sheet, used, title], index) => {
    sheet.getRange(used).format.borders = {preset:"all",style:"thin",color:"#FFFFFF"};
    sheet.getRange(used).format.verticalAlignment = "center";
    sheet.getRange(used).format.wrapText = true;
    font(sheet, used, {name:"Arial", size:index < 6 ? 11 : 10});
    fill(sheet, title, index < 6 ? navy : "#415A73");
    font(sheet, title, {name:"Arial", size:index < 6 ? 20 : 14, bold:true, color:"#FFFFFF"});
    row(sheet, title, index < 6 ? 44 : 34);
    sheet.showGridLines = false;
    // Short return link above each supporting table; selectors keep their original rows.
    if (index > 0 && sheet !== s.scorecard && sheet !== s.payplan && sheet !== s.sources) {
      nav(sheet,"A3","1. Start","Back to Start");
    }
  });

  // Start: a compact two-column command center with an explicit path into the workflow.
  cols(s.dash,[25,22,32,3,12,18,28,18]);
  fill(s.dash,"D1:H1",navy);
  font(s.dash,"E1:H1",{size:16,bold:true,color:"#FFFFFF"});
  row(s.dash,"A2:H2",48);
  font(s.dash,"A2:H2",{size:10,italic:false,color:muted});
  ["A4:C4","A10:C10","E4:H4"].forEach(r=>band(s.dash,r));
  head(s.dash,"E5:H5",34);head(s.dash,"A11:C11",28);
  fill(s.dash,"A5:C8","#FFFFFF");
  font(s.dash,"A5:C8",{bold:false});
  font(s.dash,"B5",{size:16,bold:true});
  font(s.dash,"B6:B8",{size:11,bold:true});
  font(s.dash,"C5:C17",{size:10});
  fill(s.dash,"F6:H14","#FFFFFF");
  // H6 is an existing yellow control and retains its exact input color.
  fill(s.dash,"H6","#FFF2CC");
  fill(s.dash,"A12:A17","#FFFFFF");fill(s.dash,"C12:C17","#FFFFFF");
  font(s.dash,"A12:A17",{bold:false});
  row(s.dash,"A6:H14",32);row(s.dash,"A12:H17",40);row(s.dash,"A15:H15",32);
  row(s.dash,"A4:H4",25);row(s.dash,"A5:H5",38);row(s.dash,"A10:H10",30);row(s.dash,"A11:H11",28);
  font(s.dash,"E6:H14",{size:10});
  fill(s.dash,"E16:H17","#FFFFFF");font(s.dash,"E16:H17",{size:10,italic:false});
  nav(s.dash,"A3","2. Tuesday Review","Tuesday Review");
  nav(s.dash,"B3","3. This Week","This Week");
  nav(s.dash,"C3","5. Savings & Debt","Savings & Debt");
  nav(s.dash,"E3","4. Money Plan","Money Plan");
  nav(s.dash,"F3","6. History","History");
  nav(s.dash,"G3","2. Tuesday Review","Payment totals","A23");
  s.dash.freezePanes.unfreeze();

  // Payment checklist: names, amounts and statuses lead; basis and confirmation remain visible.
  cols(s.tuesday,[16,28,26,14,17,13,41]);
  row(s.tuesday,"A2:G2",36);band(s.tuesday,"A4:G4");head(s.tuesday,"A5:G5",24);
  fill(s.tuesday,"A6:G6","#FFFFFF");row(s.tuesday,"A6:G6",38);
  s.tuesday.getRange("D5:G5").merge();s.tuesday.getRange("D6:G6").merge();
  head(s.tuesday,"A8:G8",28);row(s.tuesday,"A9:G22",28);row(s.tuesday,"A7:G7",8);
  font(s.tuesday,"A9:A22",{size:10,color:muted,bold:false});
  font(s.tuesday,"B9:B22",{bold:true});font(s.tuesday,"C9:C22",{size:10,bold:false});
  font(s.tuesday,"G9:G22",{size:10,bold:false});
  font(s.tuesday,"D9:D22",{size:12,bold:true});
  s.tuesday.getRange("D9:D23").format.horizontalAlignment="right";
  s.tuesday.getRange("E9:F22").format.horizontalAlignment="center";
  fill(s.tuesday,"A9:D22","#FFFFFF");
  [14,17,22].forEach(r=>{s.tuesday.getRange(`A${r}:G${r}`).format.borders={top:{style:"thin",color:line}};});
  row(s.tuesday,"A15:G15",36);row(s.tuesday,"A22:G22",42);
  font(s.tuesday,"E22",{bold:true});
  ["A23:D23","A24:E24","A25:E25","A27:E27"].forEach(r=>total(s.tuesday,r));
  row(s.tuesday,"A23:G27",29);
  font(s.tuesday,"A23:D27",{size:11,bold:true});
  font(s.tuesday,"E24:E27",{size:14,bold:true});
  s.tuesday.getRange("E24:E27").format.horizontalAlignment="right";

  // Spending: retain the Tuesday-Monday selector and the existing variance rules.
  cols(s.scorecard,[31,17,16,15,16,19,20]);
  row(s.scorecard,"A2:G2",42);row(s.scorecard,"A3:G3",34);
  head(s.scorecard,"A5:G5",30);row(s.scorecard,"A6:G21",24);
  s.scorecard.getRange("B6:F23").format.horizontalAlignment="right";
  font(s.scorecard,"E6:F23",{bold:true});total(s.scorecard,"A23:G23");row(s.scorecard,"A23:G23",33);
  row(s.scorecard,"A25:G26",22);nav(s.scorecard,"A4","1. Start","Back to Start");

  // Allocation guide: reclaim unused width; keep each allocation and its handling together.
  cols(s.weekly,[36,19,39,41,3,3]);
  row(s.weekly,"A2:F2",38);head(s.weekly,"A4:D4",28);row(s.weekly,"A5:D22",23);
  row(s.weekly,"A5:D5",38);row(s.weekly,"A14:D14",28);row(s.weekly,"A19:D19",31);row(s.weekly,"A21:D21",38);
  font(s.weekly,"C5:D22",{size:10});font(s.weekly,"B5:B28",{bold:true});
  ["A23:D23","A27:D27","A28:D28"].forEach(r=>total(s.weekly,r));
  row(s.weekly,"A23:D28",33);row(s.weekly,"A24:D24",12);band(s.weekly,"A30:F30");
  row(s.weekly,"A31:F34",27);fill(s.weekly,"A31:F34","#FFFFFF");

  // Savings: align the savings and rent summaries; preserve all existing input fills.
  cols(s.savings,[33,18,31,25,18,36]);
  row(s.savings,"A2:F2",30);
  ["A4:F4","A11:D11","A19:D19","A24:F24","A32:F32"].forEach(r=>band(s.savings,r));
  row(s.savings,"A5:F9",30);
  fill(s.savings,"A5:D7","#FFFFFF");fill(s.savings,"A9:D9","#FFFFFF");fill(s.savings,"C8:D8","#FFFFFF");
  font(s.savings,"A5:A9",{bold:false});font(s.savings,"C5:C9",{bold:false});
  font(s.savings,"B5:B9",{size:14,bold:true});font(s.savings,"D5:D9",{size:14,bold:true});
  head(s.savings,"A12:D12",32);row(s.savings,"A13:D16",26);total(s.savings,"A17:D17");
  fill(s.savings,"A20:B22","#FFFFFF");row(s.savings,"A20:D22",29);
  font(s.savings,"B20:B22",{size:13,bold:true});font(s.savings,"C20:D22",{size:10});
  head(s.savings,"A25:F25",30);row(s.savings,"A26:F29",28);row(s.savings,"A26:F26",38);
  total(s.savings,"A30:F30");row(s.savings,"A30:F30",30);
  row(s.savings,"A34:F39",30);font(s.savings,"D34:D38",{size:10});font(s.savings,"F26:F29",{size:10});
  font(s.savings,"B39",{size:14,bold:true});
  nav(s.savings,"C3","Support - Promo Detail","PayPal promo schedule");
  nav(s.savings,"E3","5. Savings & Debt","Rent details","A24");

  // History keeps every record and note. Frozen dates support horizontal review.
  cols(s.history,[15,15,15,17,17,17,27,16,16,16,16,17,55]);
  row(s.history,"A2:M2",34);head(s.history,"A4:M4",42);row(s.history,"A5:M30",26);
  row(s.history,"A5:M7",62);s.history.freezePanes.freezeColumns(3);

  // Supporting detail uses the same typography with smaller headings and fitted notes.
  const supportHeaders = [[s.importSheet,"A4:M4"],[s.budget,"A5:D5"],[s.budget,"A11:F11"],
    [s.funding,"A4:H4"],[s.funding,"A18:G18"],[s.bills,"A4:G4"],[s.payplan,"A5:G5"],
    [s.cash,"A4:G4"],[s.cash,"A11:J11"],[s.pending,"A4:F4"],[s.rules,"A4:F4"],[s.sources,"A3:E3"]];
  supportHeaders.forEach(([sheet,range])=>head(sheet,range,34));
  [s.importSheet,s.budget,s.funding,s.bills,s.payplan,s.cash,s.pending,s.rules].forEach(sheet=>row(sheet,"A2",38));
  cols(s.importSheet,[16,15,32,14,14,26,21,15,36,50,36,29,21]);
  row(s.importSheet,"A5:M304",30);s.importSheet.freezePanes.freezeColumns(3);
  cols(s.budget,[25,39,17,17,18,51]);
  ["A4:F4","A10:F10","A38:F38"].forEach(r=>band(s.budget,r));
  row(s.budget,"A6:F8",30);row(s.budget,"A7:F7",36);row(s.budget,"A12:F31",25);row(s.budget,"A12:F12",40);
  row(s.budget,"A18:F19",34);row(s.budget,"A26:F27",40);
  ["A8:D8","A32:F32","A34:F34"].forEach(r=>{total(s.budget,r);row(s.budget,r,30);});
  row(s.budget,"A39:F41",34);
  cols(s.funding,[18,29,18,22,29,31,34,48]);
  row(s.funding,"A5:H14",40);row(s.funding,"A6:H6",49);row(s.funding,"A19:H29",30);band(s.funding,"A16:H16");
  cols(s.bills,[28,16,22,17,32,10,61]);row(s.bills,"A5:G15",34);row(s.bills,"A5:G5",44);row(s.bills,"A10:G10",44);
  s.bills.freezePanes.freezeRows(4);
  cols(s.payplan,[29,18,18,22,18,21,33]);row(s.payplan,"A3:G3",29);row(s.payplan,"A6:G9",30);
  total(s.payplan,"A11:G11");row(s.payplan,"A11:G12",31);
  nav(s.payplan,"A4","5. Savings & Debt","Back to Savings & Debt");
  cols(s.cash,[20,30,24,17,16,19,31,18,23,40]);
  row(s.cash,"A5:J7",64);row(s.cash,"A6:J6",49);band(s.cash,"A10:J10");row(s.cash,"A11:J11",37);row(s.cash,"A12:J21",37);
  s.cash.freezePanes.freezeColumns(2);
  cols(s.pending,[16,29,16,25,27,50]);row(s.pending,"A5:F20",28);row(s.pending,"A22:F26",27);
  row(s.pending,"A26:F26",43);
  cols(s.rules,[33,29,22,28,28,23]);row(s.rules,"A5:F31",24);
  cols(s.sources,[26,31,25,55,74]);row(s.sources,"A4:E13",30);row(s.sources,"A4:E4",61);row(s.sources,"A11:E11",78);row(s.sources,"A13:E13",55);
  nav(s.sources,"A2","1. Start","Back to Start");
  s.sources.freezePanes.freezeRows(3);
  // A little trailing space stops right-aligned amounts colliding with the next label.
  [[s.dash,["B5"]],[s.tuesday,["D9:D23","E24:E27"]],[s.scorecard,["B6:F23"]],
   [s.weekly,["B5:B28"]],[s.savings,["B5:B9","D6:D9","B13:B17","D13:D17","B20:B21","B26:D30","B35:B39","E34:E38"]],
   [s.history,["D5:F30","H5:L30"]],[s.importSheet,["D5:D304"]],
   [s.budget,["C6:D8","D12:E34","C40:C41"]],[s.funding,["C5:C14","D19:E29"]],
   [s.bills,["B5:C15"]],[s.payplan,["C6:D11","F6:F12"]],[s.cash,["C5:F7","F12:G18"]],
   [s.pending,["C5:C26"]]].forEach(([sheet,ranges])=>ranges.forEach(range=>{sheet.getRange(range).format.numberFormat=money;}));

  // App-style surfaces: visible panels and navigation, without relocating any cells.
  // Input fills and conditional status rules are deliberately excluded from body painting.
  const outline = (sheet, range, color=line) => {
    sheet.getRange(range).format.borders = {preset:"outside",style:"thin",color};
  };
  const divider = (sheet, range, strong=false) => {
    const edge={style:strong?"medium":"thin",color:strong?line:"#D6DFEA"};
    sheet.getRange(range).format.borders = {top:edge,bottom:edge};
  };
  const backdrop = (sheet, range) => {
    fill(sheet,range,canvas);
    sheet.getRange(range).format.borders={preset:"all",style:"thin",color:canvas};
  };
  const ruled = (sheet, first, last, endColumn) => {
    for(let r=first;r<=last;r++) divider(sheet,`A${r}:${endColumn}${r}`);
  };
  specs.forEach(([sheet,used,title],index)=>{
    const lastColumn=used.split(":")[1].replace(/\d+/g,"");
    if(sheet!==s.sources) backdrop(sheet,`A2:${lastColumn}2`);
    if(sheet!==s.scorecard && sheet!==s.payplan && sheet!==s.sources) backdrop(sheet,`A3:${lastColumn}3`);
    sheet.getRange(title).format.numberFormat='"  "@';
    sheet.getRange(title).format.borders={bottom:{style:"medium",color:accent}};
    if(index<6) sheet.tabColor=navy;
  });

  // Start: cash overview, import checklist and readiness each have a clear boundary.
  backdrop(s.dash,"D2:D17");backdrop(s.dash,"A9:C9");backdrop(s.dash,"E15:H15");
  s.dash.getRange("D1:H1").format.borders={preset:"all",style:"thin",color:navy};
  s.dash.getRange("E1:H1").format.numberFormat='"  "@';
  fill(s.dash,"A5:C5","#E5EDF7");font(s.dash,"A5",{bold:true});font(s.dash,"B5",{size:22,bold:true});
  row(s.dash,"A5:H5",44);row(s.dash,"A8:H8",40);
  fill(s.dash,"A8:C8","#EAF1F9");font(s.dash,"A8:B8",{bold:true});
  ruled(s.dash,5,8,"C");ruled(s.dash,12,17,"C");
  for(let r=6;r<=14;r++){
    divider(s.dash,`E${r}:H${r}`);
    if(r%2===1) fill(s.dash,`F${r}:H${r}`,"#F4F7FB");
  }
  for(const range of ["A4:C8","A10:C17","E4:H14"]) outline(s.dash,range);
  backdrop(s.dash,"E16:H17");outline(s.dash,"E16:H17");

  // Tuesday: light separators, a distinct automatic-payment group and a strong cash footer.
  row(s.tuesday,"A3:G3",32);backdrop(s.tuesday,"A7:G7");
  outline(s.tuesday,"A4:G6");outline(s.tuesday,"A8:G22");ruled(s.tuesday,9,22,"G");
  for(const r of [10,12,14,16]){
    fill(s.tuesday,`A${r}:D${r}`,"#F5F8FC");fill(s.tuesday,`F${r}:G${r}`,"#F5F8FC");
  }
  fill(s.tuesday,"A17:D21","#EAF0F7");fill(s.tuesday,"F17:G21","#EAF0F7");
  for(const r of [14,17,22]) s.tuesday.getRange(`A${r}:G${r}`).format.borders={top:{style:"medium",color:line}};
  outline(s.tuesday,"A24:E27",accent);ruled(s.tuesday,24,27,"E");
  fill(s.tuesday,"A27:E27",navy);font(s.tuesday,"A27:E27",{color:"#FFFFFF",bold:true});
  row(s.tuesday,"A24:G27",34);font(s.tuesday,"E24:E25",{size:18});font(s.tuesday,"E27",{size:20});
  backdrop(s.tuesday,"F23:G27");

  // Analysis and allocation retain their original sections and existing warning rules.
  backdrop(s.scorecard,"C3:G3");backdrop(s.scorecard,"A4:G4");
  for(let r=6;r<=21;r+=2) fill(s.scorecard,`A${r}:F${r}`,"#F4F7FB");
  ruled(s.scorecard,6,21,"G");outline(s.scorecard,"A5:G23");
  fill(s.scorecard,"A23:E23",navy);font(s.scorecard,"A23:E23",{color:"#FFFFFF",bold:true});
  row(s.scorecard,"A23:G23",37);
  for(let r=6;r<=22;r+=2) fill(s.weekly,`A${r}:D${r}`,"#F4F7FB");
  ruled(s.weekly,5,22,"D");outline(s.weekly,"A4:D23");outline(s.weekly,"A25:D28");
  fill(s.weekly,"A23:D23",navy);font(s.weekly,"A23:D23",{color:"#FFFFFF",bold:true});
  backdrop(s.weekly,"A24:F24");backdrop(s.weekly,"A29:F29");
  backdrop(s.weekly,"E4:F29");outline(s.weekly,"A30:F34");

  // Savings: bounded savings, rent and debt panels with slate gutters between sections.
  for(const range of ["E5:F23","A10:F10","A18:F18","A23:F23","A31:F31","A33:F33"]) backdrop(s.savings,range);
  for(const range of ["A5:B9","C5:D9","A11:D17","A19:D22","A24:F30","A32:F39"]) outline(s.savings,range);
  for(let r=5;r<=9;r++){divider(s.savings,`A${r}:B${r}`);divider(s.savings,`C${r}:D${r}`);}
  font(s.savings,"B5:B9",{size:17});font(s.savings,"D5:D9",{size:17});
  row(s.savings,"A5:F9",34);font(s.savings,"B20:B22",{size:16});
  ruled(s.savings,13,17,"D");ruled(s.savings,26,30,"F");
  fill(s.savings,"A17:D17",soft);fill(s.savings,"A30:F30",soft);
  for(const range of ["A34:B38","D34:E38"]) outline(s.savings,range);

  // History and supporting detail stay compact, with readable row boundaries.
  outline(s.history,"A4:M30");ruled(s.history,5,30,"M");
  const supportPanels=[
    [s.importSheet,"A4:M304",5,304,"M"],[s.budget,"A5:D8",6,8,"D"],
    [s.budget,"A11:F32",12,32,"F"],[s.funding,"A4:H14",5,14,"H"],
    [s.funding,"A18:G29",19,29,"G"],[s.bills,"A4:G15",5,15,"G"],
    [s.payplan,"A5:G12",6,12,"G"],[s.cash,"A4:G7",5,7,"G"],
    [s.cash,"A11:J21",12,21,"J"],[s.pending,"A4:F20",5,20,"F"],
    [s.rules,"A4:F31",5,31,"F"],[s.sources,"A3:E13",4,13,"E"]
  ];
  for(const [sheet,range,first,last,lastColumn] of supportPanels){outline(sheet,range);ruled(sheet,first,last,lastColumn);}
  s.budget.getRange("A38:F38").format.borders={preset:"all",style:"thin",color:section};
  backdrop(s.rules,"D15:F31");
  // Buttons are native internal links, not drawings or nonfunctional controls.
  for(const link of navigation){
    const sheet=specs.find(([candidate])=>candidate.name===link.sheet)[0];
    fill(sheet,link.cell,"#DCE8F7");font(sheet,link.cell,{size:10,bold:true,color:accent,italic:false});
    sheet.getRange(link.cell).format.horizontalAlignment="center";
    outline(sheet,link.cell,"#9EB8D5");row(sheet,link.cell,32);
  }
  return navigation;
}

// Artifact Tool currently cannot render HYPERLINK formulas or author native cell links.
// Add internal XLSX links after export; no formula, value, style or external relationship is rewritten.
export async function addWorkbookNavigation(filename, navigation) {
  const archive = await JSZip.loadAsync(await fs.readFile(filename));
  const localName = node => node.name?.split(":").at(-1);
  const parse = async name => xml2js(await archive.file(name).async("string"), {compact:false});
  const workbook = (await parse("xl/workbook.xml")).elements.find(n=>localName(n)==="workbook");
  const sheets = workbook.elements.find(n=>localName(n)==="sheets").elements.filter(n=>localName(n)==="sheet");
  const relationships = (await parse("xl/_rels/workbook.xml.rels")).elements.find(n=>localName(n)==="Relationships").elements;
  for (const sheet of sheets) {
    const links = navigation.filter(link=>link.sheet===sheet.attributes.name);
    if (!links.length) continue;
    const relationship = relationships.find(n=>n.attributes?.Id===sheet.attributes["r:id"]);
    if (!relationship) throw new Error(`Missing worksheet relationship: ${sheet.attributes.name}`);
    const target = relationship.attributes.Target;
    const part = target.startsWith("/") ? target.slice(1) : path.posix.normalize(path.posix.join("xl", target));
    const document = await parse(part);
    const worksheet = document.elements.find(n=>localName(n)==="worksheet");
    const prefix = worksheet.name.includes(":") ? worksheet.name.split(":")[0]+":" : "";
    if (worksheet.elements.some(n=>localName(n)==="hyperlinks")) throw new Error(`Unexpected existing navigation: ${sheet.attributes.name}`);
    const escape = value => value.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
    const node = `<${prefix}hyperlinks>`+links.map(link=>`<${prefix}hyperlink ref="${escape(link.cell)}" location="${escape(link.location)}" display="${escape(link.caption)}"/>`).join("")+`</${prefix}hyperlinks>`;
    const following = new Set(["printOptions","pageMargins","pageSetup","headerFooter","rowBreaks","colBreaks","customProperties","cellWatches","ignoredErrors","smartTags","drawing","legacyDrawing","legacyDrawingHF","picture","oleObjects","controls","webPublishItems","tableParts","extLst"]);
    const followingNode = worksheet.elements.find(n=>following.has(localName(n)));
    const originalXml = await archive.file(part).async("string");
    const offset = followingNode ? originalXml.indexOf(`<${followingNode.name}`) : originalXml.lastIndexOf(`</${worksheet.name}>`);
    if(offset<0) throw new Error(`Cannot locate navigation insertion point: ${part}`);
    archive.file(part,originalXml.slice(0,offset)+node+originalXml.slice(offset));
  }
  await fs.writeFile(filename,await archive.generateAsync({type:"nodebuffer",compression:"DEFLATE"}));
}
