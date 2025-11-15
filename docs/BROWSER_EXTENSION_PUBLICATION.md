# Browser Extensions Publication Guide

**Sprint S4**: Publication & Déploiement Multi-Plateformes
**Extensions**: Chrome Web Store & Firefox Add-ons (AMO)

## 📋 Overview

GenPwd Pro browser extensions allow users to generate secure passwords directly in their browser with a single click.

### Extension Features
- ✅ **Popup UI**: Quick password generation
- ✅ **Auto-fill**: Fill password fields automatically
- ✅ **Context menu**: Right-click to generate
- ✅ **Sync**: Sync settings across devices
- ✅ **Offline**: Works without internet
- ✅ **Privacy**: Zero data collection

---

## 🎨 Phase 1: Create Assets

### Icons Required

**Chrome Extension** (PNG format):
- `icon16.png` - 16×16 px (browser toolbar)
- `icon32.png` - 32×32 px (Windows)
- `icon48.png` - 48×48 px (extensions page)
- `icon128.png` - 128×128 px (Chrome Web Store)

**Firefox Extension** (PNG format):
- `icon48.png` - 48×48 px (add-ons manager)
- `icon96.png` - 96×96 px (high-DPI displays)

### Create Icons

Using this ASCII art as a base design:
```
╔═══════════╗
║  🔐  GP   ║
║  GenPwd   ║
╚═══════════╝
```

**Option 1: Using Figma/Photoshop**:
1. Create new document: 128×128 px
2. Background: Linear gradient (Blue #4A90E2 to Dark Blue #1E3A8A)
3. Add icon: Key or lock symbol (white)
4. Add text: "GP" in bold font (white)
5. Export in all sizes: 16×16, 32×32, 48×48, 96×96, 128×128

**Option 2: Using ImageMagick (CLI)**:

```bash
# Create base icon (simplified version)
convert -size 128x128 \
  gradient:'#4A90E2'-'#1E3A8A' \
  -font Arial-Bold -pointsize 48 \
  -fill white -gravity center \
  -draw "text 0,0 'GP'" \
  extensions/chrome/icons/icon128.png

# Resize for other sizes
convert extensions/chrome/icons/icon128.png -resize 48x48 extensions/chrome/icons/icon48.png
convert extensions/chrome/icons/icon128.png -resize 32x32 extensions/chrome/icons/icon32.png
convert extensions/chrome/icons/icon128.png -resize 16x16 extensions/chrome/icons/icon16.png

# Firefox icons
convert extensions/chrome/icons/icon128.png -resize 96x96 extensions/firefox/icons/icon96.png
cp extensions/chrome/icons/icon48.png extensions/firefox/icons/icon48.png
```

**Option 3: Use Online Tool**:
- https://www.favicon-generator.org/
- https://realfavicongenerator.net/
- Upload SVG or PNG, download all sizes

### Screenshots Required

**Chrome Web Store**:
- Minimum: 1 screenshot
- Recommended: 3-5 screenshots
- Size: 1280×800 px or 640×400 px (16:10 aspect ratio)
- Format: PNG or JPEG

**Firefox Add-ons (AMO)**:
- Minimum: 1 screenshot
- Recommended: 3-5 screenshots
- Size: 1280×800 px (preferred) or custom
- Format: PNG or JPEG

**What to screenshot**:
1. **Popup UI**: Show password generation interface
2. **Options page**: Show settings and customization
3. **Auto-fill demo**: Show password being filled into a form
4. **Context menu**: Show right-click menu with "Generate Password"
5. **Vault integration** (if applicable): Show saved passwords

**How to take screenshots**:

```bash
# 1. Open extension in Chrome/Firefox
# 2. Press F12 to open DevTools
# 3. Click on the extension icon
# 4. Use browser's screenshot tool (Ctrl+Shift+S)
# 5. Or use external tools:
#    - Windows: Snipping Tool, Greenshot
#    - Mac: Command+Shift+4
#    - Linux: Flameshot, Shutter
```

---

## 📦 Phase 2: Package Extensions

### Chrome Extension

**Step 1: Create icons directory**:
```bash
mkdir -p extensions/chrome/icons
# Add icon files: icon16.png, icon32.png, icon48.png, icon128.png
```

**Step 2: Test extension locally**:
```bash
# 1. Open Chrome
# 2. Go to chrome://extensions/
# 3. Enable "Developer mode" (top right)
# 4. Click "Load unpacked"
# 5. Select extensions/chrome/ directory
# 6. Test all features:
#    - Click extension icon → generates password
#    - Right-click on password field → context menu works
#    - Open options page → settings save
#    - Test auto-fill on a website
```

**Step 3: Create ZIP package**:

```bash
cd extensions/chrome

# Create ZIP (exclude unnecessary files)
zip -r ../../genpwd-pro-chrome-v1.0.0.zip . \
  -x "*.git*" \
  -x "*.DS_Store" \
  -x "*node_modules*" \
  -x "*.md" \
  -x "*test*"

# Verify ZIP contents
unzip -l ../../genpwd-pro-chrome-v1.0.0.zip
```

**Expected file structure in ZIP**:
```
genpwd-pro-chrome-v1.0.0.zip
├── manifest.json
├── popup.html
├── popup.js
├── popup.css
├── background.js
├── content.js
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── utils/
    └── generator.js
```

### Firefox Extension

**Step 1: Create icons directory**:
```bash
mkdir -p extensions/firefox/icons
# Add icon files: icon48.png, icon96.png
```

**Step 2: Test extension locally**:
```bash
# Option A: web-ext (recommended)
cd extensions/firefox
npx web-ext run

# Option B: Manual loading
# 1. Open Firefox
# 2. Go to about:debugging#/runtime/this-firefox
# 3. Click "Load Temporary Add-on"
# 4. Select extensions/firefox/manifest.json
# 5. Test all features
```

**Step 3: Create ZIP package**:

```bash
cd extensions/firefox

# Create ZIP
zip -r ../../genpwd-pro-firefox-v1.0.0.zip . \
  -x "*.git*" \
  -x "*.DS_Store" \
  -x "*node_modules*" \
  -x "*.md" \
  -x "*test*"

# Verify ZIP contents
unzip -l ../../genpwd-pro-firefox-v1.0.0.zip
```

---

## 🌐 Phase 3: Publish to Chrome Web Store

### Prerequisites

- **Google Account**: Create if needed
- **Developer Fee**: $5 USD (one-time payment)
- **Payment Method**: Credit/debit card

### Step 1: Register as Chrome Web Store Developer

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Sign in with Google account
3. Pay $5 developer registration fee
4. Accept Developer Agreement
5. Verify email address

**Note**: Registration approval can take a few hours to 1 day.

### Step 2: Create New Item

1. Click **"New Item"** button
2. Click **"Choose file"**
3. Upload `genpwd-pro-chrome-v1.0.0.zip`
4. Wait for upload to complete (< 1 minute)
5. Click **"Continue"**

### Step 3: Fill Store Listing

**Store listing tab**:

- **Product name**: `GenPwd Pro - Secure Password Generator`

- **Summary** (132 chars max):
  ```
  Generate strong, memorable passwords instantly. Syllables, passphrases, vault storage. 100% offline. No data collection.
  ```

- **Description** (long):
  ```markdown
  # GenPwd Pro - Professional Password Generator

  Generate secure, memorable passwords with a single click. No internet required, zero data collection.

  ## 🔐 Generation Modes

  ### Syllables Mode
  Create pronounceable passwords that are easy to type but hard to crack.
  - Example: "TakLabMurPix42"
  - Customizable length (8-128 characters)
  - Optional uppercase, numbers, special characters

  ### Passphrase Mode
  Generate Diceware-style phrases that are easy to remember.
  - Example: "correct-horse-battery-staple-cloud"
  - 3-12 words
  - Custom separators
  - Capitalization options

  ### Leet Mode
  Convert regular text to l33t speak for added complexity.
  - Example: "MyPassword" → "MyP@ssw0rd"

  ## ✨ Features

  • **One-Click Generation**: Click icon to instantly generate password
  • **Auto-Fill**: Automatically fill password fields on websites
  • **Copy to Clipboard**: Right-click any password field
  • **Context Menu**: Right-click to generate password
  • **Vault Storage**: Save passwords encrypted locally
  • **Sync**: Sync settings across devices (Chrome Sync)
  • **Entropy Calculator**: See password strength in real-time
  • **100% Offline**: No internet connection required
  • **Zero Tracking**: No data collection, no analytics

  ## 🔒 Security & Privacy

  • **Cryptographically Secure**: Uses Web Crypto API (crypto.getRandomValues)
  • **No Permissions Abuse**: Only requests essential permissions
  • **Open Source**: MIT License, auditable code
  • **No Data Collection**: Everything stays on your device
  • **No Ads**: Completely free, no premium tiers

  ## 🚀 How to Use

  1. **Click the extension icon** in toolbar
  2. **Choose a generation mode** (Syllables, Passphrase, Leet)
  3. **Customize settings** (length, complexity)
  4. **Click "Generate"**
  5. **Password is copied to clipboard automatically**

  Or:
  - **Right-click on any password field** → Select "Generate Password with GenPwd Pro"
  - Password is auto-filled

  ## 🌍 Perfect For

  • Security professionals
  • Privacy-conscious users
  • Developers and IT admins
  • Anyone who wants strong passwords without cloud dependency

  ## 📖 Documentation

  - GitHub: https://github.com/VBlackJack/genpwd-pro
  - Issues: https://github.com/VBlackJack/genpwd-pro/issues
  - Web App: https://vblackjack.github.io/genpwd-pro/

  ## 🆓 100% Free

  GenPwd Pro is and will always be free. No subscriptions, no premium features, no ads.

  ---

  **Support the project**: Star on GitHub ⭐
  **Report bugs**: https://github.com/VBlackJack/genpwd-pro/issues
  **Contribute**: Pull requests welcome!
  ```

- **Category**: Productivity

- **Language**: English (or your preferred language)

**Privacy practices**:

- **Single purpose**: ✅ Password generation and management
- **Data usage**: ❌ No data collected
- **Certified**: ❌ (not required for free extensions)

**Store listing assets**:

1. **Icon**: Upload `icon128.png` (128×128 px)

2. **Screenshots**: Upload 3-5 images
   - Screenshot 1: Popup UI showing password generation
   - Screenshot 2: Options page with settings
   - Screenshot 3: Auto-fill demo on a website
   - Screenshot 4: Context menu integration
   - Screenshot 5: Vault storage interface

3. **Promotional Images** (optional but recommended):
   - Small tile: 440×280 px
   - Large tile: 920×680 px
   - Marquee: 1400×560 px

**Additional fields**:

- **Official URL**: `https://github.com/VBlackJack/genpwd-pro`
- **Homepage URL**: `https://github.com/VBlackJack/genpwd-pro`
- **Support URL**: `https://github.com/VBlackJack/genpwd-pro/issues`

### Step 4: Distribution

- **Visibility**: Public
- **Regions**: All regions (worldwide)
- **Target audience**: Everyone

### Step 5: Privacy Policy (Required)

Create `docs/PRIVACY_POLICY.md`:

```markdown
# Privacy Policy for GenPwd Pro

**Last Updated**: 2025-11-15

## Overview

GenPwd Pro is committed to protecting your privacy. This extension does NOT collect, store, or transmit any personal data.

## Data Collection

**We collect ZERO data.**

- No passwords are stored remotely
- No usage analytics
- No tracking pixels
- No telemetry
- No cookies (except Chrome Sync for settings)

## Data Storage

All data is stored locally on your device using Chrome's `storage.local` API:
- Generated passwords (if you choose to save them)
- Extension settings (password length, complexity, etc.)

If you enable Chrome Sync, your settings (NOT passwords) may sync across your devices via Google's servers. This is controlled by Chrome, not GenPwd Pro.

## Permissions

### Required Permissions:

- `storage`: Store settings locally
- `activeTab`: Access current tab to auto-fill passwords
- `clipboardWrite`: Copy passwords to clipboard
- `contextMenus`: Right-click menu integration

### Optional Permissions:

- None

## Third-Party Services

GenPwd Pro does NOT use any third-party services, analytics, or tracking.

## Changes

We may update this Privacy Policy. Check this page for updates.

## Contact

For questions: https://github.com/VBlackJack/genpwd-pro/issues

---

**Summary**: GenPwd Pro collects ZERO data. Everything happens on your device.
```

Host this file publicly (GitHub Pages, your website, etc.) and add the URL in the Privacy Policy field.

**Privacy Policy URL**: `https://vblackjack.github.io/genpwd-pro/privacy.html`

### Step 6: Submit for Review

1. Review all fields
2. Click **"Submit for review"**
3. Wait for automated checks (instant)
4. Wait for manual review (1-3 days on average, can be up to 7 days)

**Review timeline**:
- Day 1: Submission
- Day 1-2: Automated security scan
- Day 2-5: Manual review (if flagged or first submission)
- Day 5-7: Approval or rejection

**Common rejection reasons**:
- Missing or invalid privacy policy
- Requesting unnecessary permissions
- Malicious code detected
- Poor quality screenshots
- Misleading description

### Step 7: Post-Approval

Once approved (status: "Published"):

1. **Share the link**:
   ```
   https://chrome.google.com/webstore/detail/genpwd-pro/[YOUR_EXTENSION_ID]
   ```

2. **Add badge to README**:
   ```markdown
   [![Chrome Web Store](https://img.shields.io/chrome-web-store/v/YOUR_EXTENSION_ID.svg)](https://chrome.google.com/webstore/detail/genpwd-pro/YOUR_EXTENSION_ID)
   [![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/YOUR_EXTENSION_ID.svg)](https://chrome.google.com/webstore/detail/genpwd-pro/YOUR_EXTENSION_ID)
   [![Chrome Web Store Rating](https://img.shields.io/chrome-web-store/stars/YOUR_EXTENSION_ID.svg)](https://chrome.google.com/webstore/detail/genpwd-pro/YOUR_EXTENSION_ID)
   ```

3. **Monitor reviews and ratings**

4. **Respond to user feedback**

---

## 🦊 Phase 4: Publish to Firefox Add-ons (AMO)

### Prerequisites

- **Firefox Account**: Create if needed
- **No Fee**: Firefox Add-ons are FREE to publish

### Step 1: Register on AMO

1. Go to [addons.mozilla.org/developers](https://addons.mozilla.org/developers/)
2. Sign in with Firefox Account (or create one)
3. No payment required! ✅

### Step 2: Submit New Add-on

1. Click **"Submit Your First Add-on"**
2. **Choose platform**: "Firefox"
3. **Where will it be listed?**: "On this site" (AMO)

### Step 3: Upload Add-on

1. Click **"Select a file..."**
2. Upload `genpwd-pro-firefox-v1.0.0.zip`
3. Wait for automated validation (< 1 minute)
4. Fix any errors shown in the validation report

**Common validation issues**:
- Missing `applications.gecko.id` in manifest.json
- Invalid permission usage
- Minified/obfuscated code (not allowed)
- Missing source code (if using build tools)

### Step 4: Fill Add-on Details

**Basic Information**:

- **Add-on Name**: `GenPwd Pro - Secure Password Generator`

- **Add-on URL**: `https://addons.mozilla.org/en-US/firefox/addon/genpwd-pro/`
  (Auto-generated from name, can be customized)

- **Summary** (250 chars max):
  ```
  Generate strong, memorable passwords instantly. Syllables, passphrases, vault storage. 100% offline. No data collection. Open source.
  ```

- **Description**:
  (Use the same comprehensive description as Chrome Web Store, adapted for Firefox)

**Version Information**:

- **Version**: 1.0.0 (auto-detected from manifest.json)

- **Release Notes**:
  ```markdown
  # GenPwd Pro v1.0.0 - Initial Release

  🎉 First release of GenPwd Pro for Firefox!

  ## Features

  ✅ Syllables password generator
  ✅ Passphrase generator (Diceware-style)
  ✅ Leet speak converter
  ✅ Auto-fill password fields
  ✅ Context menu integration
  ✅ Vault storage (encrypted locally)
  ✅ 100% offline, no data collection
  ✅ Open source (MIT License)

  ## Usage

  1. Click the toolbar icon to generate a password
  2. Or right-click on any password field → "Generate Password"
  3. Customize settings in the options page

  ## Privacy

  GenPwd Pro collects ZERO data. Everything stays on your device.

  ## Support

  Report bugs: https://github.com/VBlackJack/genpwd-pro/issues
  Documentation: https://github.com/VBlackJack/genpwd-pro
  ```

**Categories**:
- Primary: Security & Privacy
- Secondary: Productivity

**Support Information**:

- **Support Email**: your-email@example.com (or skip)
- **Support Website**: `https://github.com/VBlackJack/genpwd-pro/issues`
- **Homepage**: `https://github.com/VBlackJack/genpwd-pro`

**Screenshots**:

Upload 3-5 screenshots (same as Chrome, but can be different sizes):
1. Popup UI
2. Options page
3. Auto-fill demo
4. Context menu
5. Vault interface

**License**:

- **License**: MIT License (or Apache-2.0, as in your project)
- **License URL**: `https://github.com/VBlackJack/genpwd-pro/blob/main/LICENSE`

**Privacy Policy**:

- Same as Chrome Web Store
- **URL**: `https://vblackjack.github.io/genpwd-pro/privacy.html`

### Step 5: Nominate for Approval

1. Review all fields
2. Click **"Submit Version"**
3. Automated validation runs (instant)
4. Manual review queue (if first submission or flagged)

**Review timeline**:
- **Automated review**: Instant (if code is simple and no red flags)
- **Manual review**: 1-7 days (if flagged)
- **Average**: 1-3 days

**Note**: Firefox reviews are generally faster than Chrome because they prioritize open-source, privacy-respecting extensions.

### Step 6: Post-Approval

Once approved:

1. **Share the link**:
   ```
   https://addons.mozilla.org/firefox/addon/genpwd-pro/
   ```

2. **Add badge to README**:
   ```markdown
   [![Mozilla Add-on](https://img.shields.io/amo/v/genpwd-pro.svg)](https://addons.mozilla.org/firefox/addon/genpwd-pro/)
   [![Mozilla Add-on Users](https://img.shields.io/amo/users/genpwd-pro.svg)](https://addons.mozilla.org/firefox/addon/genpwd-pro/)
   [![Mozilla Add-on Rating](https://img.shields.io/amo/stars/genpwd-pro.svg)](https://addons.mozilla.org/firefox/addon/genpwd-pro/)
   ```

3. **Monitor reviews**

---

## 🔄 Updating Extensions

### For Bug Fixes (1.0.0 → 1.0.1)

1. Fix bugs in code
2. Update `manifest.json` version to `1.0.1`
3. Create new ZIP package
4. Upload to Chrome Web Store / Firefox AMO
5. Write release notes describing fixes
6. Submit for review

**Review time**: Usually faster (< 24 hours) for patch updates

### For New Features (1.0.0 → 1.1.0)

1. Add new features
2. Update `manifest.json` version to `1.1.0`
3. Update README and screenshots if UI changed
4. Create new ZIP package
5. Upload to stores
6. Write detailed release notes
7. Submit for review

**Review time**: 1-3 days (similar to initial submission)

---

## 📊 Analytics & Monitoring

### Chrome Web Store Analytics

Dashboard: [chrome.google.com/webstore/devconsole/](https://chrome.google.com/webstore/devconsole/)

Metrics:
- **Impressions**: How many times extension appeared in search
- **Installs**: Total installations
- **Weekly Users**: Active users in the past week
- **Rating**: Average star rating (1-5)
- **Reviews**: User reviews and feedback

### Firefox Add-ons Statistics

Dashboard: [addons.mozilla.org/developers/](https://addons.mozilla.org/developers/)

Metrics:
- **Downloads**: Total downloads (all-time, weekly, daily)
- **Daily Users**: Active users per day
- **Rating**: Average star rating (1-5)
- **Reviews**: User reviews and feedback

---

## 🎯 Success Metrics

### Week 1 Targets
- ✅ Published on both stores
- ✅ 50+ total installs
- ✅ 4.0+ average rating
- ✅ 0 critical bugs reported

### Month 1 Targets
- ✅ 500+ total installs
- ✅ 4.5+ average rating
- ✅ 10+ reviews
- ✅ Featured in "New & Noteworthy" (if selected by stores)

### Year 1 Targets
- ✅ 10,000+ total installs
- ✅ 4.7+ average rating
- ✅ 100+ reviews
- ✅ Top 10 in "Password Managers" category

---

## 🐛 Common Issues

### Chrome Web Store

**Issue**: "Manifest file is missing or unreadable"
- **Fix**: Ensure `manifest.json` is at the root of ZIP, valid JSON

**Issue**: "Icon file is missing"
- **Fix**: Add all required icon files: 16, 32, 48, 128 px

**Issue**: "This item does not comply with the program policies"
- **Fix**: Review rejection email, address specific violations, resubmit

**Issue**: "Privacy policy is required"
- **Fix**: Host privacy policy publicly, add URL in Developer Dashboard

### Firefox Add-ons

**Issue**: "Minified code is not allowed"
- **Fix**: Don't use minifiers, or submit source code separately

**Issue**: "Permission 'X' is not allowed"
- **Fix**: Remove unnecessary permissions from manifest.json

**Issue**: "Your submission has been flagged for manual review"
- **Fix**: Wait patiently (1-7 days), respond to reviewer questions

---

## 🔗 Resources

**Chrome Web Store**:
- [Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
- [Publication Guidelines](https://developer.chrome.com/docs/webstore/program-policies/)
- [Best Practices](https://developer.chrome.com/docs/webstore/best-practices/)

**Firefox Add-ons**:
- [Developer Hub](https://addons.mozilla.org/developers/)
- [Submission Guidelines](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [Add-on Policies](https://extensionworkshop.com/documentation/publish/add-on-policies/)

**Tools**:
- [web-ext](https://github.com/mozilla/web-ext): Firefox extension testing tool
- [Chrome Extension Source Viewer](https://chromewebstore.google.com/detail/chrome-extension-source-v/jifpbeccnghkjeaalbbjmodiffmgedin): View source of published extensions

---

**Last Updated**: 2025-11-15
**Author**: GenPwd Pro Team
**License**: MIT
