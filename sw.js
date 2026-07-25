const CACHE_NAME = 'skyhawk-v20';
const TILE_CACHE = 'skyhawk-tiles-v5';

const urlsToCache = [
    '/',
    '/index.html',
    '/index.html?v=2',
    '/dashboard.html',
    '/manifest.json',
    '/sw.js'
];

// Install - cache app files only
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

// Activate - clean old caches
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

// Fetch - cache tiles as you go
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Map tiles - cache-as-you-go
    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(
            caches.open(TILE_CACHE).then(cache => {
                return cache.match(event.request).then(cached => {
                    const fetchPromise = fetch(event.request).then(response => {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(() => {
                        return new Response('', { status: 404 });
                    });
                    return cached || fetchPromise;
                });
            })
        );
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
