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
    getElementById: () => null,
    createElement: (tag) => ({
      tagName: tag.toUpperCase(),
      style: {
        setProperty: () => {},
        removeProperty: () => {},
        getPropertyValue: () => ''
      },
      classList: {
        add: () => {},
        remove: () => {},
        contains: () => false
      },
      setAttribute: () => {},
      getAttribute: () => null,
      appendChild: () => {},
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => []
    }),
    documentElement: {
      style: {
        setProperty: () => {},
        removeProperty: () => {},
        getPropertyValue: () => ''
      },
      setAttribute: () => {}
    },
    body: {
      appendChild: () => {},
      removeChild: () => {},
      setAttribute: () => {},
      getAttribute: () => null
    },
    querySelector: () => null,
    querySelectorAll: () => []
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
      },
      // Validators tests
      {
        name: 'Validators - validateString success',
        run: async () => {
          const validators = this.modules.validators;
          const result = validators.validateString('hello', 'test');
          assert(result.valid === true, 'Should validate non-empty string');
          assert(result.error === null, 'Should have no error');
          return { sample: 'Valid string' };
        }
      },
      {
        name: 'Validators - validateString failures',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validateString(123, 'test');
          const r2 = validators.validateString('', 'test');
          const r3 = validators.validateString('   ', 'test');
          assert(r1.valid === false, 'Should reject non-string');
          assert(r2.valid === false, 'Should reject empty string');
          assert(r3.valid === false, 'Should reject whitespace-only string');
          return { sample: 'Invalid strings detected' };
        }
      },
      {
        name: 'Validators - validateInteger success',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validateInteger(5, 1, 10, 'test');
          const r2 = validators.validateInteger('7', 1, 10, 'test');
          assert(r1.valid === true && r1.value === 5, 'Should validate integer');
          assert(r2.valid === true && r2.value === 7, 'Should validate string integer');
          return { sample: 'Valid integers' };
        }
      },
      {
        name: 'Validators - validateInteger failures',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validateInteger(3.5, 1, 10, 'test');
          const r2 = validators.validateInteger(15, 1, 10, 'test');
          const r3 = validators.validateInteger('abc', 1, 10, 'test');
          const r4 = validators.validateInteger(NaN, 1, 10, 'test');
          assert(r1.valid === false, 'Should reject float');
          assert(r2.valid === false, 'Should reject out of range');
          assert(r3.valid === false, 'Should reject non-number string');
          assert(r4.valid === false, 'Should reject NaN');
          return { sample: 'Invalid integers detected' };
        }
      },
      {
        name: 'Validators - validateArray success',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validateArray([1, 2, 3], 2, 'test');
          const r2 = validators.validateArray([], 0, 'test');
          assert(r1.valid === true, 'Should validate array with sufficient length');
          assert(r2.valid === true, 'Should validate empty array when minLength is 0');
          return { sample: 'Valid arrays' };
        }
      },
      {
        name: 'Validators - validateArray failures',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validateArray('not array', 0, 'test');
          const r2 = validators.validateArray([1], 2, 'test');
          assert(r1.valid === false, 'Should reject non-array');
          assert(r2.valid === false, 'Should reject array with insufficient length');
          return { sample: 'Invalid arrays detected' };
        }
      },
      {
        name: 'Validators - validateEnum success',
        run: async () => {
          const validators = this.modules.validators;
          const result = validators.validateEnum('red', ['red', 'green', 'blue'], 'color');
          assert(result.valid === true, 'Should validate enum value');
          return { sample: 'Valid enum' };
        }
      },
      {
        name: 'Validators - validateEnum failures',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validateEnum('yellow', ['red', 'green', 'blue'], 'color');
          const r2 = validators.validateEnum('red', [], 'color');
          assert(r1.valid === false, 'Should reject value not in enum');
          assert(r2.valid === false, 'Should reject empty allowedValues');
          return { sample: 'Invalid enums detected' };
        }
      },
      {
        name: 'Validators - validatePercentage success',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validatePercentage(50, 'test');
          const r2 = validators.validatePercentage('75.5', 'test');
          const r3 = validators.validatePercentage(0, 'test');
          const r4 = validators.validatePercentage(100, 'test');
          assert(r1.valid === true && r1.value === 50, 'Should validate percentage');
          assert(r2.valid === true && r2.value === 75.5, 'Should validate string percentage');
          assert(r3.valid === true, 'Should validate 0');
          assert(r4.valid === true, 'Should validate 100');
          return { sample: 'Valid percentages' };
        }
      },
      {
        name: 'Validators - validatePercentage failures',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validatePercentage(-5, 'test');
          const r2 = validators.validatePercentage(150, 'test');
          const r3 = validators.validatePercentage('abc', 'test');
          assert(r1.valid === false, 'Should reject negative percentage');
          assert(r2.valid === false, 'Should reject percentage > 100');
          assert(r3.valid === false, 'Should reject non-number string');
          return { sample: 'Invalid percentages detected' };
        }
      },
      {
        name: 'Validators - validateObject success',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validateObject({ a: 1, b: 2 }, ['a', 'b'], 'test');
          const r2 = validators.validateObject({ a: 1, b: 2, c: 3 }, ['a'], 'test');
          assert(r1.valid === true, 'Should validate object with all required keys');
          assert(r2.valid === true, 'Should validate object with extra keys');
          return { sample: 'Valid objects' };
        }
      },
      {
        name: 'Validators - validateObject failures',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validateObject(null, ['a'], 'test');
          const r2 = validators.validateObject([1, 2], ['a'], 'test');
          const r3 = validators.validateObject({ a: 1 }, ['a', 'b'], 'test');
          assert(r1.valid === false, 'Should reject null');
          assert(r2.valid === false, 'Should reject array');
          assert(r3.valid === false, 'Should reject object missing required keys');
          return { sample: 'Invalid objects detected' };
        }
      },
      {
        name: 'Validators - validateEntropy success',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validateEntropy(100, 40);
          const r2 = validators.validateEntropy(40, 40);
          assert(r1.valid === true, 'Should validate sufficient entropy');
          assert(r2.valid === true, 'Should validate exact minimum entropy');
          return { sample: 'Valid entropy' };
        }
      },
      {
        name: 'Validators - validateEntropy failures',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validateEntropy(30, 40);
          const r2 = validators.validateEntropy('abc', 40);
          const r3 = validators.validateEntropy(NaN, 40);
          assert(r1.valid === false, 'Should reject insufficient entropy');
          assert(r2.valid === false, 'Should reject non-number');
          assert(r3.valid === false, 'Should reject NaN');
          return { sample: 'Invalid entropy detected' };
        }
      },
      {
        name: 'Validators - validatePasswordStrength weak',
        run: async () => {
          const validators = this.modules.validators;
          const result = validators.validatePasswordStrength('abc');
          assert(result.strength === 'weak', 'Should detect weak password');
          assert(result.valid === false, 'Weak password should not be valid');
          assert(result.score <= 2, 'Weak password should have low score');
          return { sample: 'Weak password detected' };
        }
      },
      {
        name: 'Validators - validatePasswordStrength strong',
        run: async () => {
          const validators = this.modules.validators;
          const result = validators.validatePasswordStrength('MyP@ssw0rd123!');
          assert(result.strength === 'very-strong', 'Should detect very strong password');
          assert(result.valid === true, 'Strong password should be valid');
          assert(result.score >= 6, 'Strong password should have high score');
          assert(result.checks.lowercase && result.checks.uppercase, 'Should detect mixed case');
          assert(result.checks.digits && result.checks.specials, 'Should detect digits and specials');
          return { sample: 'Strong password detected' };
        }
      },
      {
        name: 'Validators - validateURL success',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validateURL('https://example.com');
          const r2 = validators.validateURL('http://localhost:8080/path');
          assert(r1.valid === true, 'Should validate HTTPS URL');
          assert(r2.valid === true, 'Should validate HTTP URL');
          return { sample: 'Valid URLs' };
        }
      },
      {
        name: 'Validators - validateURL failures',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.validateURL('ftp://example.com');
          const r2 = validators.validateURL('not a url');
          const r3 = validators.validateURL('');
          assert(r1.valid === false, 'Should reject non-HTTP(S) protocol');
          assert(r2.valid === false, 'Should reject invalid URL format');
          assert(r3.valid === false, 'Should reject empty URL');
          return { sample: 'Invalid URLs detected' };
        }
      },
      {
        name: 'Validators - sanitizeInput basic',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.sanitizeInput('  hello  ');
          const r2 = validators.sanitizeInput('<script>alert(1)</script>');
          assert(r1 === 'hello', 'Should trim whitespace');
          assert(!r2.includes('<script>'), 'Should escape HTML tags');
          assert(r2.includes('&lt;') && r2.includes('&gt;'), 'Should convert < and >');
          return { sample: 'Sanitized input' };
        }
      },
      {
        name: 'Validators - sanitizeInput options',
        run: async () => {
          const validators = this.modules.validators;
          const r1 = validators.sanitizeInput('hello\nworld', { allowNewlines: true });
          const r2 = validators.sanitizeInput('hello\nworld', { allowNewlines: false });
          const longText = 'a'.repeat(20000);
          const r3 = validators.sanitizeInput(longText, { maxLength: 100 });
          assert(r1.includes('\n'), 'Should preserve newlines when allowed');
          assert(!r2.includes('\n'), 'Should remove newlines when not allowed');
          assert(r3.length === 100, 'Should enforce maxLength');
          return { sample: 'Sanitize options work' };
        }
      },
      // Casing tests
      {
        name: 'Casing - applyCase mixte',
        run: async () => {
          const { applyCase } = this.modules.casing;
          const result = applyCase('abcdefgh', 'mixte');
          assert(/[a-z]/.test(result) && /[A-Z]/.test(result), 'Should have mixed case');
          return { sample: result };
        }
      },
      {
        name: 'Casing - applyCase modes',
        run: async () => {
          const { applyCase } = this.modules.casing;
          const input = 'hello';
          const upper = applyCase(input, 'upper');
          const lower = applyCase(input, 'lower');
          const title = applyCase(input, 'title');
          assert(upper === 'HELLO', 'Should convert to uppercase');
          assert(lower === 'hello', 'Should convert to lowercase');
          assert(title === 'Hello', 'Should convert to title case');
          return { sample: `${upper} / ${lower} / ${title}` };
        }
      },
      {
        name: 'Casing - applyCasePattern with tokens',
        run: async () => {
          const { applyCasePattern } = this.modules.casing;
          const result = applyCasePattern('abcdef', ['U', 'l', 'T']);
          assert(/[A-Z]/.test(result.charAt(0)), 'First char should be uppercase (U token)');
          assert(/[a-z]/.test(result.charAt(1)), 'Second char should be lowercase (l token)');
          return { sample: result };
        }
      },
      // Dictionaries tests
      {
        name: 'Dictionaries - loadDictionary french',
        run: async () => {
          const { loadDictionary } = this.modules.dictionaries;
          const words = await loadDictionary('french');
          assert(Array.isArray(words), 'Dictionary should return an array');
          assert(words.length > 100, 'Dictionary should have at least 100 words');
          assert(words.every(w => typeof w === 'string'), 'All words should be strings');
          return { sample: `Loaded ${words.length} words` };
        }
      },
      {
        name: 'Dictionaries - getCurrentDictionary',
        run: async () => {
          const { getCurrentDictionary } = this.modules.dictionaries;
          const words = await getCurrentDictionary('french');
          assert(Array.isArray(words), 'Should return an array');
          assert(words.length > 0, 'Should have words');
          return { sample: `Got ${words.length} words` };
        }
      },
      {
        name: 'Dictionaries - setCurrentDictionary',
        run: async () => {
          const { setCurrentDictionary, getCurrentDictionary } = this.modules.dictionaries;
          const result = setCurrentDictionary('french');
          assert(result === true, 'Should return true on success');
          const words = await getCurrentDictionary();
          assert(words.length > 0, 'Current dictionary should have words');
          return { sample: 'Dictionary set successfully' };
        }
      },
      {
        name: 'Dictionaries - invalid dictionary key',
        run: async () => {
          const { loadDictionary } = this.modules.dictionaries;
          let errorThrown = false;
          try {
            await loadDictionary('invalid-dict-key');
          } catch (error) {
            errorThrown = true;
            assert(error.message.includes('not configured'), 'Should throw meaningful error');
          }
          assert(errorThrown, 'Should throw error for invalid dictionary');
          return { sample: 'Error handling works' };
        }
      },
      {
        name: 'Dictionaries - cache mechanism',
        run: async () => {
          const { loadDictionary } = this.modules.dictionaries;
          const words1 = await loadDictionary('french');
          const words2 = await loadDictionary('french'); // Should use cache
          assert(words1.length === words2.length, 'Cached dictionary should match');
          assert(words1 === words2, 'Should return same reference from cache');
          return { sample: 'Cache working correctly' };
        }
      },
      // Helpers tests
      {
        name: 'Helpers - randInt basic',
        run: async () => {
          const { randInt } = this.modules.helpers;
          const value = randInt(0, 10);
          assert(Number.isInteger(value), 'Should return integer');
          assert(value >= 0 && value < 10, 'Should be within range');
          return { sample: `Generated: ${value}` };
        }
      },
      {
        name: 'Helpers - randInt multiple calls',
        run: async () => {
          const { randInt } = this.modules.helpers;
          const values = Array.from({ length: 5 }, () => randInt(1, 11));
          assert(values.every(v => v >= 1 && v < 11), 'All values should be in range');
          return { sample: `Values: [${values.join(',')}]` };
        }
      },
      {
        name: 'Helpers - pick from array',
        run: async () => {
          const { pick } = this.modules.helpers;
          const items = ['a', 'b', 'c', 'd'];
          const choice = pick(items);
          assert(items.includes(choice), 'Should pick from array');
          return { sample: `Chose: ${choice}` };
        }
      },
      {
        name: 'Helpers - ensureArray empty',
        run: async () => {
          const { ensureArray } = this.modules.helpers;
          const result = ensureArray([]);
          assert(Array.isArray(result), 'Should return array');
          assert(result.length === 0, 'Should be empty array');
          return { sample: 'Empty array handled' };
        }
      },
      {
        name: 'Helpers - ensureArray already array',
        run: async () => {
          const { ensureArray } = this.modules.helpers;
          const input = ['a', 'b'];
          const result = ensureArray(input);
          assert(Array.isArray(result), 'Should return array');
          assert(result.length === 2, 'Should preserve length');
          return { sample: 'Array preserved' };
        }
      },
      {
        name: 'Helpers - setDigitPositions',
        run: async () => {
          const { setDigitPositions, getDigitPositions } = this.modules.helpers;
          setDigitPositions([1, 3, 5]);
          const positions = getDigitPositions();
          assert(Array.isArray(positions), 'Should return array');
          assert(positions.length === 3, 'Should have 3 positions');
          assert(positions[0] === 1, 'First position should be 1');
          return { sample: `Positions: [${positions.join(',')}]` };
        }
      },
      {
        name: 'Helpers - setSpecialPositions',
        run: async () => {
          const { setSpecialPositions, getSpecialPositions } = this.modules.helpers;
          setSpecialPositions([2, 4]);
          const positions = getSpecialPositions();
          assert(Array.isArray(positions), 'Should return array');
          assert(positions.length === 2, 'Should have 2 positions');
          return { sample: `Positions: [${positions.join(',')}]` };
        }
      },
      {
        name: 'Helpers - distributeEvenly',
        run: async () => {
          const { distributeEvenly } = this.modules.helpers;
          const positions = distributeEvenly(3, 0, 100);
          assert(Array.isArray(positions), 'Should return array');
          assert(positions.length === 3, 'Should have 3 positions');
          assert(positions.every(p => p >= 0 && p <= 100), 'All positions in range');
          return { sample: `Distributed: [${positions.join(',')}]` };
        }
      },
      {
        name: 'Helpers - compositionCounts',
        run: async () => {
          const { compositionCounts } = this.modules.helpers;
          const counts = compositionCounts('Abc123!@#');
          assert(typeof counts === 'object', 'Should return object');
          // Correct field names: U (uppercase), L (lowercase), D (digits), S (specials)
          assert(counts.hasOwnProperty('U'), 'Should have U (uppercase) count');
          assert(counts.hasOwnProperty('L'), 'Should have L (lowercase) count');
          assert(counts.hasOwnProperty('D'), 'Should have D (digit) count');
          assert(counts.hasOwnProperty('S'), 'Should have S (special) count');
          assert(counts.U > 0 && counts.L > 0 && counts.D > 0 && counts.S > 0, 'All counts should be > 0');
          return { sample: `U:${counts.U}, L:${counts.L}, D:${counts.D}, S:${counts.S}` };
        }
      },
      {
        name: 'Helpers - escapeHtml',
        run: async () => {
          const { escapeHtml } = this.modules.helpers;
          const result = escapeHtml('<script>alert("xss")</script>');
          assert(!result.includes('<'), 'Should escape <');
          assert(!result.includes('>'), 'Should escape >');
          assert(result.includes('&lt;'), 'Should contain escaped <');
          return { sample: 'HTML escaped successfully' };
        }
      },
      {
        name: 'Helpers - log2 calculation',
        run: async () => {
          const { log2 } = this.modules.helpers;
          const result = log2(8);
          assert(Math.abs(result - 3) < 0.001, 'log2(8) should be 3');
          return { sample: `log2(8) = ${result}` };
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
  const validatorsModule = await importModule('src/js/utils/validators.js');
  const casingModule = await importModule('src/js/core/casing.js');
  const dictionariesModule = await importModule('src/js/core/dictionaries.js');

  const runner = new NodeTestRunner({
    generateSyllables: generatorsModule.generateSyllables,
    generatePassphrase: generatorsModule.generatePassphrase,
    generateLeet: generatorsModule.generateLeet,
    ensureMinimumEntropy: generatorsModule.ensureMinimumEntropy,
    insertWithPlacement: helpersModule.insertWithPlacement,
    setDigitPositions: helpersModule.setDigitPositions,
    setSpecialPositions: helpersModule.setSpecialPositions,
    validators: validatorsModule,
    casing: casingModule,
    dictionaries: dictionariesModule,
    helpers: helpersModule
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

  // Run advanced utils tests
  let utilsFailed = false;
  try {
    console.log(`[${formatTimestamp()}] ℹ️ --------------------------------------------------`);
    console.log(`[${formatTimestamp()}] ℹ️ 🛠️  TESTS UTILS AVANCÉS`);
    const { runAllTests: runUtilsTests } = await importModule('src/tests/test-utils-advanced.js');
    const utilsResults = await runUtilsTests();
    if (utilsResults.failed > 0) {
      utilsFailed = true;
    }
  } catch (error) {
    utilsFailed = true;
    console.log(`[${formatTimestamp()}] ❌ Tests utils avancés - ${error.message}`);
  }

  // Run services tests
  let servicesFailed = false;
  try {
    console.log(`[${formatTimestamp()}] ℹ️ --------------------------------------------------`);
    console.log(`[${formatTimestamp()}] ℹ️ 🔧 TESTS SERVICES`);
    const { runAllTests: runServicesTests } = await importModule('src/tests/test-services.js');
    const servicesResults = await runServicesTests();
    if (servicesResults.failed > 0) {
      servicesFailed = true;
    }
  } catch (error) {
    servicesFailed = true;
    console.log(`[${formatTimestamp()}] ❌ Tests services - ${error.message}`);
  }

  // Run performance tests
  let perfFailed = false;
  try {
    console.log(`[${formatTimestamp()}] ℹ️ --------------------------------------------------`);
    console.log(`[${formatTimestamp()}] ℹ️ ⚡ TESTS PERFORMANCE`);
    const { runPerformanceTests } = await importModule('src/tests/test-performance.js');
    const perfResults = await runPerformanceTests();
    if (perfResults.failed > 0) {
      perfFailed = true;
    }
  } catch (error) {
    perfFailed = true;
    console.log(`[${formatTimestamp()}] ❌ Tests performance - ${error.message}`);
  }

  if (lastRun.failed > 0 || vaultFailed || utilsFailed || servicesFailed || perfFailed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('❌ Exécution des tests impossible:', error);
  process.exit(1);
});
