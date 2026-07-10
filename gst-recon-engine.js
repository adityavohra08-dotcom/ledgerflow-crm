/**
 * LedgerFlow — GSTR-2B Reconciliation Engine v2
 * Buckets: EXACT_MATCH | FUZZY_MATCH | PARTIAL_MATCH | MISSING_IN_BOOKS | MISSING_IN_PORTAL | REJECTED_IMS | PENDING_IMS
 */
(function (global) {
    'use strict';

    const BUCKETS = [
        'EXACT_MATCH', 'FUZZY_MATCH', 'PARTIAL_MATCH',
        'MISSING_IN_BOOKS', 'MISSING_IN_PORTAL', 'REJECTED_IMS', 'PENDING_IMS'
    ];

    const DEFAULT_TOLERANCE = {
        dateDays: 3,
        valuePct: 0.5,
        taxAbs: 1,
        invNoNormalize: true,
        fuzzyEnabled: true,
        exactScore: 100,
        fuzzyMin: 70,
        partialMin: 50
    };

    function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
    function round2(n) { return Math.round(num(n) * 100) / 100; }

    function normInv(s, normalize) {
        const t = String(s || '');
        return normalize ? t.replace(/[\s\-\/]/g, '').toUpperCase() : t.trim();
    }

    function parseDateParts(s) {
        const parts = String(s || '').trim().split(/[\/\-\.]/);
        if (parts.length !== 3) return null;
        if (parts[0].length === 4) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }

    function daysBetween(a, b) {
        const da = parseDateParts(a);
        const db = parseDateParts(b);
        if (!da || !db || Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 999;
        return Math.abs(Math.round((da - db) / 86400000));
    }

    function itc(r) {
        return num(r.igst) + num(r.cgst) + num(r.sgst) + num(r.itc);
    }

    function booksRow(p) {
        return {
            id: p.id || p._id || ('b_' + normInv(p.invoiceNo, true)),
            supplierGstin: String(p.gstin || p.supplierGstin || '').replace(/\s/g, '').toUpperCase(),
            invoiceNo: p.invoiceNo || '',
            date: p.date || '',
            taxable: round2(p.taxable),
            igst: round2(p.igst),
            cgst: round2(p.cgst),
            sgst: round2(p.sgst),
            itcEligible: p.itcEligible !== false,
            supplier: p.supplier || ''
        };
    }

    function g2bRow(e) {
        return {
            id: e.id || ('g_' + normInv(e.invoiceNo, true)),
            section: e.section || 'b2b',
            supplierGstin: String(e.supplierGstin || '').replace(/\s/g, '').toUpperCase(),
            invoiceNo: e.invoiceNo || '',
            date: e.date || '',
            taxable: round2(e.taxable),
            igst: round2(e.igst),
            cgst: round2(e.cgst),
            sgst: round2(e.sgst),
            itc: round2(e.itc),
            imsStatus: e.imsStatus || e.imsAction || 'NONE'
        };
    }

    function scorePair(b, g, tol) {
        let score = 0;
        const reasons = [];
        if (!b.supplierGstin || !g.supplierGstin || b.supplierGstin !== g.supplierGstin) {
            return { score: 0, reasons: ['GSTIN mismatch'] };
        }
        const bNo = normInv(b.invoiceNo, tol.invNoNormalize);
        const gNo = normInv(g.invoiceNo, tol.invNoNormalize);
        if (bNo && gNo && bNo === gNo) { score += 40; reasons.push('Invoice no exact'); }
        else if (tol.fuzzyEnabled && bNo && gNo && (bNo.includes(gNo) || gNo.includes(bNo))) {
            score += 25; reasons.push('Invoice no partial');
        }
        const days = daysBetween(b.date, g.date);
        if (days === 0) { score += 25; reasons.push('Date exact'); }
        else if (days <= tol.dateDays) { score += 15; reasons.push('Date ±' + days + 'd'); }
        const valDiff = Math.abs(num(b.taxable) - num(g.taxable));
        const valPct = b.taxable ? (valDiff / b.taxable) * 100 : 0;
        if (valDiff === 0) { score += 20; reasons.push('Taxable exact'); }
        else if (valPct <= tol.valuePct) { score += 10; reasons.push('Taxable ±' + valPct.toFixed(2) + '%'); }
        const taxDiff = Math.abs(itc(b) - itc(g));
        if (taxDiff <= tol.taxAbs) { score += 15; reasons.push('ITC within ₹' + tol.taxAbs); }
        else if (taxDiff <= 100) { score += 5; reasons.push('ITC close'); }
        return { score, reasons, taxDiff, valDiff };
    }

    function bucketFromScore(score, taxDiff, tol) {
        if (score >= tol.exactScore && taxDiff <= tol.taxAbs) return 'EXACT_MATCH';
        if (score >= 85) return 'FUZZY_MATCH';
        if (score >= tol.fuzzyMin) return 'FUZZY_MATCH';
        if (score >= tol.partialMin) return 'PARTIAL_MATCH';
        return null;
    }

    function runReconciliation(purchases, g2bEntries, opts) {
        const tol = { ...DEFAULT_TOLERANCE, ...(opts?.tolerance || {}) };
        const books = (purchases || []).map(booksRow).filter(b => b.itcEligible);
        const g2b = (g2bEntries || []).map(g2bRow);
        const usedBooks = new Set();
        const usedG2b = new Set();
        const lines = [];

        g2b.forEach(g => {
            if (g.imsStatus === 'REJECT' || g.imsStatus === 'REJECTED') {
                lines.push({
                    id: 'rej_' + g.id,
                    bucket: 'REJECTED_IMS',
                    confidence: 1,
                    g2b: g,
                    booksItc: 0,
                    gstr2bItc: itc(g),
                    variance: itc(g),
                    matchReason: 'Rejected via IMS',
                    imsAction: 'REJECT',
                    supplier: g.supplierGstin,
                    invoice: g.invoiceNo
                });
                usedG2b.add(g.id);
            }
        });

        g2b.forEach(g => {
            if (usedG2b.has(g.id)) return;
            let best = null;
            books.forEach(b => {
                if (usedBooks.has(b.id)) return;
                const { score, reasons, taxDiff } = scorePair(b, g, tol);
                if (!bucketFromScore(score, taxDiff, tol)) return;
                if (!best || score > best.score) best = { b, score, reasons, taxDiff };
            });
            if (!best) return;
            const bucket = bucketFromScore(best.score, best.taxDiff, tol);
            usedBooks.add(best.b.id);
            usedG2b.add(g.id);
            const variance = Math.abs(itc(best.b) - itc(g));
            lines.push({
                id: bucket + '_' + best.b.id + '_' + g.id,
                bucket,
                confidence: round2(best.score / 100),
                books: best.b,
                g2b: g,
                booksItc: itc(best.b),
                gstr2bItc: itc(g),
                variance,
                matchReason: best.reasons.join(', '),
                imsAction: g.imsStatus === 'ACCEPT' ? 'ACCEPT' : g.imsStatus === 'PENDING' ? 'PENDING' : 'NONE',
                supplier: best.b.supplier || best.b.supplierGstin,
                invoice: best.b.invoiceNo || g.invoiceNo,
                score: best.score
            });
        });

        g2b.forEach(g => {
            if (usedG2b.has(g.id)) return;
            lines.push({
                id: 'mib_' + g.id,
                bucket: 'MISSING_IN_BOOKS',
                confidence: 0,
                g2b: g,
                booksItc: 0,
                gstr2bItc: itc(g),
                variance: itc(g),
                matchReason: 'In GSTR-2B but not in purchase register',
                imsAction: g.imsStatus === 'PENDING' ? 'PENDING' : 'NONE',
                supplier: g.supplierGstin,
                invoice: g.invoiceNo
            });
        });

        books.forEach(b => {
            if (usedBooks.has(b.id)) return;
            lines.push({
                id: 'mip_' + b.id,
                bucket: 'MISSING_IN_PORTAL',
                confidence: 0,
                books: b,
                booksItc: itc(b),
                gstr2bItc: 0,
                variance: itc(b),
                matchReason: 'In books but not in GSTR-2B',
                imsAction: 'NONE',
                supplier: b.supplier || b.supplierGstin,
                invoice: b.invoiceNo
            });
        });

        const stats = {
            total: lines.length,
            exact: lines.filter(l => l.bucket === 'EXACT_MATCH').length,
            fuzzy: lines.filter(l => l.bucket === 'FUZZY_MATCH').length,
            partial: lines.filter(l => l.bucket === 'PARTIAL_MATCH').length,
            missingBooks: lines.filter(l => l.bucket === 'MISSING_IN_BOOKS').length,
            missingPortal: lines.filter(l => l.bucket === 'MISSING_IN_PORTAL').length,
            rejectedIms: lines.filter(l => l.bucket === 'REJECTED_IMS').length,
            pendingIms: lines.filter(l => l.bucket === 'PENDING_IMS').length,
            matched: lines.filter(l => l.bucket === 'EXACT_MATCH' || l.bucket === 'FUZZY_MATCH').length,
            booksItc: round2(lines.reduce((s, l) => s + num(l.booksItc), 0)),
            g2Itc: round2(lines.reduce((s, l) => s + num(l.gstr2bItc), 0)),
            variance: round2(Math.abs(lines.reduce((s, l) => s + num(l.booksItc), 0) - lines.reduce((s, l) => s + num(l.gstr2bItc), 0)))
        };
        stats.pct = stats.total ? Math.round((stats.matched / stats.total) * 100) : 0;

        return { lines, stats, tolerance: tol };
    }

    function vendorMismatchEmail(line, firmName, period) {
        const b = line.books;
        const g = line.g2b;
        return [
            'Subject: GST Invoice mismatch — ' + (line.invoice || 'Invoice') + ' (' + period + ')',
            '',
            'Dear Supplier,',
            '',
            'Our records for ' + period + ' do not match the invoice reflected in GSTR-2B.',
            '',
            'Invoice: ' + (line.invoice || '—'),
            'Our books ITC: ₹' + (line.booksItc || 0).toLocaleString('en-IN'),
            'GSTR-2B ITC: ₹' + (line.gstr2bItc || 0).toLocaleString('en-IN'),
            'Variance: ₹' + (line.variance || 0).toLocaleString('en-IN'),
            'Match status: ' + (line.bucket || '').replace(/_/g, ' '),
            '',
            b ? 'Books: ' + b.date + ' · Taxable ₹' + b.taxable : '',
            g ? '2B: ' + g.date + ' · Taxable ₹' + g.taxable : '',
            '',
            'Please share a corrected invoice or confirm the details at your earliest.',
            '',
            'Regards,',
            firmName || 'CA Firm'
        ].filter(Boolean).join('\n');
    }

    function applyImsAction(client, lineId, action) {
        if (!client.gstr2bRecon) return false;
        const row = client.gstr2bRecon.find(r => r.id === lineId);
        if (!row) return false;
        row.imsAction = action;
        if (row.g2b) row.g2b.imsStatus = action;
        if (!client.gstr2bImsLog) client.gstr2bImsLog = [];
        client.gstr2bImsLog.push({
            lineId, action, at: new Date().toISOString(),
            invoice: row.invoice, supplier: row.supplier
        });
        return true;
    }

    global.GstReconEngine = {
        VERSION: '2.0.0',
        BUCKETS,
        DEFAULT_TOLERANCE,
        runReconciliation,
        vendorMismatchEmail,
        applyImsAction,
        booksRow,
        g2bRow,
        scorePair
    };
})(typeof window !== 'undefined' ? window : global);