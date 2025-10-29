# Release Readiness Checklist

Use this checklist before pushing a production build to ensure the vault remains trustworthy and compliant.

- [ ] **Version bump** — Update `versionCode` and `versionName` in `android/app/build.gradle.kts`.
- [ ] **CI green** — Ensure the latest pipeline passed `lint`, `ktlintCheck`, `detekt`, `test`, and `connectedCheck`.
- [ ] **R8 shrink** — Verify release builds run with R8 enabled and archive the generated `mapping.txt` in secure storage.
- [ ] **Manual smoke tests** — Validate Autofill flows, biometric lock/unlock and invalidation, task switcher/Recents redaction, and `FLAG_SECURE` enforcement.
- [ ] **Privacy compliance** — Confirm the Play Console Privacy Policy link and Data safety form are up to date with shipped features.
- [ ] **Play signing & upload** — Double-check signing configs, upload key access, and release notes for the Play Console rollout.
