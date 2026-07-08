/**
 * LedgerFlow CRM — App shell layout (IA)
 * [Sidebar] | [Header]
 *           | [KPI Cards Row]
 *           | [Main Content — 2 or 3 column grid]
 */
(function () {
    const LAYOUT_ZONES = [
        { zone: 'Sidebar', width: '320px / drawer', purpose: 'Role-based navigation, firm brand, privacy note' },
        { zone: 'Header', height: 'sticky ~56px', purpose: 'Search, quick actions, notifications, user menu' },
        { zone: 'KPI row', height: 'auto', purpose: 'Scannable metrics — dashboard & summary screens' },
        { zone: 'Page chrome', height: 'auto', purpose: 'Breadcrumbs + trust strip' },
        { zone: 'Main content', height: 'flex-1 scroll', purpose: 'Page body in 1-, 2-, or 3-column grid' }
    ];

    const GRID_PATTERNS = [
        { id: '2-equal', class: 'lf-content-grid--2', use: 'Dashboard widgets, settings split panels' },
        { id: '2-wide', class: 'lf-content-grid--2-1', use: 'Primary table + secondary panel (5fr / 7fr)' },
        { id: '3-equal', class: 'lf-content-grid--3', use: 'Quick actions, service cards, report tiles' }
    ];

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function clearKpiRow() {
        const row = document.getElementById('lf-kpi-row');
        if (!row) return;
        row.innerHTML = '';
        row.classList.add('lf-kpi-row--empty');
        row.setAttribute('aria-hidden', 'true');
    }

    function setKpiRow(metrics) {
        if (typeof LedgerFlowScreens !== 'undefined' && metrics?.some(m => m.icon)) {
            LedgerFlowScreens.setKpiRowEnhanced(metrics);
            return;
        }
        const row = document.getElementById('lf-kpi-row');
        if (!row) return;
        if (!metrics || !metrics.length) {
            clearKpiRow();
            return;
        }
        const cards = metrics.map(m => (
            typeof LedgerFlowDesign !== 'undefined'
                ? LedgerFlowDesign.renderMetricCard(m)
                : `<div class="lf-metric-card stat-card rounded-3xl p-5"><div class="lf-metric-value">${esc(m.value)}</div></div>`
        )).join('');
        row.innerHTML = `<div class="lf-kpi-row__grid lf-kpi-row__grid--scroll" role="group" aria-label="Key metrics">${cards}</div>`;
        row.classList.remove('lf-kpi-row--empty');
        row.setAttribute('aria-hidden', 'false');
    }

    function contentGrid(innerHtml, opts = {}) {
        const cols = opts.cols || 2;
        let cls = 'lf-content-grid--2';
        if (cols === 3) cls = 'lf-content-grid--3';
        else if (cols === '2-1' || cols === 'wide') cls = 'lf-content-grid--2-1';
        const extra = opts.className ? ` ${opts.className}` : '';
        return `<div class="lf-content-grid ${cls}${extra}">${innerHtml}</div>`;
    }

    function panel(title, bodyHtml, opts = {}) {
        const icon = opts.icon ? `<i class="fa-solid ${opts.icon} ${opts.iconClass || 'text-teal-400'}"></i>` : '';
        const headExtra = opts.headExtra || '';
        return `
            <section class="lf-panel lf-layout-panel rounded-3xl p-6 ${opts.className || ''}">
                <header class="lf-layout-panel-head">
                    <div class="lf-text-h3 flex items-center gap-2">${icon}<span>${esc(title)}</span></div>
                    ${headExtra}
                </header>
                <div class="lf-layout-panel-body">${bodyHtml}</div>
            </section>`;
    }

    function renderLayoutGuide() {
        const zones = LAYOUT_ZONES.map(z => `
            <div class="lf-layout-zone-card">
                <div class="lf-layout-zone-name">${esc(z.zone)}</div>
                <div class="lf-layout-zone-meta">${esc(z.width || z.height)}</div>
                <div class="lf-layout-zone-purpose">${esc(z.purpose)}</div>
            </div>`).join('');

        const grids = GRID_PATTERNS.map(g => `
            <code class="lf-layout-grid-chip">${esc(g.class)}</code>
            <span class="text-xs text-slate-500">${esc(g.use)}</span>`).join('<br>');

        return `
            <div class="lf-layout-guide mb-6">
                <div class="lf-module-guide-head">
                    <i class="fa-solid fa-table-columns text-teal-600"></i>
                    <span>App shell layout</span>
                </div>
                <pre class="lf-layout-diagram" aria-label="Layout diagram">[Sidebar]  |  [Header]
           |  [KPI Cards Row]
           |  [Main Content — 2 or 3 column grid]</pre>
                <p class="text-xs text-slate-500 mb-3">Implemented in <code>index.html</code> shell + <code>layout.js</code>. KPI metrics render into <code>#lf-kpi-row</code>; page bodies use <code>LedgerFlowLayout.contentGrid()</code>.</p>
                <div class="lf-layout-zone-grid">${zones}</div>
                <div class="lf-layout-grids mt-3 text-xs">${grids}</div>
            </div>`;
    }

    window.LedgerFlowLayout = {
        LAYOUT_ZONES,
        GRID_PATTERNS,
        clearKpiRow,
        setKpiRow,
        contentGrid,
        panel,
        renderLayoutGuide
    };
})();