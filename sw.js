// Bump this version whenever the caching STRATEGY itself changes.
// Ordinary app updates (html/css/js edits) no longer require a bump —
// shell files use network-first below, so new deploys show up right away.
const SHELL_CACHE = 'youmusic-shell-v3';
const SHELL_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && !k.startsWith('youmusic-audio')).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (SHELL_FILES.includes(url.pathname)) {
    // Network-first: always try to fetch the latest deployed version first,
    // and only fall back to the cached copy when there's no connection.
    // This is what keeps future updates (CSS/JS fixes, etc.) from getting
    // stuck behind a stale cached copy of the app shell.
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (url.pathname.startsWith('/api/')) return;

  // Everything else (icons, and downloaded offline audio) stays
  // cache-first — this is what makes downloaded songs playable with
  // no internet connection at all.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => cached))
  );
});
