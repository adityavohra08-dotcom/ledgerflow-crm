const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || (
    process.env.RAILWAY_VOLUME_MOUNT_PATH
        ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'store.json')
        : path.join(__dirname, 'data', 'store.json')
);
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const defaultStore = { tenants: {}, users: {}, tenant_data: {} };

function readStore() {
    try {
        if (!fs.existsSync(dbPath)) return { ...defaultStore };
        const raw = fs.readFileSync(dbPath, 'utf8');
        const data = JSON.parse(raw);
        return {
            tenants: data.tenants || {},
            users: data.users || {},
            tenant_data: data.tenant_data || {}
        };
    } catch {
        return { ...defaultStore };
    }
}

function writeStore(store) {
    const tmp = dbPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmp, dbPath);
}

function getTenantData(tenantId) {
    const store = readStore();
    const row = store.tenant_data[tenantId];
    return row ? row.data : null;
}

function setTenantData(tenantId, data) {
    const store = readStore();
    store.tenant_data[tenantId] = {
        data,
        updated_at: new Date().toISOString()
    };
    writeStore(store);
}

function findUserByEmail(tenantId, email) {
    const store = readStore();
    const needle = email.toLowerCase();
    return Object.values(store.users).find(u =>
        u.tenant_id === tenantId && u.email.toLowerCase() === needle
    ) || null;
}

function getUserById(id) {
    const store = readStore();
    const u = store.users[id];
    if (!u) return null;
    return {
        id: u.id,
        tenant_id: u.tenant_id,
        email: u.email,
        name: u.name,
        role: u.role,
        client_id: u.client_id || null
    };
}

function upsertUser({ id, tenantId, email, passwordHash, name, role, clientId }) {
    const store = readStore();
    store.users[id] = {
        id,
        tenant_id: tenantId,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name,
        role,
        client_id: clientId || null,
        created_at: store.users[id]?.created_at || new Date().toISOString()
    };
    writeStore(store);
}

function deleteUser(id) {
    const store = readStore();
    if (store.users[id]) {
        delete store.users[id];
        writeStore(store);
    }
}

function pruneTenantUsers(tenantId, validUserIds) {
    const store = readStore();
    const valid = new Set(validUserIds);
    let changed = false;
    Object.keys(store.users).forEach(id => {
        const u = store.users[id];
        if (u.tenant_id === tenantId && u.role !== 'firm' && !valid.has(id)) {
            delete store.users[id];
            changed = true;
        }
    });
    if (changed) writeStore(store);
}

function ensureTenant(id, name) {
    const store = readStore();
    if (!store.tenants[id]) {
        store.tenants[id] = { id, name, created_at: new Date().toISOString() };
        writeStore(store);
    }
}

module.exports = {
    getTenantData,
    setTenantData,
    findUserByEmail,
    getUserById,
    upsertUser,
    deleteUser,
    pruneTenantUsers,
    ensureTenant
};