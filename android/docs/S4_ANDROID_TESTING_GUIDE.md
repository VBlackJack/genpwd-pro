# Sprint S4: Android Testing & Release Guide

**Status**: Ready for Testing
**Version**: 1.2.0-alpha.34 → 1.2.0-RC1
**Target**: Google Play Store (Closed Testing)

## 🎯 Overview

This guide provides step-by-step instructions for testing, building, and publishing the GenPwd Pro Android app to the Google Play Store.

## ⚙️ Prerequisites

### Required Software
- **Android Studio**: Hedgehog (2023.1.1) or later
- **JDK**: OpenJDK 17 or later
- **Gradle**: 8.7+ (included in wrapper)
- **Android SDK**: API 24-34
- **Emulator** (optional): Android 7.0+ for instrumented tests
- **Physical Device** (recommended): Android 7.0+ and Android 14+

### Required Files
- **Keystore**: Release signing keystore (create if not exists)
- **keystore.properties**: Release signing configuration
- **Google Play Console**: Developer account ($25 one-time fee)

---

## 📋 Phase 1: Unit Testing

### Step 1.1: Run Unit Tests

```bash
cd android
./gradlew test --console=plain
```

**Expected Output**:
```
> Task :app:testDebugUnitTest

BUILD SUCCESSFUL in 45s
67 actionable tasks: 67 executed
```

### Step 1.2: Review Test Results

```bash
# Open test report in browser
open app/build/reports/tests/testDebugUnitTest/index.html

# Or view in terminal
cat app/build/reports/tests/testDebugUnitTest/index.html
```

### Step 1.3: Fix Test Failures

If tests fail:

1. **Check test logs**:
   ```bash
   cat app/build/test-results/testDebugUnitTest/*.xml
   ```

2. **Common issues**:
   - **Argon2 native library**: Mock in tests (already handled)
   - **Room database**: Use in-memory database
   - **Coroutines**: Use `runTest` and `TestDispatcher`

3. **Re-run specific test**:
   ```bash
   ./gradlew test --tests "com.julien.genpwdpro.PasswordGeneratorTest"
   ```

### Step 1.4: Test Coverage (Optional)

```bash
./gradlew testDebugUnitTestCoverage
open app/build/reports/coverage/test/debug/index.html
```

**Target Coverage**: >70%

---

## 🤖 Phase 2: Instrumented Testing (Optional)

### Step 2.1: Start Emulator

```bash
# List available emulators
emulator -list-avds

# Start specific emulator
emulator -avd Pixel_7_API_34 &
```

Or use Android Studio's Device Manager.

### Step 2.2: Run Instrumented Tests

```bash
./gradlew connectedAndroidTest --console=plain
```

**Expected Output**:
```
> Task :app:connectedDebugAndroidTest

BUILD SUCCESSFUL in 3m 12s
```

### Step 2.3: Review Test Results

```bash
open app/build/reports/androidTests/connected/index.html
```

### Step 2.4: Test Key Flows Manually

On emulator or physical device:

1. **Generate Password**:
   - ✅ Syllables mode (length 12-32)
   - ✅ Passphrase mode (4-8 words)
   - ✅ Leet mode
   - ✅ Copy to clipboard

2. **Vault System**:
   - ✅ Create vault
   - ✅ Add passwords
   - ✅ Search/filter
   - ✅ Edit/delete
   - ✅ Export to JSON/CSV

3. **Security**:
   - ✅ App lock (PIN/Pattern/Biometric)
   - ✅ Auto-lock (30s timeout)
   - ✅ Vault encryption

4. **Cloud Sync** (if configured):
   - ✅ OAuth2 login
   - ✅ Upload vault
   - ✅ Download vault
   - ✅ Conflict resolution

5. **Import/Export**:
   - ✅ Import 1Password CSV
   - ✅ Import LastPass CSV
   - ✅ Import KeePass KDBX
   - ✅ Export JSON

---

## 🚀 Phase 3: Performance Testing

### Step 3.1: Startup Time Profiling

```bash
# Install debug build
./gradlew installDebug

# Measure cold start
adb shell am start -W -n com.julien.genpwdpro/.MainActivity
```

**Expected Output**:
```
TotalTime: 1850  # <2000ms ✅
```

### Step 3.2: Password Generation Benchmark

Create `app/src/androidTest/java/com/julien/genpwdpro/PasswordGeneratorBenchmark.kt`:

```kotlin
@Test
fun benchmarkPasswordGeneration() {
    val startTime = System.nanoTime()
    repeat(1000) {
        passwordGenerator.generateSyllables(16)
    }
    val endTime = System.nanoTime()
    val avgTime = (endTime - startTime) / 1000 / 1000 // μs
    println("Average: $avgTime μs")
    assertTrue(avgTime < 100) // <100μs per generation
}
```

**Target**: <100μs per generation

### Step 3.3: Memory Profiling

```bash
# Start Memory Profiler in Android Studio
# Tools > Profile > app > Memory

# Or use adb
adb shell dumpsys meminfo com.julien.genpwdpro
```

**Target**: <150MB total memory

### Step 3.4: Battery Drain Testing

```bash
# Install and use for 1 hour
./gradlew installRelease
adb shell dumpsys batterystats --reset

# Use app for 1 hour (generate passwords, manage vaults)

# Check battery usage
adb shell dumpsys batterystats | grep "com.julien.genpwdpro"
```

**Target**: <2% battery drain per hour

---

## 🔑 Phase 4: Release Build Preparation

### Step 4.1: Create Release Keystore (First Time Only)

```bash
cd android
keytool -genkey -v \
  -keystore genpwd-pro-release.keystore \
  -alias genpwd-pro \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "YOUR_STRONG_PASSWORD" \
  -keypass "YOUR_STRONG_PASSWORD"
```

**Important**:
- ⚠️ **BACKUP THIS FILE** - Store in secure location (password manager, encrypted drive)
- ⚠️ **NEVER COMMIT TO GIT** - Already in `.gitignore`
- ⚠️ If lost, you cannot update the app on Play Store

### Step 4.2: Create keystore.properties

```bash
cat > android/keystore.properties <<EOF
storeFile=genpwd-pro-release.keystore
storePassword=YOUR_STRONG_PASSWORD
keyAlias=genpwd-pro
keyPassword=YOUR_STRONG_PASSWORD
EOF
```

**Important**: Never commit this file to git!

### Step 4.3: Update Version Code/Name

Edit `android/app/build.gradle.kts`:

```kotlin
defaultConfig {
    versionCode = 36 // Increment for each release
    versionName = "1.2.0-RC1" // Update semantic version
}
```

### Step 4.4: Build Signed AAB

```bash
cd android
./gradlew bundleRelease --console=plain
```

**Expected Output**:
```
> Task :app:bundleRelease

BUILD SUCCESSFUL in 2m 15s
```

**Output File**:
```
android/app/build/outputs/bundle/release/genpwd-pro-v1.2.0-RC1-release.aab
```

### Step 4.5: Verify AAB

```bash
# Check file exists and size
ls -lh app/build/outputs/bundle/release/*.aab

# Expected: 15-25 MB

# Verify signature
jarsigner -verify -verbose -certs app/build/outputs/bundle/release/*.aab
```

**Expected Output**:
```
jar verified.
```

### Step 4.6: Test AAB Locally with bundletool

```bash
# Download bundletool (if not already)
wget https://github.com/google/bundletool/releases/download/1.15.6/bundletool-all-1.15.6.jar

# Generate APKs from AAB
java -jar bundletool-all-1.15.6.jar build-apks \
  --bundle=app/build/outputs/bundle/release/*.aab \
  --output=app.apks \
  --mode=universal

# Extract and install
unzip app.apks -d apks/
adb install apks/universal.apk

# Test the installed app manually
```

---

## 📦 Phase 5: Play Store Submission

### Step 5.1: Create Google Play Console Account

1. Go to [play.google.com/console](https://play.google.com/console)
2. Pay $25 one-time registration fee
3. Complete identity verification (2-3 days)

### Step 5.2: Create New App

1. **Click**: "Create app"
2. **App name**: GenPwd Pro
3. **Default language**: English (US)
4. **Type**: App
5. **Free or paid**: Free
6. **Declarations**: Accept all

### Step 5.3: Store Listing

**Main details**:
- **App name**: GenPwd Pro
- **Short description** (80 chars):
  ```
  Secure offline password generator with syllables, passphrases & vault storage
  ```
- **Full description** (4000 chars):
  ```
  GenPwd Pro - Professional Offline Password Generator

  Generate strong, memorable passwords without internet connection. Your security, your control.

  🔐 GENERATION MODES
  • Syllables: Pronounceable passwords (ex: "TakLabMurPix12")
  • Passphrase: Diceware-style phrases (ex: "correct-horse-battery-staple")
  • Leet Mode: Replace letters with numbers (ex: "P@ssw0rd")
  • Customizable length, complexity, and special characters

  🗄️ VAULT SYSTEM
  • Encrypted password storage (AES-256-GCM + Argon2id)
  • Organize with categories and tags
  • Search and filter passwords
  • Import from 1Password, LastPass, KeePass
  • Export to JSON, CSV, KDBX

  🔒 SECURITY FEATURES
  • 100% offline - no data collection, no internet required
  • App lock: PIN, Pattern, Fingerprint, Face ID
  • Auto-lock after 30 seconds
  • Secure clipboard (auto-clear after 30s)
  • Zero-knowledge encryption

  ☁️ CLOUD SYNC (OPTIONAL)
  • End-to-end encrypted sync to Google Drive, Dropbox, OneDrive
  • OAuth2 authentication
  • Conflict resolution
  • Auto-sync on changes

  📱 FEATURES
  • Password strength meter
  • Entropy calculator
  • Breach checker (offline database)
  • TOTP 2FA generator
  • Password history
  • Dark mode

  🌐 OPEN SOURCE
  • MIT License
  • Auditable code: github.com/VBlackJack/genpwd-pro
  • Community-driven
  • No tracking, no ads, no subscriptions

  ⚡ PRIVACY-FIRST
  • No internet permission required (except for optional cloud sync)
  • No analytics or telemetry
  • No data collection
  • All processing on-device

  Perfect for security professionals, privacy advocates, and anyone who values their digital security.

  ---
  Support: github.com/VBlackJack/genpwd-pro/issues
  ```

**App icon**: 512x512 px (see assets/ folder)

**Screenshots**: 2-8 images (1080x1920 px)
- Screenshot 1: Home screen with password generation
- Screenshot 2: Vault list
- Screenshot 3: Password details
- Screenshot 4: Settings
- Screenshot 5: Cloud sync setup
- Screenshot 6: Import/Export

**Feature graphic**: 1024x500 px (see assets/ folder)

### Step 5.4: Data Safety

**Data collection**: NO
- No data collected or shared
- All processing on-device
- Optional cloud sync: user-initiated, encrypted end-to-end

**Security practices**:
- ✅ Data encrypted in transit (HTTPS for cloud sync)
- ✅ Data encrypted at rest (AES-256-GCM + Argon2id)
- ✅ Users can request data deletion (delete vault)

### Step 5.5: Content Rating

Complete IARC questionnaire:
- **Category**: Utilities/Productivity
- **Violence**: None
- **Sexuality**: None
- **Language**: None
- **Controlled Substances**: None
- **Gambling**: None

**Expected Rating**: Everyone

### Step 5.6: App Access

**All features available without restrictions**: Yes

### Step 5.7: Ads

**Contains ads**: No

### Step 5.8: Target Audience

**Age group**: 18+

### Step 5.9: Upload AAB

1. Go to **Production** → **Create new release**
2. Choose **Closed testing** first
3. Upload `genpwd-pro-v1.2.0-RC1-release.aab`
4. **Release name**: "1.2.0-RC1 - Initial Closed Testing"
5. **Release notes**:
   ```
   🎉 GenPwd Pro 1.2.0 - Release Candidate 1

   NEW FEATURES:
   ✅ Syllables password generator
   ✅ Passphrase generator (Diceware)
   ✅ Encrypted vault system
   ✅ Cloud sync (Google Drive, Dropbox, OneDrive)
   ✅ Import/Export (1Password, LastPass, KeePass)
   ✅ TOTP 2FA generator
   ✅ Biometric app lock

   SECURITY:
   🔐 AES-256-GCM encryption
   🔐 Argon2id key derivation
   🔐 100% offline (no internet required)
   🔐 Open source (MIT License)

   Please report bugs: github.com/VBlackJack/genpwd-pro/issues
   ```

### Step 5.10: Create Testers List

1. Go to **Testing** → **Closed testing** → **Testers**
2. **Create email list**: "GenPwd Pro Beta Testers"
3. Add 10-100 email addresses
4. **Copy opt-in URL** and share with testers

### Step 5.11: Submit for Review

1. **Review release**: Check all fields
2. **Click**: "Start rollout to Closed testing"
3. **Wait**: 1-3 days for review

**Expected Timeline**:
- Day 1: Submission
- Day 2-3: Automated review
- Day 3-5: Manual review (if flagged)
- Day 5-7: Published to Closed testing

---

## ✅ Phase 6: Post-Publication Checklist

### Step 6.1: Verify Installation

```bash
# Testers should see app in Play Store Console URL
# Example: https://play.google.com/apps/internaltest/...
```

### Step 6.2: Monitor Crashes

1. Go to **Quality** → **Crashes & ANRs**
2. Check crash-free users rate (target: >99%)
3. Fix critical crashes immediately

### Step 6.3: Collect Feedback

1. Create Google Form: "GenPwd Pro Beta Feedback"
2. Questions:
   - What features did you use?
   - Did you encounter any bugs?
   - How is the performance (speed, battery)?
   - What would you improve?
   - Would you recommend to a friend? (NPS score)

### Step 6.4: Iterate

1. **Week 1**: Collect feedback from 10+ testers
2. **Week 2**: Fix critical bugs, release v1.2.1-RC2
3. **Week 3**: Final testing, prepare for Production release
4. **Week 4**: Promote to Production (Open Beta or Full Launch)

---

## 🐛 Common Issues & Solutions

### Issue 1: Tests Fail - "Argon2 native library not available"

**Solution**: Mock Argon2 in tests:

```kotlin
// app/src/test/java/.../MockArgon2.kt
@Before
fun setup() {
    mockkStatic("com.goterl.lazysodium.LazySodiumAndroid")
    every { LazySodiumAndroid.cryptoPwhashStr(...) } returns "mocked_hash"
}
```

### Issue 2: Build Fails - "Duplicate class found"

**Solution**: Exclude duplicate dependencies in `build.gradle.kts`:

```kotlin
configurations.all {
    exclude(group = "org.json", module = "json")
}
```

### Issue 3: AAB Signature Verification Failed

**Solution**: Ensure keystore.properties is correct:

```bash
# Verify keystore
keytool -list -v -keystore genpwd-pro-release.keystore

# Re-build clean
./gradlew clean bundleRelease
```

### Issue 4: Play Console Rejects AAB - "64-bit requirement"

**Solution**: Add native lib support in `build.gradle.kts`:

```kotlin
ndk {
    abiFilters += listOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64")
}
```

### Issue 5: App Size Too Large (>150MB)

**Solution**: Enable R8 obfuscation and resource shrinking:

```kotlin
buildTypes {
    release {
        isMinifyEnabled = true
        isShrinkResources = true
    }
}
```

---

## 📊 Success Metrics

### Testing Phase
- ✅ All unit tests pass (0 failures)
- ✅ Instrumented tests pass (0 failures)
- ✅ Code coverage >70%
- ✅ Startup time <2s
- ✅ Password generation <100ms
- ✅ Memory usage <150MB
- ✅ Battery drain <2%/hour

### Publication Phase
- ✅ AAB signed and verified
- ✅ App uploaded to Play Store
- ✅ Closed testing approved by Google
- ✅ 50+ beta testers recruited
- ✅ Crash-free rate >99%
- ✅ Average rating >4.0/5.0

### Production Phase (Sprint S5)
- ✅ Promoted to Production
- ✅ 1000+ downloads in first week
- ✅ Featured in "New & Updated" (if selected by Google)
- ✅ Average rating >4.5/5.0
- ✅ <1% uninstall rate

---

## 🔗 Useful Resources

- **Android Developers**: https://developer.android.com/studio/publish
- **Play Console Help**: https://support.google.com/googleplay/android-developer
- **bundletool**: https://developer.android.com/studio/command-line/bundletool
- **App Signing**: https://developer.android.com/studio/publish/app-signing
- **Release Checklist**: https://developer.android.com/distribute/best-practices/launch/launch-checklist

---

## 🎯 Next Steps

After successful Closed Testing:

1. **Sprint S5**: Promote to Open Beta (10,000+ testers)
2. **Sprint S6**: Full Production launch
3. **Sprint S7**: Marketing & growth (Product Hunt, Reddit, Twitter)
4. **Sprint S8**: Premium features (Passkey support, Hardware key support)

---

**Last Updated**: 2025-11-15
**Author**: GenPwd Pro Team
**License**: MIT
