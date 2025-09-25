#!/usr/bin/env node
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
// tools/run-tests.js - Runner pour les tests depuis Node.js

const fs = require('fs');
const path = require('path');

function runTestSuite() {
  console.log('GenPwd Pro - Test Suite');
  console.log('=======================');
  console.log('');
  
  console.log('Mode d\'exécution disponible:');
  console.log('1. Console navigateur: Ouvrez votre app et tapez runTests()');
  console.log('2. Interface web: Utilisez le bouton "Lancer Tests" dans l\'app');
  console.log('3. Automatisé: npm run test:browser (nécessite Puppeteer)');
  console.log('');
  
  // Vérifier si les fichiers nécessaires existent
  const requiredFiles = [
    'src/index.html',
    'src/tests/test-suite.js'
  ];
  
  console.log('Vérification des fichiers:');
  let allFilesExist = true;
  
  requiredFiles.forEach(file => {
    const exists = fs.existsSync(path.join(process.cwd(), file));
    console.log(`${exists ? '✓' : '✗'} ${file}`);
    if (!exists) allFilesExist = false;
  });
  
  if (!allFilesExist) {
    console.log('');
    console.log('ERREUR: Fichiers manquants. Assurez-vous que:');
    console.log('- tools/test-suite.js est présent');
    console.log('- src/index.html inclut le script de tests');
    process.exit(1);
  }
  
  console.log('');
  console.log('Tous les fichiers sont présents!');
  console.log('');
  console.log('Pour exécuter les tests:');
  console.log('1. Démarrez l\'app: npm run dev');
  console.log('2. Ouvrez http://localhost:3000');
  console.log('3. Ouvrez la console (F12) et tapez: runTests()');
  console.log('4. Ou utilisez le bouton dans l\'interface');
}

// Fonction pour créer un test browser automatisé (optionnel)
function createBrowserTest() {
  const browserTestContent = `// tools/browser-test.js - Tests automatisés avec Puppeteer
const puppeteer = require('puppeteer');
const path = require('path');

async function runBrowserTests() {
  console.log('Démarrage des tests browser automatisés...');
  
  const browser = await puppeteer.launch({ 
    headless: false, // Mettre à true pour mode silencieux
    devtools: false 
  });
  
  try {
    const page = await browser.newPage();
    
    // Naviguer vers l'app (ajustez l'URL selon votre config)
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    // Attendre que l'app soit chargée
    await page.waitForSelector('#btn-generate', { timeout: 10000 });
    
    console.log('App chargée, lancement des tests...');
    
    // Exécuter les tests
    const results = await page.evaluate(async () => {
      if (typeof window.runTests === 'function') {
        return await window.runTests();
      } else {
        throw new Error('Suite de tests non trouvée');
      }
    });
    
    // Afficher les résultats
    console.log('\\n=== RÉSULTATS DES TESTS ===');
    console.log(\`Tests réussis: \${results.passed}\`);
    console.log(\`Tests échoués: \${results.failed}\`);
    console.log(\`Score: \${Math.round((results.passed / (results.passed + results.failed)) * 100)}%\`);
    
    if (results.errors.length > 0) {
      console.log('\\nERREURS:');
      results.errors.forEach((err, i) => {
        console.log(\`\${i + 1}. \${err.test}: \${err.error}\`);
      });
    }
    
    // Sauvegarder les résultats
    const fs = require('fs');
    fs.writeFileSync('test-results.json', JSON.stringify(results, null, 2));
    console.log('\\nRésultats sauvegardés dans test-results.json');
    
    process.exit(results.failed === 0 ? 0 : 1);
    
  } catch (error) {
    console.error('Erreur lors des tests:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runBrowserTests().catch(console.error);
`;

  fs.writeFileSync('tools/browser-test.js', browserTestContent);
  console.log('Fichier tools/browser-test.js créé!');
}

// CLI
const args = process.argv.slice(2);

if (args.includes('--create-browser-test')) {
  createBrowserTest();
} else {
  runTestSuite();
}
