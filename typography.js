/**
 * LedgerFlow CRM — Typography (IA §3)
 * Font roles + type scale — aligned with §1 Design Philosophy (clarity, trust, approachable).
 * Body: Plus Jakarta Sans · Display: Space Grotesk · Mono: JetBrains Mono (GSTIN, IDs, amounts)
 */
(function () {
    const FONT_FAMILIES = [
        {
            role: 'UI / Body',
            name: 'Plus Jakarta Sans',
            stack: "'Plus Jakarta Sans', system-ui, sans-serif",
            token: '--lf-font-sans',
            class: 'lf-font-sans',
            weights: '400, 500, 600, 700, 800',
            use: 'Paragraphs, buttons, nav, forms, table cells'
        },
        {
            role: 'Display / Headings',
            name: 'Space Grotesk',
            stack: "'Space Grotesk', 'Plus Jakarta Sans', sans-serif",
            token: '--lf-font-display',
            class: 'lf-font-display font-display',
            weights: '500, 600, 700',
            use: 'Page titles, sidebar brand, section headers, KPI values'
        },
        {
            role: 'Mono / Data',
            name: 'JetBrains Mono',
            stack: "'JetBrains Mono', ui-monospace, monospace",
            token: '--lf-font-mono',
            class: 'lf-font-mono',
            weights: '400, 500, 600, 700',
            use: 'GSTIN, PAN, invoice numbers, bank refs, OTP, currency columns'
        }
    ];

    const TYPE_SCALE = [
        { token: '--lf-text-display', class: 'lf-text-display', size: '1.25rem', px: '20px', weight: '700', use: 'Sidebar brand, login headline' },
        { token: '--lf-text-h1', class: 'lf-text-h1', size: '1.75rem', px: '28px', weight: '600', use: 'Page title (lf-page-title)' },
        { token: '--lf-text-h2', class: 'lf-text-h2', size: '1.25rem', px: '20px', weight: '600', use: 'Panel / section headings' },
        { token: '--lf-text-h3', class: 'lf-text-h3', size: '1.125rem', px: '18px', weight: '600', use: 'Card titles, empty-state headings' },
        { token: '--lf-text-body', class: 'lf-text-body', size: '0.875rem', px: '14px', weight: '400', use: 'Default UI copy, subtitles' },
        { token: '--lf-text-body-sm', class: 'lf-text-body-sm', size: '0.8125rem', px: '13px', weight: '400', use: 'Tables, tabs, dense lists' },
        { token: '--lf-text-label', class: 'lf-text-label', size: '0.75rem', px: '12px', weight: '600', use: 'Form labels above fields' },
        { token: '--lf-text-caption', class: 'lf-text-caption', size: '0.625rem', px: '10px', weight: '800', use: 'Metric labels, table headers (uppercase)' },
        { token: '--lf-text-amount', class: 'lf-text-amount', size: 'inherit', px: '—', weight: '600', use: '₹ amounts — mono + tabular-nums' }
    ];

    const TYPOGRAPHY_RULES = [
        { rule: 'One sans family for UI', detail: 'Plus Jakarta Sans everywhere except headings and mono fields — reduces noise.' },
        { rule: 'Display sparingly', detail: 'Space Grotesk for h1–h3 and brand only; body stays sans for scannability.' },
        { rule: 'Mono for identifiers', detail: 'GSTIN, PAN, IFSC, invoice #, HSN — never for long prose.' },
        { rule: 'Tabular numbers', detail: 'Amounts and KPIs use font-variant-numeric: tabular-nums for column alignment.' },
        { rule: 'Label above field', detail: 'lf-text-label (12px semibold) — matches §5 form component spec.' },
        { rule: 'Table header caps', detail: 'lf-text-caption — 10px uppercase, letter-spacing 0.06em.' }
    ];

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderTypographyGuide() {
        const familyCards = FONT_FAMILIES.map(f => `
            <div class="lf-type-family-card">
                <div class="lf-type-family-role">${esc(f.role)}</div>
                <div class="lf-type-family-sample ${esc(f.class)}" aria-hidden="true">Aa ₹1,24,500</div>
                <div class="lf-type-family-name">${esc(f.name)}</div>
                <code class="lf-type-family-token">${esc(f.token)}</code>
                <div class="lf-type-family-meta">Weights ${esc(f.weights)} · <code>.${esc(f.class.split(' ')[0])}</code></div>
                <div class="lf-type-family-use">${esc(f.use)}</div>
            </div>`).join('');

        const scaleRows = TYPE_SCALE.map(t => `
            <div class="lf-type-scale-row">
                <div class="${esc(t.class)} lf-type-scale-sample">${esc(t.use.split('(')[0].trim())}</div>
                <div class="lf-type-scale-meta">
                    <code>${esc(t.token)}</code>
                    <span>${esc(t.size)} / ${esc(t.px)} · weight ${esc(t.weight)}</span>
                    <span class="lf-type-scale-class">.${esc(t.class)}</span>
                </div>
            </div>`).join('');

        const ruleList = TYPOGRAPHY_RULES.map(r => `
            <li><strong>${esc(r.rule)}</strong> — ${esc(r.detail)}</li>`).join('');

        return `
            <div class="lf-typography-guide mb-6">
                <div class="lf-module-guide-head">
                    <i class="fa-solid fa-font text-teal-600"></i>
                    <span>Typography (§3)</span>
                </div>
                <p class="text-xs text-slate-500 mb-4">Three font roles and a fixed type scale in <code>crm-theme.css</code>. Tailwind <code>font-mono</code> maps to JetBrains Mono inside the app shell.</p>
                <div class="lf-type-family-grid">${familyCards}</div>
                <div class="lf-type-scale-block">
                    <div class="lf-type-scale-head">Type scale</div>
                    ${scaleRows}
                </div>
                <ul class="lf-type-rules">${ruleList}</ul>
            </div>`;
    }

    function monoInputClass(extra = '') {
        return ['lf-font-mono', extra].filter(Boolean).join(' ');
    }

    window.LedgerFlowType = {
        FONT_FAMILIES,
        TYPE_SCALE,
        TYPOGRAPHY_RULES,
        renderTypographyGuide,
        monoInputClass
    };
})();