require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const {
    getTenantData,
    setTenantData,
    findUserByEmail,
    getUserById,
    upsertUser,
    ensureTenant
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'udyog-suvidha';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const corsOrigins = CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(s => s.trim());

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '50mb' }));

function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        req.auth = jwt.verify(header.slice(7), JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function stripPasswords(data) {
    const copy = JSON.parse(JSON.stringify(data));
    if (copy.users) {
        Object.values(copy.users).forEach(u => { delete u.password; });
    }
    if (copy.pendingSignups) {
        copy.pendingSignups.forEach(s => { delete s.password; });
    }
    return copy;
}

function publicUser(dbUser) {
    return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        clientId: dbUser.client_id || dbUser.clientId || null
    };
}

function findPendingSignup(appData, email) {
    if (!appData?.pendingSignups) return null;
    return appData.pendingSignups.find(s =>
        s.email?.toLowerCase() === email.toLowerCase() &&
        s.status !== 'rejected' && s.status !== 'approved'
    );
}

function syncUsersFromAppData(tenantId, appData) {
    if (!appData?.users) return;
    Object.entries(appData.users).forEach(([id, u]) => {
        if (!u?.email) return;
        const existing = findUserByEmail(tenantId, u.email);
        let passwordHash = existing?.password_hash;
        if (u.password && typeof u.password === 'string' && u.password.length > 0) {
            passwordHash = bcrypt.hashSync(u.password, 10);
        }
        if (!passwordHash) return;
        upsertUser({
            id,
            tenantId,
            email: u.email,
            passwordHash,
            name: u.name || u.email,
            role: u.role || 'client',
            clientId: u.clientId || null
        });
    });
}

function ensureTenantData(tenantId) {
    ensureTenant(tenantId, 'Udyog Suvidha & Associates');
    let data = getTenantData(tenantId);
    if (!data) {
        data = { clients: {}, users: {}, pendingSignups: [], firmSettings: {} };
        setTenantData(tenantId, data);
    }
    if (!data.pendingSignups) data.pendingSignups = [];
    if (!data.users) data.users = {};
    if (!data.clients) data.clients = {};
    return data;
}

function saveTenantData(tenantId, data) {
    syncUsersFromAppData(tenantId, data);
    setTenantData(tenantId, data);
}

app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'ledgerflow-crm-api', tenant: DEFAULT_TENANT_ID });
});

app.post('/api/auth/login', (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    const tenantId = req.body.tenantId || DEFAULT_TENANT_ID;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    const dbUser = findUserByEmail(tenantId, email);
    if (dbUser && bcrypt.compareSync(password, dbUser.password_hash)) {
        const appData = ensureTenantData(tenantId);
        const token = jwt.sign(
            { userId: dbUser.id, tenantId, role: dbUser.role, clientId: dbUser.client_id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        return res.json({
            token,
            user: publicUser(dbUser),
            data: stripPasswords(appData)
        });
    }

    const appData = ensureTenantData(tenantId);
    const pending = findPendingSignup(appData, email);
    if (pending) {
        if (pending.password !== password) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        if (!pending.emailVerified) {
            return res.status(403).json({
                error: 'Please verify your email first',
                code: 'pending_verification',
                signup: { id: pending.id, email: pending.email, verificationCode: pending.verificationCode }
            });
        }
        if (!pending.adminApproved) {
            return res.status(403).json({
                error: 'Account pending admin approval',
                code: 'pending_approval',
                signup: { id: pending.id, email: pending.email }
            });
        }
        return res.status(403).json({ error: 'Account approved but not activated. Contact admin.' });
    }

    return res.status(401).json({ error: 'Invalid email or password' });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    const dbUser = getUserById(req.auth.userId);
    if (!dbUser || dbUser.tenant_id !== req.auth.tenantId) {
        return res.status(401).json({ error: 'User not found' });
    }
    const appData = ensureTenantData(req.auth.tenantId);
    res.json({
        user: publicUser(dbUser),
        data: stripPasswords(appData)
    });
});

app.get('/api/data', authMiddleware, (req, res) => {
    const appData = ensureTenantData(req.auth.tenantId);
    res.json({ data: stripPasswords(appData) });
});

app.put('/api/data', authMiddleware, (req, res) => {
    const incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
        return res.status(400).json({ error: 'Invalid data payload' });
    }
    saveTenantData(req.auth.tenantId, incoming);
    res.json({ ok: true, updatedAt: new Date().toISOString() });
});

app.post('/api/public/signup', (req, res) => {
    const tenantId = DEFAULT_TENANT_ID;
    const appData = ensureTenantData(tenantId);
    const name = (req.body.businessName || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Business name, email and password required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const taken = Object.values(appData.users || {}).some(u => u.email?.toLowerCase() === email);
    const pendingTaken = (appData.pendingSignups || []).some(s =>
        s.email?.toLowerCase() === email && s.status !== 'rejected' && s.status !== 'approved'
    );
    if (taken || pendingTaken) {
        return res.status(409).json({ error: 'This email is already registered or pending verification' });
    }

    const signup = {
        id: 'signup_' + Date.now(),
        businessName: name,
        email,
        password,
        phone: (req.body.phone || '').trim(),
        gstin: (req.body.gstin || '').trim(),
        address: (req.body.address || '').trim(),
        stateCode: req.body.stateCode || '07',
        verificationToken: 'vf_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12),
        verificationCode: String(Math.floor(100000 + Math.random() * 900000)),
        emailVerified: false,
        adminApproved: false,
        status: 'pending_verification',
        createdAt: new Date().toISOString().split('T')[0]
    };

    appData.pendingSignups.push(signup);
    saveTenantData(tenantId, appData);

    res.status(201).json({
        signup: {
            id: signup.id,
            businessName: signup.businessName,
            email: signup.email,
            verificationToken: signup.verificationToken,
            verificationCode: signup.verificationCode,
            emailVerified: false,
            status: signup.status
        }
    });
});

app.post('/api/public/verify', (req, res) => {
    const tenantId = DEFAULT_TENANT_ID;
    const appData = ensureTenantData(tenantId);
    const code = (req.body.code || '').trim();
    const signupId = req.body.signupId;

    const signup = signupId
        ? appData.pendingSignups.find(s => s.id === signupId)
        : appData.pendingSignups.find(s => s.verificationCode === code && !s.emailVerified);

    if (!signup) {
        return res.status(404).json({ error: 'Invalid verification code' });
    }
    if (code !== signup.verificationCode) {
        return res.status(400).json({ error: 'Incorrect verification code' });
    }

    signup.emailVerified = true;
    signup.status = 'pending_approval';
    signup.verifiedAt = new Date().toISOString().split('T')[0];
    saveTenantData(tenantId, appData);

    res.json({
        ok: true,
        signup: { id: signup.id, email: signup.email, emailVerified: true, status: signup.status }
    });
});

app.get('/api/public/verify-token', (req, res) => {
    const tenantId = DEFAULT_TENANT_ID;
    const appData = ensureTenantData(tenantId);
    const token = req.query.token;
    const signup = appData.pendingSignups.find(s => s.verificationToken === token);
    if (!signup) {
        return res.status(404).json({ error: 'Invalid verification link' });
    }
    if (!signup.emailVerified) {
        signup.emailVerified = true;
        signup.status = 'pending_approval';
        signup.verifiedAt = new Date().toISOString().split('T')[0];
        saveTenantData(tenantId, appData);
    }
    res.json({
        ok: true,
        signup: { id: signup.id, email: signup.email, emailVerified: true, status: signup.status }
    });
});

app.post('/api/public/resend', (req, res) => {
    const tenantId = DEFAULT_TENANT_ID;
    const appData = ensureTenantData(tenantId);
    const signup = appData.pendingSignups.find(s => s.id === req.body.signupId);
    if (!signup) {
        return res.status(404).json({ error: 'Signup not found' });
    }
    signup.verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    signup.verificationToken = 'vf_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
    saveTenantData(tenantId, appData);
    res.json({
        signup: {
            id: signup.id,
            email: signup.email,
            verificationToken: signup.verificationToken,
            verificationCode: signup.verificationCode
        }
    });
});

const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const indexPath = path.join(frontendPath, 'index.html');
    res.sendFile(indexPath, err => { if (err) next(); });
});

ensureTenant(DEFAULT_TENANT_ID, 'Udyog Suvidha & Associates');

app.listen(PORT, '0.0.0.0', () => {
    const host = process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `http://localhost:${PORT}`;
    console.log(`LedgerFlow CRM running on ${host}`);
    console.log(`Data store: ${process.env.DB_PATH || (process.env.RAILWAY_VOLUME_MOUNT_PATH ? process.env.RAILWAY_VOLUME_MOUNT_PATH + '/store.json' : './data/store.json')}`);
});