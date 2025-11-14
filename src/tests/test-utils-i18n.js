#!/usr/bin/env node
/*
 * Unit tests for utils/i18n.js
 * Tests internationalization functionality including:
 * - Locale detection and switching
 * - Translation loading and retrieval
 * - Parameter interpolation
 * - Multi-locale support
 */

// Setup DOM mocks BEFORE importing any modules
const mockStorage = new Map();

global.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, value) => mockStorage.set(key, value),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
  length: mockStorage.size,
  key: (index) => [...mockStorage.keys()][index] || null
};

global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

global.document = {
  getElementById: () => null,
  createElement: () => ({
    classList: { add: () => {}, remove: () => {} },
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {}
  })
};

// Mock navigator
global.navigator = {
  language: 'en-US',
  userLanguage: 'en-US'
};

// Now import the module
import { I18n, i18n, t } from '../js/utils/i18n.js';

// Mock fetch for loading locales
const mockTranslations = {
  fr: {
    app: {
      title: 'GenPwd Pro',
      welcome: 'Bienvenue, {name}!',
      nested: {
        deep: 'Valeur profonde'
      }
    },
    errors: {
      generic: 'Une erreur est survenue'
    }
  },
  en: {
    app: {
      title: 'GenPwd Pro',
      welcome: 'Welcome, {name}!',
      nested: {
        deep: 'Deep value'
      }
    },
    errors: {
      generic: 'An error occurred'
    }
  },
  es: {
    app: {
      title: 'GenPwd Pro',
      welcome: '¡Bienvenido, {name}!',
      nested: {
        deep: 'Valor profundo'
      }
    },
    errors: {
      generic: 'Ocurrió un error'
    }
  }
};

global.fetch = (url) => {
  const match = url.match(/locales\/(\w+)\.json/);
  if (match) {
    const locale = match[1];
    if (mockTranslations[locale]) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockTranslations[locale])
      });
    }
  }
  return Promise.resolve({
    ok: false,
    status: 404
  });
};

/**
 * Test suite for I18n class
 */
export class I18nTestSuite {
  constructor() {
    this.tests = [];
    this.setupTests();
  }

  setupTests() {
    this.tests = [
      {
        name: 'I18n - Constructor with default config',
        run: async () => {
          const instance = new I18n();
          assert(instance.config.defaultLocale === 'fr', 'Default locale should be fr');
          assert(instance.config.supportedLocales.length === 3, 'Should have 3 supported locales');
          assert(instance.currentLocale !== undefined, 'Should have current locale');
        }
      },
      {
        name: 'I18n - Constructor with custom config',
        run: async () => {
          const instance = new I18n({
            defaultLocale: 'en',
            supportedLocales: ['en', 'es'],
            storageKey: 'custom_locale'
          });
          assert(instance.config.defaultLocale === 'en', 'Custom default locale should be en');
          assert(instance.config.supportedLocales.length === 2, 'Should have 2 supported locales');
          assert(instance.config.storageKey === 'custom_locale', 'Custom storage key should be set');
        }
      },
      {
        name: 'I18n - detectLocale from storage',
        run: async () => {
          mockStorage.clear();
          mockStorage.set('genpwd_locale', 'es');
          const instance = new I18n();
          assert(instance.currentLocale === 'es', 'Should detect locale from storage');
          mockStorage.clear();
        }
      },
      {
        name: 'I18n - detectLocale from browser',
        run: async () => {
          mockStorage.clear();
          global.navigator.language = 'en-US';
          const instance = new I18n();
          assert(instance.currentLocale === 'en', 'Should detect locale from browser');
        }
      },
      {
        name: 'I18n - detectLocale fallback to default',
        run: async () => {
          mockStorage.clear();
          global.navigator.language = 'de-DE'; // Unsupported locale
          const instance = new I18n();
          assert(instance.currentLocale === 'fr', 'Should fallback to default locale');
        }
      },
      {
        name: 'I18n - loadLocale success',
        run: async () => {
          const instance = new I18n();
          const result = await instance.loadLocale('en');
          assert(result === true, 'Should successfully load locale');
          assert(instance.loadedLocales.has('en'), 'Locale should be marked as loaded');
          assert(instance.translations.has('en'), 'Translations should be stored');
        }
      },
      {
        name: 'I18n - loadLocale unsupported',
        run: async () => {
          const instance = new I18n();
          const result = await instance.loadLocale('de');
          assert(result === false, 'Should fail for unsupported locale');
        }
      },
      {
        name: 'I18n - loadLocale already loaded',
        run: async () => {
          const instance = new I18n();
          await instance.loadLocale('en');
          const result = await instance.loadLocale('en');
          assert(result === true, 'Should return true for already loaded locale');
        }
      },
      {
        name: 'I18n - setLocale success',
        run: async () => {
          const instance = new I18n();
          const result = await instance.setLocale('en');
          assert(result === true, 'Should successfully set locale');
          assert(instance.currentLocale === 'en', 'Current locale should be updated');
          assert(mockStorage.get('genpwd_locale') === 'en', 'Locale should be persisted');
        }
      },
      {
        name: 'I18n - setLocale invalid',
        run: async () => {
          const instance = new I18n();
          const result = await instance.setLocale('de');
          assert(result === false, 'Should fail for invalid locale');
        }
      },
      {
        name: 'I18n - t() simple translation',
        run: async () => {
          const instance = new I18n();
          await instance.setLocale('en');
          const translation = instance.t('app.title');
          assert(translation === 'GenPwd Pro', 'Should return correct translation');
        }
      },
      {
        name: 'I18n - t() nested translation',
        run: async () => {
          const instance = new I18n();
          await instance.setLocale('fr');
          const translation = instance.t('app.nested.deep');
          assert(translation === 'Valeur profonde', 'Should return nested translation');
        }
      },
      {
        name: 'I18n - t() with parameters',
        run: async () => {
          const instance = new I18n();
          await instance.setLocale('en');
          const translation = instance.t('app.welcome', { name: 'Alice' });
          assert(translation === 'Welcome, Alice!', 'Should interpolate parameters');
        }
      },
      {
        name: 'I18n - t() missing key',
        run: async () => {
          const instance = new I18n();
          await instance.setLocale('en');
          const translation = instance.t('app.nonexistent');
          assert(translation === 'app.nonexistent', 'Should return key for missing translation');
        }
      },
      {
        name: 'I18n - t() no locale loaded',
        run: async () => {
          const instance = new I18n();
          const translation = instance.t('app.title');
          assert(translation === 'app.title', 'Should return key when no locale loaded');
        }
      },
      {
        name: 'I18n - getLocale',
        run: async () => {
          const instance = new I18n();
          await instance.setLocale('es');
          assert(instance.getLocale() === 'es', 'Should return current locale');
        }
      },
      {
        name: 'I18n - getSupportedLocales',
        run: async () => {
          const instance = new I18n();
          const locales = instance.getSupportedLocales();
          assert(Array.isArray(locales), 'Should return array');
          assert(locales.length === 3, 'Should have 3 locales');
          assert(locales.includes('fr'), 'Should include fr');
        }
      },
      {
        name: 'I18n - isLocaleLoaded',
        run: async () => {
          const instance = new I18n();
          assert(instance.isLocaleLoaded('en') === false, 'Should return false for unloaded locale');
          await instance.loadLocale('en');
          assert(instance.isLocaleLoaded('en') === true, 'Should return true for loaded locale');
        }
      },
      {
        name: 'I18n - preloadLocales',
        run: async () => {
          const instance = new I18n();
          const result = await instance.preloadLocales(['fr', 'en', 'es']);
          assert(result === true, 'Should successfully preload all locales');
          assert(instance.isLocaleLoaded('fr'), 'FR should be loaded');
          assert(instance.isLocaleLoaded('en'), 'EN should be loaded');
          assert(instance.isLocaleLoaded('es'), 'ES should be loaded');
        }
      },
      {
        name: 'I18n - preloadLocales with invalid',
        run: async () => {
          const instance = new I18n();
          const result = await instance.preloadLocales(['fr', 'de']);
          assert(result === false, 'Should fail if any locale fails to load');
        }
      },
      {
        name: 'I18n - getLocaleDisplayName',
        run: async () => {
          const instance = new I18n();
          assert(instance.getLocaleDisplayName('fr') === 'Français', 'Should return French name');
          assert(instance.getLocaleDisplayName('en') === 'English', 'Should return English name');
          assert(instance.getLocaleDisplayName('es') === 'Español', 'Should return Spanish name');
          assert(instance.getLocaleDisplayName('de') === 'de', 'Should return locale code for unknown');
        }
      },
      {
        name: 'I18n - getLocaleFlag',
        run: async () => {
          const instance = new I18n();
          assert(instance.getLocaleFlag('fr') === '🇫🇷', 'Should return French flag');
          assert(instance.getLocaleFlag('en') === '🇬🇧', 'Should return UK flag');
          assert(instance.getLocaleFlag('es') === '🇪🇸', 'Should return Spanish flag');
          assert(instance.getLocaleFlag('de') === '🌐', 'Should return globe for unknown');
        }
      },
      {
        name: 'I18n - Singleton instance',
        run: async () => {
          assert(i18n !== undefined, 'Singleton instance should exist');
          assert(typeof i18n.t === 'function', 'Singleton should have t method');
        }
      },
      {
        name: 'I18n - Convenience t() function',
        run: async () => {
          await i18n.setLocale('en');
          const translation = t('app.title');
          assert(typeof translation === 'string', 'Convenience function should work');
        }
      },
      {
        name: 'I18n - Multiple parameter interpolation',
        run: async () => {
          const instance = new I18n();
          instance.translations.set('test', {
            message: 'Hello {name}, you have {count} messages'
          });
          instance.currentLocale = 'test';
          const result = instance.t('message', { name: 'Bob', count: 5 });
          assert(result === 'Hello Bob, you have 5 messages', 'Should interpolate multiple params');
        }
      },
      {
        name: 'I18n - Locale switching',
        run: async () => {
          const instance = new I18n();
          await instance.setLocale('fr');
          const frTranslation = instance.t('app.welcome', { name: 'Marie' });
          assert(frTranslation === 'Bienvenue, Marie!', 'French translation should work');

          await instance.setLocale('es');
          const esTranslation = instance.t('app.welcome', { name: 'Juan' });
          assert(esTranslation === '¡Bienvenido, Juan!', 'Spanish translation should work');
        }
      }
    ];
  }

  async runAll() {
    const results = { passed: 0, failed: 0, errors: [] };

    for (const test of this.tests) {
      try {
        await test.run();
        results.passed++;
        console.log(`✅ ${test.name}`);
      } catch (error) {
        results.failed++;
        results.errors.push({ test: test.name, error: error.message });
        console.log(`❌ ${test.name} - ${error.message}`);
      }
    }

    return results;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Export for integration with main test runner
export async function runI18nTests() {
  console.log('\n🌍 I18n Module Tests');
  console.log('='.repeat(50));

  const suite = new I18nTestSuite();
  const results = await suite.runAll();

  const total = results.passed + results.failed;
  const score = total > 0 ? Math.round((results.passed / total) * 100) : 0;

  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Score: ${score}%`);

  if (results.errors.length > 0) {
    console.log('\n🚨 Errors:');
    results.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err.test}: ${err.error}`);
    });
  }

  return results;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runI18nTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}
