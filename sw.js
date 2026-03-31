/* ============================================================
   HABLA, PANA! 🇻🇪 — SERVICE WORKER (PWA)
   Caches main files for offline entry (though video needs Net)
   ============================================================ */

const CACHE_NAME = 'habla-pana-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching de Pana!');
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request);
        })
    );
});
