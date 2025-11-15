#!/bin/bash
set -e

echo "🔍 Vérification de la documentation GenPwd Pro..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Markdownlint (si disponible)
echo "📝 Linting Markdown..."
if command -v markdownlint-cli2 &> /dev/null; then
    markdownlint-cli2 "**/*.md" "#node_modules" "#archive" "#android/archive" "#docs/_archive" || echo "${YELLOW}⚠️  Markdownlint warnings found${NC}"
else
    echo "${YELLOW}⚠️  markdownlint-cli2 not installed, skipping${NC}"
    echo "   Install with: npm install -g markdownlint-cli2"
fi

# 2. Liens morts (check manuel simple)
echo ""
echo "🔗 Vérification des liens internes..."
BROKEN_LINKS=0
while IFS= read -r file; do
    # Extract markdown links
    grep -oP '\]\(\K[^)]+' "$file" 2>/dev/null | while read -r link; do
        # Only check relative links to .md files
        if [[ "$link" =~ ^\.\.?/ ]] && [[ "$link" =~ \.md ]]; then
            # Remove anchor
            link_file="${link%%#*}"
            # Resolve path relative to file
            dir=$(dirname "$file")
            full_path="$dir/$link_file"

            if [ ! -f "$full_path" ]; then
                echo "${RED}❌ Broken link in $file: $link${NC}"
                BROKEN_LINKS=$((BROKEN_LINKS + 1))
            fi
        fi
    done
done < <(find . -name "*.md" -not -path "*/node_modules/*" -not -path "*/archive/*" -not -path "*/_archive/*")

if [ $BROKEN_LINKS -eq 0 ]; then
    echo "${GREEN}✅ No broken internal links found${NC}"
else
    echo "${RED}❌ Found $BROKEN_LINKS broken link(s)${NC}"
fi

# 3. TODO/FIXME
echo ""
echo "⚠️  Recherche de TODO/FIXME..."
TODO_COUNT=$(grep -rn "TODO\|FIXME" --include="*.md" . 2>/dev/null | \
             grep -v "archive\|_archive\|node_modules" | \
             wc -l || echo "0")

if [ "$TODO_COUNT" -gt 0 ]; then
    echo "${YELLOW}⚠️  Found $TODO_COUNT TODO/FIXME in active docs${NC}"
    grep -rn "TODO\|FIXME" --include="*.md" . 2>/dev/null | \
        grep -v "archive\|_archive\|node_modules" | \
        head -10
else
    echo "${GREEN}✅ No TODO/FIXME in active documentation${NC}"
fi

# 4. Versions incohérentes
echo ""
echo "🔢 Vérification des versions..."
if [ -f "package.json" ]; then
    CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
    echo "Version actuelle: $CURRENT_VERSION"

    OUTDATED=$(grep -rn "v[0-9]\.[0-9]\.[0-9]" --include="*.md" . 2>/dev/null | \
               grep -v "CHANGELOG\|archive\|_archive\|node_modules\|v1\.0\.0\|v2\.0\.0" | \
               grep -v "$CURRENT_VERSION" | \
               wc -l || echo "0")

    if [ "$OUTDATED" -gt 0 ]; then
        echo "${YELLOW}⚠️  Found $OUTDATED outdated version reference(s)${NC}"
        grep -rn "v[0-9]\.[0-9]\.[0-9]" --include="*.md" . 2>/dev/null | \
            grep -v "CHANGELOG\|archive\|_archive\|node_modules\|v1\.0\.0\|v2\.0\.0" | \
            grep -v "$CURRENT_VERSION" | \
            head -5
    else
        echo "${GREEN}✅ All versions are consistent${NC}"
    fi
else
    echo "${YELLOW}⚠️  package.json not found, skipping version check${NC}"
fi

# 5. Structure check
echo ""
echo "📁 Vérification de la structure..."
REQUIRED_DIRS=("docs" ".github")
REQUIRED_FILES=("README.md" "CHANGELOG.md" "SECURITY.md" "CONTRIBUTING.md")

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "${GREEN}✅ $dir/ exists${NC}"
    else
        echo "${RED}❌ $dir/ missing${NC}"
    fi
done

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "${GREEN}✅ $file exists${NC}"
    else
        echo "${RED}❌ $file missing${NC}"
    fi
done

echo ""
echo "${GREEN}✅ Vérification terminée!${NC}"
