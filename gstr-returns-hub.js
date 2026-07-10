/**
 * LedgerFlow — GST Returns Hub (status matrix, GSTR-2B recon, bulk export)
 */
(function (global) {
    'use strict';

    const G = () => global.GstrReturnExport;
    const TABS = ['overview', 'recon', 'bulk'];

    function getAppData() {
        return global.LedgerFlow?.getAppData?.() || global.appData || null;
    }

    function ensureExportReady() {
        const exp = G();
        if (!exp?.buildReturn) {
            throw new Error('GSTR export module not loaded. Press Ctrl+F5 to hard-refresh.');
        }
        return exp;
    }

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function fmtINR(n) {
        return '₹' + num(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    }

    function uid(p) {
        return p + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    }

    function normInvNo(s) {
        return String(s || '').replace(/\s/g, '').toUpperCase();
    }

    function ensureHubMeta(appData) {
        if (!appData.firmGstrHub) {
            appData.firmGstrHub = {
                period: G()?.defaultMonth?.(Object.values(appData.clients || {})[0]) || new Date().toISOString().slice(0, 7),
                tab: 'overview',
                selectedClients: [],
                bulkReturns: ['GSTR-1', 'GSTR-3B']
            };
        }
        if (!appData.firmGstrHub.bulkReturns) appData.firmGstrHub.bulkReturns = ['GSTR-1', 'GSTR-3B'];
    }

    function dueDatesForPeriod(monthStr) {
        if (!monthStr || monthStr.length < 7) return { gstr1: null, gstr3b: null };
        const [y, m] = monthStr.split('-').map(Number);
        const nextM = m === 12 ? 1 : m + 1;
        const nextY = m === 12 ? y + 1 : y;
        const g1 = new Date(nextY, nextM - 1, 11);
        const g3 = new Date(nextY, nextM - 1, 20);
        const now = new Date();
        const daysLeft = d => Math.ceil((d - now) / 86400000);
        return {
            gstr1: { date: g1, daysLeft: daysLeft(g1), label: g1.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) },
            gstr3b: { date: g3, daysLeft: daysLeft(g3), label: g3.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }
        };
    }

    function filingRow(client, returnType, periodLabel) {
        return (client.gstrFilings || []).find(f => f.return === returnType && f.period === periodLabel);
    }

    function returnStatus(client, returnType, monthStr) {
        const periodLabel = G().monthLabel(monthStr);
        const row = filingRow(client, returnType, periodLabel);
        const stale = client.gstrStale?.[monthStr];
        if (row?.status === 'Acknowledged' || (row?.status === 'Filed' && row?.arn)) return { code: 'Acknowledged', cls: 'grh-status--ack' };
        if (row?.status === 'Filed') return { code: 'Filed', cls: 'grh-status--filed' };
        if (row?.status === 'Ready') return { code: 'Ready', cls: 'grh-status--ready' };
        if (row?.status === 'Draft' || stale?.gstr1 && returnType === 'GSTR-1' || stale?.gstr3b && returnType === 'GSTR-3B') {
            return { code: 'Draft', cls: 'grh-status--draft' };
        }
        const invs = G().filterInvoices(client, { month: monthStr });
        const pur = G().filterPurchases(client, { month: monthStr });
        if (returnType === 'GSTR-1' && invs.length) return { code: 'Draft', cls: 'grh-status--draft' };
        if (returnType === 'GSTR-3B' && (invs.length || pur.length)) return { code: 'Draft', cls: 'grh-status--draft' };
        return { code: 'Not Started', cls: 'grh-status--none' };
    }

    function reconStats(client) {
        const rows = client.gstr2bRecon || [];
        const matched = rows.filter(r => r.match === 'Matched').length;
        const total = rows.length;
        const pct = total ? Math.round((matched / total) * 100) : 0;
        const booksItc = rows.reduce((s, r) => s + num(r.booksItc), 0);
        const g2Itc = rows.reduce((s, r) => s + num(r.gstr2bItc), 0);
        const variance = Math.abs(booksItc - g2Itc);
        return { matched, total, pct, booksItc, g2Itc, variance, mismatches: rows.filter(r => r.match !== 'Matched') };
    }

    function parseGstr2bJson(raw) {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        const entries = [];
        const pushInv = (ctin, inv, section) => {
            let igst = num(inv.iamt ?? inv.igst);
            let cgst = num(inv.camt ?? inv.cgst);
            let sgst = num(inv.samt ?? inv.sgst);
            let taxable = num(inv.txval ?? inv.taxable);
            (inv.itms || []).forEach(it => {
                const d = it.itm_det || it;
                igst += num(d.iamt ?? d.igst);
                cgst += num(d.camt ?? d.cgst);
                sgst += num(d.samt ?? d.sgst);
                taxable += num(d.txval ?? d.taxable);
            });
            entries.push({
                id: uid('g2b'),
                section,
                supplierGstin: G().cleanGstin(ctin),
                invoiceNo: inv.inum || inv.invoice_number || '',
                date: inv.idt || inv.invoice_date || '',
                taxable: taxable || num(inv.txval ?? inv.taxable),
                igst, cgst, sgst,
                itc: round2(igst + cgst + sgst),
                val: num(inv.val ?? inv.invoice_value)
            });
        };
        (data.b2b || []).forEach(g => (g.inv || g.invoices || []).forEach(inv => pushInv(g.ctin || g.gstin, inv, 'B2B')));
        (data.cdn || []).forEach(g => (g.nt || []).forEach(inv => pushInv(g.ctin, inv, 'CDN')));
        if (data.docdata?.b2b) {
            data.docdata.b2b.forEach(g => (g.inv || []).forEach(inv => pushInv(g.ctin, inv, 'B2B')));
        }
        return {
            gstin: G().cleanGstin(data.gstin),
            fp: data.fp || data.ret_period || '',
            importedAt: new Date().toISOString(),
            entries,
            raw: data
        };
    }

    function run2bReconciliation(client, monthStr) {
        const purchases = G().filterPurchases(client, { month: monthStr });
        const entries = client.gstr2bImport?.entries || [];
        const used2b = new Set();
        const rows = [];

        purchases.forEach(p => {
            const pGstin = G().cleanGstin(p.gstin);
            const pInv = normInvNo(p.invoiceNo);
            const booksItc = num(p.cgst) + num(p.sgst) + num(p.igst);
            let best = null;
            let bestScore = 0;

            entries.forEach((e, idx) => {
                if (used2b.has(idx)) return;
                let score = 0;
                if (pGstin && e.supplierGstin && pGstin === e.supplierGstin) score += 40;
                if (pInv && normInvNo(e.invoiceNo) === pInv) score += 45;
                const itcDiff = Math.abs(booksItc - e.itc);
                if (itcDiff <= 1) score += 25;
                else if (itcDiff <= 100) score += 10;
                if (score > bestScore) { bestScore = score; best = { e, idx }; }
            });

            if (best && bestScore >= 70) {
                used2b.add(best.idx);
                const itcDiff = Math.abs(booksItc - best.e.itc);
                rows.push({
                    id: uid('g2'),
                    supplier: p.supplier || best.e.supplierGstin,
                    invoice: p.invoiceNo || best.e.invoiceNo,
                    booksItc: round2(booksItc),
                    gstr2bItc: round2(best.e.itc),
                    match: itcDiff <= 1 ? 'Matched' : 'Mismatch',
                    score: bestScore
                });
            } else {
                rows.push({
                    id: uid('g2'),
                    supplier: p.supplier,
                    invoice: p.invoiceNo,
                    booksItc: round2(booksItc),
                    gstr2bItc: 0,
                    match: 'Missing in 2B',
                    score: 0
                });
            }
        });

        entries.forEach((e, idx) => {
            if (used2b.has(idx)) return;
            rows.push({
                id: uid('g2'),
                supplier: e.supplierGstin,
                invoice: e.invoiceNo,
                booksItc: 0,
                gstr2bItc: round2(e.itc),
                match: 'Missing in Books',
                score: 0
            });
        });

        client.gstr2bRecon = rows;
        return rows;
    }

    function round2(n) {
        return Math.round(num(n) * 100) / 100;
    }

    function liabilityVariance(client, monthStr) {
        try {
            const g3 = G().buildGstr3b(client, monthStr);
            const payable = g3.summary?.totalNetPayable || 0;
            const out = g3.summary?.outwardTax || 0;
            const itc = g3.summary?.itcAvailable || 0;
            const booksPayable = Math.max(0, out - itc);
            const pct = booksPayable ? Math.abs((payable - booksPayable) / booksPayable) * 100 : 0;
            return { payable, booksPayable, pct: round2(pct), alert: pct > 5 };
        } catch (e) {
            return { payable: 0, booksPayable: 0, pct: 0, alert: false };
        }
    }

    function attentionItems(appData, monthStr) {
        const items = [];
        Object.entries(appData.clients || {}).forEach(([id, c]) => {
            const recon = reconStats(c);
            if (recon.total && recon.pct < 100) {
                items.push({ clientId: id, name: c.name, type: '2B', msg: `${recon.total - recon.matched} ITC line(s) unmatched`, severity: 'high' });
            }
            const lv = liabilityVariance(c, monthStr);
            if (lv.alert) items.push({ clientId: id, name: c.name, type: '3B', msg: `GSTR-3B variance ${lv.pct}% vs books`, severity: 'med' });
            const stale = c.gstrStale?.[monthStr];
            if (stale?.gstr1 || stale?.gstr3b) {
                items.push({ clientId: id, name: c.name, type: 'Stale', msg: 'Books changed — regenerate returns', severity: 'med' });
            }
        });
        return items;
    }

    function clientList(appData) {
        const role = global.isFirmUser?.() ? 'firm' : global.isTeamUser?.() ? 'team' : null;
        let entries = Object.entries(appData.clients || {});
        if (role === 'team' && typeof global.teamCanAccessClient === 'function') {
            entries = entries.filter(([id]) => global.teamCanAccessClient(id));
        }
        return entries.map(([id, c]) => ({ id, client: c }));
    }

    function statusBadge(st) {
        return `<span class="grh-status ${st.cls}">${esc(st.code)}</span>`;
    }

    function dueBadge(days) {
        if (days == null) return '';
        if (days < 0) return `<span class="grh-due grh-due--over">${Math.abs(days)}d overdue</span>`;
        if (days <= 3) return `<span class="grh-due grh-due--urgent">${days}d left</span>`;
        if (days <= 7) return `<span class="grh-due grh-due--soon">${days}d left</span>`;
        return `<span class="grh-due">${days}d left</span>`;
    }

    function renderOverview(container, appData, hub) {
        const monthStr = hub.period;
        const periodLabel = G().monthLabel(monthStr);
        const dues = dueDatesForPeriod(monthStr);
        const clients = clientList(appData);
        const attention = attentionItems(appData, monthStr);

        const rows = clients.map(({ id, client }) => {
            const s1 = returnStatus(client, 'GSTR-1', monthStr);
            const s3 = returnStatus(client, 'GSTR-3B', monthStr);
            const recon = reconStats(client);
            const invCount = G().filterInvoices(client, { month: monthStr }).length;
            return `
                <tr class="grh-row" data-client-id="${esc(id)}">
                    <td><input type="checkbox" class="grh-client-cb" value="${esc(id)}"${hub.selectedClients.includes(id) ? ' checked' : ''}></td>
                    <td>
                        <div class="font-medium text-sm">${esc(client.name)}</div>
                        <div class="text-xs text-slate-500 font-mono">${esc(client.gstin || '—')}</div>
                    </td>
                    <td>${statusBadge(s1)}</td>
                    <td>${statusBadge(s3)}</td>
                    <td>
                        ${recon.total ? `<span class="${recon.pct === 100 ? 'text-emerald-400' : 'text-amber-400'}">${recon.pct}%</span> <span class="text-xs text-slate-500">(${recon.matched}/${recon.total})</span>` : '<span class="text-slate-500">—</span>'}
                    </td>
                    <td class="text-sm">${invCount}</td>
                    <td>${dueBadge(dues.gstr1?.daysLeft)}</td>
                    <td>${dueBadge(dues.gstr3b?.daysLeft)}</td>
                    <td class="grh-row-actions">
                        <button type="button" class="grh-mini-btn" data-open-client="${esc(id)}">Open</button>
                        <button type="button" class="grh-mini-btn" data-gen-client="${esc(id)}">JSON</button>
                    </td>
                </tr>`;
        }).join('');

        return `
            <div class="grh-panel">
                ${attention.length ? `
                <div class="grh-attention mb-4">
                    <div class="grh-panel-title"><i class="fa-solid fa-triangle-exclamation text-amber-400 mr-1"></i> Needs attention (${attention.length})</div>
                    <div class="grh-attention-list">
                        ${attention.slice(0, 6).map(a => `
                            <div class="grh-attention-item grh-attention--${a.severity}">
                                <span class="font-medium">${esc(a.name)}</span>
                                <span class="text-slate-400">${esc(a.msg)}</span>
                                <button type="button" class="grh-mini-btn" data-open-client="${esc(a.clientId)}">View</button>
                            </div>`).join('')}
                    </div>
                </div>` : ''}
                <div class="grh-deadline-bar mb-4">
                    <div class="grh-deadline"><span>GSTR-1 due</span><strong>${esc(dues.gstr1?.label || '—')}</strong>${dueBadge(dues.gstr1?.daysLeft)}</div>
                    <div class="grh-deadline"><span>GSTR-3B due</span><strong>${esc(dues.gstr3b?.label || '—')}</strong>${dueBadge(dues.gstr3b?.daysLeft)}</div>
                    <div class="grh-deadline"><span>Period</span><strong>${esc(periodLabel)}</strong></div>
                </div>
                <div class="grh-table-wrap">
                    <table class="grh-table">
                        <thead>
                            <tr>
                                <th><input type="checkbox" id="grh-select-all"></th>
                                <th>Client</th>
                                <th>GSTR-1</th>
                                <th>GSTR-3B</th>
                                <th>2B Match</th>
                                <th>Invoices</th>
                                <th>GSTR-1 Due</th>
                                <th>3B Due</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>${rows || '<tr><td colspan="9" class="text-center text-slate-500 py-8">No clients</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }

    function renderRecon(container, appData, hub) {
        const client = global.getCurrentClient?.();
        if (!client) {
            return `<div class="grh-alert">Select a client from the switcher to run GSTR-2B reconciliation.</div>`;
        }
        if (typeof global.LedgerFlowCapabilityModules !== 'undefined') {
            global.LedgerFlowCapabilityModules.ensureCapabilityData?.(client);
        }
        const monthStr = hub.period;
        const stats = reconStats(client);
        const rows = client.gstr2bRecon || [];
        const imported = client.gstr2bImport;

        return `
            <div class="grh-panel">
                <div class="flex flex-wrap gap-3 items-end mb-4">
                    <div>
                        <div class="text-xs text-slate-500 uppercase font-semibold">Client</div>
                        <div class="font-medium">${esc(client.name)} <span class="text-xs font-mono text-slate-400">${esc(client.gstin)}</span></div>
                    </div>
                    <label class="gstr-field">
                        <span>Period</span>
                        <input type="month" id="grh-recon-month" class="gstr-input" value="${esc(monthStr)}">
                    </label>
                    <input type="file" id="grh-2b-file" accept=".json,application/json" class="hidden">
                    <button type="button" id="grh-2b-import" class="lf-btn lf-btn--primary text-sm"><i class="fa-solid fa-upload mr-1"></i> Import GSTR-2B JSON</button>
                    <button type="button" id="grh-2b-sample" class="lf-btn lf-btn--secondary text-sm"><i class="fa-solid fa-flask mr-1"></i> Load Sample</button>
                    <button type="button" id="grh-2b-run" class="lf-btn lf-btn--secondary text-sm"><i class="fa-solid fa-code-compare mr-1"></i> Run Match</button>
                </div>
                ${imported ? `<p class="text-xs text-slate-500 mb-3">2B imported ${esc(imported.importedAt?.slice(0, 16)?.replace('T', ' '))} · ${imported.entries?.length || 0} invoices · fp ${esc(imported.fp)}</p>` : ''}
                <div class="gstr-stats mb-4">
                    <div class="gstr-stat"><span>Matched</span><strong class="text-emerald-400">${stats.matched}/${stats.total}</strong></div>
                    <div class="gstr-stat"><span>Books ITC</span><strong>${fmtINR(stats.booksItc)}</strong></div>
                    <div class="gstr-stat"><span>2B ITC</span><strong>${fmtINR(stats.g2Itc)}</strong></div>
                    <div class="gstr-stat"><span>Variance</span><strong class="${stats.variance > 500 ? 'text-amber-400' : ''}">${fmtINR(stats.variance)}</strong></div>
                </div>
                <div class="grh-tri-view">
                    <div class="grh-tri-col">
                        <div class="grh-panel-title">Books (Purchases)</div>
                        <div class="grh-tri-list">
                            ${G().filterPurchases(client, { month: monthStr }).map(p => `
                                <div class="grh-tri-item">
                                    <div class="text-sm font-medium">${esc(p.supplier)}</div>
                                    <div class="text-xs text-slate-500">${esc(p.invoiceNo)} · ${esc(p.date)}</div>
                                    <div class="text-xs text-teal-400">ITC ${fmtINR(num(p.cgst) + num(p.sgst) + num(p.igst))}</div>
                                </div>`).join('') || '<p class="text-sm text-slate-500">No purchases this period</p>'}
                        </div>
                    </div>
                    <div class="grh-tri-col grh-tri-col--mid">
                        <div class="grh-panel-title">Match results</div>
                        <div class="grh-tri-list grh-tri-list--scroll">
                            ${rows.length ? rows.map(r => `
                                <div class="grh-tri-item grh-tri-item--${r.match === 'Matched' ? 'ok' : 'warn'}">
                                    <div class="flex justify-between">
                                        <span class="text-sm font-medium">${esc(r.supplier)}</span>
                                        <span class="grh-match-tag grh-match-tag--${esc(r.match).replace(/\s/g, '')}">${esc(r.match)}</span>
                                    </div>
                                    <div class="text-xs text-slate-500">${esc(r.invoice)}</div>
                                    <div class="text-xs">Books ${fmtINR(r.booksItc)} · 2B ${fmtINR(r.gstr2bItc)}</div>
                                </div>`).join('') : '<p class="text-sm text-slate-500 py-4">Import GSTR-2B JSON and click Run Match</p>'}
                        </div>
                    </div>
                    <div class="grh-tri-col">
                        <div class="grh-panel-title">GSTR-2B import</div>
                        <div class="grh-tri-list">
                            ${(imported?.entries || []).slice(0, 12).map(e => `
                                <div class="grh-tri-item">
                                    <div class="text-sm font-mono">${esc(e.supplierGstin)}</div>
                                    <div class="text-xs text-slate-500">${esc(e.invoiceNo)}</div>
                                    <div class="text-xs text-teal-400">ITC ${fmtINR(e.itc)}</div>
                                </div>`).join('') || '<p class="text-sm text-slate-500">No 2B data imported</p>'}
                            ${(imported?.entries?.length || 0) > 12 ? `<p class="text-xs text-slate-500">+${imported.entries.length - 12} more</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>`;
    }

    function renderBulk(container, appData, hub) {
        const selected = hub.selectedClients.length;
        const clients = clientList(appData);
        return `
            <div class="grh-panel">
                <p class="text-sm text-slate-400 mb-4">Generate validated JSON files for multiple clients and download as a ZIP archive.</p>
                <div class="gstr-toolbar mb-4">
                    <label class="gstr-field"><span>Tax period</span>
                        <input type="month" id="grh-bulk-month" class="gstr-input" value="${esc(hub.period)}"></label>
                    <label class="gstr-field"><span>Returns</span>
                        <select id="grh-bulk-types" class="gstr-input" multiple size="2">
                            <option value="GSTR-1"${hub.bulkReturns.includes('GSTR-1') ? ' selected' : ''}>GSTR-1</option>
                            <option value="GSTR-3B"${hub.bulkReturns.includes('GSTR-3B') ? ' selected' : ''}>GSTR-3B</option>
                        </select></label>
                    <button type="button" id="grh-bulk-all" class="lf-btn lf-btn--secondary text-sm">Select all clients</button>
                    <button type="button" id="grh-bulk-none" class="lf-btn lf-btn--secondary text-sm">Clear</button>
                </div>
                <p class="text-sm mb-2"><strong>${selected}</strong> of ${clients.length} clients selected</p>
                <button type="button" id="grh-bulk-zip" class="lf-btn lf-btn--primary text-sm"${selected ? '' : ' disabled'}>
                    <i class="fa-solid fa-file-zipper mr-1"></i> Download ZIP (${selected} clients)
                </button>
                <div id="grh-bulk-log" class="grh-bulk-log mt-4 hidden"></div>
            </div>`;
    }

    function renderGstrReturnsHub(container) {
        try {
            if (!global.isFirmUser?.() && !global.isTeamUser?.()) {
                container.innerHTML = '<p class="text-slate-400">GST Returns Hub is available in Admin / Team portal only.</p>';
                return;
            }
            ensureExportReady();
            const appData = getAppData();
            if (!appData?.clients || !Object.keys(appData.clients).length) {
                container.innerHTML = '<div class="grh-alert">No client data loaded. Log in as Admin and wait for sync to finish, then refresh.</div>';
                return;
            }
            ensureHubMeta(appData);
        const hub = appData.firmGstrHub;
        if (!hub.selectedClients.length) {
            hub.selectedClients = clientList(appData).map(c => c.id);
        }

        container.innerHTML = `
            <div class="grh-tool">
                <div class="flex flex-wrap items-start justify-between gap-4 mb-4">
                    <div>
                        <h2 class="text-2xl font-semibold tracking-tight">GST Returns Hub</h2>
                        <p class="text-slate-400 text-sm mt-1">Filing status, GSTR-2B reconciliation &amp; bulk JSON export across clients</p>
                    </div>
                    <div class="gstr-toolbar" style="padding:0.5rem 0.75rem;border:none;background:transparent">
                        <label class="gstr-field"><span>Period</span>
                            <input type="month" id="grh-period" class="gstr-input" value="${esc(hub.period)}"></label>
                        <button type="button" id="grh-refresh" class="lf-btn lf-btn--secondary text-sm"><i class="fa-solid fa-rotate mr-1"></i> Refresh</button>
                    </div>
                </div>
                <div class="grh-tabs">
                    ${TABS.map(t => `<button type="button" class="grh-tab${hub.tab === t ? ' grh-tab--active' : ''}" data-tab="${t}">${t === 'overview' ? 'Overview' : t === 'recon' ? '2B Reconciliation' : 'Bulk Export'}</button>`).join('')}
                </div>
                <div id="grh-tab-body" class="mt-4">
                    ${hub.tab === 'overview' ? renderOverview(container, appData, hub) : hub.tab === 'recon' ? renderRecon(container, appData, hub) : renderBulk(container, appData, hub)}
                </div>
            </div>`;

            bindHubEvents(container, appData, hub);
        } catch (err) {
            container.innerHTML = `<div class="grh-alert gstr-alert--error"><strong>GST Returns Hub error</strong><p class="mt-2">${esc(err.message)}</p><button type="button" class="lf-btn lf-btn--secondary text-sm mt-3" onclick="location.reload()">Reload page</button></div>`;
            console.error('[GSTR Hub]', err);
        }
    }

    async function bulkDownloadZip(appData, hub) {
        if (typeof JSZip === 'undefined') throw new Error('JSZip not loaded');
        const zip = new JSZip();
        const monthStr = hub.period;
        const types = hub.bulkReturns.length ? hub.bulkReturns : ['GSTR-1', 'GSTR-3B'];
        const log = [];
        let count = 0;

        hub.selectedClients.forEach(cid => {
            const client = appData.clients[cid];
            if (!client) return;
            types.forEach(rt => {
                try {
                    const { portalData, data, validation, fileName, periodLabel } = G().buildValidatedReturn(rt, client, { month: monthStr, fy: G().defaultFy?.(client) });
                    zip.file(fileName, JSON.stringify(portalData || data, null, 2));
                    G().upsertFilingRecord(client, rt, periodLabel, 'Ready');
                    G().clearPeriodStale(client, monthStr, rt);
                    log.push(`✓ ${client.name} — ${fileName}`);
                    count++;
                    if (validation.warnings.length) log.push(`  ⚠ ${validation.warnings.length} warning(s)`);
                } catch (e) {
                    log.push(`✗ ${client.name} — ${rt}: ${e.message}`);
                }
            });
        });

        if (!count) throw new Error('No files generated — check validation errors');
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `gstr-bulk_${monthStr}_${count}files.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
        global.saveAppData?.();
        return log;
    }

    function bindHubEvents(container, appData, hub) {
        container.querySelectorAll('.grh-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                hub.tab = btn.dataset.tab;
                global.saveAppData?.();
                refreshHub();
            });
        });

        container.querySelector('#grh-period')?.addEventListener('change', e => {
            hub.period = e.target.value;
            global.saveAppData?.();
            refreshHub();
        });

        container.querySelector('#grh-refresh')?.addEventListener('click', refreshHub);

        container.querySelector('#grh-select-all')?.addEventListener('change', e => {
            const checked = e.target.checked;
            hub.selectedClients = checked ? clientList(appData).map(c => c.id) : [];
            container.querySelectorAll('.grh-client-cb').forEach(cb => { cb.checked = checked; });
            global.saveAppData?.();
        });

        container.querySelectorAll('.grh-client-cb').forEach(cb => {
            cb.addEventListener('change', () => {
                hub.selectedClients = [...container.querySelectorAll('.grh-client-cb:checked')].map(c => c.value);
                global.saveAppData?.();
            });
        });

        container.querySelectorAll('[data-open-client]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.openClient;
                if (typeof global.switchClient === 'function') global.switchClient(id);
                else if (global.LedgerFlow?.switchClient) global.LedgerFlow.switchClient(id);
                hub.tab = 'recon';
                global.saveAppData?.();
                refreshHub();
            });
        });

        container.querySelectorAll('[data-gen-client]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.genClient;
                const client = appData.clients[id];
                if (!client) return;
                try {
                    G().downloadValidatedJson('GSTR-1', client, { month: hub.period });
                    G().downloadValidatedJson('GSTR-3B', client, { month: hub.period });
                    global.saveAppData?.();
                    global.showToast?.(`JSON generated for ${client.name}`);
                } catch (e) {
                    global.showToast?.(e.message, 'error');
                }
            });
        });

        container.querySelector('#grh-2b-import')?.addEventListener('click', () => container.querySelector('#grh-2b-file')?.click());
        container.querySelector('#grh-2b-file')?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const client = global.getCurrentClient?.();
            if (!client) return;
            const reader = new FileReader();
            reader.onload = ev => {
                try {
                    client.gstr2bImport = parseGstr2bJson(ev.target.result);
                    run2bReconciliation(client, hub.period);
                    global.saveAppData?.();
                    global.showToast?.(`Imported ${client.gstr2bImport.entries.length} 2B invoices`);
                    refreshHub();
                } catch (err) {
                    global.showToast?.('Invalid GSTR-2B JSON: ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        });

        container.querySelector('#grh-2b-sample')?.addEventListener('click', async () => {
            const client = global.getCurrentClient?.();
            if (!client) { global.showToast?.('Select a client first', 'error'); return; }
            try {
                const res = await fetch('samples/gstr-2b-sample.json');
                if (!res.ok) throw new Error('Sample not found');
                client.gstr2bImport = parseGstr2bJson(await res.text());
                run2bReconciliation(client, hub.period);
                global.saveAppData?.();
                global.showToast?.('Sample GSTR-2B loaded & matched');
                refreshHub();
            } catch (e) {
                global.showToast?.(e.message, 'error');
            }
        });

        container.querySelector('#grh-2b-run')?.addEventListener('click', () => {
            const client = global.getCurrentClient?.();
            if (!client) return;
            if (!client.gstr2bImport?.entries?.length) {
                global.showToast?.('Import GSTR-2B JSON first', 'error');
                return;
            }
            const m = container.querySelector('#grh-recon-month')?.value || hub.period;
            hub.period = m;
            run2bReconciliation(client, m);
            global.saveAppData?.();
            global.showToast?.('2B reconciliation complete');
            refreshHub();
        });

        container.querySelector('#grh-bulk-all')?.addEventListener('click', () => {
            hub.selectedClients = clientList(appData).map(c => c.id);
            global.saveAppData?.();
            refreshHub();
        });
        container.querySelector('#grh-bulk-none')?.addEventListener('click', () => {
            hub.selectedClients = [];
            global.saveAppData?.();
            refreshHub();
        });
        container.querySelector('#grh-bulk-zip')?.addEventListener('click', async () => {
            const sel = container.querySelector('#grh-bulk-types');
            hub.bulkReturns = sel ? [...sel.selectedOptions].map(o => o.value) : ['GSTR-1', 'GSTR-3B'];
            hub.period = container.querySelector('#grh-bulk-month')?.value || hub.period;
            const logEl = container.querySelector('#grh-bulk-log');
            try {
                global.showToast?.('Generating ZIP…');
                const log = await bulkDownloadZip(appData, hub);
                if (logEl) {
                    logEl.classList.remove('hidden');
                    logEl.textContent = log.join('\n');
                }
                global.showToast?.('Bulk ZIP downloaded');
            } catch (e) {
                global.showToast?.(e.message, 'error');
            }
        });
    }

    function refreshHub() {
        const main = document.getElementById('main-content');
        if (main && global.currentSection === 'gst-returns') renderGstrReturnsHub(main);
        else global.showSection?.('gst-returns');
    }

    function onInvoiceSaved(client, invoice) {
        if (!client || !invoice?.date) return;
        G()?.markPeriodStale?.(client, invoice.date, `Invoice ${invoice.number || ''} added`);
        global.saveAppData?.();
    }

    global.GstrReturnsHub = {
        parseGstr2bJson,
        run2bReconciliation,
        returnStatus,
        reconStats,
        onInvoiceSaved,
        attentionItems
    };
    global.renderGstrReturnsHub = renderGstrReturnsHub;
})(typeof window !== 'undefined' ? window : global);