/* Validate any GSTR-1 JSON file against portal offline-tool rules */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
    console.error('Usage: node validate-gstr1-file.js <path-to.json>');
    process.exit(1);
}

const exportPath = path.join(__dirname, '..', 'gstr-return-export.js');
const code = fs.readFileSync(exportPath, 'utf8');
const sandbox = { console };
sandbox.global = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const G = sandbox.GstrReturnExport;

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const v = G.validateReturnJson('GSTR-1', data);

console.log('File:', file);
console.log('Engine:', G.VERSION);
console.log('gstin:', data.gstin, '| fp:', data.fp, '| version:', data.version);
console.log('Valid:', v.valid ? 'YES' : 'NO');
if (v.errors.length) {
    console.log('\nERRORS (portal will reject):');
    v.errors.forEach(e => console.log('  ✗', e));
}
if (v.warnings.length) {
    console.log('\nWarnings:');
    v.warnings.forEach(w => console.log('  !', w));
}
process.exit(v.valid ? 0 : 1);