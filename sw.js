// Service Worker für NikoStopp: macht die App offline-fähig.
// Strategie "Netzwerk zuerst, Cache als Rückfall": Ist man online, bekommt man immer
// die neueste Version (kein manuelles Cache-Leeren nach Updates nötig). Ist man offline,
// startet die App aus dem Cache.
const CACHE = 'nikostopp-v1';
const DATEIEN = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(DATEIEN)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const kopie = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, kopie));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
