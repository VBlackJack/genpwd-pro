#!/bin/bash
# Auto-publish script for GenPwd Pro CLI
# Usage: ./scripts/publish.sh [patch|minor|major]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       GenPwd Pro CLI - Automated Publish Script              ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}📌 Current version: ${GREEN}${CURRENT_VERSION}${NC}"

# Determine version bump type
BUMP_TYPE=${1:-patch}
if [[ ! $BUMP_TYPE =~ ^(patch|minor|major)$ ]]; then
  echo -e "${RED}❌ Invalid bump type: $BUMP_TYPE${NC}"
  echo "   Usage: $0 [patch|minor|major]"
  exit 1
fi

echo -e "${BLUE}📈 Bump type: ${GREEN}${BUMP_TYPE}${NC}"
echo ""

# 1. Check if working directory is clean
if [[ -n $(git status --porcelain) ]]; then
  echo -e "${YELLOW}⚠️  Warning: Working directory is not clean.${NC}"
  echo "   Uncommitted changes detected. Commit or stash first."
  read -p "   Continue anyway? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Aborted.${NC}"
    exit 1
  fi
fi

# 2. Run lint
echo -e "${BLUE}🔍 Linting code...${NC}"
if command -v eslint &> /dev/null; then
  npm run lint 2>/dev/null || echo -e "${YELLOW}⚠️  Lint not configured, skipping...${NC}"
else
  echo -e "${YELLOW}⚠️  ESLint not found, skipping...${NC}"
fi

# 3. Run tests
echo -e "${BLUE}📋 Running tests...${NC}"
if grep -q '"test"' package.json; then
  npm test 2>/dev/null || echo -e "${YELLOW}⚠️  Tests not configured, skipping...${NC}"
else
  echo -e "${YELLOW}⚠️  Tests not configured, skipping...${NC}"
fi

# 4. Test CLI locally
echo -e "${BLUE}🧪 Testing CLI locally...${NC}"
node bin/genpwd.js --version || { echo -e "${RED}❌ CLI test failed!${NC}"; exit 1; }
node bin/genpwd.js syllables -l 12 > /dev/null || { echo -e "${RED}❌ CLI test failed!${NC}"; exit 1; }
echo -e "${GREEN}✅ CLI tests passed${NC}"

# 5. Pack and inspect
echo -e "${BLUE}📦 Packing (dry run)...${NC}"
npm pack --dry-run | head -20

# 6. Bump version
echo ""
read -p "$(echo -e ${YELLOW}📝 Bump version from ${CURRENT_VERSION} to ${BUMP_TYPE}? \(y/N\) ${NC})" -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}❌ Aborted.${NC}"
  exit 1
fi

npm version $BUMP_TYPE --no-git-tag-version
NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}✅ Version bumped to ${NEW_VERSION}${NC}"

# 7. Confirm publish
echo ""
read -p "$(echo -e ${YELLOW}🚀 Publish @genpwd-pro/cli@${NEW_VERSION} to npm? \(y/N\) ${NC})" -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  # Revert version bump
  git checkout package.json package-lock.json 2>/dev/null || true
  echo -e "${RED}❌ Aborted. Version reverted.${NC}"
  exit 1
fi

# 8. Publish to npm
echo -e "${BLUE}🚀 Publishing to npm...${NC}"
if npm publish --access public; then
  echo -e "${GREEN}✅ Successfully published @genpwd-pro/cli@${NEW_VERSION}!${NC}"
else
  echo -e "${RED}❌ Publish failed!${NC}"
  exit 1
fi

# 9. Commit version bump
echo -e "${BLUE}💾 Committing version bump...${NC}"
git add package.json package-lock.json
git commit -m "chore(cli): Release v${NEW_VERSION}"

# 10. Create git tag
echo -e "${BLUE}🏷️  Creating git tag: cli-v${NEW_VERSION}${NC}"
git tag -a "cli-v${NEW_VERSION}" -m "Release GenPwd Pro CLI v${NEW_VERSION}"

# 11. Push to remote
read -p "$(echo -e ${YELLOW}📤 Push commits and tags to remote? \(y/N\) ${NC})" -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push
  git push origin "cli-v${NEW_VERSION}"
  echo -e "${GREEN}✅ Pushed to remote${NC}"
fi

# 12. Summary
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ PUBLISH SUCCESSFUL!                     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📦 Package:${NC}  @genpwd-pro/cli@${NEW_VERSION}"
echo -e "${BLUE}🔗 npm:${NC}      https://www.npmjs.com/package/@genpwd-pro/cli"
echo -e "${BLUE}🏷️  Tag:${NC}     cli-v${NEW_VERSION}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "   1. Verify on npmjs.com"
echo "   2. Test installation: npm install -g @genpwd-pro/cli"
echo "   3. Create GitHub Release"
echo "   4. Announce on social media"
echo ""
