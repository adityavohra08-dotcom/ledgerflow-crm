/**
 * LedgerFlow — GSTR-1A amendment before/after diff
 */
(function (global) {
    'use strict';

    const VERSION = '1.0.0';

    function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
    function keyInv(inv) {
        return `${inv.inum || inv.number || ''}|${inv.idt || inv.date || ''}`;
    }

    function flattenGstr1(data) {
        const rows = [];
        (data.b2b || []).forEach(g => {
            (g.inv || []).forEach(inv => {
                rows.push({
                    section: 'B2B', party: g.ctin, inum: inv.inum, idt: inv.idt,
                    val: num(inv.val), tax: (inv.itms || []).reduce((s, it) => {
                        const d = it.itm_det || {};
                        return s + num(d.iamt) + num(d.camt) + num(d.samt);
                    }, 0)
                });
            });
        });
        (data.b2cs || []).forEach((r, i) => {
            rows.push({ section: 'B2CS', party: r.pos, inum: `B2CS-${i}`, idt: '', val: num(r.txval), tax: num(r.iamt) + num(r.camt) + num(r.samt) });
        });
        return rows;
    }

    function diffReturns(before, after) {
        const bMap = new Map(flattenGstr1(before).map(r => [keyInv(r), r]));
        const aMap = new Map(flattenGstr1(after).map(r => [keyInv(r), r]));
        const added = [], removed = [], changed = [];
        aMap.forEach((a, k) => {
            const b = bMap.get(k);
            if (!b) added.push(a);
            else if (Math.abs(a.val - b.val) > 0.01 || Math.abs(a.tax - b.tax) > 0.01) {
                changed.push({ before: b, after: a, deltaVal: a.val - b.val, deltaTax: a.tax - b.tax });
            }
        });
        bMap.forEach((b, k) => { if (!aMap.has(k)) removed.push(b); });
        return { added, removed, changed, summary: {
            added: added.length, removed: removed.length, changed: changed.length,
            netValDelta: changed.reduce((s, c) => s + c.deltaVal, 0)
        }};
    }

    function renderDiffHtml(diff, client, month) {
        const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const row = r => `<tr><td>${esc(r.section)}</td><td>${esc(r.inum)}</td><td>${esc(r.idt)}</td><td class="amt">₹${num(r.val).toLocaleString('en-IN')}</td></tr>`;
        return `<div class="gcs-amend-diff">
            <p class="text-sm text-slate-400 mb-3">${esc(client?.name)} · ${esc(month)} · +${diff.summary.added} / −${diff.summary.removed} / ~${diff.summary.changed} changed</p>
            ${diff.changed.length ? `<div class="mb-4"><div class="gcs-subtitle">Changed invoices</div>
                <table class="data-table w-full text-xs"><thead><tr><th>Invoice</th><th>Before ₹</th><th>After ₹</th><th>Δ</th></tr></thead>
                <tbody>${diff.changed.map(c => `<tr><td>${esc(c.after.inum)}</td><td>${num(c.before.val).toLocaleString('en-IN')}</td><td>${num(c.after.val).toLocaleString('en-IN')}</td><td class="${c.deltaVal >= 0 ? 'text-emerald-400' : 'text-red-400'}">${c.deltaVal >= 0 ? '+' : ''}${c.deltaVal.toLocaleString('en-IN')}</td></tr>`).join('')}</tbody></table></div>` : ''}
            ${diff.added.length ? `<div class="mb-4"><div class="gcs-subtitle">Added (${diff.added.length})</div><table class="data-table w-full text-xs"><thead><tr><th>Section</th><th>Invoice</th><th>Date</th><th>Value</th></tr></thead><tbody>${diff.added.map(row).join('')}</tbody></table></div>` : ''}
            ${diff.removed.length ? `<div><div class="gcs-subtitle">Removed (${diff.removed.length})</div><table class="data-table w-full text-xs"><thead><tr><th>Section</th><th>Invoice</th><th>Date</th><th>Value</th></tr></thead><tbody>${diff.removed.map(row).join('')}</tbody></table></div>` : ''}
        </div>`;
    }

    function runAmendmentDiff(client, month) {
        const G = global.GstrReturnExport;
        if (!G) throw new Error('GSTR export not loaded');
        const current = G.buildGstr1(client, month);
        const snapshot = client.gstr1Snapshots?.[month];
        if (!snapshot) {
            client.gstr1Snapshots = client.gstr1Snapshots || {};
            client.gstr1Snapshots[month] = JSON.parse(JSON.stringify(current));
            return { diff: null, message: 'Baseline snapshot saved — amend books and run again to see diff' };
        }
        const diff = diffReturns(snapshot, current);
        return { diff, message: null };
    }

    global.GstrAmendmentDiff = { VERSION, diffReturns, flattenGstr1, renderDiffHtml, runAmendmentDiff };
})(typeof window !== 'undefined' ? window : global);