require('dotenv').config();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { ensureTenant, setTenantData, upsertUser, getTenantData } = require('./db');

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'udyog-suvidha';
const samplePath = path.join(__dirname, 'sample-app-data.json');

function loadSampleData() {
    if (fs.existsSync(samplePath)) {
        return JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    }
    console.error('Missing sample-app-data.json — run: node export-sample.js from project root first, or copy demo data.');
    process.exit(1);
}

async function main() {
    ensureTenant(TENANT_ID, 'Udyog Suvidha & Associates');

    if (!getTenantData(TENANT_ID)) {
        const appData = loadSampleData();
        setTenantData(TENANT_ID, appData);
        console.log('Seeded tenant data.');
    } else {
        console.log('Tenant data already exists — skipping data seed.');
    }

    const hash = bcrypt.hashSync('firm123', 10);
    upsertUser({
        id: 'firm',
        tenantId: TENANT_ID,
        email: 'ca@udyogsuvidha.in',
        passwordHash: hash,
        name: 'CA Priya Sharma',
        role: 'firm',
        clientId: null
    });

    const clients = [
        { id: 'c1', email: 'info@sharmatraders.in', name: 'Sharma Traders', clientId: 'c1' },
        { id: 'c2', email: 'billing@technova.in', name: 'TechNova Solutions', clientId: 'c2' },
        { id: 'c3', email: 'accounts@freshmart.in', name: 'FreshMart Retail', clientId: 'c3' }
    ];
    const clientHash = bcrypt.hashSync('client123', 10);
    clients.forEach(c => {
        upsertUser({
            id: c.id,
            tenantId: TENANT_ID,
            email: c.email,
            passwordHash: clientHash,
            name: c.name,
            role: 'client',
            clientId: c.clientId
        });
    });

    console.log('Users seeded (firm123 / client123).');
    console.log('Done.');
}

main();