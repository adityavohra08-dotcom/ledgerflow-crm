/**
 * LedgerFlow — Per-client GST usage metering (Phase 5 monetization scaffold)
 */
(function (global) {
    'use strict';

    const VERSION = '1.0.0';
    const LIMITS = { free: 50, pro: 500, enterprise: 99999 };

    function ensureMetering(appData) {
        if (!appData.gstMetering) {
            appData.gstMetering = {
                plan: 'pro',
                periodStart: new Date().toISOString().slice(0, 7),
                events: [],
                byClient: {}
            };
        }
    }

    function track(event, clientId, meta) {
        const appData = global.LedgerFlow?.getAppData?.() || global.appData;
        if (!appData) return;
        ensureMetering(appData);
        const m = appData.gstMetering;
        const mk = new Date().toISOString().slice(0, 7);
        if (m.periodStart !== mk) {
            m.periodStart = mk;
            m.events = [];
            m.byClient = {};
        }
        m.events.push({ ts: new Date().toISOString(), event, clientId, meta: meta || {} });
        if (m.events.length > 2000) m.events = m.events.slice(-2000);
        if (clientId) {
            m.byClient[clientId] = m.byClient[clientId] || { exports: 0, recons: 0, imports: 0, pdfs: 0 };
            if (event.includes('export')) m.byClient[clientId].exports++;
            if (event.includes('recon')) m.byClient[clientId].recons++;
            if (event.includes('import')) m.byClient[clientId].imports++;
            if (event.includes('pdf')) m.byClient[clientId].pdfs++;
        }
        global.saveAppData?.();
    }

    function usageSummary(appData) {
        ensureMetering(appData);
        const m = appData.gstMetering;
        const limit = LIMITS[m.plan] || LIMITS.pro;
        const total = m.events.length;
        const clients = Object.keys(m.byClient).length;
        return { plan: m.plan, period: m.periodStart, total, limit, clients, remaining: Math.max(0, limit - total), byClient: m.byClient };
    }

    function canUse(event) {
        const appData = global.LedgerFlow?.getAppData?.() || global.appData;
        if (!appData) return true;
        const s = usageSummary(appData);
        return s.total < s.limit;
    }

    function renderMeteringPanel(appData) {
        const s = usageSummary(appData);
        const pct = Math.min(100, Math.round((s.total / s.limit) * 100));
        const rows = Object.entries(s.byClient).map(([id, u]) => {
            const c = appData.clients?.[id];
            return `<tr><td class="text-xs">${c?.name || id}</td><td class="text-xs text-right">${u.exports}</td><td class="text-xs text-right">${u.recons}</td><td class="text-xs text-right">${u.imports}</td><td class="text-xs text-right">${u.pdfs}</td></tr>`;
        }).join('') || '<tr><td colspan="5" class="text-slate-500 py-4">No usage this month</td></tr>';
        return `<div class="gcs-panel">
            <div class="flex justify-between items-center mb-4">
                <div><div class="font-semibold">Usage Metering</div><p class="text-xs text-slate-500">Plan: <strong class="text-teal-400">${s.plan}</strong> · ${s.period}</p></div>
                <div class="text-right text-sm"><strong>${s.total}</strong> / ${s.limit} actions</div>
            </div>
            <div class="h-2 bg-slate-800 rounded-full overflow-hidden mb-4"><div class="h-full bg-teal-500" style="width:${pct}%"></div></div>
            <table class="data-table w-full text-sm"><thead><tr><th>Client</th><th>Exports</th><th>Recons</th><th>Imports</th><th>PDFs</th></tr></thead><tbody>${rows}</tbody></table>
        </div>`;
    }

    global.GstMetering = { VERSION, track, usageSummary, canUse, renderMeteringPanel, LIMITS };
})(typeof window !== 'undefined' ? window : global);