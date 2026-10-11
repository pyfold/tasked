// tasked service worker: offline shell and static assets
const CACHE = 'tasked-v28';
const CACHE_PREFIX = 'tasked-v';
const CORE = [
  '/', '/offline.html', '/lesson.html', '/student.html', '/teacher.html',
  '/css/style.css', '/css/corporate.css', '/css/refinements.css?v=20261011-redesign-3', '/css/pixel.css?v=20261001-1', '/ui/ui.js?v=20261001-8', '/ui/ui.css?v=20261001-8',
  '/js/icons.js', '/js/theme.js', '/js/originkit-background.js', '/fonts/PixelifySans.ttf', '/fonts/Tiny5-Regular.ttf', '/js/i18n.js', '/js/voice.js',
  '/img/logo.svg', '/img/favicon.svg',
  '/manifest.webmanifest',
];
const REQUIRED_OFFLINE_SHELL = ['/offline.html'];
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // A transient failure for one optional asset must not prevent installation
    // of the worker and its offline fallback page.
    await cache.addAll(REQUIRED_OFFLINE_SHELL);
    await Promise.allSettled(
      CORE.filter((url) => !REQUIRED_OFFLINE_SHELL.includes(url)).map((url) => cache.add(url))
    );
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      // Shared origins may host Pix Hub or another app with its own cache.
      // Only remove caches owned by Tasked during this worker's upgrade.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API requests require live data and are never persisted by the service worker.
  if (url.pathname.startsWith('/api/')) {
    // Never serve cached account or progress responses: they can be stale or
    // belong to a different session. APIs should fail clearly while offline.
    if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/me') || url.pathname.startsWith('/api/student') || url.pathname.startsWith('/api/classes')) return;
    e.respondWith(fetch(request));
    return;
  }
  // pages: network first, offline fallback
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }
  // static: cache first
  e.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); }
      return r;
    }))
  );
});

