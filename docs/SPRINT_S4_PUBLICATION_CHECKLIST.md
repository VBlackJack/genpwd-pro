# Sprint S4: Multi-Platform Publication Checklist

**Goal**: Publish GenPwd Pro on all major platforms
**Timeline**: 1-2 weeks
**Status**: 🚧 In Progress

---

## 📦 Pre-Publication (Prerequisites)

### Documentation
- ✅ Privacy Policy created (`docs/PRIVACY_POLICY.md`)
- ✅ Beta Testing Guide created (`docs/BETA_TESTING.md`)
- ✅ Android Testing Guide created (`android/docs/S4_ANDROID_TESTING_GUIDE.md`)
- ✅ Browser Extension Guide created (`docs/BROWSER_EXTENSION_PUBLICATION.md`)
- ✅ CLI Publication Guide created (`cli/PUBLISH.md`)

### Assets Needed
- ⏳ App icons (all sizes: 16x16, 32x32, 48x48, 96x96, 128x128, 512x512)
- ⏳ Screenshots (Android, Chrome, Firefox)
- ⏳ Feature graphics (1024x500 px for Play Store)
- ⏳ Promotional images (optional but recommended)

### Code Preparation
- ✅ CLI implementation complete
- ✅ Web onboarding implemented
- ✅ Android onboarding screens created
- ✅ Browser extensions (Chrome & Firefox) complete
- ⏳ All unit tests passing (Android requires online build)

---

## 🤖 Android Publication

### Pre-Submission
- [ ] Run all tests: `cd android && ./gradlew test`
- [ ] Fix any test failures
- [ ] Performance profiling: startup < 2s, generation < 100ms
- [ ] Create release keystore (if not exists)
- [ ] Configure `keystore.properties`
- [ ] Update version in `app/build.gradle.kts`: versionCode = 36, versionName = "1.2.0-RC1"

### Build
- [ ] Build signed AAB: `./gradlew bundleRelease`
- [ ] Verify AAB exists: `app/build/outputs/bundle/release/genpwd-pro-v1.2.0-RC1-release.aab`
- [ ] Test AAB with bundletool
- [ ] File size check: should be 15-25 MB

### Play Store Setup
- [ ] Create Google Play Developer account ($25 USD)
- [ ] Create new app: "GenPwd Pro"
- [ ] Fill store listing (see `android/docs/S4_ANDROID_TESTING_GUIDE.md`)
- [ ] Upload app icon (512x512 px)
- [ ] Upload screenshots (2-8 images, 1080x1920 px)
- [ ] Upload feature graphic (1024x500 px)
- [ ] Complete Data Safety form (no data collection)
- [ ] Get Content Rating (IARC questionnaire)

### Submission
- [ ] Upload AAB to **Closed Testing** track
- [ ] Create tester email list (10-100 emails)
- [ ] Write release notes (see guide for template)
- [ ] Submit for review
- [ ] Wait for approval (1-3 days)
- [ ] Share opt-in link with testers

**Timeline**: 3-7 days total

---

## 🌐 Chrome Extension Publication

### Pre-Submission
- [ ] Create icons directory: `mkdir -p extensions/chrome/icons`
- [ ] Add icons: icon16.png, icon32.png, icon48.png, icon128.png
- [ ] Test extension locally (chrome://extensions/ → Load unpacked)
- [ ] Test all features: popup, auto-fill, context menu, storage

### Package
- [ ] Run packaging script: `cd extensions && ./package-extensions.sh`
- [ ] Verify ZIP: `genpwd-pro-chrome-v1.0.0.zip`
- [ ] Check ZIP contents (no .git, no node_modules)

### Chrome Web Store Setup
- [ ] Register as Chrome Web Store Developer ($5 USD one-time)
- [ ] Create new item
- [ ] Upload ZIP file
- [ ] Fill store listing:
  - Product name: "GenPwd Pro - Secure Password Generator"
  - Summary (132 chars)
  - Full description (see `docs/BROWSER_EXTENSION_PUBLICATION.md`)
  - Category: Productivity
  - Upload icon (128x128 px)
  - Upload screenshots (1280x800 px, 3-5 images)
  - Privacy policy URL: https://vblackjack.github.io/genpwd-pro/privacy.html

### Submission
- [ ] Submit for review
- [ ] Wait for approval (1-3 days average, up to 7 days)
- [ ] Monitor review status
- [ ] Publish once approved

**Timeline**: 2-5 days total

---

## 🦊 Firefox Extension Publication

### Pre-Submission
- [ ] Create icons directory: `mkdir -p extensions/firefox/icons`
- [ ] Add icons: icon48.png, icon96.png
- [ ] Test extension locally (about:debugging → Load Temporary Add-on)
- [ ] OR test with web-ext: `cd extensions/firefox && npx web-ext run`

### Package
- [ ] Run packaging script: `cd extensions && ./package-extensions.sh`
- [ ] Verify ZIP: `genpwd-pro-firefox-v1.0.0.zip`
- [ ] Check ZIP contents

### Firefox Add-ons (AMO) Setup
- [ ] Register on addons.mozilla.org/developers (FREE!)
- [ ] Submit new add-on
- [ ] Upload ZIP file
- [ ] Wait for automated validation (instant)
- [ ] Fill add-on details:
  - Name: "GenPwd Pro - Secure Password Generator"
  - Summary (250 chars)
  - Description (see guide)
  - Categories: Security & Privacy, Productivity
  - Upload screenshots (3-5 images)
  - Privacy policy URL

### Submission
- [ ] Submit for review
- [ ] Wait for validation (1-3 days, usually faster than Chrome)
- [ ] Monitor review status
- [ ] Publish once approved

**Timeline**: 1-3 days total

---

## 📦 npm (CLI) Publication

### Pre-Submission
- [ ] Test CLI locally: `cd cli && node bin/genpwd.js --help`
- [ ] Test all commands:
  - `node bin/genpwd.js syllables -l 20 --entropy`
  - `node bin/genpwd.js passphrase -w 6 -c -n`
  - `node bin/genpwd.js leet -t "Test" -l 2`
  - `node bin/genpwd.js entropy -p "TestPassword123"`
- [ ] Run lint: `npm run lint`
- [ ] Run tests: `npm test` (if configured)
- [ ] Test installation locally: `npm link`

### npm Setup
- [ ] Create npm account (npmjs.com, FREE!)
- [ ] Login: `npm login`
- [ ] Verify package name is available: `npm view @genpwd-pro/cli`

### Package & Publish
- [ ] Update version in `package.json` (if needed)
- [ ] Create tarball: `npm pack`
- [ ] Inspect tarball: `tar -tzf genpwd-pro-cli-1.0.0.tgz`
- [ ] Publish: `npm publish --access public`
- [ ] Verify on npmjs.com: https://www.npmjs.com/package/@genpwd-pro/cli
- [ ] Test installation: `npm install -g @genpwd-pro/cli && genpwd --version`

### OR Use Automation Script
- [ ] Run: `cd cli && ./scripts/publish.sh patch`

**Timeline**: < 1 day (instant if automated)

---

## 🌐 Privacy Policy & Website

### Privacy Policy
- [ ] Host `docs/PRIVACY_POLICY.md` publicly:
  - **Option 1**: GitHub Pages (https://vblackjack.github.io/genpwd-pro/privacy.html)
  - **Option 2**: Custom domain (https://genpwd-pro.app/privacy)
  - **Option 3**: Convert to HTML and host anywhere

### GitHub Pages Setup (if using Option 1)
- [ ] Go to repository Settings → Pages
- [ ] Source: Deploy from branch `main` or `gh-pages`
- [ ] Set custom domain (optional)
- [ ] Add `index.html` to root or `/docs` with link to privacy policy

**Timeline**: < 1 hour

---

## 👥 Beta Tester Recruitment

### Recruitment Channels

**Reddit**:
- [ ] Post on r/Android (if Android ready)
- [ ] Post on r/opensource
- [ ] Post on r/privacy
- [ ] Post on r/passwordmanagers

**Twitter/X**:
- [ ] Tweet beta announcement with link to signup form

**GitHub**:
- [ ] Pin issue: "🎉 Beta Testing Program is OPEN!"
- [ ] Update README with beta signup link

**Discord/Slack** (if applicable):
- [ ] Create beta testing channel
- [ ] Announce beta program

### Beta Signup Form
- [ ] Create Google Form or Typeform:
  - Name/alias
  - Email
  - Platform(s) to test
  - Device info
  - Background (developer, security pro, casual user)
  - Testing frequency (daily, weekly, monthly)
- [ ] Share form link in recruitment posts

### Target Metrics
- [ ] 50+ signups in Week 1
- [ ] 100+ signups in Month 1
- [ ] 10+ active testers (submitting regular feedback)

**Timeline**: Ongoing (1-4 weeks)

---

## 📊 Post-Publication Monitoring

### Week 1 After Each Platform Launch

**Android**:
- [ ] Monitor Play Console for:
  - Crash reports (target: <1% crash rate)
  - ANRs (Application Not Responding)
  - User reviews and ratings
- [ ] Respond to reviews (especially negative ones)
- [ ] Check downloads (target: 50+ in Week 1)

**Chrome Extension**:
- [ ] Monitor Chrome Web Store:
  - User reviews and ratings
  - Installation count (target: 50+ in Week 1)
  - Uninstall rate (target: <5%)
- [ ] Check Developer Dashboard for errors

**Firefox Extension**:
- [ ] Monitor AMO:
  - User reviews and ratings
  - Download count (target: 50+ in Week 1)
- [ ] Check for any validation issues

**npm CLI**:
- [ ] Monitor npmjs.com:
  - Download count (target: 50+ in Week 1)
  - GitHub issues for CLI-specific bugs
- [ ] Check npm audit for security vulnerabilities

### Ongoing (Monthly)

- [ ] Collect beta tester feedback
- [ ] Triage and prioritize bugs
- [ ] Plan next sprint based on feedback
- [ ] Send monthly survey to beta testers
- [ ] Update documentation based on common questions

---

## 📅 Timeline Summary

| Task | Duration | Start | End |
|------|----------|-------|-----|
| **Pre-Publication** | 1-2 days | Day 1 | Day 2 |
| Create assets (icons, screenshots) | 1 day | Day 1 | Day 1 |
| Finalize code and tests | 1 day | Day 1 | Day 2 |
| **Android Publication** | 3-7 days | Day 2 | Day 9 |
| Build and test AAB | 1 day | Day 2 | Day 2 |
| Set up Play Console | 1 day | Day 3 | Day 3 |
| Submit and wait for review | 1-5 days | Day 4 | Day 9 |
| **Chrome Extension** | 2-5 days | Day 2 | Day 7 |
| Package and test | 0.5 day | Day 2 | Day 2 |
| Set up Chrome Web Store | 0.5 day | Day 3 | Day 3 |
| Submit and wait for review | 1-3 days | Day 4 | Day 7 |
| **Firefox Extension** | 1-3 days | Day 2 | Day 5 |
| Package and test | 0.5 day | Day 2 | Day 2 |
| Set up AMO | 0.5 day | Day 3 | Day 3 |
| Submit and wait for review | 1-2 days | Day 4 | Day 5 |
| **npm CLI** | 0.5 day | Day 2 | Day 2 |
| Test and publish | 0.5 day | Day 2 | Day 2 |
| **Beta Recruitment** | Ongoing | Day 1 | Day 30+ |
| Create materials | 1 day | Day 1 | Day 1 |
| Post on social media/forums | 0.5 day | Day 2 | Day 2 |
| Collect signups | Ongoing | Day 2 | Day 30+ |

**Total Sprint S4 Duration**: 7-10 days (excluding ongoing beta recruitment)

---

## ✅ Success Criteria

### Sprint S4 Exit Criteria (from sprint doc)

- ✅ Android RC published on Play Store (Closed Testing) and downloadable
- ✅ Chrome Extension published and available on Chrome Web Store
- ✅ Firefox Extension published and available on Firefox Add-ons
- ✅ CLI published on npm and installable: `npm install -g @genpwd-pro/cli`
- ✅ Onboarding implemented on Web and Android
- ✅ 50+ beta testers recruited and active
- ✅ All Android tests passing (0 failures)

### Additional Success Metrics

**Week 1**:
- 50+ total downloads/installs across all platforms
- 4.0+ average rating (if reviews available)
- 0 critical bugs reported
- 10+ beta testers actively testing

**Month 1**:
- 500+ total downloads/installs
- 4.5+ average rating
- 50+ beta testers recruited
- 10+ community contributions (issues, PRs, reviews)

**Year 1** (Long-term):
- 10,000+ downloads/installs
- 100+ GitHub stars
- Featured in "New & Noteworthy" on at least one store
- Active community (Discord/Slack with 50+ members)

---

## 🐛 Troubleshooting

### Common Issues

**Android**: "Gradle build fails"
- **Solution**: Check internet connection (Gradle downloads dependencies)
- In sandboxed environment: Document the process, build locally later

**Chrome**: "Extension rejected - privacy policy required"
- **Solution**: Host privacy policy publicly and add URL in Developer Dashboard

**Firefox**: "Minified code is not allowed"
- **Solution**: Don't minify code, or submit source code separately

**npm**: "Package name already taken"
- **Solution**: Choose a different name (e.g., `@yourusername/genpwd`)

---

## 📞 Support

- **GitHub Issues**: https://github.com/VBlackJack/genpwd-pro/issues
- **Documentation**: https://github.com/VBlackJack/genpwd-pro/tree/main/docs
- **Email**: support@genpwd-pro.app (if set up)

---

## 🎉 Completion

Once all checkboxes are complete:

1. Mark Sprint S4 as **COMPLETE** ✅
2. Create Sprint S4 Summary (see `SPRINT_S4_SUMMARY.md`)
3. Create Pull Request with all Sprint S4 changes
4. Merge to main branch
5. Tag release: `git tag -a v1.2.0-RC1 -m "Sprint S4 Complete"`
6. Announce on social media: Twitter, Reddit, Product Hunt
7. Start Sprint S5: Open Beta & Growth

---

**Last Updated**: 2025-11-15
**Sprint**: S4
**Status**: 🚧 In Progress
**Completion**: ~70% (documentation and code complete, waiting for actual publication)
