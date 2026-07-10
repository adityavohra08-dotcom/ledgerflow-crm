/**
 * LedgerFlow — GSTR-1 section-wise CSV export (GST offline tool format)
 */
(function (global) {
    'use strict';

    function cell(v) {
        const s = String(v ?? '');
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    function row(arr) { return arr.map(cell).join(','); }

    function b2bCsv(portal) {
        const lines = ['GSTIN/UIN of Recipient,Receiver Name,Invoice Number,Invoice date,Invoice Value,Place Of Supply,Reverse Charge,Applicable % of Tax Rate,Invoice Type,E-Commerce GSTIN,Rate,Taxable Value,Cess Amount'];
        (portal.b2b || []).forEach(g => {
            (g.inv || []).forEach(inv => {
                (inv.itms || []).forEach(it => {
                    const d = it.itm_det || {};
                    lines.push(row([
                        g.ctin, '', inv.inum, inv.idt, inv.val, inv.pos,
                        inv.rchrg || 'N', '', inv.inv_typ || 'R', '',
                        d.rt, d.txval, d.csamt || 0
                    ]));
                });
            });
        });
        return lines.join('\r\n');
    }

    function b2csCsv(portal) {
        const lines = ['Type,Place Of Supply,Rate,Applicable % of Tax Rate,Taxable Value,Cess Amount,E-Commerce GSTIN'];
        (portal.b2cs || []).forEach(r => {
            lines.push(row(['OE', r.pos, r.rt, '', r.txval, r.csamt || 0, '']));
        });
        return lines.join('\r\n');
    }

    function hsnB2bCsv(portal) {
        const lines = ['HSN,Description,UQC,Total Quantity,Total Value,Taxable Value,Integrated Tax Amount,Central Tax Amount,State/UT Tax Amount,Cess Amount,Rate'];
        (portal.hsn?.hsn_b2b || []).forEach(h => {
            lines.push(row([
                h.hsn_sc, h.desc, h.uqc, h.qty, h.txval, h.txval,
                h.iamt || 0, h.camt || 0, h.samt || 0, h.csamt || 0, h.rt
            ]));
        });
        return lines.join('\r\n');
    }

    function hsnB2cCsv(portal) {
        const lines = ['HSN,Description,UQC,Total Quantity,Total Value,Taxable Value,Integrated Tax Amount,Central Tax Amount,State/UT Tax Amount,Cess Amount,Rate'];
        (portal.hsn?.hsn_b2c || []).forEach(h => {
            lines.push(row([
                h.hsn_sc, h.desc, h.uqc, h.qty, h.txval, h.txval,
                h.iamt || 0, h.camt || 0, h.samt || 0, h.csamt || 0, h.rt
            ]));
        });
        return lines.join('\r\n');
    }

    function docsCsv(portal) {
        const lines = ['Nature of Document,From,To,Total Number,Cancelled,Net issued'];
        (portal.doc_issue?.doc_det || []).forEach(det => {
            (det.docs || []).forEach(d => {
                lines.push(row([det.doc_typ || det.doc_num, d.from, d.to, d.totnum, d.cancel, d.net_issue]));
            });
        });
        return lines.join('\r\n');
    }

    function cdnrCsv(portal) {
        const lines = ['GSTIN/UIN of Recipient,Receiver Name,Note Number,Note Date,Note Type,Place Of Supply,Reverse Charge,Note Supply Type,Note Value,Applicable % of Tax Rate,Rate,Taxable Value,Cess Amount'];
        (portal.cdnr || []).forEach(g => {
            (g.nt || []).forEach(nt => {
                (nt.itms || []).forEach(it => {
                    const d = it.itm_det || {};
                    lines.push(row([
                        g.ctin, '', nt.nt_num, nt.nt_dt, nt.ntty, '', 'N', '',
                        nt.val, '', d.rt, d.txval, d.csamt || 0
                    ]));
                });
            });
        });
        return lines.join('\r\n');
    }

    function sectionFiles(portal) {
        const files = {};
        if (portal.b2b?.length) files['b2b,sez,de.csv'] = b2bCsv(portal);
        if (portal.b2cs?.length) files['b2cs.csv'] = b2csCsv(portal);
        if (portal.hsn?.hsn_b2b?.length) files['hsn(b2b).csv'] = hsnB2bCsv(portal);
        if (portal.hsn?.hsn_b2c?.length) files['hsn(b2c).csv'] = hsnB2cCsv(portal);
        if (portal.doc_issue?.doc_det?.length) files['docs.csv'] = docsCsv(portal);
        if (portal.cdnr?.length) files['cdnr.csv'] = cdnrCsv(portal);
        return files;
    }

    async function downloadSectionCsvZip(client, month, GstrReturnExport) {
        const G = GstrReturnExport || global.GstrReturnExport;
        if (!G || typeof JSZip === 'undefined') throw new Error('Export module or JSZip not loaded');
        const built = G.buildValidatedReturn('GSTR-1', client, { month });
        const files = sectionFiles(built.portalData);
        if (!Object.keys(files).length) throw new Error('No GSTR-1 sections to export');
        const zip = new JSZip();
        const folder = zip.folder('GSTR1') || zip;
        Object.entries(files).forEach(([name, content]) => folder.file(name, content));
        folder.file('returns_offline.json', G.portalJsonString(built.portalData));
        const blob = await zip.generateAsync({ type: 'blob' });
        const gst = G.cleanGstin(client.gstin) || 'export';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'GSTR1_sections_' + gst + '_' + month + '.zip';
        a.click();
        URL.revokeObjectURL(a.href);
        return { fileCount: Object.keys(files).length + 1, files: Object.keys(files) };
    }

    global.GstSectionCsv = {
        VERSION: '1.0.0',
        sectionFiles,
        downloadSectionCsvZip,
        b2bCsv, b2csCsv, hsnB2bCsv, docsCsv
    };
})(typeof window !== 'undefined' ? window : global);