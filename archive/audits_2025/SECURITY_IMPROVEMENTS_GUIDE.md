# Security Improvements Implementation Guide

This document provides implementation guidance for security improvements identified during the code audit on 2025-11-05.

## M-001: CSP unsafe-inline Replacement

**Status**: Recommended for future sprint
**Priority**: Medium
**Effort**: Medium (2-3 hours)
**Risk**: Low

### Current State

The Content Security Policy currently allows `'unsafe-inline'` for styles:

```html
<!-- src/index.html -->
<meta http-equiv="Content-Security-Policy" content="
  style-src 'self' 'unsafe-inline';
">
```

```javascript
// tools/dev-server.js
res.setHeader('Content-Security-Policy',
  "style-src 'self' 'unsafe-inline'; "
);
```

### Recommended Solution: CSS Hash-based CSP

Use SHA-256 hashes instead of nonces for static inline styles. This approach is simpler than nonces for static content.

#### Step 1: Calculate Hashes

```bash
# Calculate SHA-256 hash of inline styles
cat << 'EOF' | openssl dgst -sha256 -binary | openssl base64
.test-modal { max-width: 800px; }
/* ... all inline styles ... */
EOF
# Output: sha256-HASH_VALUE_HERE
```

#### Step 2: Update CSP

```html
<!-- src/index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'sha256-HASH_VALUE_1' 'sha256-HASH_VALUE_2';
  img-src 'self' data:;
  ...
">
```

#### Step 3: Update dev-server.js

```javascript
// tools/dev-server.js
const STYLE_HASHES = [
  'sha256-HASH_VALUE_1',
  'sha256-HASH_VALUE_2'
];

res.setHeader('Content-Security-Policy',
  `style-src 'self' ${STYLE_HASHES.join(' ')};`
);
```

### Alternative: Extract Inline Styles to CSS File

**Benefits**: Cleaner CSP, better caching, easier maintenance

1. Move all inline `<style>` blocks to `src/styles/test-modal.css`
2. Add `<link rel="stylesheet" href="styles/test-modal.css">`
3. Remove `'unsafe-inline'` entirely from CSP

### Testing

After implementation, test with:

```bash
# Start dev server
npm run dev

# Open browser console - verify no CSP violations
# Should see no errors like "Refused to apply inline style"
```

---

## R-005: SBOM (Software Bill of Materials) Generation

**Status**: Recommended
**Priority**: Medium
**Effort**: Small (30 min)
**Quick Win**: ✅ Yes

### Generate SBOM with CycloneDX

```bash
# Install CycloneDX globally
npm install -g @cyclonedx/cyclonedx-npm

# Generate SBOM in JSON format
cd /path/to/genpwd-pro
cyclonedx-npm --output-file sbom.json

# Generate SBOM in XML format (alternative)
cyclonedx-npm --output-format XML --output-file sbom.xml
```

### Add to .gitignore

```bash
# .gitignore
sbom.json
sbom.xml
```

### Automate in CI/CD

Add to `.github/workflows/sbom-generation.yml`:

```yaml
name: SBOM Generation

on:
  release:
    types: [published]
  push:
    branches:
      - main

jobs:
  generate-sbom:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        env:
          PUPPETEER_SKIP_DOWNLOAD: 'true'
        run: npm ci

      - name: Install CycloneDX
        run: npm install -g @cyclonedx/cyclonedx-npm

      - name: Generate SBOM
        run: cyclonedx-npm --output-file sbom-${{ github.sha }}.json

      - name: Upload SBOM as artifact
        uses: actions/upload-artifact@v3
        with:
          name: sbom
          path: sbom-*.json

      - name: Attach SBOM to release
        if: github.event_name == 'release'
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ github.event.release.upload_url }}
          asset_path: ./sbom-${{ github.sha }}.json
          asset_name: sbom.json
          asset_content_type: application/json
```

### Verify SBOM

```bash
# View SBOM content
cat sbom.json | jq '.components[] | {name, version, purl}'

# Count total components
cat sbom.json | jq '.components | length'
```

### SBOM Best Practices

1. **Regenerate on every release** - Ensure SBOM matches deployed version
2. **Store with release artifacts** - Attach to GitHub releases
3. **Scan SBOM for vulnerabilities** - Use tools like Dependency-Track
4. **Include in security documentation** - Reference in SECURITY.md

---

## Additional Security Hardening (Future)

### 1. Subresource Integrity (SRI)

If CDN resources are added in the future:

```html
<link rel="stylesheet"
      href="https://cdn.example.com/style.css"
      integrity="sha384-HASH_HERE"
      crossorigin="anonymous">
```

### 2. Security Headers

Add these headers to production server:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### 3. Android Security Hardening

See `SECURITY_AUDIT_REPORT_2025-11-04.md` for R-007 (Biometric storage refactoring).

---

**Last Updated**: 2025-11-05
**Next Review**: Sprint N+1
