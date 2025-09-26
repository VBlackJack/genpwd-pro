// background.js - Service worker principal pour GenPwd Pro

// Polyfills légers pour réutiliser les modules conçus pour l'interface
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    getElementById() {
      return null;
    }
  };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (callback) => {
    return setTimeout(() => callback(Date.now()), 16);
  };
}

import { generateSyllables, generatePassphrase, generateLeet } from './js/core/generators.js';
import { setCurrentDictionary } from './js/core/dictionaries.js';
import { defaultBlocksForMode } from './js/core/casing.js';
import { compositionCounts } from './js/utils/helpers.js';

const STORAGE_KEY = 'genpwd_pro_popup_settings_v1';
const META_KEY = 'genpwd_pro_background_meta_v1';
const CURRENT_VERSION = '2.5.1';
const CLEANUP_INTERVAL_MINUTES = 60;
const COMMANDS = {
  GENERATE_AND_FILL: 'generate_password',
  FILL_LAST: 'fill_password',
  OPEN_POPUP: 'open_popup'
};

const DEFAULT_SETTINGS = {
  mode: 'syllables',
  qty: 3,
  mask: true,
  digitsNum: 2,
  specialsNum: 2,
  customSpecials: '_+-=.@#%',
  placeDigits: 'aleatoire',
  placeSpecials: 'aleatoire',
  caseMode: 'mixte',
  specific: {
    length: 20,
    policy: 'standard',
    count: 4,
    sep: '-',
    dictionary: 'french',
    word: 'password'
  },
  blockTokens: defaultBlocksForMode('syllables', 20)
};

function promisifyChrome(fn, ...args) {
  return new Promise((resolve, reject) => {
    try {
      fn(...args, (result) => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const BackgroundService = {
  tabFieldCounts: new Map(),
  lastGeneratedPassword: null,
  lastGenerationMeta: null,
  cleanupTimerId: null,

  init() {
    this.log('Initialisation du service worker');
    chrome.commands.onCommand.addListener((command) => this.handleCommand(command));
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => this.handleMessage(message, sender, sendResponse));

    chrome.runtime.onInstalled.addListener((details) => this.handleInstalled(details));
    chrome.runtime.onStartup.addListener(() => this.handleStartup());

    chrome.tabs.onRemoved.addListener((tabId) => this.handleTabRemoved(tabId));
    chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => this.handleTabReplaced(addedTabId, removedTabId));
    chrome.tabs.onActivated.addListener(({ tabId }) => this.refreshBadgeForTab(tabId));
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === 'loading') {
        this.resetTabState(tabId);
      }
    });

    this.ensureEnvironmentReady();
  },

  log(...args) {
    console.log('[GenPwd::Background]', ...args);
  },

  async ensureEnvironmentReady() {
    await this.ensureVersionMeta();
    await this.cleanObsoleteData();
    this.scheduleCleanup();
  },

  async ensureVersionMeta() {
    try {
      const stored = await promisifyChrome(chrome.storage.sync.get, META_KEY);
      const meta = stored?.[META_KEY] || null;
      if (!meta || meta.version !== CURRENT_VERSION) {
        await this.runMigrations(meta?.version || null);
        const payload = {
          [META_KEY]: {
            version: CURRENT_VERSION,
            migratedAt: Date.now()
          }
        };
        await promisifyChrome(chrome.storage.sync.set, payload);
        this.log(`Meta storage mis à jour vers ${CURRENT_VERSION}`);
      }
    } catch (error) {
      this.log('Impossible de vérifier la version du stockage', error);
    }
  },

  async runMigrations(previousVersion) {
    if (!previousVersion) {
      this.log('Aucune migration nécessaire (installation initiale)');
      return;
    }

    try {
      // Exemple de migration: nettoyage des anciens blocs sans tokens valides
      const stored = await promisifyChrome(chrome.storage.sync.get, STORAGE_KEY);
      const settings = stored?.[STORAGE_KEY];
      if (settings && Array.isArray(settings.blockTokens)) {
        const sanitized = settings.blockTokens.filter((token) => ['U', 'l', 'T'].includes(token));
        if (sanitized.length !== settings.blockTokens.length) {
          settings.blockTokens = sanitized.length ? sanitized : defaultBlocksForMode(settings.mode || 'syllables', 20);
          await promisifyChrome(chrome.storage.sync.set, { [STORAGE_KEY]: settings });
          this.log('Migration des blockTokens effectuée');
        }
      }
    } catch (error) {
      this.log('Erreur pendant la migration', error);
    }
  },

  scheduleCleanup() {
    if (this.cleanupTimerId) {
      clearTimeout(this.cleanupTimerId);
    }

    this.cleanupTimerId = setTimeout(() => {
      this.cleanObsoleteData().finally(() => this.scheduleCleanup());
    }, CLEANUP_INTERVAL_MINUTES * 60 * 1000);
  },

  async cleanObsoleteData() {
    try {
      const all = await promisifyChrome(chrome.storage.sync.get, null);
      const keys = Object.keys(all || {});
      const toRemove = keys.filter((key) => key.startsWith('genpwd_legacy_') || key.endsWith('_cache'));
      if (toRemove.length) {
        await promisifyChrome(chrome.storage.sync.remove, toRemove);
        this.log(`Nettoyage du stockage: ${toRemove.join(', ')}`);
      }
    } catch (error) {
      this.log('Erreur lors du nettoyage du stockage', error);
    }
  },

  handleInstalled(details) {
    this.log(`onInstalled: ${details.reason}`);
    if (details.reason === 'install') {
      this.resetAllBadges();
    }
    this.ensureEnvironmentReady();
  },

  handleStartup() {
    this.log('Redémarrage du service worker');
    this.cleanupClosedTabs();
  },

  handleTabRemoved(tabId) {
    this.tabFieldCounts.delete(tabId);
  },

  handleTabReplaced(addedTabId, removedTabId) {
    const previousCount = this.tabFieldCounts.get(removedTabId) || 0;
    this.tabFieldCounts.delete(removedTabId);
    this.tabFieldCounts.set(addedTabId, previousCount);
    this.updateBadge(addedTabId, previousCount);
  },

  resetTabState(tabId) {
    this.tabFieldCounts.set(tabId, 0);
    this.updateBadge(tabId, 0);
  },

  refreshBadgeForTab(tabId) {
    const count = this.tabFieldCounts.get(tabId) || 0;
    this.updateBadge(tabId, count);
  },

  resetAllBadges() {
    chrome.tabs.query({}, (tabs) => {
      if (!Array.isArray(tabs)) return;
      tabs.forEach((tab) => {
        if (typeof tab.id === 'number') {
          this.resetTabState(tab.id);
        }
      });
    });
  },

  cleanupClosedTabs() {
    chrome.tabs.query({}, (tabs) => {
      const activeIds = new Set((tabs || []).map((tab) => tab.id));
      for (const tabId of this.tabFieldCounts.keys()) {
        if (!activeIds.has(tabId)) {
          this.tabFieldCounts.delete(tabId);
        }
      }
    });
  },

  async handleCommand(command) {
    this.log('Commande clavier reçue:', command);
    switch (command) {
      case COMMANDS.GENERATE_AND_FILL:
        this.withActiveTab(async (tab) => {
          await this.generateAndFill(tab.id);
        });
        break;
      case COMMANDS.FILL_LAST:
        this.withActiveTab(async (tab) => {
          if (!this.lastGeneratedPassword) {
            await this.generateAndFill(tab.id);
            return;
          }
          await this.fillPasswordIntoTab(tab.id, this.lastGeneratedPassword);
        });
        break;
      case COMMANDS.OPEN_POPUP:
        if (chrome.action?.openPopup) {
          chrome.action.openPopup().catch((error) => this.log('Impossible d\'ouvrir le popup', error));
        }
        break;
      default:
        this.log('Commande non gérée:', command);
    }
  },

  withActiveTab(callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (chrome.runtime?.lastError) {
        this.log('Erreur tabs.query', chrome.runtime.lastError.message);
        return;
      }
      const tab = tabs && tabs[0];
      if (!tab || typeof tab.id !== 'number') {
        this.log('Aucun onglet actif pour exécuter la commande');
        return;
      }
      try {
        await callback(tab);
      } catch (error) {
        this.log('Erreur durant la commande active tab', error);
      }
    });
  },

  updateBadge(tabId, count) {
    if (typeof tabId !== 'number') return;
    const text = Number.isFinite(count) && count > 0 ? String(count) : '0';
    const color = count > 0 ? '#1fbf75' : '#5f6368';
    try {
      chrome.action.setBadgeText({ tabId, text });
    } catch (error) {
      this.log('Erreur setBadgeText', error);
    }
    try {
      chrome.action.setBadgeBackgroundColor({ tabId, color });
    } catch (error) {
      this.log('Erreur setBadgeBackgroundColor', error);
    }
  },

  async handleMessage(message, sender, sendResponse) {
    if (!message || typeof message !== 'object') {
      return false;
    }

    switch (message.type) {
      case 'GENPWD_FIELD_COUNT': {
        const tabId = sender?.tab?.id ?? message.tabId;
        if (typeof tabId === 'number') {
          const count = Number(message.count) || 0;
          this.tabFieldCounts.set(tabId, count);
          this.updateBadge(tabId, count);
        }
        sendResponse?.({ acknowledged: true });
        return false;
      }
      case 'GENPWD_GENERATE_AND_FILL': {
        const targetTabId = message.tabId ?? sender?.tab?.id;
        if (typeof targetTabId !== 'number') {
          sendResponse?.({ ok: false, error: 'missing_tab_id' });
          return false;
        }
        this.generateAndFill(targetTabId)
          .then((result) => sendResponse?.({ ok: true, result }))
          .catch((error) => sendResponse?.({ ok: false, error: error.message }));
        return true;
      }
      case 'GENPWD_FILL_WITH_PASSWORD': {
        const targetTabId = message.tabId ?? sender?.tab?.id;
        if (typeof targetTabId !== 'number') {
          sendResponse?.({ ok: false, error: 'missing_tab_id' });
          return false;
        }
        this.fillPasswordIntoTab(targetTabId, message.password)
          .then((result) => sendResponse?.({ ok: true, result }))
          .catch((error) => sendResponse?.({ ok: false, error: error.message }));
        return true;
      }
      case 'GENPWD_GET_LAST_PASSWORD': {
        sendResponse?.({ password: this.lastGeneratedPassword, meta: this.lastGenerationMeta });
        return false;
      }
      case 'GENPWD_GET_FIELD_COUNT': {
        const tabId = message.tabId ?? sender?.tab?.id;
        const count = typeof tabId === 'number' ? (this.tabFieldCounts.get(tabId) || 0) : 0;
        sendResponse?.({ count });
        return false;
      }
      case 'GENPWD_REQUEST_SETTINGS': {
        this.getStoredSettings()
          .then((settings) => sendResponse?.({ settings }))
          .catch((error) => sendResponse?.({ error: error.message }));
        return true;
      }
      default:
        return false;
    }
  },

  async getStoredSettings() {
    try {
      const stored = await promisifyChrome(chrome.storage.sync.get, STORAGE_KEY);
      const settings = stored?.[STORAGE_KEY];
      if (!settings) {
        return deepClone(DEFAULT_SETTINGS);
      }

      // Sanity checks
      if (!Array.isArray(settings.blockTokens) || !settings.blockTokens.length) {
        settings.blockTokens = defaultBlocksForMode(settings.mode || 'syllables', this.getBlockParam(settings));
      }
      settings.blockTokens = settings.blockTokens.filter((token) => ['U', 'l', 'T'].includes(token));
      if (!settings.blockTokens.length) {
        settings.blockTokens = defaultBlocksForMode(settings.mode || 'syllables', this.getBlockParam(settings));
      }
      return settings;
    } catch (error) {
      this.log('Impossible de charger les paramètres, fallback défaut', error);
      return deepClone(DEFAULT_SETTINGS);
    }
  },

  getBlockParam(settings) {
    switch (settings.mode) {
      case 'passphrase':
        return settings.specific?.count || DEFAULT_SETTINGS.specific.count;
      case 'leet':
        return settings.specific?.word?.length || DEFAULT_SETTINGS.specific.word.length;
      default:
        return settings.specific?.length || DEFAULT_SETTINGS.specific.length;
    }
  },

  async generateAndFill(tabId) {
    if (typeof tabId !== 'number') {
      throw new Error('invalid_tab');
    }

    const settings = await this.getStoredSettings();
    const passwordData = await this.generatePassword(settings);
    if (!passwordData || !passwordData.value) {
      throw new Error('generation_failed');
    }

    this.lastGeneratedPassword = passwordData.value;
    this.lastGenerationMeta = {
      entropy: passwordData.entropy,
      mode: passwordData.mode,
      generatedAt: Date.now(),
      composition: compositionCounts(passwordData.value)
    };

    const response = await this.fillPasswordIntoTab(tabId, passwordData.value);
    return { password: passwordData.value, meta: this.lastGenerationMeta, response };
  },

  async generatePassword(settings) {
    const shared = {
      digits: settings.digitsNum,
      specials: settings.specialsNum,
      customSpecials: settings.customSpecials,
      placeDigits: settings.placeDigits,
      placeSpecials: settings.placeSpecials,
      caseMode: settings.caseMode,
      useBlocks: settings.caseMode === 'blocks',
      blockTokens: Array.isArray(settings.blockTokens) ? settings.blockTokens.slice() : [],
      policy: settings.specific?.policy || 'standard'
    };

    if (settings.mode === 'passphrase') {
      const dictionary = settings.specific?.dictionary || 'french';
      setCurrentDictionary(dictionary);
      return generatePassphrase({
        ...shared,
        wordCount: settings.specific?.count || DEFAULT_SETTINGS.specific.count,
        separator: settings.specific?.sep ?? DEFAULT_SETTINGS.specific.sep,
        dictionary,
        sepChoices: 4
      });
    }

    if (settings.mode === 'leet') {
      return generateLeet({
        ...shared,
        baseWord: settings.specific?.word || DEFAULT_SETTINGS.specific.word
      });
    }

    return generateSyllables({
      ...shared,
      length: settings.specific?.length || DEFAULT_SETTINGS.specific.length,
      policy: settings.specific?.policy || 'standard'
    });
  },

  async fillPasswordIntoTab(tabId, password) {
    if (!password) {
      throw new Error('missing_password');
    }

    try {
      const response = await promisifyChrome(chrome.tabs.sendMessage, tabId, {
        type: 'GENPWD_FILL_PASSWORD',
        payload: password
      });
      if (!response || response.status !== 'filled') {
        throw new Error(response?.reason || 'fill_failed');
      }
      return response;
    } catch (error) {
      // Tentative de ré-injection du content script puis nouvel essai
      try {
        await promisifyChrome(chrome.scripting.executeScript, {
          target: { tabId, allFrames: true },
          files: ['content-script.js']
        });
        const retry = await promisifyChrome(chrome.tabs.sendMessage, tabId, {
          type: 'GENPWD_FILL_PASSWORD',
          payload: password
        });
        if (!retry || retry.status !== 'filled') {
          throw new Error(retry?.reason || 'fill_failed_after_injection');
        }
        return retry;
      } catch (innerError) {
        this.log('Injection impossible', innerError);
        throw innerError instanceof Error ? innerError : new Error(String(innerError));
      }
    }
  }
};

BackgroundService.init();

export default BackgroundService;
