const CACHE_NAME = 'skyhawk-v100';
const TILE_CACHE = 'skyhawk-tiles-v70';

const urlsToCache = [
    '/',
    '/index.html',
    '/index.html?v=100',
    '/dashboard.html',
    '/manifest.json',
    '/sw.js'
];

// ============================================================
//  PRECACHED TILES – These will work offline immediately
//  (Area around 39.02, -104.82, zoom 10-16)
//  You can add more tiles by adding more URLs
// ============================================================
const PRECACHE_TILES = [
    // Zoom 10
    'https://a.tile.openstreetmap.org/10/524/344.png',
    'https://b.tile.openstreetmap.org/10/525/344.png',
    'https://c.tile.openstreetmap.org/10/524/345.png',
    'https://a.tile.openstreetmap.org/10/525/345.png',
    'https://b.tile.openstreetmap.org/10/526/344.png',
    'https://c.tile.openstreetmap.org/10/524/346.png',
    // Zoom 11
    'https://a.tile.openstreetmap.org/11/1049/689.png',
    'https://b.tile.openstreetmap.org/11/1050/689.png',
    'https://c.tile.openstreetmap.org/11/1049/690.png',
    'https://a.tile.openstreetmap.org/11/1050/690.png',
    'https://b.tile.openstreetmap.org/11/1051/689.png',
    'https://c.tile.openstreetmap.org/11/1049/691.png',
    // Zoom 12
    'https://a.tile.openstreetmap.org/12/2099/1379.png',
    'https://b.tile.openstreetmap.org/12/2100/1379.png',
    'https://c.tile.openstreetmap.org/12/2101/1379.png',
    'https://a.tile.openstreetmap.org/12/2099/1380.png',
    'https://b.tile.openstreetmap.org/12/2100/1380.png',
    'https://c.tile.openstreetmap.org/12/2101/1380.png',
    // Zoom 13
    'https://a.tile.openstreetmap.org/13/4199/2759.png',
    'https://b.tile.openstreetmap.org/13/4200/2759.png',
    'https://c.tile.openstreetmap.org/13/4201/2759.png',
    'https://a.tile.openstreetmap.org/13/4199/2760.png',
    'https://b.tile.openstreetmap.org/13/4200/2760.png',
    'https://c.tile.openstreetmap.org/13/4201/2760.png',
    // Zoom 14
    'https://a.tile.openstreetmap.org/14/8399/5519.png',
    'https://b.tile.openstreetmap.org/14/8400/5519.png',
    'https://c.tile.openstreetmap.org/14/8401/5519.png',
    'https://a.tile.openstreetmap.org/14/8399/5520.png',
    'https://b.tile.openstreetmap.org/14/8400/5520.png',
    'https://c.tile.openstreetmap.org/14/8401/5520.png',
    // Zoom 15
    'https://a.tile.openstreetmap.org/15/16799/11039.png',
    'https://b.tile.openstreetmap.org/15/16800/11039.png',
    'https://c.tile.openstreetmap.org/15/16801/11039.png',
    'https://a.tile.openstreetmap.org/15/16799/11040.png',
    'https://b.tile.openstreetmap.org/15/16800/11040.png',
    'https://c.tile.openstreetmap.org/15/16801/11040.png',
    // Zoom 16
    'https://a.tile.openstreetmap.org/16/33599/22079.png',
    'https://b.tile.openstreetmap.org/16/33600/22079.png',
    'https://c.tile.openstreetmap.org/16/33601/22079.png',
    'https://a.tile.openstreetmap.org/16/33599/22080.png',
    'https://b.tile.openstreetmap.org/16/33600/22080.png',
    'https://c.tile.openstreetmap.org/16/33601/22080.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching app files...');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Pre-caching map tiles...');
                return caches.open(TILE_CACHE).then(cache => {
                    return Promise.allSettled(
                        PRECACHE_TILES.map(url => {
                            return fetch(url)
                                .then(response => {
                                    if (response.ok) {
                                        cache.put(url, response);
                                        console.log('Cached tile:', url);
                                    }
                                })
                                .catch(() => {});
                        })
                    );
                });
            })
            .then(() => self.skipWaiting())
    );
});

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

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // ===== MAP TILES – CACHE FIRST =====
    if (url.hostname.includes('tile.openstreetmap.org') || url.hostname.includes('tile.osm.org')) {
        event.respondWith(
            caches.open(TILE_CACHE).then(cache => {
                return cache.match(event.request).then(cached => {
                    if (cached) {
                        return cached; // SERVED FROM CACHE (OFFLINE!)
                    }
                    // If not cached, fetch and store for next time
                    return fetch(event.request).then(response => {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(() => {
                        return new Response('', { status: 404 });
                    });
                });
            })
        );
        return;
    }

    // ===== APP FILES =====
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
