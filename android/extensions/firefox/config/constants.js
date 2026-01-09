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
// src/js/config/constants.js - Toutes les constantes du projet
export const APP_VERSION = '3.0.1';
export const APP_NAME = 'GenPwd Pro';

export const CHAR_SETS = Object.freeze({
  standard: Object.freeze({
    consonants: Object.freeze(['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z']),
    vowels: Object.freeze(['a', 'e', 'i', 'o', 'u', 'y']),
    specials: Object.freeze(['!', '#', '%', '+', ',', '-', '.', '/', ':', '=', '@', '_'])
  }),
  
  'standard-layout': Object.freeze({
    consonants: Object.freeze(['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'n', 'p', 'r', 's', 't', 'v', 'x']),
    vowels: Object.freeze(['e', 'i', 'o', 'u', 'y']),
    specials: Object.freeze(['!', '#', '%', '+', ',', '-', '.', '/', ':', '=', '@', '_'])
  }),
  
  alphanumerique: Object.freeze({
    consonants: Object.freeze(['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'w', 'x', 'z']),
    vowels: Object.freeze(['a', 'e', 'i', 'o', 'u', 'y']),
    specials: Object.freeze([])
  }),
  
  'alphanumerique-layout': Object.freeze({
    consonants: Object.freeze(['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'n', 'p', 'r', 's', 't', 'v', 'x']),
    vowels: Object.freeze(['e', 'i', 'o', 'u', 'y']),
    specials: Object.freeze([])
  })
});

export const DIGITS = Object.freeze(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);

export const LEET_SUBSTITUTIONS = Object.freeze({
  'a': '@', 'A': '@',
  'e': '3', 'E': '3',
  'i': '1', 'I': '1',
  'o': '0', 'O': '0',
  's': '5', 'S': '5',
  't': '7', 'T': '7',
  'l': '!', 'L': '!',
  'g': '9', 'G': '9',
  'b': '8', 'B': '8'
});

export const DICTIONARY_CONFIG = Object.freeze({
  french: {
    url: './dictionaries/french.json',
    name: 'Français',
    flag: '🇫🇷',
    expectedCount: 800
  },
  english: {
    url: './dictionaries/english.json', 
    name: 'English',
    flag: '🇬🇧',
    expectedCount: 1000
  },
  latin: {
    url: './dictionaries/latin.json',
    name: 'Latin',
    flag: '🏛️',
    expectedCount: 500
  }
});

export const FALLBACK_DICTIONARY = Object.freeze([
  "abri", "acier", "actif", "aimer", "algue", "alpes", "amande", "ananas", "ancien", "ancre",
  "angle", "animal", "arbre", "argent", "arome", "asile", "aspect", "atelier", "atlas", "atout",
  "audace", "avion", "avocat", "azimut", "bagage", "baie", "balade", "bambou", "banane", "banc",
  "barbe", "baril", "bassin", "bazar", "beige", "belier", "bento", "bisou", "bison", "bitume",
  "blason", "bleu", "bloc", "bocal", "boheme", "boite", "bonbon", "bonheur", "bosse", "botte",
  "boucle", "boue", "bougie", "boule", "branche", "bravo", "bref", "bruit", "bulle", "bureau",
  "cactus", "cadre", "caisse", "calme", "canyon", "capable", "carafe", "carbone", "cargo", "carte",
  "casque", "cave", "caviar", "ceinture", "cellule", "cerise", "chance", "chaud", "cheval", "chou",
  "ciel", "cigale", "ciment", "citron", "clair", "classe", "clic", "client", "cloche", "clou",
  "cobalt", "codage", "coeur", "coffee", "colline", "colonne", "combat", "comete", "compact", "confort",
  "copain", "corail", "corde", "cornet", "corps", "cosmos", "coton", "couche", "courbe", "courir",
  "coyote", "crabe", "cran", "crayon", "creme", "creux", "crique", "cristal", "croix", "cumulus",
  "cycle", "dague", "dalle", "danger", "danse", "dauphin", "debout", "declic", "degre", "delta",
  "demain", "dent", "desert", "dessin", "detail", "devoir", "dialogue", "diode", "disque", "dollar",
  "dragon", "droit", "dune", "duvet", "eclair", "ecorce", "ecoute", "effet", "effort", "eglise",
  "elegant", "email", "emotif", "empire", "encore", "energie", "enfant", "epice", "epoque", "equipe",
  "erable", "erreur", "espace", "esprit", "essai", "essor", "etoile", "etroit", "etude", "europe",
  "examen", "exemple", "exode", "fable", "facile", "faible", "faisan", "fakir", "fameux", "farine",
  "faune", "faute", "favori", "femelle", "fenetre", "ferme", "fibre", "figure", "filtre", "final",
  "finir", "fiole", "flamme", "floral", "flotte", "flute", "foire", "fonce", "fondre", "forage",
  "former", "fortune", "forum", "fosse", "foudre", "fraise", "franc", "frappe", "froid", "fromage",
  "front", "fruit", "fusion", "galaxie", "galet", "garage", "garcon", "garde", "gazon", "geant",
  "genial", "genome", "gentil", "geode", "gerer", "givre", "glace", "glaive", "gloire", "gomme",
  "gorge", "gouter", "grain", "gramme", "grande", "griffe", "grillon", "grotte", "groupe", "guide",
  "hasard", "havre", "hibou", "hiver", "hobby", "homard", "horizon", "huile", "humain", "humble"
]);

export const DEFAULT_SETTINGS = Object.freeze({
  mode: 'syllables',
  qty: 5,
  mask: true,
  digitsNum: 2,
  specialsNum: 2,
  customSpecials: '_+-=.@#%',
  placeDigits: 'aleatoire',
  placeSpecials: 'aleatoire',
  caseMode: 'mixte',
  specific: {}
});

export const LIMITS = Object.freeze({
  SYLLABLES_MIN_LENGTH: 6,
  SYLLABLES_MAX_LENGTH: 64,
  PASSPHRASE_MIN_WORDS: 2,
  PASSPHRASE_MAX_WORDS: 8,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 20,
  MIN_DIGITS: 0,
  MAX_DIGITS: 6,
  MIN_SPECIALS: 0,
  MAX_SPECIALS: 6
});

// Automatic validation of constants
export function validateCharSets() {
  for (const [key, policy] of Object.entries(CHAR_SETS)) {
    if (!Array.isArray(policy.consonants) || policy.consonants.length === 0) {
      console.error(`CHAR_SETS.${key}.consonants invalid`);
      return false;
    }
    if (!Array.isArray(policy.vowels) || policy.vowels.length === 0) {
      console.error(`CHAR_SETS.${key}.vowels invalid`);
      return false;
    }
  }

  // Cross-Layout verification
  const standardLayout = CHAR_SETS['standard-layout'];
  if (standardLayout.vowels.includes('a')) {
    console.error('"a" present in standard-layout - should be excluded');
    return false;
  }

  console.log('CHAR_SETS validated with CLI-Safe + Cross-Layout');
  return true;
}

// Validation on module load
if (!validateCharSets()) {
  throw new Error('CHAR_SETS data corrupted');
}
