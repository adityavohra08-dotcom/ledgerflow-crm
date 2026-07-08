/**
 * LedgerFlow CRM — Product capability roadmap (7 pillars)
 * Maps Zoho Books–style feature inventory to live / partial / planned status.
 */
(function () {
    const STATUS = {
        live: { label: 'Live', class: 'lf-cap--live', icon: 'fa-circle-check' },
        partial: { label: 'Partial', class: 'lf-cap--partial', icon: 'fa-circle-half-stroke' },
        planned: { label: 'Planned', class: 'lf-cap--planned', icon: 'fa-circle' }
    };

    const CAPABILITY_PILLARS = [
        {
            id: 'invoicing',
            title: '1. Invoicing & Sales Tools',
            icon: 'fa-file-invoice-dollar',
            features: [
                { name: 'Professional customizable invoices with branding', status: 'live', route: 'launchInvoiceMaker()', note: 'GST Invoice Maker + firm logo' },
                { name: 'Quotes → Sales Orders → Invoices conversion', status: 'partial', route: "showSection('cap-quotes')", note: 'Quotes module + service orders' },
                { name: 'Recurring invoices & automated billing', status: 'partial', route: "showInvoicesFiltered('recurring')", note: 'Recurring filter + schedules' },
                { name: 'Partial invoicing / Progress billing', status: 'partial', route: "showSection('cap-progress-billing')", note: 'Milestone billing UI' },
                { name: 'Retainer invoices & revenue recognition', status: 'partial', route: "showSection('cap-retainers')", note: 'Retainer ledger' },
                { name: 'Credit notes & delivery challans', status: 'partial', route: "showSection('cap-credit-notes')", note: 'CN / DC register' },
                { name: 'Online payments (gateways + payment links)', status: 'partial', route: "showSection('cap-payment-links')", note: 'Payment links + portal Pay Now' },
                { name: 'Automated payment reminders', status: 'partial', route: "showSection('cap-payment-reminders')", note: 'Email/SMS reminder schedules' },
                { name: 'Customer Portal (invoices, payments, documents)', status: 'live', route: "showSection('dashboard')", note: 'Role-based My Portal' },
                { name: 'Multi-currency & multi-language support', status: 'partial', route: "showSection('cap-multi-currency')", note: 'Currency & language settings' }
            ]
        },
        {
            id: 'purchasing',
            title: '2. Purchasing & Expenses Tools',
            icon: 'fa-cart-shopping',
            features: [
                { name: 'Bills & Purchase Orders', status: 'partial', route: "showSection('cap-purchase-orders')", note: 'PO register + purchase upload' },
                { name: 'Expense tracking with AI receipt scanning', status: 'partial', route: "showSection('cap-expenses')", note: 'Expense claims + receipt upload' },
                { name: 'Recurring expenses & bills', status: 'partial', route: "showSection('cap-recurring-expenses')", note: 'Recurring bill schedules' },
                { name: 'Vendor credits & payments', status: 'partial', route: "showSection('cap-vendor-credits')", note: 'Vendor credit ledger' },
                { name: 'Vendor Portal', status: 'partial', route: "showSection('cap-vendor-portal')", note: 'Vendor self-service connect' },
                { name: 'Approval workflows (single & multi-level)', status: 'partial', route: "showSection('team-approvals')", note: 'Team + client signup approvals' },
                { name: 'Mileage tracking', status: 'partial', route: "showSection('cap-mileage')", note: 'Km logs & reimbursement' }
            ]
        },
        {
            id: 'banking',
            title: '3. Banking & Reconciliation Tools',
            icon: 'fa-building-columns',
            features: [
                { name: 'Auto bank & credit card feeds', status: 'partial', route: "showSection('cap-bank-feeds')", note: 'Bank connect flow' },
                { name: 'Automatic import & categorization (Bank Rules + AI)', status: 'partial', route: "showSection('cap-bank-rules')", note: 'Rule-based categorization' },
                { name: 'Fast bank reconciliation', status: 'partial', route: "showSection('bank-recon')", note: 'CSV import + match UI' },
                { name: 'Multiple bank accounts support', status: 'partial', route: "showSection('cap-bank-accounts')", note: 'Multi-account register' }
            ]
        },
        {
            id: 'gst',
            title: '4. GST & Tax Compliance Tools (India)',
            icon: 'fa-scale-balanced',
            features: [
                { name: 'Automatic GST (CGST, SGST, IGST) by place of supply', status: 'live', route: 'launchInvoiceMaker()', note: 'Invoice maker + CRM' },
                { name: 'HSN/SAC code support', status: 'live', route: "showSection('hsn-search')", note: 'HSN database + stock master' },
                { name: 'e-Invoicing (IRN generation)', status: 'partial', route: "showSection('cap-e-invoicing')", note: 'NIC IRP connect flow' },
                { name: 'e-Way Bill generation', status: 'partial', route: "showSection('cap-eway-bill')", note: 'NIC e-Way connect + maker' },
                { name: 'Direct filing of GSTR-1, GSTR-3B, GSTR-9', status: 'partial', route: "showSection('cap-gstr-filing')", note: 'Return filing tracker' },
                { name: 'GSTR-2B reconciliation', status: 'partial', route: "showSection('cap-gstr2b')", note: '2B vs books matching' },
                { name: 'Multi-GSTIN support', status: 'partial', route: "showSection('cap-multi-gstin')", note: 'GSTIN registry per client' },
                { name: 'GST-compliant invoices with full tax breakup', status: 'live', route: 'launchInvoiceMaker()', note: 'CGST Rule 46 PDF' }
            ]
        },
        {
            id: 'inventory',
            title: '5. Inventory Management Tools',
            icon: 'fa-boxes-stacked',
            features: [
                { name: 'Item master with stock tracking', status: 'live', route: "showSection('stock')", note: 'Per-client stock + HSN' },
                { name: 'Multiple warehouses / godowns', status: 'partial', route: "showSection('cap-warehouses')", note: 'Warehouse master' },
                { name: 'Price lists & reorder alerts', status: 'partial', route: "showSection('cap-price-lists')", note: 'Price lists + reorder in stock' },
                { name: 'Batch & serial number tracking', status: 'partial', route: "showSection('cap-batch-serial')", note: 'Batch/serial register' },
                { name: 'Composite items & shipments', status: 'partial', route: "showSection('cap-composite-items')", note: 'Bundle / kit master' },
                { name: 'E-commerce integrations (Shopify, Amazon, Etsy)', status: 'partial', route: "showSection('cap-ecommerce')", note: 'Marketplace connect' }
            ]
        },
        {
            id: 'projects',
            title: '6. Projects & Time Tracking Tools',
            icon: 'fa-diagram-project',
            features: [
                { name: 'Project creation with budgeting', status: 'partial', route: "showSection('cap-projects')", note: 'Project budget tracker' },
                { name: 'Timesheets & task management', status: 'partial', route: "showSection('cap-timesheets')", note: 'Time entry log' },
                { name: 'Project profitability tracking', status: 'partial', route: "showSection('cap-project-profit')", note: 'Margin dashboard' },
                { name: 'Bill clients (time, expenses, retainers)', status: 'partial', route: "showSection('cap-project-billing')", note: 'Project billing queue' }
            ]
        },
        {
            id: 'reports',
            title: '7. Reports & Analytics Tools',
            icon: 'fa-chart-pie',
            features: [
                { name: '70+ built-in reports (Financial, GST, Inventory, Project)', status: 'partial', route: "showSection('cap-report-catalog')", note: '40+ report previews' },
                { name: 'Balance Sheet, P&L, Cash Flow reports', status: 'partial', route: "showSection('cap-financial-reports')", note: 'Financial statement previews' },
                { name: 'Custom reports & dashboards', status: 'partial', route: "showSection('cap-custom-reports')", note: 'Custom report builder' },
                { name: 'Scheduled reports via email', status: 'partial', route: "showSection('cap-scheduled-reports')", note: 'Email schedule manager' },
                { name: 'Zoho Analytics / advanced BI integration', status: 'partial', route: "showSection('cap-bi-integration')", note: 'BI connect flow' }
            ]
        }
    ];

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function summarizePillar(pillar) {
        const counts = { live: 0, partial: 0, planned: 0 };
        pillar.features.forEach(f => { counts[f.status] = (counts[f.status] || 0) + 1; });
        const total = pillar.features.length;
        const score = Math.round(((counts.live + counts.partial * 0.5) / total) * 100);
        return { ...counts, total, score };
    }

    function summarizeAll() {
        let live = 0;
        let partial = 0;
        let planned = 0;
        let total = 0;
        CAPABILITY_PILLARS.forEach(p => {
            const s = summarizePillar(p);
            live += s.live;
            partial += s.partial;
            planned += s.planned;
            total += s.total;
        });
        const score = Math.round(((live + partial * 0.5) / total) * 100);
        return { live, partial, planned, total, score };
    }

    function renderFeatureRow(f) {
        const st = STATUS[f.status] || STATUS.planned;
        const action = f.route
            ? `<button type="button" onclick="${f.route}" class="lf-cap-jump" title="Open in app"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>`
            : '';
        return `
            <li class="lf-cap-feature">
                <span class="lf-cap-badge ${st.class}" title="${esc(st.label)}"><i class="fa-solid ${st.icon}"></i></span>
                <span class="lf-cap-feature-name">${esc(f.name)}</span>
                ${f.note ? `<span class="lf-cap-feature-note">${esc(f.note)}</span>` : ''}
                ${action}
            </li>`;
    }

    function renderPillarCard(pillar) {
        const s = summarizePillar(pillar);
        return `
            <article class="lf-cap-pillar" data-pillar="${esc(pillar.id)}">
                <header class="lf-cap-pillar-head">
                    <i class="fa-solid ${pillar.icon}"></i>
                    <div class="lf-cap-pillar-title">${esc(pillar.title)}</div>
                    <div class="lf-cap-pillar-score">${s.score}%</div>
                </header>
                <div class="lf-cap-pillar-bar" aria-hidden="true">
                    <span class="lf-cap-bar-live" style="width:${(s.live / s.total) * 100}%"></span>
                    <span class="lf-cap-bar-partial" style="width:${(s.partial / s.total) * 100}%"></span>
                </div>
                <div class="lf-cap-pillar-meta">
                    <span class="lf-cap--live">${s.live} live</span>
                    <span class="lf-cap--partial">${s.partial} partial</span>
                    <span class="lf-cap--planned">${s.planned} planned</span>
                </div>
                <ul class="lf-cap-feature-list">${pillar.features.map(renderFeatureRow).join('')}</ul>
            </article>`;
    }

    function renderCapabilitiesGuide() {
        const all = summarizeAll();
        return `
            <div class="lf-capabilities-guide mb-6">
                <div class="lf-module-guide-head">
                    <i class="fa-solid fa-layer-group text-teal-600"></i>
                    <span>Product capability roadmap (7 pillars)</span>
                </div>
                <p class="text-xs text-slate-500 mb-3">
                    Full accounting-suite inventory mapped to LedgerFlow — 
                    <span class="lf-cap--live">${all.live} live</span>,
                    <span class="lf-cap--partial">${all.partial} partial</span>,
                    <span class="lf-cap--planned">${all.planned} planned</span>
                    of ${all.total} capabilities (${all.score}% coverage).
                    <button type="button" onclick="showSection('cap-hub')" class="lf-cap-jump ml-1" title="Open Product Suite"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
                </p>
                <div class="lf-cap-summary-bar" aria-label="Overall coverage ${all.score}%">
                    <div class="lf-cap-summary-fill" style="width:${all.score}%"></div>
                </div>
                <div class="lf-cap-pillar-grid">${CAPABILITY_PILLARS.map(renderPillarCard).join('')}</div>
            </div>`;
    }

    function getFeaturesByStatus(status) {
        const out = [];
        CAPABILITY_PILLARS.forEach(p => {
            p.features.filter(f => f.status === status).forEach(f => {
                out.push({ pillar: p.title, ...f });
            });
        });
        return out;
    }

    function getPillar(id) {
        return CAPABILITY_PILLARS.find(p => p.id === id);
    }

    window.LedgerFlowCapabilities = {
        CAPABILITY_PILLARS,
        STATUS,
        summarizePillar,
        summarizeAll,
        getFeaturesByStatus,
        getPillar,
        renderCapabilitiesGuide
    };
})();