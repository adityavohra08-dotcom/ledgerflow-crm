/**
 * LedgerFlow CRM — Portal Extensions
 * Service catalog orders, admin invoices, EMI calculator, bulk CSV tools.
 * Depends on globals from index.html: getCurrentClient, saveAppData, showToast, etc.
 */
(function () {
    'use strict';

    function esc(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function orderStatusBadge(status) {
        const map = {
            pending: 'bg-amber-900 text-amber-300',
            approved: 'bg-emerald-900 text-emerald-300',
            rejected: 'bg-red-900 text-red-300',
            invoiced: 'bg-blue-900 text-blue-300',
            completed: 'bg-slate-700 text-slate-300'
        };
        return `<span class="text-xs px-2.5 py-0.5 rounded-full font-bold ${map[status] || 'bg-slate-700 text-slate-300'}">${status}</span>`;
    }

    function invoiceStatusBadge(status) {
        const cls = status === 'paid' ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300';
        return `<span class="text-xs px-2.5 py-0.5 rounded-full font-bold ${cls}">${status === 'paid' ? 'Paid' : 'Unpaid'}</span>`;
    }

    window.ensureClientExtensions = function (client) {
        if (!client.serviceOrders) client.serviceOrders = [];
        if (!client.adminInvoices) client.adminInvoices = [];
        if (!client.logo) client.logo = '';
        (client.adminInvoices || []).forEach(inv => normalizeAdminInvoice(inv, client));
    };

    window.ensureFirmSettings = function () {
        const defaults = {
            name: 'WEALTH BUILDERS AND CONSULTANTS',
            email: 'adityavohra08@gmail.com',
            gstin: '07BMCPV9981J1Z5',
            pan: 'BMCPV9981J',
            address: 'A262, NEHRU VIHRA, CENTRAL DELHI-110054.',
            stateCode: '07',
            phone: '7982661921',
            logo: '',
            bank: { name: 'ICICI BANK', account: '113005000905', ifsc: 'ICIC0001130', branch: 'MUKHERJEE NAGAR, DELHI-110009' },
            terms: '1. Payment due within 7 days of invoice date.\n2. All disputes subject to Delhi jurisdiction.\n3. GST as applicable.',
            invoicePrefix: 'CA-INV'
        };
        if (!appData.firmSettings) appData.firmSettings = {};
        Object.keys(defaults).forEach(k => {
            if (appData.firmSettings[k] === undefined) appData.firmSettings[k] = defaults[k];
        });
        if (!appData.firmSettings.bank) appData.firmSettings.bank = { ...defaults.bank };
        else {
            ['name', 'account', 'ifsc', 'branch'].forEach(k => {
                if (appData.firmSettings.bank[k] === undefined) appData.firmSettings.bank[k] = '';
            });
        }
    };

    function calcInvoiceGST(taxable, gstPercent, supplierState, buyerState) {
        const gst = Math.round(taxable * gstPercent / 100 * 100) / 100;
        const interState = String(supplierState) !== String(buyerState);
        if (interState) return { cgst: 0, sgst: 0, igst: gst };
        const half = Math.round(gst / 2 * 100) / 100;
        return { cgst: half, sgst: half, igst: 0 };
    }

    window.normalizeAdminInvoice = function (inv, client) {
        if (!inv) return inv;
        if (inv.grandTotal !== undefined && inv.taxable !== undefined) return inv;
        const taxable = inv.taxable ?? inv.amount ?? 0;
        const gstPercent = inv.gstPercent ?? 18;
        ensureFirmSettings();
        const firm = appData.firmSettings;
        const taxes = calcInvoiceGST(taxable, gstPercent, firm.stateCode, client?.stateCode || inv.placeOfSupply);
        inv.taxable = taxable;
        inv.gstPercent = gstPercent;
        inv.hsnSac = inv.hsnSac || '9983';
        inv.cgst = inv.cgst ?? taxes.cgst;
        inv.sgst = inv.sgst ?? taxes.sgst;
        inv.igst = inv.igst ?? taxes.igst;
        inv.grandTotal = inv.grandTotal ?? Math.round((taxable + inv.cgst + inv.sgst + inv.igst) * 100) / 100;
        inv.placeOfSupply = inv.placeOfSupply || client?.stateCode || firm.stateCode;
        inv.invoiceType = inv.invoiceType || 'Tax Invoice';
        return inv;
    };

    function getAdminInvTotals(inv) {
        return {
            taxable: inv.taxable || 0,
            cgst: inv.cgst || 0,
            sgst: inv.sgst || 0,
            igst: inv.igst || 0,
            grandTotal: inv.grandTotal || inv.amount || 0
        };
    }

    window.parseCSVText = function (text) {
        const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) return { headers: [], rows: [] };
        const parseRow = line => {
            const result = [];
            let cur = '', inQ = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') { inQ = !inQ; continue; }
                if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
                cur += ch;
            }
            result.push(cur.trim());
            return result;
        };
        const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
        const rows = lines.slice(1).map(line => {
            const vals = parseRow(line);
            const obj = {};
            headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
            return obj;
        });
        return { headers, rows };
    };

    window.readCSVFile = function (input, callback) {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => callback(e.target.result, file.name);
        reader.readAsText(file);
        input.value = '';
    };

    // ==================== BUY SERVICES CATALOG ====================
    window.renderBuyServices = function (container) {
        const client = getCurrentClient();
        ensureClientExtensions(client);
        const isClient = isClientUser();
        const catalog = window.SERVICE_CATALOG || [];
        const myOrders = client.serviceOrders;

        container.innerHTML = `
            <div class="mb-6">
                <h2 class="text-2xl font-semibold tracking-tight">Buy New Services</h2>
                <p class="text-sm text-slate-400">${isClient
                    ? 'Browse our service catalog and raise a purchase request to your CA'
                    : `Service catalog for ${client.name} — view client purchase requests`}</p>
            </div>

            <div class="mb-6 flex flex-wrap gap-2" id="catalog-filter">
                <button onclick="filterServiceCatalog('all')" class="catalog-filter-btn px-4 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white" data-cat="all">All Categories</button>
                ${catalog.map(c => `
                    <button onclick="filterServiceCatalog('${c.id}')" class="catalog-filter-btn px-4 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 border border-slate-700 hover:border-emerald-600" data-cat="${c.id}">
                        <i class="fa-solid ${c.icon} mr-1"></i> ${c.name}
                    </button>
                `).join('')}
            </div>

            <div class="space-y-6" id="catalog-sections">
                ${catalog.map(cat => `
                    <div class="catalog-section bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden" data-category="${cat.id}">
                        <div class="px-6 py-4 border-b border-slate-700 flex items-center gap-3 bg-slate-950/50">
                            <i class="fa-solid ${cat.icon} text-${cat.color}-400 text-xl"></i>
                            <div class="font-semibold text-lg">${cat.name}</div>
                            <span class="text-xs text-slate-500 ml-auto">${cat.services.length} services</span>
                        </div>
                        <div class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            ${cat.services.map((svc, idx) => `
                                <div class="service-card flex items-center justify-between gap-2 p-3 bg-slate-950 border border-slate-800 rounded-2xl hover:border-emerald-700 transition-colors">
                                    <span class="text-sm font-medium">${esc(svc)}</span>
                                    ${isClient ? `<button onclick="submitServiceOrder('${cat.id}', ${idx})" class="shrink-0 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold whitespace-nowrap">
                                        <i class="fa-solid fa-cart-plus mr-1"></i> Request
                                    </button>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="mt-8 bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
                <div class="px-6 py-4 border-b border-slate-700 font-semibold flex items-center gap-2">
                    <i class="fa-solid fa-list-check text-amber-400"></i>
                    ${isClient ? 'My Purchase Requests' : `Purchase Requests — ${client.name}`}
                </div>
                <table class="w-full data-table text-sm">
                    <thead><tr>
                        <th>Date</th><th>Category</th><th>Service</th><th>Status</th><th>Notes</th><th></th>
                    </tr></thead>
                    <tbody>
                        ${myOrders.length ? myOrders.map(o => `
                            <tr>
                                <td class="text-xs">${o.date}</td>
                                <td><span class="text-xs px-2 py-0.5 bg-slate-800 rounded">${esc(o.categoryName)}</span></td>
                                <td class="font-medium">${esc(o.serviceName)}</td>
                                <td>${orderStatusBadge(o.status)}</td>
                                <td class="text-xs text-slate-400 max-w-[200px] truncate">${esc(o.notes || o.modifyRequest || '—')}</td>
                                <td class="text-right whitespace-nowrap">
                                    ${isClient && !['rejected','completed'].includes(o.status) ? `
                                        <button onclick="requestOrderModification('${o.id}')" class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg" title="Request cancel or modify">
                                            <i class="fa-solid fa-pen-to-square"></i> Modify/Cancel
                                        </button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('') : `<tr><td colspan="6" class="text-center py-8 text-slate-400">No purchase requests yet.${isClient ? ' Browse the catalog above to request a service.' : ''}</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;
    };

    window.filterServiceCatalog = function (catId) {
        document.querySelectorAll('.catalog-filter-btn').forEach(btn => {
            const active = btn.dataset.cat === catId;
            btn.className = `catalog-filter-btn px-4 py-1.5 text-xs font-semibold rounded-xl ${active ? 'bg-emerald-600 text-white' : 'bg-slate-800 border border-slate-700 hover:border-emerald-600'}`;
        });
        document.querySelectorAll('.catalog-section').forEach(sec => {
            sec.classList.toggle('hidden', catId !== 'all' && sec.dataset.category !== catId);
        });
    };

    window.submitServiceOrder = function (categoryId, serviceIndex) {
        if (!isClientUser()) return;
        const cat = (window.SERVICE_CATALOG || []).find(c => c.id === categoryId);
        if (!cat) return;
        const serviceName = cat.services[serviceIndex];
        if (!serviceName) return;
        const notes = prompt(`Additional notes for "${serviceName}" (optional):`) || '';
        const client = getCurrentClient();
        ensureClientExtensions(client);
        const order = {
            id: 'so_' + Date.now(),
            categoryId,
            categoryName: cat.name,
            serviceName,
            notes,
            status: 'pending',
            date: new Date().toISOString().split('T')[0],
            modifyRequest: '',
            approvedAt: '',
            approvedBy: ''
        };
        client.serviceOrders.unshift(order);
        saveAppData();
        notifyAdminNewServiceOrder(client, order);
        showToast(`Purchase request submitted for ${serviceName}`);
        showSection('buy-services');
    };

    window.requestOrderModification = function (orderId) {
        if (!isClientUser()) return;
        const client = getCurrentClient();
        const order = client.serviceOrders.find(o => o.id === orderId);
        if (!order) return;
        const msg = prompt('Describe your request to cancel or modify this order (sent to admin):');
        if (!msg) return;
        order.modifyRequest = msg;
        order.modifyRequestedAt = new Date().toISOString().split('T')[0];
        saveAppData();
        showToast('Modification/cancel request sent to admin');
        showSection('buy-services');
    };

    function notifyAdminNewServiceOrder(client, order) {
        const adminEmail = appData.firmSettings?.email || 'adityavohra08@gmail.com';
        const subject = encodeURIComponent(`[LedgerFlow] New service purchase request — ${client.name}`);
        const body = encodeURIComponent(`Client: ${client.name}\nService: ${order.serviceName}\nCategory: ${order.categoryName}\nNotes: ${order.notes || '—'}\n\nLog in to Firm portal → Service Orders to approve.`);
        window.open(`mailto:${adminEmail}?subject=${subject}&body=${body}`, '_blank');
    }

    // ==================== SERVICE ORDERS (ADMIN) ====================
    window.renderServiceOrders = function (container) {
        if (!isFirmUser()) {
            container.innerHTML = '<div class="text-red-400">Admin access only.</div>';
            return;
        }
        const client = getCurrentClient();
        ensureClientExtensions(client);
        const orders = client.serviceOrders;

        container.innerHTML = `
            <div class="mb-6">
                <h2 class="text-2xl font-semibold tracking-tight">Service Orders — ${esc(client.name)}</h2>
                <p class="text-sm text-slate-400">Approve client purchase requests and raise invoices for approved services</p>
            </div>

            <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                    <div class="text-xs text-slate-400">Pending Approval</div>
                    <div class="text-3xl font-bold text-amber-400">${orders.filter(o => o.status === 'pending').length}</div>
                </div>
                <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                    <div class="text-xs text-slate-400">Approved (Awaiting Invoice)</div>
                    <div class="text-3xl font-bold text-emerald-400">${orders.filter(o => o.status === 'approved').length}</div>
                </div>
                <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                    <div class="text-xs text-slate-400">Invoiced</div>
                    <div class="text-3xl font-bold text-blue-400">${orders.filter(o => o.status === 'invoiced').length}</div>
                </div>
            </div>

            <div class="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
                <table class="w-full data-table text-sm">
                    <thead><tr>
                        <th>Date</th><th>Service</th><th>Category</th><th>Status</th><th>Client Notes</th><th>Modify Request</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                        ${orders.length ? orders.map(o => `
                            <tr>
                                <td class="text-xs">${o.date}</td>
                                <td class="font-medium">${esc(o.serviceName)}</td>
                                <td class="text-xs">${esc(o.categoryName)}</td>
                                <td>${orderStatusBadge(o.status)}</td>
                                <td class="text-xs text-slate-400 max-w-[120px] truncate">${esc(o.notes || '—')}</td>
                                <td class="text-xs text-amber-400 max-w-[120px] truncate">${esc(o.modifyRequest || '—')}</td>
                                <td class="whitespace-nowrap">
                                    ${o.status === 'pending' ? `
                                        <button onclick="approveServiceOrder('${o.id}')" class="text-xs px-2 py-1 bg-emerald-600 rounded-lg mr-1">Approve</button>
                                        <button onclick="rejectServiceOrder('${o.id}')" class="text-xs px-2 py-1 bg-red-800 rounded-lg">Reject</button>
                                    ` : ''}
                                    ${o.status === 'approved' ? `
                                        <button onclick="openRaiseAdminInvoiceModal('${o.id}')" class="text-xs px-2 py-1 bg-blue-600 rounded-lg">Raise GST Invoice</button>
                                    ` : ''}
                                    ${o.status === 'invoiced' ? `<span class="text-xs text-slate-500">Invoiced</span>` : ''}
                                </td>
                            </tr>
                        `).join('') : `<tr><td colspan="7" class="text-center py-8 text-slate-400">No service orders for this client.</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;
    };

    window.approveServiceOrder = function (orderId) {
        if (!isFirmUser()) return;
        const client = getCurrentClient();
        const order = client.serviceOrders.find(o => o.id === orderId);
        if (!order) return;
        order.status = 'approved';
        order.approvedAt = new Date().toISOString().split('T')[0];
        order.approvedBy = currentUser?.name || 'Admin';
        saveAppData();
        showToast('Service order approved');
        showSection('service-orders');
    };

    window.rejectServiceOrder = function (orderId) {
        if (!isFirmUser()) return;
        const reason = prompt('Rejection reason (optional):') || 'Not approved';
        const client = getCurrentClient();
        const order = client.serviceOrders.find(o => o.id === orderId);
        if (!order) return;
        order.status = 'rejected';
        order.rejectionReason = reason;
        saveAppData();
        showToast('Service order rejected');
        showSection('service-orders');
    };

    // ==================== FIRM PROFILE (ADMIN) ====================
    window.renderFirmProfile = function (container) {
        if (!isFirmUser()) {
            container.innerHTML = '<div class="text-red-400">Admin access only.</div>';
            return;
        }
        ensureFirmSettings();
        const firm = appData.firmSettings;

        const moduleGuide = typeof LedgerFlowModules !== 'undefined'
            ? LedgerFlowModules.renderModuleGuide('settings', { checkedFeatures: ['Logo upload', 'Tax settings', 'User roles'] })
            : '';
        const hierarchyGuide = typeof LedgerFlowPages !== 'undefined'
            ? LedgerFlowPages.renderPageHierarchyGuide('firm')
            : '';
        const philosophyGuide = typeof LedgerFlowDesign !== 'undefined'
            ? LedgerFlowDesign.renderDesignPhilosophyGuide()
            : '';
        const paletteGuide = typeof LedgerFlowColors !== 'undefined'
            ? LedgerFlowColors.renderColorPaletteGuide()
            : '';
        const typographyGuide = typeof LedgerFlowType !== 'undefined'
            ? LedgerFlowType.renderTypographyGuide()
            : '';
        const layoutGuide = typeof LedgerFlowLayout !== 'undefined'
            ? LedgerFlowLayout.renderLayoutGuide()
            : '';
        const keyScreensGuide = typeof LedgerFlowScreens !== 'undefined'
            ? LedgerFlowScreens.renderKeyScreensGuide()
            : '';
        const componentsGuide = typeof LedgerFlowComponents !== 'undefined'
            ? LedgerFlowComponents.renderComponentsGuide()
            : '';
        const capabilitiesGuide = typeof LedgerFlowCapabilities !== 'undefined'
            ? LedgerFlowCapabilities.renderCapabilitiesGuide()
            : '';

        const appearanceCard = typeof LedgerFlowTheme !== 'undefined'
            ? LedgerFlowTheme.renderAppearanceCard()
            : '';

        container.innerHTML = `
            <div class="max-w-3xl">
                ${appearanceCard}
                ${paletteGuide}
                ${typographyGuide}
                ${layoutGuide}
                ${keyScreensGuide}
                ${componentsGuide}
                ${capabilitiesGuide}
                ${philosophyGuide}
                ${moduleGuide}
                ${hierarchyGuide}
                <h2 class="text-2xl font-semibold tracking-tight mb-1">Firm Profile &amp; GST Details</h2>
                <p class="text-slate-400 mb-6 text-sm">Your company details auto-populate on GST tax invoices raised to clients for service purchases</p>

                <div class="mb-4 p-4 bg-amber-900/20 border border-amber-800 rounded-2xl text-xs text-amber-300">
                    <i class="fa-solid fa-receipt mr-1"></i>
                    Complete GSTIN, PAN, address and bank details before raising invoices. These appear on every client service invoice (CGST Rule 46).
                </div>

                <div class="bg-slate-900 border border-slate-700 rounded-3xl p-7 space-y-6">
                    <div class="pb-4 border-b border-slate-700">
                        <label class="text-xs font-medium text-slate-400 block mb-2">Firm Logo (on admin invoices)</label>
                        <div class="flex items-center gap-4">
                            <div class="w-24 h-24 bg-slate-950 border border-slate-700 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer"
                                 onclick="document.getElementById('firm-logo-upload').click()">
                                <img id="firm-logo-preview" src="${firm.logo || ''}" class="max-w-full max-h-full object-contain ${firm.logo ? '' : 'hidden'}" alt="Logo">
                                <div id="firm-logo-placeholder" class="text-center text-xs text-slate-500 ${firm.logo ? 'hidden' : ''}">
                                    <i class="fa-solid fa-image text-2xl mb-1 block text-slate-600"></i> Upload
                                </div>
                            </div>
                            <div class="text-xs text-slate-400 space-y-2">
                                <input type="file" id="firm-logo-upload" accept="image/*" class="hidden" onchange="handleFirmLogoUpload(this)">
                                <button type="button" onclick="document.getElementById('firm-logo-upload').click()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-sm font-semibold block">
                                    <i class="fa-solid fa-upload mr-1"></i> Upload Logo
                                </button>
                                ${firm.logo ? `<button type="button" onclick="removeFirmLogo()" class="text-red-400 hover:text-red-300 text-xs">Remove logo</button>` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label class="text-xs font-medium text-slate-400 block mb-1">Firm / Company Name *</label>
                            <input id="firm-name" value="${esc(firm.name)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm">
                        </div>
                        <div>
                            <label class="text-xs font-medium text-slate-400 block mb-1">Email</label>
                            <input id="firm-email" value="${esc(firm.email)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm">
                        </div>
                        <div>
                            <label class="text-xs font-medium text-slate-400 block mb-1">GSTIN *</label>
                            <input id="firm-gstin" value="${esc(firm.gstin)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm font-mono">
                        </div>
                        <div>
                            <label class="text-xs font-medium text-slate-400 block mb-1">PAN</label>
                            <input id="firm-pan" value="${esc(firm.pan)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm font-mono">
                        </div>
                    </div>

                    <div>
                        <label class="text-xs font-medium text-slate-400 block mb-1">Registered Address *</label>
                        <textarea id="firm-address" rows="2" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm">${esc(firm.address)}</textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-5">
                        <div>
                            <label class="text-xs font-medium text-slate-400 block mb-1">State (for CGST/SGST)</label>
                            <select id="firm-state" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm">
                                ${stateList.map(s => `<option value="${s.code}" ${s.code === firm.stateCode ? 'selected' : ''}>${s.name} (${s.code})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="text-xs font-medium text-slate-400 block mb-1">Phone</label>
                            <input id="firm-phone" value="${esc(firm.phone)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm">
                        </div>
                    </div>

                    <div class="pt-4 border-t border-slate-700">
                        <div class="font-semibold mb-3">Bank Details (printed on invoices)</div>
                        <div class="grid grid-cols-2 gap-5">
                            <div>
                                <label class="text-xs font-medium text-slate-400 block mb-1">Bank Name</label>
                                <input id="firm-bank-name" value="${esc(firm.bank.name)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2 text-sm">
                            </div>
                            <div>
                                <label class="text-xs font-medium text-slate-400 block mb-1">Account Number</label>
                                <input id="firm-bank-account" value="${esc(firm.bank.account)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2 text-sm font-mono">
                            </div>
                            <div>
                                <label class="text-xs font-medium text-slate-400 block mb-1">IFSC Code</label>
                                <input id="firm-bank-ifsc" value="${esc(firm.bank.ifsc)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2 text-sm font-mono">
                            </div>
                            <div>
                                <label class="text-xs font-medium text-slate-400 block mb-1">Branch</label>
                                <input id="firm-bank-branch" value="${esc(firm.bank.branch)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2 text-sm">
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-5">
                        <div>
                            <label class="text-xs font-medium text-slate-400 block mb-1">Invoice Number Prefix</label>
                            <input id="firm-inv-prefix" value="${esc(firm.invoicePrefix)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm font-mono">
                        </div>
                    </div>

                    <div>
                        <label class="text-xs font-medium text-slate-400 block mb-1">Default Terms &amp; Conditions</label>
                        <textarea id="firm-terms" rows="4" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs">${esc(firm.terms)}</textarea>
                    </div>

                    <button onclick="saveFirmProfile()" class="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl font-semibold">
                        <i class="fa-solid fa-save mr-2"></i> Save Firm Profile
                    </button>
                </div>
            </div>
        `;
    };

    window.saveFirmProfile = function () {
        if (!isFirmUser()) return;
        ensureFirmSettings();
        const firm = appData.firmSettings;
        firm.name = document.getElementById('firm-name').value.trim();
        firm.email = document.getElementById('firm-email').value.trim();
        firm.gstin = document.getElementById('firm-gstin').value.trim();
        firm.pan = document.getElementById('firm-pan').value.trim();
        firm.address = document.getElementById('firm-address').value.trim();
        firm.stateCode = document.getElementById('firm-state').value;
        firm.phone = document.getElementById('firm-phone').value.trim();
        firm.bank.name = document.getElementById('firm-bank-name').value.trim();
        firm.bank.account = document.getElementById('firm-bank-account').value.trim();
        firm.bank.ifsc = document.getElementById('firm-bank-ifsc').value.trim();
        firm.bank.branch = document.getElementById('firm-bank-branch').value.trim();
        firm.invoicePrefix = document.getElementById('firm-inv-prefix').value.trim() || 'CA-INV';
        firm.terms = document.getElementById('firm-terms').value;
        saveAppData();
        showToast('Firm profile saved — used on all GST invoices to clients');
    };

    window.handleFirmLogoUpload = function (input) {
        if (!isFirmUser()) return;
        const file = input.files?.[0];
        if (!file || !file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            ensureFirmSettings();
            appData.firmSettings.logo = e.target.result;
            saveAppData();
            const preview = document.getElementById('firm-logo-preview');
            const placeholder = document.getElementById('firm-logo-placeholder');
            if (preview) { preview.src = appData.firmSettings.logo; preview.classList.remove('hidden'); }
            if (placeholder) placeholder.classList.add('hidden');
            showToast('Firm logo saved');
        };
        reader.readAsDataURL(file);
    };

    window.removeFirmLogo = function () {
        if (!isFirmUser()) return;
        ensureFirmSettings();
        appData.firmSettings.logo = '';
        saveAppData();
        const preview = document.getElementById('firm-logo-preview');
        const placeholder = document.getElementById('firm-logo-placeholder');
        if (preview) { preview.src = ''; preview.classList.add('hidden'); }
        if (placeholder) placeholder.classList.remove('hidden');
        showToast('Firm logo removed');
    };

    const OTHER_INVOICE_CATEGORIES = [
        'Professional Fees',
        'Consultation Charges',
        'Audit & Compliance',
        'Bookkeeping & Accounting',
        'GSTR Filing',
        'ITR Filing',
        'ROC / MCA Filing',
        'Annual Retainer',
        'Reimbursement',
        'Miscellaneous'
    ];

    function adminInvoiceSourceBadge(inv) {
        const src = inv.invoiceSource || (inv.orderId ? 'service_order' : 'other');
        if (src === 'service_order') {
            return '<span class="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300">Service Order</span>';
        }
        return '<span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300">Other Invoice</span>';
    }

    function nextAdminInvoiceNumber(client) {
        ensureFirmSettings();
        const prefix = appData.firmSettings.invoicePrefix || 'CA-INV';
        return prefix + '-' + new Date().getFullYear() + '-' + String((client.adminInvoices || []).length + 1).padStart(4, '0');
    }

    // ==================== ADMIN GST INVOICES ====================
    window.renderAdminInvoices = function (container) {
        const client = getCurrentClient();
        ensureClientExtensions(client);
        const isClient = isClientUser();
        const isFirm = isFirmUser();
        const invoices = client.adminInvoices;

        container.innerHTML = `
            <div class="mb-6 flex flex-wrap justify-between items-start gap-4">
                <div>
                    <h2 class="text-2xl font-semibold tracking-tight">${isClient ? 'GST Invoices from Your CA' : 'Admin GST Invoices — ' + esc(client.name)}</h2>
                    <p class="text-sm text-slate-400">${isClient
                        ? 'Download GST tax invoices from your CA. Upload payment receipts for admin approval.'
                        : 'Raise GST invoices for service orders or any other professional charges'}</p>
                </div>
                ${isFirm ? `
                <button onclick="openRaiseOtherInvoiceModal()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-sm font-semibold flex items-center gap-2 shrink-0">
                    <i class="fa-solid fa-file-invoice-dollar"></i> Raise Other Invoice
                </button>` : ''}
            </div>

            ${isFirm ? `
            <div class="mb-6 p-4 bg-blue-950/30 border border-blue-800 rounded-2xl text-xs text-blue-300 flex justify-between items-center flex-wrap gap-2">
                <span><i class="fa-solid fa-info-circle mr-1"></i> Raise invoices from <strong>Service Orders</strong> (after approval) or <strong>Raise Other Invoice</strong> for consultation, retainers, filings, etc.</span>
                <button onclick="showSection('firm-profile')" class="underline font-semibold shrink-0">Firm Profile</button>
            </div>` : ''}

            <div class="bg-slate-900 border border-slate-700 rounded-3xl overflow-x-auto">
                <table class="w-full data-table text-sm min-w-[960px]">
                    <thead><tr>
                        <th>Invoice No</th><th>Date</th><th>Type</th><th>Description</th>
                        <th class="text-right">Taxable</th><th class="text-right">CGST</th><th class="text-right">SGST</th><th class="text-right">IGST</th>
                        <th class="text-right">Grand Total</th><th>Payment</th><th>Receipt</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                        ${invoices.length ? invoices.map(inv => {
                            normalizeAdminInvoice(inv, client);
                            const t = getAdminInvTotals(inv);
                            return `
                            <tr>
                                <td class="font-mono font-semibold">${esc(inv.number)}</td>
                                <td>${inv.date}</td>
                                <td>${adminInvoiceSourceBadge(inv)}</td>
                                <td class="font-medium">
                                    <div>${esc(inv.serviceName)}</div>
                                    ${inv.categoryName ? `<div class="text-[10px] text-slate-500">${esc(inv.categoryName)}</div>` : ''}
                                </td>
                                <td class="text-right">₹${t.taxable.toLocaleString('en-IN')}</td>
                                <td class="text-right text-emerald-400">${t.cgst ? '₹' + t.cgst.toLocaleString('en-IN') : '—'}</td>
                                <td class="text-right text-emerald-400">${t.sgst ? '₹' + t.sgst.toLocaleString('en-IN') : '—'}</td>
                                <td class="text-right text-blue-400">${t.igst ? '₹' + t.igst.toLocaleString('en-IN') : '—'}</td>
                                <td class="text-right font-bold">₹${t.grandTotal.toLocaleString('en-IN')}</td>
                                <td>${invoiceStatusBadge(inv.paymentStatus)}</td>
                                <td class="text-xs">
                                    ${inv.receiptStatus === 'pending' ? '<span class="text-amber-400">Pending Review</span>' :
                                      inv.receiptStatus === 'approved' ? '<span class="text-emerald-400">Approved</span>' :
                                      inv.receiptFileName ? esc(inv.receiptFileName) : '—'}
                                </td>
                                <td class="whitespace-nowrap text-right">
                                    <button onclick="downloadAdminInvoicePDF('${inv.id}')" title="Download PDF" class="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg mr-1">
                                        <i class="fa-solid fa-file-pdf text-red-400"></i> PDF
                                    </button>
                                    ${isClient && inv.paymentStatus !== 'paid' ? `
                                        <label class="text-xs px-2 py-1 bg-emerald-800 hover:bg-emerald-700 rounded-lg cursor-pointer inline-block">
                                            <i class="fa-solid fa-receipt"></i>
                                            <input type="file" class="hidden" accept="image/*,.pdf" onchange="uploadPaymentReceipt('${inv.id}', this)">
                                        </label>
                                    ` : ''}
                                    ${isFirm ? `
                                        <button onclick="toggleAdminInvoicePaid('${inv.id}')" class="text-xs px-2 py-1 ${inv.paymentStatus === 'paid' ? 'bg-amber-700' : 'bg-emerald-600'} rounded-lg mr-1">
                                            ${inv.paymentStatus === 'paid' ? 'Unpaid' : 'Paid'}
                                        </button>
                                        ${inv.receiptStatus === 'pending' ? `
                                            <button onclick="approvePaymentReceipt('${inv.id}')" class="text-xs px-2 py-1 bg-blue-600 rounded-lg">Approve</button>
                                        ` : ''}
                                    ` : ''}
                                </td>
                            </tr>`;
                        }).join('') : `<tr><td colspan="12" class="text-center py-12 text-slate-400">No admin invoices yet.${isFirm ? ' Use Raise Other Invoice or approve a service order first.' : ''}</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;
    };

    function showRaiseAdminInvoiceModal(opts) {
        const { orderId = null, isManual = false } = opts;
        if (!isFirmUser()) return;
        ensureFirmSettings();
        const firm = appData.firmSettings;
        if (!firm.gstin || !firm.name) {
            showToast('Complete Firm Profile (GSTIN & name) before raising invoices', 'error');
            showSection('firm-profile');
            return;
        }
        const client = getCurrentClient();
        ensureClientExtensions(client);

        let order = null;
        if (!isManual) {
            order = client.serviceOrders.find(o => o.id === orderId);
            if (!order || order.status !== 'approved') {
                showToast('Order must be approved first', 'error');
                return;
            }
        }

        const existing = document.getElementById('raise-admin-inv-modal');
        if (existing) existing.remove();

        const invNum = nextAdminInvoiceNumber(client);
        const today = new Date().toISOString().split('T')[0];
        const due = new Date();
        due.setDate(due.getDate() + 7);
        const dueStr = due.toISOString().split('T')[0];
        const submitKey = isManual ? 'manual' : orderId;

        const modal = document.createElement('div');
        modal.id = 'raise-admin-inv-modal';
        modal.className = 'fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h3 class="text-lg font-semibold">${isManual ? 'Raise Other GST Invoice' : 'Raise GST Tax Invoice'}</h3>
                        <p class="text-xs text-slate-400">${isManual
                            ? 'Professional fees, retainers, filings & other charges — ' + esc(client.name)
                            : esc(order.serviceName) + ' — ' + esc(client.name)}</p>
                    </div>
                    <button onclick="closeRaiseAdminInvoiceModal()" class="text-slate-400 hover:text-white"><i class="fa-solid fa-times text-xl"></i></button>
                </div>

                <input type="hidden" id="rai-mode" value="${isManual ? 'manual' : 'order'}">

                <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                        <label class="text-xs text-slate-400">Invoice No</label>
                        <input id="rai-number" value="${invNum}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono">
                    </div>
                    <div>
                        <label class="text-xs text-slate-400">Invoice Date</label>
                        <input type="date" id="rai-date" value="${today}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm">
                    </div>
                    ${isManual ? `
                    <div class="col-span-2">
                        <label class="text-xs text-slate-400">Invoice Category</label>
                        <select id="rai-category" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm">
                            ${OTHER_INVOICE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                    </div>` : ''}
                    <div class="col-span-2">
                        <label class="text-xs text-slate-400">${isManual ? 'Description / Particulars' : 'Service Description'}</label>
                        <input id="rai-service" value="${isManual ? '' : esc(order.serviceName)}" placeholder="${isManual ? 'e.g. Monthly bookkeeping — June 2026' : ''}"
                               class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm">
                    </div>
                    <div>
                        <label class="text-xs text-slate-400">HSN/SAC Code</label>
                        <input id="rai-hsn" value="9983" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono">
                    </div>
                    <div>
                        <label class="text-xs text-slate-400">Due Date</label>
                        <input type="date" id="rai-due" value="${dueStr}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm">
                    </div>
                    <div>
                        <label class="text-xs text-slate-400">GST Rate (%)</label>
                        <select id="rai-gst" onchange="updateRaiseInvoiceTotals()" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm">
                            <option value="0">0% (Exempt)</option>
                            <option value="5">5%</option>
                            <option value="12">12%</option>
                            <option value="18" selected>18%</option>
                            <option value="28">28%</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs text-slate-400">Taxable Amount (₹)</label>
                        <input type="number" id="rai-taxable" min="0" step="0.01" placeholder="Enter amount before GST"
                               class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono"
                               oninput="updateRaiseInvoiceTotals()">
                    </div>
                    <div>
                        <label class="text-xs text-slate-400">Place of Supply</label>
                        <select id="rai-pos" onchange="updateRaiseInvoiceTotals()" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm">
                            ${stateList.map(s => `<option value="${s.code}" ${s.code === (client.stateCode || firm.stateCode) ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-span-2">
                        <label class="text-xs text-slate-400">Notes (optional)</label>
                        <input id="rai-notes" placeholder="Additional invoice notes" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm">
                    </div>
                </div>

                <div class="bg-slate-950 border border-slate-700 rounded-2xl p-4 mb-4 text-sm">
                    <div class="text-xs text-slate-400 mb-2">GST BREAKDOWN</div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>Taxable: <span id="rai-preview-taxable" class="font-mono font-semibold">₹0</span></div>
                        <div>CGST: <span id="rai-preview-cgst" class="font-mono text-emerald-400">₹0</span></div>
                        <div>SGST: <span id="rai-preview-sgst" class="font-mono text-emerald-400">₹0</span></div>
                        <div>IGST: <span id="rai-preview-igst" class="font-mono text-blue-400">₹0</span></div>
                        <div class="col-span-2 pt-2 border-t border-slate-700 font-bold">Grand Total: <span id="rai-preview-total" class="text-lg">₹0</span></div>
                    </div>
                    <div class="text-[10px] text-slate-500 mt-2" id="rai-tax-type">Same state → CGST + SGST | Different state → IGST</div>
                </div>

                <div class="flex gap-3">
                    <button onclick="closeRaiseAdminInvoiceModal()" class="flex-1 py-2.5 bg-slate-800 border border-slate-600 rounded-xl text-sm">Cancel</button>
                    <button onclick="submitRaiseAdminInvoice('${submitKey}')" class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold">
                        <i class="fa-solid fa-file-invoice mr-1"></i> Raise GST Invoice
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        updateRaiseInvoiceTotals();
    }

    window.openRaiseAdminInvoiceModal = function (orderId) {
        showRaiseAdminInvoiceModal({ orderId, isManual: false });
    };

    window.openRaiseOtherInvoiceModal = function () {
        showRaiseAdminInvoiceModal({ isManual: true });
    };

    window.closeRaiseAdminInvoiceModal = function () {
        const modal = document.getElementById('raise-admin-inv-modal');
        if (modal) modal.remove();
    };

    window.updateRaiseInvoiceTotals = function () {
        ensureFirmSettings();
        const firm = appData.firmSettings;
        const client = getCurrentClient();
        const taxable = parseFloat(document.getElementById('rai-taxable')?.value) || 0;
        const gstPercent = parseFloat(document.getElementById('rai-gst')?.value) || 0;
        const pos = document.getElementById('rai-pos')?.value || client.stateCode;
        const taxes = calcInvoiceGST(taxable, gstPercent, firm.stateCode, pos);
        const grand = Math.round((taxable + taxes.cgst + taxes.sgst + taxes.igst) * 100) / 100;
        const inter = String(firm.stateCode) !== String(pos);

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = '₹' + v.toLocaleString('en-IN'); };
        set('rai-preview-taxable', taxable);
        set('rai-preview-cgst', taxes.cgst);
        set('rai-preview-sgst', taxes.sgst);
        set('rai-preview-igst', taxes.igst);
        set('rai-preview-total', grand);
        const typeEl = document.getElementById('rai-tax-type');
        if (typeEl) typeEl.textContent = inter
            ? `Inter-state supply → IGST @ ${gstPercent}%`
            : `Intra-state supply → CGST + SGST @ ${gstPercent / 2}% each`;
    };

    window.submitRaiseAdminInvoice = function (orderIdOrManual) {
        if (!isFirmUser()) return;
        ensureFirmSettings();
        const firm = appData.firmSettings;
        const client = getCurrentClient();
        ensureClientExtensions(client);

        const isManual = orderIdOrManual === 'manual';
        const order = isManual ? null : client.serviceOrders.find(o => o.id === orderIdOrManual);
        if (!isManual && !order) return;

        const serviceName = document.getElementById('rai-service')?.value.trim();
        if (!serviceName) { showToast('Enter invoice description', 'error'); return; }

        const taxable = parseFloat(document.getElementById('rai-taxable')?.value) || 0;
        if (taxable <= 0) { showToast('Enter taxable amount', 'error'); return; }

        const gstPercent = parseFloat(document.getElementById('rai-gst')?.value) || 0;
        const pos = document.getElementById('rai-pos')?.value;
        const taxes = calcInvoiceGST(taxable, gstPercent, firm.stateCode, pos);
        const grandTotal = Math.round((taxable + taxes.cgst + taxes.sgst + taxes.igst) * 100) / 100;

        const categoryName = isManual
            ? (document.getElementById('rai-category')?.value || 'Other')
            : order.categoryName;

        const invoice = {
            id: 'ainv_' + Date.now(),
            orderId: isManual ? '' : order.id,
            invoiceSource: isManual ? 'other' : 'service_order',
            number: document.getElementById('rai-number').value.trim(),
            date: document.getElementById('rai-date').value,
            dueDate: document.getElementById('rai-due')?.value || '',
            serviceName,
            categoryName,
            hsnSac: document.getElementById('rai-hsn').value.trim() || '9983',
            taxable,
            gstPercent,
            cgst: taxes.cgst,
            sgst: taxes.sgst,
            igst: taxes.igst,
            grandTotal,
            placeOfSupply: pos,
            invoiceType: 'Tax Invoice',
            description: document.getElementById('rai-notes')?.value.trim() || '',
            billTo: {
                name: client.name,
                gstin: client.gstin,
                address: client.address,
                stateCode: client.stateCode,
                phone: client.phone,
                email: client.email
            },
            billFrom: {
                name: firm.name,
                gstin: firm.gstin,
                pan: firm.pan,
                address: firm.address,
                stateCode: firm.stateCode,
                phone: firm.phone,
                email: firm.email,
                logo: firm.logo,
                bank: { ...firm.bank }
            },
            items: [{
                description: serviceName,
                hsn: document.getElementById('rai-hsn').value.trim() || '9983',
                qty: 1,
                unit: 'Service',
                rate: taxable,
                gstPercent,
                taxable,
                cgst: taxes.cgst,
                sgst: taxes.sgst,
                igst: taxes.igst
            }],
            paymentStatus: 'unpaid',
            receiptStatus: 'none',
            receiptFileName: '',
            receiptData: '',
            raisedBy: currentUser?.name || 'Admin',
            receiptUploadedAt: '',
            terms: firm.terms
        };

        client.adminInvoices.unshift(invoice);
        if (order) {
            order.status = 'invoiced';
            order.invoiceId = invoice.id;
        }
        saveAppData();
        closeRaiseAdminInvoiceModal();
        showToast(`GST Invoice ${invoice.number} raised — ₹${grandTotal.toLocaleString('en-IN')}`);
        showSection('admin-invoices');
    };

    window.downloadAdminInvoicePDF = async function (invId) {
        const client = getCurrentClient();
        ensureClientExtensions(client);
        const inv = client.adminInvoices.find(i => i.id === invId);
        if (!inv) { showToast('Invoice not found', 'error'); return; }
        const pdfData = adminInvoiceToPDFData(client, inv);
        const fileName = `GST_Invoice_${inv.number}_${inv.date || new Date().toISOString().slice(0, 10)}.pdf`;
        await downloadGSTInvoicePDF(pdfData, fileName);
    };

    window.toggleAdminInvoicePaid = function (invId) {
        if (!isFirmUser()) return;
        const client = getCurrentClient();
        const inv = client.adminInvoices.find(i => i.id === invId);
        if (!inv) return;
        inv.paymentStatus = inv.paymentStatus === 'paid' ? 'unpaid' : 'paid';
        inv.paidMarkedAt = new Date().toISOString().split('T')[0];
        inv.paidMarkedBy = currentUser?.name || 'Admin';
        saveAppData();
        showToast(`Invoice marked as ${inv.paymentStatus}`);
        showSection('admin-invoices');
    };

    window.uploadPaymentReceipt = function (invId, input) {
        if (!isClientUser()) return;
        const file = input.files?.[0];
        if (!file) return;
        const client = getCurrentClient();
        const inv = client.adminInvoices.find(i => i.id === invId);
        if (!inv) return;

        const reader = new FileReader();
        reader.onload = e => {
            inv.receiptFileName = file.name;
            inv.receiptData = e.target.result;
            inv.receiptStatus = 'pending';
            inv.receiptUploadedAt = new Date().toISOString().split('T')[0];
            saveAppData();
            showToast('Payment receipt uploaded — awaiting admin approval');
            showSection('admin-invoices');
        };
        reader.readAsDataURL(file);
    };

    window.approvePaymentReceipt = function (invId) {
        if (!isFirmUser()) return;
        const client = getCurrentClient();
        const inv = client.adminInvoices.find(i => i.id === invId);
        if (!inv) return;
        inv.receiptStatus = 'approved';
        inv.receiptApprovedAt = new Date().toISOString().split('T')[0];
        inv.receiptApprovedBy = currentUser?.name || 'Admin';
        if (confirm('Mark this invoice as Paid after approving receipt?')) {
            inv.paymentStatus = 'paid';
        }
        saveAppData();
        showToast('Payment receipt approved');
        showSection('admin-invoices');
    };

    // ==================== EMI CALCULATOR ====================
    window.renderEMICalculator = function (container) {
        container.innerHTML = `
            <div class="max-w-2xl">
                <h2 class="text-2xl font-semibold tracking-tight mb-1">EMI Calculator</h2>
                <p class="text-slate-400 mb-6 text-sm">Calculate monthly EMI for business loans and equipment financing</p>

                <div class="bg-slate-900 border border-slate-700 rounded-3xl p-7 space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label class="text-xs font-medium text-slate-400 block mb-1">Loan Amount (₹)</label>
                            <input type="number" id="emi-principal" value="1000000" min="0" step="1000"
                                   class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm font-mono"
                                   oninput="calculateEMI()">
                        </div>
                        <div>
                            <label class="text-xs font-medium text-slate-400 block mb-1">Annual Interest Rate (%)</label>
                            <input type="number" id="emi-rate" value="10.5" min="0" step="0.1"
                                   class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm font-mono"
                                   oninput="calculateEMI()">
                        </div>
                        <div>
                            <label class="text-xs font-medium text-slate-400 block mb-1">Tenure (Months)</label>
                            <input type="number" id="emi-tenure" value="36" min="1" max="360"
                                   class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm font-mono"
                                   oninput="calculateEMI()">
                        </div>
                        <div>
                            <label class="text-xs font-medium text-slate-400 block mb-1">Tenure (Years)</label>
                            <input type="number" id="emi-years" value="3" min="0.25" max="30" step="0.25"
                                   class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm font-mono"
                                   oninput="syncEMITenureFromYears()">
                        </div>
                    </div>

                    <button onclick="calculateEMI()" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-semibold">
                        <i class="fa-solid fa-calculator mr-2"></i> Calculate EMI
                    </button>

                    <div id="emi-results" class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-700">
                        <div class="bg-slate-950 border border-emerald-800 rounded-2xl p-4 text-center">
                            <div class="text-xs text-slate-400">Monthly EMI</div>
                            <div class="text-2xl font-bold text-emerald-400 mt-1" id="emi-monthly">₹0</div>
                        </div>
                        <div class="bg-slate-950 border border-slate-700 rounded-2xl p-4 text-center">
                            <div class="text-xs text-slate-400">Total Interest</div>
                            <div class="text-2xl font-bold text-amber-400 mt-1" id="emi-interest">₹0</div>
                        </div>
                        <div class="bg-slate-950 border border-slate-700 rounded-2xl p-4 text-center">
                            <div class="text-xs text-slate-400">Total Payment</div>
                            <div class="text-2xl font-bold mt-1" id="emi-total">₹0</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        setTimeout(calculateEMI, 50);
    };

    window.syncEMITenureFromYears = function () {
        const years = parseFloat(document.getElementById('emi-years')?.value) || 0;
        const months = Math.round(years * 12);
        const tenureEl = document.getElementById('emi-tenure');
        if (tenureEl) tenureEl.value = months;
        calculateEMI();
    };

    window.calculateEMI = function () {
        const P = parseFloat(document.getElementById('emi-principal')?.value) || 0;
        const annualRate = parseFloat(document.getElementById('emi-rate')?.value) || 0;
        const n = parseInt(document.getElementById('emi-tenure')?.value, 10) || 0;
        const r = annualRate / 12 / 100;

        let emi = 0, total = 0, interest = 0;
        if (P > 0 && n > 0) {
            if (r === 0) {
                emi = P / n;
            } else {
                emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
            }
            total = emi * n;
            interest = total - P;
        }

        const fmt = v => '₹' + Math.round(v).toLocaleString('en-IN');
        const monthlyEl = document.getElementById('emi-monthly');
        const interestEl = document.getElementById('emi-interest');
        const totalEl = document.getElementById('emi-total');
        if (monthlyEl) monthlyEl.textContent = fmt(emi);
        if (interestEl) interestEl.textContent = fmt(interest);
        if (totalEl) totalEl.textContent = fmt(total);

        const yearsEl = document.getElementById('emi-years');
        if (yearsEl && document.activeElement?.id !== 'emi-years') {
            yearsEl.value = (n / 12).toFixed(2);
        }
    };

    // ==================== SALES & PURCHASE REPORT ====================
    window.renderSalesPurchaseReport = function (container) {
        const client = getCurrentClient();
        const salesTotal = client.invoices.reduce((s, i) => s + i.taxable, 0);
        const purchTotal = client.purchases.reduce((s, p) => s + p.taxable, 0);

        container.innerHTML = `
            <div class="flex justify-between items-end mb-6">
                <div>
                    <h2 class="text-2xl font-semibold tracking-tight">Sales & Purchase Report</h2>
                    <p class="text-sm text-slate-400">Combined sales and purchase register — export to Excel</p>
                </div>
                <button onclick="exportSalesPurchaseReport()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-sm font-semibold flex items-center gap-x-2">
                    <i class="fa-solid fa-file-excel"></i> Download Excel Report
                </button>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                    <div class="text-xs text-slate-400">Sales (Taxable)</div>
                    <div class="text-2xl font-bold text-emerald-400">₹${salesTotal.toLocaleString('en-IN')}</div>
                </div>
                <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                    <div class="text-xs text-slate-400">Purchases (Taxable)</div>
                    <div class="text-2xl font-bold text-blue-400">₹${purchTotal.toLocaleString('en-IN')}</div>
                </div>
                <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                    <div class="text-xs text-slate-400">Sales Invoices</div>
                    <div class="text-2xl font-bold">${client.invoices.length}</div>
                </div>
                <div class="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                    <div class="text-xs text-slate-400">Purchase Bills</div>
                    <div class="text-2xl font-bold">${client.purchases.length}</div>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
                    <div class="px-5 py-3 border-b border-slate-700 font-semibold text-emerald-400">Sales Register</div>
                    <table class="w-full data-table text-xs">
                        <thead><tr><th>Invoice</th><th>Date</th><th>Party</th><th class="text-right">Taxable</th></tr></thead>
                        <tbody>
                            ${client.invoices.length ? client.invoices.map(i => `
                                <tr><td class="font-mono">${esc(i.number)}</td><td>${i.date}</td><td>${esc(i.partyName)}</td>
                                <td class="text-right">₹${i.taxable.toLocaleString('en-IN')}</td></tr>
                            `).join('') : '<tr><td colspan="4" class="text-center py-6 text-slate-400">No sales</td></tr>'}
                        </tbody>
                    </table>
                </div>
                <div class="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
                    <div class="px-5 py-3 border-b border-slate-700 font-semibold text-blue-400">Purchase Register</div>
                    <table class="w-full data-table text-xs">
                        <thead><tr><th>Bill No</th><th>Date</th><th>Supplier</th><th class="text-right">Taxable</th></tr></thead>
                        <tbody>
                            ${client.purchases.length ? client.purchases.map(p => `
                                <tr><td class="font-mono">${esc(p.invoiceNo)}</td><td>${p.date}</td><td>${esc(p.supplier)}</td>
                                <td class="text-right">₹${p.taxable.toLocaleString('en-IN')}</td></tr>
                            `).join('') : '<tr><td colspan="4" class="text-center py-6 text-slate-400">No purchases</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    };

    window.exportSalesPurchaseReport = function () {
        const client = getCurrentClient();
        const wb = XLSX.utils.book_new();

        const salesData = [
            ['SALES REGISTER', '', '', '', '', ''],
            ['Client:', client.name, 'GSTIN:', client.gstin],
            ['Invoice No', 'Date', 'Customer', 'Taxable (₹)', 'GST (₹)', 'Total (₹)']
        ];
        client.invoices.forEach(inv => {
            salesData.push([inv.number, inv.date, inv.partyName, inv.taxable,
                inv.cgst + inv.sgst + inv.igst, inv.grandTotal]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(salesData), 'Sales');

        const purchData = [
            ['PURCHASE REGISTER', '', '', '', '', ''],
            ['Client:', client.name, 'GSTIN:', client.gstin],
            ['Bill No', 'Date', 'Supplier', 'GSTIN', 'Taxable (₹)', 'ITC (₹)']
        ];
        client.purchases.forEach(p => {
            purchData.push([p.invoiceNo, p.date, p.supplier, p.gstin || '', p.taxable,
                p.itcEligible ? (p.cgst + p.sgst + p.igst) : 0]);
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(purchData), 'Purchases');

        const summary = [
            ['SUMMARY', ''],
            ['Total Sales (Taxable)', client.invoices.reduce((s, i) => s + i.taxable, 0)],
            ['Total Purchases (Taxable)', client.purchases.reduce((s, p) => s + p.taxable, 0)],
            ['Generated', new Date().toISOString().split('T')[0]]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');

        XLSX.writeFile(wb, `Sales_Purchase_Report_${client.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Sales & Purchase report exported!');
    };

    // ==================== BULK CSV IMPORTS ====================
    window.bulkImportCustomersCSV = function (input) {
        readCSVFile(input, text => {
            const { rows } = parseCSVText(text);
            const client = getCurrentClient();
            let added = 0;
            rows.forEach(row => {
                const name = row.name || row.customer_name || row.party_name || row.company;
                if (!name) return;
                client.customers.push({
                    id: 'cust_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                    name,
                    gstin: row.gstin || row.gstin_no || '',
                    stateCode: row.state_code || row.state || client.stateCode,
                    address: row.address || '',
                    email: row.email || '',
                    phone: row.phone || row.mobile || ''
                });
                added++;
            });
            saveAppData();
            showToast(`${added} customer(s) imported from CSV`);
            showSection('customers');
        });
    };

    window.bulkImportStockCSV = function (input) {
        readCSVFile(input, text => {
            const { rows } = parseCSVText(text);
            const client = getCurrentClient();
            let added = 0;
            rows.forEach(row => {
                const name = row.name || row.item_name || row.product || row.description;
                if (!name) return;
                client.stock.push({
                    id: 'st_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                    name,
                    hsn: row.hsn || row.hsn_sac || '9983',
                    unit: row.unit || 'Nos',
                    rate: parseFloat(row.rate || row.price || row.selling_rate) || 0,
                    gstPercent: parseFloat(row.gst_percent || row.gst || row.gst_rate) || 18,
                    stockQty: parseInt(row.stock_qty || row.quantity || row.qty, 10) || 0,
                    reorderLevel: parseInt(row.reorder_level || row.min_stock, 10) || 10
                });
                added++;
            });
            saveAppData();
            showToast(`${added} item(s) imported from CSV`);
            showSection('stock');
        });
    };

    window.bulkImportInvoicesCSV = function (input) {
        readCSVFile(input, text => {
            const { rows } = parseCSVText(text);
            const client = getCurrentClient();
            let added = 0;
            rows.forEach(row => {
                const number = row.invoice_no || row.invoice_number || row.number;
                const partyName = row.party_name || row.customer || row.customer_name;
                if (!number || !partyName) return;
                const taxable = parseFloat(row.taxable || row.taxable_value) || 0;
                const cgst = parseFloat(row.cgst) || 0;
                const sgst = parseFloat(row.sgst) || 0;
                const igst = parseFloat(row.igst) || 0;
                const grandTotal = parseFloat(row.grand_total || row.total) || (taxable + cgst + sgst + igst);
                client.invoices.push({
                    id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
                    number,
                    date: row.date || new Date().toISOString().split('T')[0],
                    partyName,
                    taxable,
                    cgst, sgst, igst,
                    grandTotal,
                    status: row.status || 'Pending',
                    items: parseInt(row.items, 10) || 1,
                    imported: true
                });
                added++;
            });
            saveAppData();
            showToast(`${added} invoice(s) imported from CSV`);
            showSection('invoices');
        });
    };

    window.downloadSampleCSV = function (type) {
        const samples = {
            customers: 'name,gstin,state_code,email,phone,address\nMetro Retail Pvt Ltd,07AABCM5678N1Z2,07,purchase@metro.in,9876543210,Delhi\nSunrise Distributors,09AABCS9876P1Z3,09,accounts@sunrise.in,,Noida',
            stock: 'name,hsn,unit,rate,gst_percent,stock_qty,reorder_level\nPremium Widget,9983,Nos,1250,18,100,20\nFastener Kit,7318,Set,380,18,50,10',
            invoices: 'invoice_no,date,party_name,taxable,cgst,sgst,igst,grand_total,status\nINV-2026-0100,2026-06-01,ABC Corp,50000,4500,4500,0,59000,Pending\nINV-2026-0101,2026-06-05,XYZ Ltd,25000,0,0,4500,29500,Paid'
        };
        const blob = new Blob([samples[type] || ''], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `sample_${type}_import.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    // ==================== DOCUMENT DOWNLOAD ====================
    window.downloadDocument = function (docId) {
        const client = getCurrentClient();
        const doc = client.documents.find(d => d.id === docId);
        if (!doc) return;

        if (doc.fileData) {
            const a = document.createElement('a');
            a.href = doc.fileData;
            a.download = doc.name;
            a.click();
            return;
        }

        const content = `LedgerFlow CRM — Document Record\n\nFile: ${doc.name}\nType: ${doc.type}\nDate: ${doc.date}\nUploaded By: ${doc.uploadedByName || doc.uploadedBy}\nNotes: ${doc.notes || '—'}\nSize: ${doc.size || '—'}\n\n(This is a demo record. Re-upload the file to store downloadable content.)`;
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = doc.name.replace(/\.[^.]+$/, '') + '_record.txt';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('Document record downloaded');
    };

    window.handleProfileLogoUpload = function (input) {
        const file = input.files?.[0];
        if (!file || !file.type.startsWith('image/')) {
            showToast('Please select an image file', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            const client = getCurrentClient();
            client.logo = e.target.result;
            saveAppData();
            const preview = document.getElementById('prof-logo-preview');
            const placeholder = document.getElementById('prof-logo-placeholder');
            if (preview) { preview.src = client.logo; preview.classList.remove('hidden'); }
            if (placeholder) placeholder.classList.add('hidden');
            showToast('Logo saved — will appear on your GST invoices');
        };
        reader.readAsDataURL(file);
    };

    window.removeProfileLogo = function () {
        const client = getCurrentClient();
        client.logo = '';
        saveAppData();
        const preview = document.getElementById('prof-logo-preview');
        const placeholder = document.getElementById('prof-logo-placeholder');
        if (preview) { preview.src = ''; preview.classList.add('hidden'); }
        if (placeholder) placeholder.classList.remove('hidden');
        showToast('Logo removed');
    };

})();