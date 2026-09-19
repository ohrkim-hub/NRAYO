// Bump CACHE_NAME on every deploy to avoid stale cache
const CACHE_NAME = 'nrayo-v0.7.0';
const ASSETS = ['./index.html', './css/style.css', './js/app.js', './manifest.json', './icons/icon.svg'];

// ---------------- FCM 백그라운드 알림 ----------------
// 앱이 꺼져있거나 다른 탭에 있을 때도 푸시 알림이 뜨도록 서비스워커에서 Firebase Messaging을 초기화
// (VAPID 키가 없어서 클라이언트가 토큰을 발급받지 않으면 이 부분은 그냥 조용히 아무 일도 안 함)
try {
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: "AIzaSyA7KsTABG4UfAkSmD6lk_vkL0gEwwKg45s",
    authDomain: "nrayo-3c940.firebaseapp.com",
    projectId: "nrayo-3c940",
    storageBucket: "nrayo-3c940.firebasestorage.app",
    messagingSenderId: "761047791567",
    appId: "1:761047791567:web:16b947455d90d5dbfbc4ba"
  });
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const title = (payload.notification && payload.notification.title) || '너랑요';
    const body = (payload.notification && payload.notification.body) || '새 알림이 도착했어요';
    self.registration.showNotification(title, { body, icon: './icons/icon.svg' });
  });
} catch (e) {
  // 구형 브라우저 등에서 importScripts가 실패해도 캐싱/오프라인 기능에는 영향 없음
}

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
