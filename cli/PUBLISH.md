# GenPwd Pro CLI - npm Publication Guide

**Package**: `@genpwd-pro/cli`
**Registry**: npmjs.com
**Current Version**: 1.0.0
**License**: Apache-2.0

## 📋 Pre-Publication Checklist

### 1. Version Update

Update version in `package.json`:

```bash
cd cli
npm version patch  # 1.0.0 -> 1.0.1 (bug fixes)
npm version minor  # 1.0.0 -> 1.1.0 (new features)
npm version major  # 1.0.0 -> 2.0.0 (breaking changes)
```

### 2. Test Package Locally

```bash
# Test all commands
node bin/genpwd.js --help
node bin/genpwd.js syllables -l 16 --entropy
node bin/genpwd.js passphrase -w 5 -c -n
node bin/genpwd.js leet -t "Test" -l 2
node bin/genpwd.js entropy -p "TestPassword123!"

# Test installation
npm link
genpwd --version
genpwd --help
genpwd syllables -l 20

# Unlink after testing
npm unlink -g @genpwd-pro/cli
```

### 3. Run Tests (if available)

```bash
npm test  # Currently not implemented
```

### 4. Lint Code

```bash
npm run lint  # Fix any issues
```

### 5. Update README

Ensure `cli/README.md` contains:
- ✅ Installation instructions
- ✅ Usage examples
- ✅ All commands documented
- ✅ License information
- ✅ Repository links

### 6. Update CHANGELOG

Create/update `cli/CHANGELOG.md`:

```markdown
# Changelog

## [1.0.0] - 2025-11-15

### Added
- Initial release
- Syllables password generator
- Passphrase generator (Diceware-style)
- Leet speak converter
- Entropy calculator
- Comprehensive examples
```

---

## 🚀 Publication Steps

### Step 1: Create npm Account

1. Go to [npmjs.com](https://www.npmjs.com/signup)
2. Create account (free)
3. Verify email address

### Step 2: Login via CLI

```bash
npm login

# Enter:
# - Username
# - Password
# - Email (public)
# - One-time password (2FA if enabled)
```

### Step 3: Verify Package Configuration

```bash
cd cli

# Check package.json
cat package.json | grep -E '"name"|"version"|"main"|"bin"|"license"'

# Verify files to be published
npm pack --dry-run

# Expected output:
# bin/genpwd.js
# lib/generator.js
# lib/generators.js
# lib/helpers.js
# lib/logger.js
# lib/version.js
# README.md
# package.json
```

### Step 4: Test Pack

```bash
# Create tarball locally
npm pack

# Expected: genpwd-pro-cli-1.0.0.tgz

# Extract and inspect
tar -tzf genpwd-pro-cli-1.0.0.tgz

# Test installation from tarball
npm install -g ./genpwd-pro-cli-1.0.0.tgz
genpwd --version
npm uninstall -g @genpwd-pro/cli

# Clean up
rm genpwd-pro-cli-1.0.0.tgz
```

### Step 5: Publish to npm

```bash
# Publish (public access)
npm publish --access public

# Expected output:
# + @genpwd-pro/cli@1.0.0
```

**Important**: This step CANNOT be undone! Once published, a version cannot be deleted or modified. You can only deprecate it.

### Step 6: Verify Publication

```bash
# Check on npmjs.com
open https://www.npmjs.com/package/@genpwd-pro/cli

# Test installation
npm install -g @genpwd-pro/cli

# Test CLI
genpwd --version  # Should show 1.0.0
genpwd --help
genpwd syllables -l 16

# Uninstall
npm uninstall -g @genpwd-pro/cli
```

---

## 📦 Post-Publication

### 1. Create Git Tag

```bash
cd /home/user/genpwd-pro

git tag -a cli-v1.0.0 -m "Release GenPwd Pro CLI v1.0.0"
git push origin cli-v1.0.0
```

### 2. Create GitHub Release

1. Go to: `https://github.com/VBlackJack/genpwd-pro/releases/new`
2. **Tag**: `cli-v1.0.0`
3. **Title**: `GenPwd Pro CLI v1.0.0`
4. **Description**:
   ```markdown
   # GenPwd Pro CLI v1.0.0 🎉

   First release of the GenPwd Pro command-line interface!

   ## Installation

   ```bash
   npm install -g @genpwd-pro/cli
   ```

   ## Features

   ✅ **Syllables Generator**: Pronounceable passwords
   ✅ **Passphrase Generator**: Diceware-style passphrases
   ✅ **Leet Speak**: Convert text to l33t
   ✅ **Entropy Calculator**: Analyze password strength
   ✅ **Cryptographically Secure**: Uses Web Crypto API

   ## Quick Start

   ```bash
   # Generate password
   genpwd

   # Generate passphrase
   genpwd passphrase -w 6

   # Analyze password
   genpwd entropy -p "MyPassword123"

   # Show examples
   genpwd examples
   ```

   ## Links

   - **npm**: https://www.npmjs.com/package/@genpwd-pro/cli
   - **Documentation**: https://github.com/VBlackJack/genpwd-pro/tree/main/cli
   - **Issues**: https://github.com/VBlackJack/genpwd-pro/issues
   ```

3. **Publish release**

### 3. Announce on Social Media

**Twitter/X**:
```
🎉 GenPwd Pro CLI v1.0.0 is now on npm!

Generate secure passwords from your terminal:
- Syllables mode (pronounceable)
- Passphrases (Diceware)
- Entropy calculator
- 100% offline

Install: npm install -g @genpwd-pro/cli

#opensource #security #passwordmanager #cli
```

**Reddit** (r/opensource, r/commandline, r/node):
```
Title: [Release] GenPwd Pro CLI - Professional Password Generator for Terminal

I'm excited to announce the first release of GenPwd Pro CLI, a command-line password generator built with security in mind.

Features:
- Syllables generator (pronounceable passwords)
- Passphrase generator (Diceware-style)
- Leet speak converter
- Entropy calculator
- 100% offline, no data collection
- Cryptographically secure (Web Crypto API)
- Open source (Apache-2.0)

Installation:
npm install -g @genpwd-pro/cli

Examples:
genpwd syllables -l 20
genpwd passphrase -w 6 -c -n
genpwd entropy -p "your-password"

GitHub: https://github.com/VBlackJack/genpwd-pro
npm: https://www.npmjs.com/package/@genpwd-pro/cli

Feedback welcome!
```

**Product Hunt**:
```
Title: GenPwd Pro CLI - Secure Password Generator for Developers

Tagline: Generate strong passwords from your terminal, 100% offline

Description:
GenPwd Pro CLI is a professional command-line password generator for developers and security enthusiasts.

Key Features:
• Syllables mode: Generate pronounceable passwords (e.g., "TakLabMurPix42")
• Passphrase mode: Diceware-style phrases (e.g., "correct-horse-battery-staple")
• Entropy calculator: Analyze password strength
• Leet speak: Convert text to l33t (MyP@ssw0rd)
• Cryptographically secure: Uses Web Crypto API
• 100% offline: No internet required
• Zero tracking: No data collection
• Open source: Apache-2.0 license

Perfect for:
- DevOps engineers automating password generation
- Security professionals generating test credentials
- Privacy-conscious users who want offline tools
- Anyone who lives in the terminal

Installation:
npm install -g @genpwd-pro/cli

Links:
GitHub: https://github.com/VBlackJack/genpwd-pro
npm: https://www.npmjs.com/package/@genpwd-pro/cli
```

---

## 🔄 Updating Published Package

### For Patch Updates (1.0.0 -> 1.0.1)

```bash
cd cli

# 1. Make bug fixes
# 2. Update version
npm version patch

# 3. Run tests
npm test

# 4. Publish
npm publish

# 5. Tag and push
git push origin cli-v1.0.1
```

### For Minor Updates (1.0.0 -> 1.1.0)

```bash
cd cli

# 1. Add new features
# 2. Update README and CHANGELOG
# 3. Update version
npm version minor

# 4. Run tests
npm test

# 5. Publish
npm publish

# 6. Create GitHub release with detailed notes
```

### For Major Updates (1.0.0 -> 2.0.0)

```bash
cd cli

# 1. Make breaking changes
# 2. Update README with migration guide
# 3. Update CHANGELOG with breaking changes
# 4. Update version
npm version major

# 5. Run tests
npm test

# 6. Publish
npm publish

# 7. Announce breaking changes prominently
```

---

## 🛡️ Security Best Practices

### 1. Enable 2FA on npm

```bash
npm profile enable-2fa auth-and-writes

# Recommended: Use authenticator app (Google Authenticator, Authy)
```

### 2. Use npm Tokens for CI/CD

```bash
# Create automation token (read-only or publish)
npm token create --read-only
npm token create --cidr=0.0.0.0/0

# Add to .env (never commit!)
NPM_TOKEN=your_token_here

# Use in GitHub Actions
- name: Publish to npm
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 3. Audit Dependencies

```bash
npm audit

# Fix vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated
```

### 4. Sign Packages (Optional)

```bash
# Generate PGP key
gpg --gen-key

# Sign tarball
npm pack
gpg --detach-sign genpwd-pro-cli-1.0.0.tgz

# Users can verify:
gpg --verify genpwd-pro-cli-1.0.0.tgz.sig genpwd-pro-cli-1.0.0.tgz
```

---

## 📊 Monitoring

### npm Package Stats

- **Downloads**: https://www.npmjs.com/package/@genpwd-pro/cli
- **npm Trends**: https://npmtrends.com/@genpwd-pro/cli
- **Bundlephobia**: https://bundlephobia.com/package/@genpwd-pro/cli

### GitHub Metrics

- **Stars**: https://github.com/VBlackJack/genpwd-pro/stargazers
- **Issues**: https://github.com/VBlackJack/genpwd-pro/issues
- **Pull Requests**: https://github.com/VBlackJack/genpwd-pro/pulls

---

## 🐛 Troubleshooting

### Issue: "You do not have permission to publish"

**Solution**:
```bash
# Login again
npm logout
npm login

# Verify user
npm whoami

# Check package name availability
npm view @genpwd-pro/cli

# If taken, choose different name in package.json
```

### Issue: "Package name too similar to existing packages"

**Solution**:
- npm may block names similar to popular packages
- Choose a more unique name
- Or publish under your username scope: `@yourusername/genpwd`

### Issue: "Version already published"

**Solution**:
```bash
# Bump version
npm version patch

# Publish again
npm publish
```

### Issue: "Forbidden - must verify email"

**Solution**:
1. Check email for verification link
2. Click link to verify
3. Try publishing again

---

## 📝 Automation Script

For convenience, create `cli/scripts/publish.sh`:

```bash
#!/bin/bash
# Auto-publish script for GenPwd Pro CLI

set -e  # Exit on error

echo "🚀 GenPwd Pro CLI - Automated Publish Script"
echo "=============================================="
echo ""

# 1. Run tests
echo "📋 Running tests..."
npm test || { echo "❌ Tests failed!"; exit 1; }

# 2. Lint code
echo "🔍 Linting code..."
npm run lint || { echo "❌ Lint failed!"; exit 1; }

# 3. Build (if needed)
echo "🔨 Building..."
# npm run build  # Uncomment if you have a build step

# 4. Pack and inspect
echo "📦 Packing..."
npm pack --dry-run

# 5. Confirm
echo ""
read -p "📝 Current version: $(node -p "require('./package.json').version"). Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Aborted."
  exit 1
fi

# 6. Publish
echo "🚀 Publishing to npm..."
npm publish --access public

# 7. Create git tag
VERSION=$(node -p "require('./package.json').version")
echo "🏷️  Creating git tag: cli-v$VERSION"
git tag -a "cli-v$VERSION" -m "Release GenPwd Pro CLI v$VERSION"
git push origin "cli-v$VERSION"

echo ""
echo "✅ Successfully published @genpwd-pro/cli@$VERSION!"
echo "📦 https://www.npmjs.com/package/@genpwd-pro/cli"
echo ""
```

Usage:
```bash
cd cli
chmod +x scripts/publish.sh
./scripts/publish.sh
```

---

## 🎯 Success Metrics

### Week 1 Targets
- ✅ Published on npm
- ✅ 50+ downloads
- ✅ 0 critical bugs reported
- ✅ 5+ GitHub stars

### Month 1 Targets
- ✅ 500+ downloads
- ✅ 25+ GitHub stars
- ✅ Featured in 1+ dev newsletter
- ✅ 5+ community contributions (issues, PRs)

### Year 1 Targets
- ✅ 10,000+ downloads
- ✅ 100+ GitHub stars
- ✅ 50+ dependents
- ✅ Listed on awesome-cli lists

---

## 🔗 Resources

- **npm Docs**: https://docs.npmjs.com/
- **Publishing Packages**: https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry
- **Semantic Versioning**: https://semver.org/
- **Keep a Changelog**: https://keepachangelog.com/
- **npm Best Practices**: https://github.com/goldbergyoni/nodebestpractices

---

**Last Updated**: 2025-11-15
**Maintainer**: Julien Bombled
**License**: Apache-2.0
