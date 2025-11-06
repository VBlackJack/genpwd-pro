/*
 * Copyright 2025 Julien Bombled
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// tools/compress-dictionaries.js - Compress dictionary files for better performance

import { readFile, writeFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const DICT_DIR = join(PROJECT_ROOT, 'src', 'dictionaries');

/**
 * Get file size in bytes
 */
async function getFileSize(filePath) {
  const stats = await stat(filePath);
  return stats.size;
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Compress dictionary file
 */
async function compressDictionary(filename) {
  console.log(`\nProcessing ${filename}...`);

  const inputPath = join(DICT_DIR, filename);
  const outputPath = join(DICT_DIR, `${filename}.gz`);

  try {
    // Read original file
    const originalData = await readFile(inputPath);
    const originalSize = originalData.length;

    console.log(`  Original size: ${formatBytes(originalSize)}`);

    // Compress
    const compressed = await gzipAsync(originalData, {
      level: 9 // Maximum compression
    });
    const compressedSize = compressed.length;

    // Write compressed file
    await writeFile(outputPath, compressed);

    console.log(`  Compressed size: ${formatBytes(compressedSize)}`);
    console.log(`  Compression ratio: ${Math.round((1 - compressedSize / originalSize) * 100)}%`);
    console.log(`  Saved: ${formatBytes(originalSize - compressedSize)}`);
    console.log(`  ✅ Created: ${outputPath}`);

    return {
      filename,
      originalSize,
      compressedSize,
      ratio: (1 - compressedSize / originalSize) * 100
    };
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Minify JSON (remove whitespace)
 */
async function minifyDictionary(filename) {
  console.log(`\nMinifying ${filename}...`);

  const inputPath = join(DICT_DIR, filename);
  const outputPath = join(DICT_DIR, filename.replace('.json', '.min.json'));

  try {
    const data = await readFile(inputPath, 'utf8');
    const parsed = JSON.parse(data);

    const originalSize = data.length;

    // Minify (no whitespace)
    const minified = JSON.stringify(parsed);
    const minifiedSize = minified.length;

    await writeFile(outputPath, minified);

    console.log(`  Original size: ${formatBytes(originalSize)}`);
    console.log(`  Minified size: ${formatBytes(minifiedSize)}`);
    console.log(`  Saved: ${formatBytes(originalSize - minifiedSize)}`);
    console.log(`  ✅ Created: ${outputPath}`);

    return {
      filename,
      originalSize,
      minifiedSize,
      saved: originalSize - minifiedSize
    };
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Dictionary Compression Tool');
  console.log('='.repeat(60));

  const dictionaries = [
    'french.json',
    'english.json',
    'latin.json'
  ];

  const results = {
    compressed: [],
    minified: []
  };

  // Compress dictionaries
  console.log('\n📦 Compressing dictionaries with gzip...');
  for (const dict of dictionaries) {
    const result = await compressDictionary(dict);
    if (result) {
      results.compressed.push(result);
    }
  }

  // Minify dictionaries
  console.log('\n🗜️  Minifying dictionaries...');
  for (const dict of dictionaries) {
    const result = await minifyDictionary(dict);
    if (result) {
      results.minified.push(result);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));

  if (results.compressed.length > 0) {
    console.log('\nGzip Compression:');
    let totalOriginal = 0;
    let totalCompressed = 0;

    for (const result of results.compressed) {
      totalOriginal += result.originalSize;
      totalCompressed += result.compressedSize;
      console.log(`  ${result.filename}: ${Math.round(result.ratio)}% reduction`);
    }

    console.log(`\n  Total original: ${formatBytes(totalOriginal)}`);
    console.log(`  Total compressed: ${formatBytes(totalCompressed)}`);
    console.log(`  Total saved: ${formatBytes(totalOriginal - totalCompressed)}`);
    console.log(`  Overall ratio: ${Math.round((1 - totalCompressed / totalOriginal) * 100)}%`);
  }

  if (results.minified.length > 0) {
    console.log('\nMinification:');
    let totalSaved = 0;

    for (const result of results.minified) {
      totalSaved += result.saved;
      console.log(`  ${result.filename}: ${formatBytes(result.saved)} saved`);
    }

    console.log(`\n  Total saved: ${formatBytes(totalSaved)}`);
  }

  console.log('\n✅ Compression complete!');
  console.log('\nUsage in production:');
  console.log('  - Configure web server to serve .gz files with gzip encoding');
  console.log('  - Or use .min.json files for smaller transfer size');
  console.log('  - Set appropriate Cache-Control headers');
}

// Run
main().catch(console.error);
