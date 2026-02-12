#!/usr/bin/env node

/**
 * Browser tests using Playwright
 * Tests the application in a real browser environment
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distPath = join(__dirname, '..', 'dist', 'index.html');

async function runBrowserTests() {
  console.log('🌐 Running Browser Tests with Playwright...\n');

  // Check if dist/index.html exists
  if (!existsSync(distPath)) {
    console.error('❌ Error: dist/index.html not found. Please run "npm run build" first.');
    process.exit(1);
  }

  const strictBrowserRequirement = process.env.PLAYWRIGHT_REQUIRE_BROWSER === '1';
  const browserExecutable = chromium.executablePath();
  if (!existsSync(browserExecutable)) {
    const msg = `⚠️ Playwright browser executable not found: ${browserExecutable}`;
    if (strictBrowserRequirement) {
      console.error(msg);
      process.exit(1);
      return;
    }
    console.warn(msg);
    console.warn('ℹ️ Skipping browser tests. Run "npx playwright install chromium" to enable.');
    process.exit(0);
    return;
  }

  let browser;
  let passed = 0;
  let failed = 0;
  const errors = [];

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security', // Allow file:// protocol to work better
      ]
    });

    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    // Set up console log capture (but don't fail on resource errors)
    page.on('console', msg => {
      const text = msg.text();
      // Only log actual errors, not resource loading issues from file://
      if (text.includes('ERROR') && !text.includes('ERR_FILE_NOT_FOUND') && !text.includes('Failed to load resource')) {
        console.log(`  Browser Console: ${text}`);
      }
    });

    // Set up error handling (but be tolerant of resource loading errors)
    page.on('pageerror', error => {
      const message = error.message;
      // Ignore common file:// protocol errors
      if (!message.includes('Failed to fetch') && !message.includes('NetworkError')) {
        console.error(`  ⚠️  Page Error: ${message}`);
        errors.push(message);
      }
    });

    // Load the application with a longer timeout and be tolerant of failures
    console.log('📄 Loading application...');
    try {
      await page.goto(`file://${distPath}`, {
        waitUntil: 'domcontentloaded', // Less strict than 'networkidle'
        timeout: 15000
      });
    } catch (error) {
      // If page load fails, try to continue anyway
      console.log(`  ⚠️  Page load warning: ${error.message}`);
      console.log('  Attempting to continue tests...');
    }

    // Wait a bit for any JS to initialize
    await page.waitForTimeout(1000);

    // Test 1: Check if page loads
    const pageTitle = await page.title();
    if (pageTitle) {
      console.log(`✓ Test 1: Page loads successfully (${pageTitle})`);
      passed++;
    } else {
      console.error('✗ Test 1: Page failed to load');
      failed++;
    }

    // Test 2: Check if main UI elements exist
    try {
      const hasGenerateButton = await page.evaluate(() => {
        return !!document.querySelector('#generate-btn');
      });

      if (hasGenerateButton) {
        console.log('✓ Test 2: Generate button found');
        passed++;
      } else {
        console.error('✗ Test 2: Generate button not found');
        failed++;
      }
    } catch (error) {
      console.error(`✗ Test 2: Error checking for generate button - ${error.message}`);
      failed++;
    }

    // Test 3: Check if password output exists
    try {
      const hasPasswordOutput = await page.evaluate(() => {
        return !!document.querySelector('#password-output');
      });

      if (hasPasswordOutput) {
        console.log('✓ Test 3: Password output element found');
        passed++;
      } else {
        console.error('✗ Test 3: Password output element not found');
        failed++;
      }
    } catch (error) {
      console.error(`✗ Test 3: Error checking for password output - ${error.message}`);
      failed++;
    }

    // Test 4: Test password generation
    try {
      const generateBtnExists = await page.locator('#generate-btn').count();
      if (generateBtnExists > 0) {
        await page.click('#generate-btn', { timeout: 5000 });
        await page.waitForTimeout(1000); // Wait for generation

        const passwordValue = await page.evaluate(() => {
          const output = document.querySelector('#password-output');
          return output ? output.value || output.textContent : '';
        });

        if (passwordValue && passwordValue.trim().length > 0) {
          console.log(`✓ Test 4: Password generated successfully (${passwordValue.length} chars)`);
          passed++;
        } else {
          console.error('✗ Test 4: Password generation failed - empty output');
          failed++;
        }
      } else {
        console.error('✗ Test 4: Generate button not found, skipping generation test');
        failed++;
      }
    } catch (error) {
      console.error(`✗ Test 4: Error during password generation - ${error.message}`);
      failed++;
    }

    // Test 5: Check for critical JavaScript errors
    if (errors.length === 0) {
      console.log('✓ Test 5: No critical JavaScript errors detected');
      passed++;
    } else {
      console.error(`✗ Test 5: ${errors.length} JavaScript errors detected:`);
      errors.forEach(err => console.error(`    - ${err}`));
      failed++;
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Browser Test Summary');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    if (passed + failed > 0) {
      console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(2)}%`);
    }
    console.log('='.repeat(50));

    if (failed > 0) {
      console.error('\n⚠️  Some browser tests failed. Please review the errors above.');
      process.exit(1);
    }

  } catch (error) {
    console.error(`\n❌ Browser test error: ${error.message}`);
    console.error(error.stack);
    if (error.message.includes('browserType.launch')) {
      console.error('\n💡 Hint: Run "npx playwright install chromium --with-deps" to install the browser.');
    }
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run tests
runBrowserTests().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
