#!/usr/bin/env node
/*
 * GenPwd Pro - Test Runner
 * Exécute une batterie de tests unitaires rapides pour vérifier
 * les comportements critiques (placements, blocs passphrase, etc.).
 */

const path = require('path');
const { pathToFileURL } = require('url');

async function importModule(relativePath) {
  const moduleUrl = pathToFileURL(path.resolve(relativePath)).href;
  return import(moduleUrl);
}

function round(value, precision = 1) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

async function main() {
  const start = Date.now();
  const tests = [];

  if (typeof global.requestAnimationFrame !== 'function') {
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  }

  if (typeof global.document === 'undefined') {
    global.document = {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    };
  }

  function addTest(name, fn) {
    tests.push({ name, fn });
  }

  const helpers = await importModule('src/js/utils/helpers.js');
  const generators = await importModule('src/js/core/generators.js');
  const constants = await importModule('src/js/config/constants.js');

  const { insertWithPlacement } = helpers;
  const { generatePassphrase } = generators;
  const { DIGITS, CHAR_SETS } = constants;

  addTest('insertWithPlacement append at end', () => {
    const base = 'abc';
    const output = insertWithPlacement(base, ['1', '2'], 'fin');
    if (output !== 'abc12') {
      throw new Error(`Expected "abc12", received "${output}"`);
    }
  });

  addTest('insertWithPlacement preserves sequential end inserts', () => {
    let value = insertWithPlacement('base', 'XY', 'fin');
    value = insertWithPlacement(value, ['!'], 'fin');
    if (value !== 'baseXY!') {
      throw new Error(`Expected "baseXY!", received "${value}"`);
    }
  });

  addTest('generatePassphrase applies blocks without separator', async () => {
    const config = {
      wordCount: 3,
      separator: '',
      digits: 0,
      specials: 0,
      customSpecials: '',
      placeDigits: 'fin',
      placeSpecials: 'fin',
      caseMode: 'blocks',
      useBlocks: true,
      blockTokens: ['T', 'U', 'l'],
      dictionary: 'test',
      wordListOverride: ['alpha', 'bravo', 'charlie']
    };

    const originalRandom = Math.random;
    Math.random = () => 0;
    const result = await generatePassphrase(config);
    Math.random = originalRandom;

    if (result.value !== 'AlphaBRAVOcharlie') {
      throw new Error(`Unexpected passphrase value: ${result.value}`);
    }

    if (result.words.join('') !== 'AlphaBRAVOcharlie') {
      throw new Error('Words array does not reflect applied blocks');
    }

    const expectedEntropy = round(Math.log2(3) * 3);
    if (result.entropy !== expectedEntropy) {
      throw new Error(`Entropy mismatch: expected ${expectedEntropy}, got ${result.entropy}`);
    }
  });

  addTest('generatePassphrase keeps trailing inserts at end', async () => {
    const config = {
      wordCount: 2,
      separator: '-',
      digits: 2,
      specials: 1,
      customSpecials: '',
      placeDigits: 'fin',
      placeSpecials: 'fin',
      caseMode: 'lower',
      useBlocks: false,
      blockTokens: [],
      dictionary: 'test',
      wordListOverride: ['delta', 'echo']
    };

    const originalRandom = Math.random;
    Math.random = () => 0;
    const result = await generatePassphrase(config);
    Math.random = originalRandom;

    const trailing = result.value.slice(-3);
    const specials = CHAR_SETS.standard.specials;
    const chars = trailing.split('');

    const digitCount = chars.filter(ch => DIGITS.includes(ch)).length;
    const specialCount = chars.filter(ch => specials.includes(ch)).length;

    if (digitCount !== config.digits) {
      throw new Error(`Expected ${config.digits} trailing digits, found ${digitCount}`);
    }

    if (specialCount !== config.specials) {
      throw new Error(`Expected ${config.specials} trailing specials, found ${specialCount}`);
    }

    const tailDigits = chars.slice(-config.digits);
    if (!tailDigits.every(ch => DIGITS.includes(ch))) {
      throw new Error(`Trailing characters not all digits: "${tailDigits.join('')}"`);
    }
  });

  let passed = 0;
  const failures = [];

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.error(`❌ ${test.name}: ${error.message}`);
      failures.push({ name: test.name, error });
    }
  }

  const duration = Date.now() - start;
  const total = tests.length;
  const score = Math.round((passed / total) * 100);

  console.log('------------------------------');
  console.log(`Tests réussis : ${passed}/${total}`);
  console.log(`Score : ${score}%`);
  console.log(`Durée : ${duration} ms`);

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Erreur lors de l\'exécution des tests:', error);
  process.exit(1);
});
