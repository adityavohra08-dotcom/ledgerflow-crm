/**
 * LedgerFlow — GST Compliance Suite (Phases 2–5)
 * Doc types, imports, onboarding, audit, notices, GSTR-1A, demo mode
 */
(function (global) {
    'use strict';

    const VERSION = '1.0.0';
    const TABS = ['docs', 'import', 'audit', 'notices', 'demo'];

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function uid(p) {
        return p + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    }

    function getAppData() {
        return global.LedgerFlow?.getAppData?.() || global.appData || null;
    }

    function currentUserLabel() {
        if (global.isFirmUser?.()) return 'Admin';
        if (global.isTeamUser?.()) return 'Team';
        if (global.isClientUser?.()) return 'Client';
        return 'User';
    }

    function ensureComplianceMeta(appData) {
        if (!appData.auditLog) appData.auditLog = [];
        if (!appData.gstNoticeTemplates) appData.gstNoticeTemplates = [];
        if (!appData.complianceSuite) appData.complianceSuite = { tab: 'docs', demoMode: false };
        if (!appData.firmSettings) appData.firmSettings = {};
        const fs = appData.firmSettings;
        if (!fs.whiteLabel) {
            fs.whiteLabel = {
                portalTitle: fs.name || 'LedgerFlow Client Portal',
                portalSubtitle: 'Your CA firm — documents, GST & support in one place',
                accentColor: '#0d9488',
                hideLedgerFlowBranding: false
            };
        }
        if (!appData.gstNoticeTemplates.length) {
            appData.gstNoticeTemplates = [
                { id: uid('nt'), name: 'DRC-01 — Show Cause Reply', type: 'DRC-01', body: 'Respected Sir/Madam,\n\nWe refer to Notice No. {{noticeNo}} dated {{noticeDate}}.\n\nGSTIN: {{gstin}}\nPeriod: {{period}}\n\nWe submit that the discrepancy arises due to {{reason}}. Supporting documents are enclosed.\n\nRegards,\n{{firmName}}' },
                { id: uid('nt'), name: 'ASMT-10 — Assessment Reply', type: 'ASMT-10', body: 'Subject: Reply to ASMT-10 for {{period}}\n\nGSTIN {{gstin}} — We furnish our reply with reconciled GSTR-2B vs books ITC of ₹{{itcAmount}}.\n\n{{firmName}}' },
                { id: uid('nt'), name: 'ITC Mismatch Clarification', type: 'ITC', body: 'Dear Officer,\n\nRegarding ITC mismatch for {{period}}: Books ITC ₹{{booksItc}} vs 2B ₹{{g2bItc}}. Variance explained in annexure.\n\n{{clientName}} / {{firmName}}' }
            ];
        }
    }

    function logAudit(action, entity, details) {
        const appData = getAppData();
        if (!appData) return;
        ensureComplianceMeta(appData);
        appData.auditLog.unshift({
            id: uid('aud'),
            ts: new Date().toISOString(),
            user: currentUserLabel(),
            action,
            entity,
            details: details || ''
        });
        if (appData.auditLog.length > 500) appData.auditLog.length = 500;
        global.saveAppData?.();
    }

    function ensureClientGstDocs(client) {
        if (!client.debitNotes) client.debitNotes = [];
        if (typeof global.LedgerFlowCapabilityModules !== 'undefined') {
            global.LedgerFlowCapabilityModules.ensureCapabilityData?.(client);
        }
    }

    function renderDocTypesPanel(client) {
        ensureClientGstDocs(client);
        const G = global.GstrReturnExport;
        const month = client.gstrExportMeta?.month || G?.defaultMonth?.(client) || new Date().toISOString().slice(0, 7);
        const invs = (G?.filterInvoices?.(client, { month }) || []).slice(0, 12);
        const cdn = G?.collectCdnEntries?.(client, month) || [];

        const invRows = invs.map(inv => {
            const dt = G?.docTypeOf?.(inv) || 'INV';
            const rcm = inv.reverseCharge ? 'Y' : 'N';
            return `<tr>
                <td class="font-mono text-xs">${esc(inv.number)}</td>
                <td><span class="gcs-badge gcs-badge--${dt.toLowerCase()}">${esc(G?.DOC_TYPES?.[dt] || dt)}</span></td>
                <td class="text-xs">${esc(inv.partyName)}</td>
                <td class="text-xs">${rcm}</td>
                <td class="text-xs text-slate-500">${esc(inv.date)}</td>
            </tr>`;
        }).join('') || '<tr><td colspan="5" class="text-slate-500 text-sm py-4">No outward docs for selected period</td></tr>';

        const cdnRows = cdn.map(c => `<tr>
            <td class="font-mono text-xs">${esc(c.number)}</td>
            <td><span class="gcs-badge gcs-badge--${c.docType.toLowerCase()}">${c.docType}</span></td>
            <td class="text-xs">${esc(c.partyName || '—')}</td>
            <td class="text-xs">${esc(c.againstInvoice || '—')}</td>
            <td class="text-xs">${esc(global.GstrReturnExport?.fmtINR ? '' : '')}₹${Number(c.grandTotal || c.taxable).toLocaleString('en-IN')}</td>
        </tr>`).join('') || '<tr><td colspan="5" class="text-slate-500 text-sm py-4">No credit/debit notes</td></tr>';

        return `
            <div class="gcs-panel">
                <p class="text-sm text-slate-400 mb-4">Tax Invoice, Credit Note, Debit Note, Bill of Supply &amp; Delivery Challan flow into GSTR-1 <code class="text-xs">cdnr</code>/<code class="text-xs">cdnur</code> sections. RCM flag sets <code class="text-xs">rchrg: Y</code>.</p>
                <div class="gcs-actions mb-4">
                    <button type="button" class="lf-btn lf-btn--primary text-sm" onclick="GstComplianceSuite.openAddGstDoc()"><i class="fa-solid fa-plus mr-1"></i> Add CN/DN</button>
                    <button type="button" class="lf-btn lf-btn--secondary text-sm" onclick="launchInvoiceMaker()"><i class="fa-solid fa-file-invoice mr-1"></i> Invoice Maker</button>
                    <button type="button" class="lf-btn lf-btn--secondary text-sm" onclick="showSection('gstr-export')"><i class="fa-solid fa-file-export mr-1"></i> GSTR Export</button>
                </div>
                <div class="gcs-grid-2">
                    <div>
                        <div class="gcs-subtitle">Outward documents (${esc(global.GstrReturnExport?.monthLabel?.(month) || month)})</div>
                        <table class="data-table w-full text-sm"><thead><tr><th>No.</th><th>Type</th><th>Party</th><th>RCM</th><th>Date</th></tr></thead><tbody>${invRows}</tbody></table>
                    </div>
                    <div>
                        <div class="gcs-subtitle">CDN entries (GSTR-1)</div>
                        <table class="data-table w-full text-sm"><thead><tr><th>No.</th><th>Type</th><th>Party</th><th>Against</th><th>Value</th></tr></thead><tbody>${cdnRows}</tbody></table>
                    </div>
                </div>
            </div>`;
    }

    function renderImportPanel() {
        return `
            <div class="gcs-panel">
                <p class="text-sm text-slate-400 mb-4">Bulk import purchases, invoices and GST documents from CSV or Excel (.xlsx).</p>
                <div class="gcs-import-grid">
                    <div class="gcs-import-card">
                        <i class="fa-solid fa-cart-shopping text-emerald-400 text-xl mb-2"></i>
                        <div class="font-semibold text-sm">Purchase Register</div>
                        <p class="text-xs text-slate-500 mb-3">supplier, gstin, invoice_no, date, taxable, cgst, sgst, igst</p>
                        <input type="file" id="gcs-import-purchases" accept=".csv,.xlsx,.xls" class="hidden" onchange="GstComplianceSuite.importPurchases(this)">
                        <button type="button" class="lf-btn lf-btn--secondary text-xs" onclick="document.getElementById('gcs-import-purchases').click()">Upload CSV/Excel</button>
                        <button type="button" class="lf-btn lf-btn--ghost text-xs mt-1" onclick="GstComplianceSuite.downloadSample('purchases')">Sample</button>
                    </div>
                    <div class="gcs-import-card">
                        <i class="fa-solid fa-file-invoice text-blue-400 text-xl mb-2"></i>
                        <div class="font-semibold text-sm">Sales Invoices</div>
                        <p class="text-xs text-slate-500 mb-3">invoice_no, date, party_name, doc_type, taxable, cgst, sgst, igst, reverse_charge</p>
                        <input type="file" id="gcs-import-invoices" accept=".csv,.xlsx,.xls" class="hidden" onchange="GstComplianceSuite.importInvoices(this)">
                        <button type="button" class="lf-btn lf-btn--secondary text-xs" onclick="document.getElementById('gcs-import-invoices').click()">Upload CSV/Excel</button>
                        <button type="button" class="lf-btn lf-btn--ghost text-xs mt-1" onclick="GstComplianceSuite.downloadSample('invoices')">Sample</button>
                    </div>
                    <div class="gcs-import-card">
                        <i class="fa-solid fa-file-circle-minus text-amber-400 text-xl mb-2"></i>
                        <div class="font-semibold text-sm">Credit / Debit Notes</div>
                        <p class="text-xs text-slate-500 mb-3">number, type, party, against_invoice, amount, date</p>
                        <input type="file" id="gcs-import-cdn" accept=".csv,.xlsx,.xls" class="hidden" onchange="GstComplianceSuite.importCdn(this)">
                        <button type="button" class="lf-btn lf-btn--secondary text-xs" onclick="document.getElementById('gcs-import-cdn').click()">Upload CSV/Excel</button>
                        <button type="button" class="lf-btn lf-btn--ghost text-xs mt-1" onclick="GstComplianceSuite.downloadSample('cdn')">Sample</button>
                    </div>
                </div>
            </div>`;
    }

    function renderAuditPanel(appData) {
        const rows = (appData.auditLog || []).slice(0, 50).map(a => `
            <tr>
                <td class="text-xs text-slate-500 whitespace-nowrap">${new Date(a.ts).toLocaleString('en-IN')}</td>
                <td class="text-xs">${esc(a.user)}</td>
                <td class="text-xs font-medium">${esc(a.action)}</td>
                <td class="text-xs">${esc(a.entity)}</td>
                <td class="text-xs text-slate-400">${esc(a.details)}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="text-slate-500 py-4">No audit events yet</td></tr>';

        return `
            <div class="gcs-panel">
                <div class="flex justify-between items-center mb-3">
                    <p class="text-sm text-slate-400">Immutable trail of GST exports, imports, filings &amp; client changes.</p>
                    <button type="button" class="lf-btn lf-btn--ghost text-xs" onclick="GstComplianceSuite.exportAuditCsv()"><i class="fa-solid fa-download mr-1"></i> Export CSV</button>
                </div>
                <div class="gcs-table-wrap"><table class="data-table w-full text-sm"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody>${rows}</tbody></table></div>
            </div>`;
    }

    function renderNoticesPanel(appData) {
        const templates = appData.gstNoticeTemplates || [];
        const client = global.getCurrentClient?.();
        const cards = templates.map(t => `
            <div class="gcs-notice-card">
                <div class="flex justify-between items-start gap-2">
                    <div>
                        <div class="font-semibold text-sm">${esc(t.name)}</div>
                        <span class="text-xs text-slate-500">${esc(t.type)}</span>
                    </div>
                    <button type="button" class="gcs-mini-btn" onclick="GstComplianceSuite.useNoticeTemplate('${esc(t.id)}')">Use</button>
                </div>
                <pre class="gcs-notice-preview">${esc(t.body.slice(0, 180))}…</pre>
            </div>`).join('');

        return `
            <div class="gcs-panel">
                <p class="text-sm text-slate-400 mb-4">Pre-filled reply templates for DRC-01, ASMT-10 and ITC mismatch notices. Variables: <code>{{gstin}}</code>, <code>{{period}}</code>, <code>{{firmName}}</code>.</p>
                <div class="gcs-notice-grid">${cards}</div>
                <div class="mt-4">
                    <button type="button" class="lf-btn lf-btn--secondary text-sm" onclick="GstComplianceSuite.openAddNotice()"><i class="fa-solid fa-plus mr-1"></i> Add Template</button>
                    ${client ? `<button type="button" class="lf-btn lf-btn--primary text-sm ml-2" onclick="GstComplianceSuite.generateGstr1A()"><i class="fa-solid fa-pen-to-square mr-1"></i> Generate GSTR-1A JSON</button>` : ''}
                </div>
                <div id="gcs-notice-output" class="mt-4 hidden"></div>
            </div>`;
    }

    function renderDemoPanel(appData) {
        const on = !!appData.complianceSuite?.demoMode;
        return `
            <div class="gcs-panel">
                <div class="gcs-demo-toggle">
                    <div>
                        <div class="font-semibold">Demo / Sandbox Mode</div>
                        <p class="text-xs text-slate-400 mt-1">Shows sample Sharma Traders data banner. Safe for client demos without affecting live filings.</p>
                    </div>
                    <button type="button" class="lf-btn ${on ? 'lf-btn--primary' : 'lf-btn--secondary'} text-sm" onclick="GstComplianceSuite.toggleDemoMode()">${on ? 'Demo ON' : 'Demo OFF'}</button>
                </div>
                ${on ? `<div class="gcs-demo-banner mt-4"><i class="fa-solid fa-flask mr-2"></i> Demo mode active — GSTR samples use Sharma Traders June 2026 books</div>` : ''}
                <div class="mt-4 flex flex-wrap gap-2">
                    <button type="button" class="lf-btn lf-btn--secondary text-sm" onclick="GstComplianceSuite.loadDemoClient()"><i class="fa-solid fa-user mr-1"></i> Switch to Demo Client</button>
                    <button type="button" class="lf-btn lf-btn--secondary text-sm" onclick="showSection('gst-returns')"><i class="fa-solid fa-table-columns mr-1"></i> Returns Hub</button>
                </div>
            </div>`;
    }

    function renderComplianceSuite(container) {
        const appData = getAppData();
        if (!appData) {
            container.innerHTML = '<p class="text-red-400">App data not loaded.</p>';
            return;
        }
        ensureComplianceMeta(appData);
        const client = global.getCurrentClient?.();
        if (client) ensureClientGstDocs(client);
        const tab = appData.complianceSuite.tab || 'docs';

        container.innerHTML = `
            <div class="gcs-tool">
                <div class="mb-6">
                    <h2 class="text-2xl font-semibold tracking-tight">GST Compliance Suite</h2>
                    <p class="text-slate-400 text-sm mt-1">Document types, bulk import, audit trail, notice templates &amp; GSTR-1A amendments</p>
                </div>
                <div class="gcs-tabs">
                    ${TABS.map(t => `<button type="button" class="gcs-tab${t === tab ? ' gcs-tab--active' : ''}" data-tab="${t}">${{ docs: 'Doc Types', import: 'Import', audit: 'Audit Trail', notices: 'Notices & 1A', demo: 'Demo Mode' }[t]}</button>`).join('')}
                </div>
                <div id="gcs-tab-body">
                    ${tab === 'docs' ? renderDocTypesPanel(client) : ''}
                    ${tab === 'import' ? renderImportPanel() : ''}
                    ${tab === 'audit' ? renderAuditPanel(appData) : ''}
                    ${tab === 'notices' ? renderNoticesPanel(appData) : ''}
                    ${tab === 'demo' ? renderDemoPanel(appData) : ''}
                </div>
            </div>`;

        container.querySelectorAll('.gcs-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                appData.complianceSuite.tab = btn.dataset.tab;
                global.saveAppData?.();
                renderComplianceSuite(container);
            });
        });
    }

    function parseImportRows(file, callback) {
        const f = file.files?.[0];
        if (!f) return;
        const name = f.name.toLowerCase();
        const reader = new FileReader();
        reader.onload = e => {
            let rows = [];
            if (name.endsWith('.csv') || name.endsWith('.txt')) {
                const parsed = global.parseCSVText?.(e.target.result);
                rows = parsed?.rows || [];
            } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
                if (typeof XLSX === 'undefined') { global.showToast?.('XLSX library not loaded', 'error'); return; }
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                rows = rows.map(r => {
                    const o = {};
                    Object.keys(r).forEach(k => { o[k.toLowerCase().replace(/\s+/g, '_')] = r[k]; });
                    return o;
                });
            } else {
                global.showToast?.('Use CSV or Excel file', 'error');
                return;
            }
            callback(rows, f.name);
        };
        if (name.endsWith('.xlsx') || name.endsWith('.xls')) reader.readAsArrayBuffer(f);
        else reader.readAsText(f);
        file.value = '';
    }

    function openOnboardingWizard() {
        if (!global.isFirmUser?.()) { global.showToast?.('Admin only', 'error'); return; }
        let step = 0;
        const steps = ['Business', 'GST & Tax', 'Bank', 'Portal Access', 'Done'];

        function renderStep() {
            const fields = [
                `${global.formField?.('Business Name', global.formInput?.('ob-name', 'text', 'Sharma Traders Pvt Ltd'), true) || ''}
                 ${global.formField?.('Login Email', global.formInput?.('ob-email', 'email', 'billing@client.in'), true) || ''}
                 ${global.formField?.('Password', global.formInput?.('ob-password', 'text', 'client123'), true) || ''}
                 ${global.formField?.('Phone', global.formInput?.('ob-phone', 'tel', '+91 98765 43210')) || ''}`,
                `<div class="grid grid-cols-2 gap-4">
                    ${global.formField?.('GSTIN', global.formInput?.('ob-gstin', 'text', '07AABCU9603R1ZM', 'font-mono')) || ''}
                    ${global.formField?.('PAN', global.formInput?.('ob-pan', 'text', 'AABCU9603R', 'font-mono')) || ''}
                 </div>
                 ${global.formField?.('State', `<select id="ob-state" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm">${global.stateSelectOptions?.('07') || ''}</select>`) || ''}
                 ${global.formField?.('Address', `<textarea id="ob-address" rows="2" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm"></textarea>`) || ''}`,
                `<div class="grid grid-cols-2 gap-4">
                    ${global.formField?.('Bank Name', global.formInput?.('ob-bank', 'text', 'HDFC Bank')) || ''}
                    ${global.formField?.('Account #', global.formInput?.('ob-account', 'text', '', 'font-mono')) || ''}
                    ${global.formField?.('IFSC', global.formInput?.('ob-ifsc', 'text', '', 'font-mono')) || ''}
                    ${global.formField?.('Branch', global.formInput?.('ob-branch', 'text', '')) || ''}
                 </div>`,
                `${global.formField?.('GST Portal Username', global.formInput?.('ob-gst-user', 'text', '')) || ''}
                 ${global.formField?.('GST Portal Password', global.formInput?.('ob-gst-pass', 'password', '')) || ''}
                 <p class="text-xs text-slate-500">Optional — stored securely in client portal logins.</p>`,
                `<div class="text-center py-6">
                    <i class="fa-solid fa-circle-check text-5xl text-emerald-400 mb-4"></i>
                    <p class="text-slate-300">Review details and click <strong>Create Client</strong> to finish onboarding.</p>
                 </div>`
            ];

            global.openMasterFormModal?.({
                title: `Client Onboarding — Step ${step + 1}/${steps.length}`,
                subtitle: steps[step],
                submitLabel: step < steps.length - 1 ? 'Next →' : 'Create Client',
                fieldsHtml: `
                    <div class="flex gap-1 mb-4">${steps.map((s, i) => `<span class="gcs-wiz-step${i <= step ? ' gcs-wiz-step--done' : ''}">${s}</span>`).join('')}</div>
                    ${fields[step]}`,
                onSubmit: () => {
                    if (step < steps.length - 1) { step++; global.closeMasterFormModal?.(); setTimeout(renderStep, 50); return; }
                    const name = document.getElementById('ob-name')?.value?.trim();
                    const email = document.getElementById('ob-email')?.value?.trim();
                    if (!name || !email) { global.showToast?.('Name and email required', 'error'); return; }
                    const appData = getAppData();
                    const id = 'c' + Date.now();
                    appData.clients[id] = {
                        id, name,
                        gstin: document.getElementById('ob-gstin')?.value?.trim() || '',
                        pan: document.getElementById('ob-pan')?.value?.trim() || '',
                        stateCode: document.getElementById('ob-state')?.value || '07',
                        address: document.getElementById('ob-address')?.value?.trim() || '',
                        phone: document.getElementById('ob-phone')?.value?.trim() || '',
                        email,
                        logo: '',
                        bank: {
                            name: document.getElementById('ob-bank')?.value?.trim() || '',
                            account: document.getElementById('ob-account')?.value?.trim() || '',
                            ifsc: document.getElementById('ob-ifsc')?.value?.trim() || '',
                            branch: document.getElementById('ob-branch')?.value?.trim() || ''
                        },
                        terms: 'Payment due within 7 days.',
                        customers: [], stock: [], invoices: [], purchases: [],
                        documents: [], requests: [], bankTxns: [],
                        serviceOrders: [], adminInvoices: [], debitNotes: [],
                        portalLogins: {
                            gst: {
                                username: document.getElementById('ob-gst-user')?.value?.trim() || '',
                                password: document.getElementById('ob-gst-pass')?.value || '',
                                gstin: document.getElementById('ob-gstin')?.value?.trim() || '',
                                notes: 'Added during onboarding',
                                updatedAt: new Date().toISOString()
                            },
                            incometax: { username: '', password: '', pan: '', notes: '', updatedAt: '' },
                            tan: { tan: '', username: '', password: '', notes: '', updatedAt: '' },
                            mca: { username: '', password: '', notes: '', updatedAt: '' },
                            other: []
                        }
                    };
                    appData.users[id] = {
                        email,
                        password: document.getElementById('ob-password')?.value || 'client123',
                        name, role: 'client', clientId: id, blocked: false
                    };
                    global.currentClientId = id;
                    logAudit('Client onboarded', name, `GSTIN ${appData.clients[id].gstin}`);
                    global.saveAppData?.();
                    global.populateClientSwitcher?.();
                    global.closeMasterFormModal?.();
                    global.showToast?.(`Client "${name}" onboarded successfully`);
                    global.showSection?.('client-management');
                }
            });
        }
        renderStep();
    }

    const suite = {
        VERSION,
        logAudit,
        ensureComplianceMeta,
        openOnboardingWizard,
        renderComplianceSuite,

        openAddGstDoc() {
            const client = global.getCurrentClient?.();
            if (!client) return;
            ensureClientGstDocs(client);
            global.openMasterFormModal?.({
                title: 'Add Credit / Debit Note',
                subtitle: 'Flows to GSTR-1 CDNR/CDNUR',
                submitLabel: 'Save',
                fieldsHtml: `
                    ${global.formField?.('Note Number', global.formInput?.('cdn-num', 'text', 'CN-2026-001'), true) || ''}
                    ${global.formField?.('Type', `<select id="cdn-type" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm"><option value="CN">Credit Note</option><option value="DN">Debit Note</option></select>`) || ''}
                    ${global.formField?.('Party Name', global.formInput?.('cdn-party', 'text', ''), true) || ''}
                    ${global.formField?.('Against Invoice', global.formInput?.('cdn-against', 'text', '')) || ''}
                    ${global.formField?.('Taxable (₹)', global.formInput?.('cdn-taxable', 'number', '0')) || ''}
                    ${global.formField?.('Date', `<input type="date" id="cdn-date" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm" value="${new Date().toISOString().slice(0, 10)}">`) || ''}`,
                onSubmit: () => {
                    const type = document.getElementById('cdn-type')?.value || 'CN';
                    const taxable = Number(document.getElementById('cdn-taxable')?.value) || 0;
                    const entry = {
                        id: uid(type === 'CN' ? 'cn' : 'dn'),
                        number: document.getElementById('cdn-num')?.value?.trim(),
                        party: document.getElementById('cdn-party')?.value?.trim(),
                        againstInvoice: document.getElementById('cdn-against')?.value?.trim(),
                        amount: taxable,
                        taxable,
                        date: document.getElementById('cdn-date')?.value || new Date().toISOString().slice(0, 10)
                    };
                    if (type === 'CN') {
                        entry.type = 'Credit Note';
                        client.creditNotes.push(entry);
                    } else {
                        client.debitNotes.push(entry);
                    }
                    logAudit('CDN added', entry.number, `${type} ₹${taxable}`);
                    global.GstrReturnExport?.markPeriodStale?.(client, entry.date);
                    global.saveAppData?.();
                    global.closeMasterFormModal?.();
                    global.showToast?.(`${type} saved`);
                    const main = document.getElementById('main-content');
                    if (main) renderComplianceSuite(main);
                }
            });
        },

        importPurchases(input) {
            parseImportRows(input, rows => {
                const client = global.getCurrentClient?.();
                if (!client) return;
                if (!client.purchases) client.purchases = [];
                let n = 0;
                rows.forEach(row => {
                    const supplier = row.supplier || row.vendor || row.party_name;
                    const invoiceNo = row.invoice_no || row.bill_no || row.number;
                    if (!supplier || !invoiceNo) return;
                    client.purchases.push({
                        id: uid('pur'),
                        supplier,
                        gstin: row.gstin || '',
                        invoiceNo,
                        date: row.date || new Date().toISOString().slice(0, 10),
                        taxable: Number(row.taxable || row.taxable_value) || 0,
                        cgst: Number(row.cgst) || 0,
                        sgst: Number(row.sgst) || 0,
                        igst: Number(row.igst) || 0,
                        itcEligible: String(row.itc_eligible || 'Y').toUpperCase() !== 'N',
                        imported: true
                    });
                    n++;
                });
                logAudit('Purchase import', client.name, `${n} rows`);
                global.saveAppData?.();
                global.showToast?.(`${n} purchase(s) imported`);
            });
        },

        importInvoices(input) {
            parseImportRows(input, rows => {
                const client = global.getCurrentClient?.();
                if (!client) return;
                let n = 0;
                rows.forEach(row => {
                    const number = row.invoice_no || row.number;
                    const partyName = row.party_name || row.customer;
                    if (!number || !partyName) return;
                    const docType = String(row.doc_type || 'INV').toUpperCase();
                    client.invoices.push({
                        id: uid('inv'),
                        number, partyName,
                        date: row.date || new Date().toISOString().slice(0, 10),
                        docType,
                        taxable: Number(row.taxable) || 0,
                        cgst: Number(row.cgst) || 0,
                        sgst: Number(row.sgst) || 0,
                        igst: Number(row.igst) || 0,
                        grandTotal: Number(row.grand_total || row.total) || 0,
                        reverseCharge: ['y', 'yes', 'true', '1'].includes(String(row.reverse_charge || '').toLowerCase()),
                        status: row.status || 'Pending',
                        imported: true
                    });
                    n++;
                });
                logAudit('Invoice import', client.name, `${n} rows`);
                global.saveAppData?.();
                global.showToast?.(`${n} invoice(s) imported`);
            });
        },

        importCdn(input) {
            parseImportRows(input, rows => {
                const client = global.getCurrentClient?.();
                if (!client) return;
                ensureClientGstDocs(client);
                let n = 0;
                rows.forEach(row => {
                    const number = row.number || row.note_no;
                    if (!number) return;
                    const isDebit = String(row.type || '').toLowerCase().includes('debit');
                    const entry = {
                        id: uid(isDebit ? 'dn' : 'cn'),
                        number,
                        type: isDebit ? 'Debit Note' : 'Credit Note',
                        party: row.party || row.customer || row.party_name || '',
                        againstInvoice: row.against_invoice || row.against || '',
                        amount: Number(row.amount || row.taxable) || 0,
                        taxable: Number(row.taxable || row.amount) || 0,
                        date: row.date || new Date().toISOString().slice(0, 10)
                    };
                    if (isDebit) client.debitNotes.push(entry);
                    else client.creditNotes.push(entry);
                    n++;
                });
                logAudit('CDN import', client.name, `${n} rows`);
                global.saveAppData?.();
                global.showToast?.(`${n} note(s) imported`);
            });
        },

        downloadSample(type) {
            const samples = {
                purchases: 'supplier,gstin,invoice_no,date,taxable,cgst,sgst,igst,itc_eligible\nABC Suppliers,07AABCA1234B1Z5,ABC/118,2026-06-15,65000,5850,5850,0,Y',
                invoices: 'invoice_no,date,party_name,doc_type,taxable,cgst,sgst,igst,grand_total,reverse_charge\nINV-101,2026-06-01,Metro Retail,INV,50000,4500,4500,0,59000,N\nCN-003,2026-06-20,Metro Retail,CN,5000,450,450,0,5900,N',
                cdn: 'number,type,party,against_invoice,amount,date\nCN-2026-004,Credit Note,Metro Retail,INV-101,2500,2026-06-22'
            };
            const blob = new Blob([samples[type] || ''], { type: 'text/csv' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `sample_${type}_import.csv`;
            a.click();
            URL.revokeObjectURL(a.href);
        },

        exportAuditCsv() {
            const appData = getAppData();
            const lines = ['timestamp,user,action,entity,details'];
            (appData.auditLog || []).forEach(a => {
                lines.push([a.ts, a.user, a.action, a.entity, a.details].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
            });
            global.GstrReturnExport?.downloadText?.(lines.join('\n'), `audit_log_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
        },

        useNoticeTemplate(id) {
            const appData = getAppData();
            const t = (appData.gstNoticeTemplates || []).find(x => x.id === id);
            const client = global.getCurrentClient?.();
            if (!t) return;
            let body = t.body;
            const vars = {
                gstin: client?.gstin || '{{gstin}}',
                period: client?.gstrExportMeta?.month || '{{period}}',
                firmName: appData.firmSettings?.name || 'CA Firm',
                clientName: client?.name || '{{clientName}}',
                noticeNo: 'DRC-01/2026/001',
                noticeDate: new Date().toLocaleDateString('en-IN'),
                reason: 'timing difference in ITC booking',
                itcAmount: '11,700',
                booksItc: '11,700',
                g2bItc: '11,700'
            };
            Object.entries(vars).forEach(([k, v]) => { body = body.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v); });
            const out = document.getElementById('gcs-notice-output');
            if (out) {
                out.classList.remove('hidden');
                out.innerHTML = `<div class="gcs-notice-output"><pre>${esc(body)}</pre>
                    <button type="button" class="lf-btn lf-btn--secondary text-xs mt-2" onclick="navigator.clipboard.writeText(${JSON.stringify(body)});showToast('Copied')">Copy</button></div>`;
            }
            logAudit('Notice template used', t.name, client?.name || '');
        },

        openAddNotice() {
            global.openMasterFormModal?.({
                title: 'Add Notice Template',
                submitLabel: 'Save',
                fieldsHtml: `
                    ${global.formField?.('Name', global.formInput?.('nt-name', 'text', ''), true) || ''}
                    ${global.formField?.('Type', global.formInput?.('nt-type', 'text', 'DRC-01')) || ''}
                    ${global.formField?.('Body', `<textarea id="nt-body" rows="8" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm"></textarea>`) || ''}`,
                onSubmit: () => {
                    const appData = getAppData();
                    appData.gstNoticeTemplates.push({
                        id: uid('nt'),
                        name: document.getElementById('nt-name')?.value?.trim(),
                        type: document.getElementById('nt-type')?.value?.trim(),
                        body: document.getElementById('nt-body')?.value || ''
                    });
                    global.saveAppData?.();
                    global.closeMasterFormModal?.();
                    const main = document.getElementById('main-content');
                    if (main) renderComplianceSuite(main);
                }
            });
        },

        generateGstr1A() {
            const client = global.getCurrentClient?.();
            const G = global.GstrReturnExport;
            if (!client || !G) return;
            const month = client.gstrExportMeta?.month || G.defaultMonth(client);
            try {
                const built = G.buildValidatedReturn('GSTR-1A', client, { month });
                G.downloadText(JSON.stringify(built.data, null, 2), built.fileName.replace('GSTR-1', 'GSTR-1A'), 'application/json');
                logAudit('GSTR-1A generated', client.name, G.monthLabel(month));
                global.saveAppData?.();
                global.showToast?.(`GSTR-1A JSON downloaded (${built.validation.warnings.length} warnings)`);
            } catch (e) {
                global.showToast?.(e.message, 'error');
            }
        },

        toggleDemoMode() {
            const appData = getAppData();
            ensureComplianceMeta(appData);
            appData.complianceSuite.demoMode = !appData.complianceSuite.demoMode;
            logAudit('Demo mode', appData.complianceSuite.demoMode ? 'ON' : 'OFF', '');
            global.saveAppData?.();
            global.showToast?.(`Demo mode ${appData.complianceSuite.demoMode ? 'enabled' : 'disabled'}`);
            const main = document.getElementById('main-content');
            if (main && global.currentSection === 'gst-compliance') renderComplianceSuite(main);
            suite.applyDemoBanner();
        },

        applyDemoBanner() {
            const appData = getAppData();
            const on = appData?.complianceSuite?.demoMode;
            let el = document.getElementById('gcs-demo-top-banner');
            if (!on) { if (el) el.remove(); return; }
            if (!el) {
                el = document.createElement('div');
                el.id = 'gcs-demo-top-banner';
                el.className = 'gcs-demo-top-banner';
                el.innerHTML = '<i class="fa-solid fa-flask mr-2"></i> Demo mode — sample data for presentations';
                document.body.prepend(el);
            }
        },

        loadDemoClient() {
            const appData = getAppData();
            const demo = Object.entries(appData.clients || {}).find(([, c]) => c.name?.includes('Sharma'));
            if (demo) {
                global.currentClientId = demo[0];
                global.populateClientSwitcher?.();
                global.showToast?.(`Switched to ${demo[1].name}`);
            } else {
                global.showToast?.('Demo client not found — use Sharma Traders seed', 'error');
            }
        },

        clientReturnsSummary(client) {
            const G = global.GstrReturnExport;
            if (!G || !client) return null;
            const month = G.defaultMonth(client);
            const s1 = global.GstrReturnsHub?.returnStatus?.(client, 'GSTR-1', month);
            const s3 = global.GstrReturnsHub?.returnStatus?.(client, 'GSTR-3B', month);
            if (!s1 && !s3) {
                const invs = G.filterInvoices(client, { month: month });
                return {
                    month: G.monthLabel(month),
                    gstr1: invs.length ? 'Draft' : 'Not Started',
                    gstr3b: invs.length ? 'Draft' : 'Not Started',
                    cls1: invs.length ? 'grh-status--draft' : 'grh-status--none',
                    cls3: invs.length ? 'grh-status--draft' : 'grh-status--none'
                };
            }
            return {
                month: G.monthLabel(month),
                gstr1: s1?.code || '—',
                gstr3b: s3?.code || '—',
                cls1: s1?.cls || '',
                cls3: s3?.cls || ''
            };
        }
    };

    global.GstComplianceSuite = suite;
    global.renderGstComplianceSuite = renderComplianceSuite;
    global.logGstAudit = logAudit;
})(typeof window !== 'undefined' ? window : global);