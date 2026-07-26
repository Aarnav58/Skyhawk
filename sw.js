const CACHE_NAME = 'skyhawk-v55';
const TILE_CACHE = 'skyhawk-tiles-v35';

const urlsToCache = [
    '/',
    '/index.html',
    '/index.html?v=2',
    '/dashboard.html',
    '/manifest.json',
    '/sw.js'
];

// ============================================================
//  INSTALL – Cache App Files Only (No Tile Pre‑caching)
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
//  ACTIVATE – Clean Old Caches
// ============================================================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== TILE_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ============================================================
//  FETCH – Cache Tiles As You View Them
// ============================================================
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // === Map Tiles – Cache on the fly ===
    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(
            caches.open(TILE_CACHE).then(cache => {
                return cache.match(event.request).then(cached => {
                    if (cached) {
                        return cached;   // Already cached, serve it
                    }
                    // Not cached: fetch, store, and return
                    return fetch(event.request).then(response => {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(() => {
                        // Offline and not cached = blank tile
                        return new Response('', { status: 404 });
                    });
                });
            })
        );
        return;
    }

    // === App Files ===
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
