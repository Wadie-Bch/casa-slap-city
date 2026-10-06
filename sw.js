/* CASA SLAP CITY service worker — offline play.
   App shell: network first (so updates arrive when online), cache fallback.
   City regions (data/r_*.bin): cache first — they only change with the data version. */
const CORE = 'csc-core-v1', DATA = 'csc-data-v1';
const SHELL = ['./', 'index.html', 'js/world.js', 'js/art.js', 'js/game.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'data/meta.json'];

self.addEventListener('install', e => e.waitUntil(caches.open(CORE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CORE && k !== DATA).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isData = url.pathname.indexOf('/data/r_') >= 0;
  e.respondWith((async () => {
    if (isData) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(DATA)).put(req, res.clone());
      return res;
    }
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 3500);
      const res = await fetch(req, { signal: ctl.signal, cache: 'no-cache' });
      clearTimeout(timer);
      if (res.ok) (await caches.open(CORE)).put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') { const idx = await caches.match('index.html'); if (idx) return idx; }
      throw err;
    }
  })());
});
