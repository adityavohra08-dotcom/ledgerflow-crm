/**
 * LedgerFlow CRM — WhatsApp Integration
 * Click-to-chat (wa.me), message templates, log, and Business API connect flow.
 */
(function () {
    'use strict';

    const TEMPLATES = [
        { id: 'invoice_reminder', label: 'Invoice payment reminder', icon: 'fa-file-invoice-dollar', body: 'Dear {{client}},\n\nThis is a reminder that invoice {{invoice}} for ₹{{amount}} is outstanding.\n\nPlease arrange payment at your earliest convenience.\n\nRegards,\n{{firm}}' },
        { id: 'document_request', label: 'Document request', icon: 'fa-folder-open', body: 'Dear {{client}},\n\nWe need the following document for your compliance: {{document}}\n\nPlease upload via your Client Portal or reply here.\n\n{{firm}}' },
        { id: 'gst_deadline', label: 'GST filing reminder', icon: 'fa-calendar-days', body: 'Dear {{client}},\n\nReminder: {{return}} for {{period}} is due on {{dueDate}}.\n\nPlease share pending purchase bills if any.\n\n{{firm}}' },
        { id: 'welcome', label: 'Welcome new client', icon: 'fa-hand-sparkles', body: 'Welcome to {{firm}}!\n\nYour Client Portal is ready. Sign in to view invoices, upload documents, and raise requests.\n\nWe are glad to have you onboard.' },
        { id: 'payment_received', label: 'Payment acknowledgment', icon: 'fa-circle-check', body: 'Dear {{client}},\n\nWe have recorded your payment of ₹{{amount}} against invoice {{invoice}}.\n\nThank you for your business!\n\n{{firm}}' },
        { id: 'custom', label: 'Custom message', icon: 'fa-pen', body: '' }
    ];

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function normalizePhone(phone, countryCode) {
        const cc = countryCode || '91';
        let digits = String(phone || '').replace(/\D/g, '');
        if (digits.length === 10) digits = cc + digits;
        else if (digits.length === 12 && digits.startsWith('91')) { /* ok */ }
        else if (digits.length === 11 && digits.startsWith('0')) digits = cc + digits.slice(1);
        return digits;
    }

    function formatPhoneDisplay(phone) {
        const d = normalizePhone(phone);
        if (d.length === 12 && d.startsWith('91')) {
            return '+91 ' + d.slice(2, 7) + ' ' + d.slice(7);
        }
        return phone || '—';
    }

    function ensureWhatsAppSettings() {
        if (typeof ensureFirmSettings === 'function') ensureFirmSettings();
        const defaults = {
            connected: false,
            mode: 'click_to_chat',
            businessPhone: '',
            displayName: '',
            apiPhoneNumberId: '',
            apiAccessToken: '',
            webhookVerifyToken: '',
            defaultCountryCode: '91',
            autoLogMessages: true
        };
        if (!appData.whatsappSettings) appData.whatsappSettings = { ...defaults };
        Object.keys(defaults).forEach(k => {
            if (appData.whatsappSettings[k] === undefined) appData.whatsappSettings[k] = defaults[k];
        });
    }

    function ensureClientWhatsApp(client) {
        if (!client) return;
        if (!client.whatsappMessages) client.whatsappMessages = [];
        if (client.whatsappOptIn === undefined) client.whatsappOptIn = true;
    }

    function getFirmName() {
        return appData.firmSettings?.name || 'Your CA Firm';
    }

    function fillTemplate(templateId, ctx) {
        const tpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[TEMPLATES.length - 1];
        let body = tpl.body;
        if (templateId === 'custom' && ctx.customBody) body = ctx.customBody;
        const vars = {
            client: ctx.clientName || 'Client',
            firm: getFirmName(),
            invoice: ctx.invoice || '—',
            amount: ctx.amount != null ? Number(ctx.amount).toLocaleString('en-IN') : '—',
            document: ctx.document || 'the requested file',
            return: ctx.gstReturn || 'GSTR-3B',
            period: ctx.period || 'this month',
            dueDate: ctx.dueDate || 'soon'
        };
        Object.entries(vars).forEach(([k, v]) => {
            body = body.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), v);
        });
        return body;
    }

    function buildWaMeUrl(phone, message) {
        const num = normalizePhone(phone, appData.whatsappSettings?.defaultCountryCode);
        const text = encodeURIComponent(message || '');
        return `https://wa.me/${num}?text=${text}`;
    }

    function logWhatsAppMessage(client, entry) {
        ensureClientWhatsApp(client);
        client.whatsappMessages.unshift({
            id: 'wa_' + Date.now(),
            date: new Date().toISOString(),
            ...entry
        });
        if (client.whatsappMessages.length > 100) {
            client.whatsappMessages = client.whatsappMessages.slice(0, 100);
        }
        if (typeof saveAppData === 'function') saveAppData();
    }

    function openWhatsAppChat(phone, message, client, meta) {
        if (!phone) {
            if (typeof showToast === 'function') showToast('No phone number on file', 'error');
            return;
        }
        const url = buildWaMeUrl(phone, message);
        window.open(url, '_blank', 'noopener');
        if (appData.whatsappSettings?.autoLogMessages !== false && client) {
            logWhatsAppMessage(client, {
                direction: 'outbound',
                channel: 'click_to_chat',
                phone: formatPhoneDisplay(phone),
                template: meta?.template || 'custom',
                preview: (message || '').slice(0, 120),
                status: 'opened',
                sentBy: typeof currentUser !== 'undefined' ? currentUser?.name : 'User'
            });
        }
        if (typeof showToast === 'function') showToast('Opening WhatsApp…');
    }

    async function sendViaBusinessApi(phone, message) {
        if (typeof LedgerFlowBackend === 'undefined' || !LedgerFlowBackend.enabled) {
            throw new Error('Cloud API required for automated send');
        }
        if (typeof LedgerFlowBackend.sendWhatsApp === 'function') {
            return LedgerFlowBackend.sendWhatsApp(phone, message);
        }
        throw new Error('WhatsApp API client not available');
    }

    function renderConnectCard() {
        const ws = appData.whatsappSettings;
        const apiReady = ws.connected && ws.mode === 'business_api';
        return `
            <div class="lf-wa-connect-grid mb-6">
                <div class="lf-wa-connect-card ${ws.mode === 'click_to_chat' ? 'lf-wa-connect-card--on' : ''}">
                    <div class="lf-wa-connect-icon"><i class="fa-brands fa-whatsapp"></i></div>
                    <div class="flex-1">
                        <div class="font-semibold">Click to Chat</div>
                        <p class="text-xs text-slate-400">Opens WhatsApp Web/App with pre-filled message — works immediately, no API keys.</p>
                    </div>
                    <button type="button" onclick="LedgerFlowWhatsApp.setMode('click_to_chat')" class="lf-btn lf-btn--${ws.mode === 'click_to_chat' ? 'secondary' : 'primary'} lf-btn--sm">${ws.mode === 'click_to_chat' ? 'Active' : 'Use'}</button>
                </div>
                <div class="lf-wa-connect-card ${apiReady ? 'lf-wa-connect-card--on' : ''}">
                    <div class="lf-wa-connect-icon"><i class="fa-solid fa-cloud"></i></div>
                    <div class="flex-1">
                        <div class="font-semibold">WhatsApp Business API</div>
                        <p class="text-xs text-slate-400">Meta Cloud API for automated templates &amp; webhooks (configure below).</p>
                    </div>
                    <button type="button" onclick="LedgerFlowWhatsApp.setMode('business_api')" class="lf-btn lf-btn--${apiReady ? 'secondary' : 'primary'} lf-btn--sm">${apiReady ? 'Connected' : 'Connect'}</button>
                </div>
            </div>
            <div class="bg-slate-900 border border-slate-700 rounded-3xl p-5 mb-6 space-y-3">
                <div class="text-sm font-semibold text-slate-200">Business API credentials</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label class="text-xs text-slate-400">Business display name</label>
                        <input id="wa-display-name" value="${esc(ws.displayName)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm"></div>
                    <div><label class="text-xs text-slate-400">Business phone (with country code)</label>
                        <input id="wa-business-phone" value="${esc(ws.businessPhone)}" placeholder="+91 98765 43210" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm"></div>
                    <div><label class="text-xs text-slate-400">Phone Number ID (Meta)</label>
                        <input id="wa-phone-id" value="${esc(ws.apiPhoneNumberId)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono"></div>
                    <div><label class="text-xs text-slate-400">Access token</label>
                        <input id="wa-access-token" type="password" value="${esc(ws.apiAccessToken)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono" autocomplete="off"></div>
                </div>
                <div class="flex flex-wrap gap-2 pt-2">
                    <button type="button" onclick="LedgerFlowWhatsApp.saveSettings()" class="lf-btn lf-btn--primary lf-btn--sm">Save settings</button>
                    <button type="button" onclick="LedgerFlowWhatsApp.testConnection()" class="lf-btn lf-btn--secondary lf-btn--sm">Test API</button>
                </div>
                <p class="text-[10px] text-slate-500">Webhook URL: <code class="text-emerald-400">${esc((typeof LedgerFlowBackend !== 'undefined' && LedgerFlowBackend.apiUrl) ? LedgerFlowBackend.apiUrl + '/api/whatsapp/webhook' : '/api/whatsapp/webhook')}</code></p>
            </div>`;
    }

    function renderSendPanel(client) {
        ensureClientWhatsApp(client);
        const phone = client.phone || '';
        const tplOptions = TEMPLATES.map(t =>
            `<option value="${t.id}">${esc(t.label)}</option>`
        ).join('');

        const outstanding = (client.invoices || []).filter(i => i.status !== 'Paid');
        const invOptions = outstanding.length
            ? outstanding.map(i => `<option value="${esc(i.number)}" data-amount="${i.grandTotal}">${esc(i.number)} — ₹${i.grandTotal.toLocaleString('en-IN')}</option>`).join('')
            : '<option value="">No outstanding invoices</option>';

        return `
            <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6 mb-6">
                <div class="flex items-center gap-2 mb-4">
                    <i class="fa-brands fa-whatsapp text-[#25D366] text-xl"></i>
                    <div>
                        <div class="font-semibold">Send to ${esc(client.name)}</div>
                        <div class="text-xs text-slate-400">${formatPhoneDisplay(phone)} ${client.whatsappOptIn ? '<span class="text-emerald-400">• Opted in</span>' : '<span class="text-amber-400">• Opt-out</span>'}</div>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <div><label class="text-xs text-slate-400">Template</label>
                        <select id="wa-template" onchange="LedgerFlowWhatsApp.previewTemplate()" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm">${tplOptions}</select></div>
                    <div><label class="text-xs text-slate-400">Link invoice (optional)</label>
                        <select id="wa-invoice" onchange="LedgerFlowWhatsApp.previewTemplate()" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm">${invOptions}</select></div>
                </div>
                <div class="mb-3"><label class="text-xs text-slate-400">Message preview</label>
                    <textarea id="wa-message-preview" rows="6" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm"></textarea></div>
                <div class="flex flex-wrap gap-2">
                    <button type="button" onclick="LedgerFlowWhatsApp.sendToCurrentClient()" class="lf-btn lf-btn--primary">
                        <i class="fa-brands fa-whatsapp mr-1"></i> Open in WhatsApp
                    </button>
                    <button type="button" onclick="LedgerFlowWhatsApp.sendViaApi()" class="lf-btn lf-btn--secondary" ${appData.whatsappSettings?.mode !== 'business_api' ? 'disabled title="Enable Business API first"' : ''}>
                        <i class="fa-solid fa-paper-plane mr-1"></i> Send via API
                    </button>
                </div>
            </div>`;
    }

    function renderMessageLog(client) {
        ensureClientWhatsApp(client);
        const rows = client.whatsappMessages || [];
        return `
            <div class="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
                <div class="px-5 py-3 border-b border-slate-700 font-semibold text-sm">Message log — ${esc(client.name)}</div>
                <table class="w-full data-table lf-table lf-table--zebra text-sm">
                    <thead><tr><th>Date</th><th>Direction</th><th>Phone</th><th>Template</th><th>Preview</th><th>Status</th></tr></thead>
                    <tbody>
                        ${rows.length ? rows.map(m => `
                            <tr>
                                <td class="text-xs whitespace-nowrap">${esc((m.date || '').slice(0, 16).replace('T', ' '))}</td>
                                <td>${esc(m.direction || 'outbound')}</td>
                                <td class="font-mono text-xs">${esc(m.phone)}</td>
                                <td>${esc(m.template || '—')}</td>
                                <td class="text-xs text-slate-400 max-w-[200px] truncate">${esc(m.preview)}</td>
                                <td><span class="lf-badge lf-badge--${m.status === 'sent' || m.status === 'opened' ? 'success' : 'pending'}">${esc(m.status || 'pending')}</span></td>
                            </tr>`).join('') : `<tr><td colspan="6" class="text-center py-8 text-slate-400">No WhatsApp messages logged yet.</td></tr>`}
                    </tbody>
                </table>
            </div>`;
    }

    function renderClientQuickList() {
        if (typeof isFirmUser !== 'function' || !isFirmUser()) return '';
        const clients = Object.values(appData.clients || {});
        return `
            <div class="bg-slate-900 border border-slate-700 rounded-3xl p-5 mb-6">
                <div class="font-semibold text-sm mb-3">Quick WhatsApp — all clients</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    ${clients.map(c => `
                        <button type="button" onclick="LedgerFlowWhatsApp.quickChat('${c.id}')"
                            class="lf-wa-client-chip text-left ${!c.phone ? 'opacity-50' : ''}" ${!c.phone ? 'disabled' : ''}>
                            <i class="fa-brands fa-whatsapp text-[#25D366]"></i>
                            <span class="truncate">${esc(c.name)}</span>
                            <span class="text-[10px] text-slate-500 font-mono">${c.phone ? formatPhoneDisplay(c.phone) : 'No phone'}</span>
                        </button>`).join('')}
                </div>
            </div>`;
    }

    function openFirmSupportChat() {
        ensureWhatsAppSettings();
        const firm = appData.firmSettings || {};
        const firmPhone = appData.whatsappSettings?.businessPhone || firm.phone || '';
        const client = typeof getCurrentClient === 'function' ? getCurrentClient() : null;
        const msg = `Hello ${firm.name || 'team'},\n\nI need assistance regarding my account.\n\nRegards,\n${client?.name || 'Client'}`;
        openWhatsAppChat(firmPhone, msg, client, { template: 'client_support' });
    }

    function renderClientPortalWhatsApp(container) {
        ensureWhatsAppSettings();
        const firm = appData.firmSettings || {};
        const firmPhone = appData.whatsappSettings?.businessPhone || firm.phone || '';
        container.innerHTML = `
            <div class="max-w-lg mx-auto text-center">
                <div class="w-16 h-16 rounded-2xl bg-[#25D366]/15 flex items-center justify-center mx-auto mb-4">
                    <i class="fa-brands fa-whatsapp text-[#25D366] text-3xl"></i>
                </div>
                <h2 class="text-2xl font-semibold mb-2">Chat with your CA</h2>
                <p class="text-slate-400 text-sm mb-6">Message your accounting team on WhatsApp for quick support.</p>
                ${firmPhone ? `
                    <button type="button" onclick="LedgerFlowWhatsApp.openFirmSupportChat()"
                        class="lf-btn lf-btn--primary w-full py-3">
                        <i class="fa-brands fa-whatsapp mr-2"></i> Open WhatsApp
                    </button>
                    <p class="text-xs text-slate-500 mt-3">${formatPhoneDisplay(firmPhone)}</p>` : `
                    <p class="text-amber-400 text-sm">Your CA has not added a WhatsApp number yet. Use Messages &amp; Requests instead.</p>
                    <button type="button" onclick="showSection('requests')" class="lf-btn lf-btn--secondary mt-4">Go to Messages</button>`}
            </div>`;
    }

    function renderWhatsApp(container) {
        if (typeof isClientUser === 'function' && isClientUser()) {
            return renderClientPortalWhatsApp(container);
        }
        ensureWhatsAppSettings();
        const client = typeof getCurrentClient === 'function' ? getCurrentClient() : null;
        if (client) ensureClientWhatsApp(client);

        const isFirm = typeof isFirmUser === 'function' && isFirmUser();
        const header = typeof LedgerFlowDesign !== 'undefined'
            ? LedgerFlowDesign.renderPageHeader({
                title: 'WhatsApp Integration',
                subtitle: 'Message clients via WhatsApp — click-to-chat or Business API',
                actionsHtml: client?.phone ? `<button type="button" onclick="LedgerFlowWhatsApp.quickChat('${client.id}')" class="lf-btn lf-btn--primary lf-btn--sm"><i class="fa-brands fa-whatsapp mr-1"></i> Chat with ${esc(client.name)}</button>` : ''
            })
            : `<h2 class="text-2xl font-semibold mb-1">WhatsApp Integration</h2><p class="text-slate-400 text-sm mb-6">Message clients via WhatsApp</p>`;

        container.innerHTML = `
            <div class="max-w-4xl">
                ${header}
                ${isFirm ? renderConnectCard() : ''}
                ${client ? renderSendPanel(client) : ''}
                ${isFirm ? renderClientQuickList() : ''}
                ${client ? renderMessageLog(client) : '<p class="text-slate-400 text-sm">Select a client to view message log.</p>'}
            </div>`;

        if (client) previewTemplate();
    }

    function previewTemplate() {
        const client = typeof getCurrentClient === 'function' ? getCurrentClient() : null;
        if (!client) return;
        const tpl = document.getElementById('wa-template')?.value || 'custom';
        const invEl = document.getElementById('wa-invoice');
        const inv = invEl?.value || '';
        const amount = invEl?.selectedOptions?.[0]?.dataset?.amount || '';
        const body = fillTemplate(tpl, {
            clientName: client.name,
            invoice: inv,
            amount,
            document: 'GSTR-3B supporting documents',
            gstReturn: 'GSTR-3B',
            period: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
            dueDate: '20th of this month'
        });
        const ta = document.getElementById('wa-message-preview');
        if (ta) ta.value = body;
    }

    function sendToCurrentClient() {
        const client = getCurrentClient();
        const msg = document.getElementById('wa-message-preview')?.value?.trim();
        const tpl = document.getElementById('wa-template')?.value || 'custom';
        if (!msg) { showToast('Enter a message', 'error'); return; }
        openWhatsAppChat(client.phone, msg, client, { template: tpl });
        showSection('whatsapp');
    }

    async function sendViaApi() {
        const client = getCurrentClient();
        const msg = document.getElementById('wa-message-preview')?.value?.trim();
        const tpl = document.getElementById('wa-template')?.value || 'custom';
        if (!msg) { showToast('Enter a message', 'error'); return; }
        try {
            await sendViaBusinessApi(client.phone, msg);
            logWhatsAppMessage(client, {
                direction: 'outbound', channel: 'business_api', phone: formatPhoneDisplay(client.phone),
                template: tpl, preview: msg.slice(0, 120), status: 'sent',
                sentBy: currentUser?.name || 'Admin'
            });
            showToast('Message sent via WhatsApp API');
            showSection('whatsapp');
        } catch (e) {
            showToast(e.message || 'API send failed — use Open in WhatsApp', 'error');
        }
    }

    function quickChat(clientId) {
        const client = appData.clients[clientId];
        if (!client?.phone) { showToast('No phone number for this client', 'error'); return; }
        if (clientId !== currentClientId) {
            currentClientId = clientId;
            if (typeof populateClientSwitcher === 'function') populateClientSwitcher();
        }
        const msg = fillTemplate('welcome', { clientName: client.name });
        openWhatsAppChat(client.phone, msg, client, { template: 'welcome' });
    }

    function saveSettings() {
        if (!isFirmUser()) return;
        ensureWhatsAppSettings();
        const ws = appData.whatsappSettings;
        ws.displayName = document.getElementById('wa-display-name')?.value?.trim() || '';
        ws.businessPhone = document.getElementById('wa-business-phone')?.value?.trim() || '';
        ws.apiPhoneNumberId = document.getElementById('wa-phone-id')?.value?.trim() || '';
        ws.apiAccessToken = document.getElementById('wa-access-token')?.value?.trim() || '';
        ws.connected = !!(ws.apiPhoneNumberId && ws.apiAccessToken);
        saveAppData();
        showToast('WhatsApp settings saved');
        showSection('whatsapp');
    }

    function setMode(mode) {
        if (!isFirmUser()) return;
        ensureWhatsAppSettings();
        appData.whatsappSettings.mode = mode;
        if (mode === 'business_api' && !appData.whatsappSettings.apiPhoneNumberId) {
            showToast('Add Phone Number ID and Access Token below', 'info');
        }
        saveAppData();
        showSection('whatsapp');
    }

    async function testConnection() {
        if (!isFirmUser()) return;
        try {
            if (typeof LedgerFlowBackend !== 'undefined' && LedgerFlowBackend.enabled && LedgerFlowBackend.getWhatsAppConfig) {
                const data = await LedgerFlowBackend.getWhatsAppConfig();
                showToast(data.configured ? 'WhatsApp API configured on server' : 'Server API not configured — set WHATSAPP_* env vars', data.configured ? 'success' : 'info');
            } else {
                showToast('Business API requires cloud backend deployment', 'info');
            }
        } catch (e) {
            showToast('Connection test failed', 'error');
        }
    }

    function whatsAppButton(phone, clientId, template) {
        if (!phone) return '';
        return `<button type="button" onclick="LedgerFlowWhatsApp.quickChat('${esc(clientId)}')" class="lf-btn lf-btn--ghost lf-btn--sm lf-wa-btn" title="WhatsApp"><i class="fa-brands fa-whatsapp text-[#25D366]"></i></button>`;
    }

    window.LedgerFlowWhatsApp = {
        TEMPLATES,
        ensureWhatsAppSettings,
        ensureClientWhatsApp,
        normalizePhone,
        fillTemplate,
        buildWaMeUrl,
        openWhatsAppChat,
        renderWhatsApp,
        previewTemplate,
        sendToCurrentClient,
        sendViaApi,
        quickChat,
        openFirmSupportChat,
        saveSettings,
        setMode,
        testConnection,
        whatsAppButton,
        logWhatsAppMessage
    };

    const _origEnsure = window.ensureClientExtensions;
    window.ensureClientExtensions = function (client) {
        if (_origEnsure) _origEnsure(client);
        ensureClientWhatsApp(client);
    };
})();