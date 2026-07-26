const CACHE_NAME = 'skyhawk-v28';          // ← Change this when updating app
const TILE_CACHE = 'skyhawk-tiles-v11';     // ← NEVER CHANGE THIS AGAIN

const urlsToCache = [
    '/',
    '/index.html',
    '/index.html?v=2',
    '/dashboard.html',
    '/manifest.json',
    '/sw.js'
];

// ============================================================
//  CHANGE THIS TO YOUR ACTUAL FLIGHT LOCATION
// ============================================================
const CACHE_AREA = {
    minLat: 39.00,
    maxLat: 39.04,
    minLng: -104.86,
    maxLng: -104.78,
    minZoom: 10,
    maxZoom: 16
};

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

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // ONLY delete old APP caches, KEEP tile cache
                    if (cacheName !== CACHE_NAME && cacheName !== TILE_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // ============================================================
            //  CRITICAL: Force Service Worker to take control IMMEDIATELY
            //  This makes tiles stay after login/logout
            // ============================================================
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    if (url.hostname.includes('tile.openstreetmap.org')) {
        event.respondWith(
            caches.open(TILE_CACHE).then(cache => {
                return cache.match(event.request).then(cached => {
                    if (cached) {
                        return cached;
                    }
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
