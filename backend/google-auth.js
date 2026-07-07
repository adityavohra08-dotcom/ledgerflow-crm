const { OAuth2Client } = require('google-auth-library');

async function verifyGoogleIdToken(idToken, clientId) {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId
    });
    return ticket.getPayload();
}

function randomGooglePassword() {
    return 'google_' + require('crypto').randomBytes(18).toString('hex');
}

module.exports = { verifyGoogleIdToken, randomGooglePassword };