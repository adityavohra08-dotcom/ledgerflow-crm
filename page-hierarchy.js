/**
 * LedgerFlow CRM — Page Hierarchy (IA §5)
 *
 * /
 * ├── /dashboard
 * ├── /clients
 * │   ├── /clients/all
 * │   ├── /clients/pending
 * │   ├── /clients/new
 * │   └── /clients/[clientId]
 * │       ├── overview
 * │       ├── invoices
 * │       ├── documents
 * │       └── messages
 * ├── /invoices
 * │   ├── /invoices/all
 * │   ├── /invoices/create
 * │   ├── /invoices/pending-payments
 * │   └── /invoices/[invoiceId]
 * ├── /documents
 * ├── /gst
 * ├── /reports
 * ├── /messages
 * └── /settings
 */
(function () {
    const PORTAL_ROOT = {
        firm: 'Firm CRM',
        team: 'Team Portal',
        client: 'My Portal'
    };

    const CLIENT_RESERVED = new Set(['all', 'pending', 'new']);
    const INVOICE_RESERVED = new Set(['all', 'create', 'pending-payments', 'outstanding', 'paid', 'admin', 'services', 'orders']);

    const CLIENT_TAB_SECTIONS = {
        overview: 'client-management',
        invoices: 'invoices',
        documents: 'documents',
        messages: 'requests'
    };

    /** Flat page registry: section id → metadata */
    const PAGES = {
        dashboard: {
            label: 'Dashboard',
            path: '/dashboard',
            module: null,
            parent: null,
            roles: ['firm', 'team', 'client'],
            keywords: ['home', 'overview', 'kpi']
        },
        'all-clients': {
            label: 'All Clients',
            path: '/clients/all',
            module: 'Clients',
            parent: null,
            roles: ['firm'],
            keywords: ['clients', 'list', 'search', 'gstin']
        },
        'client-approvals': {
            label: 'Pending Approvals',
            path: '/clients/pending',
            module: 'Clients',
            parent: 'all-clients',
            roles: ['firm'],
            keywords: ['signup', 'approval', 'onboarding', 'pending']
        },
        'clients-new': {
            label: 'Add New Client',
            path: '/clients/new',
            module: 'Clients',
            parent: 'all-clients',
            roles: ['firm'],
            keywords: ['add', 'new', 'client'],
            action: 'new-client',
            mapsTo: 'all-clients'
        },
        'client-management': {
            label: 'Overview',
            path: '/clients/:clientId/overview',
            module: 'Clients',
            parent: 'all-clients',
            roles: ['firm'],
            keywords: ['client', 'detail', 'profile', 'overview'],
            clientTab: 'overview'
        },
        'client-invoices': {
            label: 'Client Invoices',
            path: '/clients/:clientId/invoices',
            module: 'Clients',
            parent: 'all-clients',
            roles: ['firm', 'team'],
            keywords: ['client invoices'],
            clientTab: 'invoices',
            mapsTo: 'invoices'
        },
        'client-documents': {
            label: 'Client Documents',
            path: '/clients/:clientId/documents',
            module: 'Clients',
            parent: 'all-clients',
            roles: ['firm', 'team'],
            keywords: ['client documents', 'files'],
            clientTab: 'documents',
            mapsTo: 'documents'
        },
        'client-messages': {
            label: 'Client Messages',
            path: '/clients/:clientId/messages',
            module: 'Clients',
            parent: 'all-clients',
            roles: ['firm', 'team'],
            keywords: ['client messages', 'requests'],
            clientTab: 'messages',
            mapsTo: 'requests'
        },
        'team-client-profile': {
            label: 'Client Profile',
            path: '/clients/:clientId/overview',
            module: 'Clients',
            parent: null,
            roles: ['team'],
            keywords: ['assigned', 'client']
        },
        invoices: {
            label: 'Invoices',
            path: '/invoices/all',
            module: 'Invoices',
            parent: null,
            roles: ['firm', 'team', 'client'],
            keywords: ['invoice', 'gst', 'payment', 'bill']
        },
        'invoices-create': {
            label: 'Create Invoice',
            path: '/invoices/create',
            module: 'Invoices',
            parent: 'invoices',
            roles: ['firm', 'team', 'client'],
            keywords: ['create', 'gst maker', 'new invoice'],
            action: 'create-invoice',
            mapsTo: 'invoices'
        },
        'invoice-detail': {
            label: 'Invoice Detail',
            path: '/invoices/:invoiceId',
            module: 'Invoices',
            parent: 'invoices',
            roles: ['firm', 'team', 'client'],
            keywords: ['invoice detail', 'view invoice'],
            mapsTo: 'invoices'
        },
        'admin-invoices': {
            label: 'Admin Invoices',
            path: '/invoices/admin',
            module: 'Invoices',
            parent: 'invoices',
            roles: ['firm', 'team', 'client'],
            keywords: ['admin', 'service invoice']
        },
        'buy-services': {
            label: 'Buy Services',
            path: '/invoices/services',
            module: 'Invoices',
            parent: 'invoices',
            roles: ['client'],
            keywords: ['services', 'catalog']
        },
        'service-orders': {
            label: 'Service Orders',
            path: '/invoices/orders',
            module: 'Invoices',
            parent: 'invoices',
            roles: ['firm'],
            keywords: ['orders', 'services']
        },
        documents: {
            label: 'Documents',
            path: '/documents',
            module: 'Documents',
            parent: null,
            roles: ['firm', 'team', 'client'],
            keywords: ['files', 'folder', 'upload', 'share'],
            filters: {
                mine: { label: 'Uploaded by Me', path: '/documents/mine' },
                ca: { label: 'Shared by CA', path: '/documents/shared' },
                upload: { label: 'Upload New', path: '/documents/upload' }
            }
        },
        purchases: {
            label: 'Upload Documents',
            path: '/documents/purchases',
            module: 'Documents',
            parent: 'documents',
            roles: ['firm', 'team', 'client'],
            keywords: ['purchase', 'bill', 'upload']
        },
        'portal-logins': {
            label: 'Portal Logins',
            path: '/documents/portal-logins',
            module: 'Documents',
            parent: 'documents',
            roles: ['firm', 'team', 'client'],
            keywords: ['gst portal', 'credentials']
        },
        'gst-calculator': {
            label: 'GST & Compliance',
            path: '/gst',
            module: 'GST & Compliance',
            parent: null,
            roles: ['firm', 'team', 'client'],
            keywords: ['gst', 'gstr', 'tax', 'compliance']
        },
        'hsn-search': {
            label: 'Invoice Compliance',
            path: '/gst/compliance',
            module: 'GST & Compliance',
            parent: 'gst-calculator',
            roles: ['firm', 'team', 'client'],
            keywords: ['hsn', 'rule 46']
        },
        'bank-recon': {
            label: 'GST Returns Tracker',
            path: '/gst/returns',
            module: 'GST & Compliance',
            parent: 'gst-calculator',
            roles: ['firm', 'team', 'client'],
            keywords: ['gstr-1', 'gstr-3b', 'returns']
        },
        'emi-calculator': {
            label: 'EMI Calculator',
            path: '/gst/emi',
            module: 'GST & Compliance',
            parent: 'gst-calculator',
            roles: ['firm'],
            keywords: ['emi', 'loan']
        },
        requests: {
            label: 'Messages',
            path: '/messages',
            module: 'Communication',
            parent: null,
            roles: ['firm', 'team', 'client'],
            keywords: ['message', 'chat', 'request', 'support']
        },
        'team-approvals': {
            label: 'Approvals',
            path: '/messages/approvals',
            module: 'Communication',
            parent: 'requests',
            roles: ['firm'],
            keywords: ['team', 'approval']
        },
        reports: {
            label: 'Reports',
            path: '/reports',
            module: 'Reports',
            parent: null,
            roles: ['firm', 'team', 'client'],
            keywords: ['reports', 'analytics', 'export'],
            mapsTo: 'sales-report'
        },
        'sales-report': {
            label: 'Revenue Reports',
            path: '/reports/revenue',
            module: 'Reports',
            parent: 'reports',
            roles: ['firm'],
            keywords: ['revenue', 'sales']
        },
        'party-pl': {
            label: 'Client Reports',
            path: '/reports/clients',
            module: 'Reports',
            parent: 'reports',
            roles: ['firm'],
            keywords: ['client', 'profit', 'loss']
        },
        'sales-purchase-report': {
            label: 'GST Reports',
            path: '/reports/gst',
            module: 'Reports',
            parent: 'reports',
            roles: ['client'],
            keywords: ['gst summary']
        },
        settings: {
            label: 'Settings',
            path: '/settings',
            module: 'Settings',
            parent: null,
            roles: ['firm', 'team', 'client'],
            keywords: ['settings', 'profile', 'firm'],
            mapsTo: 'firm-profile'
        },
        'firm-profile': {
            label: 'Firm Profile',
            path: '/settings/firm',
            module: 'Settings',
            parent: 'settings',
            roles: ['firm'],
            keywords: ['firm', 'logo', 'bank', 'signature']
        },
        'team-management': {
            label: 'Team Members',
            path: '/settings/team',
            module: 'Settings',
            parent: 'settings',
            roles: ['firm'],
            keywords: ['team', 'staff', 'roles']
        },
        profile: {
            label: 'My Profile',
            path: '/settings/profile',
            module: 'Settings',
            parent: 'settings',
            roles: ['client'],
            keywords: ['profile', 'security']
        },
        customers: {
            label: 'Customers / Parties',
            path: '/settings/parties',
            module: 'Settings',
            parent: 'settings',
            roles: ['firm'],
            keywords: ['party', 'customer']
        },
        stock: {
            label: 'Stock Management',
            path: '/settings/stock',
            module: 'Settings',
            parent: 'settings',
            roles: ['firm'],
            keywords: ['stock', 'inventory']
        },
        'cap-hub': {
            label: 'All Capabilities',
            path: '/capabilities',
            module: 'Product Suite',
            parent: null,
            roles: ['firm'],
            keywords: ['capabilities', 'roadmap', 'suite', 'pillars']
        },
        'cap-pillar-invoicing': {
            label: 'Sales & Invoicing',
            path: '/capabilities/invoicing',
            module: 'Product Suite',
            parent: 'cap-hub',
            roles: ['firm'],
            keywords: ['quotes', 'sales', 'invoicing']
        },
        'cap-pillar-purchasing': {
            label: 'Purchasing',
            path: '/capabilities/purchasing',
            module: 'Product Suite',
            parent: 'cap-hub',
            roles: ['firm'],
            keywords: ['purchase', 'expense', 'vendor']
        },
        'cap-pillar-banking': {
            label: 'Banking',
            path: '/capabilities/banking',
            module: 'Product Suite',
            parent: 'cap-hub',
            roles: ['firm'],
            keywords: ['bank', 'reconciliation', 'feeds']
        },
        'cap-pillar-gst': {
            label: 'GST & Tax',
            path: '/capabilities/gst',
            module: 'Product Suite',
            parent: 'cap-hub',
            roles: ['firm'],
            keywords: ['e-invoice', 'gstr', 'eway']
        },
        'cap-pillar-inventory': {
            label: 'Inventory',
            path: '/capabilities/inventory',
            module: 'Product Suite',
            parent: 'cap-hub',
            roles: ['firm'],
            keywords: ['warehouse', 'batch', 'ecommerce']
        },
        'cap-pillar-projects': {
            label: 'Projects',
            path: '/capabilities/projects',
            module: 'Product Suite',
            parent: 'cap-hub',
            roles: ['firm'],
            keywords: ['timesheet', 'project', 'billing']
        },
        'cap-pillar-reports': {
            label: 'Reports & BI',
            path: '/capabilities/reports',
            module: 'Product Suite',
            parent: 'cap-hub',
            roles: ['firm'],
            keywords: ['reports', 'analytics', 'bi']
        }
    };

    const PATH_ROUTES = {};
    const SECTION_DEFAULT_PATH = {};

    function registerRoute(path, section, meta = {}) {
        PATH_ROUTES[path] = { section, ...meta };
        if (!SECTION_DEFAULT_PATH[section]) {
            SECTION_DEFAULT_PATH[section] = path;
        }
    }

    registerRoute('/dashboard', 'dashboard');
    registerRoute('/clients/all', 'all-clients');
    registerRoute('/clients/pending', 'client-approvals');
    registerRoute('/clients/new', 'clients-new', { action: 'new-client' });
    registerRoute('/invoices/all', 'invoices', { filters: { invoiceListFilter: 'all' } });
    registerRoute('/invoices/create', 'invoices-create', { action: 'create-invoice', mapsTo: 'invoices' });
    registerRoute('/invoices/pending-payments', 'invoices', { filters: { invoiceListFilter: 'pending' } });
    registerRoute('/invoices/outstanding', 'invoices', { filters: { invoiceListFilter: 'outstanding' } });
    registerRoute('/invoices/paid', 'invoices', { filters: { invoiceListFilter: 'paid' } });
    registerRoute('/invoices/admin', 'admin-invoices');
    registerRoute('/invoices/services', 'buy-services');
    registerRoute('/invoices/orders', 'service-orders');
    registerRoute('/documents', 'documents');
    registerRoute('/documents/mine', 'documents', { filters: { documentListFilter: 'mine' } });
    registerRoute('/documents/shared', 'documents', { filters: { documentListFilter: 'ca' } });
    registerRoute('/documents/upload', 'documents', { filters: { documentListFilter: 'upload' } });
    registerRoute('/documents/purchases', 'purchases');
    registerRoute('/documents/portal-logins', 'portal-logins');
    registerRoute('/gst', 'gst-calculator');
    registerRoute('/gst/compliance', 'hsn-search');
    registerRoute('/gst/returns', 'bank-recon');
    registerRoute('/gst/emi', 'emi-calculator');
    registerRoute('/messages', 'requests');
    registerRoute('/messages/approvals', 'team-approvals');
    registerRoute('/reports', 'sales-report');
    registerRoute('/reports/revenue', 'sales-report');
    registerRoute('/reports/clients', 'party-pl');
    registerRoute('/reports/gst', 'sales-purchase-report');
    registerRoute('/settings', 'firm-profile');
    registerRoute('/settings/firm', 'firm-profile');
    registerRoute('/settings/team', 'team-management');
    registerRoute('/settings/profile', 'profile');
    registerRoute('/settings/parties', 'customers');
    registerRoute('/settings/stock', 'stock');
    registerRoute('/capabilities', 'cap-hub');
    registerRoute('/capabilities/invoicing', 'cap-pillar-invoicing');
    registerRoute('/capabilities/purchasing', 'cap-pillar-purchasing');
    registerRoute('/capabilities/banking', 'cap-pillar-banking');
    registerRoute('/capabilities/gst', 'cap-pillar-gst');
    registerRoute('/capabilities/inventory', 'cap-pillar-inventory');
    registerRoute('/capabilities/projects', 'cap-pillar-projects');
    registerRoute('/capabilities/reports', 'cap-pillar-reports');

    /** IA §5 — developer tree (matches spec) */
    const FIRM_HIERARCHY_TREE = [
        { label: 'Dashboard', path: '/dashboard', section: 'dashboard' },
        {
            label: 'Clients', children: [
                { label: 'All Clients', path: '/clients/all', section: 'all-clients' },
                { label: 'Pending Approvals', path: '/clients/pending', section: 'client-approvals' },
                { label: 'Add New Client', path: '/clients/new', section: 'clients-new' },
                {
                    label: '/clients/[clientId]', children: [
                        { label: 'overview', path: '/clients/:clientId/overview', section: 'client-management', note: 'dynamic' },
                        { label: 'invoices', path: '/clients/:clientId/invoices', section: 'client-invoices', note: 'dynamic' },
                        { label: 'documents', path: '/clients/:clientId/documents', section: 'client-documents', note: 'dynamic' },
                        { label: 'messages', path: '/clients/:clientId/messages', section: 'client-messages', note: 'dynamic' }
                    ]
                }
            ]
        },
        {
            label: 'Invoices', children: [
                { label: 'All Invoices', path: '/invoices/all', section: 'invoices' },
                { label: 'Create Invoice', path: '/invoices/create', section: 'invoices-create', note: '→ GST Invoice Maker' },
                { label: 'Pending Payments', path: '/invoices/pending-payments', section: 'invoices' },
                { label: '/invoices/[invoiceId]', path: '/invoices/:invoiceId', section: 'invoice-detail', note: 'dynamic' }
            ]
        },
        { label: 'Documents', path: '/documents', section: 'documents' },
        { label: 'GST & Compliance', path: '/gst', section: 'gst-calculator' },
        { label: 'Reports', path: '/reports', section: 'sales-report' },
        { label: 'Messages', path: '/messages', section: 'requests' },
        { label: 'Settings', path: '/settings', section: 'firm-profile' }
    ];

    const CLIENT_HIERARCHY_TREE = [
        { label: 'Dashboard', path: '/dashboard', section: 'dashboard' },
        {
            label: 'Invoices', children: [
                { label: 'Outstanding', path: '/invoices/outstanding', section: 'invoices' },
                { label: 'Paid', path: '/invoices/paid', section: 'invoices' },
                { label: 'All Invoices', path: '/invoices/all', section: 'invoices' },
                { label: 'Buy Services', path: '/invoices/services', section: 'buy-services' }
            ]
        },
        {
            label: 'Documents', children: [
                { label: 'Uploaded by Me', path: '/documents/mine', section: 'documents' },
                { label: 'Shared by CA', path: '/documents/shared', section: 'documents' },
                { label: 'Upload New', path: '/documents/upload', section: 'documents' }
            ]
        },
        { label: 'Messages', path: '/messages', section: 'requests' },
        { label: 'Settings', path: '/settings/profile', section: 'profile' }
    ];

    const TEAM_HIERARCHY_TREE = [
        { label: 'Dashboard', path: '/dashboard', section: 'dashboard' },
        { label: 'Client Profile', path: '/clients/:clientId/overview', section: 'team-client-profile', note: 'assigned client' },
        { label: 'Invoices', path: '/invoices/all', section: 'invoices' },
        { label: 'Documents', path: '/documents', section: 'documents' },
        { label: 'GST', path: '/gst', section: 'gst-calculator' },
        { label: 'Messages', path: '/messages', section: 'requests' }
    ];

    let _routeContext = {};
    let _navigating = false;

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function getUserRole() {
        if (typeof isFirmUser === 'function' && isFirmUser()) return 'firm';
        if (typeof isTeamUser === 'function' && isTeamUser()) return 'team';
        if (typeof isClientUser === 'function' && isClientUser()) return 'client';
        return null;
    }

    function getCurrentClientId() {
        return typeof currentClientId !== 'undefined' ? currentClientId : null;
    }

    function getClientName(clientId) {
        const id = clientId || getCurrentClientId();
        if (!id || typeof appData === 'undefined') return null;
        return appData.clients?.[id]?.name || id;
    }

    function resolveRenderSection(section) {
        if (section === 'settings') {
            return getUserRole() === 'client' ? 'profile' : 'firm-profile';
        }
        const page = PAGES[section];
        if (page?.mapsTo) return page.mapsTo;
        return section;
    }

    function canAccess(section, role) {
        const r = role || getUserRole();
        const page = PAGES[section];
        if (!page) return true;
        if (!r) return false;
        return page.roles.includes(r);
    }

    function normalizeHash(hash) {
        const raw = (hash || window.location.hash || '').replace(/^#/, '').trim();
        if (!raw || raw === '/') return '/dashboard';
        return raw.startsWith('/') ? raw : '/' + raw;
    }

    function parseClientRoute(path) {
        const m = path.match(/^\/clients\/([^/]+)(?:\/([^/]+))?\/?$/);
        if (!m) return null;
        const [, segment, tab] = m;
        if (CLIENT_RESERVED.has(segment)) return null;

        const clientTab = tab || 'overview';
        const tabSection = CLIENT_TAB_SECTIONS[clientTab];
        if (!tabSection) return null;

        const role = getUserRole();
        const registryKey = {
            overview: role === 'team' ? 'team-client-profile' : 'client-management',
            invoices: 'client-invoices',
            documents: 'client-documents',
            messages: 'client-messages'
        }[clientTab];

        const renderSection = (clientTab === 'overview' && role === 'team')
            ? 'team-client-profile'
            : tabSection;

        return {
            path,
            section: registryKey || 'client-management',
            renderSection,
            params: { clientId: segment, clientTab },
            filters: clientTab === 'invoices' ? { invoiceListFilter: 'all' } : null
        };
    }

    function parseInvoiceRoute(path) {
        const m = path.match(/^\/invoices\/([^/]+)\/?$/);
        if (!m) return null;
        const id = m[1];
        if (INVOICE_RESERVED.has(id)) return null;
        return {
            path,
            section: 'invoice-detail',
            renderSection: 'invoices',
            params: { invoiceId: id },
            filters: { invoiceListFilter: 'all' }
        };
    }

    const CAP_PILLAR_SLUGS = {
        invoicing: 'cap-pillar-invoicing',
        purchasing: 'cap-pillar-purchasing',
        banking: 'cap-pillar-banking',
        gst: 'cap-pillar-gst',
        inventory: 'cap-pillar-inventory',
        projects: 'cap-pillar-projects',
        reports: 'cap-pillar-reports'
    };

    function parseCapabilityRoute(path) {
        const m = path.match(/^\/capabilities(?:\/([^/]+))?\/?$/);
        if (!m) return null;
        const slug = m[1];
        if (!slug) {
            return { path, section: 'cap-hub', renderSection: 'cap-hub', params: null, filters: null, action: null };
        }
        if (CAP_PILLAR_SLUGS[slug]) {
            const section = CAP_PILLAR_SLUGS[slug];
            return { path, section, renderSection: section, params: null, filters: null, action: null };
        }
        const section = 'cap-' + slug;
        return { path, section, renderSection: section, params: null, filters: null, action: null };
    }

    function parseRoute(hash) {
        const path = normalizeHash(hash);

        if (PATH_ROUTES[path]) {
            const route = PATH_ROUTES[path];
            return {
                path,
                section: route.section,
                renderSection: resolveRenderSection(route.section),
                params: route.params || null,
                filters: route.filters || null,
                action: route.action || PAGES[route.section]?.action || null
            };
        }

        const clientRoute = parseClientRoute(path);
        if (clientRoute) return clientRoute;

        const invoiceRoute = parseInvoiceRoute(path);
        if (invoiceRoute) return invoiceRoute;

        const capRoute = parseCapabilityRoute(path);
        if (capRoute) return capRoute;

        if (getUserRole() === 'client' && path === '/settings') {
            return { path, section: 'profile', renderSection: 'profile', params: null, filters: null, action: null };
        }

        return { path: '/dashboard', section: 'dashboard', renderSection: 'dashboard', params: null, filters: null, action: null };
    }

    function applyRouteFilters(filters) {
        if (!filters) return;
        if (filters.invoiceListFilter != null) window.invoiceListFilter = filters.invoiceListFilter;
        if (filters.documentListFilter != null) window.documentListFilter = filters.documentListFilter;
    }

    function applyRouteContext(ctx) {
        _routeContext = { ...ctx };
        window._lfRouteContext = _routeContext;

        if (typeof window.__applyRouteContext === 'function') {
            window.__applyRouteContext(ctx);
            return;
        }

        if (ctx.clientId && typeof appData !== 'undefined' && appData.clients?.[ctx.clientId]) {
            currentClientId = ctx.clientId;
            if (typeof populateClientSwitcher === 'function') populateClientSwitcher();
            if (typeof isTeamUser === 'function' && isTeamUser() && typeof populateClientSwitcherFiltered === 'function') {
                populateClientSwitcherFiltered();
            }
        }
        if (ctx.invoiceId) window.activeInvoiceId = ctx.invoiceId;
        else if (!ctx.keepInvoiceId) window.activeInvoiceId = null;
    }

    function runRouteAction(action) {
        if (!action) return;
        if (action === 'new-client' && typeof addNewClient === 'function') addNewClient();
        if (action === 'create-invoice' && typeof launchInvoiceMaker === 'function') launchInvoiceMaker();
    }

    function getActiveFilterLabel(section) {
        if (section !== 'invoices' && section !== 'invoice-detail') {
            if (section === 'documents') {
                const f = window.documentListFilter;
                const labels = { mine: 'Uploaded by Me', ca: 'Shared by CA', upload: 'Upload New' };
                return f ? labels[f] : null;
            }
            return null;
        }
        const labels = {
            all: 'All Invoices',
            pending: 'Pending Payments',
            outstanding: 'Outstanding',
            paid: 'Paid'
        };
        const f = window.invoiceListFilter || 'all';
        if (_routeContext.invoiceId) return null;
        return labels[f] || null;
    }

    function sectionToPath(section, opts = {}) {
        const page = PAGES[section];
        const role = getUserRole();

        if (section === 'client-management' || section === 'team-client-profile') {
            const id = opts.clientId || _routeContext.clientId || getCurrentClientId();
            if (id) return `/clients/${id}/overview`;
        }
        if (section === 'client-invoices') {
            const id = opts.clientId || _routeContext.clientId || getCurrentClientId();
            if (id) return `/clients/${id}/invoices`;
        }
        if (section === 'client-documents') {
            const id = opts.clientId || _routeContext.clientId || getCurrentClientId();
            if (id) return `/clients/${id}/documents`;
        }
        if (section === 'client-messages') {
            const id = opts.clientId || _routeContext.clientId || getCurrentClientId();
            if (id) return `/clients/${id}/messages`;
        }
        if (section === 'invoice-detail' || opts.invoiceId || _routeContext.invoiceId) {
            const inv = opts.invoiceId || _routeContext.invoiceId;
            if (inv) return `/invoices/${inv}`;
        }
        if (section === 'invoices' || section === 'invoices-create') {
            if (opts.action === 'create-invoice' || section === 'invoices-create') return '/invoices/create';
            const f = opts.invoiceListFilter ?? window.invoiceListFilter ?? 'all';
            if (f === 'pending') return '/invoices/pending-payments';
            if (f === 'outstanding') return '/invoices/outstanding';
            if (f === 'paid') return '/invoices/paid';
            return '/invoices/all';
        }
        if (section === 'documents' && opts.documentListFilter) {
            const map = { mine: '/documents/mine', ca: '/documents/shared', upload: '/documents/upload' };
            return map[opts.documentListFilter] || '/documents';
        }
        if (section === 'settings' || (section === 'firm-profile' && !opts.subPath)) {
            if (role === 'client') return '/settings/profile';
            return '/settings';
        }
        if (section === 'cap-hub') return '/capabilities';
        if (section.startsWith('cap-pillar-')) {
            return '/capabilities/' + section.replace('cap-pillar-', '');
        }
        if (section.startsWith('cap-')) {
            return '/capabilities/' + section.replace('cap-', '');
        }
        if (page?.path && !page.path.includes(':')) return page.path;
        return SECTION_DEFAULT_PATH[section] || '/dashboard';
    }

    function getBreadcrumbTrail(section) {
        const role = getUserRole();
        const home = PORTAL_ROOT[role] || 'Portal';
        const trail = [{ label: home, section: null, clickable: false }];
        const renderSection = resolveRenderSection(section);
        const ctx = _routeContext;

        if (ctx.clientId && ['invoices', 'documents', 'requests', 'client-management', 'client-invoices', 'client-documents', 'client-messages'].includes(section)) {
            trail.push({ label: 'Clients', section: 'all-clients', clickable: canAccess('all-clients', role) });
            const clientName = getClientName(ctx.clientId);
            trail.push({
                label: clientName || ctx.clientId,
                section: 'client-management',
                clickable: true,
                pathOpts: { clientId: ctx.clientId }
            });
            const tabLabels = { overview: 'Overview', invoices: 'Invoices', documents: 'Documents', messages: 'Messages' };
            if (ctx.clientTab && ctx.clientTab !== 'overview') {
                trail.push({ label: tabLabels[ctx.clientTab] || ctx.clientTab, section: null, clickable: false });
            } else if (section === 'client-management') {
                trail.push({ label: 'Overview', section: null, clickable: false });
            }
            return trail;
        }

        if (ctx.invoiceId && (section === 'invoices' || section === 'invoice-detail')) {
            trail.push({ label: 'Invoices', section: 'invoices', clickable: true });
            trail.push({ label: ctx.invoiceId, section: null, clickable: false });
            return trail;
        }

        const chain = [];
        let cur = section;
        const seen = new Set();
        while (cur && PAGES[cur] && !seen.has(cur)) {
            seen.add(cur);
            chain.unshift(cur);
            cur = PAGES[cur].parent;
        }

        chain.forEach((id, idx) => {
            const page = PAGES[id];
            const isLast = idx === chain.length - 1;
            if (page.module && !page.parent && idx === 0 && page.module !== page.label) {
                trail.push({ label: page.module, section: null, clickable: false });
            }
            trail.push({
                label: page.label,
                section: id,
                clickable: !isLast && canAccess(id, role)
            });
        });

        const filterLabel = getActiveFilterLabel(renderSection);
        if (filterLabel) {
            trail.push({ label: filterLabel, section: null, clickable: false, isFilter: true });
        }

        return trail;
    }

    function syncHash(section, opts = {}, replace = false) {
        const path = sectionToPath(section, opts);
        const next = '#' + path;
        if (window.location.hash === next) return;
        if (replace) {
            history.replaceState({ section, ...opts }, '', next);
        } else {
            history.pushState({ section, ...opts }, '', next);
        }
    }

    function dispatchRoute(route, opts = {}) {
        const role = getUserRole();
        if (!role) return null;

        let section = route.section;
        if (!canAccess(section, role)) {
            section = 'dashboard';
            if (!opts.silent) typeof showToast === 'function' && showToast('You do not have access to that page', 'error');
        }

        const renderSection = route.renderSection || resolveRenderSection(section);
        const ctx = {
            ...(route.params || {}),
            action: route.action || null,
            keepInvoiceId: !!route.params?.invoiceId
        };

        _navigating = true;
        applyRouteFilters(route.filters);
        applyRouteContext(ctx);

        if (typeof window.__showSectionCore === 'function') {
            window.__showSectionCore(renderSection);
        }

        if (route.action) runRouteAction(route.action);

        if (!opts.skipHash) {
            syncHash(section, { ...ctx, ...(route.filters || {}) }, opts.replace);
        }
        _navigating = false;

        return renderSection;
    }

    function navigateFromHash(hash, opts = {}) {
        return dispatchRoute(parseRoute(hash), opts);
    }

    function navigateTo(section, opts = {}) {
        const role = getUserRole();
        if (!role) return;
        if (!canAccess(section, role)) {
            typeof showToast === 'function' && showToast('You do not have access to that page', 'error');
            return;
        }

        if (opts.invoiceListFilter != null) window.invoiceListFilter = opts.invoiceListFilter;
        if (opts.documentListFilter != null) window.documentListFilter = opts.documentListFilter;

        const renderSection = resolveRenderSection(section);
        const ctx = {
            clientId: opts.clientId || null,
            clientTab: PAGES[section]?.clientTab || opts.clientTab || null,
            invoiceId: opts.invoiceId || null,
            action: PAGES[section]?.action || opts.action || null
        };

        _navigating = true;
        applyRouteContext(ctx);

        if (typeof window.__showSectionCore === 'function') {
            window.__showSectionCore(renderSection);
        }
        if (ctx.action) runRouteAction(ctx.action);

        if (!opts.skipHash) syncHash(section, opts);
        _navigating = false;
    }

    function goPath(path, opts = {}) {
        navigateFromHash('#' + path.replace(/^#/, ''), opts);
    }

    function openClient(clientId, tab = 'overview') {
        const tabPath = tab === 'overview'
            ? `/clients/${clientId}/overview`
            : `/clients/${clientId}/${tab}`;
        goPath(tabPath);
    }

    function openInvoice(invoiceId) {
        goPath(`/invoices/${encodeURIComponent(invoiceId)}`);
    }

    function searchPages(query, role) {
        const r = role || getUserRole();
        const q = (query || '').trim().toLowerCase();
        if (!q || !r) return [];

        return Object.entries(PAGES)
            .filter(([, page]) => page.roles.includes(r))
            .filter(([section, page]) => {
                const hay = [page.label, page.module, page.path, ...(page.keywords || [])].join(' ').toLowerCase();
                return hay.includes(q) || section.includes(q);
            })
            .slice(0, 8)
            .map(([section, page]) => ({
                section,
                label: page.label,
                path: page.path.replace(':clientId', getCurrentClientId() || ':clientId').replace(':invoiceId', ':invoiceId'),
                module: page.module,
                action: `LedgerFlowPages.go('${section}')`
            }));
    }

    function renderHierarchyTree(nodes, depth = 0) {
        return nodes.map(node => {
            if (node.children) {
                return `
                    <li class="lf-hierarchy-branch">
                        <span class="lf-hierarchy-module">${esc(node.label)}</span>
                        <ul class="lf-hierarchy-children">${renderHierarchyTree(node.children, depth + 1)}</ul>
                    </li>`;
            }
            const path = node.path ? `<code class="lf-hierarchy-path">${esc(node.path)}</code>` : '';
            const note = node.note ? `<span class="lf-hierarchy-note">${esc(node.note)}</span>` : '';
            let link;
            if (node.section && node.path && !node.path.includes(':')) {
                link = `<button type="button" class="lf-hierarchy-link" onclick="LedgerFlowPages.goPath('${esc(node.path)}')">${esc(node.label)}</button>`;
            } else if (node.section) {
                link = `<button type="button" class="lf-hierarchy-link" onclick="LedgerFlowPages.go('${node.section}')">${esc(node.label)}</button>`;
            } else {
                link = `<span class="lf-hierarchy-leaf">${esc(node.label)}</span>`;
            }
            return `<li class="lf-hierarchy-leaf-row">${link}${path}${note}</li>`;
        }).join('');
    }

    function renderPageHierarchyGuide(role) {
        const r = role || getUserRole();
        const tree = r === 'client' ? CLIENT_HIERARCHY_TREE
            : r === 'team' ? TEAM_HIERARCHY_TREE
                : FIRM_HIERARCHY_TREE;
        const portal = PORTAL_ROOT[r] || 'Portal';

        return `
            <div class="lf-page-hierarchy-guide">
                <div class="lf-module-guide-head">
                    <i class="fa-solid fa-sitemap text-teal-400"></i>
                    <span>Page hierarchy (§5) — ${esc(portal)}</span>
                </div>
                <p class="lf-hierarchy-desc text-xs text-slate-400 mb-3">
                    Development route map. Hash URLs e.g. <code>#${esc('/clients/all')}</code>,
                    <code>#${esc('/clients/c1/invoices')}</code>, <code>#${esc('/invoices/create')}</code>.
                </p>
                <ul class="lf-hierarchy-tree">${renderHierarchyTree(tree)}</ul>
            </div>`;
    }

    function initRouter() {
        window.addEventListener('hashchange', () => {
            if (_navigating) return;
            if (!getUserRole()) return;
            navigateFromHash(window.location.hash, { skipHash: true });
        });
        window.addEventListener('popstate', () => {
            if (_navigating) return;
            if (!getUserRole()) return;
            navigateFromHash(window.location.hash, { skipHash: true });
        });
    }

    window.LedgerFlowPages = {
        PAGES,
        PORTAL_ROOT,
        FIRM_HIERARCHY_TREE,
        CLIENT_HIERARCHY_TREE,
        TEAM_HIERARCHY_TREE,
        canAccess,
        parseRoute,
        sectionToPath,
        getBreadcrumbTrail,
        getRouteContext: () => ({ ..._routeContext }),
        navigateFromHash,
        navigateTo,
        goPath,
        openClient,
        openInvoice,
        searchPages,
        renderPageHierarchyGuide,
        syncHash,
        initRouter,
        go(section, opts) { navigateTo(section, opts); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRouter);
    } else {
        initRouter();
    }
})();