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
// src/js/core/casing.js - Gestion de la casse et système de blocs
import { pick } from '../utils/helpers.js';

export function applyCase(str, mode) {
  if (typeof str !== 'string') return '';
  
  switch (mode) {
    case 'upper':
      return str.toUpperCase();
    case 'lower':
      return str.toLowerCase();
    case 'title':
      return str.split(/(\W)/).map(seg => 
        /^\w+$/.test(seg) ? 
        seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase() : 
        seg
      ).join('');
    default: // mixte
      return str.split('').map(ch => 
        /[a-zA-Z]/.test(ch) ? 
        (Math.random() < 0.5 ? ch.toLowerCase() : ch.toUpperCase()) : 
        ch
      ).join('');
  }
}

export function applyCasePattern(str, tokens, opts = {}) {
  if (typeof str !== 'string' || !Array.isArray(tokens) || tokens.length === 0) {
    return str || '';
  }

  const perWord = Boolean(opts.perWord);
  const syllableMode = Boolean(opts.syllableMode);

  let idx = 0, out = '', prev = '', letterCount = 0;
  let wordIndex = 0;

  for (const ch of str) {
    const isLetter = /[A-Za-z]/.test(ch);
    const isWordStart = isLetter && !/[A-Za-z]/.test(prev);

    if (perWord && isWordStart) {
      idx = wordIndex % tokens.length;
      wordIndex++;
    } else if (syllableMode && isLetter && letterCount > 0 && letterCount % 3 === 0) {
      idx = (idx + 1) % tokens.length;
    }

    if (isLetter) {
      const t = tokens[idx % tokens.length];
      if (t === 'U') out += ch.toUpperCase();
      else if (t === 'l') out += ch.toLowerCase();
      else if (t === 'T') out += isWordStart ? ch.toUpperCase() : ch.toLowerCase();
      else out += ch;
      letterCount++;

      if (!perWord && !syllableMode) {
        idx = (idx + 1) % tokens.length;
      }
    } else {
      out += ch;
    }
    prev = ch;
  }
  return out;
}

// Gestion des blocs de casse
export function calculateBlocksCount(mode, param = 20) {
  if (mode === 'syllables') {
    return Math.max(1, Math.min(10, Math.floor(param / 3)));
  } else if (mode === 'passphrase') {
    return Math.max(2, Math.min(8, parseInt(param) || 5));
  } else if (mode === 'leet') {
    const length = typeof param === 'number' ? param : parseInt(param, 10);
    return Math.max(1, Math.min(50, Number.isFinite(length) ? length : 0));
  }
  return 2;
}

export function defaultBlocksForMode(mode, param = 20) {
  const count = calculateBlocksCount(mode, param);
  if (mode === 'syllables') {
    const tokens = [];
    for (let i = 0; i < count; i++) {
      tokens.push(i === 0 ? 'U' : 'l');
    }
    return tokens;
  } else if (mode === 'passphrase') {
    const tokens = [];
    for (let i = 0; i < count; i++) {
      tokens.push(i === 0 ? 'T' : 'l');
    }
    return tokens;
  } else if (mode === 'leet') {
    const tokens = [];
    for (let i = 0; i < count; i++) {
      tokens.push(i === 0 ? 'T' : 'l');
    }
    return tokens;
  }
  return ['T', 'l'];
}

export function randomizeBlocks(mode, param = 20) {
  const count = calculateBlocksCount(mode, param);
  const options = ['U', 'l', 'T'];
  const tokens = [];
  
  for (let i = 0; i < count; i++) {
    tokens.push(pick(options));
  }
  
  return tokens;
}
