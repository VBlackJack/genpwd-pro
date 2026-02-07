# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GenPwd Pro is a multi-platform secure password manager and generator (v3.0.5). It ships as:
- **Web/PWA** — standalone `src/index.html` with ES6 modules
- **Electron desktop** — Windows/macOS/Linux (`electron-main.cjs` + `electron-preload.cjs`)
- **Browser extensions** — Chrome (Manifest V3) and Firefox (Manifest V2) under `extensions/`
- **CLI** — Node.js tool under `cli/` (Commander.js)
- **Android** — Kotlin native app under `android/` (Hilt DI, Room DB, Jetpack Compose)

## Common Commands

### Web / Desktop (from project root)

```bash
npm run dev              # Dev server on port 3000 (custom Node HTTP server)
npm run build            # Production build → dist/index.html (single-file bundle)
npm test                 # Run all tests (custom test runner, not Jest)
npm run test:fast        # Fast tests only (FAST_ONLY=1)
npm run test:slow        # Slow tests only (SLOW_ONLY=1)
npm run test:coverage    # Tests with c8 coverage (HTML + text + lcov)
npm run lint             # ESLint v9 flat config (src/**/*.js, tools/**/*.js)
npm run lint:circular    # Circular dependency detection via madge
npm run electron         # Launch Electron app
npm run electron:dev     # Launch Electron in dev mode
npm run electron:build:win  # Build Windows installer (NSIS + portable + ZIP)
```

### Android (from `android/` directory)

```bash
./gradlew assembleDebug              # Debug APK
./gradlew assembleRelease            # Release APK
./gradlew testDebugUnitTest          # Unit tests
./gradlew lint detekt ktlintCheck testDebugUnitTest --console=plain  # Full CI verification
./gradlew dependencyUpdates          # Check dependency versions
./gradlew --write-verification-metadata sha256  # Update dependency checksums
```

### CLI (from `cli/` directory)

```bash
npm test                 # Runs node --test test/*.test.js
```

## Architecture

### Core Generation Pipeline

The same password generation logic is shared across all platforms:

```
User Input → Validation → Core Generator → Optional HIBP Check → Result
```

Three generation modes: **syllables** (consonant/vowel alternation), **passphrase** (dictionary words), **leet** (character substitution). All use `crypto.getRandomValues()` for cryptographic randomness.

### Web Source Layout (`src/`)

- `js/core/` — Business logic: `generators.js`, `dictionaries.js`, `casing.js`
- `js/config/` — Constants (`constants.js`, `crypto-constants.js`, `ui-constants.js`, `entry-types.js`)
- `js/ui/` — MVC-like pattern: `dom.js` (selectors), `events.js` (orchestration), `render.js` (output), `modal.js`
- `js/services/` — `password-service.js`, `hibp-service.js`, `sync-service.js`, `import-export-service.js`
- `js/vault/` — Encrypted vault: `crypto-engine.js` (Tink AES-256-GCM), `kdf-service.js` (Scrypt), `models.js`, `in-memory-repository.js`
- `js/utils/` — Helpers, `i18n.js`, `logger.js`, `plugin-manager.js`, `pwa-manager.js`
- `locales/` — Translation files: `fr.json`, `en.json`, `es.json`
- `desktop/` — Electron-specific: vault crypto (Argon2, XChaCha20), Windows Hello auth, cloud sync

### Vault Crypto Stack

```
User Passphrase → Scrypt KDF (N=16384, r=8, p=1) → 256-bit Master Key → Tink AEAD (AES-256-GCM) → Encrypted Vault
```

Desktop vault adds Argon2 KDF and XChaCha20-Poly1305 as alternatives. Data lives in `in-memory-repository.js` at runtime (never persisted unencrypted). Session auto-locks after 5 min.

### Build System

The build (`tools/build.js`) bundles all JS modules and CSS into a single self-contained `dist/index.html` (works with `file://` protocol). Module load order is defined explicitly in the build script. No Webpack/Vite — plain concatenation with minification.

### Electron Architecture

- `electron-main.cjs` — Main process (CommonJS): window management, tray, global hotkeys
- `electron-preload.cjs` — Preload script: secure bridge (contextIsolation: true, sandbox: true)
- Renderer loads the web app. Node integration is disabled.

### Test Framework

Custom test runner in `tools/run_tests.cjs` (not Jest/Mocha). It stubs browser APIs (DOM, fetch, crypto, DOMPurify) for Node.js execution. Test files live in `src/tests/`. Uses seeded PRNG for deterministic tests.

## i18n

**Translation function:** `t('key')` or `i18n.t('key', params)` — custom singleton from `src/js/utils/i18n.js`.

**Key convention:** `<module>.<component>.<element>` (e.g., `auth.login.button.submit`, `errors.network.timeout`).

**Interpolation:** `{paramName}` syntax — e.g., `"app.loaded": "GenPwd Pro v{version} loaded"`.

**Locale files:** `src/locales/fr.json`, `en.json`, `es.json`. Default locale is French. Detection: localStorage (`genpwd_locale`) → `navigator.language` → `'fr'`.

**Extensions use:** Chrome's native `chrome.i18n.getMessage()` with `_locales/` directories. Firefox uses a custom wrapper.

**Desktop (Electron main process):** `src/desktop/utils/i18n-node.js`.

## Configuration & Constants

- **App constants:** `src/js/config/constants.js` — character sets, leet substitutions, dictionary config, fallback dictionary. All frozen with `Object.freeze()`.
- **Crypto params:** `src/js/config/crypto-constants.js` — PBKDF2 iterations, salt sizes, etc.
- **UI limits:** `src/js/config/ui-constants.js` — size thresholds, limits.
- **Settings/state:** `src/js/config/settings.js` — AppState with validation.
- **Environment:** `src/js/utils/environment.js` — platform detection.

## Plugin System

Event-based hooks architecture. Plugins are ES6 modules with hooks: `onGenerate`, `onExport`, `onImport`, `onUIRender`, `onPasswordValidate`, `onPasswordStrength`. Strict validation, 100KB max size, no `eval`/`new Function`.

## Android Specifics

- Package: `com.julien.genpwdpro`
- DI: Hilt + KSP
- DB: Room (encrypted via SQLCipher)
- Compose UI with Material3
- Min SDK 24, target SDK 34
- Dependency verification: strict mode via `gradle/verification-metadata.xml`
- Static analysis baselines in `config/lint-baseline.xml` and `config/detekt/detekt-baseline.xml` (temporary, to be shrunk)

## Code Style

- ES6+ modules for source, CommonJS for Electron main/preload and Node tools (`.cjs`)
- ESLint v9 flat config — `no-undef: error` is enforced across all file types
- Unused vars pattern: prefix with `_` to suppress warnings
- License header: Apache 2.0, Copyright Julien Bombled (required on all new files)
- All code, comments, and commit messages in English
- `.gpdb` is the vault file extension (GenPwd Pro Database)
