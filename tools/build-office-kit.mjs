// Run with the bundled @oai/artifact-tool runtime. See toolkit/README.md.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const root = path.resolve(process.argv[2] || '.');
const out = path.join(root, 'downloads/office-kit');
const previews = path.join(root, 'artifacts/office-kit');
const routines = JSON.parse(await fs.readFile(path.join(root, 'toolkit/routines.json'), 'utf8'));
await fs.mkdir(out, { recursive: true });
await fs.mkdir(previews, { recursive: true });
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const csv = rows => '\uFEFF' + rows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n') + '\r\n';
const dateValue = value => value ? new Date(value + 'T00:00:00Z') : null;

const book = Workbook.create();
const end = 57;
function base(sheet, lastCol, title, instruction, note) {
  sheet.showGridLines = false;
  sheet.tabColor = '#244b40';
  sheet.getRange(`A1:${lastCol}${end}`).format.font = { name: 'Arial', size: 11, color: '#142c29' };
  sheet.getRange(`A1:${lastCol}${end}`).format.verticalAlignment = 'center';
  sheet.getRange('A2').values = [[title]];
  sheet.getRange('A2').format.font = { name: 'Arial', size: 17, bold: true, color: '#142c29' };
  sheet.getRange('A2').format.rowHeight = 30;
  sheet.getRange(`A3:${lastCol}3`).format.borders = { bottom: { style: 'thin', color: '#c9d1c2' } };
  sheet.getRange('A4').values = [[instruction]];
  sheet.getRange('A5').values = [[note]];
  sheet.getRange(`A4:${lastCol}5`).format.rowHeight = 23;
}
function headers(sheet, row, names, widths) {
  const range = sheet.getRangeByIndexes(row - 1, 0, 1, names.length);
  range.values = [names];
  range.format = { fill: '#244b40', font: { name: 'Arial', size: 11, bold: true, color: '#ffffff' }, wrapText: true, verticalAlignment: 'center', horizontalAlignment: 'center', rowHeight: 35 };
  widths.forEach((width, i) => { sheet.getRangeByIndexes(0, i, end, 1).format.columnWidth = width; });
}

const followFormula = row => `=IF(COUNTA(A${row}:H${row})=0,"",IF(OR(B${row}="",F${row}=""),"Add request / status",IF(F${row}="Closed",IF(H${row}="","Record outcome","Closed"),IF(OR(F${row}="New",F${row}="Waiting for customer",F${row}="Waiting for team"),IF(OR(C${row}="",D${row}="",E${row}=""),"Add owner / action / due",IF(ISNUMBER(E${row}),IF(E${row}<TODAY(),"Overdue",IF(E${row}=TODAY(),"Due today","Planned")),"Enter a date")),"Choose a listed status"))))`;

for (const routine of routines) {
  const sheet = book.worksheets.add(routine.sheet);
  const follow = routine.id === 'follow-ups';
  const names = [...routine.headers, ...(follow ? ['Attention (automatic)'] : [])];
  const widths = [...routine.widths, ...(follow ? [29] : [])];
  const lastCol = String.fromCharCode(64 + names.length);
  base(sheet, lastCol, routine.name,
    follow ? 'Start here: one row per request. Filter Attention to find overdue work or missing next steps.' : routine.when,
    follow ? 'Edit A:H. Column I calculates. Blank working rows below; fictional records are on Examples.' : 'Enter your own records below. See Examples and START-HERE.html for the routine and field guide.');
  headers(sheet, 7, names, widths);
  const input = sheet.getRangeByIndexes(7, 0, end - 7, routine.headers.length);
  input.format.fill = '#fffaf0';
  input.format.wrapText = true;
  input.format.rowHeight = 45;
  for (const col of routine.dates) sheet.getRangeByIndexes(7, col, end - 7, 1).setNumberFormat('mmm d, yyyy"  "');
  sheet.getRangeByIndexes(7, routine.statusColumn, end - 7, 1).dataValidation = { rule: { type: 'list', values: routine.statuses } };
  if (routine.id === 'weekly-handoff') sheet.getRange(`B8:B${end}`).dataValidation = { rule: { type: 'list', values: ['Finished', 'Decision needed', 'Next priority', 'Cover handoff'] } };
  const table = sheet.tables.add(`A7:${lastCol}${end}`, true, routine.id.replaceAll('-', '') + 'Table');
  table.style = 'TableStyleMedium4';
  table.showFilterButton = true;
  // Keep input and formula columns distinct, including when the table is filtered.
  input.format.fill = '#fffaf0';
  if (follow) {
    sheet.getRange(`I8:I${end}`).formulas = Array.from({length: end - 7}, (_, i) => [followFormula(i + 8)]);
    sheet.getRange(`I8:I${end}`).format.fill = '#ebeee4';
    sheet.getRange(`I8:I${end}`).format.wrapText = true;
    sheet.getRange(`I8:I${end}`).conditionalFormats.add('cellIs', { operator: 'equal', formula: '"Overdue"', format: {fill:'#fce5df',font:{color:'#8b3022',bold:true}} });
    sheet.getRange(`I8:I${end}`).conditionalFormats.add('cellIs', { operator: 'equal', formula: '"Due today"', format: {fill:'#fff0bd',font:{color:'#624900',bold:true}} });
    sheet.getRange(`I8:I${end}`).conditionalFormats.add('beginsWith', { text: 'Add ', format: {fill:'#fff0bd',font:{color:'#624900'}} });
  }
  sheet.freezePanes.freezeRows(7);
  sheet.freezePanes.freezeColumns(2);
  await fs.writeFile(path.join(out, routine.id + '-blank.csv'), csv([routine.headers]));
  await fs.writeFile(path.join(out, routine.id + '-examples.csv'), csv([routine.headers, ...routine.examples]));
}

const examples = book.worksheets.add('Examples');
base(examples, 'J', 'Fictional worked examples', 'All people, requests, approvals, and dates below are made up. These are teaching examples.', 'The first three sheets are blank working copies. The examples do not feed your working records.');
examples.tabColor = '#8b896f';
const commonWidths = [24, 40, 40, 54, 28, 26, 40, 40, 40, 40];
for (let i = 0; i < routines.length; i++) {
  const routine = routines[i];
  const row = 7 + i * 7;
  examples.getRange(`A${row}`).values = [[routine.name]];
  examples.getRange(`A${row}`).format.font = { bold:true, name:'Arial', size:13 };
  headers(examples, row + 1, routine.headers, commonWidths);
  const values = routine.examples.map(record => record.map((value, col) => routine.dates.includes(col) ? dateValue(value) : value));
  const body = examples.getRangeByIndexes(row + 1, 0, values.length, routine.headers.length);
  body.values = values;
  body.format.wrapText = true;
  body.format.rowHeight = 86;
  body.format.fill = '#f7f6f0';
  for (const col of routine.dates) examples.getRangeByIndexes(row + 1, col, values.length, 1).setNumberFormat('mmm d, yyyy"  "');
}

// Exercise the follow-up logic on real edits, then restore a blank master.
const follow = book.worksheets.getItem('Follow-ups');
const today = new Date();
const day = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
const cases = [
  {record: Array(8).fill(null), result: ''},
  {record: ['TEST','Example',null,null,null,'New',null,null], result:'Add owner / action / due'},
  {record: ['TEST','Example','Alex','Ask for plan',new Date(day.getTime()-86400000),'Waiting for customer',null,null], result:'Overdue'},
  {record: ['TEST','Example','Alex','Ask for plan',day,'New',null,null], result:'Due today'},
  {record: ['TEST','Example','Alex','Ask for plan',new Date(day.getTime()+86400000),'New',null,null], result:'Planned'},
  {record: ['TEST','Example','Alex','Ask for plan','Tomorrow','New',null,null], result:'Enter a date'},
  {record: ['TEST','Example','Alex',null,null,'Closed',null,null], result:'Record outcome'},
  {record: ['TEST','Example','Alex',null,null,'Closed',null,'Project lead accepted handoff'], result:'Closed'},
  {record: ['TEST','Example','Alex','Ask for plan',day,'Unknown',null,null], result:'Choose a listed status'},
  {record: ['TEST','Example','Alex',null,day,'New',null,null], result:'Add owner / action / due'}
];
for (const test of cases) {
  follow.getRange('A8:H8').values = [test.record];
  book.recalculate();
  assert.equal(follow.getRange('I8').values[0][0], test.result);
}
follow.getRange('A8:H8').clear({applyTo:'contents'});
book.recalculate();
assert.equal(follow.getRange('I8').values[0][0], '');
console.log(`Verified ${cases.length} follow-up states and restored blank working rows.`);
for (const routine of routines) {
  const sheet = book.worksheets.getItem(routine.sheet);
  const lastCol = routine.id === 'follow-ups' ? 'I' : String.fromCharCode(64 + routine.headers.length);
  console.log((await book.inspect({kind:'table',range:`'${routine.sheet}'!A7:${lastCol}9`,include:'values,formulas',tableMaxRows:3,tableMaxCols:10,maxChars:1400})).ndjson);
  const preview = await book.render({sheetName: routine.sheet, range:`A1:${lastCol}12`,scale:1.5,format:'png'});
  await fs.writeFile(path.join(previews,routine.id+'.png'),new Uint8Array(await preview.arrayBuffer()));
}
for (let i = 0; i < routines.length; i++) {
  const row=7+i*7;
  const lastCol = String.fromCharCode(64+routines[i].headers.length);
  const preview=await book.render({sheetName:'Examples',range:`A${row}:${lastCol}${row+4}`,scale:1.5,format:'png'});
  await fs.writeFile(path.join(previews,routines[i].id+'-examples.png'),new Uint8Array(await preview.arrayBuffer()));
}
const workbook = await SpreadsheetFile.exportXlsx(book);
await workbook.save(path.join(out,'SSPros-Office-Routines.xlsx'));
// The library emits an inspection sidecar. Keep it with local review artifacts.
const sidecar = path.join(out, 'SSPros-Office-Routines.xlsx.inspect.ndjson');
try { await fs.rename(sidecar, path.join(previews, 'workbook.inspect.ndjson')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

const start = `# SSPros office routines\n\nPrepared for discussion · November 2026\n\nStart with one routine and try it for a week. The first three tabs in SSPros-Office-Routines.xlsx are blank working templates. The Examples tab contains fictional records, kept separate from your work.\n\n## Set it up together\n\n1. Choose one routine and name its owner, backup, and approver.\n2. Agree where the working copy will live and when it will be reviewed. Use the company’s existing system if it already handles this work.\n3. Open the Examples tab, then enter one real item in the matching working tab. Agree its next action and date.\n4. After a week, check whether the routine made the next steps clearer. Remove fields that do not help.\n\n## Open and edit\n\nOpen the XLSX in Excel, or import it into Google Sheets and check the imported dates and dropdowns before use. Edit the pale input cells. In Follow-ups, the grey Attention column is a formula. It checks for missing fields, overdue dates, and outcomes on closed requests. Dates compare with the current day when the workbook recalculates. Nothing sends a reminder or contacts a customer.\n\nThe working tables have 50 rows. Within those rows, filters and dropdowns are ready. To add more, extend the table and copy the preceding row’s formula and validation; check the new row before relying on it. CSV alternatives contain the same input columns, but no formatting, dropdowns, or automatic flags. Dates in CSV examples use YYYY-MM-DD.\n\nKeep a blank master and store the working copy in company-controlled storage. Use record IDs and source links where possible instead of copying customer information. The Examples tab and all files ending in -examples.csv contain fictional data.\n\n## What’s included\n\n- SSPros-Office-Routines.xlsx: three blank working tabs and a separate Examples tab.\n- Three -blank.csv files: input columns for importing into an existing system.\n- Three -examples.csv files: filled-in teaching examples.\n- Message-drafts.md: four editable drafts and instructions for using them.\n- START-HERE.html: this guide, examples, and message drafts in a browser; also suitable for printing.\n- README.md: an editable text version of the guide.\n\n`;
const sections = routines.map(r => `## ${r.name}\n\n${r.headline}\n\nWhen: ${r.when}\n\nResponsible: ${r.owner}\n\n${r.steps.map((step,i)=>`${i+1}. ${step}`).join('\n')}\n\nFinished when: ${r.done}\n\nIf something stalls: ${r.exception}\n\n### Field guide\n\n${r.fields.map(field=>'- '+field).join('\n')}\n\nAllowed statuses: ${r.statuses.join('; ')}.\n\n`).join('');
await fs.writeFile(path.join(out,'README.md'),(start+sections).trimEnd()+'\n');
const drafts = await fs.readFile(path.join(root,'toolkit/message-drafts.md'),'utf8');
await fs.writeFile(path.join(out,'Message-drafts.md'),drafts);

// A small Markdown renderer for these authored guide files, with escaped text only.
function markdown(text) {
  return text.trim().split(/\n\n+/).map(block => {
    if (/^### /.test(block)) return '<h3>'+escape(block.slice(4))+'</h3>';
    if (/^## /.test(block)) return '<h2>'+escape(block.slice(3))+'</h2>';
    if (/^# /.test(block)) return '<h1>'+escape(block.slice(2))+'</h1>';
    if (/^- /.test(block)) return '<ul>'+block.split('\n').map(line=>'<li>'+escape(line.replace(/^- /,''))+'</li>').join('')+'</ul>';
    if (/^1\. /.test(block)) return '<ol>'+block.split('\n').map(line=>'<li>'+escape(line.replace(/^\d+\. /,''))+'</li>').join('')+'</ol>';
    return '<p>'+escape(block)+'</p>';
  }).join('\n');
}
const examplesHtml = routines.map(r=>`<section id="${r.id}"><h2>${escape(r.name)}: worked example</h2><p>Fictional records. The working spreadsheet starts blank.</p><div class="table-scroll" role="region" aria-label="${escape(r.name)} examples" tabindex="0"><table><thead><tr>${r.headers.map(h=>'<th scope="col">'+escape(h)+'</th>').join('')}</tr></thead><tbody>${r.examples.map(row=>'<tr>'+row.map(value=>'<td>'+escape(value||'—')+'</td>').join('')+'</tr>').join('')}</tbody></table></div><p><a href="${r.id}-blank.csv" download>Blank CSV</a> · <a href="${r.id}-examples.csv" download>Example CSV</a></p></section>`).join('\n');
await fs.writeFile(path.join(out,'START-HERE.html'),`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SSPros office routines — guide and examples</title><style>
*{box-sizing:border-box}body{margin:0;background:#f7f6f0;color:#142c29;font:18px/1.65 Arial,sans-serif}main{max-width:1100px;margin:auto;padding:40px 24px}h1{font-size:38px;line-height:1.15}h2{margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid #c9d1c2;font-size:26px}h3{font-size:21px}p,li{max-width:82ch}li{margin:.5rem 0}a{color:#244b40;text-underline-offset:3px}a:focus-visible,.table-scroll:focus-visible{outline:3px solid #a94115;outline-offset:4px}.downloads{padding:20px;background:#ebeee4;display:flex;flex-wrap:wrap;gap:20px}.downloads a{font-weight:bold}.table-scroll{overflow-x:auto}table{border-collapse:collapse;min-width:1000px;font-size:16px}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #c9d1c2;min-width:120px}th{background:#244b40;color:white}td{background:#fffefa}section{margin-top:2rem}@media print{body{background:white;font-size:11pt}main{padding:0}h1{font-size:24pt}h2{font-size:16pt}.downloads{display:none}.table-scroll{overflow:visible}table{min-width:0;width:100%;font-size:8pt}th,td{min-width:0;padding:5px;overflow-wrap:anywhere}tr{break-inside:avoid}h2,h3{break-after:avoid}}
</style></head><body><main><nav class="downloads" aria-label="Kit files"><a href="SSPros-Office-Routines.xlsx" download>Download the Excel workbook</a><a href="README.md" download>Editable guide</a><a href="Message-drafts.md" download>Editable message drafts</a></nav>${markdown(start+sections)}${examplesHtml}${markdown(drafts)}</main></body></html>`);

const preview = `<section class="office-kit" id="office-kit" aria-labelledby="office-kit-title">
        <div class="kit-heading"><div><p class="eyebrow">A CLOSER LOOK AT THE OFFICE KIT</p><h3 id="office-kit-title">Three routines. A clear next step.</h3><p>Start with whichever job would help most. Each routine includes a blank working sheet, a filled-in example, and instructions for keeping it useful.</p></div><p class="kit-note">These are proposed routines and made-up examples. We’d adapt one to the way your office already works.</p></div>
        <div class="kit-routines">${routines.map((r,i)=>`
          <details class="kit-routine"${i===0?' open':''}><summary><span class="routine-number" aria-hidden="true">0${i+1}</span><span><strong>${escape(r.name)}</strong><span class="routine-description">${escape(r.headline)}</span></span></summary><div class="routine-body"><div class="routine-instructions"><p class="label">WHEN TO USE IT</p><p>${escape(r.when)}</p><ol>${r.steps.map(s=>'<li>'+escape(s)+'</li>').join('')}</ol><p class="routine-done"><strong>Finished when:</strong> ${escape(r.done)}</p></div><div class="routine-example"><p class="label">A FILLED-IN EXAMPLE</p><p class="example-context">Fictional people and work · November 2026</p><dl>${r.preview.map(([label,value])=>'<div><dt>'+escape(label)+'</dt><dd>'+escape(value)+'</dd></div>').join('')}</dl></div></div></details>`).join('')}
        </div>
        <div class="kit-download"><div><h4>Open it. Try one real item.</h4><p>The Excel workbook includes three blank tabs, a separate Examples tab, status dropdowns, and follow-up flags for overdue dates or missing next steps.</p><p class="kit-file-note">The full kit adds CSV copies, the field guide, and four message drafts. Nothing connects to company systems or sends reminders.</p></div><div class="kit-actions"><a class="button primary" href="downloads/office-kit/SSPros-Office-Routines.xlsx" download>Download the workbook (Excel)</a><a class="text-link" href="downloads/office-kit/START-HERE.html" target="_blank" rel="noopener">Read the guide and examples</a><a class="text-link" href="downloads/sspros-office-templates.zip" download>Download the full kit (ZIP)</a></div></div>
      </section>`;
const indexPath=path.join(root,'index.html');
const index=await fs.readFile(indexPath,'utf8');
const marker=/<!-- OFFICE KIT PREVIEW START -->[\s\S]*?<!-- OFFICE KIT PREVIEW END -->/;
assert.equal((index.match(/<!-- OFFICE KIT PREVIEW START -->/g)||[]).length,1);
await fs.writeFile(indexPath,index.replace(marker,`<!-- OFFICE KIT PREVIEW START -->\n      ${preview}\n      <!-- OFFICE KIT PREVIEW END -->`));
console.log('Workbook, guides, CSVs, and website preview built. Package downloads/office-kit into the ZIP.');
