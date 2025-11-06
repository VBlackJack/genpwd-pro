/*
 * Copyright 2025 Julien Bombled
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Service Worker for GenPwd Pro - PWA Support
const CACHE_VERSION = 'v2.6.0';
const CACHE_NAME = `genpwd-pro-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',

  // Styles
  '/styles/main.css',
  '/styles/components.css',
  '/styles/layout.css',
  '/styles/modal.css',
  '/styles/test-modal.css',
  '/styles/features.css',

  // JavaScript modules
  '/js/app.js',
  '/js/test-integration.js',

  // Core modules
  '/js/config/constants.js',
  '/js/config/crypto-constants.js',
  '/js/config/settings.js',
  '/js/config/sentry-config.js',

  '/js/core/generators.js',
  '/js/core/dictionaries.js',
  '/js/core/casing.js',

  '/js/ui/dom.js',
  '/js/ui/events.js',
  '/js/ui/render.js',
  '/js/ui/modal.js',
  '/js/ui/placement.js',
  '/js/ui/features-ui.js',

  '/js/utils/clipboard.js',
  '/js/utils/logger.js',
  '/js/utils/toast.js',
  '/js/utils/error-monitoring.js',
  '/js/utils/theme-manager.js',
  '/js/utils/performance.js',
  '/js/utils/integrity.js',
  '/js/utils/helpers.js',
  '/js/utils/i18n.js',
  '/js/utils/preset-manager.js',
  '/js/utils/history-manager.js',
  '/js/utils/analytics.js',
  '/js/utils/environment.js',

  '/js/vault/crypto-engine.js',
  '/js/vault/kdf-service.js',
  '/js/vault/session-manager.js',
  '/js/vault/models.js',
  '/js/vault/in-memory-repository.js',
  '/js/vault/interfaces.js',

  '/js/services/password-service.js',

  // Dictionaries
  '/dictionaries/french.json',
  '/dictionaries/english.json',
  '/dictionaries/latin.json',

  // Locales (i18n)
  '/locales/fr.json',
  '/locales/en.json',
  '/locales/es.json',

  // Tests
  '/tests/test-suite.js',
  '/tests/test-new-features.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...', CACHE_NAME);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      })
      .then(() => {
        console.log('[ServiceWorker] Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[ServiceWorker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...', CACHE_NAME);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Remove old versions
              return cacheName.startsWith('genpwd-pro-') && cacheName !== CACHE_NAME;
            })
            .map((cacheName) => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Strategy: Cache First, falling back to Network
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[ServiceWorker] Serving from cache:', url.pathname);
          return cachedResponse;
        }

        // Not in cache, fetch from network
        console.log('[ServiceWorker] Fetching from network:', url.pathname);
        return fetch(request)
          .then((networkResponse) => {
            // Don't cache non-successful responses
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
              return networkResponse;
            }

            // Clone the response (can only be consumed once)
            const responseToCache = networkResponse.clone();

            // Cache dynamically fetched resources
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Only cache same-origin requests
                if (url.origin === location.origin) {
                  cache.put(request, responseToCache);
                }
              });

            return networkResponse;
          })
          .catch((error) => {
            console.error('[ServiceWorker] Fetch failed:', error);

            // Return offline page if available
            return caches.match('/offline.html').then((offlineResponse) => {
              return offlineResponse || new Response('Offline - Service Worker', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              });
            });
          });
      })
  );
});

// Message event - for manual cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[ServiceWorker] Skip waiting requested');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_UPDATE') {
    console.log('[ServiceWorker] Manual cache update requested');
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(STATIC_ASSETS))
        .then(() => {
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          console.error('[ServiceWorker] Cache update failed:', error);
          event.ports[0].postMessage({ success: false, error: error.message });
        })
    );
  }
});

// Periodic background sync (future feature)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    console.log('[ServiceWorker] Periodic sync: update-cache');
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(STATIC_ASSETS))
    );
  }
});

// Push notification support (future feature)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nouvelle notification GenPwd Pro',
    icon: '/assets/icon-192x192.png',
    badge: '/assets/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'open',
        title: 'Ouvrir',
        icon: '/assets/icon-open.png'
      },
      {
        action: 'close',
        title: 'Fermer',
        icon: '/assets/icon-close.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('GenPwd Pro', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification click:', event.action);
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('[ServiceWorker] Loaded successfully', CACHE_VERSION);
