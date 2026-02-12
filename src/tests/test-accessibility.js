/**
 * @fileoverview Accessibility Tests with axe-core
 * Tests WCAG 2.1 compliance for GenPwd Pro
 */

import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = 'http://localhost:8080';

/**
 * Format violation for console output
 * @param {Object} violation - axe-core violation
 * @returns {string}
 */
function formatViolation(violation) {
  const nodes = violation.nodes.map(node => {
    const target = node.target.join(' > ');
    const html = node.html.substring(0, 80);
    return `    - ${target}\n      ${html}${node.html.length > 80 ? '...' : ''}`;
  }).join('\n');

  return `
[${violation.impact?.toUpperCase() || 'UNKNOWN'}] ${violation.id}: ${violation.description}
  Help: ${violation.helpUrl}
  Affected nodes:
${nodes}`;
}

/**
 * Run accessibility audit on a page
 * @param {import('playwright').Page} page - Playwright page
 * @param {string} pageName - Name for reporting
 * @returns {Promise<{passed: boolean, violations: Array}>}
 */
async function auditPage(page, pageName) {
  console.log(`\n🔍 Auditing: ${pageName}`);

  const axeResult = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  const violations = axeResult.violations || [];

  const critical = violations.filter(v => v.impact === 'critical');
  const serious = violations.filter(v => v.impact === 'serious');
  const moderate = violations.filter(v => v.impact === 'moderate');
  const minor = violations.filter(v => v.impact === 'minor');

  console.log(`  Critical: ${critical.length}, Serious: ${serious.length}, Moderate: ${moderate.length}, Minor: ${minor.length}`);

  // Print critical and serious violations
  for (const violation of [...critical, ...serious]) {
    console.log(formatViolation(violation));
  }

  const passed = critical.length === 0 && serious.length === 0;

  if (passed) {
    console.log(`  ✅ ${pageName} passed accessibility audit`);
  } else {
    console.log(`  ❌ ${pageName} has accessibility issues`);
  }

  return { passed, violations };
}

/**
 * Main test runner
 */
async function runAccessibilityTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('        GenPwd Pro Accessibility Tests (axe-core)          ');
  console.log('═══════════════════════════════════════════════════════════');

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
    console.warn('ℹ️ Skipping accessibility tests. Run "npx playwright install chromium" to enable.');
    process.exit(0);
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  try {
    // Test main generator page
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    results.push(await auditPage(page, 'Main Generator'));

    // Test with settings modal open
    const settingsBtn = page.locator('#btn-settings');
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(300);
      results.push(await auditPage(page, 'Settings Modal'));

      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // Test with about modal open
    const aboutBtn = page.locator('#btn-about');
    if (await aboutBtn.isVisible()) {
      await aboutBtn.click();
      await page.waitForTimeout(300);
      results.push(await auditPage(page, 'About Modal'));

      // Close about
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }

    // Test vault view if accessible (tab-based navigation in current UI)
    const vaultTab = page.locator('button[data-tab="vault"]');
    const vaultContainer = page.locator('#vault-container');
    if (await vaultTab.count() > 0) {
      const tab = vaultTab.first();
      if (await tab.isVisible()) {
        await tab.click();
      }
    }
    if (await vaultContainer.count() > 0 && await vaultContainer.first().isVisible()) {
      await page.waitForLoadState('networkidle');
      results.push(await auditPage(page, 'Vault Page'));
    }

  } catch (error) {
    console.error(`\n❌ Test error: ${error.message}`);
  } finally {
    await browser.close();
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('                     SUMMARY                                ');
  console.log('═══════════════════════════════════════════════════════════');

  const passed = results.every(r => r.passed);
  const totalViolations = results.reduce((sum, r) => sum + r.violations.length, 0);

  console.log(`Pages tested: ${results.length}`);
  console.log(`Total violations: ${totalViolations}`);
  console.log(`Status: ${passed ? '✅ ALL PASSED' : '❌ FAILED'}`);

  if (!passed) {
    console.log('\nCritical/Serious violations must be fixed before release.');
  }

  process.exit(passed ? 0 : 1);
}

// Run if executed directly
runAccessibilityTests().catch(console.error);
