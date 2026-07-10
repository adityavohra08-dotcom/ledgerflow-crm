/**
 * LedgerFlow — GSTR-1, GSTR-3B, GSTR-9 JSON & CSV export from books
 */
(function (global) {
    'use strict';

    const VERSION = '1.1.0';
    const RETURN_TYPES = ['GSTR-1', 'GSTR-3B', 'GSTR-9'];

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

    function invoiceLineItem(inv, idx) {
        const tx = round2(inv.taxable);
        const rt = deriveRate(inv);
        const cgst = round2(inv.cgst);
        const sgst = round2(inv.sgst);
        const igst = round2(inv.igst);
        return {
            num: idx,
            itm_det: {
                txval: tx,
                rt,
                iamt: igst,
                camt: cgst,
                samt: sgst,
                csamt: 0
            }
        };
    }

    function filterInvoices(client, opts) {
        const invs = (client.invoices || []).filter(i => i.status !== 'Cancelled' && i.status !== 'Draft');
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

    function buildHsnSummary(invs, stock) {
        const map = new Map();
        const defaultHsn = (stock && stock[0]) ? { hsn: stock[0].hsn || '9983', desc: stock[0].name || 'Taxable supplies' } : { hsn: '9983', desc: 'Taxable supplies' };
        invs.forEach(inv => {
            const hsn = defaultHsn.hsn;
            const key = `${hsn}|${deriveRate(inv)}`;
            const row = map.get(key) || {
                hsn_sc: hsn,
                desc: defaultHsn.desc,
                uqc: 'NOS',
                qty: 0,
                rt: deriveRate(inv),
                txval: 0,
                iamt: 0,
                camt: 0,
                samt: 0,
                csamt: 0
            };
            row.qty += num(inv.items) || 1;
            row.txval = round2(row.txval + num(inv.taxable));
            row.iamt = round2(row.iamt + num(inv.igst));
            row.camt = round2(row.camt + num(inv.cgst));
            row.samt = round2(row.samt + num(inv.sgst));
            map.set(key, row);
        });
        return { data: [...map.values()] };
    }

    function buildGstr1(client, month) {
        const invs = filterInvoices(client, { month });
        const gstin = cleanGstin(client.gstin);
        const fp = fpFromMonth(month);
        const b2bMap = new Map();
        const b2cl = [];
        const b2csMap = new Map();

        invs.forEach(inv => {
            const ctin = customerGstin(client, inv.partyName);
            const pos = customerPos(client, inv.partyName, client.stateCode);
            const entry = {
                inum: inv.number || inv.id,
                idt: toGstDate(inv.date),
                val: round2(inv.grandTotal),
                pos,
                rchrg: 'N',
                inv_typ: 'R',
                itms: [invoiceLineItem(inv, 1)]
            };
            if (isValidGstin(ctin)) {
                const list = b2bMap.get(ctin) || { ctin, inv: [] };
                list.inv.push(entry);
                b2bMap.set(ctin, list);
            } else if (num(inv.igst) > 0 && num(inv.grandTotal) > 250000) {
                b2cl.push({
                    pos,
                    inv: [entry]
                });
            } else {
                const key = `${pos}|${deriveRate(inv)}`;
                const row = b2csMap.get(key) || {
                    sply_ty: 'INTRA' + (num(inv.igst) > 0 ? '' : ''),
                    pos,
                    typ: num(inv.igst) > 0 ? 'OE' : 'OE',
                    rt: deriveRate(inv),
                    txval: 0,
                    iamt: 0,
                    camt: 0,
                    samt: 0,
                    csamt: 0
                };
                if (num(inv.igst) > 0) row.sply_ty = 'INTER';
                row.txval = round2(row.txval + num(inv.taxable));
                row.iamt = round2(row.iamt + num(inv.igst));
                row.camt = round2(row.camt + num(inv.cgst));
                row.samt = round2(row.samt + num(inv.sgst));
                b2csMap.set(key, row);
            }
        });

        const totals = sumInvoices(invs);
        return {
            meta: {
                returnType: 'GSTR-1',
                version: VERSION,
                generatedAt: new Date().toISOString(),
                source: 'LedgerFlow CRM',
                period: monthLabel(month),
                fp,
                invoiceCount: invs.length
            },
            gstin,
            fp,
            version: 'GST3.2.2',
            b2b: [...b2bMap.values()],
            b2cl,
            b2cs: [...b2csMap.values()],
            cdnr: [],
            cdnur: [],
            exp: [],
            hsn: buildHsnSummary(invs, client.stock),
            doc_issue: {
                doc_det: [{
                    doc_num: 1,
                    docs: invs.length ? [{
                        num: 1,
                        from: invs[0].number || '1',
                        to: invs[invs.length - 1].number || String(invs.length),
                        totnum: invs.length,
                        cancel: 0,
                        net_issue: invs.length
                    }] : []
                }]
            },
            summary: {
                outwardTaxable: round2(totals.taxable),
                outwardCgst: round2(totals.cgst),
                outwardSgst: round2(totals.sgst),
                outwardIgst: round2(totals.igst),
                b2bCount: [...b2bMap.values()].reduce((n, g) => n + g.inv.length, 0),
                b2csCount: b2csMap.size,
                b2clCount: b2cl.length
            }
        };
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
                hsn_outward: buildHsnSummary(invs, client.stock).data
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
        lines.push('');
        lines.push('HSN Summary');
        lines.push('HSN,Description,UQC,Qty,Rate,Taxable,IGST,CGST,SGST');
        (data.hsn?.data || []).forEach(h => {
            lines.push([h.hsn_sc, h.desc, h.uqc, h.qty, h.rt, h.txval, h.iamt, h.camt, h.samt].map(csvCell).join(','));
        });
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

    function validateReturnJson(returnType, data) {
        const errors = [];
        const warnings = [];
        if (!data || typeof data !== 'object') {
            return { valid: false, errors: ['Payload is empty'], warnings };
        }
        const gstin = cleanGstin(data.gstin);
        if (!isValidGstin(gstin)) errors.push('Invalid or missing gstin');
        if (returnType === 'GSTR-1') {
            if (!data.fp || String(data.fp).length < 5) errors.push('Missing fp (MMYYYY filing period)');
            if (!Array.isArray(data.b2b)) warnings.push('b2b array missing — will file as empty B2B');
            (data.b2b || []).forEach((g, i) => {
                if (!isValidGstin(g.ctin)) warnings.push(`B2B[${i}] customer GSTIN invalid: ${g.ctin || '—'}`);
                (g.inv || []).forEach((inv, j) => {
                    if (!inv.inum) errors.push(`B2B[${i}].inv[${j}] missing inum`);
                    if (!inv.idt) errors.push(`B2B[${i}].inv[${j}] missing idt (DD-MM-YYYY)`);
                    if (!inv.itms?.length) warnings.push(`B2B[${i}].inv[${j}] has no line items`);
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
        const validation = validateReturnJson(returnType, data);
        if (!validation.valid && !opts.force) {
            throw new Error('JSON validation failed: ' + validation.errors.join('; '));
        }
        const periodLabel = returnType === 'GSTR-9' ? period.fy : monthLabel(period.month);
        const fileName = fileBase(client, returnType, periodLabel) + '.json';
        return { data, validation, fileName, periodLabel };
    }

    function downloadValidatedJson(returnType, client, period, opts = {}) {
        const built = buildValidatedReturn(returnType, client, period, opts);
        downloadText(JSON.stringify(built.data, null, 2), built.fileName, 'application/json');
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
        if (returnType === 'GSTR-1') {
            return `
                <div class="gstr-stat"><span>Outward taxable</span><strong>${fmtINR(s.outwardTaxable)}</strong></div>
                <div class="gstr-stat"><span>B2B invoices</span><strong>${s.b2bCount || 0}</strong></div>
                <div class="gstr-stat"><span>B2C lines</span><strong>${(s.b2csCount || 0) + (s.b2clCount || 0)}</strong></div>
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
                        <p class="text-slate-400 text-sm mt-1">Generate JSON &amp; CSV filing files for GSTR-1, GSTR-3B and GSTR-9 from ${esc(client.name)} books</p>
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
                <div class="gstr-preview-wrap mt-4">
                    <div class="gstr-preview-title"><i class="fa-solid fa-code mr-1"></i> JSON Preview</div>
                    <pre class="gstr-preview-json">${esc(JSON.stringify(preview, null, 2))}</pre>
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
        buildReturn,
        toCsv,
        buildGstr1,
        buildGstr3b,
        buildGstr9,
        validateReturnJson,
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