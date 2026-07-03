const CACHE_NAME = 'skyhawk-v1';
const ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './styles.css',
  './manifest.json',
  './icon.png'
];

// Install stage: Save files to iPad memory
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activation stage
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch stage: Serve files from iPad memory when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
