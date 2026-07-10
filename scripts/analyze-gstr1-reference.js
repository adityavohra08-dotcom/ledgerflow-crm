/* Analyze a working offline-tool GSTR-1 JSON against portal schema rules */
const fs = require('fs');
const path = require('path');

const refPath = process.argv[2] || path.join(__dirname, '..', 'samples', 'gstr1-portal-reference-18ABJFM4031F1ZF.json');
const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));

const rules = {
    rootKeys: ['gstin', 'fp', 'version', 'hash'],
    forbiddenRoot: ['meta', 'summary'],
    version: 'GST3.2.4',
    b2bInvFields: ['inum', 'idt', 'val', 'pos', 'rchrg', 'inv_typ', 'itms'],
    itmFields: { intra: ['txval', 'rt', 'camt', 'samt', 'csamt'], inter: ['txval', 'rt', 'iamt', 'csamt'] },
    itemNums: { 5: 501, 18: 1801, 12: 1201, 0: 1 },
    hsnShape: ['hsn_b2b', 'hsn_b2c'],
    docTyp: 'Invoices for outward supply'
};

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

console.log('=== Reference:', path.basename(refPath), '===');
console.log('gstin:', ref.gstin, '| fp:', ref.fp, '| version:', ref.version);
console.log('Sections:', Object.keys(ref).filter(k => !rules.rootKeys.includes(k)).join(', '));

let invCount = 0;
const rateNums = new Set();
const itmPatterns = { intra: 0, inter: 0, bad: 0 };

(ref.b2b || []).forEach(g => {
    (g.inv || []).forEach(inv => {
        invCount++;
        const isInter = (inv.itms || []).some(it => num(it.itm_det?.iamt) > 0);
        (inv.itms || []).forEach(it => {
            rateNums.add(`${it.itm_det?.rt}%→num ${it.num}`);
            const d = it.itm_det || {};
            if (isInter) {
                if (d.iamt != null && d.camt == null && d.samt == null) itmPatterns.inter++;
                else itmPatterns.bad++;
            } else {
                if (d.camt != null && d.samt != null && d.iamt == null) itmPatterns.intra++;
                else itmPatterns.bad++;
            }
        });
    });
});

console.log('\nB2B:', (ref.b2b || []).length, 'customers,', invCount, 'invoices');
console.log('Item num encoding:', [...rateNums].join('; '));
console.log('itm_det patterns — intra:', itmPatterns.intra, 'inter:', itmPatterns.inter, 'non-conforming:', itmPatterns.bad);

if (ref.doc_issue?.doc_det?.[0]) {
    const d = ref.doc_issue.doc_det[0];
    console.log('\ndoc_issue:', d.doc_typ, '| from:', d.docs?.[0]?.from, 'to:', d.docs?.[0]?.to, '| totnum:', d.docs?.[0]?.totnum);
}

if (ref.hsn) {
    const rows = [...(ref.hsn.hsn_b2b || []), ...(ref.hsn.hsn_b2c || [])];
    console.log('\nHSN rows:', rows.length);
    rows.forEach(h => {
        console.log(`  [${h.num}] ${h.hsn_sc} rt=${h.rt}% txval=${h.txval} iamt=${h.iamt} camt=${h.camt} samt=${h.samt} uqc=${h.uqc} qty=${h.qty}`);
    });
    const b2bTx = (ref.b2b || []).reduce((s, g) => s + (g.inv || []).reduce((s2, i) => s2 + (i.itms || []).reduce((s3, t) => s3 + num(t.itm_det?.txval), 0), 0), 0);
    console.log('B2B total txval:', b2bTx, '| HSN txval:', rows[0]?.txval, '| match:', Math.abs(b2bTx - num(rows[0]?.txval)) < 0.01);
}

console.log('\n=== Portal schema checklist ===');
console.log('[✓] version GST3.2.4:', ref.version === rules.version);
console.log('[✓] hash present:', ref.hash === 'hash');
console.log('[✓] no meta/summary:', !ref.meta && !ref.summary);
console.log('[✓] doc_typ present:', ref.doc_issue?.doc_det?.[0]?.doc_typ === rules.docTyp);
console.log('[✓] hsn uses hsn_b2b:', Boolean(ref.hsn?.hsn_b2b) && !ref.hsn?.data);
console.log('[✓] intra itm_det omits iamt:', itmPatterns.bad === 0);