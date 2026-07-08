/**
 * LedgerFlow CRM — module breakdown (IA spec)
 * Source: table (2).csv — Menu Item, Key Screens, Key Features
 */
(function () {
    const MODULE_SPECS = {
        dashboard: {
            title: 'Dashboard',
            screens: ['Overview cards', 'Recent activity', 'Quick actions'],
            features: [
                'Total clients',
                'Pending invoices',
                'Upcoming GST deadlines',
                'Quick Create Invoice'
            ]
        },
        clients: {
            title: 'Clients',
            screens: ['All Clients table', 'Client detail page', 'Add/Edit form'],
            features: [
                'Search & filters (state, GSTIN, status)',
                'Client profile with summary'
            ]
        },
        invoices: {
            title: 'Invoices',
            screens: ['Invoice list', 'Create Invoice (GST maker)', 'Invoice detail'],
            features: [
                'GST-compliant PDF',
                'Payment status',
                'Send to client',
                'Record payment'
            ]
        },
        documents: {
            title: 'Documents',
            screens: ['File browser', 'Upload modal', 'Document requests'],
            features: [
                'Folders per client',
                'Drag & drop upload',
                'Version history',
                'e-Sign (coming soon)'
            ]
        },
        gst: {
            title: 'GST & Compliance',
            screens: ['GST dashboard', 'Compliance checker', 'Returns tracker'],
            features: [
                'GSTR-1 / GSTR-3B status',
                'Invoice validation (Rule 46)'
            ]
        },
        communication: {
            title: 'Communication',
            screens: ['Chat / Message thread', 'Approval center', 'Notifications'],
            features: [
                'In-app messaging',
                'WhatsApp integration (future)',
                'Approval workflow'
            ]
        },
        reports: {
            title: 'Reports',
            screens: ['Revenue report', 'Client-wise report', 'GST summary'],
            features: [
                'Export to Excel / PDF',
                'Date range filters'
            ]
        },
        settings: {
            title: 'Settings',
            screens: ['Firm details', 'Bank accounts', 'Team', 'Notifications'],
            features: [
                'Logo upload',
                'Signature',
                'Tax settings',
                'User roles'
            ]
        }
    };

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function getUpcomingGstDeadlines(count = 3) {
        const labels = [
            { name: 'GSTR-1', day: 11 },
            { name: 'GSTR-3B', day: 20 },
            { name: 'GSTR-9 (annual)', day: 31, month: 11 }
        ];
        const now = new Date();
        const items = [];

        for (let m = 0; m < 14; m++) {
            const d = new Date(now.getFullYear(), now.getMonth() + m, 1);
            labels.forEach(l => {
                const due = new Date(d.getFullYear(), l.month != null ? l.month : d.getMonth() + 1, l.day);
                if (due >= now) {
                    items.push({
                        name: l.name,
                        due: due.toISOString().split('T')[0],
                        dueLabel: due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                        daysLeft: Math.ceil((due - now) / 86400000)
                    });
                }
            });
        }

        return items
            .sort((a, b) => a.due.localeCompare(b.due))
            .slice(0, count);
    }

    function getFirmMetrics(appData) {
        const clients = Object.values(appData?.clients || {});
        let pendingInvoices = 0;
        let pendingAmount = 0;
        let totalInvoices = 0;

        clients.forEach(c => {
            (c.invoices || []).forEach(inv => {
                totalInvoices++;
                if (inv.status !== 'Paid') {
                    pendingInvoices++;
                    pendingAmount += inv.grandTotal || 0;
                }
            });
        });

        return {
            totalClients: clients.length,
            pendingInvoices,
            pendingAmount,
            totalInvoices,
            openRequests: clients.reduce((s, c) => s + (c.requests || []).filter(r => r.status !== 'Resolved').length, 0),
            gstDeadlines: getUpcomingGstDeadlines(4)
        };
    }

    function filterByDateRange(items, from, to, dateField = 'date') {
        if (!from && !to) return items;
        return (items || []).filter(item => {
            const d = item[dateField];
            if (!d) return false;
            if (from && d < from) return false;
            if (to && d > to) return false;
            return true;
        });
    }

    function renderModuleGuide(moduleId, options = {}) {
        const spec = MODULE_SPECS[moduleId];
        if (!spec) return '';
        const compact = options.compact;
        const checked = options.checkedFeatures || [];

        const featureChips = spec.features.map(f => {
            const done = checked.includes(f) || checked.some(c => f.toLowerCase().includes(c.toLowerCase()));
            return `<span class="lf-module-chip ${done ? 'lf-module-chip--done' : ''}">${esc(f)}</span>`;
        }).join('');

        const screenChips = spec.screens.map(s =>
            `<span class="lf-module-screen">${esc(s)}</span>`
        ).join('');

        if (compact) {
            return `
                <div class="lf-module-guide lf-module-guide--compact mb-4">
                    <div class="flex flex-wrap items-center gap-2 text-xs">
                        <span class="font-semibold text-teal-400/90">${esc(spec.title)}</span>
                        ${screenChips}
                    </div>
                </div>`;
        }

        return `
            <div class="lf-module-guide mb-6">
                <div class="lf-module-guide-head">
                    <i class="fa-solid fa-layer-group text-teal-400"></i>
                    <span>${esc(spec.title)} module</span>
                </div>
                <div class="lf-module-guide-screens">${screenChips}</div>
                <div class="lf-module-guide-features">${featureChips}</div>
            </div>`;
    }

    /** IA §2 — color palette lives in color-palette.js + crm-theme.css */
    const COLOR_PALETTE_REF = {
        file: 'color-palette.js',
        source: 'table (4).csv',
        tokens: ['--lf-primary', '--lf-accent', '--lf-bg', '--lf-surface', '--lf-border', '--lf-text', '--lf-muted', '--lf-success', '--lf-warning', '--lf-danger'],
        devGuide: 'Firm Profile → Color palette (§2) swatches',
        darkMode: 'theme.js — Light (default) / Dark / System; saved in localStorage'
    };

    /** IA §1 — design philosophy lives in design-principles.js */
    const DESIGN_PHILOSOPHY_REF = {
        file: 'design-principles.js',
        principles: ['Trust First', 'Clarity > Beauty', 'Efficiency', 'Approachable', 'Consistent'],
        devGuide: 'Firm Profile → Design philosophy (§1) panel'
    };

    /** Product capability roadmap — 7 pillars (product-capabilities.js + capability-modules.js) */
    const PRODUCT_CAPABILITIES_REF = {
        files: ['product-capabilities.js', 'capability-modules.js'],
        pillars: ['Invoicing & Sales', 'Purchasing & Expenses', 'Banking', 'GST & Tax', 'Inventory', 'Projects & Time', 'Reports & Analytics'],
        statuses: ['live', 'partial', 'planned'],
        hub: 'cap-hub',
        routes: '/capabilities, /capabilities/[pillar], /capabilities/[module]',
        devGuide: 'Sidebar → Product Suite, or Firm Profile → Product capability roadmap'
    };

    /** §6 — UI components (table 5) lives in components.js + crm-theme.css */
    const COMPONENTS_REF = {
        file: 'components.js',
        source: 'table (5).csv',
        items: ['Buttons', 'Tables', 'Badges', 'Modals', 'Forms', 'Empty States', 'Loading'],
        classes: ['lf-btn--primary', 'lf-btn--secondary', 'lf-btn--ghost', 'lf-badge--success', 'lf-modal', 'lf-form-field', 'lf-empty-state', 'lf-skeleton-table'],
        devGuide: 'Firm Profile → UI components (§6) panel'
    };

    /** §5 — key screen recommendations (key-screens.js) */
    const KEY_SCREENS_REF = {
        file: 'key-screens.js',
        screens: ['CA Dashboard', 'Client List', 'Invoice Creation', 'Documents', 'Client Portal'],
        devGuide: 'Firm Profile → Key screens (§5) panel'
    };

    /** App shell layout — sidebar | header + KPI + content grid */
    const LAYOUT_REF = {
        file: 'layout.js',
        zones: ['Sidebar', 'Header', 'KPI row', 'Page chrome', 'Main content'],
        grids: ['lf-content-grid--2', 'lf-content-grid--2-1', 'lf-content-grid--3'],
        devGuide: 'Firm Profile → App shell layout panel'
    };

    /** IA §3 — typography lives in typography.js + crm-theme.css */
    const TYPOGRAPHY_REF = {
        file: 'typography.js',
        families: ['Plus Jakarta Sans (UI)', 'Space Grotesk (display)', 'JetBrains Mono (data)'],
        tokens: ['--lf-font-sans', '--lf-font-display', '--lf-font-mono', '--lf-text-h1', '--lf-text-body', '--lf-text-caption'],
        classes: ['lf-text-h1', 'lf-text-label', 'lf-text-amount', 'lf-font-mono', 'lf-form-label'],
        devGuide: 'Firm Profile → Typography (§3) panel'
    };

    /** IA §5 — page hierarchy lives in page-hierarchy.js (routes, breadcrumbs, role guards) */
    const PAGE_HIERARCHY_REF = {
        file: 'page-hierarchy.js',
        routing: 'Hash paths: /dashboard, /clients/all, /clients/[id]/overview, /invoices/create, /capabilities, /capabilities/[module]',
        roles: ['firm', 'team', 'client'],
        devGuide: 'Firm Profile → Page hierarchy (§5) panel'
    };

    /** IA §4 — additional recommended chrome (implemented in ui-elements.js) */
    const ADDITIONAL_ELEMENTS = [
        { element: 'Breadcrumbs', purpose: 'Orientation within module hierarchy' },
        { element: 'Notification center', purpose: 'GST deadlines, approvals, outstanding invoices' },
        { element: 'Quick-create FAB', purpose: 'One-tap Create Invoice from any screen' },
        { element: 'Help shortcut', purpose: 'Jump to Messages & Requests' },
        { element: 'Mobile sidebar drawer', purpose: 'Responsive navigation' },
        { element: 'Status badges', purpose: 'Paid / Pending / Overdue consistency' },
        { element: 'Empty states', purpose: 'Clear CTA when lists are empty' },
        { element: 'Sticky table headers', purpose: 'Scannable long lists' },
        { element: 'Privacy footer', purpose: 'Trust signal in sidebar' }
    ];

    window.LedgerFlowModules = {
        MODULE_SPECS,
        DESIGN_PHILOSOPHY_REF,
        COLOR_PALETTE_REF,
        TYPOGRAPHY_REF,
        LAYOUT_REF,
        KEY_SCREENS_REF,
        COMPONENTS_REF,
        PRODUCT_CAPABILITIES_REF,
        PAGE_HIERARCHY_REF,
        ADDITIONAL_ELEMENTS,
        renderModuleGuide,
        getFirmMetrics,
        getUpcomingGstDeadlines,
        filterByDateRange
    };
})();