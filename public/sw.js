const CACHE_NAME = 'studybuddy-static-v1';
const STATIC_ASSETS = ['/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

const isPublicStaticRequest = (request) => {
  if (request.method !== 'GET' || request.mode === 'navigate' || request.destination === 'document') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return false;
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/favicon.svg';
};

self.addEventListener('fetch', (event) => {
  if (!isPublicStaticRequest(event.request)) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (!response.ok || response.type !== 'basic' || response.headers.has('set-cookie') || response.headers.get('cache-control')?.includes('private')) return response;
    const copy = response.clone();
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)));
    return response;
  })));
});
