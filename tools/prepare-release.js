#!/usr/bin/env node
/**
 * GenPwd Pro - Release Preparation Script
 *
 * This script prepares the project for a production build by:
 * 1. Cleaning build artifacts (dist/, release/, coverage/)
 * 2. Verifying production dependencies
 * 3. Running basic sanity checks
 *
 * Usage: node tools/prepare-release.js
 *
 * Copyright 2025 Julien Bombled - Apache 2.0 License
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  dim: '\x1b[2m'
};

function log(message, type = 'info') {
  const prefix = {
    info: `${colors.blue}[INFO]${colors.reset}`,
    success: `${colors.green}[OK]${colors.reset}`,
    warn: `${colors.yellow}[WARN]${colors.reset}`,
    error: `${colors.red}[ERROR]${colors.reset}`
  };
  console.log(`${prefix[type]} ${message}`);
}

function header(title) {
  console.log(`\n${colors.blue}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.blue}  ${title}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}\n`);
}

/**
 * Remove a directory recursively
 */
function cleanDirectory(dirPath, name) {
  const fullPath = path.join(ROOT_DIR, dirPath);

  if (fs.existsSync(fullPath)) {
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      log(`Removed ${name}: ${dirPath}`, 'success');
      return true;
    } catch (error) {
      log(`Failed to remove ${name}: ${error.message}`, 'error');
      return false;
    }
  } else {
    log(`${name} not found (already clean): ${dirPath}`, 'info');
    return true;
  }
}

/**
 * Verify that a file exists
 */
function verifyFile(filePath, description) {
  const fullPath = path.join(ROOT_DIR, filePath);

  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    const sizeKB = (stats.size / 1024).toFixed(1);
    log(`${description}: ${filePath} (${sizeKB} KB)`, 'success');
    return true;
  } else {
    log(`Missing ${description}: ${filePath}`, 'error');
    return false;
  }
}

/**
 * Verify production dependencies are installed
 */
function verifyDependencies() {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8')
  );

  const deps = Object.keys(packageJson.dependencies || {});
  let allInstalled = true;

  for (const dep of deps) {
    const depPath = path.join(ROOT_DIR, 'node_modules', dep);
    if (fs.existsSync(depPath)) {
      log(`Dependency installed: ${dep}`, 'success');
    } else {
      log(`Dependency missing: ${dep}`, 'error');
      allInstalled = false;
    }
  }

  return allInstalled;
}

/**
 * Run syntax check on main files
 */
function runSyntaxCheck() {
  const filesToCheck = [
    'electron-main.cjs',
    'electron-preload.cjs'
  ];

  let allPassed = true;

  for (const file of filesToCheck) {
    try {
      execSync(`node --check "${path.join(ROOT_DIR, file)}"`, {
        stdio: 'pipe',
        encoding: 'utf-8'
      });
      log(`Syntax OK: ${file}`, 'success');
    } catch (error) {
      log(`Syntax error in ${file}: ${error.message}`, 'error');
      allPassed = false;
    }
  }

  return allPassed;
}

/**
 * Main execution
 */
async function main() {
  console.log(`\n${colors.green}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.green}║     GenPwd Pro - Release Preparation       ║${colors.reset}`);
  console.log(`${colors.green}╚════════════════════════════════════════════╝${colors.reset}\n`);

  // Read package.json for version
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf-8')
  );
  log(`Preparing release v${packageJson.version}`, 'info');

  let success = true;

  // Step 1: Clean build directories
  header('Step 1: Cleaning Build Artifacts');

  success &= cleanDirectory('dist', 'Distribution folder');
  success &= cleanDirectory('release', 'Release folder');
  success &= cleanDirectory('coverage', 'Coverage reports');
  success &= cleanDirectory('.cache', 'Cache folder');

  // Step 2: Verify critical files
  header('Step 2: Verifying Critical Files');

  success &= verifyFile('electron-main.cjs', 'Main process');
  success &= verifyFile('electron-preload.cjs', 'Preload script');
  success &= verifyFile('src/index.html', 'HTML entry');
  success &= verifyFile('src/js/vault-ui.js', 'Vault UI');
  success &= verifyFile('src/styles/vault.css', 'Vault styles');
  success &= verifyFile('assets/icon.ico', 'Application icon');
  success &= verifyFile('src/dictionaries/french.json', 'French dictionary');

  // Step 3: Verify dependencies
  header('Step 3: Verifying Production Dependencies');

  if (!verifyDependencies()) {
    log('Some dependencies are missing. Run: npm install', 'warn');
    success = false;
  }

  // Step 4: Syntax check
  header('Step 4: Running Syntax Checks');

  success &= runSyntaxCheck();

  // Summary
  header('Summary');

  if (success) {
    console.log(`${colors.green}✓ All checks passed!${colors.reset}`);
    console.log(`\n${colors.dim}Ready to build. Run:${colors.reset}`);
    console.log(`  ${colors.blue}npm run electron:build:win${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}✗ Some checks failed. Please fix the issues above.${colors.reset}\n`);
    process.exit(1);
  }
}

main().catch(error => {
  log(`Unexpected error: ${error.message}`, 'error');
  process.exit(1);
});
