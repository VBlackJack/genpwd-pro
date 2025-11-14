# CI/CD Pipeline Documentation - GenPwd Pro

## Overview

GenPwd Pro uses GitHub Actions for Continuous Integration and Continuous Deployment (CI/CD) to ensure code quality, run automated tests, and validate builds across multiple environments.

## Workflows

### 1. Web CI/CD (`web-ci.yml`)

**Purpose:** Test and validate web application code

**Triggers:**
- Push to `main` branch
- Push to any `claude/**` branch
- Pull requests to `main`
- Daily at 2 AM UTC (scheduled)
- Manual dispatch

**Jobs:**

#### Lint Job
- **Runs on:** Ubuntu Latest
- **Node version:** 20
- **Steps:**
  1. Checkout code
  2. Setup Node.js with npm cache
  3. Install dependencies
  4. Run ESLint

**Exit criteria:** Zero linting errors

#### Test Job (Matrix)
- **Runs on:** Ubuntu Latest
- **Node versions:** 18, 20, 22 (matrix strategy)
- **Steps:**
  1. Checkout code
  2. Setup Node.js with npm cache
  3. Install dependencies
  4. Run unit tests (`npm test`)
  5. Run coverage tests (`npm run test:coverage`)
  6. Upload coverage to Codecov (Node 20 only)
  7. Upload coverage artifacts

**Exit criteria:** All tests pass on all Node versions

#### Browser Test Job
- **Runs on:** Ubuntu Latest
- **Browser:** Chromium (via Playwright)
- **Steps:**
  1. Checkout code
  2. Setup Node.js
  3. Install dependencies
  4. Install Playwright with Chromium
  5. Run browser tests
  6. Upload test results on failure

**Exit criteria:** Browser tests pass

#### Build Job
- **Runs on:** Ubuntu Latest
- **Depends on:** Lint, Test jobs
- **Steps:**
  1. Checkout code
  2. Setup Node.js
  3. Install dependencies
  4. Build production bundle
  5. Upload build artifacts

**Exit criteria:** Production build succeeds

#### Security Job
- **Runs on:** Ubuntu Latest
- **Steps:**
  1. Checkout code
  2. Run npm audit
  3. Check for vulnerabilities
  4. Upload audit results

**Exit criteria:** No critical vulnerabilities (moderate+ allowed)

#### Status Check Job
- **Runs on:** Ubuntu Latest
- **Depends on:** All previous jobs
- **Purpose:** Final validation that all checks passed

### 2. Android CI (`android-ci.yml`)

**Purpose:** Build and test Android application

**Triggers:**
- Push to `main`, `develop`, `android/**` branches
- Pull requests to `main` or `develop`

**Jobs:**
- Gradle build
- Lint checks
- Detekt static analysis
- Unit tests

### 3. Security Scan (`security-scan.yml`)

**Purpose:** Daily security scanning

**Triggers:**
- Daily at 00:00 UTC
- Push to `main` branch (paths: `package*.json`, `build.gradle*`)

**Scans:**
- npm audit
- Semgrep SAST
- Gitleaks secret detection

### 4. SBOM Generation (`sbom-generation.yml`)

**Purpose:** Generate Software Bill of Materials

**Triggers:**
- Push to `main` branch

**Outputs:**
- CycloneDX SBOM (JSON format)

## Configuration

### Node.js Versions

The project supports and tests on:
- **Node.js 18.x** - Minimum supported version
- **Node.js 20.x** - Recommended version (LTS)
- **Node.js 22.x** - Latest version

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PUPPETEER_SKIP_DOWNLOAD` | Skip Puppeteer Chromium download | `true` (in CI) |
| `NODE_ENV` | Environment mode | `test` |
| `CI` | Indicates CI environment | `true` |

### Caching Strategy

```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'  # Caches node_modules based on package-lock.json
```

**Benefits:**
- Faster dependency installation
- Reduced network usage
- Consistent dependency versions

## Artifacts

### Coverage Reports

**Retention:** 7 days
**Format:** HTML + LCOV
**Upload condition:** Node.js 20 only

```yaml
- name: Upload coverage artifacts
  uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: coverage/
```

**Accessing:**
1. Go to Actions tab
2. Click on workflow run
3. Scroll to "Artifacts" section
4. Download `coverage-report.zip`

### Build Artifacts

**Retention:** 3 days
**Format:** Production build files
**Location:** `dist/` directory

### Security Audit

**Retention:** 30 days
**Format:** JSON
**Content:** npm audit results

## Status Badges

Add these badges to README.md:

```markdown
![Web CI](https://github.com/VBlackJack/genpwd-pro/workflows/Web%20CI%2FCD/badge.svg)
![Security](https://github.com/VBlackJack/genpwd-pro/workflows/Security%20Scan/badge.svg)
![Coverage](https://codecov.io/gh/VBlackJack/genpwd-pro/branch/main/graph/badge.svg)
```

## Coverage Reporting

### Codecov Integration

Coverage reports are automatically uploaded to Codecov for:
- Pull requests
- Main branch pushes
- Scheduled runs

**Configuration:**
- Token: Stored in GitHub Secrets (optional for public repos)
- Threshold: 95% (configured in `.c8rc.json`)
- Format: LCOV

### Coverage Thresholds

```json
{
  "lines": 95,
  "statements": 95,
  "functions": 90,
  "branches": 85
}
```

**Behavior:**
- ✅ Coverage ≥ threshold → Job succeeds
- ❌ Coverage < threshold → Job fails

## Troubleshooting

### Common Issues

#### 1. Dependency Installation Fails

**Symptom:**
```
npm ERR! code ECONNRESET
```

**Solution:**
```yaml
- name: Install dependencies (with retry)
  uses: nick-fields/retry@v2
  with:
    timeout_minutes: 10
    max_attempts: 3
    command: npm ci
```

#### 2. Tests Timeout

**Symptom:**
```
Error: Test timed out after 2000ms
```

**Solution:**
Increase timeout in `package.json`:
```json
{
  "testConfig": {
    "timeout": 60000
  }
}
```

#### 3. Coverage Upload Fails

**Symptom:**
```
Error: Unable to upload coverage to Codecov
```

**Solution:**
- Check Codecov token in GitHub Secrets
- Verify LCOV file exists: `coverage/lcov.info`
- Set `fail_ci_if_error: false` (non-blocking)

#### 4. Build Artifacts Missing

**Symptom:**
```
Error: Unable to find dist/ directory
```

**Solution:**
```bash
# Verify build script in package.json
npm run build

# Check if dist/ is in .gitignore but not .artifactignore
cat .gitignore
```

## Best Practices

### 1. Fail Fast Strategy

```yaml
strategy:
  fail-fast: false  # Don't cancel other matrix jobs on first failure
```

**Benefit:** See all Node version results even if one fails

### 2. Conditional Jobs

```yaml
- name: Upload coverage
  if: matrix.node-version == 20  # Only on Node 20
```

**Benefit:** Avoid duplicate uploads

### 3. Artifact Retention

```yaml
- uses: actions/upload-artifact@v4
  with:
    retention-days: 7  # Auto-delete after 7 days
```

**Benefit:** Reduces storage costs

### 4. Caching Dependencies

```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

**Benefit:** 2-3x faster dependency installation

## Local Testing

Test CI configuration locally using **act**:

```bash
# Install act (GitHub Actions local runner)
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run all jobs
act

# Run specific job
act -j test

# Run specific event
act pull_request
```

## Monitoring

### GitHub Actions Dashboard

**URL:** `https://github.com/VBlackJack/genpwd-pro/actions`

**Metrics to monitor:**
- ✅ Success rate per workflow
- ⏱️ Average execution time
- 📦 Artifact storage usage
- 🔄 Cache hit rate

### Alerts

Configure GitHub notifications:
1. Go to repository Settings
2. Navigate to Notifications
3. Enable "Actions" notifications
4. Choose notification channels (email, Slack, etc.)

## Security

### Secrets Management

**Required secrets:**
- `CODECOV_TOKEN` (optional for public repos)

**Adding secrets:**
1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add name and value

**Best practices:**
- ✅ Use GitHub Secrets for sensitive data
- ✅ Rotate tokens regularly
- ✅ Limit secret scope to required workflows
- ❌ Never hardcode secrets in workflow files
- ❌ Never log secret values

### Permissions

Workflow permissions (`.github/workflows/*.yml`):

```yaml
permissions:
  contents: read
  checks: write
  pull-requests: write
```

**Principle of least privilege:** Grant only necessary permissions

## Performance Optimization

### Current Performance

| Job | Average Duration |
|-----|------------------|
| Lint | ~1 min |
| Test (per matrix) | ~2 min |
| Browser Test | ~3 min |
| Build | ~2 min |
| Total | ~8 min |

### Optimization Tips

1. **Use npm ci instead of npm install**
   - Faster (2-3x)
   - More reliable
   - Enforces package-lock.json

2. **Enable caching**
   - npm cache (node_modules)
   - Build cache (dist/)

3. **Parallelize jobs**
   - Matrix strategy for multi-version tests
   - Independent jobs run concurrently

4. **Skip unnecessary steps**
   ```yaml
   - name: Skip on docs-only changes
     if: "!contains(github.event.head_commit.message, '[docs only]')"
   ```

## Deployment

### Automatic Deployment (Future)

**Planned workflows:**

1. **Deploy to GitHub Pages**
   - Trigger: Push to `main`
   - Deploy: `dist/` to `gh-pages` branch

2. **Deploy to Netlify**
   - Trigger: Push to `main`
   - Deploy: Production build

3. **Release Creation**
   - Trigger: Git tag `v*`
   - Create: GitHub Release with artifacts

## Resources

### Documentation
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Codecov Docs](https://docs.codecov.com/)
- [Playwright CI](https://playwright.dev/docs/ci)

### Tools
- [act](https://github.com/nektos/act) - Run GitHub Actions locally
- [actionlint](https://github.com/rhysd/actionlint) - Workflow linter

---

**Last Updated:** 2025-11-14
**Version:** 2.6.0
**Pipeline Status:** ✅ Operational
