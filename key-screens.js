/**
 * LedgerFlow CRM — Key Screens (§5) — specific UI recommendations
 * A. CA Dashboard · B. Client List · C. Invoice flow · D. Documents · E. Client portal
 */
(function () {
    const DOC_FOLDERS = [
        { id: 'bank', label: 'Bank Statements', match: /bank/i },
        { id: 'invoices', label: 'Invoices', match: /invoice|purchase bill/i },
        { id: 'gst', label: 'GST Returns', match: /gst/i },
        { id: 'other', label: 'Others', match: /.*/ }
    ];

    const KEY_SCREEN_SPECS = {
        caDashboard: ['4–6 KPI cards', 'Recent activity + quick actions', 'Invoice trend chart', 'Calm shadows & muted icons'],
        clientList: ['Avatar initials', 'Outstanding + last activity', 'State/status filters', 'Hover quick actions'],
        invoiceFlow: ['Form + live preview', 'Auto IGST/CGST+SGST', 'Generate GST Invoice CTA', 'Success → send + PDF'],
        documents: ['Drag & drop zone', 'Upload progress', 'Folder view', 'Download CA-shared files', 'e-Signature request'],
        clientPortal: ['Warm welcome', 'Big action cards', 'Pay Now UPI/QR', 'Service catalog', 'Portal login credentials', 'One-tap upload']
    };

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function initials(name) {
        const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '?';
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    function renderAvatar(name, size = 'md') {
        const sz = size === 'sm' ? 'lf-avatar--sm' : '';
        return `<span class="lf-avatar ${sz}" aria-hidden="true">${esc(initials(name))}</span>`;
    }

    function renderKpiCard({ label, value, hint, valueClass = '', icon = 'fa-chart-simple', tint = 'teal', trend, trendDir = 'up', ctaLabel, ctaOnclick }) {
        const trendHtml = trend
            ? `<span class="lf-kpi-trend lf-kpi-trend--${trendDir}"><i class="fa-solid fa-arrow-${trendDir === 'down' ? 'down' : 'up'}"></i>${esc(trend)}</span>`
            : '';
        return `
            <div class="lf-kpi-card lf-kpi-card--${tint}">
                <div class="lf-kpi-card-top">
                    <span class="lf-kpi-icon lf-kpi-icon--${tint}"><i class="fa-solid ${icon}"></i></span>
                    ${trendHtml}
                </div>
                <div class="lf-metric-label">${esc(label)}</div>
                <div class="lf-kpi-value lf-metric-value ${valueClass}">${esc(value)}</div>
                ${hint ? `<div class="lf-metric-hint">${esc(hint)}</div>` : ''}
                ${ctaLabel && ctaOnclick ? `<button type="button" onclick="${ctaOnclick}" class="lf-metric-cta">${esc(ctaLabel)}</button>` : ''}
            </div>`;
    }

    function renderBarChart(data, opts = {}) {
        const max = Math.max(...data.map(d => d.value), 1);
        const bars = data.map(d => `
            <div class="lf-chart-bar-wrap" title="${esc(d.label)}: ${d.value}">
                <div class="lf-chart-bar" style="height:${Math.round((d.value / max) * 100)}%"></div>
                <span class="lf-chart-bar-label">${esc(d.label)}</span>
            </div>`).join('');
        return `
            <div class="lf-chart lf-chart--bar">
                <div class="lf-chart-title">${esc(opts.title || '')}</div>
                <div class="lf-chart-bars">${bars}</div>
            </div>`;
    }

    function renderStateChart(byState) {
        const entries = Object.entries(byState || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
        if (!entries.length) return '<div class="text-sm text-slate-500">No client data yet.</div>';
        const max = Math.max(...entries.map(([, v]) => v), 1);
        return `
            <div class="lf-chart lf-chart--state">
                <div class="lf-chart-title">Client distribution by state</div>
                <div class="lf-state-bars">
                    ${entries.map(([state, count]) => `
                        <div class="lf-state-row">
                            <span class="lf-state-code">${esc(state)}</span>
                            <div class="lf-state-track"><div class="lf-state-fill" style="width:${Math.round((count / max) * 100)}%"></div></div>
                            <span class="lf-state-count">${count}</span>
                        </div>`).join('')}
                </div>
            </div>`;
    }

    function computeFirmDashboardData(appData) {
        const base = typeof LedgerFlowModules !== 'undefined'
            ? LedgerFlowModules.getFirmMetrics(appData)
            : { totalClients: 0, pendingInvoices: 0, pendingAmount: 0, totalInvoices: 0, openRequests: 0, gstDeadlines: [] };

        let docsPendingReview = 0;
        const clients = Object.values(appData?.clients || {});
        clients.forEach(c => {
            (c.documents || []).forEach(d => {
                if (d.approvalStatus === 'pending' || d.reviewStatus === 'pending') docsPendingReview++;
            });
            (c.requests || []).forEach(r => {
                if (r.status === 'Open' && /document|upload|file/i.test(r.subject || r.type || '')) docsPendingReview++;
            });
        });

        const urgentGst = (base.gstDeadlines || []).filter(d => d.daysLeft <= 7).length;
        const nextDue = base.gstDeadlines?.[0]?.daysLeft ?? 30;
        const complianceScore = Math.min(100, Math.max(42, 100 - urgentGst * 12 - (nextDue <= 3 ? 8 : 0)));

        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                label: d.toLocaleString('default', { month: 'short' }),
                value: 0,
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            });
        }
        clients.forEach(c => {
            (c.invoices || []).forEach(inv => {
                const k = (inv.date || '').slice(0, 7);
                const m = months.find(x => x.key === k);
                if (m) m.value++;
            });
        });

        const clientsByState = {};
        clients.forEach(c => {
            const s = c.stateCode || '—';
            clientsByState[s] = (clientsByState[s] || 0) + 1;
        });

        const prevMonth = months[months.length - 2]?.value || 0;
        const currMonth = months[months.length - 1]?.value || 0;
        const invoiceTrend = prevMonth
            ? `${currMonth >= prevMonth ? '+' : ''}${Math.round(((currMonth - prevMonth) / prevMonth) * 100)}%`
            : currMonth ? '+100%' : '—';

        return {
            ...base,
            docsPendingReview,
            complianceScore,
            monthlyTrend: months,
            clientsByState,
            invoiceTrend,
            invoiceTrendDir: currMonth >= prevMonth ? 'up' : 'down',
            pendingApprovals: (appData?.pendingSignups || []).filter(s => s.status === 'pending_approval' && s.emailVerified).length
        };
    }

    function getClientListMeta(client, appData) {
        const linked = typeof findUserByClientId === 'function' ? findUserByClientId(client.id) : null;
        const blocked = !!(linked?.user?.blocked);
        const pendingSignup = (appData?.pendingSignups || []).some(
            s => s.status === 'pending_approval' && (s.email || '').toLowerCase() === (client.email || '').toLowerCase()
        );
        let status = 'active';
        let statusLabel = 'Active';
        if (pendingSignup) { status = 'pending'; statusLabel = 'Pending Approval'; }
        else if (blocked) { status = 'inactive'; statusLabel = 'Inactive'; }

        const outstanding = (client.invoices || []).filter(i => i.status !== 'Paid')
            .reduce((s, i) => s + (i.grandTotal || 0), 0);

        const dates = [];
        (client.invoices || []).forEach(i => i.date && dates.push(i.date));
        (client.requests || []).forEach(r => r.date && dates.push(r.date));
        (client.documents || []).forEach(d => d.date && dates.push(d.date));
        dates.sort().reverse();
        const lastActivity = dates[0] || '—';

        return { status, statusLabel, outstanding, lastActivity, blocked, pendingSignup };
    }

    function renderClientStatusBadge(status, label) {
        const map = {
            active: 'lf-badge lf-badge--success',
            inactive: 'lf-badge lf-badge--danger',
            pending: 'lf-badge lf-badge--warning'
        };
        return `<span class="${map[status] || 'lf-badge'}">${esc(label)}</span>`;
    }

    function renderCaKpiMetrics(data) {
        const nextGst = data.gstDeadlines?.[0];
        return [
            { label: 'Total Clients', value: data.totalClients, icon: 'fa-users', tint: 'teal', trend: data.pendingApprovals ? `${data.pendingApprovals} pending` : '+ steady', trendDir: 'up', ctaLabel: 'View all →', ctaOnclick: "showSection('all-clients')" },
            { label: 'Pending Invoices', value: data.pendingInvoices, icon: 'fa-file-invoice', tint: 'amber', valueClass: 'text-amber-500', trend: data.invoiceTrend, trendDir: data.invoiceTrendDir },
            { label: 'Outstanding Amount', value: `₹${data.pendingAmount.toLocaleString('en-IN')}`, icon: 'fa-indian-rupee-sign', tint: 'rose', hint: 'Across all clients' },
            { label: 'GST Compliance', value: `${data.complianceScore}%`, icon: 'fa-shield-check', tint: 'emerald', hint: nextGst ? `${nextGst.name} in ${nextGst.daysLeft}d` : 'No deadlines soon' },
            { label: 'Docs Pending Review', value: data.docsPendingReview, icon: 'fa-folder-open', tint: 'cyan', trendDir: data.docsPendingReview ? 'down' : 'up', trend: data.docsPendingReview ? 'Needs attention' : 'Clear' },
            { label: 'Open Requests', value: data.openRequests, icon: 'fa-headset', tint: 'violet', ctaLabel: 'View messages →', ctaOnclick: "showSection('requests')" }
        ];
    }

    function renderCaDashboardBody(data, recentActivity, escHtml) {
        const activityRows = recentActivity.length
            ? recentActivity.map(a => `
                <tr class="lf-activity-row">
                    <td class="text-xs text-slate-500 whitespace-nowrap">${esc(a.date || '—')}</td>
                    <td>${escHtml(a.text)}</td>
                    <td class="text-right">
                        <button type="button" onclick="switchToClientFromOverview('${a.clientId}')" class="lf-row-action">Open</button>
                    </td>
                </tr>`).join('')
            : '<tr><td colspan="3" class="text-slate-500 text-sm py-4">No recent activity.</td></tr>';

        const tasksHtml = (data.gstDeadlines || []).slice(0, 4).map(d => `
            <div class="lf-task-item ${d.daysLeft <= 7 ? 'lf-task-item--urgent' : ''}">
                <span>${esc(d.name)}</span>
                <span class="text-xs ${d.daysLeft <= 7 ? 'text-amber-500' : 'text-slate-500'}">${d.dueLabel}</span>
            </div>`).join('');

        const quickActions = `
            <div class="lf-quick-grid">
                <button type="button" onclick="launchInvoiceMaker()" class="lf-quick-tile"><i class="fa-solid fa-file-invoice"></i><span>Create Invoice</span></button>
                <button type="button" onclick="showSection('all-clients')" class="lf-quick-tile"><i class="fa-solid fa-user-plus"></i><span>Add Client</span></button>
                <button type="button" onclick="showSection('documents')" class="lf-quick-tile"><i class="fa-solid fa-upload"></i><span>Upload Doc</span></button>
                <button type="button" onclick="showSection('client-approvals')" class="lf-quick-tile"><i class="fa-solid fa-user-check"></i><span>Approvals</span></button>
            </div>`;

        const middle = typeof LedgerFlowLayout !== 'undefined'
            ? LedgerFlowLayout.contentGrid(`
                ${LedgerFlowLayout.panel('Recent Activity', `
                    <table class="w-full lf-activity-table text-sm">
                        <thead><tr><th>Date</th><th>Activity</th><th></th></tr></thead>
                        <tbody>${activityRows}</tbody>
                    </table>`, { icon: 'fa-clock-rotate-left', iconClass: 'text-teal-500' })}
                <div class="space-y-4">
                    ${LedgerFlowLayout.panel('Quick Actions', quickActions, { icon: 'fa-bolt', iconClass: 'text-teal-500' })}
                    ${LedgerFlowLayout.panel('Upcoming Tasks', `<div class="space-y-2">${tasksHtml || '<div class="text-sm text-slate-500">No upcoming tasks.</div>'}</div>`, { icon: 'fa-list-check', iconClass: 'text-amber-500' })}
                </div>`, { cols: '2-1' })
            : '';

        const charts = typeof LedgerFlowLayout !== 'undefined'
            ? LedgerFlowLayout.contentGrid(`
                ${LedgerFlowLayout.panel('Monthly Invoice Trend', renderBarChart(data.monthlyTrend, { title: '' }), { icon: 'fa-chart-column', iconClass: 'text-teal-500' })}
                ${LedgerFlowLayout.panel('Clients by State', renderStateChart(data.clientsByState), { icon: 'fa-map-location-dot', iconClass: 'text-slate-500' })}
            `, { cols: 2, className: 'mt-6' })
            : '';

        return `${middle}${charts}`;
    }

    function countPortalLogins(client) {
        const pl = client.portalLogins;
        if (!pl) return 0;
        let count = 0;
        if (pl.gst?.username || pl.gst?.password) count++;
        if (pl.incometax?.username || pl.incometax?.password) count++;
        if (pl.tan?.username || pl.tan?.password || pl.tan?.tan) count++;
        if (pl.mca?.username || pl.mca?.password) count++;
        count += (pl.other || []).length;
        return count;
    }

    function renderGstReturnsPortalCard(client) {
        const summary = typeof GstComplianceSuite !== 'undefined'
            ? GstComplianceSuite.clientReturnsSummary(client)
            : null;
        if (!summary) return '';
        return `
                <article class="lf-portal-card lf-portal-card--indigo" role="button" tabindex="0">
                    <div class="lf-portal-card-icon"><i class="fa-solid fa-file-export"></i></div>
                    <div class="lf-portal-card-body">
                        <div class="lf-portal-card-label">GST Returns — ${esc(summary.month)}</div>
                        <div class="lf-portal-card-value lf-portal-gst-status">
                            <span class="grh-status ${summary.cls1}">GSTR-1: ${esc(summary.gstr1)}</span>
                            <span class="grh-status ${summary.cls3} ml-1">GSTR-3B: ${esc(summary.gstr3b)}</span>
                        </div>
                        <div class="lf-portal-card-hint">Filing status prepared by your CA from books</div>
                    </div>
                </article>`;
    }

    function renderClientPortalBody(client, ctx) {
        const { pendingAmount, unpaidCount, adminDocCount, openRequests, recentMessages, firmName } = ctx;
        const catalogCount = (window.SERVICE_CATALOG || []).reduce((n, c) => n + (c.services?.length || 0), 0);
        const pendingServiceOrders = (client.serviceOrders || []).filter(o => !['rejected', 'completed'].includes(o.status)).length;
        const portalLoginCount = countPortalLogins(client);
        const wl = (typeof appData !== 'undefined' && appData.firmSettings?.whiteLabel) || {};
        const portalTitle = wl.portalTitle || firmName || 'Your CA firm';
        const hero = `
            <div class="lf-portal-hero mb-6">
                <div class="lf-portal-hero-text">
                    <h2 class="lf-text-h1">Welcome back, ${esc(client.name.split(' ')[0])}</h2>
                    <p class="lf-portal-hero-sub">${esc(wl.portalSubtitle || (portalTitle + ' is here to help — everything you need is one click away.'))}</p>
                </div>
                <button type="button" onclick="showDocumentsFiltered('upload')" class="lf-btn lf-btn--primary lf-portal-upload-cta lf-portal-upload-cta--hero">
                    <i class="fa-solid fa-cloud-arrow-up mr-2"></i>Upload Documents
                </button>
            </div>`;

        const bigCards = `
            <div class="lf-portal-cards">
                <article class="lf-portal-card lf-portal-card--amber">
                    <div class="lf-portal-card-icon"><i class="fa-solid fa-file-invoice-dollar"></i></div>
                    <div class="lf-portal-card-body">
                        <div class="lf-portal-card-label">Outstanding Invoices</div>
                        <div class="lf-portal-card-value lf-col-amount">₹${pendingAmount.toLocaleString('en-IN')}</div>
                        <div class="lf-portal-card-hint">${unpaidCount} invoice(s) awaiting payment</div>
                        <div class="lf-portal-card-actions">
                            <button type="button" onclick="showInvoicesFiltered('outstanding')" class="lf-btn lf-btn--primary lf-btn--sm">Pay Now</button>
                            <button type="button" onclick="showPayQrModal()" class="lf-btn lf-btn--ghost lf-btn--sm" title="UPI / QR"><i class="fa-solid fa-qrcode"></i> UPI / QR</button>
                        </div>
                    </div>
                </article>
                <article class="lf-portal-card lf-portal-card--blue" onclick="showSection('documents')" role="button" tabindex="0">
                    <div class="lf-portal-card-icon"><i class="fa-solid fa-folder-open"></i></div>
                    <div class="lf-portal-card-body">
                        <div class="lf-portal-card-label">Recent Documents</div>
                        <div class="lf-portal-card-value">${adminDocCount}</div>
                        <div class="lf-portal-card-hint">Files shared by your CA — tap to view &amp; download</div>
                        <div class="lf-portal-card-actions">
                            <button type="button" onclick="event.stopPropagation();showDocumentsFiltered('ca')" class="lf-btn lf-btn--primary lf-btn--sm"><i class="fa-solid fa-download mr-1"></i>Download</button>
                        </div>
                    </div>
                </article>
                <article class="lf-portal-card lf-portal-card--teal" onclick="showSection('requests')" role="button" tabindex="0">
                    <div class="lf-portal-card-icon"><i class="fa-solid fa-comments"></i></div>
                    <div class="lf-portal-card-body">
                        <div class="lf-portal-card-label">Messages from CA</div>
                        <div class="lf-portal-card-value">${openRequests}</div>
                        <div class="lf-portal-card-hint">${recentMessages || 'No new messages'}</div>
                    </div>
                </article>
                <article class="lf-portal-card lf-portal-card--emerald" onclick="showSection('buy-services')" role="button" tabindex="0">
                    <div class="lf-portal-card-icon"><i class="fa-solid fa-store"></i></div>
                    <div class="lf-portal-card-body">
                        <div class="lf-portal-card-label">Service Catalog</div>
                        <div class="lf-portal-card-value">${catalogCount}</div>
                        <div class="lf-portal-card-hint">${pendingServiceOrders ? `${pendingServiceOrders} request(s) in progress` : 'Browse &amp; request CA services'}</div>
                    </div>
                </article>
                <article class="lf-portal-card lf-portal-card--violet" onclick="showSection('portal-logins')" role="button" tabindex="0">
                    <div class="lf-portal-card-icon"><i class="fa-solid fa-key"></i></div>
                    <div class="lf-portal-card-body">
                        <div class="lf-portal-card-label">Portal Login Credentials</div>
                        <div class="lf-portal-card-value">${portalLoginCount}</div>
                        <div class="lf-portal-card-hint">${portalLoginCount ? 'GST, ITR, TAN, MCA &amp; other portals saved' : 'Share government portal logins with your CA'}</div>
                    </div>
                </article>
                ${renderGstReturnsPortalCard(client)}
            </div>`;

        return hero + bigCards;
    }

    function renderDocDropzone(opts = {}) {
        return `
            <div class="lf-dropzone" id="lf-dropzone" role="button" tabindex="0">
                <div class="lf-dropzone-inner">
                    <i class="fa-solid fa-cloud-arrow-up lf-dropzone-icon"></i>
                    <div class="lf-text-h3">Drag &amp; drop files here</div>
                    <p class="lf-dropzone-hint">Bank statements, purchase bills, receipts — or click to browse</p>
                    <input type="file" id="doc-upload" multiple class="hidden" onchange="handleDocumentUpload(event)">
                    <button type="button" onclick="document.getElementById('doc-upload').click()" class="lf-btn lf-btn--primary mt-3">Choose Files</button>
                </div>
                <div id="lf-upload-progress" class="lf-upload-progress hidden">
                    <div class="lf-upload-progress-bar"><div id="lf-upload-progress-fill" class="lf-upload-progress-fill"></div></div>
                    <span id="lf-upload-progress-text" class="lf-upload-progress-text">Uploading…</span>
                </div>
            </div>`;
    }

    function renderDocFolders(docs, opts = {}) {
        const groups = DOC_FOLDERS.map(folder => {
            const items = (docs || []).filter(d => {
                if (folder.id === 'other') {
                    return !DOC_FOLDERS.slice(0, -1).some(f => f.match.test(d.type || '') || f.match.test(d.name || ''));
                }
                return folder.match.test(d.type || '') || folder.match.test(d.name || '');
            });
            return { ...folder, items };
        }).filter(g => g.items.length || opts.showEmpty);

        return groups.map(g => `
            <div class="lf-doc-folder">
                <div class="lf-doc-folder-head">
                    <i class="fa-solid fa-folder text-teal-500"></i>
                    <span>${esc(g.label)}</span>
                    <span class="lf-doc-folder-count">${g.items.length}</span>
                </div>
                ${g.items.length ? `<ul class="lf-doc-folder-list">${g.items.slice(0, 8).map(d => `
                    <li class="lf-doc-folder-item">
                        <i class="fa-solid fa-file-lines text-slate-500"></i>
                        <span class="truncate" title="${esc(d.name)}">${esc(d.name)}</span>
                        ${opts.allowDownload
                            ? `<button type="button" onclick="downloadDocument('${d.id}')" class="lf-doc-folder-dl" title="Download ${esc(d.name)}"><i class="fa-solid fa-download"></i></button>`
                            : `<span class="text-xs text-slate-500">${esc(d.date || '')}</span>`}
                    </li>`).join('')}</ul>` : '<div class="lf-doc-folder-empty text-xs text-slate-500 px-3 py-2">No files</div>'}
            </div>`).join('');
    }

    function renderInvoiceSuccess({ invoiceNumber, partyName, grandTotal, invoiceId, clientId }) {
        return `
            <div id="lf-invoice-success" class="lf-invoice-success">
                <div class="lf-invoice-success-card">
                    <div class="lf-invoice-success-icon"><i class="fa-solid fa-circle-check"></i></div>
                    <h2 class="lf-text-h2">GST Invoice Generated</h2>
                    <p class="text-slate-500 text-sm mb-4">${esc(invoiceNumber)} · ${esc(partyName)} · <span class="lf-col-amount">₹${Number(grandTotal).toLocaleString('en-IN')}</span></p>
                    <div class="flex flex-wrap gap-2 justify-center">
                        <button type="button" onclick="parentSendInvoiceEmail('${invoiceId}')" class="lf-btn lf-btn--primary"><i class="fa-solid fa-paper-plane mr-1"></i>Send to Client</button>
                        <button type="button" onclick="printInvoice()" class="lf-btn lf-btn--secondary"><i class="fa-solid fa-file-pdf mr-1"></i>Download PDF</button>
                        <button type="button" onclick="closeInvoiceSuccess()" class="lf-btn lf-btn--ghost">Close</button>
                    </div>
                </div>
            </div>`;
    }

    function renderKeyScreensGuide() {
        const blocks = Object.entries(KEY_SCREEN_SPECS).map(([k, items]) => `
            <div class="lf-keyscreen-block">
                <div class="lf-keyscreen-name">${esc(k)}</div>
                <ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
            </div>`).join('');
        return `
            <div class="lf-keyscreens-guide mb-6">
                <div class="lf-module-guide-head">
                    <i class="fa-solid fa-window-maximize text-teal-600"></i>
                    <span>Key screens (§5)</span>
                </div>
                <div class="lf-keyscreen-grid">${blocks}</div>
            </div>`;
    }

    function setKpiRowEnhanced(metrics) {
        if (typeof LedgerFlowLayout === 'undefined') return;
        const row = document.getElementById('lf-kpi-row');
        if (!row) return;
        if (!metrics?.length) { LedgerFlowLayout.clearKpiRow(); return; }
        const cards = metrics.map(m => renderKpiCard(m)).join('');
        row.innerHTML = `<div class="lf-kpi-row__grid lf-kpi-row__grid--scroll" role="group" aria-label="Key metrics">${cards}</div>`;
        row.classList.remove('lf-kpi-row--empty');
        row.setAttribute('aria-hidden', 'false');
    }

    window.LedgerFlowScreens = {
        KEY_SCREEN_SPECS,
        DOC_FOLDERS,
        renderKpiCard,
        renderAvatar,
        renderBarChart,
        renderStateChart,
        computeFirmDashboardData,
        getClientListMeta,
        renderClientStatusBadge,
        renderCaKpiMetrics,
        renderCaDashboardBody,
        renderClientPortalBody,
        renderDocDropzone,
        renderDocFolders,
        renderInvoiceSuccess,
        renderKeyScreensGuide,
        setKpiRowEnhanced
    };
})();