import { generateSyllables, generatePassphrase, generateLeet } from './src/js/core/generators.js';
import { initializeDictionaries, setCurrentDictionary, getCurrentDictionary } from './src/js/core/dictionaries.js';
import { defaultBlocksForMode, randomizeBlocks } from './src/js/core/casing.js';
import { showToast } from './src/js/utils/toast.js';
import { safeLog } from './src/js/utils/logger.js';
import { copyToClipboard } from './src/js/utils/clipboard.js';
import { compositionCounts, escapeHtml } from './src/js/utils/helpers.js';

const STORAGE_KEY = 'genpwd_pro_popup_settings_v1';
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

const state = {
  settings: deepClone(DEFAULT_SETTINGS),
  results: [],
  savingTimer: null
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function $(selector) {
  return document.querySelector(selector);
}

function interceptDictionaryFetch() {
  if (window.__GENPWD_FETCH_PATCHED__) return;
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    try {
      if (typeof input === 'string' && input.startsWith('./dictionaries/')) {
        const suffix = input.slice(1); // remove leading dot
        if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
          const absolute = chrome.runtime.getURL(`src${suffix}`);
          return originalFetch(absolute, init);
        }
        return originalFetch(`src${suffix}`, init);
      }
      return originalFetch(input, init);
    } catch (error) {
      safeLog(`Erreur fetch dictionnaire: ${error.message}`);
      throw error;
    }
  };
  window.__GENPWD_FETCH_PATCHED__ = true;
}

function loadSettingsFromStorage() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.get([STORAGE_KEY], (items) => {
        if (chrome.runtime?.lastError) {
          console.warn('Storage error:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(items[STORAGE_KEY] || null);
      });
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      resolve(raw ? JSON.parse(raw) : null);
    } catch (error) {
      console.warn('Local storage error:', error);
      resolve(null);
    }
  });
}

function saveSettingsToStorage(settings) {
  if (state.savingTimer) {
    clearTimeout(state.savingTimer);
  }
  state.savingTimer = setTimeout(() => {
    const payload = { [STORAGE_KEY]: settings };
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      chrome.storage.sync.set(payload, () => {
        if (chrome.runtime?.lastError) {
          console.warn('Storage error:', chrome.runtime.lastError.message);
        }
      });
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        console.warn('Local storage error:', error);
      }
    }
  }, 150);
}

function applySettingsToForm(settings) {
  $('#mode-select').value = settings.mode;
  $('#qty').value = settings.qty;
  $('#mask-toggle').checked = settings.mask;
  $('#digits-count').value = settings.digitsNum;
  $('#specials-count').value = settings.specialsNum;
  $('#custom-specials').value = settings.customSpecials;
  $('#place-digits').value = settings.placeDigits;
  $('#place-specials').value = settings.placeSpecials;
  $('#case-mode-select').value = settings.caseMode;

  $('#syll-len').value = settings.specific.length;
  $('#policy-select').value = settings.specific.policy;
  $('#pp-count').value = settings.specific.count;
  $('#pp-sep').value = settings.specific.sep;
  $('#dict-select').value = settings.specific.dictionary;
  $('#leet-input').value = settings.specific.word;

  updateBadges();
  updateModeVisibility(settings.mode);
  toggleBlocksSection(settings.caseMode === 'blocks');
  state.settings.blockTokens = Array.isArray(settings.blockTokens) ? settings.blockTokens.slice() : defaultBlocksForMode(settings.mode, getBlockParam(settings));
  renderBlocks();
}

function updateBadges() {
  document.querySelectorAll('.badge[data-for]').forEach((badge) => {
    const input = document.getElementById(badge.dataset.for);
    if (input) {
      badge.textContent = input.value;
    }
  });
}

function updateModeVisibility(mode) {
  $('#mode-syllables-opts').hidden = mode !== 'syllables';
  $('#mode-passphrase-opts').hidden = mode !== 'passphrase';
  $('#mode-leet-opts').hidden = mode !== 'leet';
}

function toggleBlocksSection(show) {
  const section = $('#blocks-section');
  if (!section) return;
  section.hidden = !show;
  if (show) {
    $('#blocks-count').textContent = `Blocs: ${state.settings.blockTokens.length}`;
  }
}

function getBlockParam(settings = state.settings) {
  if (settings.mode === 'syllables') {
    return settings.specific.length;
  }
  if (settings.mode === 'passphrase') {
    return settings.specific.count;
  }
  if (settings.mode === 'leet') {
    return settings.specific.word?.length || 0;
  }
  return 10;
}

function renderBlocks() {
  const editor = $('#blocks-editor');
  if (!editor) return;
  editor.innerHTML = '';
  state.settings.blockTokens.forEach((token, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'block-chip';
    chip.dataset.token = token;
    chip.textContent = token;
    chip.setAttribute('aria-label', `Bloc ${index + 1}: ${token}. Cliquer pour changer.`);
    chip.addEventListener('click', () => {
      const order = ['U', 'l', 'T'];
      const next = order[(order.indexOf(token) + 1) % order.length];
      state.settings.blockTokens[index] = next;
      renderBlocks();
      syncSettingsFromForm();
    });
    editor.appendChild(chip);
  });
  $('#blocks-count').textContent = `Blocs: ${state.settings.blockTokens.length}`;
}

function syncSettingsFromForm() {
  const mode = $('#mode-select').value;
  const settings = {
    mode,
    qty: clamp(parseInt($('#qty').value, 10), 1, 10),
    mask: $('#mask-toggle').checked,
    digitsNum: clamp(parseInt($('#digits-count').value, 10), 0, 6),
    specialsNum: clamp(parseInt($('#specials-count').value, 10), 0, 6),
    customSpecials: $('#custom-specials').value.slice(0, 20),
    placeDigits: $('#place-digits').value,
    placeSpecials: $('#place-specials').value,
    caseMode: $('#case-mode-select').value,
    specific: deepClone(state.settings.specific),
    blockTokens: state.settings.blockTokens.slice()
  };

  settings.specific.length = clamp(parseInt($('#syll-len').value, 10), 6, 64);
  settings.specific.policy = $('#policy-select').value;
  settings.specific.count = clamp(parseInt($('#pp-count').value, 10), 2, 8);
  settings.specific.sep = $('#pp-sep').value;
  settings.specific.dictionary = $('#dict-select').value;
  settings.specific.word = $('#leet-input').value.slice(0, 48);

  if (settings.caseMode !== 'blocks') {
    settings.blockTokens = state.settings.blockTokens.slice();
  }

  state.settings = settings;
  saveSettingsToStorage(settings);
  return settings;
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function syncBlocksWithMode(force = false) {
  if (state.settings.caseMode !== 'blocks' && !force) return;
  const param = getBlockParam();
  const fresh = defaultBlocksForMode(state.settings.mode, param);
  if (force || fresh.length !== state.settings.blockTokens.length) {
    state.settings.blockTokens = fresh;
    renderBlocks();
    saveSettingsToStorage(state.settings);
  }
}

function handleModeChange() {
  const settings = syncSettingsFromForm();
  updateModeVisibility(settings.mode);
  syncBlocksWithMode(true);
}

function handleCaseModeChange() {
  const settings = syncSettingsFromForm();
  const useBlocks = settings.caseMode === 'blocks';
  toggleBlocksSection(useBlocks);
  if (useBlocks) {
    syncBlocksWithMode(true);
  }
}

function buildConfigForMode() {
  const settings = syncSettingsFromForm();
  const shared = {
    digits: settings.digitsNum,
    specials: settings.specialsNum,
    customSpecials: settings.customSpecials,
    placeDigits: settings.placeDigits,
    placeSpecials: settings.placeSpecials,
    caseMode: settings.caseMode,
    useBlocks: settings.caseMode === 'blocks',
    blockTokens: settings.blockTokens.slice(),
    policy: settings.specific.policy || 'standard'
  };

  if (settings.mode === 'syllables') {
    return {
      settings,
      generator: () => generateSyllables({
        ...shared,
        length: settings.specific.length,
        policy: settings.specific.policy
      })
    };
  }

  if (settings.mode === 'passphrase') {
    return {
      settings,
      generator: () => generatePassphrase({
        ...shared,
        wordCount: settings.specific.count,
        separator: settings.specific.sep,
        dictionary: settings.specific.dictionary,
        sepChoices: 4
      })
    };
  }

  return {
    settings,
    generator: () => generateLeet({
      ...shared,
      baseWord: settings.specific.word || 'password'
    })
  };
}

async function generatePasswords() {
  const { settings, generator } = buildConfigForMode();
  const results = [];
  for (let i = 0; i < settings.qty; i += 1) {
    const outcome = await generator();
    results.push(outcome);
  }
  state.results = results;
  renderResults(settings.mask);
  safeLog(`Génération terminée (${settings.mode})`);
  showToast('Mots de passe générés !', 'success');
}

function renderResults(masked) {
  const list = $('#results-list');
  const empty = $('#empty-state');
  list.innerHTML = '';
  if (!Array.isArray(state.results) || state.results.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  state.results.forEach((item, index) => {
    if (!item || typeof item.value !== 'string') return;
    const card = document.createElement('article');
    card.className = 'password-card';
    card.setAttribute('role', 'listitem');

    const header = document.createElement('div');
    header.className = 'password-header';
    header.innerHTML = `<strong>#${index + 1}</strong><span>•</span><span>${item.mode}</span><span>•</span><span>${(item.entropy || 0).toFixed(1)} bits</span>`;
    card.appendChild(header);

    const value = document.createElement('div');
    value.className = 'password-value';
    value.dataset.password = item.value;
    value.textContent = item.value;
    if (masked) {
      value.classList.add('masked');
    }
    value.addEventListener('click', async () => {
      const success = await copyToClipboard(item.value);
      showToast(success ? 'Mot de passe copié !' : 'Copie impossible', success ? 'success' : 'error');
    });
    card.appendChild(value);

    const counts = compositionCounts(item.value);
    const total = Math.max(1, item.value.length);
    const bar = document.createElement('div');
    bar.className = 'composition-bar';
    const segments = [
      { cls: 'comp-u', value: counts.U },
      { cls: 'comp-l', value: counts.L },
      { cls: 'comp-d', value: counts.D },
      { cls: 'comp-s', value: counts.S }
    ];
    segments.forEach((segment) => {
      if (!segment.value) return;
      const seg = document.createElement('div');
      seg.className = `comp-seg ${segment.cls}`;
      seg.style.width = `${Math.round((segment.value / total) * 100)}%`;
      bar.appendChild(seg);
    });
    card.appendChild(bar);

    const meta = document.createElement('div');
    meta.className = 'password-meta';
    meta.innerHTML = `<span>Longueur: ${item.value.length}</span><span>${escapeHtml(masked ? 'Masqué' : 'Visible')}</span>`;
    card.appendChild(meta);

    list.appendChild(card);
  });
}

function updateMaskDisplay() {
  const masked = $('#mask-toggle').checked;
  document.querySelectorAll('.password-value').forEach((el) => {
    el.classList.toggle('masked', masked);
  });
}

async function copyAllPasswords() {
  if (!state.results.length) {
    showToast('Aucun mot de passe à copier', 'error');
    return;
  }
  const joined = state.results.map((item) => item.value).join('\n');
  const success = await copyToClipboard(joined);
  showToast(success ? 'Tous les mots de passe copiés' : 'Copie impossible', success ? 'success' : 'error');
}

async function copyFirstPassword() {
  if (!state.results.length) {
    showToast('Générez un mot de passe avant', 'error');
    return;
  }
  const success = await copyToClipboard(state.results[0].value);
  showToast(success ? 'Mot de passe copié' : 'Copie impossible', success ? 'success' : 'error');
}

function sendFillCommand() {
  if (!state.results.length) {
    showToast('Rien à remplir', 'error');
    return;
  }
  const password = state.results[0].value;
  if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab?.id) {
        showToast('Onglet actif introuvable', 'error');
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: 'GENPWD_FILL_PASSWORD', payload: password }, (response) => {
        if (chrome.runtime?.lastError) {
          showToast('Injection impossible', 'error');
          return;
        }
        if (response?.status === 'filled') {
          showToast('Champ rempli avec succès', 'success');
        } else {
          showToast('Aucun champ détecté', 'error');
        }
      });
    });
  } else {
    showToast('API chrome.tabs indisponible', 'error');
  }
}

async function runTests() {
  $('#btn-run-tests').disabled = true;
  $('#test-status').textContent = 'En cours...';
  $('#test-summary').className = 'test-summary';
  $('#test-summary').textContent = 'Exécution des tests...';
  $('#test-console').textContent = '';

  const tests = [
    {
      name: 'Syllabes – longueur respectée',
      run: () => {
        const result = generateSyllables({
          length: 18,
          policy: 'standard',
          digits: 2,
          specials: 2,
          customSpecials: '_',
          placeDigits: 'fin',
          placeSpecials: 'debut',
          caseMode: 'mixte',
          useBlocks: false,
          blockTokens: []
        });
        if (result.value.length < 18) {
          throw new Error(`Longueur insuffisante (${result.value.length})`);
        }
        return result;
      }
    },
    {
      name: 'Passphrase – dictionnaire fallback',
      run: async () => {
        const words = await getCurrentDictionary('french');
        if (!Array.isArray(words) || !words.length) {
          throw new Error('Dictionnaire vide');
        }
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
          dictionary: 'french'
        });
        if (result.value.split('-').length !== 3) {
          throw new Error('Nombre de mots incorrect');
        }
        return result;
      }
    },
    {
      name: 'Leet – substitution active',
      run: () => {
        const result = generateLeet({
          baseWord: 'Password',
          digits: 1,
          specials: 1,
          customSpecials: '!',
          placeDigits: 'fin',
          placeSpecials: 'debut',
          caseMode: 'upper',
          useBlocks: false,
          blockTokens: [],
          policy: 'standard'
        });
        if (!/P@55/.test(result.value)) {
          throw new Error('Transformation leet insuffisante');
        }
        return result;
      }
    }
  ];

  let success = 0;
  for (const test of tests) {
    const start = performance.now();
    try {
      await test.run();
      success += 1;
      appendTestLog(`✅ ${test.name} (${Math.round(performance.now() - start)}ms)`);
    } catch (error) {
      appendTestLog(`❌ ${test.name} → ${error.message}`);
    }
  }

  const summary = `${success}/${tests.length} tests réussis`;
  $('#test-summary').textContent = summary;
  $('#test-summary').classList.add(success === tests.length ? 'success' : 'error');
  $('#test-status').textContent = success === tests.length ? 'Succès' : 'Échecs';
  $('#btn-run-tests').disabled = false;
  safeLog(`Tests terminés: ${summary}`);
}

function appendTestLog(message) {
  const consoleEl = $('#test-console');
  consoleEl.textContent += `${message}\n`;
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function bindEvents() {
  $('#mode-select').addEventListener('change', handleModeChange);
  $('#case-mode-select').addEventListener('change', handleCaseModeChange);
  $('#mask-toggle').addEventListener('change', () => {
    syncSettingsFromForm();
    updateMaskDisplay();
  });

  ['syll-len', 'pp-count', 'digits-count', 'specials-count'].forEach((id) => {
    document.getElementById(id).addEventListener('input', () => {
      updateBadges();
      syncSettingsFromForm();
      syncBlocksWithMode();
    });
  });

  ['qty', 'custom-specials', 'place-digits', 'place-specials', 'pp-sep', 'policy-select', 'dict-select', 'leet-input'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => {
      syncSettingsFromForm();
      if (id === 'dict-select') {
        setCurrentDictionary($('#dict-select').value);
      }
    });
  });

  $('#btn-generate').addEventListener('click', generatePasswords);
  $('#btn-copy-all').addEventListener('click', copyAllPasswords);
  $('#btn-copy-first').addEventListener('click', copyFirstPassword);
  $('#btn-fill').addEventListener('click', sendFillCommand);
  $('#btn-run-tests').addEventListener('click', runTests);
  $('#btn-blocks-random').addEventListener('click', () => {
    state.settings.blockTokens = randomizeBlocks(state.settings.mode, getBlockParam());
    renderBlocks();
    syncSettingsFromForm();
  });
  $('#btn-blocks-reset').addEventListener('click', () => {
    state.settings.blockTokens = defaultBlocksForMode(state.settings.mode, getBlockParam());
    renderBlocks();
    syncSettingsFromForm();
  });
}

async function init() {
  interceptDictionaryFetch();
  bindEvents();
  const stored = await loadSettingsFromStorage();
  if (stored) {
    state.settings = Object.assign(deepClone(DEFAULT_SETTINGS), stored);
  }
  applySettingsToForm(state.settings);
  initializeDictionaries();
  setCurrentDictionary(state.settings.specific.dictionary);
  safeLog('Popup initialisée');
  renderResults(state.settings.mask);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
