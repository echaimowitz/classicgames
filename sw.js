/* Offline support: once loaded, the arcade works with no connection.
   Bump VERSION whenever you change files so phones pick up the update. */
const VERSION = 'cg-v2';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/font.js',
  'js/storage.js',
  'js/audio.js',
  'js/input.js',
  'js/arcade.js',
  'js/games/paddle-duel.js',
  'js/games/brickfall.js',
  'js/games/star-sentinel.js',
  'js/games/neon-serpent.js',
  'js/games/crystal-drift.js',
  'js/games/maze-bandit.js',
  'js/games/turbo-lanes.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve from cache instantly, refresh the cache in the background.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(e.request, { ignoreSearch: true }).then((hit) => {
        const net = fetch(e.request)
          .then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; })
          .catch(() => hit);
        return hit || net;
      })
    )
  );
});
