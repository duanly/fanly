// Service Worker - 离线缓存（简易版）
// 只做最基础的缓存，满足 PWA 安装提示的要求
const CACHE_NAME = 'fanly-cache-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 网络优先策略，失败时走缓存
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // API 请求不缓存
  if (req.url.includes('/api/')) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // 只缓存成功的静态资源
        if (res.ok && (req.destination === 'style' || req.destination === 'script' || req.destination === 'image' || req.destination === 'font')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
  );
});
