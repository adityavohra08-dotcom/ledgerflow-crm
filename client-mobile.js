/**
 * Client portal mobile chrome — bottom tab bar, simplified header, upload FAB.
 * Desktop keeps the standard sidebar + header layout; mobile chrome only below 1024px.
 */
(function () {
    'use strict';

    const MOBILE_MQ = window.matchMedia('(max-width: 1023px)');

    const BOTTOM_TAB_SECTIONS = {
        home: ['dashboard'],
        invoices: ['invoices'],
        docs: ['documents'],
        whatsapp: ['whatsapp'],
        more: ['requests', 'profile', 'portal-logins', 'buy-services', 'admin-invoices', 'purchases']
    };

    function isClientPortal() {
        return typeof isClientUser === 'function' && isClientUser();
    }

    function isMobileViewport() {
        return MOBILE_MQ.matches;
    }

    function getTabForSection(section) {
        for (const [tab, sections] of Object.entries(BOTTOM_TAB_SECTIONS)) {
            if (sections.includes(section)) return tab;
        }
        return 'more';
    }

    function setMobileChromeActive(active) {
        const shell = document.getElementById('app-shell');
        shell?.classList.toggle('lf-app--client-mobile', active);
        document.body.classList.toggle('lf-app--client-mobile', active);
    }

    function clearMobileChrome() {
        setMobileChromeActive(false);
        if (typeof closeMobileSidebar === 'function') closeMobileSidebar();
        document.getElementById('lf-client-upload-fab')?.classList.add('hidden');
    }

    function syncClientViewportChrome() {
        if (!isClientPortal()) {
            clearMobileChrome();
            return;
        }

        if (!isMobileViewport()) {
            clearMobileChrome();
            return;
        }

        setMobileChromeActive(true);

        const firmName = (typeof appData !== 'undefined' && appData.firmSettings?.name) || 'Your CA Firm';
        const clientName = (typeof getCurrentClient === 'function' && getCurrentClient()?.name) || 'My Business';
        const firmEl = document.getElementById('header-client-mobile-firm');
        const bizEl = document.getElementById('header-client-mobile-business');
        if (firmEl) firmEl.textContent = firmName;
        if (bizEl) bizEl.textContent = clientName;

        wrapShowSectionCore();
        updateClientBottomNav(typeof currentSection !== 'undefined' ? currentSection : 'dashboard');
        updateClientUploadFab(typeof currentSection !== 'undefined' ? currentSection : 'dashboard');
    }

    window.applyClientMobileChrome = function applyClientMobileChrome() {
        syncClientViewportChrome();
    };

    window.removeClientMobileChrome = function removeClientMobileChrome() {
        clearMobileChrome();
    };

    window.clientBottomNavGo = function clientBottomNavGo(tab) {
        if (!isClientPortal() || !isMobileViewport()) return;

        if (tab === 'more') {
            const sb = document.getElementById('app-sidebar');
            if (sb?.classList.contains('lf-sidebar--open')) {
                closeMobileSidebar();
            } else if (typeof toggleMobileSidebar === 'function') {
                toggleMobileSidebar();
            }
            updateClientBottomNav(typeof currentSection !== 'undefined' ? currentSection : 'dashboard');
            return;
        }

        closeMobileSidebar();

        switch (tab) {
            case 'home':
                showSection('dashboard');
                break;
            case 'invoices':
                if (typeof showInvoicesFiltered === 'function') showInvoicesFiltered('outstanding');
                else showSection('invoices');
                break;
            case 'docs':
                showSection('documents');
                break;
            case 'whatsapp':
                showSection('whatsapp');
                break;
            default:
                break;
        }
    };

    window.updateClientBottomNav = function updateClientBottomNav(section) {
        const nav = document.getElementById('lf-client-bottom-nav');
        if (!nav || !isClientPortal() || !isMobileViewport()) return;

        const activeTab = getTabForSection(section);
        nav.querySelectorAll('[data-client-tab]').forEach(btn => {
            const isActive = btn.getAttribute('data-client-tab') === activeTab;
            btn.classList.toggle('lf-client-tab--active', isActive);
            btn.setAttribute('aria-current', isActive ? 'page' : 'false');
        });

        const sb = document.getElementById('app-sidebar');
        const moreBtn = nav.querySelector('[data-client-tab="more"]');
        if (moreBtn && sb?.classList.contains('lf-sidebar--open')) {
            nav.querySelectorAll('[data-client-tab]').forEach(btn => btn.classList.remove('lf-client-tab--active'));
            moreBtn.classList.add('lf-client-tab--active');
            moreBtn.setAttribute('aria-current', 'page');
        }
    };

    window.updateClientUploadFab = function updateClientUploadFab(section) {
        const fab = document.getElementById('lf-client-upload-fab');
        if (!fab || !isClientPortal() || !isMobileViewport()) {
            fab?.classList.add('hidden');
            return;
        }

        const docFilter = window.documentListFilter || 'ca';
        const show = section === 'dashboard' || (section === 'documents' && docFilter !== 'upload');
        fab.classList.toggle('hidden', !show);
    };

    function wrapShowSectionCore() {
        const orig = window.__showSectionCore;
        if (!orig || orig.__clientMobileWrapped) return;

        window.__showSectionCore = function (section) {
            orig(section);
            if (isClientPortal() && isMobileViewport()) {
                closeMobileSidebar();
                updateClientBottomNav(section);
                updateClientUploadFab(section);
            }
        };
        window.__showSectionCore.__clientMobileWrapped = true;
    }

    MOBILE_MQ.addEventListener('change', syncClientViewportChrome);
    window.addEventListener('resize', syncClientViewportChrome);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMobileViewport()) closeMobileSidebar();
    });
})();