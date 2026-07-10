/**
 * LedgerFlow — GSTR Summary PDF (GSTR-1 / GSTR-3B)
 */
(function (global) {
    'use strict';

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function fmtINR(n) {
        return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }

    function buildSummaryHtml(client, returnType, data) {
        const firm = global.appData?.firmSettings?.name || 'CA Firm';
        const period = data.meta?.period || data.fp || '';
        const s = data.summary || {};
        const rows = returnType === 'GSTR-3B' ? `
            <tr><td>Outward taxable supplies</td><td class="amt">${fmtINR(data.sup_details?.osup_det?.txval)}</td></tr>
            <tr><td>Output IGST</td><td class="amt">${fmtINR(data.sup_details?.osup_det?.iamt)}</td></tr>
            <tr><td>Output CGST</td><td class="amt">${fmtINR(data.sup_details?.osup_det?.camt)}</td></tr>
            <tr><td>Output SGST</td><td class="amt">${fmtINR(data.sup_details?.osup_det?.samt)}</td></tr>
            <tr><td>ITC available (net)</td><td class="amt">${fmtINR(s.itcAvailable)}</td></tr>
            <tr class="total"><td>Net tax payable</td><td class="amt">${fmtINR(s.totalNetPayable)}</td></tr>`
            : `
            <tr><td>Outward taxable</td><td class="amt">${fmtINR(s.outwardTaxable)}</td></tr>
            <tr><td>B2B invoices</td><td class="amt">${s.b2bCount || 0}</td></tr>
            <tr><td>CN/DN notes</td><td class="amt">${s.cdnCount || 0}</td></tr>
            <tr><td>Output CGST</td><td class="amt">${fmtINR(s.outwardCgst)}</td></tr>
            <tr><td>Output SGST</td><td class="amt">${fmtINR(s.outwardSgst)}</td></tr>
            <tr><td>Output IGST</td><td class="amt">${fmtINR(s.outwardIgst)}</td></tr>
            <tr class="total"><td>Total output tax</td><td class="amt">${fmtINR((s.outwardCgst || 0) + (s.outwardSgst || 0) + (s.outwardIgst || 0))}</td></tr>`;

        return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(returnType)} Summary</title>
<style>
body{font-family:Inter,system-ui,sans-serif;font-size:12px;color:#0f172a;margin:24px}
h1{font-size:18px;margin:0 0 4px}
.meta{color:#64748b;font-size:11px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left}
th{background:#f8fafc;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
.amt{text-align:right;font-variant-numeric:tabular-nums}
.total td{font-weight:700;background:#f0fdf4}
.footer{margin-top:24px;font-size:10px;color:#94a3b8}
</style></head><body>
<h1>${esc(returnType)} — Summary Sheet</h1>
<div class="meta">${esc(client.name)} · GSTIN ${esc(client.gstin || '—')} · ${esc(period)}<br>Prepared by ${esc(firm)} · ${new Date().toLocaleString('en-IN')}</div>
<table><thead><tr><th>Particulars</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>
<p class="footer">Generated from LedgerFlow CRM books. Verify against portal before filing.</p>
</body></html>`;
    }

    function downloadSummaryPdf(client, returnType, period) {
        const G = global.GstrReturnExport;
        if (!G) throw new Error('GSTR export module not loaded');
        const data = G.buildReturn(returnType, client, period);
        const html = buildSummaryHtml(client, returnType, data);
        const periodLabel = returnType === 'GSTR-9' ? period.fy : G.monthLabel(period.month);
        const fileName = `${client.name.replace(/\s+/g, '_')}_${returnType}_${periodLabel}_summary.pdf`;

        if (typeof html2canvas !== 'undefined' && global.jspdf?.jsPDF) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'position:fixed;left:-9999px;width:794px;background:#fff';
            wrap.innerHTML = html;
            document.body.appendChild(wrap);
            return html2canvas(wrap, { scale: 2, useCORS: true }).then(canvas => {
                const { jsPDF } = global.jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const img = canvas.toDataURL('image/png');
                const pw = pdf.internal.pageSize.getWidth();
                const ph = (canvas.height * pw) / canvas.width;
                pdf.addImage(img, 'PNG', 0, 0, pw, ph);
                pdf.save(fileName);
                wrap.remove();
                global.GstComplianceSuite?.logAudit?.('GSTR PDF', returnType, periodLabel);
                return fileName;
            });
        }

        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        w.print();
        return Promise.resolve(fileName);
    }

    function renderPdfActions(container, client) {
        if (!client) return;
        const G = global.GstrReturnExport;
        const month = client.gstrExportMeta?.month || G?.defaultMonth?.(client);
        container.innerHTML = `
            <div class="gcs-pdf-bar">
                <span class="text-sm text-slate-400">GSTR summary PDF for ${esc(client.name)}</span>
                <button type="button" class="lf-btn lf-btn--secondary text-sm" id="gstr-pdf-1"><i class="fa-solid fa-file-pdf mr-1"></i> GSTR-1 PDF</button>
                <button type="button" class="lf-btn lf-btn--secondary text-sm" id="gstr-pdf-3b"><i class="fa-solid fa-file-pdf mr-1"></i> GSTR-3B PDF</button>
            </div>`;
        container.querySelector('#gstr-pdf-1')?.addEventListener('click', () => {
            downloadSummaryPdf(client, 'GSTR-1', { month }).then(f => global.showToast?.(`Downloaded ${f}`)).catch(e => global.showToast?.(e.message, 'error'));
        });
        container.querySelector('#gstr-pdf-3b')?.addEventListener('click', () => {
            downloadSummaryPdf(client, 'GSTR-3B', { month }).then(f => global.showToast?.(`Downloaded ${f}`)).catch(e => global.showToast?.(e.message, 'error'));
        });
    }

    global.GstrSummaryPdf = { buildSummaryHtml, downloadSummaryPdf, renderPdfActions };
})(typeof window !== 'undefined' ? window : global);