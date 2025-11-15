# Progressive Web App (PWA) - GenPwd Pro

GenPwd Pro is a fully-featured Progressive Web App that provides offline functionality, installability, and native app-like experience.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Offline Support](#offline-support)
- [Caching Strategy](#caching-strategy)
- [Updates](#updates)
- [Testing](#testing)
- [Lighthouse Audit](#lighthouse-audit)
- [Browser Support](#browser-support)

## Overview

GenPwd Pro's PWA implementation follows best practices and modern web standards to provide:
- **Offline-first** functionality with Service Worker caching
- **Installability** on desktop and mobile devices
- **Fast loading** with aggressive caching strategies
- **Automatic updates** with user notification
- **Native app feel** with standalone display mode

## Features

### 1. Installability

Users can install GenPwd Pro as a standalone app on:
- **Desktop**: Windows, macOS, Linux (Chrome, Edge, Firefox)
- **Mobile**: Android (Chrome), iOS (Safari)

#### Installation Process

1. **Automatic Prompt**: A custom install banner appears for eligible users
2. **Manual Install**:
   - **Desktop**: Click the install icon in the address bar
   - **Mobile**: Tap "Add to Home Screen" from browser menu

#### Custom Install Banner

The app displays a custom install prompt:
```
📱 Install GenPwd Pro
Add to home screen for offline access

[Install] [Not now]
```

Features:
- Auto-dismisses after 10 seconds
- Can be manually dismissed
- Respects user preference (won't show for 7 days if dismissed)
- Beautiful gradient design matching app branding

### 2. Offline Support

GenPwd Pro works completely offline after first visit:

#### Cached Resources

**Static Assets** (Cache-First strategy):
- HTML, CSS, JavaScript files
- Fonts and images
- UI components

**Dictionaries** (Cache-First with network update):
- French dictionary (2400+ words)
- English dictionary
- Latin dictionary
- Portuguese dictionary
- German dictionary

**Runtime Data** (Network-First strategy):
- Dynamic API calls
- User preferences
- Generated passwords (stored locally)

### 3. Background Sync

When the app comes back online:
- Automatically syncs pending data
- Updates dictionaries if newer versions available
- Notifies user of successful sync

### 4. Push Notifications (Future)

Placeholder for future features:
- Security alerts
- Update notifications
- Backup reminders

## Architecture

### Components

```
PWA Architecture
├── manifest.json          # App manifest with metadata
├── sw.js                  # Service Worker (main worker)
└── pwa-manager.js         # PWA Manager (registration & lifecycle)
```

### Service Worker (sw.js)

The Service Worker handles:
- **Cache Management**: Static assets, dictionaries, runtime data
- **Fetch Interception**: Smart caching strategies
- **Background Sync**: Data synchronization when online
- **Update Management**: Version control and cache clearing

#### Service Worker Lifecycle

```javascript
// 1. Installation
self.addEventListener('install', (event) => {
  // Cache static assets and dictionaries
  // Skip waiting to activate immediately
});

// 2. Activation
self.addEventListener('activate', (event) => {
  // Clean up old caches
  // Claim all clients
});

// 3. Fetch
self.addEventListener('fetch', (event) => {
  // Intercept requests
  // Apply caching strategy
  // Return cached or network response
});
```

### PWA Manager (pwa-manager.js)

The PWA Manager handles:
- **Registration**: Service Worker registration
- **Install Prompts**: Custom install UI
- **Online/Offline Detection**: Network status monitoring
- **Update Notifications**: New version alerts
- **Status Reporting**: PWA state management

#### PWA Manager API

```javascript
// Get PWA status
const status = pwaManager.getStatus();
// {
//   serviceWorkerRegistered: true,
//   isPWA: false,
//   isOnline: true,
//   updateAvailable: false,
//   canInstall: true
// }

// Check if running as PWA
const isPWA = pwaManager.isPWA(); // true/false

// Get Service Worker version
const version = await pwaManager.getVersion(); // "2.6.0"

// Clear all caches
const success = await pwaManager.clearCaches(); // true/false
```

### Manifest (manifest.json)

The manifest defines app metadata:

```json
{
  "name": "GenPwd Pro - Secure Password Generator",
  "short_name": "GenPwd Pro",
  "description": "Professional password generator with offline support",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#4CAF50",
  "background_color": "#FFFFFF",
  "icons": [ /* 8 icon sizes */ ],
  "shortcuts": [ /* Quick actions */ ]
}
```

## Installation

### For Developers

1. **Clone the repository**:
```bash
git clone https://github.com/VBlackJack/genpwd-pro.git
cd genpwd-pro
```

2. **Serve the app** (Service Workers require HTTPS or localhost):
```bash
# Option 1: Python
python3 -m http.server 8000

# Option 2: Node.js (http-server)
npx http-server src -p 8000

# Option 3: VS Code Live Server
# Install "Live Server" extension and click "Go Live"
```

3. **Access the app**:
```
http://localhost:8000
```

4. **Test PWA features**:
- Open DevTools > Application > Service Workers
- Check Manifest
- Simulate offline mode
- Test cache storage

### For Users

1. **Visit the app**: Navigate to the GenPwd Pro URL
2. **Install prompt**: Click "Install" when the banner appears
3. **Manual install**:
   - **Desktop**: Click install icon in address bar
   - **Mobile**: Menu > Add to Home Screen
4. **Launch**: Open from home screen or app drawer

## Offline Support

### What Works Offline?

✅ **Full Functionality**:
- Password generation (all modes)
- Syllabes mode
- Passphrase mode (cached dictionaries)
- Leet speak mode
- Case transformations
- Placement controls
- History (localStorage)
- Presets (localStorage)
- Settings (localStorage)

✅ **Cached Dictionaries**:
- French (integrated + cached)
- English (cached)
- Latin (cached)
- Portuguese (cached)
- German (cached)

❌ **Requires Internet**:
- HIBP breach checking (S2-4)
- Cloud sync (S2-5 - future)
- Plugin downloads (future)
- Analytics (optional)

### Testing Offline Mode

1. **Load the app** while online (first visit)
2. **Wait for caching** to complete
3. **Enable offline mode**:
   - DevTools > Network > Offline checkbox
   - Or: Airplane mode on mobile
4. **Reload the page** - should load instantly
5. **Test all features** - should work normally
6. **Check toast notification** - "Offline mode - Using cached data"

## Caching Strategy

### Cache-First Strategy

Used for **static assets** that rarely change:

```javascript
// Try cache first, fall back to network
const cachedResponse = await caches.match(request);
if (cachedResponse) {
  return cachedResponse;
}
return fetch(request);
```

**Assets**:
- HTML files
- CSS stylesheets
- JavaScript modules
- Images, fonts
- Dictionaries

**Advantages**:
- Instant loading
- Zero network delay
- Works offline

### Network-First Strategy

Used for **dynamic data** that changes frequently:

```javascript
// Try network first, fall back to cache
try {
  const response = await fetch(request);
  cache.put(request, response.clone());
  return response;
} catch {
  return caches.match(request);
}
```

**Assets**:
- API calls
- Runtime data
- User-generated content

**Advantages**:
- Always fresh data
- Fallback for offline

### Stale-While-Revalidate (Future)

For resources that benefit from fast delivery and background updates:

```javascript
// Return cache immediately, update in background
const cachedResponse = await caches.match(request);
const fetchPromise = fetch(request).then(response => {
  cache.put(request, response.clone());
  return response;
});
return cachedResponse || fetchPromise;
```

## Updates

### Automatic Update Detection

The PWA Manager detects new Service Worker versions:

```javascript
this.registration.addEventListener('updatefound', () => {
  // New Service Worker installing
  // Show update notification when ready
});
```

### Update Notification

When an update is available, users see:

```
✨ New version available!
[Update] [Later]
```

Clicking "Update":
1. Tells Service Worker to skip waiting
2. Activates new version
3. Reloads page to use new code

### Manual Update

Developers can force updates:

```javascript
// In DevTools Console
await navigator.serviceWorker.getRegistration().update();
```

Or via PWA Manager:

```javascript
// Clear cache and reload
await pwaManager.clearCaches();
window.location.reload();
```

### Version Management

Caches are versioned:

```javascript
const CACHE_VERSION = 'genpwd-pro-v2.6.0';
```

When version changes:
1. New cache created
2. Old cache deleted
3. Fresh assets cached

## Testing

### Manual Testing

1. **Service Worker Registration**:
```javascript
// DevTools Console
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW registered:', reg);
});
```

2. **Cache Contents**:
```javascript
// DevTools > Application > Cache Storage
caches.keys().then(keys => console.log('Caches:', keys));
```

3. **Offline Test**:
- Load app online
- DevTools > Network > Offline
- Reload page
- Verify all features work

4. **Install Test**:
- Visit app
- Wait for install banner
- Click "Install"
- Verify standalone window

### Automated Testing

```bash
# Lighthouse CLI
npm install -g lighthouse
lighthouse http://localhost:8000 --view

# PWA Audit
lighthouse http://localhost:8000 --only-categories=pwa --view
```

### Testing Checklist

- [ ] Service Worker registers successfully
- [ ] Static assets cached on first visit
- [ ] App works offline
- [ ] Dictionaries load offline
- [ ] Install banner appears
- [ ] App installs successfully
- [ ] Update notification works
- [ ] Background sync works
- [ ] Lighthouse PWA score = 100

## Lighthouse Audit

### Target Metrics

**PWA Score**: 100/100

**Requirements**:
- ✅ Registers a service worker
- ✅ Responds with 200 when offline
- ✅ Has a web app manifest
- ✅ Uses HTTPS (production)
- ✅ Redirects HTTP to HTTPS (production)
- ✅ Viewport meta tag configured
- ✅ Content sized correctly for viewport
- ✅ Has a `<meta name="theme-color">`
- ✅ Icons provided (8 sizes)
- ✅ Apple touch icons provided
- ✅ Splash screens configured

### Running Lighthouse

```bash
# Full audit
lighthouse http://localhost:8000 --view

# PWA only
lighthouse http://localhost:8000 --only-categories=pwa --view

# CI/CD
lighthouse http://localhost:8000 --output=json --output-path=./report.json
```

### Expected Results

```
PWA Score: 100
├── Fast and reliable: 100
│   ├── Service Worker registered
│   ├── Offline capable
│   └── Fast load times
├── Installable: 100
│   ├── Web app manifest
│   ├── Icons provided
│   └── Start URL valid
└── PWA Optimized: 100
    ├── Theme color
    ├── Viewport configured
    └── Content properly sized
```

## Browser Support

### Desktop

| Browser | Version | Support | Notes |
|---------|---------|---------|-------|
| Chrome | 67+ | ✅ Full | Best support |
| Edge | 79+ | ✅ Full | Chromium-based |
| Firefox | 44+ | ⚠️ Partial | No install prompt |
| Safari | 11.1+ | ⚠️ Partial | Limited features |
| Opera | 54+ | ✅ Full | Chromium-based |

### Mobile

| Browser | Version | Support | Notes |
|---------|---------|---------|-------|
| Chrome (Android) | 67+ | ✅ Full | Best experience |
| Safari (iOS) | 11.3+ | ⚠️ Partial | No notifications |
| Samsung Internet | 8.2+ | ✅ Full | Great support |
| Firefox (Android) | 68+ | ⚠️ Partial | Limited |

### Feature Support

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| Service Worker | ✅ | ✅ | ✅ | ✅ |
| Web App Manifest | ✅ | ✅ | ⚠️ | ⚠️ |
| Install Prompt | ✅ | ✅ | ❌ | ❌ |
| Background Sync | ✅ | ✅ | ❌ | ❌ |
| Push Notifications | ✅ | ✅ | ✅ | ❌ |
| Offline Mode | ✅ | ✅ | ✅ | ✅ |
| Cache API | ✅ | ✅ | ✅ | ✅ |

## Advanced Configuration

### Customizing the Manifest

Edit `manifest.json` to customize:

```json
{
  "name": "Your App Name",
  "short_name": "App",
  "theme_color": "#yourcolor",
  "background_color": "#yourcolor",
  "icons": [ /* your icons */ ],
  "shortcuts": [ /* your shortcuts */ ]
}
```

### Customizing Service Worker

Edit `sw.js` to add:

```javascript
// Custom cache strategies
// Additional routes
// Background sync handlers
// Push notification handlers
```

### Customizing PWA Manager

Edit `src/js/utils/pwa-manager.js`:

```javascript
// Custom install UI
// Update notification styling
// Sync logic
// Analytics integration
```

## Troubleshooting

### Service Worker Not Registering

**Problem**: SW doesn't register

**Solutions**:
1. Check HTTPS (required except localhost)
2. Check browser console for errors
3. Clear browser cache
4. Check Service Worker scope
5. Verify sw.js path is correct

```javascript
// DevTools Console
navigator.serviceWorker.getRegistration().then(reg => {
  console.log(reg ? 'Registered' : 'Not registered');
});
```

### App Not Working Offline

**Problem**: App fails when offline

**Solutions**:
1. Ensure SW registered successfully
2. Check cache contents (DevTools > Application > Cache)
3. Verify all resources cached
4. Test with "Offline" checkbox first
5. Check for CORS issues

```javascript
// Check cached files
caches.open('genpwd-pro-v2.6.0').then(cache => {
  cache.keys().then(keys => console.log('Cached:', keys));
});
```

### Install Banner Not Showing

**Problem**: Install prompt doesn't appear

**Solutions**:
1. Check manifest.json valid
2. Verify all required icons present
3. Ensure HTTPS (production)
4. Check if already installed
5. Try different browser

**PWA Install Criteria**:
- Valid manifest
- HTTPS
- Service Worker registered
- Icons provided
- Not already installed
- User engagement (varies by browser)

### Updates Not Applying

**Problem**: New version not loading

**Solutions**:
1. Hard reload (Ctrl+Shift+R)
2. Clear cache manually
3. Unregister Service Worker
4. Clear browser data

```javascript
// Unregister Service Worker
navigator.serviceWorker.getRegistration().then(reg => {
  reg.unregister().then(() => location.reload());
});
```

## Best Practices

### Development

1. **Test Offline Early**: Don't wait until deployment
2. **Version Control**: Update CACHE_VERSION on changes
3. **Small Caches**: Only cache what's needed
4. **Error Handling**: Always have fallbacks
5. **Update Strategy**: Clear old caches on activate

### Production

1. **HTTPS Required**: PWA requires secure context
2. **CDN Caching**: Use separate versioning
3. **Monitor Performance**: Track cache hit rates
4. **User Communication**: Notify on updates
5. **Graceful Degradation**: Work without SW

### Security

1. **Content Security Policy**: Configure CSP for SW
2. **Scope Limitation**: Limit SW scope
3. **Cache Validation**: Validate cached data
4. **HTTPS Only**: Never deploy without HTTPS
5. **Regular Updates**: Keep SW version current

## Performance Optimization

### Cache Size Management

```javascript
// Limit cache size
const MAX_CACHE_SIZE = 50;

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxItems);
  }
}
```

### Lazy Loading

Cache resources on demand:

```javascript
// Cache on first request
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetched = fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then(cache => {
          cache.put(event.request, copy);
        });
        return response;
      });
      return cached || fetched;
    })
  );
});
```

## Future Enhancements

### Planned Features

- [ ] **Advanced Background Sync**: Sync passwords across devices
- [ ] **Push Notifications**: Security alerts and reminders
- [ ] **Periodic Background Sync**: Auto-update dictionaries
- [ ] **Share Target API**: Accept passwords from other apps
- [ ] **Web Share API**: Share generated passwords
- [ ] **Badging API**: Show unread notifications count
- [ ] **Shortcuts API**: More quick actions

### Experimental Features

- [ ] **File System Access API**: Save/load password files
- [ ] **Clipboard API**: Advanced copy functionality
- [ ] **Contact Picker API**: Import from contacts
- [ ] **Web Bluetooth**: Sync with hardware tokens

## Resources

### Documentation

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Cache API](https://developer.mozilla.org/en-US/docs/Web/API/Cache)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

### Tools

- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [PWABuilder](https://www.pwabuilder.com/)
- [Workbox](https://developers.google.com/web/tools/workbox)
- [Service Worker Toolbox](https://github.com/GoogleChrome/sw-toolbox)

### Testing

- [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools)
- [PWA Testing Guide](https://web.dev/pwa-checklist/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

## License

This PWA implementation is part of GenPwd Pro.

```
Copyright 2025 Julien Bombled

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```

## Support

For issues related to PWA functionality:
1. Check this documentation
2. Review browser console errors
3. Test in DevTools Application panel
4. Check [GitHub Issues](https://github.com/VBlackJack/genpwd-pro/issues)

---

**GenPwd Pro v2.6.0** - Progressive Web App Implementation
Sprint S2-3 - PWA avec support offline complet
