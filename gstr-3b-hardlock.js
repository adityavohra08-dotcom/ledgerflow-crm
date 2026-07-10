/**
 * LedgerFlow — GSTR-3B hard-locking awareness (Table 3.2 auto-population, Table 4 ITC)
 * FY 2025-26+: GSTR-3B Table 3.1 auto-populated from GSTR-1; Table 4 ITC from GSTR-2B
 */
(function (global) {
    'use strict';

    function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
    function round2(n) { return Math.round(num(n) * 100) / 100; }

    function table31FromGstr1(gstr1Portal) {
        const out = { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        const addItm = d => {
            if (!d) return;
            out.txval = round2(out.txval + num(d.txval));
            out.iamt = round2(out.iamt + num(d.iamt));
            out.camt = round2(out.camt + num(d.camt));
            out.samt = round2(out.samt + num(d.samt));
            out.csamt = round2(out.csamt + num(d.csamt));
        };
        (gstr1Portal.b2b || []).forEach(g => (g.inv || []).forEach(inv => (inv.itms || []).forEach(it => addItm(it.itm_det))));
        (gstr1Portal.b2cl || []).forEach(g => (g.inv || []).forEach(inv => (inv.itms || []).forEach(it => addItm(it.itm_det))));
        (gstr1Portal.b2cs || []).forEach(r => {
            out.txval = round2(out.txval + num(r.txval));
            out.iamt = round2(out.iamt + num(r.iamt));
            out.camt = round2(out.camt + num(r.camt));
            out.samt = round2(out.samt + num(r.samt));
        });
        return out;
    }

    function table4FromRecon(client) {
        const rows = client.gstr2bRecon || [];
        const eligible = rows.filter(r =>
            r.bucket === 'EXACT_MATCH' || r.bucket === 'FUZZY_MATCH' || r.bucket === 'Matched'
        );
        const itc = eligible.reduce((s, r) => s + num(r.booksItc || r.gstr2bItc), 0);
        const recon = global.GstReconEngine?.runReconciliation
            ? null
            : null;
        return {
            itc_avl: round2(itc),
            source: 'gstr2b_recon',
            matchedLines: eligible.length,
            warning: rows.length && !eligible.length ? 'No reconciled ITC — file GSTR-3B manually' : null
        };
    }

    function hardLockReport(client, month, GstrReturnExport) {
        const G = GstrReturnExport || global.GstrReturnExport;
        const warnings = [];
        const g1 = G.toPortalGstr1(G.buildGstr1(client, month));
        const g3 = G.buildGstr3b(client, month);
        const t31Portal = table31FromGstr1(g1);
        const t31Books = g3.sup_details?.osup_det || {};
        const txDiff = Math.abs(num(t31Portal.txval) - num(t31Books.txval));
        if (txDiff > 1) {
            warnings.push({
                code: 'TABLE_32_MISMATCH',
                msg: 'GSTR-3B Table 3.1 taxable (₹' + t31Books.txval + ') differs from GSTR-1 outward (₹' + t31Portal.txval + ') — portal may hard-lock reject',
                severity: 'high'
            });
        }
        const t4 = table4FromRecon(client);
        if (t4.warning) warnings.push({ code: 'TABLE_4_ITC', msg: t4.warning, severity: 'med' });
        const recon = client.gstr2bRecon || [];
        const unmatched = recon.filter(r => r.bucket && !['EXACT_MATCH', 'FUZZY_MATCH', 'Matched'].includes(r.bucket));
        if (unmatched.length) {
            warnings.push({
                code: 'UNMATCHED_ITC',
                msg: unmatched.length + ' GSTR-2B line(s) not matched — ITC at risk',
                severity: 'high'
            });
        }
        return {
            table31FromGstr1: t31Portal,
            table31FromBooks: t31Books,
            table4Itc: t4,
            warnings,
            hardLockAware: true,
            period: month
        };
    }

    global.Gstr3bHardlock = {
        VERSION: '1.0.0',
        table31FromGstr1,
        table4FromRecon,
        hardLockReport
    };
})(typeof window !== 'undefined' ? window : global);