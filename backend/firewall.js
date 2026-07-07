const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const FIREWALL_ENABLED = process.env.FIREWALL_ENABLED !== 'false';
const AUTO_BLOCK_THRESHOLD = parseInt(process.env.FIREWALL_AUTO_BLOCK_THRESHOLD || '25', 10);
const AUTO_BLOCK_WINDOW_MS = parseInt(process.env.FIREWALL_AUTO_BLOCK_WINDOW_MS || String(15 * 60 * 1000), 10);
const AUTO_BLOCK_DURATION_MS = parseInt(process.env.FIREWALL_AUTO_BLOCK_DURATION_MS || String(60 * 60 * 1000), 10);

const blockedIps = new Set(
    (process.env.FIREWALL_BLOCK_IPS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
);

const failedAttempts = new Map();

const BLOCKED_PATH_PATTERNS = [
    /^\/\.env/i,
    /^\/\.git/i,
    /^\/wp-admin/i,
    /^\/wp-login/i,
    /^\/wp-content/i,
    /^\/xmlrpc\.php/i,
    /^\/phpmyadmin/i,
    /^\/admin\.php/i,
    /^\/\.aws/i,
    /^\/server-status/i,
    /^\/actuator/i,
    /^\/\.well-known\/security\.txt$/i,
    /\/\.\./,
    /\.(php|asp|aspx|jsp|cgi)$/i
];

const SUSPICIOUS_QUERY = /(<script|javascript:|union\s+select|drop\s+table|\/etc\/passwd)/i;

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const first = String(forwarded).split(',')[0].trim();
        if (first) return first;
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

function isIpBlocked(ip) {
    return blockedIps.has(ip);
}

function recordFailedAuth(req) {
    if (!FIREWALL_ENABLED) return;
    const ip = getClientIp(req);
    if (isIpBlocked(ip)) return;

    const now = Date.now();
    let entry = failedAttempts.get(ip);
    if (!entry || now - entry.firstAt > AUTO_BLOCK_WINDOW_MS) {
        entry = { count: 0, firstAt: now };
    }
    entry.count++;
    failedAttempts.set(ip, entry);

    if (entry.count >= AUTO_BLOCK_THRESHOLD) {
        blockedIps.add(ip);
        failedAttempts.delete(ip);
        console.warn(`[Firewall] Auto-blocked IP ${ip} after ${entry.count} failed auth attempts`);
        setTimeout(() => {
            blockedIps.delete(ip);
            console.log(`[Firewall] Auto-block expired for IP ${ip}`);
        }, AUTO_BLOCK_DURATION_MS);
    }
}

function ipBlockMiddleware(req, res, next) {
    if (!FIREWALL_ENABLED) return next();
    const ip = getClientIp(req);
    if (isIpBlocked(ip)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
}

function pathBlockMiddleware(req, res, next) {
    if (!FIREWALL_ENABLED) return next();

    const url = req.originalUrl || req.url || '';
    if (BLOCKED_PATH_PATTERNS.some(p => p.test(url))) {
        recordFailedAuth(req);
        return res.status(404).json({ error: 'Not found' });
    }
    if (SUSPICIOUS_QUERY.test(url)) {
        recordFailedAuth(req);
        return res.status(400).json({ error: 'Bad request' });
    }
    next();
}

function securityHeadersMiddleware() {
    return helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
        hsts: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_PUBLIC_DOMAIN
            ? { maxAge: 31536000, includeSubDomains: true }
            : false
    });
}

function createAuthRateLimiter() {
    const max = parseInt(process.env.RATE_LIMIT_AUTH_MAX || '15', 10);
    const windowMs = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS || String(15 * 60 * 1000), 10);
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => getClientIp(req),
        handler: (req, res) => {
            recordFailedAuth(req);
            res.status(429).json({ error: 'Too many attempts. Try again later.' });
        },
        skip: () => !FIREWALL_ENABLED
    });
}

function createApiRateLimiter() {
    const max = parseInt(process.env.RATE_LIMIT_API_MAX || '300', 10);
    const windowMs = parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || String(15 * 60 * 1000), 10);
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => getClientIp(req),
        handler: (_req, res) => {
            res.status(429).json({ error: 'Too many requests. Slow down.' });
        },
        skip: (req) => !FIREWALL_ENABLED || req.path === '/api/health'
    });
}

function createOtpSendRateLimiter() {
    const max = parseInt(process.env.RATE_LIMIT_OTP_SEND_MAX || '5', 10);
    const windowMs = parseInt(process.env.RATE_LIMIT_OTP_SEND_WINDOW_MS || String(60 * 60 * 1000), 10);
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => getClientIp(req),
        handler: (_req, res) => {
            res.status(429).json({ error: 'OTP limit reached. Try again in an hour.' });
        },
        skip: () => !FIREWALL_ENABLED
    });
}

function applyFirewall(app) {
    app.set('trust proxy', 1);
    app.disable('x-powered-by');

    app.use(securityHeadersMiddleware());
    app.use(ipBlockMiddleware);
    app.use(pathBlockMiddleware);
    app.use('/api/', createApiRateLimiter());
}

function getFirewallStatus() {
    return {
        enabled: FIREWALL_ENABLED,
        blockedIpCount: blockedIps.size,
        autoBlockThreshold: AUTO_BLOCK_THRESHOLD
    };
}

module.exports = {
    applyFirewall,
    recordFailedAuth,
    getClientIp,
    getFirewallStatus,
    createAuthRateLimiter,
    createOtpSendRateLimiter
};