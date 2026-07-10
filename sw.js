const CACHE = 'ledgerflow-v3';
const PRECACHE = ['/', '/index.html', '/crm-theme.css'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.pathname.startsWith('/api/')) return;
    const isScript = /\.js(\?|$)/i.test(url.pathname);
    e.respondWith(
        (isScript ? fetch(e.request) : caches.match(e.request)).then(cachedOrRes => {
            if (isScript) return cachedOrRes;
            if (cachedOrRes) return cachedOrRes;
            return fetch(e.request).then(res => {
                if (res.ok && url.origin === self.location.origin && !url.pathname.includes('.')) {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return res;
            }).catch(() => cachedOrRes);
        }).catch(() => caches.match(e.request))
    );
});