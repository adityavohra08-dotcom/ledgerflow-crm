/**
 * LedgerFlow CRM — API client (optional cloud backend).
 * Enable by creating config.json with { "apiUrl": "https://your-api.example.com" }
 */
(function () {
    'use strict';

    const TOKEN_KEY = 'lf_api_token';
    const state = {
        enabled: false,
        apiUrl: null,
        token: null,
        saveTimer: null,
        configLoaded: false
    };

    function storeToken(token) {
        state.token = token;
        try { sessionStorage.setItem(TOKEN_KEY, token); } catch (_) {}
        try { localStorage.setItem(TOKEN_KEY, token); } catch (_) {}
    }

    function loadStoredToken() {
        try {
            state.token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
        } catch (_) {
            state.token = null;
        }
    }

    async function apiFetch(path, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (state.token) headers.Authorization = `Bearer ${state.token}`;
        const res = await fetch(`${state.apiUrl}${path}`, { ...options, headers });
        let body = null;
        try {
            body = await res.json();
        } catch (_) {
            body = null;
        }
        if (!res.ok) {
            const err = new Error(body?.error || res.statusText || 'Request failed');
            err.status = res.status;
            err.code = body?.code;
            err.payload = body;
            throw err;
        }
        return body;
    }

    async function loadConfig() {
        try {
            const res = await fetch('config.json', { cache: 'no-store' });
            if (res.ok) {
                const cfg = await res.json();
                const raw = cfg.apiUrl != null ? String(cfg.apiUrl).trim() : '';
                if (raw.toUpperCase() === 'AUTO' || cfg.auto === true) {
                    state.apiUrl = window.location.origin;
                    state.enabled = true;
                    loadStoredToken();
                } else if (raw) {
                    state.apiUrl = raw.replace(/\/$/, '');
                    state.enabled = true;
                    loadStoredToken();
                }
            }
        } catch (_) {}
        state.configLoaded = true;
        return state.enabled;
    }

    async function login(email, password) {
        const result = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        storeToken(result.token);
        return result;
    }

    async function me() {
        return apiFetch('/api/auth/me');
    }

    async function saveData(appData) {
        return apiFetch('/api/data', {
            method: 'PUT',
            body: JSON.stringify(appData)
        });
    }

    function scheduleSave(appData) {
        clearTimeout(state.saveTimer);
        state.saveTimer = setTimeout(() => {
            saveData(appData).catch(err => {
                console.error('[LedgerFlow API] Save failed:', err);
                if (typeof showToast === 'function') {
                    showToast('Failed to sync — will retry…', 'error');
                }
                setTimeout(() => saveData(appData).catch(() => {}), 4000);
            });
        }, 700);
    }

    async function flushSave(appData) {
        clearTimeout(state.saveTimer);
        return saveData(appData);
    }

    async function publicSignup(payload) {
        return apiFetch('/api/public/signup', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async function publicVerify(signupId, code) {
        return apiFetch('/api/public/verify', {
            method: 'POST',
            body: JSON.stringify({ signupId, code })
        });
    }

    async function publicVerifyToken(token) {
        return apiFetch(`/api/public/verify-token?token=${encodeURIComponent(token)}`);
    }

    async function publicResend(signupId) {
        return apiFetch('/api/public/resend', {
            method: 'POST',
            body: JSON.stringify({ signupId })
        });
    }

    function clearToken() {
        state.token = null;
        try { sessionStorage.removeItem(TOKEN_KEY); } catch (_) {}
        try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
    }

    window.LedgerFlowBackend = {
        loadConfig,
        get enabled() { return state.enabled; },
        get apiUrl() { return state.apiUrl; },
        get token() { return state.token; },
        login,
        me,
        saveData,
        scheduleSave,
        flushSave,
        publicSignup,
        publicVerify,
        publicVerifyToken,
        publicResend,
        clearToken
    };
})();