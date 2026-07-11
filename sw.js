// SKYHAWK Service Worker - Offline Mode
// Version 2 - Updated to refresh cache

const CACHE_NAME = 'skyhawk-v2';
const urlsToCache = [
    '/index.html',
    '/dashboard.html',
    '/manifest.json',
    '/sw.js',
    'https://unpkg.com/leaflet/dist/leaflet.css',
    'https://unpkg.com/leaflet/dist/leaflet.js'
];

// Install - Cache all files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// Activate - Clean old caches
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

// Fetch - Serve from cache, fallback to network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                // Otherwise, fetch from network
                return fetch(event.request).catch(() => {
                    // Offline fallback
                    return new Response('SKYHAWK Offline - Connect to the drone network.', {
                        status: 503,
                        statusText: 'Service Unavailable'
                    });
                });
            })
    );
});
