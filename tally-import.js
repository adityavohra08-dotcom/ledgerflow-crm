/**
 * LedgerFlow — Tally XML voucher import (sales/purchase register)
 */
(function (global) {
    'use strict';

    const VERSION = '1.0.0';

    function parseXmlText(xml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'text/xml');
        if (doc.querySelector('parsererror')) throw new Error('Invalid Tally XML');
        return doc;
    }

    function text(el, tag) {
        const n = el?.querySelector?.(tag) || el?.getElementsByTagName?.(tag)?.[0];
        return (n?.textContent || '').trim();
    }

    function parseTallyDate(s) {
        const t = String(s || '').trim();
        if (/^\d{8}$/.test(t)) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
        const m = t.match(/^(\d{2})-([A-Za-z]{3})-(\d{2,4})$/);
        if (m) {
            const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
            const y = m[3].length === 2 ? `20${m[3]}` : m[3];
            return `${y}-${months[m[2]] || '01'}-${m[1]}`;
        }
        return new Date().toISOString().slice(0, 10);
    }

    function extractVouchers(doc) {
        const vouchers = [...doc.querySelectorAll('VOUCHER'), ...doc.getElementsByTagName('VOUCHER')];
        return vouchers.map(v => {
            const party = text(v, 'PARTYNAME') || text(v, 'PARTYLEDGERNAME');
            const gstin = text(v, 'PARTYGSTIN') || text(v, 'GSTIN');
            const invNo = text(v, 'VOUCHERNUMBER') || text(v, 'REFERENCE');
            const date = parseTallyDate(text(v, 'DATE') || text(v, 'EFFECTIVEDATE'));
            let taxable = 0, cgst = 0, sgst = 0, igst = 0;
            const entries = [...v.querySelectorAll('ALLLEDGERENTRIES.LIST'), ...v.getElementsByTagName('LEDGERENTRIES.LIST')];
            entries.forEach(e => {
                const amt = Math.abs(Number(text(e, 'AMOUNT')) || 0);
                const ledger = (text(e, 'LEDGERNAME') || '').toLowerCase();
                if (ledger.includes('sales') || ledger.includes('purchase') || ledger.includes('taxable')) taxable += amt;
                if (ledger.includes('cgst')) cgst += amt;
                if (ledger.includes('sgst')) sgst += amt;
                if (ledger.includes('igst')) igst += amt;
            });
            const vchType = (text(v, 'VOUCHERTYPENAME') || '').toLowerCase();
            const isPurchase = vchType.includes('purchase') || vchType.includes('debit note');
            const isSales = vchType.includes('sales') || vchType.includes('credit note') || !isPurchase;
            return { party, gstin, invNo, date, taxable, cgst, sgst, igst, isSales, isPurchase, vchType };
        }).filter(r => r.invNo || r.party);
    }

    function importToClient(client, vouchers, opts = {}) {
        let inv = 0, pur = 0;
        if (!client.invoices) client.invoices = [];
        if (!client.purchases) client.purchases = [];
        vouchers.forEach(v => {
            const tax = v.cgst + v.sgst + v.igst;
            const taxable = v.taxable || Math.max(0, tax > 0 ? tax / 0.18 : 0);
            if (v.isPurchase && opts.importPurchases !== false) {
                client.purchases.push({
                    id: 'pur_tally_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                    supplier: v.party || 'Supplier',
                    gstin: v.gstin || '',
                    invoiceNo: v.invNo,
                    date: v.date,
                    taxable: round2(taxable),
                    cgst: v.cgst, sgst: v.sgst, igst: v.igst,
                    itcEligible: true,
                    imported: true,
                    source: 'tally'
                });
                pur++;
            } else if (v.isSales && opts.importInvoices !== false) {
                const invRow = {
                    id: 'inv_tally_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                    number: v.invNo,
                    date: v.date,
                    partyName: v.party || 'Customer',
                    taxable: round2(taxable),
                    cgst: v.cgst, sgst: v.sgst, igst: v.igst,
                    grandTotal: round2(taxable + tax),
                    status: 'Pending',
                    imported: true,
                    source: 'tally'
                };
                client.invoices.push(invRow);
                global.GstrReturnsHub?.onInvoiceSaved?.(client, invRow);
                inv++;
            }
        });
        return { invoices: inv, purchases: pur };
    }

    function round2(n) { return Math.round(Number(n) * 100) / 100; }

    function importFile(input, client) {
        const f = input.files?.[0];
        if (!f) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const doc = parseXmlText(e.target.result);
                    const vouchers = extractVouchers(doc);
                    const result = importToClient(client, vouchers);
                    global.GstComplianceSuite?.logAudit?.('Tally import', client.name, `${result.invoices} inv, ${result.purchases} pur`);
                    global.GstMetering?.track?.('tally_import', client.id);
                    resolve(result);
                } catch (err) { reject(err); }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(f);
            input.value = '';
        });
    }

    global.TallyImport = { VERSION, parseXmlText, extractVouchers, importToClient, importFile };
})(typeof window !== 'undefined' ? window : global);