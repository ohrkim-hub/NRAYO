// Bump CACHE_NAME on every deploy to avoid stale cache
const CACHE_NAME = 'nrayo-v0.1.1';
const ASSETS = ['./index.html', './css/style.css', './js/app.js', './manifest.json', './icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first strategy: always try network first, fall back to cache only when offline
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/auth/') || e.request.url.includes('/discovery/') ||
      e.request.url.includes('/quiz/') || e.request.url.includes('/friends/') ||
      e.request.url.includes('/trio/') || e.request.url.includes('/meets/') ||
      e.request.url.includes('/safety/')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
