/**
 * LedgerFlow CRM — Full product capability modules (7 pillars, 44 features)
 * Working UI scaffolds with local CRUD, connect flows, and demo seed data.
 */
(function () {
    'use strict';

    const STATUS = {
        live: { label: 'Live', cls: 'lf-cap--live', icon: 'fa-circle-check' },
        partial: { label: 'Partial', cls: 'lf-cap--partial', icon: 'fa-circle-half-stroke' },
        planned: { label: 'Planned', cls: 'lf-cap--planned', icon: 'fa-circle' }
    };

    const PILLARS = [
        { id: 'invoicing', title: 'Invoicing & Sales', icon: 'fa-file-invoice-dollar', section: 'cap-pillar-invoicing' },
        { id: 'purchasing', title: 'Purchasing & Expenses', icon: 'fa-cart-shopping', section: 'cap-pillar-purchasing' },
        { id: 'banking', title: 'Banking & Reconciliation', icon: 'fa-building-columns', section: 'cap-pillar-banking' },
        { id: 'gst', title: 'GST & Tax Compliance', icon: 'fa-scale-balanced', section: 'cap-pillar-gst' },
        { id: 'inventory', title: 'Inventory Management', icon: 'fa-boxes-stacked', section: 'cap-pillar-inventory' },
        { id: 'projects', title: 'Projects & Time', icon: 'fa-diagram-project', section: 'cap-pillar-projects' },
        { id: 'reports', title: 'Reports & Analytics', icon: 'fa-chart-pie', section: 'cap-pillar-reports' }
    ];

    const FEATURES = [
        { id: 'cap-quotes', pillar: 'invoicing', name: 'Quotes → Sales Orders → Invoices', status: 'partial', type: 'list', dataKey: 'quotes', icon: 'fa-file-lines',
          route: "showSection('cap-quotes')", cols: ['number', 'party', 'amount', 'status', 'date'],
          form: [{ key: 'number', label: 'Quote #', type: 'text' }, { key: 'party', label: 'Customer', type: 'text' }, { key: 'amount', label: 'Amount (₹)', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Sent', 'Accepted', 'Converted'] }, { key: 'date', label: 'Date', type: 'date' }] },
        { id: 'cap-progress-billing', pillar: 'invoicing', name: 'Partial / Progress billing', status: 'partial', type: 'list', dataKey: 'progressBillings', icon: 'fa-chart-gantt',
          route: "showSection('cap-progress-billing')", cols: ['project', 'milestone', 'percent', 'amount', 'status'],
          form: [{ key: 'project', label: 'Project / SO', type: 'text' }, { key: 'milestone', label: 'Milestone', type: 'text' }, { key: 'percent', label: '% Complete', type: 'number' }, { key: 'amount', label: 'Bill Amount (₹)', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['Pending', 'Invoiced'] }] },
        { id: 'cap-retainers', pillar: 'invoicing', name: 'Retainer invoices & revenue recognition', status: 'partial', type: 'list', dataKey: 'retainers', icon: 'fa-hand-holding-dollar',
          route: "showSection('cap-retainers')", cols: ['client', 'period', 'amount', 'recognized', 'balance'],
          form: [{ key: 'client', label: 'Client', type: 'text' }, { key: 'period', label: 'Period', type: 'text' }, { key: 'amount', label: 'Retainer (₹)', type: 'number' }, { key: 'recognized', label: 'Recognized (₹)', type: 'number' }, { key: 'balance', label: 'Balance (₹)', type: 'number' }] },
        { id: 'cap-credit-notes', pillar: 'invoicing', name: 'Credit notes & delivery challans', status: 'partial', type: 'list', dataKey: 'creditNotes', icon: 'fa-file-circle-minus',
          route: "showSection('cap-credit-notes')", cols: ['number', 'type', 'againstInvoice', 'amount', 'date'],
          form: [{ key: 'number', label: 'CN / DC #', type: 'text' }, { key: 'type', label: 'Type', type: 'select', options: ['Credit Note', 'Delivery Challan'] }, { key: 'againstInvoice', label: 'Against Invoice', type: 'text' }, { key: 'amount', label: 'Amount (₹)', type: 'number' }, { key: 'date', label: 'Date', type: 'date' }] },
        { id: 'cap-payment-links', pillar: 'invoicing', name: 'Online payments & payment links', status: 'partial', type: 'list', dataKey: 'paymentLinks', icon: 'fa-link',
          route: "showSection('cap-payment-links')", cols: ['invoice', 'gateway', 'amount', 'status', 'expires'],
          form: [{ key: 'invoice', label: 'Invoice #', type: 'text' }, { key: 'gateway', label: 'Gateway', type: 'select', options: ['Razorpay', 'PayU', 'Stripe', 'Manual'] }, { key: 'amount', label: 'Amount (₹)', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Paid', 'Expired'] }, { key: 'expires', label: 'Expires', type: 'date' }] },
        { id: 'cap-payment-reminders', pillar: 'invoicing', name: 'Automated payment reminders', status: 'partial', type: 'list', dataKey: 'paymentReminders', icon: 'fa-bell',
          route: "showSection('cap-payment-reminders')", cols: ['invoice', 'channel', 'schedule', 'lastSent', 'status'],
          form: [{ key: 'invoice', label: 'Invoice #', type: 'text' }, { key: 'channel', label: 'Channel', type: 'select', options: ['Email', 'SMS', 'WhatsApp'] }, { key: 'schedule', label: 'Schedule', type: 'text' }, { key: 'lastSent', label: 'Last Sent', type: 'date' }, { key: 'status', label: 'Status', type: 'select', options: ['Scheduled', 'Sent', 'Paused'] }] },
        { id: 'cap-multi-currency', pillar: 'invoicing', name: 'Multi-currency & multi-language', status: 'partial', type: 'settings', dataKey: 'currencySettings', icon: 'fa-globe',
          route: "showSection('cap-multi-currency')" },
        { id: 'cap-purchase-orders', pillar: 'purchasing', name: 'Bills & Purchase Orders', status: 'partial', type: 'list', dataKey: 'purchaseOrders', icon: 'fa-file-invoice',
          route: "showSection('cap-purchase-orders')", cols: ['number', 'vendor', 'amount', 'status', 'date'],
          form: [{ key: 'number', label: 'PO / Bill #', type: 'text' }, { key: 'vendor', label: 'Vendor', type: 'text' }, { key: 'amount', label: 'Amount (₹)', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Open', 'Billed', 'Paid'] }, { key: 'date', label: 'Date', type: 'date' }] },
        { id: 'cap-expenses', pillar: 'purchasing', name: 'Expense tracking (receipt scan)', status: 'partial', type: 'list', dataKey: 'expenses', icon: 'fa-receipt',
          route: "showSection('cap-expenses')", cols: ['description', 'category', 'amount', 'date', 'status'],
          form: [{ key: 'description', label: 'Description', type: 'text' }, { key: 'category', label: 'Category', type: 'select', options: ['Travel', 'Meals', 'Office', 'Utilities', 'Other'] }, { key: 'amount', label: 'Amount (₹)', type: 'number' }, { key: 'date', label: 'Date', type: 'date' }, { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Submitted', 'Approved', 'Reimbursed'] }] },
        { id: 'cap-recurring-expenses', pillar: 'purchasing', name: 'Recurring expenses & bills', status: 'partial', type: 'list', dataKey: 'recurringExpenses', icon: 'fa-rotate',
          route: "showSection('cap-recurring-expenses')", cols: ['name', 'vendor', 'amount', 'frequency', 'nextDue'],
          form: [{ key: 'name', label: 'Name', type: 'text' }, { key: 'vendor', label: 'Vendor', type: 'text' }, { key: 'amount', label: 'Amount (₹)', type: 'number' }, { key: 'frequency', label: 'Frequency', type: 'select', options: ['Monthly', 'Quarterly', 'Yearly'] }, { key: 'nextDue', label: 'Next Due', type: 'date' }] },
        { id: 'cap-vendor-credits', pillar: 'purchasing', name: 'Vendor credits & payments', status: 'partial', type: 'list', dataKey: 'vendorCredits', icon: 'fa-money-bill-transfer',
          route: "showSection('cap-vendor-credits')", cols: ['vendor', 'reference', 'amount', 'applied', 'balance'],
          form: [{ key: 'vendor', label: 'Vendor', type: 'text' }, { key: 'reference', label: 'Reference', type: 'text' }, { key: 'amount', label: 'Credit (₹)', type: 'number' }, { key: 'applied', label: 'Applied (₹)', type: 'number' }, { key: 'balance', label: 'Balance (₹)', type: 'number' }] },
        { id: 'cap-vendor-portal', pillar: 'purchasing', name: 'Vendor Portal', status: 'partial', type: 'connect', dataKey: 'vendorPortal', icon: 'fa-store',
          route: "showSection('cap-vendor-portal')", provider: 'Vendor Portal', desc: 'Invite vendors to submit bills, track POs, and view payment status.' },
        { id: 'cap-mileage', pillar: 'purchasing', name: 'Mileage tracking', status: 'partial', type: 'list', dataKey: 'mileageLogs', icon: 'fa-car',
          route: "showSection('cap-mileage')", cols: ['date', 'from', 'to', 'km', 'rate', 'amount'],
          form: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'from', label: 'From', type: 'text' }, { key: 'to', label: 'To', type: 'text' }, { key: 'km', label: 'Distance (km)', type: 'number' }, { key: 'rate', label: 'Rate/km (₹)', type: 'number' }, { key: 'amount', label: 'Amount (₹)', type: 'number' }] },
        { id: 'cap-bank-feeds', pillar: 'banking', name: 'Auto bank & credit card feeds', status: 'partial', type: 'connect', dataKey: 'bankFeedConnections', icon: 'fa-plug',
          route: "showSection('cap-bank-feeds')", provider: 'Bank Feed', desc: 'Connect HDFC, ICICI, SBI, Axis and credit cards for automatic transaction import.' },
        { id: 'cap-bank-rules', pillar: 'banking', name: 'Bank rules & AI categorization', status: 'partial', type: 'list', dataKey: 'bankRules', icon: 'fa-wand-magic-sparkles',
          route: "showSection('cap-bank-rules')", cols: ['name', 'match', 'category', 'priority', 'active'],
          form: [{ key: 'name', label: 'Rule Name', type: 'text' }, { key: 'match', label: 'Match Pattern', type: 'text' }, { key: 'category', label: 'Category', type: 'text' }, { key: 'priority', label: 'Priority', type: 'number' }, { key: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'] }] },
        { id: 'cap-bank-accounts', pillar: 'banking', name: 'Multiple bank accounts', status: 'partial', type: 'list', dataKey: 'bankAccounts', icon: 'fa-building-columns',
          route: "showSection('cap-bank-accounts')", cols: ['name', 'bank', 'account', 'ifsc', 'balance'],
          form: [{ key: 'name', label: 'Account Label', type: 'text' }, { key: 'bank', label: 'Bank', type: 'text' }, { key: 'account', label: 'Account #', type: 'text' }, { key: 'ifsc', label: 'IFSC', type: 'text' }, { key: 'balance', label: 'Balance (₹)', type: 'number' }] },
        { id: 'cap-e-invoicing', pillar: 'gst', name: 'e-Invoicing (IRN generation)', status: 'partial', type: 'connect', dataKey: 'einvoiceConfig', icon: 'fa-qrcode',
          route: "showSection('cap-e-invoicing')", provider: 'NIC e-Invoice', desc: 'Generate IRN and QR code via NIC IRP for B2B invoices above threshold.' },
        { id: 'cap-eway-bill', pillar: 'gst', name: 'e-Way Bill generation', status: 'partial', type: 'connect', dataKey: 'ewayConfig', icon: 'fa-truck',
          route: "showSection('cap-eway-bill')", provider: 'NIC e-Way Bill', desc: 'Generate Part-A/B e-Way bills from invoices with vehicle and transporter details.' },
        { id: 'cap-gstr-filing', pillar: 'gst', name: 'GSTR-1, GSTR-3B, GSTR-9 filing', status: 'live', type: 'list', dataKey: 'gstrFilings', icon: 'fa-file-export',
          route: "showSection('gst-returns')", cols: ['return', 'period', 'status', 'filedOn', 'arn'],
          form: [{ key: 'return', label: 'Return', type: 'select', options: ['GSTR-1', 'GSTR-3B', 'GSTR-9'] }, { key: 'period', label: 'Period', type: 'text' }, { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Ready', 'Filed'] }, { key: 'filedOn', label: 'Filed On', type: 'date' }, { key: 'arn', label: 'ARN', type: 'text' }] },
        { id: 'cap-gstr2b', pillar: 'gst', name: 'GSTR-2B reconciliation', status: 'live', type: 'list', dataKey: 'gstr2bRecon', icon: 'fa-code-compare',
          route: "showSection('gst-returns')", cols: ['supplier', 'invoice', 'booksItc', 'gstr2bItc', 'match'],
          form: [{ key: 'supplier', label: 'Supplier', type: 'text' }, { key: 'invoice', label: 'Invoice #', type: 'text' }, { key: 'booksItc', label: 'Books ITC (₹)', type: 'number' }, { key: 'gstr2bItc', label: '2B ITC (₹)', type: 'number' }, { key: 'match', label: 'Match', type: 'select', options: ['Matched', 'Mismatch', 'Missing in 2B', 'Missing in Books'] }] },
        { id: 'cap-multi-gstin', pillar: 'gst', name: 'Multi-GSTIN support', status: 'partial', type: 'list', dataKey: 'gstinList', icon: 'fa-sitemap',
          route: "showSection('cap-multi-gstin')", cols: ['gstin', 'tradeName', 'state', 'primary', 'active'],
          form: [{ key: 'gstin', label: 'GSTIN', type: 'text' }, { key: 'tradeName', label: 'Trade Name', type: 'text' }, { key: 'state', label: 'State Code', type: 'text' }, { key: 'primary', label: 'Primary', type: 'select', options: ['Yes', 'No'] }, { key: 'active', label: 'Active', type: 'select', options: ['Yes', 'No'] }] },
        { id: 'cap-warehouses', pillar: 'inventory', name: 'Multiple warehouses / godowns', status: 'partial', type: 'list', dataKey: 'warehouses', icon: 'fa-warehouse',
          route: "showSection('cap-warehouses')", cols: ['name', 'location', 'manager', 'items', 'status'],
          form: [{ key: 'name', label: 'Warehouse', type: 'text' }, { key: 'location', label: 'Location', type: 'text' }, { key: 'manager', label: 'Manager', type: 'text' }, { key: 'items', label: 'SKU Count', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }] },
        { id: 'cap-price-lists', pillar: 'inventory', name: 'Price lists & reorder alerts', status: 'partial', type: 'list', dataKey: 'priceLists', icon: 'fa-tags',
          route: "showSection('cap-price-lists')", cols: ['name', 'currency', 'items', 'validFrom', 'status'],
          form: [{ key: 'name', label: 'Price List', type: 'text' }, { key: 'currency', label: 'Currency', type: 'text' }, { key: 'items', label: '# Items', type: 'number' }, { key: 'validFrom', label: 'Valid From', type: 'date' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Expired'] }] },
        { id: 'cap-batch-serial', pillar: 'inventory', name: 'Batch & serial number tracking', status: 'partial', type: 'list', dataKey: 'batches', icon: 'fa-barcode',
          route: "showSection('cap-batch-serial')", cols: ['item', 'batchNo', 'serial', 'qty', 'expiry'],
          form: [{ key: 'item', label: 'Item', type: 'text' }, { key: 'batchNo', label: 'Batch #', type: 'text' }, { key: 'serial', label: 'Serial #', type: 'text' }, { key: 'qty', label: 'Qty', type: 'number' }, { key: 'expiry', label: 'Expiry', type: 'date' }] },
        { id: 'cap-composite-items', pillar: 'inventory', name: 'Composite items & shipments', status: 'partial', type: 'list', dataKey: 'compositeItems', icon: 'fa-cubes',
          route: "showSection('cap-composite-items')", cols: ['name', 'components', 'sellPrice', 'stock', 'status'],
          form: [{ key: 'name', label: 'Bundle Name', type: 'text' }, { key: 'components', label: 'Components', type: 'text' }, { key: 'sellPrice', label: 'Sell Price (₹)', type: 'number' }, { key: 'stock', label: 'Available', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] }] },
        { id: 'cap-ecommerce', pillar: 'inventory', name: 'E-commerce integrations', status: 'partial', type: 'connect', dataKey: 'ecommerceConnections', icon: 'fa-bag-shopping',
          route: "showSection('cap-ecommerce')", provider: 'E-commerce', desc: 'Sync orders and inventory with Shopify, Amazon, Etsy and other marketplaces.' },
        { id: 'cap-projects', pillar: 'projects', name: 'Project creation with budgeting', status: 'partial', type: 'list', dataKey: 'projects', icon: 'fa-folder-open',
          route: "showSection('cap-projects')", cols: ['name', 'client', 'budget', 'spent', 'status'],
          form: [{ key: 'name', label: 'Project', type: 'text' }, { key: 'client', label: 'Client', type: 'text' }, { key: 'budget', label: 'Budget (₹)', type: 'number' }, { key: 'spent', label: 'Spent (₹)', type: 'number' }, { key: 'status', label: 'Status', type: 'select', options: ['Planning', 'Active', 'On Hold', 'Completed'] }] },
        { id: 'cap-timesheets', pillar: 'projects', name: 'Timesheets & task management', status: 'partial', type: 'list', dataKey: 'timesheets', icon: 'fa-clock',
          route: "showSection('cap-timesheets')", cols: ['date', 'project', 'task', 'hours', 'billable'],
          form: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'project', label: 'Project', type: 'text' }, { key: 'task', label: 'Task', type: 'text' }, { key: 'hours', label: 'Hours', type: 'number' }, { key: 'billable', label: 'Billable', type: 'select', options: ['Yes', 'No'] }] },
        { id: 'cap-project-profit', pillar: 'projects', name: 'Project profitability tracking', status: 'partial', type: 'report', dataKey: 'projects', icon: 'fa-chart-line',
          route: "showSection('cap-project-profit')" },
        { id: 'cap-project-billing', pillar: 'projects', name: 'Bill clients (time, expenses, retainers)', status: 'partial', type: 'list', dataKey: 'projectBillings', icon: 'fa-file-invoice',
          route: "showSection('cap-project-billing')", cols: ['project', 'type', 'amount', 'invoice', 'status'],
          form: [{ key: 'project', label: 'Project', type: 'text' }, { key: 'type', label: 'Billing Type', type: 'select', options: ['Time', 'Expense', 'Retainer', 'Fixed'] }, { key: 'amount', label: 'Amount (₹)', type: 'number' }, { key: 'invoice', label: 'Invoice #', type: 'text' }, { key: 'status', label: 'Status', type: 'select', options: ['Draft', 'Invoiced', 'Paid'] }] },
        { id: 'cap-report-catalog', pillar: 'reports', name: '70+ built-in reports', status: 'partial', type: 'report', dataKey: null, icon: 'fa-table-list',
          route: "showSection('cap-report-catalog')" },
        { id: 'cap-financial-reports', pillar: 'reports', name: 'Balance Sheet, P&L, Cash Flow', status: 'partial', type: 'report', dataKey: null, icon: 'fa-scale-unbalanced',
          route: "showSection('cap-financial-reports')" },
        { id: 'cap-custom-reports', pillar: 'reports', name: 'Custom reports & dashboards', status: 'partial', type: 'list', dataKey: 'customReports', icon: 'fa-sliders',
          route: "showSection('cap-custom-reports')", cols: ['name', 'type', 'schedule', 'owner', 'lastRun'],
          form: [{ key: 'name', label: 'Report Name', type: 'text' }, { key: 'type', label: 'Type', type: 'select', options: ['Table', 'Chart', 'Dashboard'] }, { key: 'schedule', label: 'Schedule', type: 'text' }, { key: 'owner', label: 'Owner', type: 'text' }, { key: 'lastRun', label: 'Last Run', type: 'date' }] },
        { id: 'cap-scheduled-reports', pillar: 'reports', name: 'Scheduled reports via email', status: 'partial', type: 'list', dataKey: 'scheduledReports', icon: 'fa-envelope-circle-check',
          route: "showSection('cap-scheduled-reports')", cols: ['report', 'recipients', 'frequency', 'nextRun', 'status'],
          form: [{ key: 'report', label: 'Report', type: 'text' }, { key: 'recipients', label: 'Recipients', type: 'text' }, { key: 'frequency', label: 'Frequency', type: 'select', options: ['Daily', 'Weekly', 'Monthly'] }, { key: 'nextRun', label: 'Next Run', type: 'date' }, { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Paused'] }] },
        { id: 'cap-bi-integration', pillar: 'reports', name: 'Zoho Analytics / advanced BI', status: 'partial', type: 'connect', dataKey: 'biConnections', icon: 'fa-chart-network',
          route: "showSection('cap-bi-integration')", provider: 'BI Integration', desc: 'Connect Zoho Analytics, Power BI, or Looker for advanced dashboards.' }
    ];

    const LIVE_LINKS = [
        { pillar: 'invoicing', name: 'Professional customizable invoices', route: 'launchInvoiceMaker()', status: 'live' },
        { pillar: 'invoicing', name: 'Customer Portal', route: "showSection('dashboard')", status: 'live' },
        { pillar: 'purchasing', name: 'Approval workflows', route: "showSection('team-approvals')", status: 'partial' },
        { pillar: 'banking', name: 'Fast bank reconciliation', route: "showSection('bank-recon')", status: 'live' },
        { pillar: 'gst', name: 'GST Returns Hub (status + 2B + bulk)', route: "showSection('gst-returns')", status: 'live' },
        { pillar: 'gst', name: 'GSTR-1 / 3B / 9 JSON & CSV export', route: "showSection('gstr-export')", status: 'live' },
        { pillar: 'gst', name: 'GST Compliance Suite (CN/DN, audit, 1A)', route: "showSection('gst-compliance')", status: 'live' },
        { pillar: 'gst', name: 'Automatic GST (CGST/SGST/IGST)', route: 'launchInvoiceMaker()', status: 'live' },
        { pillar: 'gst', name: 'HSN/SAC code support', route: "showSection('hsn-search')", status: 'live' },
        { pillar: 'gst', name: 'GST-compliant invoices', route: 'launchInvoiceMaker()', status: 'live' },
        { pillar: 'inventory', name: 'Item master with stock tracking', route: "showSection('stock')", status: 'live' },
        { pillar: 'reports', name: 'Revenue & client reports', route: "showSection('sales-report')", status: 'partial' }
    ];

    const REPORT_CATALOG = [
        { cat: 'Financial', reports: ['Profit & Loss', 'Balance Sheet', 'Cash Flow', 'Trial Balance', 'General Ledger', 'Accounts Receivable Aging', 'Accounts Payable Aging'] },
        { cat: 'GST', reports: ['GSTR-1 Summary', 'GSTR-3B Summary', 'HSN Summary', 'ITC Ledger', 'Output Tax', 'Input Tax Credit'] },
        { cat: 'Inventory', reports: ['Stock Summary', 'Stock Movement', 'Reorder Status', 'Warehouse Stock', 'Item-wise Sales'] },
        { cat: 'Sales', reports: ['Sales by Customer', 'Sales by Item', 'Invoice Register', 'Quote Conversion', 'Payment Collection'] },
        { cat: 'Purchases', reports: ['Purchase Register', 'Vendor Balances', 'Expense by Category', 'Bill Aging'] },
        { cat: 'Projects', reports: ['Project Profitability', 'Timesheet Summary', 'Unbilled Hours', 'Budget vs Actual'] }
    ];

    function esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function today() {
        return new Date().toISOString().split('T')[0];
    }

    function uid(prefix) {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    }

    function getFeature(id) {
        return FEATURES.find(f => f.id === id);
    }

    function getPillarFeatures(pillarId) {
        return FEATURES.filter(f => f.pillar === pillarId);
    }

    function ensureCapabilityData(client) {
        if (!client) return;
        const defaults = {
            quotes: [], progressBillings: [], retainers: [], creditNotes: [], debitNotes: [], deliveryChallans: [],
            paymentLinks: [], paymentReminders: [],
            currencySettings: { base: 'INR', language: 'en', currencies: [{ code: 'INR', symbol: '₹', rate: 1 }, { code: 'USD', symbol: '$', rate: 83.5 }] },
            purchaseOrders: [], expenses: [], recurringExpenses: [], vendorCredits: [], vendors: [], mileageLogs: [],
            bankAccounts: [], bankRules: [], bankFeedConnections: [],
            einvoiceConfig: { connected: false, gstin: '', username: '', apiKey: '' },
            ewayConfig: { connected: false, gstin: '', transporterId: '' },
            gstrFilings: [], gstr2bRecon: [], gstinList: [],
            warehouses: [], priceLists: [], batches: [], compositeItems: [],
            ecommerceConnections: {}, vendorPortal: { enabled: false, inviteCount: 0 },
            projects: [], timesheets: [], projectBillings: [],
            customReports: [], scheduledReports: [],
            biConnections: { zoho: false, powerbi: false, looker: false }
        };
        Object.keys(defaults).forEach(k => {
            if (client[k] === undefined) client[k] = Array.isArray(defaults[k]) ? [] : (typeof defaults[k] === 'object' ? JSON.parse(JSON.stringify(defaults[k])) : defaults[k]);
        });
        if (!client.gstinList.length && client.gstin) {
            client.gstinList.push({ id: uid('gst'), gstin: client.gstin, tradeName: client.name, state: client.stateCode, primary: 'Yes', active: 'Yes' });
        }
        if (!client.bankAccounts.length && client.bank?.name) {
            client.bankAccounts.push({ id: uid('ba'), name: 'Primary', bank: client.bank.name, account: client.bank.account, ifsc: client.bank.ifsc, balance: 0 });
        }
        seedCapabilityDemoIfEmpty(client);
    }

    function seedCapabilityDemoIfEmpty(client) {
        if (client._capSeeded) return;
        const hasAny = FEATURES.some(f => f.dataKey && Array.isArray(client[f.dataKey]) && client[f.dataKey].length > 0);
        if (hasAny) { client._capSeeded = true; return; }

        client.quotes = [
            { id: uid('qt'), number: 'QT-2026-012', party: 'Metro Retail Pvt Ltd', amount: 185000, status: 'Sent', date: '2026-06-01' },
            { id: uid('qt'), number: 'QT-2026-018', party: 'Sunrise Distributors', amount: 92000, status: 'Accepted', date: '2026-06-10' }
        ];
        client.progressBillings = [
            { id: uid('pb'), project: 'Warehouse Setup', milestone: 'Phase 1 — Civil', percent: 40, amount: 200000, status: 'Invoiced' }
        ];
        client.retainers = [
            { id: uid('rt'), client: 'Metro Retail Pvt Ltd', period: 'FY 2026-27', amount: 120000, recognized: 40000, balance: 80000 }
        ];
        client.creditNotes = [
            { id: uid('cn'), number: 'CN-2026-003', type: 'Credit Note', againstInvoice: 'INV-2026-0042', amount: 5000, date: '2026-06-20' }
        ];
        client.paymentLinks = [
            { id: uid('pl'), invoice: 'INV-2026-0043', gateway: 'Razorpay', amount: 103250, status: 'Active', expires: '2026-08-01' }
        ];
        client.paymentReminders = [
            { id: uid('pr'), invoice: 'INV-2026-0043', channel: 'Email', schedule: '3 days before due', lastSent: '2026-06-25', status: 'Scheduled' }
        ];
        client.purchaseOrders = [
            { id: uid('po'), number: 'PO-2026-044', vendor: 'ABC Suppliers', amount: 65000, status: 'Billed', date: '2026-06-08' }
        ];
        client.expenses = [
            { id: uid('ex'), description: 'Client visit — Noida', category: 'Travel', amount: 2400, date: '2026-06-12', status: 'Approved' }
        ];
        client.recurringExpenses = [
            { id: uid('re'), name: 'Office Rent', vendor: 'DLF Properties', amount: 45000, frequency: 'Monthly', nextDue: '2026-07-05' }
        ];
        client.vendorCredits = [
            { id: uid('vc'), vendor: 'Global Traders', reference: 'DN-8842', amount: 3500, applied: 0, balance: 3500 }
        ];
        client.mileageLogs = [
            { id: uid('ml'), date: '2026-06-14', from: 'Mayur Vihar', to: 'Connaught Place', km: 18, rate: 12, amount: 216 }
        ];
        client.bankRules = [
            { id: uid('br'), name: 'NEFT Receipts', match: 'NEFT*', category: 'Sales Receipt', priority: 1, active: 'Yes' },
            { id: uid('br'), name: 'Vendor Payments', match: 'IMPS*', category: 'Purchase Payment', priority: 2, active: 'Yes' }
        ];
        client.gstrFilings = [
            { id: uid('gf'), return: 'GSTR-1', period: 'Jun 2026', status: 'Filed', filedOn: '2026-07-11', arn: 'AA070726123456Z' },
            { id: uid('gf'), return: 'GSTR-3B', period: 'Jun 2026', status: 'Ready', filedOn: '', arn: '' }
        ];
        client.gstr2bRecon = [
            { id: uid('g2'), supplier: 'ABC Suppliers', invoice: 'ABC/2026/118', booksItc: 11700, gstr2bItc: 11700, match: 'Matched' }
        ];
        client.warehouses = [
            { id: uid('wh'), name: 'Main Godown', location: 'Mayur Vihar', manager: 'Ravi Kumar', items: 3, status: 'Active' }
        ];
        client.priceLists = [
            { id: uid('prl'), name: 'Retail', currency: 'INR', items: 3, validFrom: '2026-04-01', status: 'Active' }
        ];
        client.batches = [
            { id: uid('bt'), item: 'Premium Widget X200', batchNo: 'BATCH-A42', serial: '', qty: 120, expiry: '2027-06-01' }
        ];
        client.compositeItems = [
            { id: uid('ci'), name: 'Widget Starter Kit', components: 'Widget X200 + Fastener Kit', sellPrice: 1550, stock: 25, status: 'Active' }
        ];
        client.projects = [
            { id: uid('pj'), name: 'ERP Migration', client: 'Metro Retail Pvt Ltd', budget: 500000, spent: 185000, status: 'Active' }
        ];
        client.timesheets = [
            { id: uid('ts'), date: '2026-06-28', project: 'ERP Migration', task: 'Data mapping', hours: 6, billable: 'Yes' }
        ];
        client.projectBillings = [
            { id: uid('pbl'), project: 'ERP Migration', type: 'Time', amount: 18000, invoice: '', status: 'Draft' }
        ];
        client.customReports = [
            { id: uid('cr'), name: 'Monthly Sales Dashboard', type: 'Dashboard', schedule: 'On demand', owner: 'CA Priya', lastRun: '2026-07-01' }
        ];
        client.scheduledReports = [
            { id: uid('sr'), report: 'GSTR-3B Summary', recipients: 'accounts@client.com', frequency: 'Monthly', nextRun: '2026-07-20', status: 'Active' }
        ];
        client._capSeeded = true;
    }

    const _origEnsure = window.ensureClientExtensions;
    window.ensureClientExtensions = function (client) {
        if (_origEnsure) _origEnsure(client);
        ensureCapabilityData(client);
    };

    function badge(status) {
        const st = STATUS[status] || STATUS.partial;
        return `<span class="lf-cap-badge ${st.cls}"><i class="fa-solid ${st.icon}"></i> ${esc(st.label)}</span>`;
    }

    function btn(label, onclick, variant = 'primary') {
        if (typeof LedgerFlowComponents !== 'undefined') {
            return LedgerFlowComponents.button({ label, onclick, variant, size: 'sm' });
        }
        return `<button type="button" onclick="${onclick}" class="lf-btn lf-btn--${variant} lf-btn--sm">${esc(label)}</button>`;
    }

    function pageHeader(title, subtitle, actions) {
        if (typeof LedgerFlowDesign !== 'undefined') {
            return LedgerFlowDesign.renderPageHeader({ title, subtitle, actionsHtml: actions || '' });
        }
        return `<div class="mb-6"><h2 class="text-2xl font-semibold">${esc(title)}</h2><p class="text-sm text-slate-400">${esc(subtitle || '')}</p>${actions || ''}</div>`;
    }

    function emptyState(title, cta) {
        if (typeof LedgerFlowUI !== 'undefined') {
            return LedgerFlowUI.renderEmptyState({ title, icon: 'fa-inbox', ctaLabel: cta?.label, ctaOnclick: cta?.onclick });
        }
        return `<div class="text-center py-12 text-slate-400">${esc(title)}</div>`;
    }

    function renderHub(container) {
        const all = summarizeCoverage();
        container.innerHTML = `
            ${pageHeader('Product Suite', `${all.score}% coverage — ${all.live} live, ${all.partial} partial across ${all.total} capabilities`)}
            <div class="lf-cap-summary-bar mb-6" aria-label="Coverage ${all.score}%"><div class="lf-cap-summary-fill" style="width:${all.score}%"></div></div>
            <div class="lf-cap-pillar-grid mb-6">
                ${PILLARS.map(p => {
                    const feats = getPillarFeatures(p.id).length + LIVE_LINKS.filter(l => l.pillar === p.id).length;
                    const partial = getPillarFeatures(p.id).filter(f => f.status === 'partial').length;
                    return `
                    <article class="lf-cap-pillar lf-cap-pillar--clickable" onclick="showSection('${p.section}')">
                        <header class="lf-cap-pillar-head">
                            <i class="fa-solid ${p.icon}"></i>
                            <div class="lf-cap-pillar-title">${esc(p.title)}</div>
                            <i class="fa-solid fa-arrow-right text-slate-500"></i>
                        </header>
                        <p class="text-xs text-slate-500 px-4 pb-3">${feats} capabilities · ${partial} with working UI</p>
                    </article>`;
                }).join('')}
            </div>
            ${typeof LedgerFlowCapabilities !== 'undefined' ? LedgerFlowCapabilities.renderCapabilitiesGuide() : ''}`;
    }

    function summarizeCoverage() {
        let live = LIVE_LINKS.filter(l => l.status === 'live').length;
        let partial = FEATURES.length + LIVE_LINKS.filter(l => l.status === 'partial').length;
        const total = 44;
        const score = Math.round(((live + partial * 0.5) / total) * 100);
        return { live, partial, total, score };
    }

    function renderPillar(container, pillarId) {
        const pillar = PILLARS.find(p => p.id === pillarId);
        const features = getPillarFeatures(pillarId);
        const live = LIVE_LINKS.filter(l => l.pillar === pillarId);
        container.innerHTML = `
            ${pageHeader(pillar.title, 'All capabilities in this pillar — click to open')}
            <div class="lf-cap-feature-grid">
                ${live.map(f => `
                    <div class="lf-cap-feature-card" onclick="${f.route}">
                        <div class="lf-cap-feature-card-head">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                            ${badge(f.status)}
                        </div>
                        <div class="lf-cap-feature-card-name">${esc(f.name)}</div>
                        <div class="text-xs text-teal-500 mt-2">Open in app →</div>
                    </div>`).join('')}
                ${features.map(f => `
                    <div class="lf-cap-feature-card" onclick="${f.route}">
                        <div class="lf-cap-feature-card-head">
                            <i class="fa-solid ${f.icon}"></i>
                            ${badge(f.status)}
                        </div>
                        <div class="lf-cap-feature-card-name">${esc(f.name)}</div>
                        <div class="text-xs text-teal-500 mt-2">Open module →</div>
                    </div>`).join('')}
            </div>
            <div class="mt-6">
                <button type="button" onclick="showSection('cap-hub')" class="lf-btn lf-btn--ghost"><i class="fa-solid fa-arrow-left mr-1"></i> All Capabilities</button>
            </div>`;
    }

    function renderListModule(container, feature) {
        const client = getCurrentClient();
        ensureCapabilityData(client);
        const rows = client[feature.dataKey] || [];
        const colLabels = feature.cols.map(c => c.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()));

        container.innerHTML = `
            ${pageHeader(feature.name, 'Create, edit, and manage records locally — syncs to client data store')}
            <div class="flex flex-wrap gap-2 mb-4">
                ${btn('+ Add New', `LedgerFlowCapabilityModules.openForm('${feature.id}')`)}
                ${btn('Export CSV', `LedgerFlowCapabilityModules.exportCsv('${feature.id}')`, 'secondary')}
            </div>
            <div class="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
                <table class="w-full data-table lf-table lf-table--zebra">
                    <thead><tr>${colLabels.map(l => `<th>${esc(l)}</th>`).join('')}<th></th></tr></thead>
                    <tbody>
                        ${rows.length ? rows.map(row => `
                            <tr>
                                ${feature.cols.map(c => `<td>${esc(row[c])}</td>`).join('')}
                                <td class="text-right whitespace-nowrap">
                                    <button onclick="LedgerFlowCapabilityModules.openForm('${feature.id}','${row.id}')" class="text-teal-400 px-2"><i class="fa-solid fa-pen"></i></button>
                                    <button onclick="LedgerFlowCapabilityModules.deleteRow('${feature.id}','${row.id}')" class="text-red-400 px-2"><i class="fa-solid fa-trash"></i></button>
                                </td>
                            </tr>`).join('') : `<tr><td colspan="${feature.cols.length + 1}">${emptyState('No records yet', { label: 'Add first record', onclick: `LedgerFlowCapabilityModules.openForm('${feature.id}')` })}</td></tr>`}
                    </tbody>
                </table>
            </div>
            <div class="mt-4"><button type="button" onclick="showSection('cap-pillar-${feature.pillar}')" class="lf-btn lf-btn--ghost text-sm"><i class="fa-solid fa-arrow-left mr-1"></i> Back to pillar</button></div>
            <div id="cap-modal-root"></div>`;
    }

    function renderConnectModule(container, feature) {
        const client = getCurrentClient();
        ensureCapabilityData(client);
        const cfg = client[feature.dataKey] || {};
        const isObj = cfg && !Array.isArray(cfg);
        const connected = isObj ? !!cfg.connected || !!cfg.enabled || !!cfg.zoho : (cfg.length > 0);

        let body = '';
        if (feature.id === 'cap-ecommerce') {
            const providers = ['Shopify', 'Amazon', 'Etsy', 'WooCommerce'];
            body = providers.map(p => {
                const key = p.toLowerCase();
                const on = client.ecommerceConnections[key];
                return connectCard(p, !!on, `LedgerFlowCapabilityModules.toggleConnect('${feature.id}','${key}')`);
            }).join('');
        } else if (feature.id === 'cap-bi-integration') {
            body = ['Zoho Analytics', 'Power BI', 'Looker Studio'].map(p => {
                const key = p.toLowerCase().split(' ')[0].replace('looker', 'looker');
                const k = p.includes('Zoho') ? 'zoho' : p.includes('Power') ? 'powerbi' : 'looker';
                return connectCard(p, !!client.biConnections[k], `LedgerFlowCapabilityModules.toggleConnect('${feature.id}','${k}')`);
            }).join('');
        } else if (feature.id === 'cap-bank-feeds') {
            body = ['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank'].map(b => {
                const key = b.split(' ')[0].toLowerCase();
                const on = (client.bankFeedConnections || []).find(c => c.bank === b);
                return connectCard(b, !!on, `LedgerFlowCapabilityModules.connectBankFeed('${b}')`);
            }).join('');
        } else {
            body = `
                <div class="lf-cap-connect-card ${connected ? 'lf-cap-connect-card--on' : ''}">
                    <div class="lf-cap-connect-icon"><i class="fa-solid ${feature.icon}"></i></div>
                    <div class="flex-1">
                        <div class="font-semibold">${esc(feature.provider)}</div>
                        <p class="text-sm text-slate-400">${esc(feature.desc)}</p>
                    </div>
                    <button type="button" onclick="LedgerFlowCapabilityModules.toggleConnect('${feature.id}')" class="lf-btn lf-btn--${connected ? 'secondary' : 'primary'}">${connected ? 'Connected' : 'Connect'}</button>
                </div>
                <div class="mt-6 bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-3">
                    <div class="text-sm font-semibold text-slate-300">Configuration</div>
                    ${isObj ? Object.keys(cfg).filter(k => k !== 'connected' && k !== 'enabled').map(k => `
                        <div><label class="text-xs text-slate-400">${esc(k)}</label>
                        <input id="cap-cfg-${k}" value="${esc(cfg[k] || '')}" class="form-input w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm"></div>`).join('') : ''}
                    <button type="button" onclick="LedgerFlowCapabilityModules.saveConnectConfig('${feature.id}')" class="lf-btn lf-btn--primary">Save Configuration</button>
                </div>`;
        }

        container.innerHTML = `
            ${pageHeader(feature.name, feature.desc)}
            <div class="lf-cap-connect-grid">${body}</div>
            <div class="mt-4 p-4 bg-amber-900/20 border border-amber-800 rounded-2xl text-xs text-amber-300">
                <i class="fa-solid fa-plug mr-1"></i> External API credentials are stored locally. Production deployment uses secure backend vault.
            </div>
            <div class="mt-4"><button type="button" onclick="showSection('cap-pillar-${feature.pillar}')" class="lf-btn lf-btn--ghost text-sm"><i class="fa-solid fa-arrow-left mr-1"></i> Back</button></div>`;
    }

    function connectCard(name, on, onclick) {
        return `
            <div class="lf-cap-connect-card ${on ? 'lf-cap-connect-card--on' : ''}">
                <div class="lf-cap-connect-icon"><i class="fa-solid fa-plug"></i></div>
                <div class="flex-1 font-medium">${esc(name)}</div>
                <button type="button" onclick="${onclick}" class="lf-btn lf-btn--${on ? 'secondary' : 'primary'} lf-btn--sm">${on ? 'Connected' : 'Connect'}</button>
            </div>`;
    }

    function renderSettingsModule(container, feature) {
        const client = getCurrentClient();
        ensureCapabilityData(client);
        const cfg = client.currencySettings;
        container.innerHTML = `
            ${pageHeader(feature.name, 'Configure currencies and language for invoices and reports')}
            <div class="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-xl space-y-4">
                <div><label class="text-xs text-slate-400">Base Currency</label>
                    <select id="cap-curr-base" class="form-input w-full">${['INR', 'USD', 'EUR', 'GBP'].map(c => `<option value="${c}" ${cfg.base === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
                <div><label class="text-xs text-slate-400">Default Language</label>
                    <select id="cap-curr-lang" class="form-input w-full">${['en', 'hi'].map(l => `<option value="${l}" ${cfg.language === l ? 'selected' : ''}>${l === 'en' ? 'English' : 'Hindi'}</option>`).join('')}</select></div>
                <div class="text-sm font-semibold pt-2">Exchange Rates</div>
                ${(cfg.currencies || []).map((c, i) => `
                    <div class="grid grid-cols-3 gap-2">
                        <input value="${esc(c.code)}" id="cap-curr-code-${i}" class="form-input" placeholder="Code">
                        <input value="${esc(c.symbol)}" id="cap-curr-sym-${i}" class="form-input" placeholder="Symbol">
                        <input type="number" step="0.01" value="${c.rate}" id="cap-curr-rate-${i}" class="form-input" placeholder="Rate">
                    </div>`).join('')}
                <button type="button" onclick="LedgerFlowCapabilityModules.saveCurrencySettings()" class="lf-btn lf-btn--primary">Save Settings</button>
            </div>
            <div class="mt-4"><button type="button" onclick="showSection('cap-pillar-invoicing')" class="lf-btn lf-btn--ghost text-sm"><i class="fa-solid fa-arrow-left mr-1"></i> Back</button></div>`;
    }

    function renderReportModule(container, feature) {
        const client = getCurrentClient();
        ensureCapabilityData(client);
        let body = '';

        if (feature.id === 'cap-report-catalog') {
            body = REPORT_CATALOG.map(cat => `
                <div class="lf-cap-report-cat">
                    <div class="font-semibold text-teal-400 mb-2">${esc(cat.cat)}</div>
                    <div class="flex flex-wrap gap-2">
                        ${cat.reports.map(r => `<button type="button" onclick="LedgerFlowCapabilityModules.runReport('${esc(r)}')" class="lf-cap-report-chip">${esc(r)}</button>`).join('')}
                    </div>
                </div>`).join('');
        } else if (feature.id === 'cap-financial-reports') {
            body = ['Balance Sheet', 'Profit & Loss', 'Cash Flow Statement'].map(r => `
                <div class="lf-cap-report-card" onclick="LedgerFlowCapabilityModules.runFinancialReport('${r}')">
                    <i class="fa-solid fa-file-pdf text-2xl text-teal-400"></i>
                    <div class="font-semibold">${esc(r)}</div>
                    <div class="text-xs text-slate-500">As of ${today()}</div>
                </div>`).join('');
        } else if (feature.id === 'cap-project-profit') {
            const projects = client.projects || [];
            body = `<div class="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden">
                <table class="w-full data-table"><thead><tr><th>Project</th><th>Budget</th><th>Spent</th><th>Margin</th><th>Margin %</th></tr></thead>
                <tbody>${projects.length ? projects.map(p => {
                    const margin = (p.budget || 0) - (p.spent || 0);
                    const pct = p.budget ? Math.round(margin / p.budget * 100) : 0;
                    return `<tr><td>${esc(p.name)}</td><td>₹${(p.budget||0).toLocaleString('en-IN')}</td><td>₹${(p.spent||0).toLocaleString('en-IN')}</td><td class="${margin >= 0 ? 'text-emerald-400' : 'text-red-400'}">₹${margin.toLocaleString('en-IN')}</td><td>${pct}%</td></tr>`;
                }).join('') : `<tr><td colspan="5" class="text-center py-8 text-slate-400">Add projects to see profitability</td></tr>`}
                </tbody></table></div>`;
        }

        container.innerHTML = `
            ${pageHeader(feature.name, 'Preview and export reports — full GL integration via backend')}
            <div class="lf-cap-report-grid">${body}</div>
            <div id="cap-report-preview" class="mt-6 hidden bg-slate-900 border border-slate-700 rounded-3xl p-6"></div>
            <div class="mt-4"><button type="button" onclick="showSection('cap-pillar-${feature.pillar}')" class="lf-btn lf-btn--ghost text-sm"><i class="fa-solid fa-arrow-left mr-1"></i> Back</button></div>`;
    }

    function openForm(featureId, rowId) {
        const feature = getFeature(featureId);
        if (!feature || !feature.form) return;
        const client = getCurrentClient();
        const row = rowId ? (client[feature.dataKey] || []).find(r => r.id === rowId) : null;
        const fields = feature.form.map(f => {
            let input = '';
            if (f.type === 'select') {
                input = `<select id="cap-f-${f.key}" class="form-input w-full">${f.options.map(o => `<option value="${esc(o)}" ${row && row[f.key] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
            } else {
                const val = row ? row[f.key] : (f.type === 'date' ? today() : '');
                input = `<input type="${f.type}" id="cap-f-${f.key}" value="${esc(val)}" class="form-input w-full">`;
            }
            return `<div><label class="text-xs text-slate-400">${esc(f.label)}</label>${input}</div>`;
        }).join('');

        const root = document.getElementById('cap-modal-root') || document.getElementById('main-content');
        const modal = document.createElement('div');
        modal.id = 'cap-form-modal';
        modal.className = 'lf-modal lf-modal--open';
        modal.innerHTML = `
            <div class="lf-modal__backdrop" onclick="LedgerFlowCapabilityModules.closeForm()"></div>
            <div class="lf-modal__dialog lf-modal__dialog--md">
                <header class="lf-modal__header">
                    <h3 class="lf-modal__title">${row ? 'Edit' : 'Add'} — ${esc(feature.name)}</h3>
                    <button type="button" class="lf-modal__close" onclick="LedgerFlowCapabilityModules.closeForm()"><i class="fa-solid fa-times"></i></button>
                </header>
                <div class="lf-modal__body space-y-3">${fields}</div>
                <footer class="lf-modal__footer">
                    <button type="button" onclick="LedgerFlowCapabilityModules.closeForm()" class="lf-btn lf-btn--ghost">Cancel</button>
                    <button type="button" onclick="LedgerFlowCapabilityModules.saveForm('${featureId}','${rowId || ''}')" class="lf-btn lf-btn--primary">Save</button>
                </footer>
            </div>`;
        (root.querySelector('#cap-modal-root') || root).appendChild(modal);
    }

    function closeForm() {
        document.getElementById('cap-form-modal')?.remove();
    }

    function saveForm(featureId, rowId) {
        const feature = getFeature(featureId);
        const client = getCurrentClient();
        if (!feature || !client) return;
        const data = {};
        feature.form.forEach(f => {
            const el = document.getElementById('cap-f-' + f.key);
            data[f.key] = f.type === 'number' ? (parseFloat(el?.value) || 0) : (el?.value || '').trim();
        });
        if (!client[feature.dataKey]) client[feature.dataKey] = [];
        if (rowId) {
            const idx = client[feature.dataKey].findIndex(r => r.id === rowId);
            if (idx >= 0) client[feature.dataKey][idx] = { ...client[feature.dataKey][idx], ...data };
        } else {
            client[feature.dataKey].unshift({ id: uid('row'), ...data });
        }
        saveAppData();
        closeForm();
        showToast('Saved successfully');
        showSection(featureId);
    }

    function deleteRow(featureId, rowId) {
        if (!confirm('Delete this record?')) return;
        const feature = getFeature(featureId);
        const client = getCurrentClient();
        if (!feature || !client) return;
        client[feature.dataKey] = (client[feature.dataKey] || []).filter(r => r.id !== rowId);
        saveAppData();
        showToast('Deleted');
        showSection(featureId);
    }

    function exportCsv(featureId) {
        const feature = getFeature(featureId);
        const client = getCurrentClient();
        const rows = client[feature.dataKey] || [];
        if (!rows.length) { showToast('No data to export', 'error'); return; }
        const header = feature.cols.join(',');
        const body = rows.map(r => feature.cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = featureId + '_' + today() + '.csv';
        a.click();
        showToast('CSV exported');
    }

    function toggleConnect(featureId, subKey) {
        const client = getCurrentClient();
        const feature = getFeature(featureId);
        if (!client || !feature) return;
        if (featureId === 'cap-ecommerce') {
            if (!client.ecommerceConnections || Array.isArray(client.ecommerceConnections)) client.ecommerceConnections = {};
            client.ecommerceConnections[subKey] = !client.ecommerceConnections[subKey];
        } else if (featureId === 'cap-bi-integration') {
            client.biConnections[subKey] = !client.biConnections[subKey];
        } else if (featureId === 'cap-vendor-portal') {
            client.vendorPortal.enabled = !client.vendorPortal.enabled;
            if (client.vendorPortal.enabled) client.vendorPortal.inviteCount = (client.vendorPortal.inviteCount || 0) + 1;
        } else {
            const cfg = client[feature.dataKey];
            if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) cfg.connected = !cfg.connected;
        }
        saveAppData();
        showToast(client.vendorPortal?.enabled || client.einvoiceConfig?.connected || client.ewayConfig?.connected || client.ecommerceConnections[subKey] || client.biConnections[subKey] ? 'Connected' : 'Disconnected');
        showSection(featureId);
    }

    function connectBankFeed(bankName) {
        const client = getCurrentClient();
        if (!client.bankFeedConnections) client.bankFeedConnections = [];
        const idx = client.bankFeedConnections.findIndex(c => c.bank === bankName);
        if (idx >= 0) client.bankFeedConnections.splice(idx, 1);
        else client.bankFeedConnections.push({ id: uid('bf'), bank: bankName, connectedAt: today(), status: 'Active' });
        saveAppData();
        showToast(idx >= 0 ? 'Disconnected ' + bankName : 'Connected ' + bankName);
        showSection('cap-bank-feeds');
    }

    function saveConnectConfig(featureId) {
        const feature = getFeature(featureId);
        const client = getCurrentClient();
        const cfg = client[feature.dataKey];
        if (!cfg || Array.isArray(cfg)) return;
        Object.keys(cfg).forEach(k => {
            if (k === 'connected' || k === 'enabled') return;
            const el = document.getElementById('cap-cfg-' + k);
            if (el) cfg[k] = el.value.trim();
        });
        saveAppData();
        showToast('Configuration saved');
    }

    function saveCurrencySettings() {
        const client = getCurrentClient();
        const cfg = client.currencySettings;
        cfg.base = document.getElementById('cap-curr-base')?.value || 'INR';
        cfg.language = document.getElementById('cap-curr-lang')?.value || 'en';
        (cfg.currencies || []).forEach((c, i) => {
            c.code = document.getElementById('cap-curr-code-' + i)?.value || c.code;
            c.symbol = document.getElementById('cap-curr-sym-' + i)?.value || c.symbol;
            c.rate = parseFloat(document.getElementById('cap-curr-rate-' + i)?.value) || c.rate;
        });
        saveAppData();
        showToast('Currency settings saved');
        showSection('cap-multi-currency');
    }

    function runReport(name) {
        const el = document.getElementById('cap-report-preview');
        if (!el) return;
        el.classList.remove('hidden');
        const client = getCurrentClient();
        const invCount = (client.invoices || []).length;
        const purCount = (client.purchases || []).length;
        el.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div><h3 class="font-semibold text-lg">${esc(name)}</h3><p class="text-xs text-slate-500">Generated ${today()} · ${esc(client.name)}</p></div>
                <button onclick="showToast('PDF export queued','info')" class="lf-btn lf-btn--secondary lf-btn--sm"><i class="fa-solid fa-download mr-1"></i> Export</button>
            </div>
            <div class="grid grid-cols-3 gap-4 text-sm">
                <div class="bg-slate-950 rounded-xl p-4"><div class="text-slate-500">Invoices</div><div class="text-xl font-semibold">${invCount}</div></div>
                <div class="bg-slate-950 rounded-xl p-4"><div class="text-slate-500">Purchases</div><div class="text-xl font-semibold">${purCount}</div></div>
                <div class="bg-slate-950 rounded-xl p-4"><div class="text-slate-500">Status</div><div class="text-xl font-semibold text-emerald-400">Ready</div></div>
            </div>
            <p class="text-xs text-slate-500 mt-4">Sample preview — connect general ledger for full drill-down.</p>`;
        showToast('Report preview generated');
    }

    function runFinancialReport(name) {
        runReport(name);
    }

    function render(container, section) {
        if (!container) return;
        if (section === 'cap-hub') return renderHub(container);
        const pillarMap = {
            'cap-pillar-invoicing': 'invoicing',
            'cap-pillar-purchasing': 'purchasing',
            'cap-pillar-banking': 'banking',
            'cap-pillar-gst': 'gst',
            'cap-pillar-inventory': 'inventory',
            'cap-pillar-projects': 'projects',
            'cap-pillar-reports': 'reports'
        };
        if (pillarMap[section]) return renderPillar(container, pillarMap[section]);

        const feature = getFeature(section);
        if (!feature) {
            container.innerHTML = pageHeader('Capability', 'Module not found') + emptyState('Unknown capability module');
            return;
        }
        if (feature.type === 'list') return renderListModule(container, feature);
        if (feature.type === 'connect') return renderConnectModule(container, feature);
        if (feature.type === 'settings') return renderSettingsModule(container, feature);
        if (feature.type === 'report') return renderReportModule(container, feature);
    }

    window.LedgerFlowCapabilityModules = {
        PILLARS,
        FEATURES,
        LIVE_LINKS,
        ensureCapabilityData,
        getFeature,
        getPillarFeatures,
        render,
        openForm,
        closeForm,
        saveForm,
        deleteRow,
        exportCsv,
        toggleConnect,
        connectBankFeed,
        saveConnectConfig,
        saveCurrencySettings,
        runReport,
        runFinancialReport,
        summarizeCoverage
    };
})();