/**
 * LedgerFlow — Team member portal with admin approval workflows.
 */
(function () {
    'use strict';

    const TEAM_PROFILE_FIELDS = ['name', 'email', 'gstin', 'pan', 'phone', 'stateCode', 'address', 'terms'];
    const TEAM_BANK_FIELDS = ['name', 'account', 'ifsc', 'branch'];

    function ensureTeamExtensions(data) {
        if (!data) return;
        if (!data.teamApprovals) data.teamApprovals = [];
        Object.values(data.users || {}).forEach(u => {
            if (u.role === 'team' && !Array.isArray(u.assignedClientIds)) {
                u.assignedClientIds = [];
            }
        });
    }

    function isTeamUser() {
        return !!(typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'team');
    }

    function getTeamUserRecord() {
        if (!isTeamUser()) return null;
        const id = currentUser.id || Object.entries(appData.users || {}).find(
            ([, u]) => u.email === currentUser.email && u.role === 'team'
        )?.[0];
        if (id && appData.users[id]) return { id, user: appData.users[id] };
        return null;
    }

    function getAssignedClientIds() {
        if (typeof isFirmUser === 'function' && isFirmUser()) {
            return Object.keys(appData.clients || {});
        }
        if (isTeamUser()) {
            const rec = getTeamUserRecord();
            return (rec?.user?.assignedClientIds || []).filter(id => appData.clients[id]);
        }
        return [];
    }

    function teamCanAccessClient(clientId) {
        return getAssignedClientIds().includes(clientId);
    }

    function getTeamMembers() {
        return Object.entries(appData.users || {})
            .filter(([, u]) => u.role === 'team')
            .map(([id, u]) => ({ id, ...u }));
    }

    function pendingTeamApprovals() {
        ensureTeamExtensions(appData);
        return (appData.teamApprovals || []).filter(a => a.status === 'pending');
    }

    function approvalTypeLabel(type) {
        const map = {
            doc_to_client: 'Document → Client',
            doc_to_admin: 'Document → Admin Review',
            client_create: 'New Client',
            client_edit: 'Client Profile Edit'
        };
        return map[type] || type;
    }

    function createTeamApproval({ type, clientId, title, payload }) {
        ensureTeamExtensions(appData);
        const rec = getTeamUserRecord();
        const approval = {
            id: 'tap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            type,
            status: 'pending',
            teamMemberId: rec?.id || currentUser.id || 'team',
            teamMemberName: currentUser?.name || 'Team Member',
            clientId: clientId || null,
            title: title || approvalTypeLabel(type),
            payload,
            createdAt: new Date().toISOString().split('T')[0],
            reviewedAt: null,
            reviewNotes: ''
        };
        appData.teamApprovals.unshift(approval);
        updateTeamApprovalsBadge();
        return approval;
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            if (!file || file.size >= 512000) return resolve('');
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function buildDocPayload(file, opts = {}) {
        const type = opts.type || (file.name.toLowerCase().includes('gstr') ? 'GST Return' :
            file.name.toLowerCase().includes('bank') ? 'Bank Statement' : 'Other');
        return {
            id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            name: file.name,
            type,
            date: new Date().toISOString().split('T')[0],
            size: (file.size / 1024).toFixed(0) + ' KB',
            uploadedBy: 'team',
            uploadedByName: currentUser?.name || 'Team Member',
            notes: opts.notes || '',
            fileData: await readFileAsDataUrl(file),
            approvalStatus: 'pending'
        };
    }

    window.approveTeamApproval = function (approvalId) {
        if (!isFirmUser()) return;
        ensureTeamExtensions(appData);
        const approval = appData.teamApprovals.find(a => a.id === approvalId);
        if (!approval || approval.status !== 'pending') {
            showToast('Approval not found or already processed', 'error');
            return;
        }

        if (approval.type === 'doc_to_client') {
            const client = appData.clients[approval.clientId];
            if (!client) { showToast('Client not found', 'error'); return; }
            if (!client.documents) client.documents = [];
            const doc = { ...approval.payload.doc };
            doc.approvalStatus = 'approved';
            doc.uploadedBy = 'admin';
            doc.uploadedByName = appData.firmSettings?.name || 'Accounting Firm';
            client.documents.unshift(doc);
        } else if (approval.type === 'doc_to_admin') {
            // Acknowledged — payload retained in approval history for admin records
        } else if (approval.type === 'client_create') {
            const p = approval.payload;
            const id = 'c' + Date.now();
            appData.clients[id] = {
                id,
                name: p.name,
                gstin: p.gstin || '',
                pan: p.pan || '',
                stateCode: p.stateCode || '07',
                address: p.address || '',
                phone: p.phone || '',
                email: p.email,
                logo: '',
                bank: p.bank || { name: '', account: '', ifsc: '', branch: '' },
                terms: p.terms || 'Payment due within 7 days.',
                notes: '',
                customers: [], stock: [], invoices: [], purchases: [],
                documents: [], requests: [], bankTxns: [],
                serviceOrders: [], adminInvoices: []
            };
            appData.users[id] = {
                email: p.loginEmail,
                password: p.loginPassword || 'client123',
                name: p.name,
                role: 'client',
                clientId: id,
                blocked: false
            };
            const teamUser = appData.users[approval.teamMemberId];
            if (teamUser?.role === 'team') {
                if (!teamUser.assignedClientIds) teamUser.assignedClientIds = [];
                if (!teamUser.assignedClientIds.includes(id)) teamUser.assignedClientIds.push(id);
            }
        } else if (approval.type === 'client_edit') {
            const client = appData.clients[approval.clientId];
            if (!client) { showToast('Client not found', 'error'); return; }
            const changes = approval.payload.changes || {};
            TEAM_PROFILE_FIELDS.forEach(f => { if (changes[f] !== undefined) client[f] = changes[f]; });
            if (changes.bank) client.bank = { ...client.bank, ...changes.bank };
            if (changes.loginEmail || changes.loginPassword) {
                const linked = Object.entries(appData.users).find(([, u]) => u.clientId === approval.clientId);
                if (linked) {
                    if (changes.loginEmail) linked[1].email = changes.loginEmail;
                    if (changes.loginPassword) linked[1].password = changes.loginPassword;
                }
            }
        }

        approval.status = 'approved';
        approval.reviewedAt = new Date().toISOString().split('T')[0];
        saveAppData();
        updateTeamApprovalsBadge();
        showToast('Approved and applied');
        showSection('team-approvals');
    };

    window.rejectTeamApproval = function (approvalId) {
        if (!isFirmUser()) return;
        const notes = prompt('Rejection reason (optional):') || '';
        ensureTeamExtensions(appData);
        const approval = appData.teamApprovals.find(a => a.id === approvalId);
        if (!approval || approval.status !== 'pending') return;

        if (approval.type === 'doc_to_client' && approval.payload?.doc?.id) {
            const client = appData.clients[approval.clientId];
            if (client?.documents) {
                const doc = client.documents.find(d => d.id === approval.payload.doc.id);
                if (doc) doc.approvalStatus = 'rejected';
            }
        }

        approval.status = 'rejected';
        approval.reviewedAt = new Date().toISOString().split('T')[0];
        approval.reviewNotes = notes;
        saveAppData();
        updateTeamApprovalsBadge();
        showToast('Request rejected', 'error');
        showSection('team-approvals');
    };

    window.updateTeamApprovalsBadge = function () {
        const badge = document.getElementById('team-approvals-badge');
        if (!badge) return;
        const count = pendingTeamApprovals().length;
        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
    };

    window.populateClientSwitcherFiltered = function () {
        const select = document.getElementById('client-switcher');
        if (!select) return;
        const ids = getAssignedClientIds();
        select.innerHTML = '';
        ids.forEach(id => {
            const client = appData.clients[id];
            if (!client) return;
            const option = document.createElement('option');
            option.value = id;
            option.textContent = client.name + (typeof isClientAccountBlocked === 'function' && isClientAccountBlocked(id) ? ' [BLOCKED]' : '');
            if (id === currentClientId) option.selected = true;
            select.appendChild(option);
        });
        if (ids.length && !ids.includes(currentClientId)) {
            currentClientId = ids[0];
        }
    };

    window.handleTeamDocumentUploadToClient = async function () {
        if (!isTeamUser()) return;
        const input = document.getElementById('team-doc-client-upload');
        const type = document.getElementById('team-doc-type')?.value || 'Other';
        const notes = document.getElementById('team-doc-notes')?.value || '';
        if (!input?.files?.length) { showToast('Select files to upload', 'error'); return; }
        if (!teamCanAccessClient(currentClientId)) { showToast('Client not assigned to you', 'error'); return; }

        for (const file of Array.from(input.files)) {
            const doc = await buildDocPayload(file, { type, notes });
            const client = appData.clients[currentClientId];
            if (!client.documents) client.documents = [];
            client.documents.unshift(doc);
            createTeamApproval({
                type: 'doc_to_client',
                clientId: currentClientId,
                title: `Document for ${client.name}: ${file.name}`,
                payload: { doc }
            });
        }
        saveAppData();
        showToast(`${input.files.length} document(s) submitted for admin approval`);
        showSection('documents');
    };

    window.handleTeamDocumentUploadToAdmin = async function () {
        if (!isTeamUser()) return;
        const input = document.getElementById('team-doc-admin-upload');
        const notes = document.getElementById('team-doc-admin-notes')?.value || '';
        if (!input?.files?.length) { showToast('Select files to upload', 'error'); return; }

        for (const file of Array.from(input.files)) {
            const doc = await buildDocPayload(file, { notes, type: 'Internal Review' });
            createTeamApproval({
                type: 'doc_to_admin',
                clientId: currentClientId,
                title: `Admin review: ${file.name}`,
                payload: { doc, notes }
            });
        }
        saveAppData();
        showToast(`${input.files.length} document(s) sent to admin for review`);
        showSection('documents');
    };

    window.openTeamAddClientForm = function () {
        if (!isTeamUser()) return;
        openMasterFormModal({
            title: 'Propose New Client',
            subtitle: 'Client will go live after admin approval',
            submitLabel: 'Submit for Approval',
            fieldsHtml: `
                ${formField('Business Name', formInput('mf-client-name', 'text', 'New Business Pvt Ltd'), true)}
                <div class="grid grid-cols-2 gap-4">
                    ${formField('Login Email', formInput('mf-client-email', 'email', 'billing@newclient.in'), true)}
                    ${formField('Initial Password', formInput('mf-client-password', 'text', 'client123'), true)}
                </div>
                <div class="grid grid-cols-2 gap-4">
                    ${formField('GSTIN', formInput('mf-client-gstin', 'text', '', 'font-mono'))}
                    ${formField('PAN', formInput('mf-client-pan', 'text', '', 'font-mono'))}
                </div>
                ${formField('State', `<select id="mf-client-state" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm">${stateSelectOptions('07')}</select>`)}
                ${formField('Business Address', `<textarea id="mf-client-address" rows="2" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm"></textarea>`)}
                ${formField('Phone', formInput('mf-client-phone', 'tel', '+91 '))}
            `,
            onSubmit: () => {
                const name = getFormVal('mf-client-name');
                const email = getFormVal('mf-client-email');
                const loginEmail = getFormVal('mf-client-email');
                if (!name || !email) { showToast('Name and email required', 'error'); return; }
                createTeamApproval({
                    type: 'client_create',
                    title: `New client: ${name}`,
                    payload: {
                        name,
                        email,
                        loginEmail,
                        loginPassword: getFormVal('mf-client-password') || 'client123',
                        gstin: getFormVal('mf-client-gstin'),
                        pan: getFormVal('mf-client-pan'),
                        stateCode: document.getElementById('mf-client-state').value,
                        address: getFormVal('mf-client-address'),
                        phone: getFormVal('mf-client-phone'),
                        bank: { name: '', account: '', ifsc: '', branch: '' },
                        terms: 'Payment due within 7 days.'
                    }
                });
                saveAppData();
                closeMasterFormModal();
                showToast('New client submitted for admin approval');
            }
        });
    };

    window.submitTeamClientProfile = function () {
        if (!isTeamUser()) return;
        const client = appData.clients[currentClientId];
        if (!client || !teamCanAccessClient(currentClientId)) {
            showToast('Client not assigned to you', 'error');
            return;
        }

        const changes = {
            name: getFormVal('team-adm-name'),
            email: getFormVal('team-adm-email'),
            gstin: getFormVal('team-adm-gstin'),
            pan: getFormVal('team-adm-pan'),
            phone: getFormVal('team-adm-phone'),
            stateCode: document.getElementById('team-adm-state')?.value,
            address: getFormVal('team-adm-address'),
            terms: document.getElementById('team-adm-terms')?.value || '',
            bank: {
                name: getFormVal('team-adm-bank-name'),
                account: getFormVal('team-adm-bank-account'),
                ifsc: getFormVal('team-adm-bank-ifsc'),
                branch: getFormVal('team-adm-bank-branch')
            }
        };

        const previous = {
            name: client.name,
            email: client.email,
            gstin: client.gstin,
            pan: client.pan,
            phone: client.phone,
            stateCode: client.stateCode,
            address: client.address
        };

        createTeamApproval({
            type: 'client_edit',
            clientId: currentClientId,
            title: `Profile edit: ${client.name}`,
            payload: { changes, previous }
        });
        saveAppData();
        showToast('Profile changes submitted for admin approval');
    };

    window.renderTeamClientProfile = function (container) {
        if (!isTeamUser()) {
            container.innerHTML = '<div class="text-slate-400">Team access required.</div>';
            return;
        }
        const client = appData.clients[currentClientId];
        if (!client) {
            container.innerHTML = '<div class="text-slate-400">No assigned client selected.</div>';
            return;
        }

        container.innerHTML = `
            <div class="max-w-4xl">
                <div class="mb-6">
                    <h2 class="text-2xl font-semibold tracking-tight mb-1">Client Profile</h2>
                    <p class="text-slate-400 text-sm">Edit <strong class="text-white">${escHtml(client.name)}</strong> — changes require admin approval before going live.</p>
                </div>
                <div class="p-4 mb-6 bg-violet-900/20 border border-violet-800 rounded-2xl text-xs text-violet-300">
                    <i class="fa-solid fa-hourglass-half mr-1"></i> All profile updates are sent to admin for approval. Clients are not affected until approved.
                </div>
                <div class="bg-slate-900 border border-slate-700 rounded-3xl p-7 space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div><label class="text-xs text-slate-400 block mb-1">Business Name</label>
                            <input id="team-adm-name" value="${escAttr(client.name)}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm"></div>
                        <div><label class="text-xs text-slate-400 block mb-1">Email</label>
                            <input id="team-adm-email" value="${escAttr(client.email || '')}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm"></div>
                        <div><label class="text-xs text-slate-400 block mb-1">GSTIN</label>
                            <input id="team-adm-gstin" value="${escAttr(client.gstin || '')}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm font-mono"></div>
                        <div><label class="text-xs text-slate-400 block mb-1">PAN</label>
                            <input id="team-adm-pan" value="${escAttr(client.pan || '')}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm font-mono"></div>
                        <div><label class="text-xs text-slate-400 block mb-1">Phone</label>
                            <input id="team-adm-phone" value="${escAttr(client.phone || '')}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm"></div>
                        <div><label class="text-xs text-slate-400 block mb-1">State</label>
                            <select id="team-adm-state" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm">
                                ${stateList.map(s => `<option value="${s.code}" ${s.code === client.stateCode ? 'selected' : ''}>${s.name}</option>`).join('')}
                            </select></div>
                    </div>
                    <div><label class="text-xs text-slate-400 block mb-1">Address</label>
                        <textarea id="team-adm-address" rows="2" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm">${escHtml(client.address || '')}</textarea></div>
                    <div class="grid grid-cols-2 gap-5">
                        <div><label class="text-xs text-slate-400 block mb-1">Bank Name</label>
                            <input id="team-adm-bank-name" value="${escAttr(client.bank?.name || '')}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2 text-sm"></div>
                        <div><label class="text-xs text-slate-400 block mb-1">Account</label>
                            <input id="team-adm-bank-account" value="${escAttr(client.bank?.account || '')}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2 text-sm font-mono"></div>
                        <div><label class="text-xs text-slate-400 block mb-1">IFSC</label>
                            <input id="team-adm-bank-ifsc" value="${escAttr(client.bank?.ifsc || '')}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2 text-sm font-mono"></div>
                        <div><label class="text-xs text-slate-400 block mb-1">Branch</label>
                            <input id="team-adm-bank-branch" value="${escAttr(client.bank?.branch || '')}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2 text-sm"></div>
                    </div>
                    <div><label class="text-xs text-slate-400 block mb-1">Terms</label>
                        <textarea id="team-adm-terms" rows="2" class="form-input w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs">${escHtml(client.terms || '')}</textarea></div>
                    <button onclick="submitTeamClientProfile()" class="w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-2xl font-semibold">
                        <i class="fa-solid fa-paper-plane mr-1"></i> Submit Changes for Admin Approval
                    </button>
                </div>
            </div>`;
    };

    window.renderTeamDocuments = function (container) {
        const client = getCurrentClient();
        normalizeDocuments(client);
        const pendingDocs = client.documents.filter(d => d.uploadedBy === 'team' && d.approvalStatus === 'pending');
        const approvedDocs = client.documents.filter(d =>
            (d.uploadedBy === 'admin' && (!d.approvalStatus || d.approvalStatus === 'approved')) ||
            (d.uploadedBy === 'team' && d.approvalStatus === 'approved')
        );

        container.innerHTML = `
            <div class="mb-6">
                <h2 class="text-2xl font-semibold tracking-tight">Documents — ${escHtml(client.name)}</h2>
                <p class="text-sm text-slate-400">Upload documents for admin review or for client delivery (requires admin approval).</p>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div class="border-2 border-dashed border-violet-700 rounded-3xl p-6 bg-violet-950/20">
                    <div class="font-semibold text-violet-300 mb-2"><i class="fa-solid fa-user-shield mr-1"></i> Send to Admin for Review</div>
                    <p class="text-xs text-slate-400 mb-3">Internal documents, queries, or files for the admin team</p>
                    <input type="text" id="team-doc-admin-notes" placeholder="Note for admin" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm mb-2">
                    <input type="file" id="team-doc-admin-upload" multiple class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm mb-3">
                    <button onclick="handleTeamDocumentUploadToAdmin()" class="px-5 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-semibold w-full">
                        <i class="fa-solid fa-upload mr-1"></i> Upload to Admin
                    </button>
                </div>
                <div class="border-2 border-dashed border-blue-700 rounded-3xl p-6 bg-blue-950/20">
                    <div class="font-semibold text-blue-300 mb-2"><i class="fa-solid fa-user mr-1"></i> Upload for Client (needs approval)</div>
                    <p class="text-xs text-slate-400 mb-3">Client will see these only after admin approves</p>
                    <select id="team-doc-type" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm mb-2">
                        <option>GST Return</option><option>Bank Statement</option><option>Compliance</option>
                        <option>ITR</option><option>Audit Report</option><option>Other</option>
                    </select>
                    <input type="text" id="team-doc-notes" placeholder="Note for client" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm mb-2">
                    <input type="file" id="team-doc-client-upload" multiple class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm mb-3">
                    <button onclick="handleTeamDocumentUploadToClient()" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold w-full">
                        <i class="fa-solid fa-upload mr-1"></i> Submit for Client Delivery
                    </button>
                </div>
            </div>
            <div class="bg-slate-900 border border-amber-800/50 rounded-3xl overflow-hidden mb-6">
                <div class="px-6 py-4 border-b border-slate-700 font-semibold text-amber-300">
                    <i class="fa-solid fa-clock mr-1"></i> Pending Approval (${pendingDocs.length})
                </div>
                <table class="w-full data-table"><thead><tr><th>Document</th><th>Type</th><th>Date</th><th>Status</th></tr></thead>
                <tbody>${pendingDocs.length ? pendingDocs.map(d => `<tr><td>${escHtml(d.name)}</td><td>${d.type}</td><td>${d.date}</td><td><span class="text-xs px-2 py-0.5 bg-amber-900 text-amber-300 rounded">Pending</span></td></tr>`).join('') : '<tr><td colspan="4" class="text-center py-6 text-slate-400">No pending uploads</td></tr>'}</tbody></table>
            </div>
            <div class="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
                <div class="px-6 py-4 border-b border-slate-700 font-semibold">Live Client Documents (${approvedDocs.length})</div>
                <table class="w-full data-table"><thead><tr><th>Document</th><th>Type</th><th>Date</th><th></th></tr></thead>
                <tbody>${approvedDocs.length ? approvedDocs.map(d => `<tr><td>${escHtml(d.name)}</td><td>${d.type}</td><td>${d.date}</td><td><button onclick="downloadDocument('${d.id}')" class="text-emerald-400 px-2"><i class="fa-solid fa-download"></i></button></td></tr>`).join('') : '<tr><td colspan="4" class="text-center py-6 text-slate-400">No approved documents yet</td></tr>'}</tbody></table>
            </div>`;
    };

    window.renderTeamManagement = function (container) {
        if (!isFirmUser()) {
            container.innerHTML = '<div class="text-slate-400">Admin access required.</div>';
            return;
        }
        ensureTeamExtensions(appData);
        const members = getTeamMembers();
        const allClientIds = Object.keys(appData.clients);

        container.innerHTML = `
            <div class="max-w-5xl">
                <div class="flex flex-wrap justify-between items-start gap-4 mb-6">
                    <div>
                        <h2 class="text-2xl font-semibold tracking-tight">Team Members</h2>
                        <p class="text-slate-400 text-sm">Create team logins and assign which clients each member can access.</p>
                    </div>
                    <button onclick="openAddTeamMemberForm()" class="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-xl font-semibold text-sm">
                        <i class="fa-solid fa-user-plus mr-1"></i> Add Team Member
                    </button>
                </div>
                <div class="space-y-4">
                    ${members.length ? members.map(m => {
                        const assigned = (m.assignedClientIds || []).map(id => appData.clients[id]?.name || id);
                        return `
                        <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6" id="team-card-${m.id}">
                            <div class="flex flex-wrap justify-between gap-3 mb-4">
                                <div>
                                    <div class="font-semibold text-lg">${escHtml(m.name)}</div>
                                    <div class="text-sm text-slate-400 font-mono">${escHtml(m.email)}</div>
                                    <div class="text-xs text-slate-500 mt-1">Password: <span class="text-violet-300 font-mono">${escAttr(m.password || '—')}</span></div>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="toggleTeamBlocked('${m.id}')" class="px-3 py-1.5 text-xs rounded-xl border ${m.blocked ? 'border-emerald-700 text-emerald-300' : 'border-amber-700 text-amber-300'}">${m.blocked ? 'Unblock' : 'Block'}</button>
                                    <button onclick="deleteTeamMember('${m.id}')" class="px-3 py-1.5 text-xs rounded-xl border border-red-700 text-red-300">Delete</button>
                                </div>
                            </div>
                            <div class="text-xs font-medium text-slate-400 mb-2">Assigned Clients (${assigned.length})</div>
                            <div class="flex flex-wrap gap-2 mb-3">
                                ${allClientIds.map(cid => {
                                    const checked = (m.assignedClientIds || []).includes(cid);
                                    return `<label class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs cursor-pointer ${checked ? 'bg-violet-900/50 border border-violet-700 text-violet-200' : 'bg-slate-800 border border-slate-700 text-slate-400'}">
                                        <input type="checkbox" class="team-assign-cb" data-member="${m.id}" data-client="${cid}" ${checked ? 'checked' : ''} onchange="saveTeamAssignments('${m.id}')">
                                        ${escHtml(appData.clients[cid]?.name || cid)}
                                    </label>`;
                                }).join('')}
                            </div>
                        </div>`;
                    }).join('') : '<div class="text-center py-12 text-slate-400">No team members yet. Add your first team member above.</div>'}
                </div>
            </div>`;
    };

    window.openAddTeamMemberForm = function () {
        if (!isFirmUser()) return;
        openMasterFormModal({
            title: 'Add Team Member',
            subtitle: 'Team members get a separate login to work on assigned clients',
            submitLabel: 'Create Team Member',
            fieldsHtml: `
                ${formField('Full Name', formInput('mf-team-name', 'text', 'Priya Sharma'), true)}
                ${formField('Login Email', formInput('mf-team-email', 'email', 'staff@firm.in'), true)}
                ${formField('Password', formInput('mf-team-password', 'text', 'team123'), true)}
            `,
            onSubmit: () => {
                const name = getFormVal('mf-team-name');
                const email = getFormVal('mf-team-email').toLowerCase();
                const password = getFormVal('mf-team-password') || 'team123';
                if (!name || !email) { showToast('Name and email required', 'error'); return; }
                const dup = Object.values(appData.users).some(u => u.email === email);
                if (dup) { showToast('Email already in use', 'error'); return; }
                const id = 'team_' + Date.now();
                appData.users[id] = {
                    email, password, name, role: 'team',
                    assignedClientIds: [], blocked: false
                };
                ensureTeamExtensions(appData);
                saveAppData();
                closeMasterFormModal();
                showToast(`Team member "${name}" created`);
                showSection('team-management');
            }
        });
        document.getElementById('mf-team-password').value = 'team123';
    };

    window.saveTeamAssignments = function (memberId) {
        const user = appData.users[memberId];
        if (!user || user.role !== 'team') return;
        const boxes = document.querySelectorAll(`.team-assign-cb[data-member="${memberId}"]`);
        user.assignedClientIds = Array.from(boxes).filter(b => b.checked).map(b => b.dataset.client);
        saveAppData();
        showToast('Client assignments saved');
    };

    window.toggleTeamBlocked = function (memberId) {
        const user = appData.users[memberId];
        if (!user) return;
        user.blocked = !user.blocked;
        saveAppData();
        showSection('team-management');
        showToast(user.blocked ? 'Team member blocked' : 'Team member unblocked');
    };

    window.deleteTeamMember = function (memberId) {
        if (!confirm('Delete this team member? They will no longer be able to log in.')) return;
        delete appData.users[memberId];
        saveAppData();
        showSection('team-management');
        showToast('Team member deleted');
    };

    window.renderTeamApprovals = function (container) {
        if (!isFirmUser()) {
            container.innerHTML = '<div class="text-slate-400">Admin access required.</div>';
            return;
        }
        ensureTeamExtensions(appData);
        const pending = pendingTeamApprovals();
        const history = (appData.teamApprovals || []).filter(a => a.status !== 'pending').slice(0, 30);

        container.innerHTML = `
            <div class="max-w-5xl">
                <h2 class="text-2xl font-semibold tracking-tight mb-1">Team Approvals</h2>
                <p class="text-slate-400 text-sm mb-6">Review documents, client additions, and profile changes submitted by team members.</p>
                <div class="space-y-4 mb-8">
                    ${pending.length ? pending.map(a => `
                        <div class="bg-slate-900 border border-amber-700/50 rounded-3xl p-6">
                            <div class="flex flex-wrap justify-between gap-3 mb-3">
                                <div>
                                    <span class="text-xs px-2 py-0.5 bg-amber-900 text-amber-300 rounded mr-2">${approvalTypeLabel(a.type)}</span>
                                    <span class="font-semibold">${escHtml(a.title)}</span>
                                </div>
                                <span class="text-xs text-slate-500">${a.createdAt}</span>
                            </div>
                            <div class="text-sm text-slate-400 mb-3">
                                By <strong class="text-violet-300">${escHtml(a.teamMemberName)}</strong>
                                ${a.clientId && appData.clients[a.clientId] ? ` · Client: ${escHtml(appData.clients[a.clientId].name)}` : ''}
                            </div>
                            ${renderApprovalPreview(a)}
                            <div class="flex gap-3 mt-4">
                                <button onclick="approveTeamApproval('${a.id}')" class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm">
                                    <i class="fa-solid fa-check mr-1"></i> Approve
                                </button>
                                <button onclick="rejectTeamApproval('${a.id}')" class="flex-1 py-2.5 bg-red-900/50 hover:bg-red-800/60 border border-red-700 text-red-300 rounded-xl font-semibold text-sm">
                                    <i class="fa-solid fa-xmark mr-1"></i> Reject
                                </button>
                            </div>
                        </div>
                    `).join('') : '<div class="text-center py-10 text-slate-400 bg-slate-900 border border-slate-700 rounded-3xl">No pending team approvals</div>'}
                </div>
                ${history.length ? `<h3 class="font-semibold text-slate-400 text-sm mb-3">Recent History</h3>
                <div class="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
                    <table class="w-full data-table text-sm"><thead><tr><th>Request</th><th>Member</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>${history.map(a => `<tr><td>${escHtml(a.title)}</td><td>${escHtml(a.teamMemberName)}</td><td><span class="text-xs px-2 py-0.5 rounded ${a.status === 'approved' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}">${a.status}</span></td><td class="text-xs">${a.reviewedAt || a.createdAt}</td></tr>`).join('')}</tbody></table>
                </div>` : ''}
            </div>`;
    };

    function renderApprovalPreview(a) {
        if (a.type === 'client_edit' && a.payload?.changes) {
            const c = a.payload.changes;
            return `<div class="text-xs bg-slate-950 rounded-xl p-3 font-mono text-slate-300 space-y-1">
                ${Object.entries(c).filter(([k]) => k !== 'bank').map(([k, v]) => `<div><span class="text-slate-500">${k}:</span> ${escHtml(String(v || ''))}</div>`).join('')}
                ${c.bank ? `<div><span class="text-slate-500">bank:</span> ${escHtml(JSON.stringify(c.bank))}</div>` : ''}
            </div>`;
        }
        if (a.type === 'client_create' && a.payload) {
            const p = a.payload;
            return `<div class="text-xs bg-slate-950 rounded-xl p-3 text-slate-300">
                <div><strong>${escHtml(p.name)}</strong> · ${escHtml(p.email)}</div>
                <div class="text-slate-500">GSTIN: ${escHtml(p.gstin || '—')} · Phone: ${escHtml(p.phone || '—')}</div>
            </div>`;
        }
        if (a.payload?.doc) {
            const d = a.payload.doc;
            return `<div class="text-xs bg-slate-950 rounded-xl p-3 flex justify-between items-center">
                <span><i class="fa-solid fa-file mr-1 text-red-400"></i> ${escHtml(d.name)} (${d.size})</span>
                ${d.fileData ? `<button onclick="downloadTeamApprovalDoc('${a.id}')" class="text-emerald-400 hover:text-emerald-300"><i class="fa-solid fa-download"></i> Preview</button>` : ''}
            </div>`;
        }
        return '';
    }

    window.downloadTeamApprovalDoc = function (approvalId) {
        const a = appData.teamApprovals.find(x => x.id === approvalId);
        const doc = a?.payload?.doc;
        if (!doc?.fileData) { showToast('No file attached', 'error'); return; }
        const link = document.createElement('a');
        link.href = doc.fileData;
        link.download = doc.name;
        link.click();
    };

    window.resetSidebarNav = function () {
        document.querySelectorAll('#sidebar-nav .nav-item').forEach(el => {
            el.classList.remove('hidden');
        });
        document.querySelectorAll('#sidebar-nav .pt-3').forEach(el => {
            el.classList.remove('hidden');
        });
        const dupPurchases = document.getElementById('nav-purchases');
        if (dupPurchases) dupPurchases.classList.add('hidden');
    };

    window.applyTeamRoleUI = function () {
        const isTeam = isTeamUser();

        if (!isTeam) {
            resetSidebarNav();
            return;
        }

        document.querySelectorAll('[data-team-only]').forEach(el => {
            el.classList.remove('hidden');
        });
        document.querySelectorAll('[data-firm-only]').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('[data-client-only]').forEach(el => el.classList.add('hidden'));

        document.querySelectorAll('#sidebar-nav .nav-item').forEach(el => {
            if (!el.id) return;
            const allowed = el.hasAttribute('data-team-visible') ||
                ['nav-dashboard', 'nav-documents', 'nav-team-profile'].includes(el.id);
            el.classList.toggle('hidden', !allowed);
        });
        document.querySelectorAll('#sidebar-nav .pt-3').forEach(el => {
            el.classList.toggle('hidden', !el.hasAttribute('data-team-visible'));
        });
        populateClientSwitcherFiltered();
        updateTeamApprovalsBadge();
    };

    window.ensureTeamExtensions = ensureTeamExtensions;
    window.teamCanAccessClient = teamCanAccessClient;
})();