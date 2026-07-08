/**
 * LedgerFlow CRM — Design Philosophy (IA §1)
 * Source: table (3).csv — Principle, What it means, Why it matters
 */
(function () {
    const DESIGN_PRINCIPLES = [
        {
            id: 'trust',
            principle: 'Trust First',
            meaning: 'Clean, calm, professional',
            why: 'People trust you with financial data',
            icon: 'fa-shield-heart',
            accent: 'emerald'
        },
        {
            id: 'clarity',
            principle: 'Clarity > Beauty',
            meaning: 'Information should be scannable in < 3 seconds',
            why: 'Accountants are busy',
            icon: 'fa-gauge-high',
            accent: 'cyan'
        },
        {
            id: 'efficiency',
            principle: 'Efficiency',
            meaning: 'Minimum clicks to complete common tasks',
            why: 'High daily usage',
            icon: 'fa-bolt',
            accent: 'amber'
        },
        {
            id: 'approachable',
            principle: 'Approachable',
            meaning: 'Not cold corporate — slightly warm & modern',
            why: 'Clients (non-accountants) also use it',
            icon: 'fa-hand-holding-heart',
            accent: 'teal'
        },
        {
            id: 'consistent',
            principle: 'Consistent',
            meaning: 'Same patterns everywhere',
            why: 'Reduces learning curve',
            icon: 'fa-layer-group',
            accent: 'violet'
        }
    ];

    /** How each principle maps to live UI patterns */
    const UI_PATTERNS = {
        trust: [
            'table (4).csv palette — navy sidebar, light surfaces, teal accent',
            'Trust strip below breadcrumbs',
            'Sidebar “Data is private” note',
            'Subtle motion — no flashy transitions'
        ],
        clarity: [
            'App shell — sidebar | header → KPI row → 2/3-col grid',
            'Label-first metric cards in #lf-kpi-row',
            'Page title + one-line subtitle (lf-page-header)',
            'Sticky table headers + zebra rows'
        ],
        efficiency: [
            'Header Quick Action menu',
            'Global search (clients, invoices, pages)',
            'Hash routes for deep links',
            'Enter key submits search'
        ],
        approachable: [
            '§3 typography — Plus Jakarta Sans UI, Space Grotesk headings',
            'Rounded 16px surfaces + warm empty-state copy',
            'Friendly toast feedback',
            'Client “My Portal” simplified nav'
        ],
        consistent: [
            '§6 components — lf-btn primary/secondary/ghost, lf-badge, lf-modal',
            'lf-panel + lf-table--zebra for data tables',
            'lf-form-field labels above inputs + inline validation',
            'lf-empty-state + lf-skeleton loaders (not spinners)'
        ]
    };

    const APPROACHABLE_COPY = {
        emptyInvoices: 'No invoices here yet — create your first GST-compliant bill whenever you\'re ready.',
        emptyClients: 'Your client list is empty. Add a business to start managing their books together.',
        emptyDocuments: 'No documents yet. Upload a file or ask your CA to share one with you.',
        emptyRequests: 'All quiet for now. Raise a request anytime you need help from your CA.',
        welcomeClient: 'Welcome back — everything you need is a click or two away.',
        welcomeFirm: 'Your firm at a glance. Scan KPIs, then jump straight to what needs attention.'
    };

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderTrustStrip() {
        const isClient = typeof isClientUser === 'function' && isClientUser();
        const msg = isClient
            ? 'Your data is private — only you and your CA firm can access this portal.'
            : 'Client financial data is handled with care — clean, calm, and professional.';
        return `
            <div class="lf-trust-strip" role="note" aria-label="Privacy and trust">
                <i class="fa-solid fa-lock" aria-hidden="true"></i>
                <span>${esc(msg)}</span>
            </div>`;
    }

    function renderPageHeader({ title, subtitle, actionsHtml = '' }) {
        return `
            <header class="lf-page-header">
                <div class="lf-page-header-text">
                    <h1 class="lf-page-title">${esc(title)}</h1>
                    ${subtitle ? `<p class="lf-page-subtitle">${esc(subtitle)}</p>` : ''}
                </div>
                ${actionsHtml ? `<div class="lf-page-header-actions">${actionsHtml}</div>` : ''}
            </header>`;
    }

    function renderMetricCard({ label, value, hint, valueClass = '', ctaLabel, ctaOnclick }) {
        return `
            <div class="stat-card lf-metric-card rounded-3xl p-5">
                <div class="lf-metric-label">${esc(label)}</div>
                <div class="lf-metric-value ${valueClass}">${esc(value)}</div>
                ${hint ? `<div class="lf-metric-hint">${esc(hint)}</div>` : ''}
                ${ctaLabel && ctaOnclick ? `<button type="button" onclick="${ctaOnclick}" class="lf-metric-cta">${esc(ctaLabel)}</button>` : ''}
            </div>`;
    }

    function renderDesignPhilosophyGuide() {
        const rows = DESIGN_PRINCIPLES.map(p => {
            const patterns = (UI_PATTERNS[p.id] || []).map(pt => `<li>${esc(pt)}</li>`).join('');
            return `
                <div class="lf-principle-card lf-principle-card--${p.accent}">
                    <div class="lf-principle-card-head">
                        <i class="fa-solid ${p.icon}"></i>
                        <div>
                            <div class="lf-principle-name">${esc(p.principle)}</div>
                            <div class="lf-principle-meaning">${esc(p.meaning)}</div>
                        </div>
                    </div>
                    <p class="lf-principle-why"><strong>Why:</strong> ${esc(p.why)}</p>
                    <ul class="lf-principle-patterns">${patterns}</ul>
                </div>`;
        }).join('');

        return `
            <div class="lf-design-philosophy-guide mb-6">
                <div class="lf-module-guide-head">
                    <i class="fa-solid fa-compass text-teal-400"></i>
                    <span>Design philosophy (§1)</span>
                </div>
                <p class="text-xs text-slate-400 mb-4">Five principles from your IA spec — each tied to patterns already used in LedgerFlow.</p>
                <div class="lf-principle-grid">${rows}</div>
            </div>`;
    }

    function getApproachableCopy(key, fallback = '') {
        return APPROACHABLE_COPY[key] || fallback;
    }

    window.LedgerFlowDesign = {
        DESIGN_PRINCIPLES,
        UI_PATTERNS,
        APPROACHABLE_COPY,
        renderTrustStrip,
        renderPageHeader,
        renderMetricCard,
        renderDesignPhilosophyGuide,
        getApproachableCopy
    };
})();