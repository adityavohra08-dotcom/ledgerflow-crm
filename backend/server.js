require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const {
    getTenantData,
    setTenantData,
    findUserByEmail,
    getUserById,
    upsertUser,
    deleteUser,
    pruneTenantUsers,
    ensureTenant
} = require('./db');
const { verifyGoogleIdToken, randomGooglePassword } = require('./google-auth');
const {
    findClientUserByPhone,
    storeOtp,
    verifyStoredOtp,
    isSmsConfigured,
    sendSmsOtp,
    OTP_EXPIRY_MS
} = require('./otp');
const {
    applyFirewall,
    recordFailedAuth,
    getFirewallStatus,
    createAuthRateLimiter,
    createOtpSendRateLimiter
} = require('./firewall');
const { isEwayBillConfigured, getEwayBillConfigStatus, testEwayBillAuth, generateEwayBill } = require('./ewaybill');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'udyog-suvidha';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const corsOrigins = CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(s => s.trim());

applyFirewall(app);
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

const {
    FIRM_EMAIL,
    FIRM_PASSWORD,
    FIRM_ADMIN_NAME,
    TENANT_NAME,
    firmSettings: DEFAULT_FIRM_SETTINGS
} = require('./firm-config');
const API_VERSION = '2.9.0-ewaybill';
const authRateLimit = createAuthRateLimiter();
const otpSendRateLimit = createOtpSendRateLimiter();
const INLINE_USER_PASSWORDS = {
    firm: FIRM_PASSWORD,
    team1: 'team123',
    c1: 'client123',
    c2: 'client123',
    c3: 'client123'
};

let sampleUserPasswords = null;
function getSampleUserPasswords() {
    if (!sampleUserPasswords) {
        try {
            const samplePath = path.join(__dirname, 'sample-app-data.json');
            sampleUserPasswords = JSON.parse(fs.readFileSync(samplePath, 'utf8')).users || {};
        } catch {
            sampleUserPasswords = {};
        }
    }
    return sampleUserPasswords;
}

function fillMissingUserPasswords(tenantId, appData) {
    if (!appData?.users) return appData;
    const defaults = getSampleUserPasswords();
    let changed = false;
    Object.entries(appData.users).forEach(([id, u]) => {
        if (u && !u.password) {
            const pwd = defaults[id]?.password || INLINE_USER_PASSWORDS[id];
            if (pwd) {
                u.password = pwd;
                changed = true;
            }
        }
    });
    if (changed) setTenantData(tenantId, appData);
    return appData;
}

function prepareAppDataForRole(data, role, userId) {
    const copy = JSON.parse(JSON.stringify(data));
    if (!copy.teamApprovals) copy.teamApprovals = [];

    if (role === 'firm') return copy;

    if (role === 'team' && userId) {
        const teamUser = copy.users?.[userId];
        const assigned = teamUser?.assignedClientIds || [];
        const filteredClients = {};
        assigned.forEach(id => {
            if (copy.clients?.[id]) filteredClients[id] = copy.clients[id];
        });
        copy.clients = filteredClients;
        copy.teamApprovals = copy.teamApprovals.filter(a => a.teamMemberId === userId);
        delete copy.pendingSignups;
        if (copy.users) {
            Object.values(copy.users).forEach(u => { delete u.password; });
        }
        return copy;
    }

    if (copy.users) {
        Object.values(copy.users).forEach(u => { delete u.password; });
    }
    if (copy.pendingSignups) {
        copy.pendingSignups.forEach(s => { delete s.password; });
    }
    delete copy.teamApprovals;
    return copy;
}

function mergePreservedSecrets(tenantId, incoming) {
    const existing = getTenantData(tenantId);
    if (!existing || !incoming) return incoming;
    if (existing.users && incoming.users) {
        Object.entries(incoming.users).forEach(([id, u]) => {
            if (u && !u.password && existing.users[id]?.password) {
                u.password = existing.users[id].password;
            }
        });
    }
    if (existing.pendingSignups && incoming.pendingSignups) {
        incoming.pendingSignups.forEach((s, i) => {
            const prev = existing.pendingSignups.find(p => p.id === s.id);
            if (prev?.password && !s.password) incoming.pendingSignups[i].password = prev.password;
        });
    }
    return incoming;
}

function publicUser(dbUser, appData) {
    const base = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        clientId: dbUser.client_id || dbUser.clientId || null
    };
    if (dbUser.role === 'team' && appData?.users?.[dbUser.id]) {
        base.assignedClientIds = appData.users[dbUser.id].assignedClientIds || [];
    }
    return base;
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
    pruneTenantUsers(tenantId, Object.keys(appData.users));
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

function isUserBlocked(appData, userId) {
    return !!(appData?.users?.[userId]?.blocked);
}

function syncFirmAdminCredentials(tenantId) {
    const hash = bcrypt.hashSync(FIRM_PASSWORD, 10);
    upsertUser({
        id: 'firm',
        tenantId,
        email: FIRM_EMAIL,
        passwordHash: hash,
        name: FIRM_ADMIN_NAME,
        role: 'firm',
        clientId: null
    });
    const data = getTenantData(tenantId);
    if (!data) return;
    if (!data.users) data.users = {};
    if (!data.users.firm) data.users.firm = { role: 'firm', name: FIRM_ADMIN_NAME };
    data.users.firm.email = FIRM_EMAIL;
    data.users.firm.password = FIRM_PASSWORD;
    data.users.firm.name = FIRM_ADMIN_NAME;
    data.users.firm.role = 'firm';
    const existingLogo = data.firmSettings?.logo || '';
    data.firmSettings = {
        ...JSON.parse(JSON.stringify(DEFAULT_FIRM_SETTINGS)),
        logo: existingLogo
    };
    setTenantData(tenantId, data);
}

function ensureTenantData(tenantId) {
    ensureTenant(tenantId, TENANT_NAME);
    let data = getTenantData(tenantId);
    if (!data) {
        data = { clients: {}, users: {}, pendingSignups: [], firmSettings: {} };
        setTenantData(tenantId, data);
    }
    if (!data.pendingSignups) data.pendingSignups = [];
    if (!data.users) data.users = {};
    if (!data.clients) data.clients = {};
    fillMissingUserPasswords(tenantId, data);
    return data;
}

function saveTenantData(tenantId, data) {
    syncUsersFromAppData(tenantId, data);
    setTenantData(tenantId, data);
}

app.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        service: 'ledgerflow-crm-api',
        tenant: DEFAULT_TENANT_ID,
        version: API_VERSION,
        googleAuth: !!GOOGLE_CLIENT_ID,
        otpAuth: true,
        smsConfigured: isSmsConfigured(),
        firewall: getFirewallStatus(),
        ewayBill: getEwayBillConfigStatus()
    });
});

app.get('/api/ewaybill/config', authMiddleware, (_req, res) => {
    res.json({ ...getEwayBillConfigStatus(), thresholdInr: 50000 });
});

app.get('/api/ewaybill/test-auth', authMiddleware, async (req, res) => {
    if (req.auth.role !== 'firm') {
        return res.status(403).json({ error: 'Only firm admin can test e-way bill credentials' });
    }
    try {
        const result = await testEwayBillAuth();
        res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message || 'Auth test failed' });
    }
});

app.post('/api/ewaybill/generate', authMiddleware, async (req, res) => {
    try {
        const payload = req.body?.payload;
        if (!payload?.docNo) {
            return res.status(400).json({ error: 'Invalid e-way bill payload — invoice document number required' });
        }
        const ewayBill = await generateEwayBill(payload, req.body?.invoiceNo || payload.docNo);
        res.json({ ok: true, ewayBill });
    } catch (err) {
        res.status(500).json({ error: err.message || 'E-way bill generation failed' });
    }
});

app.get('/api/auth/otp-config', (_req, res) => {
    res.json({
        enabled: true,
        smsConfigured: isSmsConfigured()
    });
});

app.post('/api/auth/otp/send', otpSendRateLimit, authRateLimit, async (req, res) => {
    const phone = (req.body.phone || '').trim();
    const tenantId = DEFAULT_TENANT_ID;

    if (!phone) {
        return res.status(400).json({ error: 'Mobile number required' });
    }

    const appData = ensureTenantData(tenantId);
    const found = findClientUserByPhone(appData, phone);
    if (!found) {
        return res.status(404).json({ error: 'No client account found for this mobile number' });
    }
    if (found.user.role === 'firm' || found.user.role === 'team') {
        return res.status(403).json({ error: 'Use email login for firm or team accounts' });
    }
    if (isUserBlocked(appData, found.userId)) {
        return res.status(403).json({
            error: 'Your account has been blocked. Contact your accounting firm.',
            code: 'account_blocked'
        });
    }

    const otp = storeOtp(phone, found.userId);
    const response = {
        ok: true,
        message: 'OTP sent to your mobile number',
        expiresIn: Math.floor(OTP_EXPIRY_MS / 1000)
    };

    if (isSmsConfigured()) {
        try {
            await sendSmsOtp(phone, otp);
        } catch (err) {
            console.error('[OTP] SMS send failed:', err.message);
            return res.status(503).json({ error: 'Failed to send SMS. Try again later.' });
        }
    } else {
        response.demoMode = true;
        response.demoOtp = otp;
        console.log(`[OTP Demo] ${phone} → ${otp}`);
    }

    res.json(response);
});

app.post('/api/auth/otp/verify', authRateLimit, (req, res) => {
    const phone = (req.body.phone || '').trim();
    const code = (req.body.otp || req.body.code || '').trim();
    const tenantId = DEFAULT_TENANT_ID;

    if (!phone || !code) {
        return res.status(400).json({ error: 'Mobile number and OTP required' });
    }

    const result = verifyStoredOtp(phone, code);
    if (!result.ok) {
        recordFailedAuth(req);
        return res.status(401).json({ error: result.error });
    }

    const appData = ensureTenantData(tenantId);
    if (isUserBlocked(appData, result.userId)) {
        return res.status(403).json({
            error: 'Your account has been blocked. Contact your accounting firm.',
            code: 'account_blocked'
        });
    }

    const dbUser = getUserById(result.userId);
    if (!dbUser || dbUser.tenant_id !== tenantId || dbUser.role !== 'client') {
        return res.status(401).json({ error: 'User not found' });
    }

    return issueClientAuthResponse(res, tenantId, dbUser, appData);
});

app.get('/api/auth/google-config', (_req, res) => {
    res.json({
        enabled: !!GOOGLE_CLIENT_ID,
        clientId: GOOGLE_CLIENT_ID || null
    });
});

function issueClientAuthResponse(res, tenantId, dbUser, appData) {
    const token = jwt.sign(
        { userId: dbUser.id, tenantId, role: dbUser.role, clientId: dbUser.client_id },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
    return res.json({
        token,
        user: publicUser(dbUser, appData),
        data: prepareAppDataForRole(appData, 'client', dbUser.id)
    });
}

app.post('/api/auth/google', authRateLimit, async (req, res) => {
    if (!GOOGLE_CLIENT_ID) {
        return res.status(503).json({ error: 'Google sign-in is not configured on the server' });
    }

    const credential = req.body.credential || '';
    const mode = req.body.mode === 'signup' ? 'signup' : 'login';
    const tenantId = DEFAULT_TENANT_ID;

    if (!credential) {
        return res.status(400).json({ error: 'Google credential required' });
    }

    let payload;
    try {
        payload = await verifyGoogleIdToken(credential, GOOGLE_CLIENT_ID);
    } catch {
        return res.status(401).json({ error: 'Invalid or expired Google sign-in' });
    }

    const email = (payload.email || '').trim().toLowerCase();
    const displayName = (payload.name || '').trim() || email.split('@')[0];
    const googleSub = payload.sub || '';

    if (!email || payload.email_verified !== true) {
        return res.status(400).json({ error: 'Google account must have a verified email' });
    }

    const appData = ensureTenantData(tenantId);
    const dbUser = findUserByEmail(tenantId, email);
    const appUserEntry = Object.entries(appData.users || {}).find(
        ([, u]) => u.email?.toLowerCase() === email
    );

    if (dbUser?.role === 'firm' || appUserEntry?.[1]?.role === 'firm') {
        return res.status(403).json({
            error: 'This is a Firm account. Use Firm / Admin login instead.',
            code: 'firm_account'
        });
    }
    if (dbUser?.role === 'team' || appUserEntry?.[1]?.role === 'team') {
        return res.status(403).json({
            error: 'This is a Team account. Use Team Login instead.',
            code: 'team_account'
        });
    }

    if (dbUser && dbUser.role === 'client') {
        if (isUserBlocked(appData, dbUser.id)) {
            return res.status(403).json({
                error: 'Your account has been blocked. Contact your accounting firm.',
                code: 'account_blocked'
            });
        }
        if (appData.users?.[dbUser.id]) {
            appData.users[dbUser.id].googleSub = googleSub;
            appData.users[dbUser.id].authProvider = 'google';
            if (!appData.users[dbUser.id].password) {
                appData.users[dbUser.id].password = randomGooglePassword();
            }
            saveTenantData(tenantId, appData);
        }
        return issueClientAuthResponse(res, tenantId, dbUser, appData);
    }

    const pending = findPendingSignup(appData, email);
    if (pending) {
        pending.googleSub = googleSub;
        pending.authProvider = 'google';
        if (!pending.emailVerified) {
            pending.emailVerified = true;
            pending.status = 'pending_approval';
            pending.verifiedAt = new Date().toISOString().split('T')[0];
            saveTenantData(tenantId, appData);
        }
        if (!pending.adminApproved) {
            return res.status(403).json({
                error: 'Account pending admin approval',
                code: 'pending_approval',
                signup: { id: pending.id, email: pending.email, businessName: pending.businessName }
            });
        }
    }

    if (mode === 'login') {
        return res.status(404).json({
            error: 'No client account found for this Google email. Please sign up first.',
            code: 'google_signup_required',
            profile: { email, name: displayName }
        });
    }

    const businessName = (req.body.businessName || '').trim() || displayName;
    if (!businessName) {
        return res.status(400).json({ error: 'Business name is required for Google sign up' });
    }

    const taken = Object.values(appData.users || {}).some(u => u.email?.toLowerCase() === email);
    const pendingTaken = (appData.pendingSignups || []).some(s =>
        s.email?.toLowerCase() === email && s.status !== 'rejected' && s.status !== 'approved'
    );
    if (taken || pendingTaken) {
        return res.status(409).json({ error: 'This email is already registered or pending approval' });
    }

    const signup = {
        id: 'signup_' + Date.now(),
        businessName,
        email,
        password: randomGooglePassword(),
        phone: (req.body.phone || '').trim(),
        gstin: (req.body.gstin || '').trim(),
        address: (req.body.address || '').trim(),
        stateCode: req.body.stateCode || '07',
        googleSub,
        authProvider: 'google',
        verificationToken: 'vf_google_' + Date.now().toString(36),
        verificationCode: 'GOOGLE',
        emailVerified: true,
        adminApproved: false,
        status: 'pending_approval',
        createdAt: new Date().toISOString().split('T')[0],
        verifiedAt: new Date().toISOString().split('T')[0]
    };

    appData.pendingSignups.push(signup);
    saveTenantData(tenantId, appData);

    return res.status(201).json({
        code: 'pending_approval',
        signup: {
            id: signup.id,
            businessName: signup.businessName,
            email: signup.email,
            emailVerified: true,
            status: signup.status
        }
    });
});

app.post('/api/auth/login', authRateLimit, (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    const tenantId = req.body.tenantId || DEFAULT_TENANT_ID;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    const dbUser = findUserByEmail(tenantId, email);
    if (dbUser && bcrypt.compareSync(password, dbUser.password_hash)) {
        const appData = ensureTenantData(tenantId);
        if (isUserBlocked(appData, dbUser.id)) {
            return res.status(403).json({
                error: 'Your account has been blocked. Contact your accounting firm.',
                code: 'account_blocked'
            });
        }
        const token = jwt.sign(
            { userId: dbUser.id, tenantId, role: dbUser.role, clientId: dbUser.client_id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        const userRole = appData.users?.[dbUser.id]?.role || dbUser.role || 'client';
        return res.json({
            token,
            user: publicUser(dbUser, appData),
            data: prepareAppDataForRole(appData, userRole, dbUser.id)
        });
    }

    const appData = ensureTenantData(tenantId);
    const pending = findPendingSignup(appData, email);
    if (pending) {
        if (pending.password !== password) {
            recordFailedAuth(req);
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

    recordFailedAuth(req);
    return res.status(401).json({ error: 'Invalid email or password' });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    const dbUser = getUserById(req.auth.userId);
    if (!dbUser || dbUser.tenant_id !== req.auth.tenantId) {
        return res.status(401).json({ error: 'User not found' });
    }
    const appData = ensureTenantData(req.auth.tenantId);
    res.json({
        user: publicUser(dbUser, appData),
        data: prepareAppDataForRole(appData, dbUser.role, dbUser.id)
    });
});

app.get('/api/data', authMiddleware, (req, res) => {
    const dbUser = getUserById(req.auth.userId);
    const appData = ensureTenantData(req.auth.tenantId);
    res.json({ data: prepareAppDataForRole(appData, dbUser?.role || 'client', dbUser?.id) });
});

app.put('/api/data', authMiddleware, (req, res) => {
    let incoming = req.body;
    if (!incoming || typeof incoming !== 'object') {
        return res.status(400).json({ error: 'Invalid data payload' });
    }
    incoming = mergePreservedSecrets(req.auth.tenantId, incoming);
    saveTenantData(req.auth.tenantId, incoming);
    res.json({ ok: true, updatedAt: new Date().toISOString() });
});

app.post('/api/public/signup', authRateLimit, (req, res) => {
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

app.post('/api/public/verify', authRateLimit, (req, res) => {
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

app.post('/api/public/resend', authRateLimit, (req, res) => {
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
app.use(express.static(frontendPath, {
    setHeaders(res, filePath) {
        if (/\.(html|js)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    const indexPath = path.join(frontendPath, 'index.html');
    res.sendFile(indexPath, err => { if (err) next(); });
});

function syncTeamDemoUser(tenantId) {
    const data = ensureTenantData(tenantId);
    if (!data.users.team1) {
        data.users.team1 = {
            email: 'staff@wealthbuilders.in',
            password: 'team123',
            name: 'Priya Sharma',
            role: 'team',
            assignedClientIds: ['c1', 'c2'],
            blocked: false
        };
        setTenantData(tenantId, data);
    }
    if (!data.teamApprovals) {
        data.teamApprovals = [];
        setTenantData(tenantId, data);
    }
    const hash = bcrypt.hashSync('team123', 10);
    upsertUser({
        id: 'team1',
        tenantId,
        email: 'staff@wealthbuilders.in',
        passwordHash: hash,
        name: 'Priya Sharma',
        role: 'team',
        clientId: null
    });
}

ensureTenant(DEFAULT_TENANT_ID, TENANT_NAME);
syncFirmAdminCredentials(DEFAULT_TENANT_ID);
syncTeamDemoUser(DEFAULT_TENANT_ID);

app.listen(PORT, '0.0.0.0', () => {
    const host = process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `http://localhost:${PORT}`;
    console.log(`LedgerFlow CRM running on ${host}`);
    console.log(`Data store: ${process.env.DB_PATH || (process.env.RAILWAY_VOLUME_MOUNT_PATH ? process.env.RAILWAY_VOLUME_MOUNT_PATH + '/store.json' : './data/store.json')}`);
});