/**
 * Mobile OTP login for client portal (cloud backend + local demo fallback).
 */
(function () {
    'use strict';

    let clientAuthMethod = 'email';
    let otpSent = false;
    let localOtpStore = {};

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

    function getAppData() {
        return window.LedgerFlow?.getAppData?.() || window.appData || null;
    }

    function findLocalClientByPhone(phone) {
        const data = getAppData();
        if (!data?.clients || !data?.users) return null;
        for (const [clientId, client] of Object.entries(data.clients)) {
            if (!client?.phone || !phonesMatch(client.phone, phone)) continue;
            const user = Object.values(data.users).find(
                u => u.role === 'client' && u.clientId === clientId
            );
            if (user) return { user, clientId, client };
        }
        return null;
    }

    function showLoginError(msg) {
        const el = document.getElementById('login-error');
        if (!el) return;
        if (msg) {
            el.textContent = msg;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    function updateClientAuthMethodUI() {
        const isClient = typeof loginMode !== 'undefined' && loginMode === 'client';
        const onLogin = !document.getElementById('auth-panel-login')?.classList.contains('hidden');
        const toggle = document.getElementById('client-auth-method-toggle');
        const emailSection = document.getElementById('login-email-section');
        const otpSection = document.getElementById('login-otp-section');
        const submitBtn = document.getElementById('login-submit-btn');

        if (!toggle || !emailSection || !otpSection) return;

        const showOtp = isClient && onLogin && clientAuthMethod === 'otp';
        toggle.classList.toggle('hidden', !isClient || !onLogin);
        emailSection.classList.toggle('hidden', showOtp);
        otpSection.classList.toggle('hidden', !showOtp);
        submitBtn?.classList.toggle('hidden', showOtp);

        const tabEmail = document.getElementById('tab-auth-email');
        const tabOtp = document.getElementById('tab-auth-otp');
        if (tabEmail && tabOtp) {
            if (clientAuthMethod === 'email') {
                tabEmail.className = 'lf-tab lf-tab-active text-xs';
                tabOtp.className = 'lf-tab text-xs';
            } else {
                tabOtp.className = 'lf-tab lf-tab-active text-xs';
                tabEmail.className = 'lf-tab text-xs';
            }
        }

        updateDemoSectionForAuthMethod();
        if (typeof renderGoogleAuthButtons === 'function') renderGoogleAuthButtons();
    }

    function updateDemoSectionForAuthMethod() {
        const title = document.getElementById('demo-creds-title');
        const emailDemo = document.getElementById('demo-client-creds');
        const phoneDemo = document.getElementById('demo-client-phones');
        if (!title) return;

        const isOtp = clientAuthMethod === 'otp' && loginMode === 'client';
        title.textContent = isOtp
            ? 'Demo Client Mobile Numbers (click to fill)'
            : 'Demo Client Logins (click to fill)';
        emailDemo?.classList.toggle('hidden', isOtp);
        phoneDemo?.classList.toggle('hidden', !isOtp);
    }

    window.setClientAuthMethod = function (method) {
        clientAuthMethod = method === 'otp' ? 'otp' : 'email';
        showLoginError('');
        if (method !== 'otp') resetOtpFlow();
        updateClientAuthMethodUI();
    };

    window.resetOtpFlow = function () {
        otpSent = false;
        const verifyStep = document.getElementById('otp-step-verify');
        const phoneStep = document.getElementById('otp-step-phone');
        const demoHint = document.getElementById('otp-demo-hint');
        verifyStep?.classList.add('hidden');
        phoneStep?.classList.remove('hidden');
        document.getElementById('login-otp')?.value = '';
        demoHint?.classList.add('hidden');
        showLoginError('');
    };

    window.fillDemoPhone = function (phone) {
        setClientAuthMethod('otp');
        const input = document.getElementById('login-phone');
        if (input) input.value = phone;
        setLoginMode('client');
    };

    function setOtpStepVerify(demoOtp) {
        otpSent = true;
        document.getElementById('otp-step-phone')?.classList.add('hidden');
        document.getElementById('otp-step-verify')?.classList.remove('hidden');
        const hint = document.getElementById('otp-demo-hint');
        if (hint && demoOtp) {
            hint.textContent = `Demo mode — OTP: ${demoOtp}`;
            hint.classList.remove('hidden');
        } else {
            hint?.classList.add('hidden');
        }
        document.getElementById('login-otp')?.focus();
    }

    window.handleSendOtp = async function () {
        const phone = (document.getElementById('login-phone')?.value || '').trim();
        const btn = document.getElementById('otp-send-btn');
        if (!phone) {
            showLoginError('Enter your registered mobile number');
            return;
        }
        if (normalizePhone(phone).length < 10) {
            showLoginError('Enter a valid 10-digit mobile number');
            return;
        }

        showLoginError('');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Sending…';
        }

        try {
            if (window.LedgerFlowBackend?.enabled) {
                const result = await LedgerFlowBackend.sendOtp(phone);
                setOtpStepVerify(result.demoOtp);
                if (typeof showToast === 'function') {
                    showToast(result.demoMode
                        ? 'OTP generated (demo mode — see code below)'
                        : 'OTP sent to your mobile number');
                }
            } else {
                const found = findLocalClientByPhone(phone);
                if (!found) {
                    showLoginError('No client account found for this mobile number');
                    return;
                }
                if (found.user.blocked) {
                    showLoginError('Your account has been blocked. Contact your accounting firm.');
                    return;
                }
                const otp = String(Math.floor(100000 + Math.random() * 900000));
                localOtpStore[normalizePhone(phone)] = {
                    otp,
                    userId: found.user.email,
                    expiresAt: Date.now() + 10 * 60 * 1000
                };
                setOtpStepVerify(otp);
                if (typeof showToast === 'function') showToast('OTP generated (local demo mode)');
            }
        } catch (err) {
            if (err.code === 'account_blocked') {
                showLoginError(err.message || 'Your account has been blocked.');
            } else {
                showLoginError(err.message || 'Failed to send OTP');
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1"></i> Send OTP';
            }
        }
    };

    window.handleVerifyOtp = async function () {
        const phone = (document.getElementById('login-phone')?.value || '').trim();
        const code = (document.getElementById('login-otp')?.value || '').trim();
        const btn = document.getElementById('otp-verify-btn');

        if (!otpSent) {
            showLoginError('Send OTP first');
            return;
        }
        if (!code || code.length < 6) {
            showLoginError('Enter the 6-digit OTP');
            return;
        }

        showLoginError('');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Verifying…';
        }

        try {
            if (window.LedgerFlowBackend?.enabled) {
                const result = await LedgerFlowBackend.verifyOtp(phone, code);
                if (typeof completeClientAuthFromApi === 'function') {
                    await completeClientAuthFromApi(result);
                }
            } else {
                const key = normalizePhone(phone);
                const entry = localOtpStore[key];
                if (!entry || Date.now() > entry.expiresAt) {
                    showLoginError('OTP expired. Request a new one.');
                    return;
                }
                if (entry.otp !== code) {
                    showLoginError('Invalid OTP');
                    return;
                }
                delete localOtpStore[key];

                const found = findLocalClientByPhone(phone);
                if (!found?.user) {
                    showLoginError('Account not found');
                    return;
                }
                const user = found.user;
                currentUser = user;
                currentClientId = user.clientId;
                saveUserSession(user);
                document.getElementById('login-error')?.classList.add('hidden');
                showAppShell();
                populateClientSwitcher();
                updateHeaderForUser();
                applyRoleBasedUI();
                beginClientSessionIfNeeded(user);
                showSection('dashboard');
                if (typeof showToast === 'function') {
                    showToast(`Welcome to your Client Portal, ${user.name}!`);
                }
            }
        } catch (err) {
            if (err.code === 'account_blocked') {
                showLoginError(err.message || 'Your account has been blocked.');
            } else {
                showLoginError(err.message || 'OTP verification failed');
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-shield-check mr-1"></i> Verify & Sign In';
            }
        }
    };

    window.updateOtpAuthVisibility = updateClientAuthMethodUI;

    window.initOtpAuth = function () {
        updateClientAuthMethodUI();
    };
})();