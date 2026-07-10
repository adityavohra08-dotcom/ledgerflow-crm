/**
 * LedgerFlow — Zoho Books GST export CSV import
 */
(function (global) {
    'use strict';

    const VERSION = '1.0.0';

    function normKey(k) {
        return String(k || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    function mapRow(row) {
        const o = {};
        Object.keys(row).forEach(k => { o[normKey(k)] = row[k]; });
        return {
            invoiceNo: o.invoice_number || o.invoice_no || o.bill_number || o.number,
            date: o.invoice_date || o.date || o.bill_date,
            party: o.customer_name || o.vendor_name || o.party_name || o.contact_name,
            gstin: o.gstin || o.gst_identification_number || o.customer_gstin || o.vendor_gstin,
            taxable: Number(o.taxable_amount || o.taxable_value || o.subtotal || 0),
            cgst: Number(o.cgst || o.cgst_amount || 0),
            sgst: Number(o.sgst || o.sgst_amount || 0),
            igst: Number(o.igst || o.igst_amount || 0),
            total: Number(o.total || o.invoice_total || o.amount || 0),
            type: (o.transaction_type || o.type || '').toLowerCase()
        };
    }

    function importRows(client, rows, opts = {}) {
        let inv = 0, pur = 0;
        if (!client.invoices) client.invoices = [];
        if (!client.purchases) client.purchases = [];
        rows.forEach(raw => {
            const r = mapRow(raw);
            if (!r.invoiceNo && !r.party) return;
            const isPurchase = r.type.includes('bill') || r.type.includes('purchase') || r.type.includes('expense');
            const tax = r.cgst + r.sgst + r.igst;
            const taxable = r.taxable || Math.max(0, (r.total || tax) - tax);
            if (isPurchase && opts.importPurchases !== false) {
                client.purchases.push({
                    id: 'pur_zoho_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                    supplier: r.party || 'Vendor',
                    gstin: r.gstin || '',
                    invoiceNo: r.invoiceNo,
                    date: r.date || new Date().toISOString().slice(0, 10),
                    taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst,
                    itcEligible: true, imported: true, source: 'zoho'
                });
                pur++;
            } else if (opts.importInvoices !== false) {
                const invRow = {
                    id: 'inv_zoho_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                    number: r.invoiceNo,
                    date: r.date || new Date().toISOString().slice(0, 10),
                    partyName: r.party || 'Customer',
                    taxable, cgst: r.cgst, sgst: r.sgst, igst: r.igst,
                    grandTotal: r.total || taxable + tax,
                    status: 'Pending', imported: true, source: 'zoho'
                };
                client.invoices.push(invRow);
                global.GstrReturnsHub?.onInvoiceSaved?.(client, invRow);
                inv++;
            }
        });
        return { invoices: inv, purchases: pur };
    }

    function importFile(input, client) {
        return new Promise((resolve, reject) => {
            global.GstComplianceSuite?.parseImportRows?.(input, rows => {
                try {
                    const result = importRows(client, rows);
                    global.GstComplianceSuite?.logAudit?.('Zoho import', client.name, `${result.invoices} inv, ${result.purchases} pur`);
                    global.GstMetering?.track?.('zoho_import', client.id);
                    resolve(result);
                } catch (e) { reject(e); }
            });
        });
    }

    global.ZohoImport = { VERSION, mapRow, importRows, importFile };
})(typeof window !== 'undefined' ? window : global);