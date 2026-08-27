// 최소 서비스워커 - 정적 파일만 캐시, index.html/API는 항상 네트워크 우선 (딸기지기 sw.js와 동일한 원칙)
const CACHE = 'chinguya-v1';
const STATIC_ASSETS = ['/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname === '/' || url.pathname.startsWith('/api/') || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(e.request)); // 항상 네트워크
    return;
  }
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
