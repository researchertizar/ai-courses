/* =====================================================
   AI Courses PWA — Service Worker  v4.1
   Caches shell, fonts, and dataset for offline use
===================================================== */
const V = 'v4.1';
const CACHE_SHELL = `shell-${V}`;
const CACHE_DATA  = `data-${V}`;
const CACHE_FONT  = `font-${V}`;

const SHELL_FILES = [
  './index.html',
  './admin.html',
  './courses.json'
];

/* ── Install ─────────────────────────────────────── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_SHELL)
      .then(c => c.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Install cache failed:', err))
  );
});

/* ── Activate ────────────────────────────────────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => ![CACHE_SHELL, CACHE_DATA, CACHE_FONT].includes(k))
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ───────────────────────────────────────── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Google Fonts — cache first, long TTL
  if (url.hostname.includes('fonts.g')) {
    e.respondWith(cacheFirst(e.request, CACHE_FONT));
    return;
  }
  // External APIs — network only, graceful offline
  if (url.hostname.includes('anthropic') || url.hostname.includes('allorigins') || url.hostname.includes('jsonbin')) {
    e.respondWith(networkOnly(e.request));
    return;
  }
  // courses.json — network first (always try to get fresh), fallback to cache
  if (url.pathname.endsWith('courses.json')) {
    e.respondWith(networkFirst(e.request, CACHE_DATA));
    return;
  }
  // Everything else — cache first
  if (e.request.method === 'GET') {
    e.respondWith(cacheFirst(e.request, CACHE_SHELL));
  }
});

/* ── Strategies ──────────────────────────────────── */
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) {
      const c = await caches.open(cacheName);
      c.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req, cacheName) {
  try {
    const fresh = await fetch(req);
    if (fresh.ok) {
      const c = await caches.open(cacheName);
      c.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(req);
    return cached || new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  }
}

async function networkOnly(req) {
  try {
    return await fetch(req);
  } catch {
    return new Response(
      JSON.stringify({ error: 'offline', message: 'This feature requires internet.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/* ── Messages ────────────────────────────────────── */
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
});
