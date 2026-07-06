/**
 * Export localStorage appData to seed-data.json for backend seeding.
 * Run in browser console on LedgerFlow CRM (with demo data loaded):
 *
 *   copy(localStorage.getItem('ledgerflow_crm_data'))
 *
 * Paste into backend/seed-data.json
 *
 * Or from Node if you have the JSON file elsewhere.
 */
const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, 'seed-data.json');
if (!fs.existsSync(out)) {
    console.log('Create backend/seed-data.json by copying localStorage ledgerflow_crm_data from browser.');
    console.log('In browser DevTools console: copy(localStorage.getItem("ledgerflow_crm_data"))');
    process.exit(0);
}
const data = JSON.parse(fs.readFileSync(out, 'utf8'));
console.log(`seed-data.json OK — ${Object.keys(data.clients || {}).length} clients, ${Object.keys(data.users || {}).length} users`);