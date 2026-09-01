// Bump CACHE_NAME on every deploy to avoid stale cache
const CACHE_NAME = 'nrayo-v0.1.2';
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
  const url = e.request.url;
  const isApiCall = ['/auth/', '/discovery/', '/quiz/', '/friends/', '/trio/', '/meets/',
    '/safety/', '/verify/', '/contacts/', '/ratings/', '/payments/', '/admin/']
    .some(prefix => url.includes(prefix));

  // API 호출은 캐싱 대상이 아니므로 그대로 네트워크로 흘려보냄 (가로채지 않음)
  if (isApiCall) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // GET 요청만 캐시 가능 (Cache API는 POST 등 다른 메서드를 지원하지 않음)
        if (e.request.method === 'GET') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
