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

// src/js/test-integration.js - UI integration for test suite
/* global GenPwdTestSuite */

import { sanitizeHTML } from './utils/dom-sanitizer.js';
import { escapeHtml } from './utils/helpers.js';
import { t } from './utils/i18n.js';

document.addEventListener('DOMContentLoaded', function () {
  if (typeof GenPwdTestSuite === 'undefined') {
    console.warn('Test suite not loaded');
    return;
  }

  const testSuite = new GenPwdTestSuite();

  // DOM elements
  const runTestsBtn = document.getElementById('btn-run-tests');
  const testStatus = document.getElementById('test-status');
  const testModal = document.getElementById('test-results-modal');
  const tabResults = document.getElementById('tab-results');
  const tabConsole = document.getElementById('tab-console');
  const testDetails = document.getElementById('test-details');
  const testConsole = document.getElementById('test-console');

  // Bouton principal
  if (runTestsBtn) {
    runTestsBtn.addEventListener('click', async () => {
      runTestsBtn.disabled = true;
      const originalText = runTestsBtn.textContent;
      runTestsBtn.textContent = '⏳ Tests...';
      testStatus.textContent = t('tests.running');
      testStatus.className = 'test-status-running';

      try {
        const results = await testSuite.runAllTests();
        displayTestResults(results);
        showTestModal();

        const score = Math.round((results.passed / (results.passed + results.failed)) * 100);
        testStatus.textContent = `${score}% (${results.passed}/${results.passed + results.failed})`;
        testStatus.className = score === 100 ? 'test-status-success' : score >= 80 ? 'test-status-warning' : 'test-status-error';

      } catch (error) {
        testStatus.textContent = t('tests.error');
        testStatus.className = 'test-status-error';
        console.error('Test error:', error);
      } finally {
        runTestsBtn.disabled = false;
        runTestsBtn.textContent = originalText;
      }
    });
  }

  // Gestion des onglets
  if (tabResults && tabConsole) {
    tabResults.addEventListener('click', () => {
      tabResults.classList.add('active');
      tabConsole.classList.remove('active');
      testDetails.classList.remove('hidden');
      testConsole.classList.add('hidden');
    });

    tabConsole.addEventListener('click', () => {
      tabConsole.classList.add('active');
      tabResults.classList.remove('active');
      testDetails.classList.add('hidden');
      testConsole.classList.remove('hidden');
    });
  }

  // Fermeture modal
  document.getElementById('close-test-results')?.addEventListener('click', closeModal);
  document.getElementById('close-test-results-footer')?.addEventListener('click', closeModal);

  function closeModal() {
    testModal.classList.add('hidden');
  }

  // Relancer tests
  document.getElementById('btn-rerun-tests')?.addEventListener('click', () => {
    closeModal();
    runTestsBtn.click();
  });

  // Export results
  document.getElementById('btn-export-test-results')?.addEventListener('click', () => {
    if (window.lastTestResults) {
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
      const filename = `genpwd-test-results-${timestamp}.json`;

      const blob = new Blob([JSON.stringify(window.lastTestResults, null, 2)],
        { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(`Results exported: ${filename}`);
    }
  });

  function displayTestResults(results) {
    const summary = document.getElementById('test-summary');
    const details = document.getElementById('test-details');
    const consoleOutput = document.getElementById('test-console-output');

    if (summary) {
      const total = results.passed + results.failed;
      const score = Math.round((results.passed / total) * 100);
      const scoreClass = score === 100 ? 'score-100' : score >= 80 ? 'score-80' : 'score-low';
      const duration = Math.round((results.endTime - results.startTime) / 1000);

      summary.innerHTML = sanitizeHTML(`
        <div class="test-score ${scoreClass}">${score}%</div>
        <div class="test-score-info">
          ${results.passed} passed • ${results.failed} failed • ${duration}s
        </div>
        <div class="test-score-version">
          ${total} tests executed on GenPwd Pro v3.1.2
        </div>
      `);
    }

    if (details) {
      let html = '<div class="test-list">';

      // Passed tests
      results.details.forEach((test) => {
        const configErrors = test.configErrors || 0;
        html += `
          <div class="test-item success">
            <div class="test-item-title">✅ ${escapeHtml(test.test)}</div>
            <div class="test-item-info">
              ${test.count} passwords generated${configErrors > 0 ? ` • ${configErrors} elements not found` : ''}
            </div>
            ${test.passwords[0] ? `
              <div class="test-item-example">
                "${escapeHtml(test.passwords[0].password)}" (${escapeHtml(String(test.passwords[0].entropy))})
              </div>
            ` : ''}
          </div>
        `;
      });

      // Failed tests
      results.errors.forEach((error) => {
        html += `
          <div class="test-item error">
            <div class="test-item-title-error">❌ ${escapeHtml(error.test)}</div>
            <div class="test-item-error-message">
              Error: ${escapeHtml(error.error)}
            </div>
          </div>
        `;
      });

      html += '</div>';
      details.innerHTML = html;
    }

    if (consoleOutput) {
      consoleOutput.textContent = testSuite.getConsoleOutput();
    }
  }

  function showTestModal() {
    testModal.classList.remove('hidden');
  }

  // Close modal by clicking outside
  testModal?.addEventListener('click', (e) => {
    if (e.target === testModal) {
      closeModal();
    }
  });

  // API globale pour la console
  window.testSuite = testSuite;
  window.runTests = () => testSuite.runAllTests();
  window.runTest = (name) => testSuite.runSingleTest(name);
});
