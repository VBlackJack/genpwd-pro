# Performance Optimization Guide - GenPwd Pro

## Overview

This document tracks performance optimization efforts for GenPwd Pro v2.6.0, focusing on Core Web Vitals and achieving Lighthouse scores ≥95 across all categories.

## Performance Goals

### Target Metrics (Sprint S1-2)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **Lighthouse Performance** | ≥95 | TBD | 📋 To measure |
| **Lighthouse Accessibility** | ≥95 | TBD | 📋 To measure |
| **Lighthouse Best Practices** | ≥95 | TBD | 📋 To measure |
| **Lighthouse SEO** | ≥95 | TBD | 📋 To measure |
| **LCP (Largest Contentful Paint)** | <2.5s | TBD | 📋 To measure |
| **FID (First Input Delay)** | <100ms | TBD | 📋 To measure |
| **CLS (Cumulative Layout Shift)** | <0.1 | TBD | 📋 To measure |
| **TTI (Time to Interactive)** | <3.8s | TBD | 📋 To measure |
| **FCP (First Contentful Paint)** | <1.8s | TBD | 📋 To measure |

## Core Web Vitals

### What are Core Web Vitals?

Core Web Vitals are a set of metrics that measure real-world user experience:

1. **LCP (Largest Contentful Paint)** - Loading performance
   - Measures how long it takes for the largest content element to render
   - **Good:** <2.5s | **Needs Improvement:** 2.5-4s | **Poor:** >4s

2. **FID (First Input Delay)** - Interactivity
   - Measures time from first user interaction to browser response
   - **Good:** <100ms | **Needs Improvement:** 100-300ms | **Poor:** >300ms

3. **CLS (Cumulative Layout Shift)** - Visual stability
   - Measures unexpected layout shifts during page load
   - **Good:** <0.1 | **Needs Improvement:** 0.1-0.25 | **Poor:** >0.25

## Optimization Strategies

### 1. JavaScript Optimization

#### Current Architecture
```javascript
// src/index.html loads all modules
<script type="module" src="js/app.js"></script>
```

**Issues to address:**
- All modules loaded upfront (no code splitting)
- Large dictionary files loaded synchronously
- No tree-shaking optimization

#### Planned Optimizations

**A. Lazy Loading Dictionaries**
```javascript
// Before: Eager loading
import frenchDict from '../dictionaries/french.json';

// After: Lazy loading
async function loadDictionary(locale) {
  const dict = await import(`../dictionaries/${locale}.json`);
  return dict.default;
}
```

**Benefits:**
- Reduces initial bundle size by ~50KB (compressed)
- Faster initial load time
- Dictionaries loaded only when needed

**B. Code Splitting**
```javascript
// Split large features into separate chunks
const loadVaultUI = () => import('./ui/features-ui.js');
const loadThemeManager = () => import('./utils/theme-manager.js');
const loadAnalytics = () => import('./utils/analytics.js');
```

**Benefits:**
- Smaller initial bundle
- Faster TTI (Time to Interactive)
- Better caching granularity

**C. Tree Shaking**
```javascript
// Ensure all imports are ES6 modules
// Remove unused exports
export { usedFunction }; // Only export what's needed
```

### 2. Asset Optimization

#### Images

**Current state:**
- No optimized image formats (WebP, AVIF)
- No responsive images
- No lazy loading for images

**Optimizations:**

```html
<!-- Before -->
<img src="logo.png" alt="GenPwd Pro">

<!-- After -->
<picture>
  <source srcset="logo.avif" type="image/avif">
  <source srcset="logo.webp" type="image/webp">
  <img src="logo.png" alt="GenPwd Pro" loading="lazy" width="200" height="50">
</picture>
```

**Tools:**
- `sharp` - Node.js image processing
- `imagemin` - Image compression
- Online: [Squoosh](https://squoosh.app/)

#### CSS Optimization

**Current state:**
- Multiple CSS files
- No critical CSS inlining
- No CSS minification

**Optimizations:**

```html
<!-- Inline critical CSS -->
<style>
  /* Critical above-the-fold styles */
  .password-display { /* ... */ }
  .generate-btn { /* ... */ }
</style>

<!-- Load non-critical CSS async -->
<link rel="preload" href="styles/themes.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="styles/themes.css"></noscript>
```

### 3. Resource Loading

#### Current Loading Strategy
```html
<!-- Blocking resources -->
<link rel="stylesheet" href="styles/main.css">
<script type="module" src="js/app.js"></script>
```

#### Optimized Loading Strategy

**A. Preconnect to External Resources**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="dns-prefetch" href="https://analytics.example.com">
```

**B. Preload Critical Resources**
```html
<link rel="preload" href="js/app.js" as="script">
<link rel="preload" href="fonts/main.woff2" as="font" type="font/woff2" crossorigin>
```

**C. Defer Non-Critical JavaScript**
```html
<script src="analytics.js" defer></script>
<script src="features.js" defer></script>
```

### 4. Caching Strategy

#### Service Worker Implementation

**Plan: Implement service worker for offline support and caching**

```javascript
// sw.js - Service Worker
const CACHE_VERSION = 'v2.6.0';
const STATIC_CACHE = `genpwd-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `genpwd-dynamic-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/js/app.js',
  '/styles/main.css',
  // Add other critical assets
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        return caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(event.request, fetchResponse.clone());
          return fetchResponse;
        });
      });
    })
  );
});
```

**Benefits:**
- Offline functionality
- Faster repeat visits
- Reduced server load

#### HTTP Caching Headers

```nginx
# nginx configuration example
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

location ~* \.(html)$ {
  expires 1h;
  add_header Cache-Control "public, must-revalidate";
}
```

### 5. Bundle Size Reduction

#### Current Bundle Size (Estimated)

| File | Size (uncompressed) | Size (gzipped) |
|------|---------------------|----------------|
| app.js | ~250KB | ~70KB |
| dictionaries/*.json | ~150KB | ~40KB |
| styles/*.css | ~50KB | ~12KB |
| **Total** | **~450KB** | **~122KB** |

#### Optimization Targets

| Category | Target Reduction | Strategy |
|----------|------------------|----------|
| JavaScript | -40% | Code splitting, tree shaking |
| Dictionaries | -50% | Lazy loading, compression |
| CSS | -30% | Minification, critical CSS |

#### Tools

**Build Tools:**
```bash
# Install build optimization tools
npm install --save-dev terser clean-css-cli

# Minify JavaScript
npx terser src/js/app.js -o dist/js/app.min.js -c -m

# Minify CSS
npx cleancss -o dist/styles/main.min.css src/styles/main.css
```

**Bundle Analyzer:**
```bash
# Analyze bundle size
npm install --save-dev webpack-bundle-analyzer

# Generate report
npm run build -- --analyze
```

## Measurement Tools

### 1. Lighthouse (Chrome DevTools)

**Running Lighthouse:**
```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit (local server)
lighthouse http://localhost:8000 --output html --output-path ./reports/lighthouse.html

# Run audit with specific categories
lighthouse http://localhost:8000 --only-categories=performance,accessibility --output json
```

**Lighthouse CI (Automated):**
```yaml
# .github/workflows/lighthouse-ci.yml
- name: Run Lighthouse CI
  uses: treosh/lighthouse-ci-action@v9
  with:
    urls: |
      http://localhost:8000
    uploadArtifacts: true
```

### 2. Web Vitals Library

**Installation:**
```html
<script type="module">
  import {onCLS, onFID, onLCP} from 'https://unpkg.com/web-vitals@3?module';

  function sendToAnalytics({name, value, id}) {
    console.log(name, value, id);
    // Send to analytics service
  }

  onCLS(sendToAnalytics);
  onFID(sendToAnalytics);
  onLCP(sendToAnalytics);
</script>
```

### 3. Chrome User Experience Report (CrUX)

**Check real-world metrics:**
```bash
# PageSpeed Insights API
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=YOUR_URL&strategy=mobile"
```

## Implementation Checklist

### Phase 1: Quick Wins (Week 1)
- [ ] Minify JavaScript and CSS in production
- [ ] Compress images (WebP/AVIF)
- [ ] Add resource hints (preconnect, dns-prefetch)
- [ ] Defer non-critical JavaScript
- [ ] Enable gzip/brotli compression
- [ ] Lazy load images below the fold

### Phase 2: Code Optimization (Week 1-2)
- [ ] Implement dictionary lazy loading
- [ ] Add code splitting for large features
- [ ] Tree-shake unused code
- [ ] Optimize third-party scripts
- [ ] Reduce JavaScript execution time

### Phase 3: Advanced (Week 2)
- [ ] Implement service worker
- [ ] Add critical CSS inlining
- [ ] Optimize font loading (FOIT/FOUT)
- [ ] Implement resource preloading
- [ ] Add performance monitoring

## Monitoring

### Real User Monitoring (RUM)

**Integration with Analytics:**
```javascript
// src/js/utils/performance.js
export function trackWebVitals() {
  if ('web-vitals' in window) {
    const {getCLS, getFID, getLCP} = window['web-vitals'];

    getCLS(metric => sendToAnalytics('CLS', metric.value));
    getFID(metric => sendToAnalytics('FID', metric.value));
    getLCP(metric => sendToAnalytics('LCP', metric.value));
  }
}

function sendToAnalytics(metricName, value) {
  // Send to Google Analytics, Plausible, etc.
  if (window.gtag) {
    gtag('event', metricName, {
      value: Math.round(value),
      metric_id: metricName,
      metric_value: value,
      metric_delta: value,
    });
  }
}
```

### Performance Budget

**Set performance budgets:**
```json
{
  "budgets": [
    {
      "resourceSizes": [
        { "resourceType": "script", "budget": 200 },
        { "resourceType": "stylesheet", "budget": 50 },
        { "resourceType": "image", "budget": 300 },
        { "resourceType": "font", "budget": 100 }
      ],
      "timings": [
        { "metric": "interactive", "budget": 3800 },
        { "metric": "first-contentful-paint", "budget": 1800 },
        { "metric": "largest-contentful-paint", "budget": 2500 }
      ]
    }
  ]
}
```

## Best Practices

### 1. Avoid Layout Shifts

```css
/* Reserve space for dynamic content */
.password-result {
  min-height: 60px; /* Prevent layout shift when password appears */
}

/* Use aspect-ratio for images */
img {
  aspect-ratio: 16 / 9;
  width: 100%;
  height: auto;
}
```

### 2. Optimize JavaScript Execution

```javascript
// Use requestIdleCallback for non-critical tasks
function initAnalytics() {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      // Load analytics after critical rendering
      import('./utils/analytics.js');
    });
  } else {
    setTimeout(() => import('./utils/analytics.js'), 1000);
  }
}
```

### 3. Reduce Main Thread Blocking

```javascript
// Break up long tasks
function processLargeDataset(data) {
  const chunkSize = 100;
  let index = 0;

  function processChunk() {
    const end = Math.min(index + chunkSize, data.length);

    for (let i = index; i < end; i++) {
      // Process data[i]
    }

    index = end;

    if (index < data.length) {
      requestIdleCallback(processChunk);
    }
  }

  processChunk();
}
```

## Results Tracking

### Before Optimization (Baseline)

| Metric | Value | Target | Gap |
|--------|-------|--------|-----|
| Lighthouse Performance | TBD | 95 | TBD |
| LCP | TBD | <2.5s | TBD |
| FID | TBD | <100ms | TBD |
| CLS | TBD | <0.1 | TBD |
| Bundle Size | ~122KB (gzipped) | <100KB | -22KB |

### After Optimization (Target)

| Metric | Value | Status |
|--------|-------|--------|
| Lighthouse Performance | ≥95 | 🎯 Target |
| LCP | <2.5s | 🎯 Target |
| FID | <100ms | 🎯 Target |
| CLS | <0.1 | 🎯 Target |
| Bundle Size | <100KB (gzipped) | 🎯 Target |

## Resources

### Tools
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [WebPageTest](https://www.webpagetest.org/)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- [web-vitals library](https://github.com/GoogleChrome/web-vitals)

### Documentation
- [Web Vitals](https://web.dev/vitals/)
- [Optimize LCP](https://web.dev/optimize-lcp/)
- [Optimize FID](https://web.dev/optimize-fid/)
- [Optimize CLS](https://web.dev/optimize-cls/)
- [Performance Budget](https://web.dev/performance-budgets-101/)

---

**Last Updated:** 2025-11-14
**Status:** 📋 Planning Phase
**Next Review:** After Phase 1 implementation
