const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const otpStore = new Map();

function normalizePhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits.length >= 10 ? digits.slice(-10) : digits;
}

function phonesMatch(a, b) {
    const na = normalizePhone(a);
    const nb = normalizePhone(b);
    return na.length >= 10 && na === nb;
}

function findClientUserByPhone(appData, phone) {
    const normalized = normalizePhone(phone);
    if (normalized.length < 10) return null;

    for (const [clientId, client] of Object.entries(appData.clients || {})) {
        if (!client?.phone) continue;
        if (!phonesMatch(client.phone, phone)) continue;

        const userEntry = Object.entries(appData.users || {}).find(
            ([, u]) => u.role === 'client' && (u.clientId === clientId || u.client_id === clientId)
        );
        if (userEntry) {
            return { userId: userEntry[0], user: userEntry[1], clientId, client };
        }
    }
    return null;
}

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function isSmsConfigured() {
    return !!(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER
    );
}

async function sendSmsOtp(phone, otp) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    const to = '+91' + normalizePhone(phone);

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const body = new URLSearchParams({
        To: to,
        From: from,
        Body: `Your LedgerFlow login OTP is ${otp}. Valid for 10 minutes. Do not share.`
    });

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
    });
    if (!res.ok) throw new Error('SMS delivery failed');
}

function storeOtp(phone, userId) {
    const key = normalizePhone(phone);
    const otp = generateOtp();
    otpStore.set(key, {
        otp,
        userId,
        expiresAt: Date.now() + OTP_EXPIRY_MS,
        attempts: 0
    });
    return otp;
}

function verifyStoredOtp(phone, code) {
    const key = normalizePhone(phone);
    const entry = otpStore.get(key);
    if (!entry) {
        return { ok: false, error: 'OTP expired or not found. Request a new one.' };
    }
    if (Date.now() > entry.expiresAt) {
        otpStore.delete(key);
        return { ok: false, error: 'OTP expired. Request a new one.' };
    }
    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
        otpStore.delete(key);
        return { ok: false, error: 'Too many attempts. Request a new OTP.' };
    }
    entry.attempts++;
    if (entry.otp !== String(code).trim()) {
        return { ok: false, error: 'Invalid OTP' };
    }
    otpStore.delete(key);
    return { ok: true, userId: entry.userId };
}

module.exports = {
    normalizePhone,
    phonesMatch,
    findClientUserByPhone,
    generateOtp,
    isSmsConfigured,
    sendSmsOtp,
    storeOtp,
    verifyStoredOtp,
    OTP_EXPIRY_MS
};