/**
 * Google Sign-In / Sign-Up for client portal (requires cloud backend + GOOGLE_CLIENT_ID).
 */
(function () {
    'use strict';

    let googleClientId = null;
    let googleScriptLoaded = false;
    let googleInitialized = false;

    function loadGoogleScript() {
        if (googleScriptLoaded) return Promise.resolve();
        return new Promise((resolve, reject) => {
            if (window.google?.accounts?.id) {
                googleScriptLoaded = true;
                resolve();
                return;
            }
            const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
            if (existing) {
                existing.addEventListener('load', () => { googleScriptLoaded = true; resolve(); });
                existing.addEventListener('error', reject);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.onload = () => { googleScriptLoaded = true; resolve(); };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function getActiveGoogleMode() {
        const signupPanel = document.getElementById('auth-panel-signup');
        if (signupPanel && !signupPanel.classList.contains('hidden')) return 'signup';
        return 'login';
    }

    function collectSignupExtras() {
        return {
            businessName: (document.getElementById('signup-name')?.value || '').trim(),
            phone: (document.getElementById('signup-phone')?.value || '').trim(),
            gstin: (document.getElementById('signup-gstin')?.value || '').trim(),
            address: (document.getElementById('signup-address')?.value || '').trim(),
            stateCode: '07'
        };
    }

    async function handleGoogleCredential(response) {
        if (!window.LedgerFlowBackend?.enabled) {
            if (typeof showToast === 'function') showToast('Google sign-in requires cloud mode', 'error');
            return;
        }

        const mode = getActiveGoogleMode();
        const extras = mode === 'signup' ? collectSignupExtras() : {};

        if (mode === 'signup' && !extras.businessName) {
            if (typeof showToast === 'function') {
                showToast('Enter your business name above, then continue with Google', 'error');
            }
            return;
        }

        try {
            const result = await LedgerFlowBackend.googleAuth(response.credential, mode, extras);
            if (result.code === 'pending_approval' && result.signup) {
                if (typeof handleGoogleSignupComplete === 'function') {
                    await handleGoogleSignupComplete(result);
                }
                return;
            }
            if (result.token && typeof completeClientAuthFromApi === 'function') {
                await completeClientAuthFromApi(result);
            }
        } catch (err) {
            if (err.code === 'pending_approval') {
                if (typeof showPendingPanel === 'function') showPendingPanel(err.payload?.signup?.email || '');
                return;
            }
            if (err.code === 'google_signup_required') {
                const profile = err.payload?.profile || {};
                if (profile.email && document.getElementById('signup-email')) {
                    document.getElementById('signup-email').value = profile.email;
                }
                if (profile.name && document.getElementById('signup-name') && !document.getElementById('signup-name').value) {
                    document.getElementById('signup-name').value = profile.name;
                }
                if (typeof showSignupPanel === 'function') showSignupPanel();
                if (typeof showToast === 'function') {
                    showToast('Complete sign up with your business details', 'error');
                }
                return;
            }
            if (err.code === 'firm_account') {
                if (typeof setLoginMode === 'function') setLoginMode('firm');
            }
            if (err.code === 'account_blocked') {
                const msgEl = document.getElementById('login-error');
                if (msgEl) {
                    msgEl.textContent = err.message || 'Your account has been blocked.';
                    msgEl.classList.remove('hidden');
                }
                return;
            }
            const msgEl = mode === 'signup'
                ? document.getElementById('signup-error')
                : document.getElementById('login-error');
            if (msgEl) {
                msgEl.textContent = err.message || 'Google sign-in failed';
                msgEl.classList.remove('hidden');
            } else if (typeof showToast === 'function') {
                showToast(err.message || 'Google sign-in failed', 'error');
            }
        }
    }

    function renderButton(containerId, label) {
        const el = document.getElementById(containerId);
        if (!el || !window.google?.accounts?.id || !googleClientId) return;
        el.innerHTML = '';
        google.accounts.id.renderButton(el, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: label,
            shape: 'pill',
            width: Math.min(400, el.clientWidth || 360)
        });
    }

    window.renderGoogleAuthButtons = function () {
        const loginSection = document.getElementById('google-auth-client-section');
        const signupSection = document.getElementById('google-auth-signup-block');
        const enabled = googleClientId && googleInitialized;
        const isClient = typeof loginMode !== 'undefined' && loginMode === 'client';

        if (!enabled || !isClient) {
            loginSection?.classList.add('hidden');
            signupSection?.classList.add('hidden');
            return;
        }

        const onLogin = !document.getElementById('auth-panel-login')?.classList.contains('hidden');
        const onSignup = !document.getElementById('auth-panel-signup')?.classList.contains('hidden');
        const onOtpLogin = onLogin && !document.getElementById('login-otp-section')?.classList.contains('hidden');

        loginSection?.classList.toggle('hidden', !onLogin || onOtpLogin);
        signupSection?.classList.toggle('hidden', !onSignup);

        if (onLogin) renderButton('google-signin-login', 'signin_with');
        if (onSignup) renderButton('google-signup-only-btn', 'signup_with');
    };

    window.initGoogleAuth = async function () {
        const section = document.getElementById('google-auth-client-section');
        if (!window.LedgerFlowBackend?.enabled) {
            section?.classList.add('hidden');
            return;
        }
        try {
            const cfg = await LedgerFlowBackend.getGoogleConfig();
            if (!cfg.enabled || !cfg.clientId) {
                section?.classList.add('hidden');
                return;
            }
            googleClientId = cfg.clientId;
            await loadGoogleScript();
            google.accounts.id.initialize({
                client_id: googleClientId,
                callback: handleGoogleCredential,
                auto_select: false,
                cancel_on_tap_outside: true
            });
            googleInitialized = true;
            window.renderGoogleAuthButtons();
        } catch (e) {
            console.warn('[Google Auth] init failed:', e);
            section?.classList.add('hidden');
        }
    };
})();