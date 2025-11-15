#!/bin/bash
# Package GenPwd Pro Browser Extensions
# Creates ZIP files ready for submission to Chrome Web Store and Firefox Add-ons

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    GenPwd Pro - Browser Extension Packaging Script           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get version from manifest
CHROME_VERSION=$(node -p "require('./chrome/manifest.json').version")
FIREFOX_VERSION=$(node -p "require('./firefox/manifest.json').version")

echo -e "${BLUE}📦 Chrome Extension version: ${GREEN}${CHROME_VERSION}${NC}"
echo -e "${BLUE}📦 Firefox Extension version: ${GREEN}${FIREFOX_VERSION}${NC}"
echo ""

# Package Chrome Extension
echo -e "${BLUE}📦 Packaging Chrome Extension...${NC}"
cd chrome
zip -r "../genpwd-pro-chrome-v${CHROME_VERSION}.zip" . \
  -x "*.git*" \
  -x "*.DS_Store" \
  -x "*node_modules*" \
  -x "*.md" \
  -x "*test*" \
  -x "package*.json"

cd ..
echo -e "${GREEN}✅ Chrome extension packaged: genpwd-pro-chrome-v${CHROME_VERSION}.zip${NC}"
echo ""

# Check Chrome ZIP contents
echo -e "${BLUE}📋 Chrome ZIP contents:${NC}"
unzip -l "genpwd-pro-chrome-v${CHROME_VERSION}.zip" | head -20
echo ""

# Package Firefox Extension
echo -e "${BLUE}📦 Packaging Firefox Extension...${NC}"
cd firefox
zip -r "../genpwd-pro-firefox-v${FIREFOX_VERSION}.zip" . \
  -x "*.git*" \
  -x "*.DS_Store" \
  -x "*node_modules*" \
  -x "*.md" \
  -x "*test*" \
  -x "package*.json"

cd ..
echo -e "${GREEN}✅ Firefox extension packaged: genpwd-pro-firefox-v${FIREFOX_VERSION}.zip${NC}"
echo ""

# Check Firefox ZIP contents
echo -e "${BLUE}📋 Firefox ZIP contents:${NC}"
unzip -l "genpwd-pro-firefox-v${FIREFOX_VERSION}.zip" | head -20
echo ""

# Summary
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                   ✅ PACKAGING COMPLETE!                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📦 Chrome:${NC}  genpwd-pro-chrome-v${CHROME_VERSION}.zip"
echo -e "${BLUE}📦 Firefox:${NC} genpwd-pro-firefox-v${FIREFOX_VERSION}.zip"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "   1. Test both extensions locally"
echo "   2. Upload to Chrome Web Store"
echo "   3. Upload to Firefox Add-ons (AMO)"
echo "   4. Monitor review status"
echo ""
