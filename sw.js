const CACHE_NAME = 'skyhawk-v29';

const urlsToCache = [
    '/',
    '/index.html',
    '/index.html?v=2',
    '/dashboard.html',
    '/manifest.json',
    '/sw.js'
];

// ============================================================
//  INSTALL: Cache app files only (NO TILES)
// ============================================================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching app files...');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// ============================================================
//  ACTIVATE: Clean old caches, claim immediately
// ============================================================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ============================================================
//  FETCH: App files only (TILES ARE HANDLED BY PLUGIN)
// ============================================================
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip tile requests – plugin handles them
    if (url.hostname.includes('tile.openstreetmap.org')) {
        return;
    }

    // App files - cache-first
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).catch(() => {
                    return new Response('Offline - SKYHAWK', {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                });
            })
    );
});
