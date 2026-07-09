/**
 * LedgerFlow CRM — Appearance / dark mode (optional, accountant-friendly)
 * Light default (table 4.csv); dark mode for long work sessions.
 */
(function () {
    const STORAGE_KEY = 'ledgerflow_theme';
    const PREFERENCES = ['light', 'dark', 'system'];

    const THEME_META = {
        light: { label: 'Light', icon: 'fa-sun', hint: 'Default — clean & professional (table 4)' },
        dark: { label: 'Dark', icon: 'fa-moon', hint: 'Easier on the eyes during long hours' },
        system: { label: 'System', icon: 'fa-laptop', hint: 'Follows your device setting' }
    };

    function getPreference() {
        try {
            const v = localStorage.getItem(STORAGE_KEY);
            return PREFERENCES.includes(v) ? v : 'light';
        } catch {
            return 'light';
        }
    }

    function resolvePreference(pref) {
        const p = pref || getPreference();
        if (p === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return p === 'dark' ? 'dark' : 'light';
    }

    function applyTheme(pref) {
        const preference = pref || getPreference();
        const resolved = resolvePreference(preference);
        const root = document.documentElement;
        root.setAttribute('data-lf-theme', resolved);
        root.setAttribute('data-lf-theme-pref', preference);
        return { preference, resolved };
    }

    function setPreference(pref) {
        if (!PREFERENCES.includes(pref)) return applyTheme();
        try {
            localStorage.setItem(STORAGE_KEY, pref);
        } catch { /* memory-only embed */ }
        const result = applyTheme(pref);
        syncThemeControls(pref);
        if (typeof showToast === 'function') {
            const label = THEME_META[pref].label;
            showToast(pref === 'system'
                ? `Appearance: System (${result.resolved})`
                : `Appearance: ${label} mode`, 'info');
        }
        window.dispatchEvent(new CustomEvent('lf-theme-change', { detail: result }));
        const iframe = document.getElementById('invoice-maker-frame');
        if (iframe?.contentWindow) {
            try {
                iframe.contentWindow.postMessage({ type: 'ledgerflow-theme-change', theme: result.resolved }, '*');
            } catch { /* cross-origin */ }
        }
        return result;
    }

    function syncThemeControls(pref) {
        const p = pref || getPreference();
        document.querySelectorAll('[data-lf-theme-option]').forEach(btn => {
            const active = btn.getAttribute('data-lf-theme-option') === p;
            btn.classList.toggle('lf-theme-option--active', active);
            btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    function renderAppearanceCard(options = {}) {
        const compact = options.compact;
        const pref = getPreference();
        const resolved = resolvePreference(pref);

        const buttons = PREFERENCES.map(id => {
            const m = THEME_META[id];
            return `
                <button type="button" class="lf-theme-option ${pref === id ? 'lf-theme-option--active' : ''}"
                    data-lf-theme-option="${id}"
                    aria-pressed="${pref === id}"
                    title="${m.hint}"
                    onclick="LedgerFlowTheme.setPreference('${id}')">
                    <i class="fa-solid ${m.icon}"></i>
                    <span>${m.label}</span>
                </button>`;
        }).join('');

        if (compact) {
            return `
                <div class="lf-appearance-card lf-appearance-card--compact mb-4">
                    <span class="text-xs font-semibold text-slate-500 mr-2">Appearance</span>
                    <div class="lf-theme-options lf-theme-options--inline">${buttons}</div>
                </div>`;
        }

        return `
            <div class="lf-appearance-card mb-6">
                <div class="lf-module-guide-head">
                    <i class="fa-solid fa-circle-half-stroke text-teal-600"></i>
                    <span>Appearance</span>
                </div>
                <p class="text-xs text-slate-500 mb-3">
                    Light is the default design (table 4). Switch to <strong>Dark</strong> for long work sessions — your choice is saved on this device.
                    ${pref === 'system' ? ` Currently: <strong>${resolved}</strong> (system).` : ''}
                </p>
                <div class="lf-theme-options">${buttons}</div>
            </div>`;
    }

    function initTheme() {
        applyTheme();
        syncThemeControls();

        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onSystemChange = () => {
            if (getPreference() === 'system') applyTheme('system');
        };
        if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
        else if (mq.addListener) mq.addListener(onSystemChange);
    }

    window.LedgerFlowTheme = {
        STORAGE_KEY,
        PREFERENCES,
        THEME_META,
        getPreference,
        resolvePreference,
        applyTheme,
        setPreference,
        renderAppearanceCard,
        initTheme
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }
})();