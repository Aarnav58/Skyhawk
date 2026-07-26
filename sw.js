const CACHE_NAME = 'skyhawk-v40';
const TILE_CACHE = 'skyhawk-tiles-v20';

// ============================================================
//  APP FILES TO CACHE
// ============================================================
const urlsToCache = [
    '/',
    '/index.html',
    '/index.html?v=2',
    '/dashboard.html',
    '/manifest.json',
    '/sw.js'
];

// ============================================================
//  DEFINE YOUR FLIGHT AREA FOR PRE‑CACHING
//  (Change these coordinates to match your location)
// ============================================================
const CACHE_AREA = {
    minLat: 38.90,
    maxLat: 39.10,
    minLng: -104.95,
    maxLng: -104.70,
    minZoom: 10,
    maxZoom: 16    // Higher zoom = more detail, more tiles
};

// ============================================================
//  GENERATE TILE URLs FOR THE DEFINED AREA
// ============================================================
function generateTileUrls() {
    const urls = [];
    const { minLat, maxLat, minLng, maxLng, minZoom, maxZoom } = CACHE_AREA;

    function latLngToTile(lat, lng, zoom) {
        const latRad = lat * Math.PI / 180;
        const n = Math.pow(2, zoom);
        const x = Math.floor((lng + 180) / 360 * n);
        const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
        return { x, y };
    }

    for (let z = minZoom; z <= maxZoom; z++) {
        const topLeft = latLngToTile(maxLat, minLng, z);
        const bottomRight = latLngToTile(minLat, maxLng, z);

        const xMin = Math.max(0, topLeft.x - 1);
        const xMax = bottomRight.x + 1;
        const yMin = Math.max(0, topLeft.y - 1);
        const yMax = bottomRight.y + 1;

        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                ['a', 'b', 'c'].forEach(sub => {
                    urls.push(`https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`);
                });
            }
        }
    }
    return urls;
}

// ============================================================
//  INSTALL – Cache App Files + Pre‑Cache Tiles
// ============================================================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching app files...');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Pre-caching map tiles for your area...');
                const tileUrls = generateTileUrls();
                console.log(`Caching ${tileUrls.length} tiles...`);

                const batchSize = 30;
                const batches = [];
                for (let i = 0; i < tileUrls.length; i += batchSize) {
                    batches.push(tileUrls.slice(i, i + batchSize));
                }

                return Promise.all(batches.map(batch => {
                    return caches.open(TILE_CACHE).then(cache => {
                        return Promise.allSettled(
                            batch.map(url => {
                                return fetch(url)
                                    .then(response => {
                                        if (response.ok) {
                                            cache.put(url, response);
                                        }
                                    })
                                    .catch(() => {});
                            })
                        );
                    });
                }));
            })
            .then(() => self.skipWaiting())
    );
});

// ============================================================
//  ACTIVATE – Clean Old Caches & Claim Immediately
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
//  FETCH – Intercept Tile Requests, Serve from Cache
// ============================================================
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // === Map Tiles ===
    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(
            caches.open(TILE_CACHE).then(cache => {
                return cache.match(event.request).then(cached => {
                    if (cached) {
                        return cached;   // Return cached tile (offline)
                    }
                    // If not cached, fetch and store for next time
                    return fetch(event.request).then(response => {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(() => {
                        // If offline and not cached, return a blank tile
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
