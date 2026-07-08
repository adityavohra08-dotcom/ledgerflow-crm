/**
 * E-Way Bill API — demo + live via GSP (MasterGST by default).
 *
 * Required for LIVE mode:
 *   EWAYBILL_GSTIN          — taxpayer GSTIN (e.g. 09AABCU9603R1ZM)
 *   EWAYBILL_USERNAME       — API user created on ewaybillgst.gov.in → Registration → For GSP
 *   EWAYBILL_PASSWORD       — API password from same portal
 *   EWAYBILL_CLIENT_ID      — from GSP dashboard (MasterGST: Credentials → E-Way Bill)
 *   EWAYBILL_CLIENT_SECRET  — from GSP dashboard
 *
 * Optional:
 *   EWAYBILL_PROVIDER=mastergst|nic
 *   EWAYBILL_API_URL        — override API base
 *   EWAYBILL_EMAIL          — MasterGST account email (some GSP auth flows)
 *   EWAYBILL_IP_ADDRESS     — server public IP whitelisted with GSP
 */

const EWAYBILL_API_URL = (process.env.EWAYBILL_API_URL || 'https://api.mastergst.com/ewaybillapi/v1.03').replace(/\/$/, '');
const EWAYBILL_PROVIDER = (process.env.EWAYBILL_PROVIDER || 'mastergst').toLowerCase();

function isEwayBillConfigured() {
    return !!(
        process.env.EWAYBILL_GSTIN &&
        process.env.EWAYBILL_USERNAME &&
        process.env.EWAYBILL_PASSWORD &&
        process.env.EWAYBILL_CLIENT_ID &&
        process.env.EWAYBILL_CLIENT_SECRET
    );
}

function getEwayBillConfigStatus() {
    return {
        provider: EWAYBILL_PROVIDER,
        apiUrl: EWAYBILL_API_URL,
        configured: isEwayBillConfigured(),
        demoMode: !isEwayBillConfigured(),
        hasGstin: !!process.env.EWAYBILL_GSTIN,
        hasPortalUser: !!(process.env.EWAYBILL_USERNAME && process.env.EWAYBILL_PASSWORD),
        hasGspKeys: !!(process.env.EWAYBILL_CLIENT_ID && process.env.EWAYBILL_CLIENT_SECRET),
        gstinMasked: maskSecret(process.env.EWAYBILL_GSTIN),
        usernameMasked: maskSecret(process.env.EWAYBILL_USERNAME)
    };
}

function maskSecret(value) {
    if (!value) return null;
    const s = String(value);
    if (s.length <= 4) return '****';
    return `${s.slice(0, 2)}****${s.slice(-2)}`;
}

function formatEwbNo(no) {
    const s = String(no || '').replace(/\D/g, '');
    if (s.length !== 12) return String(no || '');
    return s;
}

function computeValidUpto(distanceKm) {
    const km = parseInt(distanceKm, 10) || 0;
    let days = 1;
    if (km > 100 && km <= 300) days = 3;
    else if (km > 300 && km <= 500) days = 5;
    else if (km > 500 && km <= 1000) days = 10;
    else if (km > 1000) days = 15;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
}

function fmtDateTimeNic(ts) {
    const d = ts ? new Date(ts) : new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function generateDemoEwbNo() {
    const ts = Date.now().toString().slice(-8);
    const rand = String(Math.floor(1000 + Math.random() * 9000));
    return `${ts}${rand}`.slice(0, 12);
}

function authHeaders() {
    const headers = {
        'Content-Type': 'application/json',
        accept: 'application/json',
        client_id: process.env.EWAYBILL_CLIENT_ID,
        client_secret: process.env.EWAYBILL_CLIENT_SECRET,
        gstin: process.env.EWAYBILL_GSTIN
    };
    if (process.env.EWAYBILL_IP_ADDRESS) headers.ip_address = process.env.EWAYBILL_IP_ADDRESS;
    return headers;
}

function parseProviderResponse(data, status) {
    const token = data?.data?.authtoken || data?.data?.AuthToken || data?.authtoken || data?.AuthToken;
    const message = data?.message || data?.error || data?.status_desc || data?.statusDesc || `HTTP ${status}`;
    return { token, message, raw: data };
}

async function authenticateMasterGst() {
    const gstin = process.env.EWAYBILL_GSTIN;
    const username = process.env.EWAYBILL_USERNAME;
    const password = process.env.EWAYBILL_PASSWORD;
    const email = process.env.EWAYBILL_EMAIL || '';
    const headers = authHeaders();

    const attempts = [
        {
            method: 'GET',
            url: `${EWAYBILL_API_URL}/authenticate?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}${email ? `&email=${encodeURIComponent(email)}` : ''}`,
            headers
        },
        {
            method: 'POST',
            url: `${EWAYBILL_API_URL}/authenticate`,
            headers,
            body: JSON.stringify({ gstin, username, password, email, client_id: headers.client_id, client_secret: headers.client_secret })
        }
    ];

    let lastError = 'Authentication failed';
    for (const attempt of attempts) {
        try {
            const res = await fetch(attempt.url, {
                method: attempt.method,
                headers: attempt.headers,
                body: attempt.body
            });
            const data = await res.json().catch(() => ({}));
            const parsed = parseProviderResponse(data, res.status);
            if (parsed.token) return { ok: true, token: parsed.token, provider: 'mastergst' };
            lastError = parsed.message || lastError;
        } catch (err) {
            lastError = err.message || lastError;
        }
    }
    return { ok: false, error: lastError };
}

async function testEwayBillAuth() {
    if (!isEwayBillConfigured()) {
        return {
            ok: false,
            configured: false,
            error: 'Missing env vars. Need EWAYBILL_GSTIN, EWAYBILL_USERNAME, EWAYBILL_PASSWORD, EWAYBILL_CLIENT_ID, EWAYBILL_CLIENT_SECRET'
        };
    }
    const auth = await authenticateMasterGst();
    return {
        ok: auth.ok,
        configured: true,
        provider: EWAYBILL_PROVIDER,
        gstin: maskSecret(process.env.EWAYBILL_GSTIN),
        username: maskSecret(process.env.EWAYBILL_USERNAME),
        error: auth.error || null,
        message: auth.ok ? 'NIC/GSP authentication successful' : undefined
    };
}

async function callNicGenerateEwayBill(payload) {
    const auth = await authenticateMasterGst();
    if (!auth.ok) throw new Error(auth.error || 'E-way bill authentication failed');

    const gstin = process.env.EWAYBILL_GSTIN;
    const genRes = await fetch(`${EWAYBILL_API_URL}/ewayapi?action=GENEWAYBILL`, {
        method: 'POST',
        headers: {
            ...authHeaders(),
            authtoken: auth.token,
            Authorization: `Bearer ${auth.token}`
        },
        body: JSON.stringify(payload)
    });
    const genData = await genRes.json().catch(() => ({}));
    const ewbNo = genData?.data?.ewayBillNo || genData?.data?.EwbNo || genData?.ewayBillNo;
    if (!genRes.ok || !ewbNo) {
        throw new Error(genData?.message || genData?.error || genData?.status_desc || 'E-way bill generation failed');
    }
    return genData.data;
}

async function generateEwayBill(payload, invoiceNo) {
    const distanceKm = payload?.transDistance || 0;
    const now = new Date();

    if (isEwayBillConfigured()) {
        try {
            const nic = await callNicGenerateEwayBill(payload);
            return {
                enabled: true,
                ewbNo: formatEwbNo(nic.ewayBillNo || nic.EwbNo),
                ewbDate: fmtDateTimeNic(now),
                validUpto: nic.validUpto ? new Date(nic.validUpto).toISOString() : computeValidUpto(distanceKm),
                status: 'generated',
                mode: 'live',
                generatedAt: now.toISOString(),
                nicPayload: payload,
                invoiceNo: invoiceNo || payload?.docNo,
                transportMode: String(payload?.transMode || '1'),
                vehicleNo: payload?.vehicleNo || '',
                transporterName: payload?.transporterName || '',
                transporterId: payload?.transporterId || '',
                distanceKm
            };
        } catch (err) {
            const demo = generateDemoEwayBill(payload, invoiceNo);
            demo.fallbackReason = err.message;
            demo.status = 'demo_fallback';
            return demo;
        }
    }

    return generateDemoEwayBill(payload, invoiceNo);
}

function generateDemoEwayBill(payload, invoiceNo) {
    const distanceKm = payload?.transDistance || 0;
    const now = new Date();
    return {
        enabled: true,
        ewbNo: generateDemoEwbNo(),
        ewbDate: fmtDateTimeNic(now),
        validUpto: computeValidUpto(distanceKm),
        status: 'generated',
        mode: 'demo',
        generatedAt: now.toISOString(),
        nicPayload: payload,
        invoiceNo: invoiceNo || payload?.docNo,
        transportMode: String(payload?.transMode || '1'),
        vehicleNo: payload?.vehicleNo || '',
        transporterName: payload?.transporterName || '',
        transporterId: payload?.transporterId || '',
        transDocNo: payload?.transDocNo || '',
        distanceKm,
        fromPincode: String(payload?.fromPincode || ''),
        toPincode: String(payload?.toPincode || '')
    };
}

module.exports = {
    isEwayBillConfigured,
    getEwayBillConfigStatus,
    testEwayBillAuth,
    generateEwayBill,
    generateDemoEwayBill
};