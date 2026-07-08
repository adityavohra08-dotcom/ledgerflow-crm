/**
 * LedgerFlow — WhatsApp Business API (Meta Cloud API)
 * Env: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN
 */
function normalizePhone(phone) {
    let digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) digits = '91' + digits;
    else if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1);
    return digits;
}

function isWhatsAppConfigured() {
    return !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

function getWhatsAppConfigStatus() {
    return {
        configured: isWhatsAppConfigured(),
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ? '***' + String(process.env.WHATSAPP_PHONE_NUMBER_ID).slice(-4) : null,
        hasToken: !!process.env.WHATSAPP_ACCESS_TOKEN,
        webhookPath: '/api/whatsapp/webhook'
    };
}

async function sendWhatsAppText(phone, message) {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!phoneNumberId || !token) {
        throw new Error('WhatsApp Business API not configured');
    }
    const to = normalizePhone(phone);
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: message }
        })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data?.error?.message || 'WhatsApp API send failed');
        err.payload = data;
        throw err;
    }
    return data;
}

module.exports = {
    isWhatsAppConfigured,
    getWhatsAppConfigStatus,
    sendWhatsAppText,
    normalizePhone
};