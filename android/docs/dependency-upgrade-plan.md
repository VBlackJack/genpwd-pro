# Dependency Upgrade Plan

This plan summarizes the current dependency status collected from `./gradlew dependencyUpdates` and outlines a staged approach to upgrading the Android stack while preparing for `compileSdkVersion`/`targetSdkVersion` 35.

## Current snapshot

* Dependency verification is enabled (strict mode) using `gradle/verification-metadata.xml`.
* The versions plugin report (`build/reports/dependencyUpdates/report.txt`) could not determine the latest releases for most AndroidX/Google libraries because the build environment lacks network access to Google's Maven repositories. Only the Kotlin compiler/tooling artifacts (now pinned to 1.9.23) and Detekt CLI (1.23.4) were confirmed as up to date.
* Lint and Detekt baselines are checked into `config/` to enable incremental cleanup without blocking CI.

## Upgrade strategy

### Stage 1 – Infrastructure & tooling

1. Restore full repository access during CI runs so the versions plugin can query `https://dl.google.com/dl/android/maven2` and `https://repo1.maven.org/maven2`.
2. Update Gradle Wrapper to the latest 8.x release compatible with AGP 8.3+.
3. Bump Android Gradle Plugin (AGP) to 8.3.x and Kotlin to 1.9.24+. Regenerate `gradle/verification-metadata.xml` after the upgrade and rerun `./gradlew lint detekt ktlintCheck testDebugUnitTest` to confirm stability.
4. Upgrade Detekt (1.23.5+) and ktlint (0.50+) to align with the latest rules, updating baselines accordingly.

### Stage 2 – AndroidX & Google libraries

1. Update Compose BOM to the latest stable (currently 2024.xx) and align the compiler extension version recommended for Kotlin 1.9.24.
2. Upgrade Hilt (Dagger 2.50+), KSP, and lifecycle libraries together to maintain compatibility.
3. Refresh CameraX, ML Kit barcode scanning, and WorkManager to their latest stable releases, verifying ProGuard/R8 rules.
4. Review security-sensitive dependencies (SQLCipher, Tink/crypto, OkHttp, Retrofit) for security patches.

### Stage 3 – Platform targeting

1. Raise `compileSdk` and `targetSdk` to 35 after dependency upgrades are verified.
2. Audit manifest and runtime permission flows for new Android 14 requirements (e.g., data safety, foreground service types, `SCHEDULE_EXACT_ALARM` reviews if applicable).
3. Run the Android Compatibility Test Suite (CTS lite) or internal smoke tests on API 35 emulator/physical devices.

### Stage 4 – Cleanup & quality gates

1. Remove lint/detekt baseline entries as underlying issues are resolved.
2. Expand coverage with instrumentation tests for clipboard and widget flows introduced in this release.
3. Document the new baseline removal schedule in `CONTRIBUTING.md` and ensure the security review in `SECURITY.md` reflects upgraded components.

## Next actions

* Rerun the versions report once network access is available and attach the generated HTML/text to future PRs.
* Track the upgrade tasks via tickets per stage to avoid large, risky changes.
* Ensure CI caches (Gradle, Android SDK) remain valid after major version bumps.
