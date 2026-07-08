/**
 * E-Way Bill API — demo generation + optional NIC live API hook.
 * Set EWAYBILL_GSTIN, EWAYBILL_USERNAME, EWAYBILL_PASSWORD for production NIC integration.
 */

const EWAYBILL_API_URL = process.env.EWAYBILL_API_URL || 'https://api.mastergst.com/ewaybillapi/v1.03';

function isEwayBillConfigured() {
    return !!(process.env.EWAYBILL_GSTIN && process.env.EWAYBILL_USERNAME && process.env.EWAYBILL_PASSWORD);
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

async function callNicGenerateEwayBill(payload) {
    const gstin = process.env.EWAYBILL_GSTIN;
    const username = process.env.EWAYBILL_USERNAME;
    const password = process.env.EWAYBILL_PASSWORD;
    const clientId = process.env.EWAYBILL_CLIENT_ID || '';
    const clientSecret = process.env.EWAYBILL_CLIENT_SECRET || '';

    const authRes = await fetch(`${EWAYBILL_API_URL}/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gstin, username, password, client_id: clientId, client_secret: clientSecret })
    });
    const authData = await authRes.json();
    if (!authRes.ok || !authData?.data?.authtoken) {
        throw new Error(authData?.message || authData?.error || 'E-way bill authentication failed');
    }

    const genRes = await fetch(`${EWAYBILL_API_URL}/ewayapi?action=GENEWAYBILL`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            gstin,
            authtoken: authData.data.authtoken
        },
        body: JSON.stringify(payload)
    });
    const genData = await genRes.json();
    if (!genRes.ok || !genData?.data?.ewayBillNo) {
        throw new Error(genData?.message || genData?.error || 'E-way bill generation failed');
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
                ewbNo: formatEwbNo(nic.ewayBillNo),
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
            const demo = await generateDemoEwayBill(payload, invoiceNo);
            demo.fallbackReason = err.message;
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
    generateEwayBill,
    generateDemoEwayBill
};