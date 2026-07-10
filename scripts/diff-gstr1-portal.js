/* Compare LedgerFlow portal JSON against a working offline-tool export */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const exportPath = path.join(__dirname, '..', 'gstr-return-export.js');
const code = fs.readFileSync(exportPath, 'utf8');
const sandbox = { console };
sandbox.global = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const G = sandbox.GstrReturnExport;

const client = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'sample-app-data.json'), 'utf8')).clients.c1;
const built = G.buildValidatedReturn('GSTR-1', client, { month: '2026-06' });
const portal = built.portalData;
const json = G.portalJsonString(portal);

const refPath = process.argv[2] || path.join(process.env.USERPROFILE || '', 'Downloads', 'returns_22062026_R1_18AAOCP1220A1ZW_offline.json');
const ref = refPath && fs.existsSync(refPath) ? JSON.parse(fs.readFileSync(refPath, 'utf8')) : null;

function checkItmDet(label, det, inter) {
    const issues = [];
    if (!det || !num(det.rt)) return issues;
    if (inter && (det.camt != null || det.samt != null)) issues.push(`${label}: inter must omit camt/samt`);
    if (!inter && det.iamt != null) issues.push(`${label}: intra must omit iamt`);
    return issues;
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

const issues = [];
if (portal.meta || portal.summary) issues.push('contains meta/summary');
if (portal.hsn?.data) issues.push('uses hsn.data');
if (!portal.hash) issues.push('missing hash');
if (portal.version !== 'GST3.2.4') issues.push(`version ${portal.version}`);

(portal.b2b || []).forEach((g, i) => {
    (g.inv || []).forEach((inv, j) => {
        const inter = G.invInterState ? false : num(inv.itms?.[0]?.itm_det?.iamt) > 0;
        const isInter = inv.itms?.some(it => num(it.itm_det?.iamt) > 0);
        (inv.itms || []).forEach((it, k) => {
            issues.push(...checkItmDet(`b2b[${i}].inv[${j}].itms[${k}]`, it.itm_det, isInter));
        });
    });
});

(portal.b2cs || []).forEach((r, i) => {
    if (r.sply_ty === 'INTRA' && r.iamt != null) issues.push(`b2cs[${i}] INTRA has iamt`);
    if (r.sply_ty === 'INTER' && (r.camt != null || r.samt != null)) issues.push(`b2cs[${i}] INTER has camt/samt`);
});

(portal.doc_issue?.doc_det || []).forEach((d, i) => {
    if (!d.doc_typ) issues.push(`doc_issue[${i}] missing doc_typ`);
});

console.log('LedgerFlow v' + G.VERSION);
console.log('Validation:', built.validation.valid ? 'PASS' : 'FAIL', built.validation.errors);
console.log('Warnings:', built.validation.warnings.length);
console.log('Structure issues:', issues.length ? issues : 'none');
console.log('JSON length:', json.length, 'chars, compact:', !json.includes('\n'));
console.log('Sample b2b itm_det:', JSON.stringify(portal.b2b?.[0]?.inv?.[0]?.itms?.[0]?.itm_det));
console.log('Sample inter itm_det:', JSON.stringify(portal.b2b?.[1]?.inv?.[0]?.itms?.[0]?.itm_det));

if (ref) {
    const refItm = ref.b2b?.[0]?.inv?.[0]?.itms?.[0]?.itm_det;
    console.log('Reference offline itm_det:', JSON.stringify(refItm));
}

const outPath = path.join(process.env.USERPROFILE || '.', 'Downloads', 'gstr1_07AABCT1234D1Z5_Jun_2026_v124.json');
fs.writeFileSync(outPath, json);
console.log('Wrote', outPath);