require('dotenv').config();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { ensureTenant, setTenantData, upsertUser, getTenantData } = require('./db');

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'udyog-suvidha';
const FIRM_EMAIL = 'adityavohra08@gmail.com';
const FIRM_PASSWORD = '2004Aditya@';
const FIRM_NAME = 'CA Priya Sharma';
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

    const hash = bcrypt.hashSync(FIRM_PASSWORD, 10);
    upsertUser({
        id: 'firm',
        tenantId: TENANT_ID,
        email: FIRM_EMAIL,
        passwordHash: hash,
        name: FIRM_NAME,
        role: 'firm',
        clientId: null
    });

    const appData = getTenantData(TENANT_ID);
    if (appData) {
        if (!appData.users) appData.users = {};
        if (!appData.users.firm) appData.users.firm = { role: 'firm', name: FIRM_NAME };
        appData.users.firm.email = FIRM_EMAIL;
        appData.users.firm.password = FIRM_PASSWORD;
        appData.users.firm.name = FIRM_NAME;
        appData.users.firm.role = 'firm';
        if (!appData.firmSettings) appData.firmSettings = {};
        appData.firmSettings.email = FIRM_EMAIL;
        setTenantData(TENANT_ID, appData);
        console.log('Admin login synced in tenant data.');
    }

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

    console.log(`Users seeded (${FIRM_EMAIL} / client123 for clients).`);
    console.log('Done.');
}

main();