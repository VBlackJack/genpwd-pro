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

document.addEventListener('DOMContentLoaded', function() {
  if (typeof GenPwdTestSuite === 'undefined') {
    console.warn('Suite de tests non chargée');
    return;
  }

  const testSuite = new GenPwdTestSuite();

  // Éléments DOM
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
      testStatus.textContent = 'Exécution...';
      testStatus.className = 'u-color-warning';

      try {
        const results = await testSuite.runAllTests();
        displayTestResults(results);
        showTestModal();

        const score = Math.round((results.passed / (results.passed + results.failed)) * 100);
        testStatus.textContent = `${score}% (${results.passed}/${results.passed + results.failed})`;
        testStatus.className = score === 100 ? 'u-color-success' : score >= 80 ? 'u-color-warning' : 'u-color-error';

      } catch (error) {
        testStatus.textContent = 'Erreur';
        testStatus.className = 'u-color-error';
        console.error('Erreur tests:', error);
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
      testDetails.classList.remove('u-display-none');
      testConsole.classList.add('u-display-none');
    });

    tabConsole.addEventListener('click', () => {
      tabConsole.classList.add('active');
      tabResults.classList.remove('active');
      testDetails.classList.add('u-display-none');
      testConsole.classList.remove('u-display-none');
    });
  }

  // Fermeture modal
  document.getElementById('close-test-results')?.addEventListener('click', closeModal);
  document.getElementById('close-test-results-footer')?.addEventListener('click', closeModal);

  function closeModal() {
    testModal.classList.add('u-display-none');
  }

  // Relancer tests
  document.getElementById('btn-rerun-tests')?.addEventListener('click', () => {
    closeModal();
    runTestsBtn.click();
  });

  // Export résultats
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

      console.log(`Résultats exportés: ${filename}`);
    }
  });

  function displayTestResults(results) {
    const summary = document.getElementById('test-summary');
    const details = document.getElementById('test-details');
    const consoleOutput = document.getElementById('test-console-output');

    if (summary) {
      const total = results.passed + results.failed;
      const score = Math.round((results.passed / total) * 100);
      const scoreClass = score === 100 ? 'score-perfect' : score >= 80 ? 'score-good' : 'score-fail';
      const duration = Math.round((results.endTime - results.startTime) / 1000);

      summary.innerHTML = `
        <div class="test-score ${scoreClass}">${score}%</div>
        <div class="test-meta">
          ${results.passed} réussis • ${results.failed} échoués • ${duration}s
        </div>
        <div class="test-version">
          ${total} tests exécutés sur GenPwd Pro v2.5.1
        </div>
      `;
    }

    if (details) {
      let html = '<div class="test-list">';

      // Tests réussis
      results.details.forEach((test) => {
        const configErrors = test.configErrors || 0;
        html += `
          <div class="test-item success">
            <div class="test-item-title">✅ ${test.test}</div>
            <div class="test-item-info">
              ${test.count} mots générés${configErrors > 0 ? ` • ${configErrors} éléments non trouvés` : ''}
            </div>
            ${test.passwords[0] ? `
              <div class="test-item-example">
                "${test.passwords[0].password}" (${test.passwords[0].entropy})
              </div>
            ` : ''}
          </div>
        `;
      });

      // Tests échoués
      results.errors.forEach((error) => {
        html += `
          <div class="test-item error">
            <div class="test-item-error-title">❌ ${error.test}</div>
            <div class="test-item-error-msg">
              Erreur: ${error.error}
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
    testModal.classList.remove('u-display-none');
  }

  // Fermeture modal en cliquant à l'extérieur
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
