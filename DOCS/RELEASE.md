# GenPwd Pro - Release Process

Complete guide for preparing and publishing a Release Candidate on the Google Play Store.

## Table of Contents

- [Quick Checklist](#quick-checklist)
- [Pre-Release](#pre-release)
- [Testing and Validation](#testing-and-validation)
- [Performance Optimization](#performance-optimization)
- [Play Store Compliance](#play-store-compliance)
- [Build and Signing](#build-and-signing)
- [Publication](#publication)
- [Post-Release](#post-release)
- [Final Checklist](#final-checklist)

---

## Quick Checklist

Use this checklist before pushing a production build to ensure the vault remains trustworthy
and compliant.

- [ ] **Version bump** -- Update `versionCode` and `versionName` in `android/app/build.gradle.kts`.
- [ ] **CI green** -- Ensure the latest pipeline passed `lint`, `ktlintCheck`, `detekt`, `test`, and `connectedCheck`.
- [ ] **R8 shrink** -- Verify release builds run with R8 enabled and archive the generated `mapping.txt` in secure storage.
- [ ] **Manual smoke tests** -- Validate Autofill flows, biometric lock/unlock and invalidation, task switcher/Recents redaction, and `FLAG_SECURE` enforcement.
- [ ] **Privacy compliance** -- Confirm the Play Console Privacy Policy link and Data safety form are up to date with shipped features.
- [ ] **Play signing and upload** -- Double-check signing configs, upload key access, and release notes for the Play Console rollout.
- [ ] **No critical/high bugs** -- All CRITICAL and HIGH issues resolved; MEDIUM/LOW documented.
- [ ] **Documentation current** -- CHANGELOG, README, and technical docs reflect this release.
- [ ] **Dependencies audited** -- No known vulnerabilities; all dependencies up to date.

---

## Pre-Release

### 1. Bugs and Issues

- [ ] Triage all bugs in GitHub Issues
- [ ] Fix all CRITICAL bugs
- [ ] Fix all HIGH priority bugs
- [ ] Document MEDIUM/LOW bugs (if deferral is necessary)

**Commands:**

```bash
# List critical issues
gh issue list --label "critical,bug" --state open

# List high priority issues
gh issue list --label "high,bug" --state open
```

### 2. Feature Completeness

- [x] Password generation (5 modes)
- [x] Vault management (CRUD)
- [x] AES-256-GCM encryption
- [x] Cloud synchronization (5 providers)
- [x] Import/Export (JSON, CSV, TXT, KeePass)
- [x] Biometric authentication
- [x] Android Widget
- [x] Autofill Service
- [x] OTP/2FA
- [x] Password health analysis
- [x] Themes and languages (FR, EN, ES)

### 3. Documentation

- [ ] README.md up to date
- [ ] CHANGELOG.md with all changes
- [ ] Technical docs (ARCHITECTURE.md, etc.)
- [ ] User guide (USER_GUIDE.md)
- [ ] OAuth API documentation (OAUTH_SETUP.md)

### 4. Dependencies

- [ ] Update all dependencies
- [ ] Check for vulnerabilities (Dependabot)
- [ ] Test compatibility after updates

**Commands:**

```bash
cd android

# Check for outdated dependencies
./gradlew dependencyUpdates

# Update manually in build.gradle.kts
# Test after each update
```

---

## Testing and Validation

### 1. Unit Tests

```bash
cd android

# Run all unit tests
./gradlew test

# Check results
# Target: 100% pass rate (0 failures)
```

**Target:** 0 tests failed

Report location: `app/build/reports/tests/testDebugUnitTest/index.html`

### 2. Integration Tests

```bash
# Start an emulator or connect a physical device
adb devices

# Run instrumented tests
./gradlew connectedAndroidTest

# Check results
# Target: 100% pass rate
```

**Target:** 0 tests failed

Report location: `app/build/reports/androidTests/connected/index.html`

### 3. Critical Manual Tests

- [ ] **Password generation:**
  - [ ] Syllables (20 characters, 2 digits, 2 special)
  - [ ] Passphrase (5 words, FR/EN/ES)
  - [ ] Leet Speak
  - [ ] Custom Phrase
  - [ ] PIN

- [ ] **Vaults:**
  - [ ] Create a vault
  - [ ] Open an existing vault
  - [ ] Change the master password
  - [ ] Delete a vault
  - [ ] Lock/Unlock

- [ ] **Synchronization:**
  - [ ] Google Drive (OAuth, upload, download)
  - [ ] Dropbox (OAuth, upload, download)
  - [ ] OneDrive (OAuth, upload, download)
  - [ ] WebDAV (Basic auth, upload, download)
  - [ ] Conflict resolution

- [ ] **Import/Export:**
  - [ ] Export JSON
  - [ ] Export CSV
  - [ ] Export TXT
  - [ ] Import JSON
  - [ ] Import CSV
  - [ ] Import KeePass XML

- [ ] **Security:**
  - [ ] Biometrics (fingerprint, face)
  - [ ] Auto-lock (30s, 1min, 5min)
  - [ ] Clipboard clear (30s)
  - [ ] Vault encryption (AES-256-GCM)

- [ ] **UI/UX:**
  - [ ] Smooth navigation
  - [ ] Smooth animations (no lag)
  - [ ] Themes (Dark, Light, Auto)
  - [ ] Languages (FR, EN, ES)

### 4. Performance Tests

| Metric | Target | How to measure |
|---|---|---|
| Cold start | < 2 seconds | `adb logcat -c && adb logcat \| grep "Displayed com.julien.genpwdpro"` or Android Studio CPU Profiler |
| Password generation (20 chars) | < 100 ms | Inline `System.currentTimeMillis()` around `generateSyllables(config)` |
| UI rendering | 60 FPS | `adb shell setprop debug.hwui.profile visual_bars` or Layout Inspector |

```kotlin
// Example: measure password generation
val start = System.currentTimeMillis()
val password = generateSyllables(config)
val duration = System.currentTimeMillis() - start
Log.d("PERF", "Generation took ${duration}ms")
```

Key optimizations: lazy loading of non-critical modules, background dictionary preloading,
R8 code shrinking, efficient `SecureRandom`, pre-computed character sets, Jetpack Compose
with `remember`/`LazyColumn` to avoid unnecessary recompositions.

---

## Performance Optimization

### 1. Code Shrinking and Obfuscation

Already configured in `app/build.gradle.kts`:

```kotlin
buildTypes {
    release {
        isMinifyEnabled = true
        isShrinkResources = true
        proguardFiles(
            getDefaultProguardFile("proguard-android-optimize.txt"),
            "proguard-rules.pro"
        )
    }
}
```

### 2. R8 Optimization

R8 is used automatically (replaces ProGuard).

**Verification:**

```bash
# Build in release mode
./gradlew assembleRelease

# Check APK size
ls -lh app/build/outputs/apk/release/

# Target: < 15 MB
```

### 3. Baseline Profiles

Already configured: `app/src/main/baseline-prof.txt`

Enables approximately 30% faster startup.

### 4. Network Optimization

- [ ] Use OkHttp with caching
- [ ] GZIP compression for uploads
- [ ] Retry with exponential backoff
- [ ] Timeouts configured (30s read, 10s connect)

---

## Play Store Compliance

### 1. Permissions

Verify that all permissions are **necessary and justified**:

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.CAMERA" />
```

**Justifications:**
- `INTERNET`: Cloud synchronization
- `ACCESS_NETWORK_STATE`: Detect connectivity before sync
- `VIBRATE`: Haptic feedback
- `USE_BIOMETRIC`: Fingerprint/face authentication
- `CAMERA`: Scan QR codes for OTP

### 2. Data Safety Form

Fill out on Play Console:

- **Data collected:** None
- **Data shared:** None
- **Encryption in transit:** Yes (HTTPS)
- **Deletion option:** Yes (delete local account)

### 3. Target API Level

- **Target SDK:** 34 (Android 14)
- **Requirement:** Google requires API 33+ for new apps

### 4. 64-bit Support

Already configured (Kotlin/JVM compiles to 64-bit).

### 5. App Bundle (AAB)

**Recommended by Google** (over APK).

Advantages:
- Reduced size (Google generates device-optimized APKs)
- Dynamic delivery

### 6. Content Rating

Use the IARC questionnaire on Play Console.

**Expected category:** E (Everyone) -- No sensitive content

### 7. Privacy Policy

**Required** if the app collects data.

**For GenPwd Pro:** No collection -- Simple privacy policy:

```
GenPwd Pro does not collect any personal data.
All data is stored locally on your device.
Cloud synchronization uses end-to-end encryption.
```

Host on: GitHub Pages, website, or Play Console.

---

## Build and Signing

### 1. Create a Keystore

**Important:** Never lose this keystore! Back it up in a secure location (1Password, Bitwarden,
etc.). Save the `.keystore` file, keystore password, key password, and alias (`genpwd-pro`).

```bash
keytool -genkey -v -keystore genpwd-pro-release.keystore \
  -alias genpwd-pro \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Fill in the prompts:
# Password: (choose a strong password)
# First and Last Name: Julien Bombled
# Organizational Unit: GenPwd Pro
# Organization: GenPwd
# City / State / Country Code: (your location, e.g. FR)
```

### 2. Configure Signing

Create `android/keystore.properties` (DO NOT commit to git!):

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=genpwd-pro
storeFile=../genpwd-pro-release.keystore
```

Add to `.gitignore`:

```
keystore.properties
*.keystore
*.jks
```

Modify `app/build.gradle.kts`:

```kotlin
android {
    signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            if (keystorePropertiesFile.exists()) {
                val keystoreProperties = Properties()
                keystoreProperties.load(FileInputStream(keystorePropertiesFile))

                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
            // ...
        }
    }
}
```

### 3. Build AAB Release

```bash
cd android

# Clean
./gradlew clean

# Build signed AAB
./gradlew bundleRelease

# Verify
ls -lh app/build/outputs/bundle/release/
# -> app-release.aab
```

**Expected size:** 10-20 MB (AAB)

### 4. Test the AAB Locally

```bash
# Install bundletool
wget https://github.com/google/bundletool/releases/download/1.15.6/bundletool-all-1.15.6.jar

# Generate an APK from the AAB
java -jar bundletool-all-1.15.6.jar build-apks \
  --bundle=app/build/outputs/bundle/release/app-release.aab \
  --output=app-release.apks \
  --mode=universal

# Extract the APK
unzip app-release.apks -d apks/

# Install
adb install apks/universal.apk

# Test manually
```

---

## Publication

### 1. Play Console Setup

1. Visit [Google Play Console](https://play.google.com/console) and pay the one-time 25 USD fee.
2. Fill in the developer profile.
3. **All apps** -> **Create app**: name "GenPwd Pro", type App, Free.

### 2. Prepare the Store Listing

#### Screenshots and Graphics

| Asset | Size | Notes |
|---|---|---|
| Phone screenshots | 1080x1920 or 1440x2560 px | 2-8 required |
| 7" tablet screenshots | (optional) | 2-8 if provided |
| 10" tablet screenshots | (optional) | 2-8 if provided |
| App icon | 512x512 px, PNG 32-bit | Required |
| Feature graphic | 1024x500 px, JPG/PNG 24-bit | Required |

Tools: Android Studio screenshot, Figma mockups, Fastlane Frameit for device frames.

#### Text

**Short title** (max 30 characters):
```
GenPwd Pro
```

**Short description** (max 80 characters):
```
Secure password generator with end-to-end encrypted cloud sync
```

**Full description** (max 4000 characters):
```
GenPwd Pro - Secure Password Generator

GenPwd Pro is an open source, secure, and powerful password generator with
end-to-end encrypted cloud synchronization.

KEY FEATURES

Password Generation -- 5 modes (Syllables, Passphrase, Leet Speak, Custom Phrase, PIN),
up to 140 bits of entropy, full configuration, real-time strength analysis.

Enterprise-Grade Security -- AES-256-GCM encryption, Argon2id key derivation
(GPU-resistant), biometric authentication, configurable auto-lock, automatic clipboard clear.

End-to-End Cloud Sync -- Google Drive, Dropbox, OneDrive, WebDAV. Zero-knowledge
encryption, automatic conflict resolution, cross-platform (Android, Web, iOS coming soon).

Unlimited Vaults -- Multiple vaults (Personal, Work, Family), export to JSON/CSV/TXT,
import from KeePass/CSV, encrypted backup.

Advanced Features -- OTP/2FA, password health analysis, Android Widget, Autofill Service,
password history, custom presets.

Modern Interface -- Material 3 Design, Dark/Light/Auto themes, multilingual (FR, EN, ES),
smooth animations.

Open Source and No Telemetry -- Auditable code on GitHub, no data collection, no tracking,
Apache License 2.0. Free, no ads, no usage limits.

LINKS
- GitHub: https://github.com/VBlackJack/genpwd-pro
- Docs: https://github.com/VBlackJack/genpwd-pro/tree/main/docs
- Support: https://github.com/VBlackJack/genpwd-pro/issues
```

### 3. Choose the Testing Track

| Track | Audience | Use case |
|---|---|---|
| Internal testing | Max 100 testers (emails) | Team QA |
| Closed testing | Max 100 testers (list or link) | RC / beta |
| Open testing | Public (any user can join) | Public beta |
| Production | All users | General availability |

**Recommendation for RC:** Closed testing

### 4. Upload AAB

1. **Production** -> **Releases** -> **Closed testing**
2. **Create new release**
3. **Upload** -> Select `app-release.aab`
4. **Release name:** `1.3.0-rc.1 (37)`
5. **Release notes:**

```
Version 1.3.0 Release Candidate 1

New Features
- Cross-platform cloud sync (Google Drive, Dropbox, OneDrive, WebDAV)
- KeePass XML import
- Improved password health analysis
- Custom theme support

Improvements
- 30% faster password generation
- Startup time reduced to < 2s
- Polished UI/UX

Bug Fixes
- Fixed clipboard clear bug
- Fixed crash on Android 7.0
- Improved sync stability

Thank you for testing -- please report bugs on GitHub!
```

6. **Review release** -> **Start rollout to Closed testing**

### 5. Invite Testers and Submit

1. **Testers** -> **Closed testing** -> **Create email list**, add emails, share the opt-in link.
2. Verify all fields (Store Listing, Content Rating, etc.).
3. **Publishing overview** -> **Send for review** (timeline: 1-3 business days).

---

## Post-Release

### 1. Monitoring

**Play Console:**
- Crashes and ANRs (Application Not Responding)
- User reviews and ratings
- Installation statistics
- Device compatibility

**Firebase Crashlytics** (optional):
- Real-time crash reporting
- Stack traces

### 2. Feedback

- Read all user reviews
- Respond quickly to reported bugs
- Create GitHub issues for bugs found in reviews

### 3. Hotfix Process

If a critical bug is discovered:

1. Fix the bug
2. Increment `versionCode` (e.g. 37 -> 38)
3. Rebuild the AAB
4. Upload to Play Console
5. Release immediately (emergency rollout)

### 4. Promotion

- Share on Reddit (r/Android, r/opensource)
- Share on Hacker News
- Announce on Twitter/X
- Create a Medium/dev.to post

---

## Final Checklist

Before submission, verify every item:

- [ ] All tests pass (unit + integration)
- [ ] Performance validated (startup < 2s, generation < 100ms, 60 FPS rendering)
- [ ] No CRITICAL or HIGH bugs remaining
- [ ] Documentation is complete and current
- [ ] Quality screenshots prepared
- [ ] Play Store description written
- [ ] Signed AAB generated
- [ ] Tested on multiple devices (Android 7.0+ through 14)
- [ ] Keystore backed up in a secure location
- [ ] Data Safety form completed
- [ ] Content Rating obtained via IARC
- [ ] Privacy Policy published and linked
- [ ] R8 `mapping.txt` archived for crash deobfuscation
- [ ] Autofill, biometric, and FLAG_SECURE flows smoke-tested
- [ ] Release notes finalized
