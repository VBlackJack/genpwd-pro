#!/usr/bin/env node
/**
 * Performance Audit Script
 * Analyzes bundle sizes, file counts, and provides optimization recommendations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

function getDirectorySize(dirPath) {
  let totalSize = 0;
  let fileCount = 0;

  function traverse(currentPath) {
    const stats = fs.statSync(currentPath);

    if (stats.isFile()) {
      totalSize += stats.size;
      fileCount++;
    } else if (stats.isDirectory()) {
      const files = fs.readdirSync(currentPath);
      files.forEach(file => {
        traverse(path.join(currentPath, file));
      });
    }
  }

  traverse(dirPath);
  return { size: totalSize, files: fileCount };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function analyzeFiles(dir, extension) {
  const files = [];

  function traverse(currentPath) {
    const items = fs.readdirSync(currentPath);
    items.forEach(item => {
      const fullPath = path.join(currentPath, item);
      const stats = fs.statSync(fullPath);

      if (stats.isFile() && (extension === '*' || fullPath.endsWith(extension))) {
        files.push({
          path: fullPath.replace(ROOT + '/', ''),
          size: stats.size
        });
      } else if (stats.isDirectory() && !fullPath.includes('node_modules')) {
        traverse(fullPath);
      }
    });
  }

  traverse(dir);
  return files;
}

console.log('🔍 Performance Audit - GenPwd Pro v2.6.0\n');
console.log('=' .repeat(60));

// Analyze JavaScript
const jsDir = path.join(ROOT, 'src/js');
const jsInfo = getDirectorySize(jsDir);
console.log('\n📦 JavaScript Bundle:');
console.log(`   Total Size: ${formatBytes(jsInfo.size)}`);
console.log(`   File Count: ${jsInfo.files} files`);

const jsFiles = analyzeFiles(jsDir, '.js');
jsFiles.sort((a, b) => b.size - a.size);
console.log('\n   Largest JS files:');
jsFiles.slice(0, 5).forEach(file => {
  console.log(`   - ${file.path}: ${formatBytes(file.size)}`);
});

// Analyze CSS
const cssDir = path.join(ROOT, 'src/styles');
const cssInfo = getDirectorySize(cssDir);
console.log('\n🎨 CSS Bundle:');
console.log(`   Total Size: ${formatBytes(cssInfo.size)}`);
console.log(`   File Count: ${cssInfo.files} files`);

const cssFiles = analyzeFiles(cssDir, '.css');
cssFiles.sort((a, b) => b.size - a.size);
console.log('\n   Largest CSS files:');
cssFiles.slice(0, 5).forEach(file => {
  console.log(`   - ${file.path}: ${formatBytes(file.size)}`);
});

// Analyze Dictionaries
const dictDir = path.join(ROOT, 'src/dictionaries');
const dictInfo = getDirectorySize(dictDir);
console.log('\n📚 Dictionaries:');
console.log(`   Total Size: ${formatBytes(dictInfo.size)}`);
console.log(`   File Count: ${dictInfo.files} files`);

const dictFiles = analyzeFiles(dictDir, '.json');
dictFiles.sort((a, b) => b.size - a.size);
dictFiles.forEach(file => {
  console.log(`   - ${file.path}: ${formatBytes(file.size)}`);
});

// Calculate total
const totalSize = jsInfo.size + cssInfo.size;
const totalWithDict = totalSize + dictInfo.size;

console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary:');
console.log(`   Core Bundle (JS + CSS): ${formatBytes(totalSize)}`);
console.log(`   With Dictionaries: ${formatBytes(totalWithDict)}`);
console.log(`   Target (gzipped): <100KB (~33KB uncompressed)`);

// Estimate gzipped size (rough approximation: ~30% of original)
const estimatedGzipped = Math.round(totalSize * 0.3);
console.log(`   Estimated Gzipped: ~${formatBytes(estimatedGzipped)}`);

// Recommendations
console.log('\n💡 Recommendations:');
if (totalSize > 100000) {
  console.log('   ⚠️  Bundle size exceeds 100KB - consider code splitting');
}
if (dictInfo.size > 50000) {
  console.log('   ⚠️  Dictionaries are large - implement lazy loading');
}
if (jsFiles.length > 30) {
  console.log('   ⚠️  Many JS files - consider bundling/minification');
}
console.log('   ✅ Implement lazy loading for dictionaries');
console.log('   ✅ Add resource hints (preload, preconnect)');
console.log('   ✅ Consider service worker for caching');

console.log('\n' + '='.repeat(60));
console.log('✨ Audit complete!\n');
