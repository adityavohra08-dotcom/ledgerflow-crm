/* Quick test: compare LedgerFlow portal JSON vs offline-tool schema */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const exportPath = path.join(__dirname, '..', 'gstr-return-export.js');
const code = fs.readFileSync(exportPath, 'utf8');
const sandbox = { console };
sandbox.global = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const G = sandbox.GstrReturnExport;

const client = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', 'sample-app-data.json'), 'utf8')).clients.c1;
const built = G.buildValidatedReturn('GSTR-1', client, { month: '2026-06' });
const portal = built.portalData;
console.log('Portal keys:', Object.keys(portal));
console.log('version:', portal.version);
console.log('hsn shape:', portal.hsn ? Object.keys(portal.hsn) : 'missing');
console.log('b2b itm num:', portal.b2b?.[0]?.inv?.[0]?.itms?.[0]?.num);
console.log(JSON.stringify(portal, null, 2));