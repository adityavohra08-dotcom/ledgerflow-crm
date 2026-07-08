/**
 * LedgerFlow — Additional recommended UI elements (IA §4)
 * Aligns with design CSVs: principles, palette, components
 */
(function () {
    const SECTION_META = {
        dashboard: { label: 'Dashboard', group: null },
        'all-clients': { label: 'All Clients', group: 'Clients' },
        'client-management': { label: 'Overview', group: 'Clients' },
        'client-approvals': { label: 'Pending Approvals', group: 'Clients' },
        'clients-new': { label: 'Add New Client', group: 'Clients' },
        'invoice-detail': { label: 'Invoice Detail', group: 'Invoices' },
        invoices: { label: 'Invoices', group: 'Invoices' },
        'admin-invoices': { label: 'Admin Invoices', group: 'Invoices' },
        'buy-services': { label: 'Buy Services', group: 'Invoices' },
        'service-orders': { label: 'Service Orders', group: 'Invoices' },
        documents: { label: 'Documents', group: 'Documents' },
        purchases: { label: 'Upload Documents', group: 'Documents' },
        'portal-logins': { label: 'Portal Logins', group: 'Documents' },
        'gst-calculator': { label: 'GST Overview', group: 'GST & Compliance' },
        'hsn-search': { label: 'Invoice Compliance', group: 'GST & Compliance' },
        'bank-recon': { label: 'GST Returns Tracker', group: 'GST & Compliance' },
        'emi-calculator': { label: 'EMI Calculator', group: 'GST & Compliance' },
        requests: { label: 'Messages & Requests', group: 'Communication' },
        whatsapp: { label: 'WhatsApp', group: 'Communication' },
        'team-approvals': { label: 'Approvals', group: 'Communication' },
        'sales-report': { label: 'Revenue Reports', group: 'Reports' },
        'party-pl': { label: 'Client Reports', group: 'Reports' },
        'sales-purchase-report': { label: 'GST Reports', group: 'Reports' },
        'firm-profile': { label: 'Firm Profile', group: 'Settings' },
        'team-management': { label: 'Team Members', group: 'Settings' },
        profile: { label: 'My Profile', group: 'Settings' },
        customers: { label: 'Customers / Parties', group: 'Settings' },
        stock: { label: 'Stock Management', group: 'Settings' },
        'team-client-profile': { label: 'Client Profile', group: 'Clients' },
        'cap-hub': { label: 'All Capabilities', group: 'Product Suite' },
        'cap-pillar-invoicing': { label: 'Sales & Invoicing', group: 'Product Suite' },
        'cap-pillar-purchasing': { label: 'Purchasing', group: 'Product Suite' },
        'cap-pillar-banking': { label: 'Banking', group: 'Product Suite' },
        'cap-pillar-gst': { label: 'GST & Tax', group: 'Product Suite' },
        'cap-pillar-inventory': { label: 'Inventory', group: 'Product Suite' },
        'cap-pillar-projects': { label: 'Projects', group: 'Product Suite' },
        'cap-pillar-reports': { label: 'Reports & BI', group: 'Product Suite' }
    };

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function statusBadge(status) {
        if (typeof LedgerFlowComponents !== 'undefined') {
            return LedgerFlowComponents.badge(status);
        }
        const s = (status || '').toLowerCase();
        let cls = 'lf-badge lf-badge--pending';
        if (s === 'paid' || s === 'resolved' || s === 'completed' || s === 'active') cls = 'lf-badge lf-badge--success';
        else if (s === 'overdue' || s === 'blocked' || s === 'rejected') cls = 'lf-badge lf-badge--danger';
        else if (s === 'in progress' || s === 'due soon') cls = 'lf-badge lf-badge--warning';
        return `<span class="${cls}">${esc(status || 'Pending')}</span>`;
    }

    function renderEmptyState(opts) {
        const msg = opts.message
            || (opts.copyKey && typeof LedgerFlowDesign !== 'undefined' ? LedgerFlowDesign.getApproachableCopy(opts.copyKey) : '')
            || 'Nothing here yet — you\'re all caught up.';
        if (typeof LedgerFlowComponents !== 'undefined') {
            return LedgerFlowComponents.emptyState({ ...opts, message: msg });
        }
        return `
            <div class="lf-empty-state">
                <div class="lf-empty-state-icon"><i class="fa-solid ${opts.icon || 'fa-inbox'}"></i></div>
                <h3 class="lf-empty-state-title">${esc(opts.title)}</h3>
                <p class="lf-empty-state-msg">${esc(msg)}</p>
                ${opts.ctaLabel && opts.ctaOnclick ? `<button type="button" onclick="${opts.ctaOnclick}" class="lf-btn lf-btn--primary mt-4">${esc(opts.ctaLabel)}</button>` : ''}
            </div>`;
    }

    function renderSkeletonCards(count = 4) {
        if (typeof LedgerFlowComponents !== 'undefined') {
            return LedgerFlowComponents.skeletonCards(count);
        }
        return `<div class="lf-skeleton-grid">${Array(count).fill(0).map(() => `
                <div class="lf-skeleton-card rounded-3xl p-5">
                    <div class="lf-skeleton lf-skeleton-line w-24 mb-3"></div>
                    <div class="lf-skeleton lf-skeleton-line w-32 h-8"></div>
                </div>`).join('')}</div>`;
    }

    function renderSkeletonTable(rows = 5, cols = 4) {
        if (typeof LedgerFlowComponents !== 'undefined') {
            return LedgerFlowComponents.skeletonTable(rows, cols);
        }
        return renderSkeletonCards(1);
    }

    function renderBreadcrumbs(section) {
        if (typeof LedgerFlowPages !== 'undefined' && LedgerFlowPages.getBreadcrumbTrail) {
            const trail = LedgerFlowPages.getBreadcrumbTrail(section);
            const parts = trail.map((crumb, idx) => {
                const isLast = idx === trail.length - 1;
                if (crumb.clickable && crumb.pathOpts?.clientId) {
                    const p = `/clients/${crumb.pathOpts.clientId}/overview`;
                    return `<button type="button" class="lf-crumb lf-crumb--link" onclick="LedgerFlowPages.goPath('${p}')">${esc(crumb.label)}</button>`;
                }
                if (crumb.clickable && crumb.section) {
                    return `<button type="button" class="lf-crumb lf-crumb--link" onclick="LedgerFlowPages.go('${crumb.section}')">${esc(crumb.label)}</button>`;
                }
                const cls = isLast ? 'lf-crumb lf-crumb--active' : 'lf-crumb';
                return `<span class="${cls}">${esc(crumb.label)}</span>`;
            });
            return `<nav class="lf-breadcrumbs" aria-label="Breadcrumb">${parts.join('<i class="fa-solid fa-chevron-right lf-crumb-sep"></i>')}</nav>`;
        }

        const meta = SECTION_META[section] || { label: section, group: null };
        const home = isClientUser?.() ? 'My Portal' : (isFirmUser?.() ? 'Firm CRM' : 'Team Portal');
        const parts = [`<span class="lf-crumb">${esc(home)}</span>`];
        if (meta.group) parts.push(`<span class="lf-crumb">${esc(meta.group)}</span>`);
        parts.push(`<span class="lf-crumb lf-crumb--active">${esc(meta.label)}</span>`);
        return `<nav class="lf-breadcrumbs" aria-label="Breadcrumb">${parts.join('<i class="fa-solid fa-chevron-right lf-crumb-sep"></i>')}</nav>`;
    }

    function collectNotifications(appData, ctx = {}) {
        const items = [];
        const isFirm = typeof isFirmUser === 'function' && isFirmUser();
        const isClient = typeof isClientUser === 'function' && isClientUser();

        if (isFirm && typeof getPendingApprovals === 'function') {
            const n = getPendingApprovals().length;
            if (n > 0) items.push({ id: 'approvals', icon: 'fa-user-check', text: `${n} client signup(s) awaiting approval`, action: "showSection('client-approvals')" });
        }

        if (typeof LedgerFlowModules !== 'undefined') {
            LedgerFlowModules.getUpcomingGstDeadlines(2).forEach(d => {
                if (d.daysLeft <= 14) {
                    items.push({ id: 'gst-' + d.name, icon: 'fa-calendar-days', text: `${d.name} due ${d.dueLabel}`, action: "showSection('gst-calculator')" });
                }
            });
        }

        const client = typeof getCurrentClient === 'function' ? getCurrentClient() : null;
        if (client) {
            const outstanding = (client.invoices || []).filter(i => i.status !== 'Paid').length;
            if (outstanding > 0 && (isClient || isFirm)) {
                items.push({ id: 'inv-out', icon: 'fa-file-invoice', text: `${outstanding} outstanding invoice(s)`, action: isClient ? "showInvoicesFiltered('outstanding')" : "showSection('invoices')" });
            }
            const openReq = (client.requests || []).filter(r => r.status !== 'Resolved').length;
            if (openReq > 0) {
                items.push({ id: 'req-open', icon: 'fa-headset', text: `${openReq} open request(s)`, action: "showSection('requests')" });
            }
        }

        if (isFirm && typeof updateTeamApprovalsBadge === 'function') {
            const pending = (appData.teamApprovals || []).filter(a => a.status === 'pending').length;
            if (pending > 0) items.push({ id: 'team-ap', icon: 'fa-clipboard-check', text: `${pending} team approval(s) pending`, action: "showSection('team-approvals')" });
        }

        return items.slice(0, 8);
    }

    function updateNotificationUI(appData) {
        const items = collectNotifications(appData);
        const badge = document.getElementById('header-notif-badge');
        const list = document.getElementById('header-notif-list');
        if (badge) {
            if (items.length) {
                badge.textContent = items.length > 9 ? '9+' : items.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
        if (list) {
            list.innerHTML = items.length
                ? items.map(it => `
                    <button type="button" onclick="${it.action};toggleNotifPanel(false)" class="lf-notif-item w-full text-left">
                        <i class="fa-solid ${it.icon} text-teal-400"></i>
                        <span>${esc(it.text)}</span>
                    </button>`).join('')
                : '<div class="lf-notif-empty">No new notifications</div>';
        }
    }

    function updatePageChrome(section, appData) {
        if (typeof LedgerFlowLayout !== 'undefined' && section !== 'dashboard') {
            LedgerFlowLayout.clearKpiRow();
        }
        const chrome = document.getElementById('lf-page-chrome');
        if (chrome) {
            const trust = typeof LedgerFlowDesign !== 'undefined' ? LedgerFlowDesign.renderTrustStrip() : '';
            chrome.innerHTML = `<div class="lf-page-chrome-inner">${renderBreadcrumbs(section)}${trust}</div>`;
        }
        updateNotificationUI(appData);
        document.getElementById('lf-fab')?.classList.add('hidden');
    }

    window.toggleNotifPanel = function (force) {
        const panel = document.getElementById('header-notif-panel');
        if (!panel) return;
        const open = force === false ? false : force === true ? true : panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !open);
        if (open) {
            document.getElementById('header-quick-action-menu')?.classList.add('hidden');
            document.getElementById('header-user-menu')?.classList.add('hidden');
        }
    };

    window.closeMobileSidebar = function () {
        const sb = document.getElementById('app-sidebar');
        const bd = document.getElementById('lf-sidebar-backdrop');
        sb?.classList.remove('lf-sidebar--open');
        bd?.classList.remove('lf-sidebar-backdrop--visible');
        document.body.classList.remove('lf-sidebar-open');
        if (typeof updateClientBottomNav === 'function' && typeof currentSection !== 'undefined') {
            updateClientBottomNav(currentSection);
        }
    };

    window.toggleMobileSidebar = function () {
        const sb = document.getElementById('app-sidebar');
        const bd = document.getElementById('lf-sidebar-backdrop');
        if (!sb) return;
        const open = !sb.classList.contains('lf-sidebar--open');
        sb.classList.toggle('lf-sidebar--open', open);
        bd?.classList.toggle('lf-sidebar-backdrop--visible', open);
        document.body.classList.toggle('lf-sidebar-open', open);
        if (typeof updateClientBottomNav === 'function' && typeof currentSection !== 'undefined') {
            updateClientBottomNav(currentSection);
        }
    };

    window.LedgerFlowUI = {
        SECTION_META,
        statusBadge,
        renderEmptyState,
        renderSkeletonCards,
        renderSkeletonTable,
        renderBreadcrumbs,
        collectNotifications,
        updatePageChrome,
        updateNotificationUI
    };

    document.addEventListener('click', (e) => {
        const notif = document.getElementById('header-notif-panel');
        if (notif && !notif.classList.contains('hidden') && !e.target.closest('#header-notif-panel') && !e.target.closest('#header-notif-btn')) {
            notif.classList.add('hidden');
        }
        const qa = document.getElementById('header-quick-action-menu');
        if (qa && !qa.classList.contains('hidden') && !e.target.closest('#header-quick-action-menu') && !e.target.closest('#header-quick-action-btn')) {
            qa.classList.add('hidden');
        }
        const user = document.getElementById('header-user-menu');
        if (user && !user.classList.contains('hidden') && !e.target.closest('#header-user-menu') && !e.target.closest('#header-user-menu-btn')) {
            user.classList.add('hidden');
        }
    });
})();