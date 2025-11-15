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

// sw.js - Service Worker for GenPwd Pro PWA

// Import version from external file
importScripts('/version.js');

const CACHE_VERSION = `genpwd-pro-v${APP_VERSION}`;
const CACHE_NAME = `${CACHE_VERSION}-static`;
const CACHE_RUNTIME = `${CACHE_VERSION}-runtime`;
const CACHE_DICTIONARIES = `${CACHE_VERSION}-dictionaries`;

// Files to cache on install
const STATIC_ASSETS = [
  '/',
  '/src/index.html',
  '/manifest.json',
  '/src/css/styles.css',

  // JavaScript Core
  '/src/js/app.js',
  '/src/js/config/constants.js',
  '/src/js/config/settings.js',
  '/src/js/config/ui-constants.js',
  '/src/js/config/crypto-constants.js',
  '/src/js/config/sentry-config.js',

  // Core modules
  '/src/js/core/dictionaries.js',
  '/src/js/core/generators.js',
  '/src/js/core/casing.js',

  // UI modules
  '/src/js/ui/dom.js',
  '/src/js/ui/events.js',
  '/src/js/ui/modal.js',
  '/src/js/ui/modal-manager.js',
  '/src/js/ui/render.js',
  '/src/js/ui/placement.js',
  '/src/js/ui/features-ui.js',

  // Utils
  '/src/js/utils/logger.js',
  '/src/js/utils/toast.js',
  '/src/js/utils/helpers.js',
  '/src/js/utils/validators.js',
  '/src/js/utils/clipboard.js',
  '/src/js/utils/theme-manager.js',
  '/src/js/utils/i18n.js',
  '/src/js/utils/analytics.js',
  '/src/js/utils/preset-manager.js',
  '/src/js/utils/history-manager.js',
  '/src/js/utils/plugin-manager.js',
  '/src/js/utils/performance.js',
  '/src/js/utils/error-monitoring.js',
  '/src/js/utils/keyboard-shortcuts.js',
  '/src/js/utils/lru-cache.js',
  '/src/js/utils/storage-helper.js',
  '/src/js/utils/integrity.js',
  '/src/js/utils/environment.js',
  '/src/js/utils/batch-processor.js',

  // Services
  '/src/js/services/password-service.js',
  '/src/js/services/import-export-service.js',

  // Vault
  '/src/js/vault/index.js',
  '/src/js/vault/crypto-engine.js',
  '/src/js/vault/kdf-service.js',
  '/src/js/vault/session-manager.js',
  '/src/js/vault/models.js',
  '/src/js/vault/interfaces.js',
  '/src/js/vault/in-memory-repository.js',

  // Plugins
  '/src/plugins/emoji-generator-plugin.js',
  '/src/plugins/xml-export-plugin.js'
];

// PERFORMANCE: Lazy load dictionaries - only cache default dictionary on install
// Other dictionaries are cached on first use (saves ~66% initial cache size)
const DEFAULT_DICTIONARY = '/src/dictionaries/french.json';
const DICTIONARY_ASSETS = [
  DEFAULT_DICTIONARY
  // english.json and latin.json will be cached on-demand via Cache-First strategy
];

// Locales
const LOCALE_ASSETS = [
  '/src/locales/fr.json',
  '/src/locales/en.json',
  '/src/locales/es.json'
];

/**
 * Service Worker Install Event
 * Cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker version:', CACHE_VERSION);

  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.concat(LOCALE_ASSETS));
      }),

      // Cache dictionaries separately (larger files)
      caches.open(CACHE_DICTIONARIES).then((cache) => {
        console.log('[SW] Caching dictionaries');
        return cache.addAll(DICTIONARY_ASSETS).catch((error) => {
          console.warn('[SW] Failed to cache some dictionaries:', error);
          // Don't fail install if dictionaries fail
        });
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      // Force activation
      return self.skipWaiting();
    })
  );
});

/**
 * Service Worker Activate Event
 * Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker version:', CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old versions
          if (cacheName.startsWith('genpwd-pro-') && !cacheName.startsWith(CACHE_VERSION)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

/**
 * Service Worker Fetch Event
 * Implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Strategy: Stale-While-Revalidate for JS/CSS (instant load + background update)
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }

  // Strategy: Cache-First for other static assets (images, fonts, HTML)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Strategy: Cache-First for dictionaries (immutable large files)
  if (isDictionary(url.pathname)) {
    event.respondWith(cacheFirst(request, CACHE_DICTIONARIES));
    return;
  }

  // Strategy: Network-First for runtime assets
  event.respondWith(networkFirst(request, CACHE_RUNTIME));
});

/**
 * Check if URL is a static asset
 */
function isStaticAsset(pathname) {
  return STATIC_ASSETS.some(asset => pathname.endsWith(asset)) ||
         LOCALE_ASSETS.some(asset => pathname.endsWith(asset)) ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.js') ||
         pathname.endsWith('.html') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.ico') ||
         pathname.endsWith('.woff') ||
         pathname.endsWith('.woff2') ||
         pathname.endsWith('.ttf');
}

/**
 * Check if URL is a dictionary
 */
function isDictionary(pathname) {
  return DICTIONARY_ASSETS.some(asset => pathname.endsWith(asset)) ||
         pathname.includes('/dictionaries/');
}

/**
 * Stale-While-Revalidate Strategy
 * Return cached version immediately, update cache in background
 * Best for static assets that change occasionally (JS, CSS)
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Start fetch in background regardless of cache hit
  const fetchPromise = fetch(request)
    .then(response => {
      // Update cache with fresh response (fire and forget)
      if (response && response.ok) {
        cache.put(request, response.clone());
        console.log('[SW] Cache updated in background:', request.url);
      }
      return response;
    })
    .catch(error => {
      console.warn('[SW] Background fetch failed:', request.url, error);
      return cachedResponse; // Fallback to cached if fetch fails
    });

  // Return cached immediately if available, otherwise wait for fetch
  if (cachedResponse) {
    console.log('[SW] Serving from cache (will revalidate):', request.url);
    return cachedResponse;
  }

  console.log('[SW] No cache, waiting for network:', request.url);
  return fetchPromise;
}

/**
 * Cache-First Strategy
 * Try cache first, then network, then cache any result
 * Best for immutable assets (dictionaries)
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    console.log('[SW] Cache hit:', request.url);
    return cached;
  }

  console.log('[SW] Cache miss, fetching:', request.url);

  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', request.url, error);

    // Return offline page or error response
    return new Response('Offline - Asset not cached', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

/**
 * Network-First Strategy
 * Try network first, fallback to cache
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);

    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    // Return offline response
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain'
      })
    });
  }
}

/**
 * Message Event Handler
 * Handle messages from clients
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('genpwd-pro-')) {
              return caches.delete(cacheName);
            }
          })
        );
      }).then(() => {
        event.ports[0].postMessage({ success: true });
      })
    );
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});

/**
 * Sync Event Handler (Background Sync API)
 * Handle background sync when online
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);

  if (event.tag === 'sync-passwords') {
    event.waitUntil(
      // Sync logic here (to be implemented in S2-5)
      Promise.resolve()
    );
  }
});

/**
 * Push Event Handler (for future notifications)
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');

  if (event.data) {
    const data = event.data.json();

    event.waitUntil(
      self.registration.showNotification(data.title || 'GenPwd Pro', {
        body: data.body || 'New notification',
        icon: '/assets/icon-192x192.png',
        badge: '/assets/icon-72x72.png',
        vibrate: [200, 100, 200],
        tag: data.tag || 'genpwd-notification',
        requireInteraction: false
      })
    );
  }
});

/**
 * Notification Click Handler
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);

  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

console.log('[SW] Service Worker script loaded');
