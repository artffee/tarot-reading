/* Woman Cat Tarot — service worker (offline app shell + card art cache) */
const CACHE = 'wct-v23';
const CORE = [
  '/',
  '/index.html',
  '/about',
  '/deck',
  '/contact',
  '/privacy',
  '/consent.js',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/og.jpg',
  '/hero.webp',
  '/cards/back.webp',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];
// all 34 card faces (05.webp .. 38.webp) — warmed in the background so the
// installed app can deal a full reading with artwork while completely offline
const CARDS = [];
for (let i = 5; i <= 38; i++) CARDS.push('/cards/' + String(i).padStart(2, '0') + '.webp');

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
  // non-blocking: pre-cache card art without failing the install if any single file misses
  caches.open(CACHE).then(c => {
    CARDS.forEach(u => fetch(u).then(r => { if (r.ok) c.put(u, r.clone()); }).catch(() => {}));
  });
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Navigations: serve the app shell, fall back to cache when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Same-origin assets (card art, icons, css): cache-first, then fill the cache.
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => hit))
    );
    return;
  }

  // Cross-origin (Google Fonts): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
