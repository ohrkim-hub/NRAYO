const CACHE_NAME = 'nrayo-v0.1.0';
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

self.addEventListener('fetch', (e) => {
  // API 요청은 항상 네트워크 우선, 정적 자산은 캐시 우선
  if (e.request.url.includes('/auth/') || e.request.url.includes('/discovery/') ||
      e.request.url.includes('/quiz/') || e.request.url.includes('/friends/') ||
      e.request.url.includes('/trio/') || e.request.url.includes('/meets/') ||
      e.request.url.includes('/safety/')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
