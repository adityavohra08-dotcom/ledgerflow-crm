/**
 * E-Way Bill providers:
 *   demo      — no credentials (default)
 *   mastergst — MasterGST/Tera Software GSP
 *   sandbox   — Sandbox.co.in (free dev API key, easiest alternate)
 *   portal    — manual only (export JSON, generate on ewaybillgst.gov.in)
 */

const PROVIDERS = ['demo', 'mastergst', 'sandbox', 'portal'];

function getProvider() {
    const p = (process.env.EWAYBILL_PROVIDER || 'demo').toLowerCase();
    return PROVIDERS.includes(p) ? p : 'demo';
}

function getMasterGstUrl() {
    return (process.env.EWAYBILL_API_URL || 'https://api.mastergst.com/ewaybillapi/v1.03').replace(/\/$/, '');
}

function getSandboxBaseUrl() {
    const env = (process.env.EWAYBILL_SANDBOX_ENV || 'test').toLowerCase();
    return env === 'live'
        ? 'https://api.sandbox.co.in'
        : 'https://test-api.sandbox.co.in';
}

function isEwayBillConfigured() {
    const provider = getProvider();
    if (provider === 'demo' || provider === 'portal') return false;
    const base = !!(
        process.env.EWAYBILL_GSTIN &&
        process.env.EWAYBILL_USERNAME &&
        process.env.EWAYBILL_PASSWORD
    );
    if (provider === 'sandbox') {
        return base && !!(process.env.EWAYBILL_API_KEY && process.env.EWAYBILL_API_SECRET);
    }
    if (provider === 'mastergst') {
        return base && !!(process.env.EWAYBILL_CLIENT_ID && process.env.EWAYBILL_CLIENT_SECRET);
    }
    return false;
}

function getEwayBillConfigStatus() {
    const provider = getProvider();
    return {
        provider,
        availableProviders: PROVIDERS,
        apiUrl: provider === 'sandbox' ? getSandboxBaseUrl() : getMasterGstUrl(),
        configured: isEwayBillConfigured(),
        demoMode: !isEwayBillConfigured(),
        hasGstin: !!process.env.EWAYBILL_GSTIN,
        hasPortalUser: !!(process.env.EWAYBILL_USERNAME && process.env.EWAYBILL_PASSWORD),
        hasGspKeys: !!(process.env.EWAYBILL_CLIENT_ID && process.env.EWAYBILL_CLIENT_SECRET),
        hasSandboxKeys: !!(process.env.EWAYBILL_API_KEY && process.env.EWAYBILL_API_SECRET),
        gstinMasked: maskSecret(process.env.EWAYBILL_GSTIN),
        usernameMasked: maskSecret(process.env.EWAYBILL_USERNAME),
        setupHint: providerSetupHint(provider)
    };
}

function providerSetupHint(provider) {
    const hints = {
        demo: 'No setup — demo EWB numbers generated locally',
        portal: 'Use Export NIC JSON in invoice maker → upload on ewaybillgst.gov.in (no API)',
        sandbox: 'Sign up at developer.sandbox.co.in → API key + secret + portal API user',
        mastergst: 'Sign up at app.mastergst.com + register GSP on ewaybillgst.gov.in'
    };
    return hints[provider] || hints.demo;
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

function masterGstAuthHeaders() {
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

function adaptPayloadForSandbox(payload) {
    const p = { ...payload };
    if (p.transDistance != null) p.transDistance = String(p.transDistance);
    if (p.transMode != null) p.transMode = String(p.transMode);
    if (p.subSupplyType != null) p.subSupplyType = String(p.subSupplyType);
    if (!p.totInvValue && p.totalValue != null) {
        p.totInvValue = Math.round((p.totalValue + (p.cgstValue || 0) + (p.sgstValue || 0) + (p.igstValue || 0) + (p.otherValue || 0)) * 100) / 100;
    }
    if (p.itemList) {
        p.itemList = p.itemList.map(it => ({
            ...it,
            hsnCode: parseInt(String(it.hsnCode || it.hsn || '0').replace(/\D/g, ''), 10) || 0
        }));
    }
    return p;
}

async function authenticateMasterGst() {
    const gstin = process.env.EWAYBILL_GSTIN;
    const username = process.env.EWAYBILL_USERNAME;
    const password = process.env.EWAYBILL_PASSWORD;
    const email = process.env.EWAYBILL_EMAIL || '';
    const base = getMasterGstUrl();
    const headers = masterGstAuthHeaders();
    const attempts = [
        {
            method: 'GET',
            url: `${base}/authenticate?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}${email ? `&email=${encodeURIComponent(email)}` : ''}`,
            headers
        },
        {
            method: 'POST',
            url: `${base}/authenticate`,
            headers,
            body: JSON.stringify({ gstin, username, password, email, client_id: headers.client_id, client_secret: headers.client_secret })
        }
    ];
    let lastError = 'MasterGST authentication failed';
    for (const attempt of attempts) {
        try {
            const res = await fetch(attempt.url, { method: attempt.method, headers: attempt.headers, body: attempt.body });
            const data = await res.json().catch(() => ({}));
            const token = data?.data?.authtoken || data?.data?.AuthToken;
            if (token) return { ok: true, token, provider: 'mastergst' };
            lastError = data?.message || data?.error || lastError;
        } catch (err) {
            lastError = err.message || lastError;
        }
    }
    return { ok: false, error: lastError };
}

async function authenticateSandbox() {
    const base = getSandboxBaseUrl();
    const apiKey = process.env.EWAYBILL_API_KEY;
    const apiSecret = process.env.EWAYBILL_API_SECRET;

    const jwtRes = await fetch(`${base}/authenticate`, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'x-api-secret': apiSecret,
            'x-api-version': '1.0'
        }
    });
    const jwtData = await jwtRes.json().catch(() => ({}));
    const jwt = jwtData?.data?.access_token;
    if (!jwt) return { ok: false, error: jwtData?.message || 'Sandbox JWT authentication failed' };

    const ewbRes = await fetch(`${base}/gst/compliance/e-way-bill/tax-payer/authenticate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            authorization: jwt,
            'x-api-key': apiKey,
            'x-api-version': '1.0.0'
        },
        body: JSON.stringify({
            username: process.env.EWAYBILL_USERNAME,
            password: process.env.EWAYBILL_PASSWORD,
            gstin: process.env.EWAYBILL_GSTIN
        })
    });
    const ewbData = await ewbRes.json().catch(() => ({}));
    const token = ewbData?.data?.access_token;
    if (!token) {
        const code = ewbData?.data?.error?.errorCodes || ewbData?.message;
        return { ok: false, error: code ? `Sandbox e-way bill auth error ${code}` : 'Sandbox e-way bill session failed' };
    }
    return { ok: true, token, provider: 'sandbox', base, apiKey };
}

async function authenticateProvider() {
    const provider = getProvider();
    if (provider === 'mastergst') return authenticateMasterGst();
    if (provider === 'sandbox') return authenticateSandbox();
    return { ok: false, error: `Provider "${provider}" does not support live API` };
}

async function testEwayBillAuth() {
    if (!isEwayBillConfigured()) {
        return {
            ok: false,
            configured: false,
            provider: getProvider(),
            error: missingVarsMessage(getProvider()),
            setupHint: providerSetupHint(getProvider())
        };
    }
    const auth = await authenticateProvider();
    return {
        ok: auth.ok,
        configured: true,
        provider: getProvider(),
        gstin: maskSecret(process.env.EWAYBILL_GSTIN),
        username: maskSecret(process.env.EWAYBILL_USERNAME),
        error: auth.error || null,
        message: auth.ok ? `${getProvider()} authentication successful` : undefined
    };
}

function missingVarsMessage(provider) {
    if (provider === 'sandbox') {
        return 'Need: EWAYBILL_GSTIN, EWAYBILL_USERNAME, EWAYBILL_PASSWORD, EWAYBILL_API_KEY, EWAYBILL_API_SECRET';
    }
    if (provider === 'mastergst') {
        return 'Need: EWAYBILL_GSTIN, EWAYBILL_USERNAME, EWAYBILL_PASSWORD, EWAYBILL_CLIENT_ID, EWAYBILL_CLIENT_SECRET';
    }
    return `Set EWAYBILL_PROVIDER to sandbox or mastergst and add credentials`;
}

async function generateViaMasterGst(payload) {
    const auth = await authenticateMasterGst();
    if (!auth.ok) throw new Error(auth.error);
    const genRes = await fetch(`${getMasterGstUrl()}/ewayapi?action=GENEWAYBILL`, {
        method: 'POST',
        headers: { ...masterGstAuthHeaders(), authtoken: auth.token },
        body: JSON.stringify(payload)
    });
    const genData = await genRes.json().catch(() => ({}));
    const ewbNo = genData?.data?.ewayBillNo || genData?.data?.EwbNo;
    if (!ewbNo) throw new Error(genData?.message || genData?.error || 'MasterGST generation failed');
    return genData.data;
}

async function generateViaSandbox(payload) {
    const auth = await authenticateSandbox();
    if (!auth.ok) throw new Error(auth.error);
    const body = adaptPayloadForSandbox(payload);
    const genRes = await fetch(`${auth.base}/gst/compliance/e-way-bill/consignor/bill`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            authorization: auth.token,
            'x-api-key': auth.apiKey,
            'x-api-version': '1.0.0'
        },
        body: JSON.stringify(body)
    });
    const genData = await genRes.json().catch(() => ({}));
    const inner = genData?.data?.data || genData?.data;
    const ewbNo = inner?.ewayBillNo || inner?.EwbNo;
    if (!ewbNo) throw new Error(genData?.message || inner?.error?.errorCodes || 'Sandbox generation failed');
    return {
        ewayBillNo: ewbNo,
        validUpto: inner?.validUpto,
        ewayBillDate: inner?.ewayBillDate
    };
}

async function callLiveGenerate(payload) {
    const provider = getProvider();
    if (provider === 'mastergst') return generateViaMasterGst(payload);
    if (provider === 'sandbox') return generateViaSandbox(payload);
    throw new Error(`Live generation not supported for provider: ${provider}`);
}

async function generateEwayBill(payload, invoiceNo) {
    const distanceKm = payload?.transDistance || 0;
    const now = new Date();

    if (isEwayBillConfigured()) {
        try {
            const nic = await callLiveGenerate(payload);
            return {
                enabled: true,
                ewbNo: formatEwbNo(nic.ewayBillNo || nic.EwbNo),
                ewbDate: nic.ewayBillDate || fmtDateTimeNic(now),
                validUpto: nic.validUpto ? new Date(nic.validUpto).toISOString() : computeValidUpto(distanceKm),
                status: 'generated',
                mode: 'live',
                provider: getProvider(),
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
        provider: 'demo',
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
    PROVIDERS,
    isEwayBillConfigured,
    getEwayBillConfigStatus,
    testEwayBillAuth,
    generateEwayBill,
    generateDemoEwayBill
};