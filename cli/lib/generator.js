/*
 * GenPwd Pro CLI - Main Generator
 * Copyright 2025 Julien Bombled
 */

import { generateSyllables, generatePassphrase, generateLeet } from './generators.js';
import { getStrengthLevel } from './helpers.js';

export async function generatePassword(config) {
  const results = [];
  const quantity = config.quantity || 1;

  for (let i = 0; i < quantity; i++) {
    let result;

    switch (config.mode) {
      case 'syllables':
        result = generateSyllables({
          length: config.length,
          policy: config.policy,
          digits: config.digits,
          specials: config.specials,
          customSpecials: '!#%+,-./:=@_',
          placeDigits: 'aleatoire',
          placeSpecials: 'aleatoire',
          caseMode: config.caseMode,
          useBlocks: false,
          blockTokens: ['T', 'l']
        });
        break;

      case 'passphrase':
        result = await generatePassphrase({
          wordCount: config.wordCount,
          separator: config.separator,
          dictionary: config.dictionary,
          digits: config.digits,
          specials: config.specials,
          customSpecials: '!#%+,-./:=@_',
          placeDigits: 'aleatoire',
          placeSpecials: 'aleatoire',
          caseMode: config.caseMode
        });
        break;

      case 'leet':
        result = generateLeet({
          word: config.leetWord,
          digits: config.digits,
          specials: config.specials,
          customSpecials: '!#%+,-./:=@_',
          placeDigits: 'aleatoire',
          placeSpecials: 'aleatoire'
        });
        break;

      default:
        throw new Error(`Mode inconnu: ${config.mode}`);
    }

    // Add strength information
    result.strength = getStrengthLevel(result.entropy);

    results.push(result);
  }

  return results;
}
