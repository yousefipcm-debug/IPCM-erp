// OSSATURE service worker: makes the app installable and keeps the shell
// available when the network drops. Data (/api) is never cached.
const CACHE = 'arcis-shell-v3';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && (url.pathname.startsWith('/assets/') || e.request.mode === 'navigate')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request.mode === 'navigate' ? '/' : e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request.mode === 'navigate' ? '/' : e.request).then((r) => r || Response.error())),
  );
});
