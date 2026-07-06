const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const input = process.argv[2] || path.join(__dirname, '../../Downloads/HSN_SAC.xlsx');
const output = process.argv[3] || path.join(__dirname, '../hsn-database.json');

const wb = XLSX.readFile(input);
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('Sheet:', sheetName);
console.log('Total rows:', rows.length);
console.log('Header:', rows[0]);

const header = (rows[0] || []).map(h => String(h).trim().toLowerCase());

function col(...names) {
  for (const n of names) {
    const i = header.findIndex(h => h.includes(n));
    if (i >= 0) return i;
  }
  return -1;
}

const codeCol = col('hsn', 'sac', 'code', 'hsn_code', 'hsn/sac');
const descCol = col('description', 'desc', 'goods', 'service', 'name');
const gstCol = col('gst', 'rate', 'tax', 'igst');

console.log('Columns:', { codeCol, descCol, gstCol });

const out = [];
const seen = new Set();

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || !row.length) continue;

  let code = String(row[codeCol >= 0 ? codeCol : 0] ?? '').trim();
  let desc = String(row[descCol >= 0 ? descCol : 1] ?? '').trim();
  let gstRaw = gstCol >= 0 ? row[gstCol] : row[2];

  if (!code && !desc) continue;

  code = code.replace(/\s+/g, '');
  if (!code) continue;

  let gst = null;
  if (gstCol >= 0 && gstRaw !== '' && gstRaw != null) {
    const parsed = parseFloat(String(gstRaw).replace(/%/g, ''));
    if (!Number.isNaN(parsed)) gst = parsed;
  }

  const key = code + '|' + desc.slice(0, 40);
  if (seen.has(key)) continue;
  seen.add(key);

  out.push({ code, desc: desc || '—', gst });
}

const jsOut = output.replace(/\.json$/i, '.js');
fs.writeFileSync(output, JSON.stringify(out));
fs.writeFileSync(jsOut, 'window.HSN_DATABASE=' + JSON.stringify(out) + ';\n');
console.log('Written', out.length, 'entries to', output, 'and', jsOut);
console.log('Sample:', out.slice(0, 3));