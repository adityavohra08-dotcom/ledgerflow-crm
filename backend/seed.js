require('dotenv').config();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { ensureTenant, setTenantData, upsertUser, getTenantData } = require('./db');
const {
    FIRM_EMAIL,
    FIRM_PASSWORD,
    FIRM_ADMIN_NAME,
    TENANT_NAME,
    firmSettings: DEFAULT_FIRM_SETTINGS
} = require('./firm-config');

const TENANT_ID = process.env.DEFAULT_TENANT_ID || 'udyog-suvidha';
const samplePath = path.join(__dirname, 'sample-app-data.json');

function loadSampleData() {
    if (fs.existsSync(samplePath)) {
        return JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    }
    console.error('Missing sample-app-data.json — run: node export-sample.js from project root first, or copy demo data.');
    process.exit(1);
}

function syncFirmProfile(appData) {
    if (!appData.users) appData.users = {};
    if (!appData.users.firm) appData.users.firm = { role: 'firm', name: FIRM_ADMIN_NAME };
    appData.users.firm.email = FIRM_EMAIL;
    appData.users.firm.password = FIRM_PASSWORD;
    appData.users.firm.name = FIRM_ADMIN_NAME;
    appData.users.firm.role = 'firm';
    const existingLogo = appData.firmSettings?.logo || '';
    appData.firmSettings = {
        ...JSON.parse(JSON.stringify(DEFAULT_FIRM_SETTINGS)),
        logo: existingLogo
    };
    return appData;
}

async function main() {
    ensureTenant(TENANT_ID, TENANT_NAME);

    if (!getTenantData(TENANT_ID)) {
        const appData = syncFirmProfile(loadSampleData());
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
        name: FIRM_ADMIN_NAME,
        role: 'firm',
        clientId: null
    });

    const appData = getTenantData(TENANT_ID);
    if (appData) {
        setTenantData(TENANT_ID, syncFirmProfile(appData));
        console.log('Admin profile synced in tenant data.');
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

    const teamHash = bcrypt.hashSync('team123', 10);
    upsertUser({
        id: 'team1',
        tenantId: TENANT_ID,
        email: 'staff@wealthbuilders.in',
        passwordHash: teamHash,
        name: 'Priya Sharma',
        role: 'team',
        clientId: null
    });

    if (appData && !appData.users?.team1) {
        appData.users.team1 = {
            email: 'staff@wealthbuilders.in',
            password: 'team123',
            name: 'Priya Sharma',
            role: 'team',
            assignedClientIds: ['c1', 'c2'],
            blocked: false
        };
        if (!appData.teamApprovals) appData.teamApprovals = [];
        setTenantData(TENANT_ID, appData);
    }

    console.log(`Users seeded (${FIRM_EMAIL} / client123 for clients / team123 for team).`);
    console.log('Done.');
}

main();