/**
 * LedgerFlow — GSP filing scaffold (ARN workflow, no live GSTN API)
 */
(function (global) {
    'use strict';

    const VERSION = '1.0.0';

    function generateArn(returnType, gstin, period) {
        const ts = Date.now().toString(36).toUpperCase();
        const prefix = returnType.replace(/[^A-Z0-9]/gi, '').slice(0, 3);
        return `AA${prefix}${gstin?.slice(-4) || '0000'}${period?.replace(/\D/g, '').slice(-4) || ''}${ts}`.slice(0, 20);
    }

    function markFiled(client, returnType, periodLabel, opts = {}) {
        const G = global.GstrReturnExport;
        if (!G) throw new Error('GSTR export not loaded');
        const row = G.upsertFilingRecord(client, returnType, periodLabel, 'Filed');
        row.filedOn = new Date().toISOString().slice(0, 10);
        row.arn = opts.arn || generateArn(returnType, client.gstin, periodLabel);
        row.status = opts.acknowledged ? 'Acknowledged' : 'Filed';
        row.filedVia = opts.via || 'offline_tool';
        if (client.gstrStale && periodLabel.includes('-')) {
            const mk = periodLabel.length >= 7 ? periodLabel.slice(0, 7) : null;
            if (mk && client.gstrStale[mk]) {
                if (returnType === 'GSTR-1') client.gstrStale[mk].gstr1 = false;
                if (returnType === 'GSTR-3B') client.gstrStale[mk].gstr3b = false;
            }
        }
        global.GstComplianceSuite?.logAudit?.('GSTR filed', returnType, `${periodLabel} ARN ${row.arn}`);
        global.GstMetering?.track?.('gsp_filed', client.id, { returnType });
        global.saveAppData?.();
        return row;
    }

    function renderFilingActions(container, client) {
        const G = global.GstrReturnExport;
        const month = client.gstrExportMeta?.month || G?.defaultMonth?.(client);
        const periodLabel = G?.monthLabel?.(month);
        container.innerHTML = `<div class="gcs-panel">
            <p class="text-sm text-slate-400 mb-3">Record filing after uploading JSON to GST portal / offline tool. Live GSP API integration pending.</p>
            <div class="gcs-actions">
                <button type="button" id="gsp-file-g1" class="lf-btn lf-btn--secondary text-sm">Mark GSTR-1 Filed</button>
                <button type="button" id="gsp-file-3b" class="lf-btn lf-btn--secondary text-sm">Mark GSTR-3B Filed</button>
                <button type="button" id="gsp-ack-g1" class="lf-btn lf-btn--ghost text-sm">Acknowledge GSTR-1</button>
            </div>
            <div id="gsp-arn-out" class="text-xs text-emerald-400 mt-3 hidden"></div>
        </div>`;
        container.querySelector('#gsp-file-g1')?.addEventListener('click', () => {
            const row = markFiled(client, 'GSTR-1', periodLabel);
            const el = container.querySelector('#gsp-arn-out');
            el.classList.remove('hidden');
            el.textContent = `GSTR-1 filed · ARN ${row.arn}`;
            global.showToast?.('GSTR-1 marked as filed');
        });
        container.querySelector('#gsp-file-3b')?.addEventListener('click', () => {
            const row = markFiled(client, 'GSTR-3B', periodLabel);
            const el = container.querySelector('#gsp-arn-out');
            el.classList.remove('hidden');
            el.textContent = `GSTR-3B filed · ARN ${row.arn}`;
            global.showToast?.('GSTR-3B marked as filed');
        });
        container.querySelector('#gsp-ack-g1')?.addEventListener('click', () => {
            markFiled(client, 'GSTR-1', periodLabel, { acknowledged: true });
            global.showToast?.('GSTR-1 acknowledged');
        });
    }

    global.GstrFilingGsp = { VERSION, generateArn, markFiled, renderFilingActions };
})(typeof window !== 'undefined' ? window : global);