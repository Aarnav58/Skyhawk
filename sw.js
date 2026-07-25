const CACHE_NAME = 'skyhawk-v11';
const TILE_CACHE = 'skyhawk-tiles-v3';

const urlsToCache = [
    '/',
    '/index.html',
    '/index.html?v=2',
    '/dashboard.html',
    '/manifest.json',
    '/sw.js'
];

// ============================================================
//  DEFINE THE AREA TO CACHE (CHANGE THIS TO YOUR FLIGHT AREA)
// ============================================================
const CACHE_AREA = {
    // Example: 39.02, -104.82 (Colorado)
    // Change these to match your actual flight location
    minLat: 39.00,
    maxLat: 39.04,
    minLng: -104.86,
    maxLng: -104.78,
    minZoom: 10,
    maxZoom: 16
};

// ============================================================
//  GENERATE TILE URLS FOR THE AREA
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

        const xMin = Math.max(0, topLeft.x - 2);
        const xMax = bottomRight.x + 2;
        const yMin = Math.max(0, topLeft.y - 2);
        const yMax = bottomRight.y + 2;

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
//  INSTALL – CACHE APP FILES + PRE-CACHE TILES
// ============================================================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching app files...');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Pre-caching map tiles...');
                const tileUrls = generateTileUrls();
                console.log(`Caching ${tileUrls.length} tiles...`);

                const batchSize = 50;
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
//  ACTIVATE – CLEAN OLD CACHES
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
//  FETCH – SERVE FROM CACHE, FALLBACK TO NETWORK
// ============================================================
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Map tiles
    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(
            caches.open(TILE_CACHE).then(cache => {
                return cache.match(event.request).then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then(fetchResponse => {
                        if (fetchResponse.ok) {
                            cache.put(event.request, fetchResponse.clone());
                        }
                        return fetchResponse;
                    }).catch(() => {
                        return new Response('', { status: 404, statusText: 'Tile not cached' });
                    });
                });
            })
        );
        return;
    }

    // App files
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
