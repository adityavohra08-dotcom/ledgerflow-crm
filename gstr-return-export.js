/**
 * LedgerFlow — GSTR-1, GSTR-3B, GSTR-9 JSON & CSV export from books
 */
(function (global) {
    'use strict';

    const VERSION = '1.2.4';
    const PORTAL_GSTR1_VERSION = 'GST3.2.4';
    const DOC_ISSUE_TYPES = {
        1: 'Invoices for outward supply',
        4: 'Debit Note',
        5: 'Credit Note',
        9: 'Delivery Challan for job work'
    };
    const RETURN_TYPES = ['GSTR-1', 'GSTR-1A', 'GSTR-3B', 'GSTR-9'];
    const DOC_TYPES = { INV: 'Tax Invoice', CN: 'Credit Note', DN: 'Debit Note', BOS: 'Bill of Supply', DC: 'Delivery Challan' };
    const VALID_GSTR_RATES = [0, 0.25, 3, 5, 6, 12, 18, 28, 40];
    const NIL_SPLY_TYPES = ['INTRB2B', 'INTRAB2B', 'INTRB2C', 'INTRAB2C'];
    const B2CL_THRESHOLD = 100000;

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function round2(n) {
        return Math.round(num(n) * 100) / 100;
    }

    function fmtINR(n) {
        return '₹' + round2(n).toLocaleString('en-IN');
    }

    function normDate(s) {
        if (!s) return '';
        const parts = String(s).trim().split(/[\/\-\.]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return String(s);
    }

    function toGstDate(iso) {
        const d = normDate(iso);
        if (!d || d.length < 10) return d;
        const [y, m, day] = d.split('-');
        return `${day}-${m}-${y}`;
    }

    function parseIso(d) {
        const n = normDate(d);
        const dt = new Date(n);
        return Number.isNaN(dt.getTime()) ? null : dt;
    }

    function monthKey(iso) {
        const d = normDate(iso);
        return d ? d.slice(0, 7) : '';
    }

    function fpFromMonth(monthStr) {
        if (!monthStr || monthStr.length < 7) return '';
        const [y, m] = monthStr.split('-');
        return `${m}${y}`;
    }

    function monthLabel(monthStr) {
        if (!monthStr) return '';
        const [y, m] = monthStr.split('-');
        const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${names[Number(m) - 1] || m} ${y}`;
    }

    function fyRange(fy) {
        const m = String(fy || '').match(/^(\d{4})-(\d{2,4})$/);
        if (!m) return null;
        const startYear = Number(m[1]);
        let endYear = Number(m[2]);
        if (m[2].length === 2) endYear = Math.floor(startYear / 100) * 100 + endYear;
        if (endYear < startYear) endYear += 100;
        return {
            start: `${startYear}-04-01`,
            end: `${endYear}-03-31`,
            label: `${startYear}-${String(endYear).slice(-2)}`
        };
    }

    function currentFy() {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const start = m >= 4 ? y : y - 1;
        return `${start}-${String(start + 1).slice(-2)}`;
    }

    function fyFromDate(iso) {
        const d = normDate(iso);
        if (!d || d.length < 7) return currentFy();
        const y = Number(d.slice(0, 4));
        const m = Number(d.slice(5, 7));
        const start = m >= 4 ? y : y - 1;
        return `${start}-${String(start + 1).slice(-2)}`;
    }

    function defaultFy(client) {
        const invs = client?.invoices || [];
        if (!invs.length) return currentFy();
        const sorted = [...invs].sort((a, b) => normDate(b.date).localeCompare(normDate(a.date)));
        return fyFromDate(sorted[0].date);
    }

    function defaultMonth(client) {
        const invs = client?.invoices || [];
        if (!invs.length) {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        const sorted = [...invs].sort((a, b) => normDate(b.date).localeCompare(normDate(a.date)));
        return monthKey(sorted[0].date) || currentFy();
    }

    function isValidGstin(g) {
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(g || '').replace(/\s/g, '').toUpperCase());
    }

    function cleanGstin(g) {
        return String(g || '').replace(/\s/g, '').toUpperCase();
    }

    function lookupCustomer(client, partyName) {
        const name = String(partyName || '').trim().toLowerCase();
        const list = client.customers || [];
        const hit = list.find(c => String(c.name || '').trim().toLowerCase() === name);
        return hit || null;
    }

    function customerGstin(client, partyName) {
        const c = lookupCustomer(client, partyName);
        return c?.gstin ? cleanGstin(c.gstin) : '';
    }

    function customerPos(client, partyName, fallbackState) {
        const c = lookupCustomer(client, partyName);
        if (c?.stateCode) return String(c.stateCode).padStart(2, '0');
        const g = customerGstin(client, partyName);
        if (g.length >= 2) return g.slice(0, 2);
        return String(fallbackState || client.stateCode || '07').padStart(2, '0');
    }

    function deriveRate(inv) {
        const tx = num(inv.taxable);
        if (!tx) return 0;
        if (num(inv.igst) > 0) return round2((num(inv.igst) / tx) * 100);
        const half = num(inv.cgst) + num(inv.sgst);
        return round2((half / tx) * 100);
    }

    function normalizePortalRate(rt) {
        const r = num(rt);
        if (!r) return 0;
        let best = VALID_GSTR_RATES[0];
        let diff = Math.abs(r - best);
        VALID_GSTR_RATES.forEach(v => {
            const d = Math.abs(r - v);
            if (d < diff) { diff = d; best = v; }
        });
        return best;
    }

    /** Offline tool line-item code: 5%→501, 12%→1201, 18%→1801, 0.25%→251, 0%→1 */
    function gstrItemNum(rt) {
        const rate = normalizePortalRate(rt);
        if (!rate) return 1;
        if (rate < 1) return Math.round(rate * 1000) + 1;
        return Math.round(rate * 100) + 1;
    }

    /** Offline tool omits zero split-tax fields in line items (keeps csamt). */
    function portalItemDet(det, interState) {
        const out = {
            txval: round2(det.txval),
            rt: normalizePortalRate(det.rt)
        };
        const iamt = round2(det.iamt);
        const camt = round2(det.camt);
        const samt = round2(det.samt);
        const csamt = round2(det.csamt);
        const isInter = interState || (iamt > 0 && camt === 0 && samt === 0);
        if (isInter) out.iamt = iamt;
        else {
            out.camt = camt;
            out.samt = samt;
        }
        out.csamt = csamt;
        return out;
    }

    function invInterState(inv, gstin) {
        if (inv.itms?.some(it => num(it.itm_det?.iamt) > 0)) return true;
        if (inv.itms?.some(it => num(it.itm_det?.camt) > 0 || num(it.itm_det?.samt) > 0)) return false;
        const home = cleanGstin(gstin).slice(0, 2);
        return Boolean(inv.pos && home && inv.pos !== home);
    }

    function sanitizePortalItms(itms, interState) {
        return (itms || []).map(it => ({
            num: it.num,
            itm_det: portalItemDet(it.itm_det || {}, interState)
        }));
    }

    function portalB2csRow(row) {
        const out = {
            sply_ty: row.sply_ty,
            rt: normalizePortalRate(row.rt),
            typ: row.typ || 'OE',
            pos: row.pos,
            txval: round2(row.txval)
        };
        if (row.sply_ty === 'INTRA') {
            out.camt = round2(row.camt);
            out.samt = round2(row.samt);
        } else {
            out.iamt = round2(row.iamt);
        }
        out.csamt = round2(row.csamt);
        return out;
    }

    function portalHsnRow(row, idx) {
        return {
            num: idx,
            hsn_sc: String(row.hsn_sc || ''),
            desc: String(row.desc || '').slice(0, 200),
            uqc: row.uqc || 'NOS',
            qty: round2(row.qty),
            rt: normalizePortalRate(row.rt),
            txval: round2(row.txval),
            iamt: round2(row.iamt),
            camt: round2(row.camt),
            samt: round2(row.samt),
            csamt: round2(row.csamt)
        };
    }

    function sanitizeInum(s) {
        return String(s || '').trim().replace(/[^A-Za-z0-9\-\/]/g, '').slice(0, 16);
    }

    function reconcileItemTax(txval, rt, igst, cgst, sgst, interState) {
        const tx = round2(txval);
        const rate = normalizePortalRate(rt);
        if (!tx || !rate) {
            return { txval: tx, rt: rate, iamt: 0, camt: 0, samt: 0, csamt: 0 };
        }
        const totalTax = round2(tx * rate / 100);
        if (interState || (num(igst) > 0 && num(cgst) + num(sgst) === 0)) {
            return { txval: tx, rt: rate, iamt: totalTax, camt: 0, samt: 0, csamt: 0 };
        }
        const half = round2(totalTax / 2);
        return { txval: tx, rt: rate, iamt: 0, camt: half, samt: round2(totalTax - half), csamt: 0 };
    }

    function invoiceLineItem(inv, interState) {
        const tx = round2(inv.taxable);
        const rt = normalizePortalRate(deriveRate(inv));
        const tax = reconcileItemTax(tx, rt, inv.igst, inv.cgst, inv.sgst, interState);
        return {
            num: gstrItemNum(rt),
            itm_det: tax
        };
    }

    function lookupOriginalInvoice(client, invNo) {
        if (!invNo) return null;
        const key = sanitizeInum(invNo).toUpperCase();
        return (client.invoices || []).find(i => sanitizeInum(i.number || i.id).toUpperCase() === key) || null;
    }

    function lookupInvoiceDate(client, invNo) {
        const hit = lookupOriginalInvoice(client, invNo);
        return hit?.date ? toGstDate(hit.date) : '';
    }

    function docTypeOf(inv) {
        if (inv.docType) return String(inv.docType).toUpperCase();
        const t = String(inv.type || inv.invoiceType || '').toLowerCase();
        if (t.includes('credit')) return 'CN';
        if (t.includes('debit')) return 'DN';
        if (t.includes('bill of supply') || t.includes('bos')) return 'BOS';
        if (t.includes('challan') || t.includes('dc')) return 'DC';
        return 'INV';
    }

    function isOutwardSupply(inv) {
        return docTypeOf(inv) !== 'DC';
    }

    function isCdnDoc(inv) {
        const dt = docTypeOf(inv);
        return dt === 'CN' || dt === 'DN';
    }

    function filterInvoices(client, opts) {
        let invs = (client.invoices || []).filter(i => i.status !== 'Cancelled' && i.status !== 'Draft');
        if (!opts?.includeDc) invs = invs.filter(isOutwardSupply);
        if (opts?.docType) invs = invs.filter(i => docTypeOf(i) === opts.docType);
        if (opts?.onlyCdn) invs = invs.filter(isCdnDoc);
        if (opts?.onlyTaxable) invs = invs.filter(i => !isCdnDoc(i) && docTypeOf(i) !== 'BOS');
        if (opts.month) {
            return invs.filter(i => monthKey(i.date) === opts.month);
        }
        if (opts.fyRange) {
            const { start, end } = opts.fyRange;
            return invs.filter(i => {
                const d = normDate(i.date);
                return d >= start && d <= end;
            });
        }
        return invs;
    }

    function collectCdnEntries(client, month) {
        const entries = [];
        filterInvoices(client, { month, onlyCdn: true }).forEach(inv => {
            entries.push({
                source: 'invoice',
                docType: docTypeOf(inv),
                number: inv.number || inv.id,
                date: inv.date,
                partyName: inv.partyName,
                againstInvoice: inv.againstInvoice || inv.originalInvoice || '',
                taxable: num(inv.taxable),
                cgst: num(inv.cgst),
                sgst: num(inv.sgst),
                igst: num(inv.igst),
                grandTotal: num(inv.grandTotal)
            });
        });
        (client.creditNotes || []).forEach(cn => {
            if (month && monthKey(cn.date) !== month) return;
            const isCn = String(cn.type || '').toLowerCase().includes('credit');
            entries.push({
                source: 'creditNote',
                docType: isCn ? 'CN' : 'DC',
                number: cn.number,
                date: cn.date,
                partyName: cn.party || cn.customer || '',
                againstInvoice: cn.againstInvoice || '',
                taxable: num(cn.taxable ?? cn.amount),
                cgst: num(cn.cgst),
                sgst: num(cn.sgst),
                igst: num(cn.igst),
                grandTotal: num(cn.grandTotal ?? cn.amount)
            });
        });
        (client.debitNotes || []).forEach(dn => {
            if (month && monthKey(dn.date) !== month) return;
            entries.push({
                source: 'debitNote',
                docType: 'DN',
                number: dn.number,
                date: dn.date,
                partyName: dn.party || dn.customer || '',
                againstInvoice: dn.againstInvoice || '',
                taxable: num(dn.taxable ?? dn.amount),
                cgst: num(dn.cgst),
                sgst: num(dn.sgst),
                igst: num(dn.igst),
                grandTotal: num(dn.grandTotal ?? dn.amount)
            });
        });
        return entries.filter(e => e.docType === 'CN' || e.docType === 'DN');
    }

    function cdnLineItem(entry, interState, origInv) {
        let tx = round2(entry.taxable);
        let rt = normalizePortalRate(tx ? ((entry.igst + entry.cgst + entry.sgst) / tx) * 100 : 0);
        if (!rt && origInv && tx) {
            rt = normalizePortalRate(deriveRate(origInv));
            const tax = reconcileItemTax(tx, rt, origInv.igst, origInv.cgst, origInv.sgst, interState);
            return { num: gstrItemNum(rt), itm_det: tax };
        }
        return {
            num: gstrItemNum(rt),
            itm_det: reconcileItemTax(tx, rt, entry.igst, entry.cgst, entry.sgst, interState)
        };
    }

    function buildCdnNote(client, entry) {
        const pos = customerPos(client, entry.partyName, client.stateCode);
        const against = sanitizeInum(entry.againstInvoice);
        const origInv = lookupOriginalInvoice(client, against);
        const interState = num(entry.igst) > 0 || (origInv ? num(origInv.igst) > 0 : false);
        const origDate = origInv?.date ? toGstDate(origInv.date) : '';
        const note = {
            ntty: entry.docType === 'DN' ? 'D' : 'C',
            nt_num: sanitizeInum(entry.number),
            nt_dt: toGstDate(entry.date),
            val: round2(entry.grandTotal || entry.taxable + entry.cgst + entry.sgst + entry.igst),
            itms: [cdnLineItem(entry, interState, origInv)]
        };
        if (against) {
            note.inum = against;
            if (origDate) note.idt = origDate;
        }
        return { note, pos, interState };
    }

    function buildCdnrCdnur(client, month) {
        const cdnrMap = new Map();
        const cdnur = [];
        collectCdnEntries(client, month).forEach(entry => {
            const ctin = customerGstin(client, entry.partyName);
            const { note, pos, interState } = buildCdnNote(client, entry);
            if (isValidGstin(ctin)) {
                const list = cdnrMap.get(ctin) || { ctin, nt: [] };
                list.nt.push(note);
                cdnrMap.set(ctin, list);
            } else {
                const row = {
                    typ: interState ? 'B2CL' : 'B2CS',
                    pos,
                    ...note
                };
                cdnur.push(row);
            }
        });
        return { cdnr: [...cdnrMap.values()], cdnur };
    }

    function filterPurchases(client, opts) {
        const pur = client.purchases || [];
        if (opts.month) {
            return pur.filter(p => monthKey(p.date) === opts.month);
        }
        if (opts.fyRange) {
            const { start, end } = opts.fyRange;
            return pur.filter(p => {
                const d = normDate(p.date);
                return d >= start && d <= end;
            });
        }
        return pur;
    }

    function sumInvoices(invs) {
        return invs.reduce((a, i) => ({
            taxable: a.taxable + num(i.taxable),
            cgst: a.cgst + num(i.cgst),
            sgst: a.sgst + num(i.sgst),
            igst: a.igst + num(i.igst),
            total: a.total + num(i.grandTotal)
        }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
    }

    function sumPurchases(pur, itcOnly) {
        return pur.filter(p => !itcOnly || p.itcEligible !== false).reduce((a, p) => ({
            taxable: a.taxable + num(p.taxable),
            cgst: a.cgst + num(p.cgst),
            sgst: a.sgst + num(p.sgst),
            igst: a.igst + num(p.igst)
        }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });
    }

    function defaultHsnMeta(stock) {
        return (stock && stock[0])
            ? { hsn: stock[0].hsn || '9983', desc: stock[0].name || 'Taxable supplies' }
            : { hsn: '9983', desc: 'Taxable supplies' };
    }

    function buildHsnRows(invs, stock) {
        const map = new Map();
        const defaultHsn = defaultHsnMeta(stock);
        invs.forEach(inv => {
            const hsn = defaultHsn.hsn;
            const interState = num(inv.igst) > 0;
            const rt = normalizePortalRate(deriveRate(inv));
            const key = `${hsn}|${rt}`;
            const row = map.get(key) || {
                hsn_sc: hsn,
                desc: defaultHsn.desc,
                uqc: 'NOS',
                qty: 0,
                rt,
                txval: 0,
                iamt: 0,
                camt: 0,
                samt: 0,
                csamt: 0
            };
            row.qty += num(inv.items) || 1;
            const tax = reconcileItemTax(num(inv.taxable), rt, inv.igst, inv.cgst, inv.sgst, interState);
            row.txval = round2(row.txval + tax.txval);
            row.iamt = round2(row.iamt + tax.iamt);
            row.camt = round2(row.camt + tax.camt);
            row.samt = round2(row.samt + tax.samt);
            map.set(key, row);
        });
        return [...map.values()].map((r, i) => portalHsnRow(r, i + 1));
    }

    function buildHsnSummary(invs, stock) {
        return { data: buildHsnRows(invs, stock) };
    }

    function buildPortalHsn(client, invs) {
        const b2bInvs = [];
        const b2cInvs = [];
        invs.forEach(inv => {
            const ctin = customerGstin(client, inv.partyName);
            if (isValidGstin(ctin)) b2bInvs.push(inv);
            else b2cInvs.push(inv);
        });
        return {
            hsn_b2b: buildHsnRows(b2bInvs, client.stock),
            hsn_b2c: buildHsnRows(b2cInvs, client.stock)
        };
    }

    function sortDocsByNumber(invs) {
        return [...invs].sort((a, b) => sanitizeInum(a.number || a.id).localeCompare(sanitizeInum(b.number || b.id), undefined, { numeric: true }));
    }

    function docIssueSeries(docs, docNum, docTyp) {
        if (!docs.length) return null;
        const sorted = sortDocsByNumber(docs);
        return {
            doc_num: docNum,
            doc_typ: docTyp,
            docs: [{
                num: 1,
                from: sanitizeInum(sorted[0].number || sorted[0].id || '1'),
                to: sanitizeInum(sorted[sorted.length - 1].number || sorted[sorted.length - 1].id || String(sorted.length)),
                totnum: sorted.length,
                cancel: 0,
                net_issue: sorted.length
            }]
        };
    }

    function buildDocIssue(client, month, allInvs) {
        const outward = allInvs.filter(i => docTypeOf(i) === 'INV' || (!isCdnDoc(i) && docTypeOf(i) !== 'BOS' && docTypeOf(i) !== 'DC'));
        const creditNotes = collectCdnEntries(client, month).filter(e => e.docType === 'CN');
        const debitNotes = collectCdnEntries(client, month).filter(e => e.docType === 'DN');
        const doc_det = [
            docIssueSeries(outward, 1, DOC_ISSUE_TYPES[1]),
            docIssueSeries(debitNotes, 4, DOC_ISSUE_TYPES[4]),
            docIssueSeries(creditNotes, 5, DOC_ISSUE_TYPES[5])
        ].filter(Boolean);
        return doc_det.length ? { doc_det } : undefined;
    }

    function buildNilSection(bosInvs, client) {
        if (!bosInvs.length) return undefined;
        const amounts = Object.fromEntries(NIL_SPLY_TYPES.map(t => [t, { expt_amt: 0, nil_amt: 0, ngsup_amt: 0 }]));
        bosInvs.forEach(inv => {
            const interState = num(inv.igst) > 0;
            const registered = isValidGstin(customerGstin(client, inv.partyName));
            const sply_ty = (interState ? 'INTR' : 'INTRA') + (registered ? 'B2B' : 'B2C');
            const row = amounts[sply_ty] || amounts.INTRAB2C;
            row.nil_amt = round2(row.nil_amt + num(inv.taxable));
        });
        return {
            inv: NIL_SPLY_TYPES.map(sply_ty => ({
                sply_ty,
                expt_amt: amounts[sply_ty].expt_amt,
                nil_amt: amounts[sply_ty].nil_amt,
                ngsup_amt: amounts[sply_ty].ngsup_amt
            }))
        };
    }

    function buildGstr1(client, month) {
        const allInvs = filterInvoices(client, { month });
        const invs = filterInvoices(client, { month, onlyTaxable: true });
        const bosInvs = allInvs.filter(i => docTypeOf(i) === 'BOS');
        const gstin = cleanGstin(client.gstin);
        const fp = fpFromMonth(month);
        const b2bMap = new Map();
        const b2cl = [];
        const b2csMap = new Map();

        invs.forEach(inv => {
            const ctin = customerGstin(client, inv.partyName);
            const pos = customerPos(client, inv.partyName, client.stateCode);
            const interState = num(inv.igst) > 0;
            const rcm = inv.reverseCharge === true || inv.rchrg === 'Y';
            const entry = {
                inum: sanitizeInum(inv.number || inv.id),
                idt: toGstDate(inv.date),
                val: round2(inv.grandTotal),
                pos,
                rchrg: rcm ? 'Y' : 'N',
                inv_typ: 'R',
                itms: [invoiceLineItem(inv, interState)]
            };
            if (isValidGstin(ctin)) {
                const list = b2bMap.get(ctin) || { ctin, inv: [] };
                list.inv.push(entry);
                b2bMap.set(ctin, list);
            } else if (interState && num(inv.grandTotal) > B2CL_THRESHOLD) {
                b2cl.push({ pos, inv: [entry] });
            } else {
                const rt = normalizePortalRate(deriveRate(inv));
                const key = `${pos}|${rt}|${interState ? 'INTER' : 'INTRA'}`;
                const row = b2csMap.get(key) || {
                    sply_ty: interState ? 'INTER' : 'INTRA',
                    pos,
                    typ: 'OE',
                    rt,
                    txval: 0,
                    iamt: 0,
                    camt: 0,
                    samt: 0,
                    csamt: 0
                };
                const tax = reconcileItemTax(num(inv.taxable), rt, inv.igst, inv.cgst, inv.sgst, interState);
                row.txval = round2(row.txval + tax.txval);
                row.iamt = round2(row.iamt + tax.iamt);
                row.camt = round2(row.camt + tax.camt);
                row.samt = round2(row.samt + tax.samt);
                b2csMap.set(key, row);
            }
        });

        const { cdnr, cdnur } = buildCdnrCdnur(client, month);
        const totals = sumInvoices(invs);
        const cdnCount = cdnr.reduce((n, g) => n + (g.nt?.length || 0), 0) + cdnur.length;

        return {
            meta: {
                returnType: 'GSTR-1',
                version: VERSION,
                generatedAt: new Date().toISOString(),
                source: 'LedgerFlow CRM',
                period: monthLabel(month),
                fp,
                invoiceCount: invs.length,
                cdnCount,
                bosCount: bosInvs.length
            },
            gstin,
            fp,
            version: PORTAL_GSTR1_VERSION,
            b2b: [...b2bMap.values()],
            b2cl,
            b2cs: [...b2csMap.values()],
            cdnr,
            cdnur,
            nil: buildNilSection(bosInvs, client),
            hsn: buildPortalHsn(client, invs),
            doc_issue: buildDocIssue(client, month, allInvs),
            summary: {
                outwardTaxable: round2(totals.taxable),
                outwardCgst: round2(totals.cgst),
                outwardSgst: round2(totals.sgst),
                outwardIgst: round2(totals.igst),
                b2bCount: [...b2bMap.values()].reduce((n, g) => n + g.inv.length, 0),
                b2csCount: b2csMap.size,
                b2clCount: b2cl.length,
                cdnCount,
                bosCount: bosInvs.length,
                rcmCount: invs.filter(i => i.reverseCharge || i.rchrg === 'Y').length
            }
        };
    }

    function buildGstr1A(client, month) {
        const base = buildGstr1(client, month);
        const amended = filterInvoices(client, { month }).filter(i =>
            i.gstrAmended || i.amended || client.gstrStale?.[month]?.gstr1
        );
        base.meta.returnType = 'GSTR-1A';
        base.amendment = {
            org_fp: base.fp,
            amend_typ: amended.length ? 'R' : 'N',
            amended_count: amended.length,
            reason: amended.length ? 'Books updated after original GSTR-1 filing' : 'No amendments pending'
        };
        if (amended.length) {
            base.amended_invoices = amended.map(i => ({
                inum: i.number || i.id,
                idt: toGstDate(i.date),
                val: round2(i.grandTotal),
                docType: docTypeOf(i)
            }));
        }
        return base;
    }

    function buildGstr3b(client, month) {
        const invs = filterInvoices(client, { month });
        const pur = filterPurchases(client, { month });
        const out = sumInvoices(invs);
        const itcPur = sumPurchases(pur, true);
        const gstin = cleanGstin(client.gstin);
        const fp = fpFromMonth(month);

        const netIgst = round2(out.igst - itcPur.igst);
        const netCgst = round2(out.cgst - itcPur.cgst);
        const netSgst = round2(out.sgst - itcPur.sgst);

        return {
            meta: {
                returnType: 'GSTR-3B',
                version: VERSION,
                generatedAt: new Date().toISOString(),
                source: 'LedgerFlow CRM',
                period: monthLabel(month),
                fp,
                invoiceCount: invs.length,
                purchaseCount: pur.length
            },
            gstin,
            ret_period: fp,
            sup_details: {
                osup_det: {
                    txval: round2(out.taxable),
                    iamt: round2(out.igst),
                    camt: round2(out.cgst),
                    samt: round2(out.sgst),
                    csamt: 0
                },
                osup_zero: { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 },
                osup_nil_exmp: { txval: 0 },
                isup_rev: { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 }
            },
            inter_sup: {
                unreg_details: [],
                comp_details: [],
                uin_details: []
            },
            itc_elg: {
                itc_avl: [{
                    ty: 'IMPG',
                    iamt: round2(itcPur.igst),
                    camt: round2(itcPur.cgst),
                    samt: round2(itcPur.sgst),
                    csamt: 0
                }],
                itc_rev: [{ ty: 'RUL', iamt: 0, camt: 0, samt: 0, csamt: 0 }],
                itc_net: {
                    iamt: round2(itcPur.igst),
                    camt: round2(itcPur.cgst),
                    samt: round2(itcPur.sgst),
                    csamt: 0
                },
                itc_inelg: { ty: 'OTH', iamt: 0, camt: 0, samt: 0, csamt: 0 }
            },
            inward_sup: {
                isup_details: pur.map(p => ({
                    ty: 'GST',
                    inter: num(p.igst) > 0 ? 1 : 0,
                    intra: num(p.igst) > 0 ? 0 : 1,
                    ctin: cleanGstin(p.gstin),
                    inum: p.invoiceNo || '',
                    idt: toGstDate(p.date),
                    val: round2(num(p.taxable) + num(p.cgst) + num(p.sgst) + num(p.igst)),
                    pos: cleanGstin(p.gstin).slice(0, 2) || String(client.stateCode || '07').padStart(2, '0'),
                    itc_elg: p.itcEligible !== false ? 'Y' : 'N'
                }))
            },
            intr_ltfee: {
                intr_details: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
                ltfee_details: { iamt: 0, camt: 0, samt: 0, csamt: 0 }
            },
            summary: {
                outwardTaxable: round2(out.taxable),
                outwardTax: round2(out.cgst + out.sgst + out.igst),
                itcAvailable: round2(itcPur.cgst + itcPur.sgst + itcPur.igst),
                netPayableIgst: Math.max(0, netIgst),
                netPayableCgst: Math.max(0, netCgst),
                netPayableSgst: Math.max(0, netSgst),
                totalNetPayable: round2(Math.max(0, netIgst) + Math.max(0, netCgst) + Math.max(0, netSgst))
            }
        };
    }

    function buildGstr9(client, fy) {
        const range = fyRange(fy);
        if (!range) throw new Error('Invalid financial year. Use format 2025-26');
        const invs = filterInvoices(client, { fyRange: range });
        const pur = filterPurchases(client, { fyRange: range });
        const out = sumInvoices(invs);
        const itc = sumPurchases(pur, true);
        const gstin = cleanGstin(client.gstin);

        const monthly = {};
        invs.forEach(i => {
            const mk = monthKey(i.date);
            if (!monthly[mk]) monthly[mk] = { taxable: 0, tax: 0, count: 0 };
            monthly[mk].taxable += num(i.taxable);
            monthly[mk].tax += num(i.cgst) + num(i.sgst) + num(i.igst);
            monthly[mk].count += 1;
        });

        return {
            meta: {
                returnType: 'GSTR-9',
                version: VERSION,
                generatedAt: new Date().toISOString(),
                source: 'LedgerFlow CRM',
                financialYear: range.label,
                fp: `03${range.end.slice(0, 4)}`,
                invoiceCount: invs.length,
                purchaseCount: pur.length
            },
            gstin,
            fp: range.label,
            fy: range.label,
            version: 'GST3.2.2',
            table4: {
                outward_supplies: {
                    taxable: round2(out.taxable),
                    igst: round2(out.igst),
                    cgst: round2(out.cgst),
                    sgst: round2(out.sgst),
                    cess: 0
                }
            },
            table5: {
                itc_availed: {
                    igst: round2(itc.igst),
                    cgst: round2(itc.cgst),
                    sgst: round2(itc.sgst),
                    cess: 0
                }
            },
            table6: {
                tax_paid: {
                    igst: round2(Math.max(0, out.igst - itc.igst)),
                    cgst: round2(Math.max(0, out.cgst - itc.cgst)),
                    sgst: round2(Math.max(0, out.sgst - itc.sgst)),
                    cess: 0
                }
            },
            table8: {
                purchases: pur.map(p => ({
                    supplier: p.supplier,
                    gstin: cleanGstin(p.gstin),
                    invoiceNo: p.invoiceNo,
                    date: toGstDate(p.date),
                    taxable: round2(p.taxable),
                    igst: round2(p.igst),
                    cgst: round2(p.cgst),
                    sgst: round2(p.sgst),
                    itcEligible: p.itcEligible !== false
                }))
            },
            table17: {
                hsn_outward: buildHsnRows(invs, client.stock)
            },
            monthlyBreakup: Object.keys(monthly).sort().map(mk => ({
                month: monthLabel(mk),
                invoices: monthly[mk].count,
                taxable: round2(monthly[mk].taxable),
                tax: round2(monthly[mk].tax)
            })),
            summary: {
                annualOutwardTaxable: round2(out.taxable),
                annualOutwardTax: round2(out.cgst + out.sgst + out.igst),
                annualItc: round2(itc.cgst + itc.sgst + itc.igst),
                netTaxPaid: round2(
                    Math.max(0, out.igst - itc.igst) +
                    Math.max(0, out.cgst - itc.cgst) +
                    Math.max(0, out.sgst - itc.sgst)
                )
            }
        };
    }

    function buildReturn(returnType, client, period) {
        if (returnType === 'GSTR-1') return buildGstr1(client, period.month);
        if (returnType === 'GSTR-1A') return buildGstr1A(client, period.month);
        if (returnType === 'GSTR-3B') return buildGstr3b(client, period.month);
        if (returnType === 'GSTR-9') return buildGstr9(client, period.fy);
        throw new Error('Unknown return type');
    }

    function csvCell(v) {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }

    function gstr1ToCsv(data) {
        const lines = ['Section,GSTIN,Invoice No,Invoice Date,Party GSTIN,POS,Taxable,Rate,IGST,CGST,SGST,Total'];
        (data.b2b || []).forEach(g => {
            (g.inv || []).forEach(inv => {
                const it = inv.itms?.[0]?.itm_det || {};
                lines.push([
                    'B2B', data.gstin, inv.inum, inv.idt, g.ctin, inv.pos,
                    it.txval, it.rt, it.iamt, it.camt, it.samt, inv.val
                ].map(csvCell).join(','));
            });
        });
        (data.b2cl || []).forEach(g => {
            (g.inv || []).forEach(inv => {
                const it = inv.itms?.[0]?.itm_det || {};
                lines.push([
                    'B2CL', data.gstin, inv.inum, inv.idt, '', inv.pos,
                    it.txval, it.rt, it.iamt, it.camt, it.samt, inv.val
                ].map(csvCell).join(','));
            });
        });
        (data.b2cs || []).forEach(r => {
            lines.push([
                'B2CS', data.gstin, '', '', '', r.pos,
                r.txval, r.rt, r.iamt, r.camt, r.samt, round2(r.txval + r.iamt + r.camt + r.samt)
            ].map(csvCell).join(','));
        });
        (data.cdnr || []).forEach(g => {
            (g.nt || []).forEach(nt => {
                const it = nt.itms?.[0]?.itm_det || {};
                lines.push([
                    'CDNR', data.gstin, nt.nt_num, nt.nt_dt, g.ctin, '',
                    it.txval, it.rt, it.iamt, it.camt, it.samt, nt.val
                ].map(csvCell).join(','));
            });
        });
        lines.push('');
        lines.push('HSN Summary (B2B)');
        lines.push('HSN,Description,UQC,Qty,Rate,Taxable,IGST,CGST,SGST');
        (data.hsn?.hsn_b2b || data.hsn?.data || []).forEach(h => {
            lines.push([h.hsn_sc, h.desc, h.uqc, h.qty, h.rt, h.txval, h.iamt, h.camt, h.samt].map(csvCell).join(','));
        });
        if (data.hsn?.hsn_b2c?.length) {
            lines.push('');
            lines.push('HSN Summary (B2C)');
            lines.push('HSN,Description,UQC,Qty,Rate,Taxable,IGST,CGST,SGST');
            data.hsn.hsn_b2c.forEach(h => {
                lines.push([h.hsn_sc, h.desc, h.uqc, h.qty, h.rt, h.txval, h.iamt, h.camt, h.samt].map(csvCell).join(','));
            });
        }
        return lines.join('\n');
    }

    function gstr3bToCsv(data) {
        const s = data.summary || {};
        const lines = [
            'Section,Field,Value',
            `Header,GSTIN,${data.gstin}`,
            `Header,Return Period,${data.ret_period}`,
            'Table 3.1,Taxable outward supplies,' + (data.sup_details?.osup_det?.txval ?? 0),
            'Table 3.1,IGST,' + (data.sup_details?.osup_det?.iamt ?? 0),
            'Table 3.1,CGST,' + (data.sup_details?.osup_det?.camt ?? 0),
            'Table 3.1,SGST,' + (data.sup_details?.osup_det?.samt ?? 0),
            'Table 4,ITC IGST,' + (data.itc_elg?.itc_net?.iamt ?? 0),
            'Table 4,ITC CGST,' + (data.itc_elg?.itc_net?.camt ?? 0),
            'Table 4,ITC SGST,' + (data.itc_elg?.itc_net?.samt ?? 0),
            'Summary,Outward Tax,' + (s.outwardTax ?? 0),
            'Summary,ITC Available,' + (s.itcAvailable ?? 0),
            'Summary,Net Payable IGST,' + (s.netPayableIgst ?? 0),
            'Summary,Net Payable CGST,' + (s.netPayableCgst ?? 0),
            'Summary,Net Payable SGST,' + (s.netPayableSgst ?? 0),
            'Summary,Total Net Payable,' + (s.totalNetPayable ?? 0),
            '',
            'Inward Supplies',
            'Supplier GSTIN,Invoice No,Date,Taxable,IGST,CGST,SGST,ITC Eligible'
        ];
        (data.inward_sup?.isup_details || []).forEach(p => {
            lines.push([
                p.ctin, p.inum, p.idt, '', p.val, '', '', p.itc_elg
            ].map(csvCell).join(','));
        });
        return lines.join('\n');
    }

    function gstr9ToCsv(data) {
        const lines = [
            'Section,Field,Value',
            `Header,GSTIN,${data.gstin}`,
            `Header,Financial Year,${data.fy}`,
            'Table 4,Outward Taxable,' + (data.table4?.outward_supplies?.taxable ?? 0),
            'Table 4,Outward IGST,' + (data.table4?.outward_supplies?.igst ?? 0),
            'Table 4,Outward CGST,' + (data.table4?.outward_supplies?.cgst ?? 0),
            'Table 4,Outward SGST,' + (data.table4?.outward_supplies?.sgst ?? 0),
            'Table 5,ITC IGST,' + (data.table5?.itc_availed?.igst ?? 0),
            'Table 5,ITC CGST,' + (data.table5?.itc_availed?.cgst ?? 0),
            'Table 5,ITC SGST,' + (data.table5?.itc_availed?.sgst ?? 0),
            'Table 6,Tax Paid IGST,' + (data.table6?.tax_paid?.igst ?? 0),
            'Table 6,Tax Paid CGST,' + (data.table6?.tax_paid?.cgst ?? 0),
            'Table 6,Tax Paid SGST,' + (data.table6?.tax_paid?.sgst ?? 0),
            '',
            'Monthly Breakup',
            'Month,Invoices,Taxable,Tax'
        ];
        (data.monthlyBreakup || []).forEach(m => {
            lines.push([m.month, m.invoices, m.taxable, m.tax].map(csvCell).join(','));
        });
        lines.push('');
        lines.push('Purchases');
        lines.push('Supplier,GSTIN,Invoice,Date,Taxable,IGST,CGST,SGST,ITC');
        (data.table8?.purchases || []).forEach(p => {
            lines.push([
                p.supplier, p.gstin, p.invoiceNo, p.date, p.taxable, p.igst, p.cgst, p.sgst, p.itcEligible ? 'Y' : 'N'
            ].map(csvCell).join(','));
        });
        return lines.join('\n');
    }

    function toCsv(returnType, data) {
        if (returnType === 'GSTR-1') return gstr1ToCsv(data);
        if (returnType === 'GSTR-3B') return gstr3bToCsv(data);
        if (returnType === 'GSTR-9') return gstr9ToCsv(data);
        return '';
    }

    function downloadText(content, fileName, mime) {
        const blob = new Blob([content], { type: mime });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function fileBase(client, returnType, periodLabel) {
        const gst = cleanGstin(client.gstin) || client.pan || client.id || 'export';
        const slug = returnType.replace(/[^A-Z0-9]/gi, '').toLowerCase();
        const per = String(periodLabel || '').replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
        return `${slug}_${gst}_${per}`;
    }

    function upsertFilingRecord(client, returnType, periodLabel, status) {
        if (!client.gstrFilings) client.gstrFilings = [];
        const st = status || 'Ready';
        const existing = client.gstrFilings.find(f => f.return === returnType && f.period === periodLabel);
        if (existing) {
            if (existing.status !== 'Filed' && existing.status !== 'Acknowledged') existing.status = st;
            existing.updatedAt = new Date().toISOString();
            return existing;
        }
        const row = {
            id: 'gf_' + Date.now(),
            return: returnType,
            period: periodLabel,
            status: st,
            filedOn: '',
            arn: '',
            updatedAt: new Date().toISOString()
        };
        client.gstrFilings.push(row);
        return row;
    }

    function markPeriodStale(client, isoDate, reason) {
        const mk = monthKey(isoDate);
        if (!mk) return;
        if (!client.gstrStale) client.gstrStale = {};
        if (!client.gstrStale[mk]) client.gstrStale[mk] = { gstr1: true, gstr3b: true, reason: reason || 'Books updated', at: new Date().toISOString() };
        else {
            client.gstrStale[mk].gstr1 = true;
            client.gstrStale[mk].gstr3b = true;
            client.gstrStale[mk].reason = reason || client.gstrStale[mk].reason;
            client.gstrStale[mk].at = new Date().toISOString();
        }
        const label = monthLabel(mk);
        client.gstrFilings?.forEach(f => {
            if ((f.return === 'GSTR-1' || f.return === 'GSTR-3B') && f.period === label && f.status !== 'Filed' && f.status !== 'Acknowledged') {
                f.status = 'Draft';
            }
        });
    }

    function clearPeriodStale(client, monthStr, returnType) {
        if (!client.gstrStale?.[monthStr]) return;
        if (returnType === 'GSTR-1') client.gstrStale[monthStr].gstr1 = false;
        if (returnType === 'GSTR-3B') client.gstrStale[monthStr].gstr3b = false;
        if (!client.gstrStale[monthStr].gstr1 && !client.gstrStale[monthStr].gstr3b) delete client.gstrStale[monthStr];
    }

    function sanitizeCdnur(rows) {
        const flat = [];
        (rows || []).forEach(row => {
            if (row.nt?.length) {
                row.nt.forEach(note => {
                    flat.push({
                        typ: row.typ || 'B2CS',
                        pos: note.pos || row.pos,
                        ntty: note.ntty,
                        nt_num: sanitizeInum(note.nt_num),
                        nt_dt: note.nt_dt,
                        val: round2(note.val),
                        itms: note.itms,
                        ...(note.inum ? { inum: sanitizeInum(note.inum) } : {}),
                        ...(note.idt ? { idt: note.idt } : {})
                    });
                });
                return;
            }
            flat.push({
                typ: row.typ,
                pos: row.pos,
                ntty: row.ntty,
                nt_num: sanitizeInum(row.nt_num),
                nt_dt: row.nt_dt,
                val: round2(row.val),
                itms: row.itms,
                ...(row.inum ? { inum: sanitizeInum(row.inum) } : {}),
                ...(row.idt ? { idt: row.idt } : {})
            });
        });
        return flat;
    }

    function sanitizeDocIssue(docIssue) {
        if (!docIssue?.doc_det?.length) return null;
        return {
            doc_det: docIssue.doc_det.map(det => ({
                doc_num: det.doc_num || 1,
                doc_typ: det.doc_typ || DOC_ISSUE_TYPES[det.doc_num] || DOC_ISSUE_TYPES[1],
                docs: (det.docs || []).map(d => ({
                    num: d.num || 1,
                    from: sanitizeInum(d.from),
                    to: sanitizeInum(d.to),
                    totnum: num(d.totnum),
                    cancel: num(d.cancel),
                    net_issue: num(d.net_issue)
                }))
            })).filter(det => det.docs.length)
        };
    }

    function portalJsonString(data) {
        return JSON.stringify(data);
    }

    function hsnRowCount(hsn) {
        if (!hsn) return 0;
        if (hsn.data?.length) return hsn.data.length;
        return (hsn.hsn_b2b?.length || 0) + (hsn.hsn_b2c?.length || 0);
    }

    function portalHsnPayload(hsn) {
        if (!hsn) return null;
        const out = {};
        const mapRows = rows => (rows || []).map((r, i) => portalHsnRow(r, i + 1));
        const b2b = mapRows(hsn.hsn_b2b);
        const b2c = mapRows(hsn.hsn_b2c);
        if (b2b.length) out.hsn_b2b = b2b;
        if (b2c.length) out.hsn_b2c = b2c;
        if (!b2b.length && !b2c.length && hsn.data?.length) out.hsn_b2b = mapRows(hsn.data);
        return Object.keys(out).length ? out : null;
    }

    function hasGstr1SupplyData(data) {
        const nilAmt = (data.nil?.inv || []).some(r => num(r.nil_amt) || num(r.expt_amt) || num(r.ngsup_amt));
        return (data.b2b?.length || 0) + (data.b2cl?.length || 0) + (data.b2cs?.length || 0) +
            (data.cdnr?.length || 0) + (data.cdnur?.length || 0) + (nilAmt ? 1 : 0) +
            hsnRowCount(data.hsn) > 0;
    }

    function sanitizePortalB2b(groups, gstin) {
        return (groups || []).map(g => ({
            ctin: g.ctin,
            inv: (g.inv || []).map(inv => {
                const inter = invInterState(inv, gstin);
                const row = {
                    inum: sanitizeInum(inv.inum),
                    idt: inv.idt,
                    val: round2(inv.val),
                    pos: inv.pos,
                    rchrg: inv.rchrg || 'N',
                    inv_typ: inv.inv_typ || 'R',
                    itms: sanitizePortalItms(inv.itms, inter)
                };
                return row;
            })
        }));
    }

    function sanitizePortalB2cl(groups, gstin) {
        return (groups || []).map(g => ({
            pos: g.pos,
            inv: (g.inv || []).map(inv => {
                const inter = invInterState(inv, gstin);
                return {
                    inum: sanitizeInum(inv.inum),
                    idt: inv.idt,
                    val: round2(inv.val),
                    itms: sanitizePortalItms(inv.itms, inter)
                };
            })
        }));
    }

    function sanitizePortalCdnr(groups, gstin) {
        return (groups || []).map(g => ({
            ctin: g.ctin,
            nt: (g.nt || []).map(nt => {
                const inter = nt.itms?.some(it => num(it.itm_det?.iamt) > 0) ||
                    (!nt.itms?.some(it => num(it.itm_det?.camt) > 0 || num(it.itm_det?.samt) > 0) && g.ctin?.slice(0, 2) !== cleanGstin(gstin).slice(0, 2));
                const row = {
                    ntty: nt.ntty,
                    nt_num: sanitizeInum(nt.nt_num),
                    nt_dt: nt.nt_dt,
                    val: round2(nt.val),
                    itms: sanitizePortalItms(nt.itms, inter)
                };
                if (nt.inum) {
                    row.inum = sanitizeInum(nt.inum);
                    if (nt.idt) row.idt = nt.idt;
                }
                return row;
            })
        }));
    }

    function sanitizePortalCdnur(rows, gstin) {
        return sanitizeCdnur(rows).map(row => {
            const inter = row.itms?.some(it => num(it.itm_det?.iamt) > 0) ||
                (row.typ === 'B2CL') ||
                (row.pos && row.pos !== cleanGstin(gstin).slice(0, 2));
            const out = {
                typ: row.typ,
                pos: row.pos,
                ntty: row.ntty,
                nt_num: sanitizeInum(row.nt_num),
                nt_dt: row.nt_dt,
                val: round2(row.val),
                itms: sanitizePortalItms(row.itms, inter)
            };
            if (row.inum) {
                out.inum = sanitizeInum(row.inum);
                if (row.idt) out.idt = row.idt;
            }
            return out;
        });
    }

    function toPortalGstr1(data) {
        if (!data) return {};
        const gstin = cleanGstin(data.gstin);
        const portal = {
            gstin,
            fp: String(data.fp || ''),
            version: PORTAL_GSTR1_VERSION,
            hash: 'hash'
        };
        const b2b = sanitizePortalB2b(data.b2b, gstin);
        if (b2b.length) portal.b2b = b2b;
        const b2cl = sanitizePortalB2cl(data.b2cl, gstin);
        if (b2cl.length) portal.b2cl = b2cl;
        const b2cs = (data.b2cs || []).map(portalB2csRow);
        if (b2cs.length) portal.b2cs = b2cs;
        const cdnr = sanitizePortalCdnr(data.cdnr, gstin);
        if (cdnr.length) portal.cdnr = cdnr;
        const cdnur = sanitizePortalCdnur(data.cdnur, gstin);
        if (cdnur.length) portal.cdnur = cdnur;
        if (data.nil?.inv?.some(r => num(r.nil_amt) || num(r.expt_amt) || num(r.ngsup_amt))) portal.nil = data.nil;
        const hsn = portalHsnPayload(data.hsn);
        if (hsn) portal.hsn = hsn;
        const docIssue = sanitizeDocIssue(data.doc_issue);
        if (docIssue) portal.doc_issue = docIssue;
        return portal;
    }

    function toPortalJson(returnType, data) {
        if (returnType === 'GSTR-1' || returnType === 'GSTR-1A') return toPortalGstr1(data);
        return data;
    }

    function validateReturnJson(returnType, data) {
        const errors = [];
        const warnings = [];
        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Payload is empty'], warnings };
        }
        const gstin = cleanGstin(data.gstin);
        if (!isValidGstin(gstin)) errors.push('Invalid or missing gstin');
        if (returnType === 'GSTR-1' || returnType === 'GSTR-1A') {
            if (data.meta || data.summary) errors.push('Portal JSON must not contain meta/summary — hard-refresh (Ctrl+F5) and re-download');
            if (data.hsn?.data) errors.push('Portal JSON uses deprecated hsn.data — hard-refresh (Ctrl+F5) and re-download');
            if (!data.fp || String(data.fp).length < 5) errors.push('Missing fp (MMYYYY filing period)');
            if (data.version !== PORTAL_GSTR1_VERSION) errors.push(`version must be ${PORTAL_GSTR1_VERSION} (got ${data.version || '—'})`);
            if (!data.hash) warnings.push('Missing hash field — offline tool includes hash');
            if (!hasGstr1SupplyData(data)) errors.push('No outward supply data — portal will reject empty GSTR-1');
            (data.doc_issue?.doc_det || []).forEach((det, i) => {
                if (!det.doc_typ) errors.push(`doc_issue.doc_det[${i}] missing doc_typ (required in offline tool v3.2.4)`);
            });
            (data.cdnur || []).forEach((row, i) => {
                if (row.nt) errors.push(`CDNUR[${i}] uses invalid nt[] wrapper — must be flat note fields`);
                if (row.inum && !row.idt) errors.push(`CDNUR[${i}] has inum but missing original invoice date (idt)`);
            });
            (data.cdnr || []).forEach((g, i) => {
                if (!isValidGstin(g.ctin)) warnings.push(`CDNR[${i}] customer GSTIN invalid`);
                (g.nt || []).forEach((nt, j) => {
                    if (nt.inum && !nt.idt) errors.push(`CDNR[${i}].nt[${j}] has inum but missing original invoice date (idt)`);
                });
            });
            (data.b2b || []).forEach((g, i) => {
                if (!isValidGstin(g.ctin)) warnings.push(`B2B[${i}] customer GSTIN invalid: ${g.ctin || '—'}`);
                (g.inv || []).forEach((inv, j) => {
                    if (!inv.inum) errors.push(`B2B[${i}].inv[${j}] missing inum`);
                    if (inv.inum && inv.inum.length > 16) errors.push(`B2B[${i}].inv[${j}] inum exceeds 16 chars`);
                    if (!inv.idt || !/^\d{2}-\d{2}-\d{4}$/.test(inv.idt)) errors.push(`B2B[${i}].inv[${j}] invalid idt (use DD-MM-YYYY)`);
                    if (!inv.itms?.length) warnings.push(`B2B[${i}].inv[${j}] has no line items`);
                    const inter = invInterState(inv, gstin);
                    const taxSum = (inv.itms || []).reduce((s, it) => {
                        const d = it.itm_det || {};
                        return s + num(d.txval) + num(d.iamt) + num(d.camt) + num(d.samt) + num(d.csamt);
                    }, 0);
                    if (Math.abs(round2(taxSum) - round2(inv.val)) > 0.02) {
                        warnings.push(`B2B[${i}].inv[${j}] val ${inv.val} does not match line items (${round2(taxSum)})`);
                    }
                    (inv.itms || []).forEach((it, k) => {
                        const d = it.itm_det || {};
                        if (!VALID_GSTR_RATES.includes(num(d.rt))) warnings.push(`B2B[${i}].inv[${j}].itms[${k}] rate ${d.rt}% not in GST rate list`);
                        if (num(d.rt) > 0) {
                            if (inter && (d.camt != null || d.samt != null)) {
                                errors.push(`B2B[${i}].inv[${j}].itms[${k}] inter-state line must omit camt/samt (offline tool format)`);
                            }
                            if (!inter && d.iamt != null) {
                                errors.push(`B2B[${i}].inv[${j}].itms[${k}] intra-state line must omit iamt (offline tool format)`);
                            }
                        }
                    });
                });
            });
            (data.b2cs || []).forEach((r, i) => {
                if (!['INTER', 'INTRA'].includes(r.sply_ty)) warnings.push(`B2CS[${i}] sply_ty must be INTER or INTRA`);
                if (r.typ !== 'OE') warnings.push(`B2CS[${i}] typ should be OE`);
                if (r.sply_ty === 'INTRA' && r.iamt != null) errors.push(`B2CS[${i}] INTRA row must omit iamt (offline tool format)`);
                if (r.sply_ty === 'INTER' && (r.camt != null || r.samt != null)) errors.push(`B2CS[${i}] INTER row must omit camt/samt (offline tool format)`);
            });
            const hsnRows = [...(data.hsn?.hsn_b2b || []), ...(data.hsn?.hsn_b2c || []), ...(data.hsn?.data || [])];
            hsnRows.forEach((h, i) => {
                if (!h.num) warnings.push(`HSN[${i}] missing num sequence`);
                if (h.user_desc != null) errors.push(`HSN[${i}] must not contain user_desc in ${PORTAL_GSTR1_VERSION} schema`);
            });
            (data.b2b || []).forEach((g, i) => {
                (g.inv || []).forEach((inv, j) => {
                    (inv.itms || []).forEach((it, k) => {
                        const expected = gstrItemNum(it.itm_det?.rt);
                        if (it.num !== expected) warnings.push(`B2B[${i}].inv[${j}].itms[${k}] num should be ${expected} for rate ${it.itm_det?.rt}%`);
                    });
                });
            });
        }
        if (returnType === 'GSTR-3B') {
            if (!data.ret_period) errors.push('Missing ret_period');
            const os = data.sup_details?.osup_det;
            if (!os) errors.push('Missing sup_details.osup_det (Table 3.1)');
            else if (os.txval == null) warnings.push('Table 3.1 taxable value is null');
            if (!data.itc_elg?.itc_net) warnings.push('Missing itc_elg.itc_net (Table 4)');
        }
        if (returnType === 'GSTR-9') {
            if (!data.fy && !data.fp) errors.push('Missing financial year (fy)');
            if (!data.table4?.outward_supplies) warnings.push('Missing table4 outward summary');
        }
        return { valid: errors.length === 0, errors, warnings };
    }

    function buildValidatedReturn(returnType, client, period, opts = {}) {
        const data = buildReturn(returnType, client, period);
        const portalData = toPortalJson(returnType, data);
        const validation = validateReturnJson(returnType, portalData);
        if (!validation.valid && !opts.force) {
            throw new Error('JSON validation failed: ' + validation.errors.join('; '));
        }
        const periodLabel = returnType === 'GSTR-9' ? period.fy : monthLabel(period.month);
        const fileName = fileBase(client, returnType, periodLabel) + '.json';
        return { data, portalData, validation, fileName, periodLabel };
    }

    function downloadValidatedJson(returnType, client, period, opts = {}) {
        const built = buildValidatedReturn(returnType, client, period, opts);
        const payload = built.portalData || built.data;
        downloadText(portalJsonString(payload), built.fileName, 'application/json');
        upsertFilingRecord(client, returnType, built.periodLabel, 'Ready');
        if (returnType !== 'GSTR-9') clearPeriodStale(client, period.month, returnType);
        return built;
    }

    function ensureMeta(client) {
        if (!client.gstrExportMeta) {
            client.gstrExportMeta = {
                returnType: 'GSTR-1',
                month: defaultMonth(client),
                fy: defaultFy(client)
            };
        }
    }

    function renderSummaryCards(returnType, data) {
        const s = data.summary || {};
        if (returnType === 'GSTR-1' || returnType === 'GSTR-1A') {
            return `
                <div class="gstr-stat"><span>Outward taxable</span><strong>${fmtINR(s.outwardTaxable)}</strong></div>
                <div class="gstr-stat"><span>B2B invoices</span><strong>${s.b2bCount || 0}</strong></div>
                <div class="gstr-stat"><span>CN/DN notes</span><strong>${s.cdnCount || 0}</strong></div>
                <div class="gstr-stat"><span>RCM invoices</span><strong>${s.rcmCount || 0}</strong></div>
                <div class="gstr-stat"><span>Total tax</span><strong>${fmtINR((s.outwardCgst || 0) + (s.outwardSgst || 0) + (s.outwardIgst || 0))}</strong></div>`;
        }
        if (returnType === 'GSTR-3B') {
            return `
                <div class="gstr-stat"><span>Outward tax</span><strong>${fmtINR(s.outwardTax)}</strong></div>
                <div class="gstr-stat"><span>ITC available</span><strong>${fmtINR(s.itcAvailable)}</strong></div>
                <div class="gstr-stat"><span>Net payable</span><strong class="text-amber-400">${fmtINR(s.totalNetPayable)}</strong></div>
                <div class="gstr-stat"><span>Purchases</span><strong>${data.meta?.purchaseCount || 0}</strong></div>`;
        }
        return `
            <div class="gstr-stat"><span>Annual taxable</span><strong>${fmtINR(s.annualOutwardTaxable)}</strong></div>
            <div class="gstr-stat"><span>Annual tax</span><strong>${fmtINR(s.annualOutwardTax)}</strong></div>
            <div class="gstr-stat"><span>ITC availed</span><strong>${fmtINR(s.annualItc)}</strong></div>
            <div class="gstr-stat"><span>Net tax paid</span><strong class="text-amber-400">${fmtINR(s.netTaxPaid)}</strong></div>`;
    }

    function renderGstrReturnExport(container) {
        const client = global.getCurrentClient?.();
        if (!client) {
            container.innerHTML = '<p class="text-slate-400">Select a client to generate GSTR returns.</p>';
            return;
        }
        if (typeof global.LedgerFlowCapabilityModules !== 'undefined') {
            global.LedgerFlowCapabilityModules.ensureCapabilityData?.(client);
        }
        ensureMeta(client);
        const meta = client.gstrExportMeta;
        let preview = null;
        let previewErr = null;
        try {
            preview = buildReturn(meta.returnType, client, { month: meta.month, fy: meta.fy });
        } catch (e) {
            previewErr = e.message;
        }

        const periodField = meta.returnType === 'GSTR-9'
            ? `<label class="gstr-field"><span>Financial Year</span>
                <input type="text" id="gstr-fy" class="gstr-input" value="${esc(meta.fy)}" placeholder="2025-26"></label>`
            : `<label class="gstr-field"><span>Tax Period (month)</span>
                <input type="month" id="gstr-month" class="gstr-input" value="${esc(meta.month)}"></label>`;

        container.innerHTML = `
            <div class="gstr-tool">
                <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
                    <div>
                        <h2 class="text-2xl font-semibold tracking-tight">GSTR Return Export</h2>
                        <p class="text-slate-400 text-sm mt-1">Generate GST portal JSON (${PORTAL_GSTR1_VERSION} schema) &amp; CSV from ${esc(client.name)} books</p>
                    </div>
                    <div class="text-right text-xs text-slate-500">
                        <div>GSTIN: <span class="text-slate-300 font-mono">${esc(client.gstin || '—')}</span></div>
                        <div>${(client.invoices || []).length} invoices · ${(client.purchases || []).length} purchases</div>
                    </div>
                </div>

                <div class="gstr-toolbar">
                    <label class="gstr-field">
                        <span>Return type</span>
                        <select id="gstr-type" class="gstr-input">
                            ${RETURN_TYPES.map(t => `<option value="${t}"${t === meta.returnType ? ' selected' : ''}>${t}</option>`).join('')}
                        </select>
                    </label>
                    ${periodField}
                    <button type="button" id="gstr-preview-btn" class="lf-btn lf-btn--secondary text-sm"><i class="fa-solid fa-rotate mr-1"></i> Refresh</button>
                </div>

                ${previewErr ? `<div class="gstr-alert gstr-alert--error mt-4">${esc(previewErr)}</div>` : ''}

                ${preview ? `
                <div class="gstr-stats mt-4">${renderSummaryCards(meta.returnType, preview)}</div>
                <div class="gstr-actions mt-4">
                    <button type="button" id="gstr-validate" class="lf-btn lf-btn--secondary text-sm"><i class="fa-solid fa-shield-halved mr-1"></i> Validate JSON</button>
                    <button type="button" id="gstr-dl-json" class="lf-btn lf-btn--primary text-sm"><i class="fa-solid fa-file-code mr-1"></i> Download JSON</button>
                    <button type="button" id="gstr-dl-csv" class="lf-btn lf-btn--secondary text-sm"><i class="fa-solid fa-file-csv mr-1"></i> Download CSV</button>
                    <button type="button" id="gstr-mark-ready" class="lf-btn lf-btn--secondary text-sm"><i class="fa-solid fa-check mr-1"></i> Mark Ready</button>
                    <button type="button" onclick="showSection('gst-returns')" class="lf-btn lf-btn--secondary text-sm"><i class="fa-solid fa-table-columns mr-1"></i> Returns Hub</button>
                </div>
                <div id="gstr-validation-msg" class="mt-3 hidden"></div>
                <div class="gstr-alert mt-4 text-xs"><i class="fa-solid fa-circle-info mr-1"></i> GSTR-1 JSON v${VERSION} (${PORTAL_GSTR1_VERSION}): compact format, doc_typ, split-tax fields omitted per offline tool. <strong>JSON gstin must match your GST portal login.</strong> Hard-refresh (Ctrl+F5) before download.</div>
                <div class="gstr-preview-wrap mt-4">
                    <div class="gstr-preview-title"><i class="fa-solid fa-code mr-1"></i> Portal JSON Preview</div>
                    <pre class="gstr-preview-json">${esc(JSON.stringify(toPortalJson(meta.returnType, preview), null, 2))}</pre>
                </div>` : `
                <div class="gstr-alert mt-4">No data for selected period. Add invoices/purchases or change the period.</div>`}
            </div>`;

        bindEvents(container, client);
    }

    function readForm(container, client) {
        const meta = client.gstrExportMeta;
        meta.returnType = container.querySelector('#gstr-type')?.value || 'GSTR-1';
        if (meta.returnType === 'GSTR-9') {
            meta.fy = container.querySelector('#gstr-fy')?.value?.trim() || defaultFy(client);
        } else {
            meta.month = container.querySelector('#gstr-month')?.value || defaultMonth(client);
        }
        return meta;
    }

    function refresh() {
        const main = document.getElementById('main-content');
        if (main && global.currentSection === 'gstr-export') renderGstrReturnExport(main);
        else global.showSection?.('gstr-export');
    }

    function bindEvents(container, client) {
        container.querySelector('#gstr-preview-btn')?.addEventListener('click', () => {
            readForm(container, client);
            global.saveAppData?.();
            refresh();
        });

        container.querySelector('#gstr-type')?.addEventListener('change', () => {
            readForm(container, client);
            global.saveAppData?.();
            refresh();
        });

        container.querySelector('#gstr-dl-json')?.addEventListener('click', () => {
            const meta = readForm(container, client);
            try {
                const { fileName, validation } = downloadValidatedJson(meta.returnType, client, { month: meta.month, fy: meta.fy });
                global.saveAppData?.();
                const warn = validation.warnings.length ? ` (${validation.warnings.length} warning(s))` : '';
                global.showToast?.(`Downloaded ${fileName}${warn}`);
            } catch (e) {
                global.showToast?.(e.message, 'error');
            }
        });

        container.querySelector('#gstr-dl-csv')?.addEventListener('click', () => {
            const meta = readForm(container, client);
            try {
                const data = buildReturn(meta.returnType, client, { month: meta.month, fy: meta.fy });
                const periodLabel = meta.returnType === 'GSTR-9' ? meta.fy : monthLabel(meta.month);
                const name = fileBase(client, meta.returnType, periodLabel) + '.csv';
                downloadText(toCsv(meta.returnType, data), name, 'text/csv');
                upsertFilingRecord(client, meta.returnType, periodLabel);
                global.saveAppData?.();
                global.showToast?.(`Downloaded ${name}`);
            } catch (e) {
                global.showToast?.(e.message, 'error');
            }
        });

        container.querySelector('#gstr-validate')?.addEventListener('click', () => {
            const meta = readForm(container, client);
            const el = container.querySelector('#gstr-validation-msg');
            try {
                const built = buildValidatedReturn(meta.returnType, client, { month: meta.month, fy: meta.fy });
                const w = built.validation.warnings;
                el.className = 'mt-3 gstr-alert' + (w.length ? '' : ' text-emerald-400');
                el.classList.remove('hidden');
                el.innerHTML = w.length
                    ? `<strong>Valid with ${w.length} warning(s):</strong><ul class="list-disc ml-4 mt-1">${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
                    : '<strong>✓ JSON passes portal validation checks</strong>';
            } catch (e) {
                el.className = 'mt-3 gstr-alert gstr-alert--error';
                el.classList.remove('hidden');
                el.textContent = e.message;
            }
        });

        container.querySelector('#gstr-mark-ready')?.addEventListener('click', () => {
            const meta = readForm(container, client);
            const periodLabel = meta.returnType === 'GSTR-9' ? meta.fy : monthLabel(meta.month);
            upsertFilingRecord(client, meta.returnType, periodLabel);
            global.saveAppData?.();
            global.showToast?.(`${meta.returnType} ${periodLabel} marked Ready`);
        });
    }

    global.GstrReturnExport = {
        VERSION,
        RETURN_TYPES,
        DOC_TYPES,
        buildReturn,
        toCsv,
        buildGstr1,
        buildGstr1A,
        buildGstr3b,
        buildGstr9,
        buildCdnrCdnur,
        collectCdnEntries,
        docTypeOf,
        validateReturnJson,
        toPortalGstr1,
        toPortalJson,
        portalJsonString,
        portalItemDet,
        portalB2csRow,
        sanitizePortalItms,
        buildDocIssue,
        sanitizeCdnur,
        buildValidatedReturn,
        downloadValidatedJson,
        upsertFilingRecord,
        markPeriodStale,
        clearPeriodStale,
        monthLabel,
        monthKey,
        fpFromMonth,
        fileBase,
        downloadText,
        cleanGstin,
        isValidGstin,
        filterInvoices,
        filterPurchases,
        defaultMonth,
        defaultFy
    };
    global.renderGstrReturnExport = renderGstrReturnExport;
})(typeof window !== 'undefined' ? window : global);