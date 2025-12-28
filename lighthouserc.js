/**
 * Lighthouse CI Configuration
 * Performance budgets and audit settings for GenPwd Pro
 */

module.exports = {
  ci: {
    collect: {
      // Static server for the built files
      staticDistDir: './src',
      url: ['http://localhost:8080/index.html'],
      numberOfRuns: 3,
      settings: {
        // Use desktop settings for password manager
        preset: 'desktop',
        // Skip network-dependent audits
        skipAudits: [
          'uses-http2',
          'uses-long-cache-ttl',
          'canonical'
        ]
      }
    },
    assert: {
      assertions: {
        // Performance budgets
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'categories:seo': 'off', // Not relevant for desktop app

        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 3000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 500 }],

        // Bundle size (warning if JavaScript is too large)
        'total-byte-weight': ['warn', { maxNumericValue: 500000 }], // 500KB
        'unminified-javascript': 'warn',
        'unused-javascript': 'warn',

        // Security
        'is-on-https': 'off', // Local app
        'csp-xss': 'warn',

        // Accessibility requirements
        'color-contrast': 'error',
        'heading-order': 'warn',
        'link-name': 'error',
        'button-name': 'error',
        'image-alt': 'error',
        'label': 'error',
        'tabindex': 'warn',
        'duplicate-id-aria': 'error',
        'aria-required-attr': 'error',
        'aria-valid-attr': 'error',
        'aria-valid-attr-value': 'error'
      }
    },
    upload: {
      // Upload to temporary public storage (for CI)
      target: 'temporary-public-storage'
    }
  }
};
