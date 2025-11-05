#!/usr/bin/env node
/*
 * Exécution automatisée de la suite de tests GenPwd Pro côté Node.
 * Les tests vérifient les mêmes scénarios fonctionnels que la batterie UI
 * (générations syllabiques, passphrases, placements, etc.) sans nécessiter
 * un navigateur headless.
 */

const path = require('path');
const { pathToFileURL } = require('url');

// Stubs DOM/api nécessaires aux modules front
if (typeof global.document === 'undefined') {
  global.document = {
    getElementById: () => null
  };
}

if (typeof global.requestAnimationFrame === 'undefined') {
  global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}

const originalMathRandom = Math.random;

function createPRNG(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function withSeed(seed, fn) {
  Math.random = createPRNG(seed);
  try {
    return await fn();
  } finally {
    Math.random = originalMathRandom;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function importModule(relativePath) {
  const url = pathToFileURL(path.join(process.cwd(), relativePath)).href;
  return import(url);
}

function formatTimestamp() {
  return new Date().toTimeString().split(' ')[0];
}

function countMatches(str, regex) {
  const matches = str.match(regex);
  return matches ? matches.length : 0;
}

class NodeTestRunner {
  constructor(modules) {
    this.modules = modules;
    this.tests = this.buildTests();
  }

  buildTests() {
    const {
      generateSyllables,
      generatePassphrase,
      generateLeet,
      ensureMinimumEntropy,
      insertWithPlacement,
      setDigitPositions,
      setSpecialPositions
    } = this.modules;

    const wordListA = ['critere', 'beatifie', 'liquide', 'atelier', 'opera'];
    const wordListB = ['atroce', 'visqueux', 'cidre', 'brigade', 'orchidee'];

    return [
      {
        name: 'Syllables - Base',
        run: async (ctx) => withSeed(100 + ctx.run, () => {
          const result = generateSyllables({
            length: 20,
            policy: 'standard',
            digits: 1,
            specials: 1,
            customSpecials: '',
            placeDigits: 'fin',
            placeSpecials: 'milieu',
            caseMode: 'mixte',
            useBlocks: false,
            blockTokens: []
          });

          assert(result.value.length === 20, 'Longueur syllables incorrecte');
          assert(/\d/.test(result.value), 'Chiffre manquant');
          assert(/[^a-zA-Z0-9]/.test(result.value), 'Caractère spécial manquant');
          return { sample: result.value, entropy: result.entropy };
        })
      },
      {
        name: 'Syllables - Blocks',
        run: async (ctx) => withSeed(200 + ctx.run, () => {
          const result = generateSyllables({
            length: 15,
            policy: 'standard',
            digits: 2,
            specials: 1,
            customSpecials: '',
            placeDigits: 'aleatoire',
            placeSpecials: 'aleatoire',
            caseMode: 'blocks',
            useBlocks: true,
            blockTokens: ['T', 'l', 'U', 'T']
          });

          assert(/[A-Z]/.test(result.value) && /[a-z]/.test(result.value),
            'Pattern de casse blocs non appliqué');
          assert(result.value.length === 15, 'Longueur bloc syllables incorrecte');
          return { sample: result.value, entropy: result.entropy };
        })
      },
      {
        name: 'Passphrase - Français',
        run: async (ctx) => withSeed(300 + ctx.run, async () => {
          const result = await generatePassphrase({
            wordCount: 3,
            separator: '-',
            digits: 0,
            specials: 0,
            customSpecials: '',
            placeDigits: 'fin',
            placeSpecials: 'fin',
            caseMode: 'title',
            useBlocks: false,
            blockTokens: [],
            dictionary: 'french',
            wordListOverride: wordListA
          });

          const parts = result.value.split('-');
          assert(parts.length === 3, 'Nombre de mots incorrect');
          parts.forEach((word) => {
            assert(/^\p{Lu}[\p{Ll}]+$/u.test(word), 'Mot non en Title Case');
          });
          return { sample: result.value, entropy: result.entropy };
        })
      },
      {
        name: 'Passphrase - Blocks',
        run: async (ctx) => withSeed(400 + ctx.run, async () => {
          const blockTokens = ['T', 'l', 'U', 'T'];
          const result = await generatePassphrase({
            wordCount: 4,
            separator: '-',
            digits: 0,
            specials: 0,
            customSpecials: '',
            placeDigits: 'fin',
            placeSpecials: 'fin',
            caseMode: 'blocks',
            useBlocks: true,
            blockTokens,
            dictionary: 'french',
            wordListOverride: wordListB
          });

          const parts = result.value.split('-');
          assert(parts.length === 4, 'Passphrase bloc incomplet');
          parts.forEach((word, index) => {
            const token = blockTokens[index % blockTokens.length];
            if (token === 'T') {
              assert(/^\p{Lu}[\p{Ll}]+$/u.test(word), `Mot ${index + 1} devrait être en Title case`);
            } else if (token === 'l') {
              assert(word === word.toLowerCase(), `Mot ${index + 1} devrait être en minuscules`);
            } else if (token === 'U') {
              assert(word === word.toUpperCase(), `Mot ${index + 1} devrait être en majuscules`);
            }
          });
          return { sample: result.value, entropy: result.entropy };
        })
      },
      {
        name: 'Leet - Password',
        run: async (ctx) => withSeed(500 + ctx.run, () => {
          const result = generateLeet({
            baseWord: 'password',
            digits: 1,
            specials: 1,
            customSpecials: '',
            placeDigits: 'fin',
            placeSpecials: 'debut',
            caseMode: 'mixte',
            useBlocks: false,
            blockTokens: []
          });

          assert(/[@50]/.test(result.value), 'Transformation leet non détectée');
          assert(/\d$/.test(result.value), 'Chiffre final manquant');
          assert(/^[^a-zA-Z]/.test(result.value), 'Symbole leet début manquant');
          return { sample: result.value, entropy: result.entropy };
        })
      },
      {
        name: 'Leet - Hello Blocks',
        run: async (ctx) => withSeed(600 + ctx.run, () => {
          const result = generateLeet({
            baseWord: 'hello',
            digits: 1,
            specials: 1,
            customSpecials: '#',
            placeDigits: 'fin',
            placeSpecials: 'fin',
            caseMode: 'blocks',
            useBlocks: true,
            blockTokens: ['U', 'l']
          });

          const letters = result.value.match(/\p{L}/gu) || [];
          if (letters.length > 0) {
            assert(letters[0] === letters[0].toUpperCase(),
              'Première lettre devrait être en majuscule');
            letters.slice(1).forEach((letter, index) => {
              assert(letter === letter.toLowerCase(),
                `Lettre ${index + 2} devrait être en minuscule`);
            });
          }
          assert(result.value.endsWith('#' + result.value.slice(-1)), 'Spécial fin attendu');
          return { sample: result.value, entropy: result.entropy };
        })
      },
      {
        name: '#CLI-SAFE: Vérification S→5',
        run: async () => {
          console.log('Test #CLI-SAFE: Vérification S→5 (aucun dollar attendu)');
          const leetTest = generateLeet({
            baseWord: 'password',
            digits: 0,
            specials: 0,
            customSpecials: '',
            placeDigits: 'fin',
            placeSpecials: 'fin',
            caseMode: 'mixte',
            useBlocks: false,
            blockTokens: []
          });

          if (leetTest.value.includes('\u0024')) {
            console.log('❌ ÉCHEC: Le caractère dollar est présent (non CLI-safe)');
          }

          assert(!leetTest.value.includes('\u0024'), 'Le caractère dollar ne doit plus apparaître');
          assert(leetTest.value.includes('5'), 'La substitution S→5 doit être appliquée');
          console.log('✅ SUCCÈS: S→5 appliqué correctement');
          return { sample: leetTest.value };
        }
      },
      {
        name: 'CLI-SAFE: Aucun caractère dangereux',
        run: async () => {
          const dangerous = ['\u0024', '^', '&', '*', "'"];
          const results = [];

          for (let i = 0; i < 40; i++) {
            const defaultSyllables = generateSyllables({
              length: 12,
              policy: 'standard',
              digits: 0,
              specials: 3,
              customSpecials: '',
              placeDigits: 'fin',
              placeSpecials: 'milieu',
              caseMode: 'mixte',
              useBlocks: false,
              blockTokens: []
            }).value;

            const customSyllables = generateSyllables({
              length: 12,
              policy: 'standard',
              digits: 0,
              specials: 3,
              customSpecials: '@#%',
              placeDigits: 'milieu',
              placeSpecials: 'debut',
              caseMode: 'mixte',
              useBlocks: false,
              blockTokens: []
            }).value;

            const leetValue = generateLeet({
              baseWord: 'password',
              digits: 1,
              specials: 2,
              customSpecials: '',
              placeDigits: 'fin',
              placeSpecials: 'debut',
              caseMode: 'mixte',
              useBlocks: false,
              blockTokens: []
            }).value;

            const passphrase = await generatePassphrase({
              wordCount: 5,
              separator: '-',
              digits: 0,
              specials: 2,
              customSpecials: '@#%',
              placeDigits: 'fin',
              placeSpecials: 'milieu',
              caseMode: 'title',
              useBlocks: false,
              blockTokens: [],
              dictionary: 'french'
            });

            results.push(defaultSyllables, customSyllables, leetValue, passphrase.value);
          }

          const found = dangerous.filter((char) => results.some((value) => value.includes(char)));

          assert(found.length === 0, `Caractères dangereux trouvés: ${found}`);
          return { tested: results.length };
        }
      },
      {
        name: 'Placement - Début',
        run: async (ctx) => withSeed(700 + ctx.run, () => {
          const result = generateSyllables({
            length: 12,
            policy: 'standard',
            digits: 2,
            specials: 1,
            customSpecials: '',
            placeDigits: 'debut',
            placeSpecials: 'debut',
            caseMode: 'mixte',
            useBlocks: false,
            blockTokens: []
          });

          const prefix = result.value.slice(0, 3);
          assert(/^[^a-zA-Z]{3}$/.test(prefix), 'Les insertions début ne sont pas en tête');
          assert(result.value.length === 12, 'Longueur placement début incorrecte');
          return { sample: result.value };
        })
      },
      {
        name: 'Placement - Fin',
        run: async (ctx) => withSeed(800 + ctx.run, () => {
          const result = generateSyllables({
            length: 12,
            policy: 'standard',
            digits: 2,
            specials: 1,
            customSpecials: '',
            placeDigits: 'fin',
            placeSpecials: 'fin',
            caseMode: 'mixte',
            useBlocks: false,
            blockTokens: []
          });

          const suffix = result.value.slice(-3);
          assert(/^[^a-zA-Z]{3}$/.test(suffix), 'Les insertions fin ne sont pas en queue');
          assert(/\d$/.test(result.value), 'Dernier caractère devrait être un chiffre');
          return { sample: result.value };
        })
      },
      {
        name: 'Placement - Visuel',
        run: async (ctx) => withSeed(900 + ctx.run, () => {
          setDigitPositions([0, 100]);
          setSpecialPositions([0, 50, 100]);

          const result = generateSyllables({
            length: 12,
            policy: 'standard',
            digits: 2,
            specials: 3,
            customSpecials: '',
            placeDigits: 'positions',
            placeSpecials: 'positions',
            caseMode: 'mixte',
            useBlocks: false,
            blockTokens: []
          });

          const digitCount = countMatches(result.value, /\d/g);
          const specialCount = countMatches(result.value, /[^a-zA-Z0-9]/g);
          assert(digitCount === 2, 'Nombre de chiffres positionnels incorrect');
          assert(specialCount >= 3, 'Nombre de spéciaux positionnels incorrect');
          assert(/^[^a-zA-Z]/.test(result.value), 'Un caractère positionné devrait ouvrir la chaîne');
          assert(/[^a-zA-Z]$/.test(result.value), 'Un caractère positionné devrait clôturer la chaîne');

          setDigitPositions([]);
          setSpecialPositions([]);
          return { sample: result.value };
        })
      },
      {
        name: 'Politique Layout-Safe',
        run: async (ctx) => withSeed(1000 + ctx.run, () => {
          const result = generateSyllables({
            length: 18,
            policy: 'standard-layout',
            digits: 1,
            specials: 0,
            customSpecials: '',
            placeDigits: 'debut',
            placeSpecials: 'milieu',
            caseMode: 'mixte',
            useBlocks: false,
            blockTokens: []
          });

          assert(!/[aA]/.test(result.value), 'Lettre "a" détectée dans le layout-safe');
          return { sample: result.value, entropy: result.entropy };
        })
      },
      {
        name: 'Spéciaux Personnalisés',
        run: async (ctx) => withSeed(1100 + ctx.run, () => {
          const custom = '@#%';
          const result = generateSyllables({
            length: 15,
            policy: 'standard',
            digits: 0,
            specials: 3,
            customSpecials: custom,
            placeDigits: 'milieu',
            placeSpecials: 'milieu',
            caseMode: 'mixte',
            useBlocks: false,
            blockTokens: []
          });

          const specials = result.value.match(/[^a-zA-Z0-9]/g) || [];
          specials.forEach((ch) => {
            assert(custom.includes(ch), `Caractère spécial inattendu: ${ch}`);
          });
          return { sample: result.value };
        })
      },
      {
        name: 'Quantité Élevée',
        run: async (ctx) => withSeed(1200 + ctx.run, () => {
          const outputs = Array.from({ length: 8 }, () => generateSyllables({
            length: 12,
            policy: 'standard',
            digits: 1,
            specials: 1,
            customSpecials: '',
            placeDigits: 'fin',
            placeSpecials: 'debut',
            caseMode: 'mixte',
            useBlocks: false,
            blockTokens: []
          }));

          assert(outputs.length === 8, 'Quantité générée incorrecte');
          outputs.forEach((res) => {
            assert(res.value.length === 12, 'Longueur incorrecte dans la génération multiple');
          });
          return { count: outputs.length, sample: outputs[0].value };
        })
      },
      {
        name: '#ENTROPY-MIN: Vérification entropie ≥100 bits',
        run: async () => {
          console.log('Test #ENTROPY-MIN: Vérification entropie ≥100 bits');
          const generatorConfig = {
            length: 12,
            policy: 'standard',
            digits: 0,
            specials: 0,
            customSpecials: '',
            placeDigits: 'fin',
            placeSpecials: 'fin',
            caseMode: 'mixte',
            useBlocks: false,
            blockTokens: []
          };

          const entropyConfig = {
            mode: 'syllables',
            policy: 'standard',
            digits: 0,
            specials: 0,
            customSpecials: ''
          };

          const entropyTest = await ensureMinimumEntropy(
            () => generateSyllables(generatorConfig),
            entropyConfig
          );

          if (entropyTest.entropy >= 100) {
            console.log(`✅ SUCCÈS: Entropie ${entropyTest.entropy} bits ≥ 100`);
          }

          assert(entropyTest.entropy >= 100,
            `Entropie ${entropyTest.entropy} bits < 100`);
          return { sample: entropyTest.value, entropy: entropyTest.entropy };
        }
      },
      {
        name: '#ENTROPY-MIN: Passphrase ≥100 bits',
        run: async (ctx) => withSeed(1300 + ctx.run, async () => {
          console.log('Test #ENTROPY-MIN: Passphrase entropie ≥100 bits');
          const entropyConfig = {
            mode: 'passphrase',
            dictSize: 2429,
            wordCount: 5,
            digits: 0,
            specials: 0,
            sepChoices: 1,
            policy: 'standard'
          };

          const passphraseTest = await ensureMinimumEntropy(
            async () => await generatePassphrase({
              wordCount: 5,
              separator: '-',
              digits: 0,
              specials: 0,
              customSpecials: '',
              placeDigits: 'fin',
              placeSpecials: 'fin',
              caseMode: 'title',
              useBlocks: false,
              blockTokens: [],
              dictionary: 'french'
            }),
            entropyConfig
          );

          assert(passphraseTest.entropy >= 100,
            `Entropie passphrase ${passphraseTest.entropy} bits < 100`);

          return { sample: passphraseTest.value, entropy: passphraseTest.entropy };
        })
      },
      {
        name: 'API Insertion',
        run: async () => {
          const base = 'abc';
          const chars = ['1', '2'];
          assert(insertWithPlacement(base, chars, 'debut') === '12abc', 'Insertion début invalide');
          assert(insertWithPlacement(base, chars, 'fin') === 'abc12', 'Insertion fin invalide');
          assert(insertWithPlacement(base, chars, 'milieu') === 'a12bc', 'Insertion milieu invalide');
          return { sample: '12abc / abc12 / a12bc' };
        }
      }
    ];
  }

  async runAll(runs = 1) {
    const summary = [];

    for (let run = 1; run <= runs; run++) {
      const results = { passed: 0, failed: 0, errors: [], details: [] };
      console.log(`[${formatTimestamp()}] ℹ️ 🚀 DÉBUT DES TESTS (run ${run}/${runs})`);
      console.log(`[${formatTimestamp()}] ℹ️ ==================================================`);

      for (const test of this.tests) {
        try {
          const detail = await test.run({ run });
          results.passed++;
          results.details.push({ test: test.name, detail });
          const sample = detail?.sample ? ` - Exemple: "${detail.sample}"` : '';
          console.log(`[${formatTimestamp()}] ✅ ${test.name}${sample}`);
        } catch (error) {
          results.failed++;
          results.errors.push({ test: test.name, error: error.message });
          console.log(`[${formatTimestamp()}] ❌ ${test.name} - ${error.message}`);
        }
      }

      const total = results.passed + results.failed;
      const score = total > 0 ? Math.round((results.passed / total) * 100) : 0;

      console.log(`[${formatTimestamp()}] ℹ️ ==================================================`);
      console.log(`[${formatTimestamp()}] ℹ️ 📊 RAPPORT FINAL`);
      console.log(`[${formatTimestamp()}] ℹ️ ==================================================`);
      console.log(`[${formatTimestamp()}] ℹ️ ✅ Tests réussis: ${results.passed}`);
      console.log(`[${formatTimestamp()}] ℹ️ ❌ Tests échoués: ${results.failed}`);
      console.log(`[${formatTimestamp()}] ℹ️ 📈 Score: ${score}%`);

      if (results.errors.length > 0) {
        console.log(`[${formatTimestamp()}] ℹ️ 🚨 ERREURS:`);
        results.errors.forEach((err, idx) => {
          console.log(`[${formatTimestamp()}] ℹ️  ${idx + 1}. ${err.test}: ${err.error}`);
        });
      }

      summary.push({ run, ...results, score });
      console.log('');
    }

    return summary;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const runsArg = args.find(arg => arg.startsWith('--runs'));
  let runs = 1;

  if (runsArg) {
    const value = runsArg.includes('=') ? runsArg.split('=')[1] : args[args.indexOf(runsArg) + 1];
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      runs = parsed;
    }
  }

  const generatorsModule = await importModule('src/js/core/generators.js');
  const helpersModule = await importModule('src/js/utils/helpers.js');

  const runner = new NodeTestRunner({
    generateSyllables: generatorsModule.generateSyllables,
    generatePassphrase: generatorsModule.generatePassphrase,
    generateLeet: generatorsModule.generateLeet,
    ensureMinimumEntropy: generatorsModule.ensureMinimumEntropy,
    insertWithPlacement: helpersModule.insertWithPlacement,
    setDigitPositions: helpersModule.setDigitPositions,
    setSpecialPositions: helpersModule.setSpecialPositions
  });

  const results = await runner.runAll(runs);
  const lastRun = results[results.length - 1];

  let vaultFailed = false;
  try {
    console.log(`[${formatTimestamp()}] ℹ️ --------------------------------------------------`);
    console.log(`[${formatTimestamp()}] ℹ️ 🔐 TESTS CONTRAT VAULT`);
    const { runVaultContractTests } = await importModule('src/js/vault/tests/contract-tests.js');
    const vaultResults = await runVaultContractTests();
    vaultResults.forEach((result) => {
      let icon;
      if (result.status === 'pass') {
        icon = '✅';
      } else if (result.status === 'skip') {
        icon = '⚠️';
      } else {
        icon = '❌';
      }
      console.log(`[${formatTimestamp()}] ${icon} ${result.name}${result.status === 'skip' ? ' (skipped)' : ''}`);
      if (result.status === 'fail') {
        vaultFailed = true;
      }
    });
  } catch (error) {
    vaultFailed = true;
    console.log(`[${formatTimestamp()}] ❌ Tests contrat vault - ${error.message}`);
  }

  if (lastRun.failed > 0 || vaultFailed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('❌ Exécution des tests impossible:', error);
  process.exit(1);
});
