#!/usr/bin/env node
/*
 * Copyright 2026 Julien Bombled
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

/**
 * SRI (Subresource Integrity) Hash Generator
 *
 * Generates SHA-384 hashes for script and style files to enable
 * Subresource Integrity verification.
 *
 * Usage:
 *   node tools/generate-sri.cjs [options]
 *
 * Options:
 *   --output, -o    Output file path (default: stdout)
 *   --format, -f    Output format: json, html, text (default: json)
 *   --dir, -d       Directory to scan (default: src/)
 *   --help, -h      Show help
 *
 * @module generate-sri
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const CONFIG = {
  // File extensions to process
  extensions: ['.js', '.css'],

  // Directories to scan
  directories: ['src/js', 'src/styles', 'src/tests'],

  // Hash algorithm (SHA-256, SHA-384, or SHA-512)
  algorithm: 'sha384',

  // Output format
  format: 'json'
};

/**
 * Generate SRI hash for a file
 * @param {string} filePath - Path to the file
 * @param {string} algorithm - Hash algorithm (sha256, sha384, sha512)
 * @returns {string} SRI hash string
 */
function generateSRIHash(filePath, algorithm = CONFIG.algorithm) {
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash(algorithm).update(content).digest('base64');
  return `${algorithm}-${hash}`;
}

/**
 * Scan directory for files matching extensions
 * @param {string} dir - Directory to scan
 * @param {string[]} extensions - File extensions to match
 * @returns {string[]} Array of file paths
 */
function scanDirectory(dir, extensions = CONFIG.extensions) {
  const results = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      results.push(...scanDirectory(fullPath, extensions));
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Generate SRI manifest for all files
 * @param {string[]} directories - Directories to scan
 * @returns {Object} SRI manifest
 */
function generateManifest(directories = CONFIG.directories) {
  const manifest = {
    generated: new Date().toISOString(),
    algorithm: CONFIG.algorithm,
    files: {}
  };

  for (const dir of directories) {
    const files = scanDirectory(dir);

    for (const file of files) {
      const relativePath = file.replace(/\\/g, '/');
      const sri = generateSRIHash(file);
      manifest.files[relativePath] = {
        sri,
        size: fs.statSync(file).size,
        type: path.extname(file).slice(1)
      };
    }
  }

  return manifest;
}

/**
 * Format manifest as HTML script/link tags
 * @param {Object} manifest - SRI manifest
 * @returns {string} HTML snippet
 */
function formatAsHTML(manifest) {
  const lines = [];

  lines.push('<!-- SRI-enabled script and style tags -->');
  lines.push(`<!-- Generated: ${manifest.generated} -->`);
  lines.push('');

  for (const [filePath, info] of Object.entries(manifest.files)) {
    if (info.type === 'js') {
      lines.push(`<script src="${filePath}" integrity="${info.sri}" crossorigin="anonymous"></script>`);
    } else if (info.type === 'css') {
      lines.push(`<link rel="stylesheet" href="${filePath}" integrity="${info.sri}" crossorigin="anonymous">`);
    }
  }

  return lines.join('\n');
}

/**
 * Format manifest as text
 * @param {Object} manifest - SRI manifest
 * @returns {string} Text output
 */
function formatAsText(manifest) {
  const lines = [];

  lines.push('SRI Hash Manifest');
  lines.push(`Generated: ${manifest.generated}`);
  lines.push(`Algorithm: ${manifest.algorithm}`);
  lines.push('');

  for (const [filePath, info] of Object.entries(manifest.files)) {
    lines.push(`${filePath}`);
    lines.push(`  SRI: ${info.sri}`);
    lines.push(`  Size: ${info.size} bytes`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    output: null,
    format: 'json',
    dir: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i];
    } else if (arg === '--dir' || arg === '-d') {
      options.dir = args[++i];
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
SRI (Subresource Integrity) Hash Generator

Generates SHA-384 hashes for script and style files to enable
Subresource Integrity verification.

Usage:
  node tools/generate-sri.cjs [options]

Options:
  --output, -o    Output file path (default: stdout)
  --format, -f    Output format: json, html, text (default: json)
  --dir, -d       Additional directory to scan
  --help, -h      Show this help message

Examples:
  # Generate JSON manifest to stdout
  node tools/generate-sri.cjs

  # Generate HTML snippet to file
  node tools/generate-sri.cjs -f html -o sri-tags.html

  # Generate text report
  node tools/generate-sri.cjs -f text

  # Scan specific directory
  node tools/generate-sri.cjs -d dist/js
`);
}

/**
 * Main entry point
 */
function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  // Add custom directory if specified
  const directories = [...CONFIG.directories];
  if (options.dir) {
    directories.push(options.dir);
  }

  // Generate manifest
  const manifest = generateManifest(directories);

  // Format output
  let output;
  switch (options.format) {
    case 'html':
      output = formatAsHTML(manifest);
      break;
    case 'text':
      output = formatAsText(manifest);
      break;
    case 'json':
    default:
      output = JSON.stringify(manifest, null, 2);
      break;
  }

  // Write output
  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.log(`SRI manifest written to ${options.output}`);
    console.log(`Files processed: ${Object.keys(manifest.files).length}`);
  } else {
    console.log(output);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for use as module
module.exports = {
  generateSRIHash,
  generateManifest,
  scanDirectory,
  formatAsHTML,
  formatAsText
};
