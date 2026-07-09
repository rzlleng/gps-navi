/**
 * sw.js
 * ---------------------------------------------------------------------------
 * Service Worker for GPS Navigator V2.
 *
 * Strategy:
 *  - App shell (HTML/CSS/JS/icons/manifest) is pre-cached on install and
 *    served cache-first, so the app opens even with no connectivity.
 *  - Requests to the Google Apps Script API are always network-only:
 *    job data must be fresh, and offline reads are instead handled by the
 *    client-side localStorage cache in app.js (which mirrors the last
 *    successful fetch). This keeps the service worker simple and avoids
 *    serving stale write responses.
 *  - Bump CACHE_VERSION whenever any app-shell file changes so old caches
 *    are cleaned up automatically on activate.
 * ---------------------------------------------------------------------------
 */

const CACHE_VERSION = 'gps-navigator-v2.0.0';
const APP_SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './api.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/**
 * Determines whether a request should bypass the cache entirely
 * (i.e. any call to the Google Apps Script backend).
 * @param {Request} request
 * @returns {boolean}
 */
function isApiRequest(request) {
  return request.url.includes('script.google.com');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_VERSION)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never cache API calls — always go to network so job data stays current.
  if (isApiRequest(request)) {
    event.respondWith(fetch(request));
    return;
  }

  // Only handle GET requests for the app shell; let everything else pass through.
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(request)
        .then((networkResponse) => {
          // Cache newly fetched shell assets for next time (e.g. Google Fonts).
          const responseClone = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, responseClone));
          return networkResponse;
        })
        .catch(() => {
          // If navigating and offline with nothing cached, fall back to the shell.
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return undefined;
        });
    })
  );
});
