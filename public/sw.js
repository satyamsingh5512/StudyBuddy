const CACHE_NAME = 'studybuddy-static-v3';
const OFFLINE_FALLBACK = '/offline.html';
const STATIC_ASSETS = [
  OFFLINE_FALLBACK,
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  // A partial cache is still useful. Do not fail installation if an optional
  // icon is unavailable on an older deployment.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.allSettled(STATIC_ASSETS.map((asset) => cache.add(asset))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

const isSameOriginGet = (request) => {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin && !url.pathname.startsWith('/api/');
};

const isStaticAsset = (request) => {
  if (!isSameOriginGet(request)) return false;
  // Never cache navigation/document responses: Next can render account data
  // into them, and cache storage is shared across account sessions.
  if (request.mode === 'navigate' || request.destination === 'document') return false;
  const url = new URL(request.url);
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === OFFLINE_FALLBACK
  );
};

const cacheResponse = async (request, response) => {
  const cacheControl = response?.headers?.get('cache-control') || '';
  if (
    !response ||
    !response.ok ||
    response.type !== 'basic' ||
    response.headers.has('set-cookie') ||
    /private|no-store/i.test(cacheControl)
  ) {
    return response;
  }
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!isSameOriginGet(request)) return;

  // Network-only documents prevent a previous account's rendered HTML being
  // shown after logout. The fallback is deliberately unauthenticated.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (
          (await cache.match(OFFLINE_FALLBACK)) ||
          new Response('StudyBuddy needs one online launch before it can open offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        );
      })
    );
    return;
  }

  if (!isStaticAsset(request)) return;
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          event.waitUntil(cacheResponse(request, response.clone()));
          return response;
        })
    )
  );
});
