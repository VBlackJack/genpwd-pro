# SDK 35 Dry-Run Report

_Date:_ 2025-10-29  
_Environment:_ Containerized CI image without Android SDK packages

## Goal
Evaluate raising `compileSdk` and `targetSdk` to API 35 (Android 14 QPR2) for the `app` module.

## Summary
The dry-run could not be fully executed inside the provided container because the Android SDK is
absent (`ANDROID_HOME` / `sdk.dir`). Without the platform JARs the Gradle sync step fails before the
project can be compiled or linted.

## Recommended Steps (to execute on a workstation with the SDK)
1. Update `android/app/build.gradle.kts`:
   ```kotlin
   android {
       compileSdk = 35
       defaultConfig {
           targetSdk = 35
       }
   }
   ```
2. Ensure Android Gradle Plugin 8.1.2 and Kotlin 1.9.23 remain compatible (both already satisfy API 35).
3. Run the compatibility suite:
   ```bash
   ./gradlew :app:lint :app:detekt :app:assembleDebug
   ```
4. If lint reports new warnings related to API 35 behavior changes, address them or suppress with
   documented justification.

## Blockers Observed in Container
- `./gradlew :app:testDebugUnitTest` fails with `SDK location not found` because
  `/workspace/genpwd-pro/android/local.properties` is missing and no `ANDROID_HOME` is defined.
- The same error prevents running lint/detekt/assemble locally in this environment.

## Next Actions
- Re-run the steps above on a developer workstation or CI agent where the Android SDK (API 35
  platforms, build-tools 35.x) is installed.
- Capture the resulting reports (lint XML/HTML, detekt SARIF, assemble APK) and attach them to the
  upgrade pull request.

Once the suite completes successfully, the diff in step 1 can be merged into `main` together with
any lint-driven fixes.
