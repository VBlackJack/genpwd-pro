/**
 * @file tools/sync-locales.js
 * @description Synchronize translation keys between source (en) and target (fr, es, etc.)
 * @author Julien Bombled
 * @license Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '../src/locales');
const SOURCE_LANG = 'en';
const TARGET_LANGS = ['fr', 'es'];

// Helper to sort object keys recursively
const sortObject = (obj) => {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
  return Object.keys(obj).sort().reduce((sorted, key) => {
    sorted[key] = sortObject(obj[key]);
    return sorted;
  }, {});
};

// Helper to check missing keys
const syncKeys = (source, target, prefix = '') => {
  let updated = { ...target };
  let addedCount = 0;

  for (const [key, value] of Object.entries(source)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Nested object
      if (!updated[key]) updated[key] = {};
      const { updatedObj, count } = syncKeys(value, updated[key], fullKey);
      updated[key] = updatedObj;
      addedCount += count;
    } else {
      // String value
      if (!Object.prototype.hasOwnProperty.call(updated, key)) {
        console.log(`[+] Adding missing key: ${fullKey}`);
        updated[key] = `__TRANSLATE__ ${value}`; // Prefix to identify pending translations
        addedCount++;
      }
    }
  }
  return { updatedObj: updated, count: addedCount };
};

const run = () => {
  console.log(`Loading source locale: ${SOURCE_LANG}`);
  const sourcePath = path.join(LOCALES_DIR, `${SOURCE_LANG}.json`);

  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  const sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

  TARGET_LANGS.forEach(lang => {
    const targetPath = path.join(LOCALES_DIR, `${lang}.json`);
    let targetContent = {};

    if (fs.existsSync(targetPath)) {
      targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    } else {
      console.log(`Creating new locale file: ${lang}`);
    }

    console.log(`\nSyncing ${lang}...`);
    const { updatedObj, count } = syncKeys(sourceContent, targetContent);
    const sortedContent = sortObject(updatedObj);

    fs.writeFileSync(targetPath, JSON.stringify(sortedContent, null, 2) + '\n');
    console.log(`Result: ${count} keys added/synced to ${lang}.json`);
  });
};

run();
