/**
 * LedgerFlow CRM — UI Components (§6 / table 5)
 * Source: table (5).csv — Component, Recommendation, Notes
 */
(function () {
    const COMPONENT_SPEC = [
        { component: 'Buttons', recommendation: 'Primary (Teal), Secondary (outline), Ghost', notes: 'Consistent height h-10 or h-11', classes: ['lf-btn--primary', 'lf-btn--secondary', 'lf-btn--ghost'] },
        { component: 'Tables', recommendation: 'Clean, zebra stripes optional, sticky header', notes: 'Good row density', classes: ['data-table', 'lf-table--zebra'] },
        { component: 'Badges', recommendation: 'Rounded, color-coded status', notes: 'Paid / Pending / Overdue', classes: ['lf-badge--success', 'lf-badge--pending', 'lf-badge--danger'] },
        { component: 'Modals', recommendation: 'Clean header + focused content, good close button', notes: 'Avoid very wide modals', classes: ['lf-modal', 'lf-modal__dialog'] },
        { component: 'Forms', recommendation: 'Clear labels above fields, inline validation', notes: 'Use proper input types', classes: ['lf-form-field', 'lf-input', 'lf-form-error'] },
        { component: 'Empty States', recommendation: 'Helpful illustration + clear CTA', notes: 'Very important', classes: ['lf-empty-state'] },
        { component: 'Loading', recommendation: 'Skeleton loaders (not just spinner)', notes: 'Especially on dashboard & tables', classes: ['lf-skeleton', 'lf-skeleton-table'] }
    ];

    const INVOICE_STATUS_MAP = {
        paid: 'success',
        pending: 'pending',
        overdue: 'danger',
        resolved: 'success',
        completed: 'success',
        active: 'success',
        blocked: 'danger',
        rejected: 'danger',
        'in progress': 'warning',
        'due soon': 'warning'
    };

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function button({ variant = 'primary', label, icon, onclick, type = 'button', size = '', className = '', disabled = false }) {
        const sz = size === 'lg' ? ' lf-btn--lg' : size === 'sm' ? ' lf-btn--sm' : '';
        const ic = icon ? `<i class="fa-solid ${icon}${label ? ' mr-1.5' : ''}"></i>` : '';
        const dis = disabled ? ' disabled' : '';
        return `<button type="${type}" ${onclick ? `onclick="${onclick}"` : ''} class="lf-btn lf-btn--${variant}${sz} ${className}"${dis}>${ic}${esc(label)}</button>`;
    }

    function badge(status, kind) {
        const s = (status || '').toLowerCase();
        const k = kind || INVOICE_STATUS_MAP[s] || 'pending';
        return `<span class="lf-badge lf-badge--${k}">${esc(status || 'Pending')}</span>`;
    }

    function formField({ label, inputHtml, required, hint, error, id }) {
        const errId = id ? `${id}-error` : '';
        return `
            <div class="lf-form-field${error ? ' lf-form-field--invalid' : ''}">
                <label class="lf-form-label" ${id ? `for="${id}"` : ''}>
                    ${esc(label)}${required ? ' <span class="lf-form-required">*</span>' : ''}
                </label>
                ${inputHtml}
                ${hint && !error ? `<p class="lf-form-hint">${esc(hint)}</p>` : ''}
                ${error ? `<p class="lf-form-error" ${errId ? `id="${errId}"` : ''} role="alert">${esc(error)}</p>` : ''}
            </div>`;
    }

    function input({ id, type = 'text', placeholder = '', value = '', className = '', required = false, attrs = '' }) {
        const val = value ? ` value="${esc(value)}"` : '';
        const req = required ? ' required' : '';
        return `<input type="${type}" id="${id}" name="${id}" placeholder="${esc(placeholder)}" class="lf-input form-input ${className}"${val}${req} ${attrs}>`;
    }

    function validateRequired(id, message = 'This field is required') {
        const el = document.getElementById(id);
        const field = el?.closest('.lf-form-field');
        if (!el || !field) return true;
        const empty = !String(el.value || '').trim();
        let err = field.querySelector('.lf-form-error');
        if (empty) {
            field.classList.add('lf-form-field--invalid');
            if (!err) {
                err = document.createElement('p');
                err.className = 'lf-form-error';
                err.setAttribute('role', 'alert');
                field.appendChild(err);
            }
            err.textContent = message;
            return false;
        }
        field.classList.remove('lf-form-field--invalid');
        if (err) err.remove();
        return true;
    }

    function modalShell({ title, subtitle, bodyHtml, footerHtml, maxWidth = 'lg' }) {
        return `
            <div class="lf-modal" role="dialog" aria-modal="true" aria-labelledby="lf-modal-title">
                <div class="lf-modal__backdrop"></div>
                <div class="lf-modal__dialog lf-modal__dialog--${maxWidth}">
                    <header class="lf-modal__header">
                        <div>
                            <h3 id="lf-modal-title" class="lf-modal__title">${esc(title)}</h3>
                            ${subtitle ? `<p class="lf-modal__subtitle">${esc(subtitle)}</p>` : ''}
                        </div>
                        <button type="button" class="lf-modal__close" aria-label="Close"><i class="fa-solid fa-times"></i></button>
                    </header>
                    <div class="lf-modal__body">${bodyHtml}</div>
                    ${footerHtml ? `<footer class="lf-modal__footer">${footerHtml}</footer>` : ''}
                </div>
            </div>`;
    }

    function emptyState(opts) {
        if (typeof LedgerFlowUI !== 'undefined' && LedgerFlowUI.renderEmptyState) {
            return LedgerFlowUI.renderEmptyState(opts);
        }
        const { icon = 'fa-inbox', title, message, ctaLabel, ctaOnclick } = opts;
        return `
            <div class="lf-empty-state">
                <div class="lf-empty-state-icon"><i class="fa-solid ${icon}"></i></div>
                <h3 class="lf-empty-state-title">${esc(title)}</h3>
                <p class="lf-empty-state-msg">${esc(message || '')}</p>
                ${ctaLabel && ctaOnclick ? button({ variant: 'primary', label: ctaLabel, onclick: ctaOnclick, className: 'mt-4' }) : ''}
            </div>`;
    }

    function skeletonCards(count = 4) {
        return `<div class="lf-skeleton-grid">${Array(count).fill(0).map(() => `
            <div class="lf-skeleton-card">
                <div class="lf-skeleton lf-skeleton-line w-24 mb-3"></div>
                <div class="lf-skeleton lf-skeleton-line w-32 h-8"></div>
            </div>`).join('')}</div>`;
    }

    function skeletonTable(rows = 5, cols = 4) {
        const head = `<tr>${Array(cols).fill(0).map(() => '<th><div class="lf-skeleton lf-skeleton-line w-16"></div></th>').join('')}</tr>`;
        const body = Array(rows).fill(0).map(() => `
            <tr>${Array(cols).fill(0).map(() => '<td><div class="lf-skeleton lf-skeleton-line"></div></td>').join('')}</tr>`).join('');
        return `
            <div class="lf-skeleton-table lf-panel overflow-hidden">
                <table class="w-full data-table"><thead>${head}</thead><tbody>${body}</tbody></table>
            </div>`;
    }

    function tableWrap(innerHtml, { zebra = true, className = '' } = {}) {
        const zebraCls = zebra ? ' lf-table--zebra' : '';
        return `<div class="lf-panel overflow-hidden ${className}"><table class="w-full data-table lf-table${zebraCls}">${innerHtml}</table></div>`;
    }

    function renderComponentsGuide() {
        const specRows = COMPONENT_SPEC.map(c => `
            <div class="lf-component-spec-card">
                <div class="lf-component-spec-name">${esc(c.component)}</div>
                <div class="lf-component-spec-rec">${esc(c.recommendation)}</div>
                <div class="lf-component-spec-notes">${esc(c.notes)}</div>
                <div class="lf-component-spec-classes">${c.classes.map(cl => `<code>${esc(cl)}</code>`).join(' ')}</div>
            </div>`).join('');

        const specimens = `
            <div class="lf-component-specimens">
                <div class="lf-component-specimen">
                    <span class="lf-component-specimen-label">Buttons</span>
                    <div class="flex flex-wrap gap-2">
                        ${button({ variant: 'primary', label: 'Primary', icon: 'fa-plus' })}
                        ${button({ variant: 'secondary', label: 'Secondary' })}
                        ${button({ variant: 'ghost', label: 'Ghost' })}
                        ${button({ variant: 'primary', label: 'Large', size: 'lg' })}
                    </div>
                </div>
                <div class="lf-component-specimen">
                    <span class="lf-component-specimen-label">Badges</span>
                    <div class="flex flex-wrap gap-2">
                        ${badge('Paid', 'success')}${badge('Pending', 'pending')}${badge('Overdue', 'danger')}
                    </div>
                </div>
                <div class="lf-component-specimen">
                    <span class="lf-component-specimen-label">Form</span>
                    ${formField({ label: 'GSTIN', hint: '15-character GST identification number', inputHtml: input({ id: 'demo-gstin', placeholder: '07AABCU9603R1ZM', className: 'lf-font-mono' }) })}
                </div>
                <div class="lf-component-specimen">
                    <span class="lf-component-specimen-label">Empty state</span>
                    ${emptyState({ icon: 'fa-file-invoice', title: 'No invoices yet', message: 'Create your first GST-compliant bill when ready.', ctaLabel: 'Create Invoice', ctaOnclick: "launchInvoiceMaker()" })}
                </div>
                <div class="lf-component-specimen">
                    <span class="lf-component-specimen-label">Skeleton table</span>
                    ${skeletonTable(3, 4)}
                </div>
            </div>`;

        return `
            <div class="lf-components-guide mb-6">
                <div class="lf-module-guide-head">
                    <i class="fa-solid fa-cubes text-teal-600"></i>
                    <span>UI components (§6) — table (5).csv</span>
                </div>
                <p class="text-xs text-slate-500 mb-3">Semantic classes in <code>crm-theme.css</code> + helpers in <code>components.js</code>.</p>
                <div class="lf-component-spec-grid">${specRows}</div>
                ${specimens}
            </div>`;
    }

    window.LedgerFlowComponents = {
        COMPONENT_SPEC,
        INVOICE_STATUS_MAP,
        button,
        badge,
        formField,
        input,
        validateRequired,
        modalShell,
        emptyState,
        skeletonCards,
        skeletonTable,
        tableWrap,
        renderComponentsGuide
    };
})();