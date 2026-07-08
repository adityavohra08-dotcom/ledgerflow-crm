/**
 * LedgerFlow CRM — Color Palette (IA §2 / table 4)
 * Source: table (4).csv — Usage, Color Name, Hex, Purpose
 */
(function () {
    const COLOR_PALETTE = [
        { usage: 'Primary', name: 'Deep Navy', hex: '#0F172A', purpose: 'Sidebar, headings, important text', token: '--lf-primary' },
        { usage: 'Accent', name: 'Teal / Emerald', hex: '#0D9488', purpose: 'Buttons, links, highlights, success states', token: '--lf-accent' },
        { usage: 'Background', name: 'Slate 50', hex: '#F8FAFC', purpose: 'Main background', token: '--lf-bg' },
        { usage: 'Card / Surface', name: 'White', hex: '#FFFFFF', purpose: 'Cards, tables, modals', token: '--lf-surface' },
        { usage: 'Border', name: 'Slate 200', hex: '#E2E8F0', purpose: 'Subtle dividers', token: '--lf-border' },
        { usage: 'Text Primary', name: 'Slate 900', hex: '#0F172A', purpose: 'Main text', token: '--lf-text' },
        { usage: 'Text Secondary', name: 'Slate 500', hex: '#64748B', purpose: 'Labels, helper text', token: '--lf-muted' },
        { usage: 'Success', name: 'Emerald 600', hex: '#059669', purpose: 'Paid, Completed', token: '--lf-success' },
        { usage: 'Warning', name: 'Amber 500', hex: '#D97706', purpose: 'Pending, Due soon', token: '--lf-warning' },
        { usage: 'Danger', name: 'Red 500', hex: '#EF4444', purpose: 'Overdue, Errors', token: '--lf-danger' }
    ];

    const STATUS_COLORS = {
        success: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
        warning: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
        pending: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
        danger: { bg: '#FEF2F2', text: '#EF4444', border: '#FECACA' }
    };

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderColorPaletteGuide() {
        const swatches = COLOR_PALETTE.map(c => `
            <div class="lf-swatch-card">
                <div class="lf-swatch-chip" style="background:${esc(c.hex)}" title="${esc(c.hex)}"></div>
                <div class="lf-swatch-meta">
                    <div class="lf-swatch-usage">${esc(c.usage)}</div>
                    <div class="lf-swatch-name">${esc(c.name)}</div>
                    <code class="lf-swatch-hex">${esc(c.hex)}</code>
                    <div class="lf-swatch-purpose">${esc(c.purpose)}</div>
                    <code class="lf-swatch-token">${esc(c.token)}</code>
                </div>
            </div>`).join('');

        return `
            <div class="lf-color-palette-guide mb-6">
                <div class="lf-module-guide-head">
                    <i class="fa-solid fa-palette text-teal-600"></i>
                    <span>Color palette (§2) — table (4).csv</span>
                </div>
                <p class="text-xs text-slate-500 mb-4">Semantic tokens in <code>crm-theme.css</code> — light default (table 4); optional <strong>Dark</strong> mode in Appearance settings for long sessions.</p>
                <div class="lf-swatch-grid">${swatches}</div>
            </div>`;
    }

    function statusStyle(kind) {
        return STATUS_COLORS[kind] || STATUS_COLORS.pending;
    }

    window.LedgerFlowColors = {
        COLOR_PALETTE,
        STATUS_COLORS,
        renderColorPaletteGuide,
        statusStyle
    };
})();