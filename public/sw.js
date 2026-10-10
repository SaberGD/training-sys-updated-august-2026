const CACHE_NAME = 'sg-training-cache-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Pages (index.html, student-portal.html) are served without Cache-Control,
  // so the browser may keep an old copy for days and load an outdated build.
  // Always revalidate them with the server (a cheap 304 when unchanged).
  const isPage = event.request.mode === 'navigate' || url.pathname.endsWith('.html');
  const network = isPage
    ? fetch(new Request(event.request, { cache: 'no-cache' }))
    : fetch(event.request);

  event.respondWith(
    network
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/index.html'))
      )
  );
});
