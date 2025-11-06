#!/usr/bin/env node

/*
 * Copyright 2025 Julien Bombled
 *
 * Tool to generate PWA icons from source icon.ico
 *
 * Usage:
 *   npm install sharp (required dependency)
 *   node tools/generate-pwa-icons.js
 *
 * This will generate all required PWA icon sizes:
 * 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
 */

const fs = require('fs');
const path = require('path');

// Icon sizes required for PWA
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

const SOURCE_ICON = path.join(__dirname, '../assets/icon-source.png');
const OUTPUT_DIR = path.join(__dirname, '../assets');

async function generateIcons() {
  console.log('🎨 GenPwd Pro - PWA Icon Generator\n');

  // Check if sharp is installed
  let sharp;
  try {
    sharp = require('sharp');
  } catch (error) {
    console.error('❌ Error: sharp library not installed');
    console.error('\nPlease install it with:');
    console.error('  npm install sharp\n');
    process.exit(1);
  }

  // Check if source icon exists
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error(`❌ Error: Source icon not found at ${SOURCE_ICON}`);
    process.exit(1);
  }

  console.log(`📁 Source: ${SOURCE_ICON}`);
  console.log(`📂 Output: ${OUTPUT_DIR}\n`);

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const results = {
    success: [],
    failed: []
  };

  // Generate each icon size
  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);

    try {
      console.log(`⏳ Generating ${size}x${size}...`);

      await sharp(SOURCE_ICON)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);

      const stats = fs.statSync(outputPath);
      console.log(`✅ Created ${outputPath} (${(stats.size / 1024).toFixed(1)} KB)`);
      results.success.push(size);
    } catch (error) {
      console.error(`❌ Failed to generate ${size}x${size}: ${error.message}`);
      results.failed.push(size);
    }
  }

  // Generate Apple touch icon (180x180)
  const appleTouchIconPath = path.join(OUTPUT_DIR, 'apple-touch-icon.png');
  try {
    console.log(`\n⏳ Generating Apple Touch Icon (180x180)...`);

    await sharp(SOURCE_ICON)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(appleTouchIconPath);

    const stats = fs.statSync(appleTouchIconPath);
    console.log(`✅ Created ${appleTouchIconPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  } catch (error) {
    console.error(`❌ Failed to generate Apple Touch Icon: ${error.message}`);
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   ✅ Success: ${results.success.length}/${ICON_SIZES.length} icons`);
  if (results.failed.length > 0) {
    console.log(`   ❌ Failed: ${results.failed.length} icons`);
  }

  console.log('\n🎉 Icon generation complete!');
  console.log('\nNext steps:');
  console.log('1. Verify icons in assets/ directory');
  console.log('2. Update manifest.json with correct paths');
  console.log('3. Test PWA installation\n');
}

// Run the generator
generateIcons().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
