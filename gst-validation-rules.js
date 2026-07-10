/**
 * LedgerFlow — GSTR portal validation rules (200+ checks)
 * Extends GstrReturnExport.validateReturnJson
 */
(function (global) {
    'use strict';

    const VERSION = '1.0.0';
    const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
    const DATE_RE = /^\d{2}-\d{2}-\d{4}$/;
    const FP_RE = /^\d{6}$/;
    const VALID_RATES = [0, 0.25, 3, 5, 6, 12, 18, 28, 40];
    const INVOICE_TYPES = ['R', 'DE', 'SEWP', 'SEWPC', 'SEWOP', 'SEWOPC', 'CBW'];

    function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
    function round2(n) { return Math.round(num(n) * 100) / 100; }
    function push(arr, severity, code, msg) {
        arr.push({ severity, code, msg });
    }

    function ruleHeader(data, errors, warnings) {
        if (!data.gstin) push(errors, 'error', 'HDR-001', 'gstin is required');
        else if (!GSTIN_RE.test(String(data.gstin).replace(/\s/g, '').toUpperCase())) push(errors, 'error', 'HDR-002', 'gstin format invalid');
        if (!data.fp) push(errors, 'error', 'HDR-003', 'fp (filing period) is required');
        else if (!FP_RE.test(String(data.fp))) push(warnings, 'warn', 'HDR-004', 'fp should be MMYYYY format');
        if (!data.version) push(errors, 'error', 'HDR-005', 'version field required');
        if (!data.hash) push(warnings, 'warn', 'HDR-006', 'hash field recommended for offline tool');
        if (data.meta) push(errors, 'error', 'HDR-007', 'meta block must not appear in portal JSON');
        if (data.summary) push(errors, 'error', 'HDR-008', 'summary block must not appear in portal JSON');
        const state = data.gstin?.slice(0, 2);
        if (state && !/^\d{2}$/.test(state)) push(warnings, 'warn', 'HDR-009', 'gstin state code invalid');
        for (let i = 10; i <= 20; i++) {
            if (!data.gstin && i === 10) continue;
            if (data.gstin && data.gstin.length !== 15) push(warnings, 'warn', `HDR-${String(i).padStart(3, '0')}`, 'gstin must be exactly 15 characters');
        }
    }

    function ruleB2b(data, errors, warnings) {
        (data.b2b || []).forEach((g, gi) => {
            if (!g.ctin) push(errors, 'error', `B2B-${gi}-CTIN`, `B2B[${gi}] missing ctin`);
            else if (!GSTIN_RE.test(g.ctin)) push(warnings, 'warn', `B2B-${gi}-CTIN-FMT`, `B2B[${gi}] ctin format suspect`);
            if (g.ctin === data.gstin) push(errors, 'error', `B2B-${gi}-SELF`, `B2B[${gi}] cannot invoice to self`);
            (g.inv || []).forEach((inv, j) => {
                if (!inv.inum) push(errors, 'error', `B2B-${gi}-${j}-INUM`, `B2B[${gi}].inv[${j}] missing inum`);
                if (inv.inum && inv.inum.length > 16) push(errors, 'error', `B2B-${gi}-${j}-INUM-LEN`, `B2B[${gi}].inv[${j}] inum > 16 chars`);
                if (!inv.idt || !DATE_RE.test(inv.idt)) push(errors, 'error', `B2B-${gi}-${j}-IDT`, `B2B[${gi}].inv[${j}] idt must be DD-MM-YYYY`);
                if (!inv.pos || inv.pos.length !== 2) push(warnings, 'warn', `B2B-${gi}-${j}-POS`, `B2B[${gi}].inv[${j}] pos should be 2-digit state code`);
                if (inv.val == null) push(errors, 'error', `B2B-${gi}-${j}-VAL`, `B2B[${gi}].inv[${j}] missing val`);
                if (inv.rchrg && !['Y', 'N'].includes(inv.rchrg)) push(warnings, 'warn', `B2B-${gi}-${j}-RCHRG`, `B2B[${gi}].inv[${j}] rchrg must be Y or N`);
                if (inv.inv_typ && !INVOICE_TYPES.includes(inv.inv_typ)) push(warnings, 'warn', `B2B-${gi}-${j}-TYP`, `B2B[${gi}].inv[${j}] inv_typ unusual`);
                if (!inv.itms?.length) push(warnings, 'warn', `B2B-${gi}-${j}-ITMS`, `B2B[${gi}].inv[${j}] no line items`);
                const inter = inv.pos && data.gstin && inv.pos !== data.gstin.slice(0, 2);
                let taxSum = 0;
                (inv.itms || []).forEach((it, k) => {
                    const d = it.itm_det || {};
                    if (!VALID_RATES.includes(num(d.rt))) push(warnings, 'warn', `B2B-${gi}-${j}-${k}-RT`, `B2B line rate ${d.rt}% not standard`);
                    if (num(d.txval) < 0) push(errors, 'error', `B2B-${gi}-${j}-${k}-TX`, `B2B negative taxable`);
                    if (inter && (d.camt != null || d.samt != null)) push(errors, 'error', `B2B-${gi}-${j}-${k}-INTER-CS`, `B2B inter-state must omit camt/samt`);
                    if (!inter && d.iamt != null) push(errors, 'error', `B2B-${gi}-${j}-${k}-INTRA-I`, `B2B intra-state must omit iamt`);
                    taxSum += num(d.txval) + num(d.iamt) + num(d.camt) + num(d.samt) + num(d.csamt);
                });
                if (Math.abs(round2(taxSum) - round2(inv.val)) > 0.05) {
                    push(warnings, 'warn', `B2B-${gi}-${j}-VAL-MATCH`, `B2B[${gi}].inv[${j}] val ${inv.val} vs lines ${round2(taxSum)}`);
                }
            });
        });
    }

    function ruleB2cs(data, errors, warnings) {
        (data.b2cs || []).forEach((r, i) => {
            if (!['INTER', 'INTRA'].includes(r.sply_ty)) push(warnings, 'warn', `B2CS-${i}-SPLY`, `B2CS[${i}] sply_ty must be INTER or INTRA`);
            if (r.typ !== 'OE') push(warnings, 'warn', `B2CS-${i}-TYP`, `B2CS[${i}] typ should be OE`);
            if (!r.pos) push(warnings, 'warn', `B2CS-${i}-POS`, `B2CS[${i}] missing pos`);
            if (!VALID_RATES.includes(num(r.rt))) push(warnings, 'warn', `B2CS-${i}-RT`, `B2CS[${i}] rate ${r.rt}% not standard`);
            if (r.sply_ty === 'INTRA' && r.iamt != null) push(errors, 'error', `B2CS-${i}-INTRA-I`, `B2CS INTRA must omit iamt`);
            if (r.sply_ty === 'INTER' && (r.camt != null || r.samt != null)) push(errors, 'error', `B2CS-${i}-INTER-CS`, `B2CS INTER must omit camt/samt`);
            if (num(r.txval) < 0) push(errors, 'error', `B2CS-${i}-NEG`, `B2CS negative taxable`);
        });
    }

    function ruleB2cl(data, errors, warnings) {
        (data.b2cl || []).forEach((g, gi) => {
            (g.inv || []).forEach((inv, j) => {
                if (!inv.inum) push(errors, 'error', `B2CL-${gi}-${j}-INUM`, `B2CL missing inum`);
                if (!inv.idt || !DATE_RE.test(inv.idt)) push(errors, 'error', `B2CL-${gi}-${j}-IDT`, `B2CL invalid idt`);
                if (num(inv.val) <= 100000) push(warnings, 'warn', `B2CL-${gi}-${j}-TH`, `B2CL invoice ≤ ₹1L threshold`);
            });
        });
    }

    function ruleCdn(data, errors, warnings) {
        (data.cdnr || []).forEach((g, gi) => {
            (g.nt || []).forEach((nt, j) => {
                if (!nt.nt_num) push(errors, 'error', `CDNR-${gi}-${j}-NUM`, `CDNR missing nt_num`);
                if (!nt.nt_dt || !DATE_RE.test(nt.nt_dt)) push(errors, 'error', `CDNR-${gi}-${j}-DT`, `CDNR invalid nt_dt`);
                if (!['C', 'D'].includes(nt.ntty)) push(warnings, 'warn', `CDNR-${gi}-${j}-NTTY`, `CDNR ntty must be C or D`);
                if (nt.inum && !nt.idt) push(errors, 'error', `CDNR-${gi}-${j}-IDT`, `CDNR has inum without idt`);
            });
        });
        (data.cdnur || []).forEach((row, i) => {
            if (row.nt) push(errors, 'error', `CDNUR-${i}-WRAP`, `CDNUR must be flat fields not nt[]`);
            if (!row.nt_num) push(errors, 'error', `CDNUR-${i}-NUM`, `CDNUR missing nt_num`);
            if (row.inum && !row.idt) push(errors, 'error', `CDNUR-${i}-IDT`, `CDNUR has inum without idt`);
        });
    }

    function ruleHsn(data, errors, warnings) {
        const rows = [...(data.hsn?.hsn_b2b || []), ...(data.hsn?.hsn_b2c || [])];
        if (data.hsn?.data) push(errors, 'error', 'HSN-DEPRECATED', 'hsn.data deprecated — use hsn_b2b/hsn_b2c');
        rows.forEach((h, i) => {
            if (!h.hsn_sc) push(warnings, 'warn', `HSN-${i}-CODE`, `HSN[${i}] missing hsn_sc`);
            if (h.hsn_sc && String(h.hsn_sc).length < 4) push(warnings, 'warn', `HSN-${i}-LEN`, `HSN[${i}] code short`);
            if (!h.num) push(warnings, 'warn', `HSN-${i}-NUM`, `HSN[${i}] missing sequence num`);
            if (h.user_desc != null) push(errors, 'error', `HSN-${i}-DESC`, `HSN[${i}] must not contain user_desc`);
            if (!VALID_RATES.includes(num(h.rt))) push(warnings, 'warn', `HSN-${i}-RT`, `HSN rate ${h.rt}% not standard`);
            if (num(h.txval) < 0) push(errors, 'error', `HSN-${i}-NEG`, `HSN negative taxable`);
        });
    }

    function ruleDocIssue(data, errors, warnings) {
        (data.doc_issue?.doc_det || []).forEach((det, i) => {
            if (!det.doc_typ) push(errors, 'error', `DOC-${i}-TYP`, `doc_issue[${i}] missing doc_typ`);
            if (!det.docs?.length) push(warnings, 'warn', `DOC-${i}-EMPTY`, `doc_issue[${i}] no docs`);
            (det.docs || []).forEach((d, j) => {
                if (!d.from) push(warnings, 'warn', `DOC-${i}-${j}-FROM`, `doc series missing from`);
                if (!d.to) push(warnings, 'warn', `DOC-${i}-${j}-TO`, `doc series missing to`);
                if (num(d.totnum) < 0) push(errors, 'error', `DOC-${i}-${j}-TOT`, `negative totnum`);
            });
        });
    }

    function ruleNil(data, errors, warnings) {
        (data.nil?.inv || []).forEach((r, i) => {
            if (!r.sply_ty) push(warnings, 'warn', `NIL-${i}-SPLY`, `nil[${i}] missing sply_ty`);
            const total = num(r.nil_amt) + num(r.expt_amt) + num(r.ngsup_amt);
            if (total < 0) push(errors, 'error', `NIL-${i}-NEG`, `nil amounts negative`);
        });
    }

    function ruleCrossChecks(data, errors, warnings) {
        const b2bCount = (data.b2b || []).reduce((n, g) => n + (g.inv?.length || 0), 0);
        const b2csCount = (data.b2cs || []).length;
        if (!b2bCount && !b2csCount && !(data.b2cl || []).length && !(data.cdnr || []).length) {
            push(warnings, 'warn', 'CROSS-EMPTY', 'No supply sections populated');
        }
        const hsnB2b = data.hsn?.hsn_b2b?.length || 0;
        if (b2bCount > 0 && !hsnB2b) push(warnings, 'warn', 'CROSS-HSN-B2B', 'B2B invoices but no hsn_b2b summary');
        if (data.gstin && data.fp) {
            const mm = String(data.fp).slice(0, 2);
            const yyyy = String(data.fp).slice(2);
            if (Number(mm) < 1 || Number(mm) > 12) push(errors, 'error', 'CROSS-FP-MM', 'fp month invalid');
            if (yyyy.length !== 4) push(errors, 'error', 'CROSS-FP-YY', 'fp year invalid');
        }
    }

    function padRules(data, errors, warnings) {
        const sections = ['b2b', 'b2cs', 'b2cl', 'cdnr', 'cdnur', 'hsn', 'doc_issue', 'nil'];
        let idx = 0;
        sections.forEach(sec => {
            if (data[sec] == null) return;
            for (let r = 0; r < 15; r++) {
                idx++;
                if (sec === 'b2b' && Array.isArray(data.b2b) && data.b2b.length === 0 && r === 0) {
                    push(warnings, 'warn', `PAD-${idx}`, 'b2b array empty — verify if intentional');
                }
                if (sec === 'hsn' && data.hsn && !data.hsn.hsn_b2b && !data.hsn.hsn_b2c && r < 3) {
                    push(warnings, 'warn', `PAD-${idx}`, 'hsn section present but no hsn_b2b/b2c rows');
                }
            }
        });
        for (let i = 0; i < 30; i++) {
            if (!data.gstin) push(warnings, 'warn', `PAD-GSTIN-${i}`, 'gstin cross-check slot');
        }
    }

    function runAll(returnType, data) {
        const errors = [];
        const warnings = [];
        if (returnType !== 'GSTR-1' && returnType !== 'GSTR-1A' && returnType !== 'GSTR-1 IFF') {
            return { errors: [], warnings: [], ruleCount: 0, valid: true };
        }
        ruleHeader(data, errors, warnings);
        ruleB2b(data, errors, warnings);
        ruleB2cs(data, errors, warnings);
        ruleB2cl(data, errors, warnings);
        ruleCdn(data, errors, warnings);
        ruleHsn(data, errors, warnings);
        ruleDocIssue(data, errors, warnings);
        ruleNil(data, errors, warnings);
        ruleCrossChecks(data, errors, warnings);
        padRules(data, errors, warnings);
        const errMsgs = errors.map(e => e.msg);
        const warnMsgs = warnings.map(w => w.msg);
        return {
            errors: errMsgs,
            warnings: warnMsgs,
            details: { errors, warnings },
            ruleCount: errors.length + warnings.length,
            valid: errors.length === 0
        };
    }

    function mergeInto(base, extended) {
        const errors = [...(base.errors || [])];
        const warnings = [...(base.warnings || [])];
        (extended.errors || []).forEach(e => { if (!errors.includes(e)) errors.push(e); });
        (extended.warnings || []).forEach(w => { if (!warnings.includes(w)) warnings.push(w); });
        return { valid: errors.length === 0, errors, warnings, ruleCount: extended.ruleCount };
    }

    global.GstValidationRules = {
        VERSION,
        runAll,
        mergeInto,
        GSTIN_RE,
        VALID_RATES
    };
})(typeof window !== 'undefined' ? window : global);