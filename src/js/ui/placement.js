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
// src/js/ui/placement.js - Gestion du placement visuel des chiffres et spéciaux
import { getElement, addEventListener } from './dom.js';
import {
  setDigitPositions,
  setSpecialPositions,
  getDigitPositions,
  getSpecialPositions,
  distributeEvenly
} from '../utils/helpers.js';
import { safeLog } from '../utils/logger.js';
import { sanitizeHTML } from '../utils/dom-sanitizer.js';
import { ANIMATION_DURATION } from '../config/ui-constants.js';

// Stocke les pourcentages logiques utilisés par l'API de génération.
// Le rendu visuel compense les marges/insets de la barre, il est donc
// préférable de travailler sur l'intervalle [0, 100] afin de refléter
// fidèlement les placements "Début/Milieu/Fin" choisis par l'utilisateur.
const DEFAULT_RANGE = Object.freeze({ start: 0, end: 100 });
const KEY_STEP = 1;
const FINE_STEP = 0.2;

const requestFrame = (callback) => {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return setTimeout(callback, 16);
};

const state = {
  initialized: false,
  mode: 'auto',
  container: null,
  bar: null,
  track: null,
  cursorLayer: null,
  labelLayer: null,
  layers: { digits: null, specials: null },
  modeLabel: null,
  toggleBtn: null,
  autoBtn: null,
  resetBtn: null,
  summaryEl: null,
  digitsSlider: null,
  specialsSlider: null,
  placementSelects: { digits: null, specials: null },
  previousSelects: { digits: 'aleatoire', specials: 'aleatoire' },
  digits: [],
  specials: [],
  baseline: { digits: [], specials: [] },
  dom: { digits: [], specials: [] },
  callbacks: new Set(),
  broadcastRaf: null,
  suppressSelect: false,
  resizeRaf: null,
  manualSnapshot: {
    digits: [],
    specials: [],
    baselineDigits: [],
    baselineSpecials: []
  }
};

let cursorId = 0;

const clampPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
};

// Conserve uniquement des pourcentages entiers pour faciliter l'alignement sur un chiffre précis.
const roundPercent = (value) => Math.round(clampPercent(value));

const parsePxValue = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// The visual bar shrinks its usable track with CSS margins and an inner inset.
// We measure that effective window so both the drag math and the rendered
// cursor offsets stay anchored to the same reference.
function getTrackMetrics() {
  if (!state.track || !state.cursorLayer) {
    return null;
  }

  const trackRect = state.track.getBoundingClientRect();
  const layerRect = state.cursorLayer.getBoundingClientRect();

  if (!trackRect?.width || !layerRect?.width) {
    return null;
  }

  const computed = typeof window !== 'undefined' ? window.getComputedStyle(state.track) : null;
  const rawInset = computed ? parsePxValue(computed.getPropertyValue('--bar-inner-inset')) : 0;
  const innerInset = Math.min(rawInset, trackRect.width / 2);

  // Compensate for the rounded caps of the bar so that 0 % and 100 % match
  // the center of the left/right semicircles instead of the rectangular
  // bounding box. Without this the handles appear to "float" toward the
  // middle of the bar because we ignore the curvature.
  const rawRadius = trackRect.height / 2;
  const effectiveRadius = Math.max(0, rawRadius - innerInset);

  const startX = trackRect.left + innerInset + effectiveRadius;
  const endX = trackRect.right - innerInset - effectiveRadius;
  const usableWidth = Math.max(0, endX - startX);

  return {
    startX,
    endX,
    usableWidth,
    layerLeft: layerRect.left,
    layerWidth: layerRect.width,
    offsetStart: startX - layerRect.left,
    offsetEnd: layerRect.right - endX
  };
}

function initVisualPlacement() {
  if (state.initialized) {
    return createAPI();
  }

  try {
    state.container = getElement('#placement-visual-container', false);
    if (!state.container) {
      safeLog('placement.js: conteneur visuel introuvable');
      return null;
    }

    state.bar = state.container.querySelector('#placement-bar');
    state.track = state.container.querySelector('.bar-base');
    state.cursorLayer = state.container.querySelector('#bar-cursors');
    state.labelLayer = state.container.querySelector('#bar-labels');
    state.modeLabel = state.container.querySelector('#placement-mode');
    state.toggleBtn = getElement('#btn-placement-toggle', false);
    state.autoBtn = getElement('#btn-placement-auto', false);
    state.resetBtn = getElement('#btn-placement-reset', false);
    state.digitsSlider = getElement('#digits-count');
    state.specialsSlider = getElement('#specials-count');
    state.placementSelects.digits = getElement('#place-digits');
    state.placementSelects.specials = getElement('#place-specials');

    setupStructure();
    attachEventListeners();

    const digitsSelectVal = state.placementSelects.digits?.value || 'aleatoire';
    const specialsSelectVal = state.placementSelects.specials?.value || 'aleatoire';

    if (digitsSelectVal !== 'positions') {
      state.previousSelects.digits = digitsSelectVal;
    }
    if (specialsSelectVal !== 'positions') {
      state.previousSelects.specials = specialsSelectVal;
    }

    const shouldStartVisual = digitsSelectVal === 'positions' || specialsSelectVal === 'positions';
    state.mode = shouldStartVisual ? 'visual' : 'auto';
    updateModeIndicator();

    refreshCounts(true);
    scheduleBroadcast(true);

    state.initialized = true;
    safeLog('placement.js: module placement visuel initialisé');

    return createAPI();
  } catch (error) {
    safeLog(`placement.js: erreur d'initialisation - ${error.message}`);
    return null;
  }
}

function setupStructure() {
  if (!state.cursorLayer) {
    state.cursorLayer = document.createElement('div');
    state.cursorLayer.className = 'bar-cursors';
    state.bar?.appendChild(state.cursorLayer);
  }

  state.layers.digits = document.createElement('div');
  state.layers.digits.className = 'cursor-layer digits-layer';
  state.layers.specials = document.createElement('div');
  state.layers.specials.className = 'cursor-layer specials-layer';

  state.cursorLayer.innerHTML = sanitizeHTML('');
  state.cursorLayer.appendChild(state.layers.digits);
  state.cursorLayer.appendChild(state.layers.specials);

  if (state.labelLayer) {
    state.labelLayer.innerHTML = sanitizeHTML('');
    [0, 25, 50, 75, 100].forEach((value) => {
      const label = document.createElement('span');
      label.className = 'bar-label';
      label.dataset.percent = String(value);
      label.textContent = `${value}%`;
      state.labelLayer.appendChild(label);
    });
    updateLabels();
    requestFrame(updateLabels);
  }

  const controls = state.container.querySelector('.placement-controls');
  if (controls) {
    state.summaryEl = document.createElement('div');
    state.summaryEl.className = 'placement-summary';
    controls.appendChild(state.summaryEl);
  }
}

function attachEventListeners() {
  if (state.digitsSlider) {
    const updateDigits = () => updateGroupCount('digits', state.digitsSlider.value);
    addEventListener(state.digitsSlider, 'input', updateDigits);
    addEventListener(state.digitsSlider, 'change', updateDigits);
  }

  if (state.specialsSlider) {
    const updateSpecials = () => updateGroupCount('specials', state.specialsSlider.value);
    addEventListener(state.specialsSlider, 'input', updateSpecials);
    addEventListener(state.specialsSlider, 'change', updateSpecials);
  }

  if (state.toggleBtn) {
    addEventListener(state.toggleBtn, 'click', () => {
      setMode(state.mode === 'visual' ? 'auto' : 'visual');
    });
  }

  if (state.autoBtn) {
    addEventListener(state.autoBtn, 'click', () => {
      if (state.mode !== 'visual') {
        setMode('visual');
      }
      autoDistribute();
    });
  }

  if (state.resetBtn) {
    addEventListener(state.resetBtn, 'click', () => {
      if (state.mode !== 'visual') {
        setMode('visual');
      }
      resetToBaseline();
    });
  }

  const digitsSelect = state.placementSelects.digits;
  const specialsSelect = state.placementSelects.specials;

  if (digitsSelect) {
    addEventListener(digitsSelect, 'change', (event) => {
      handleSelectChange('digits', event.target.value);
    });
  }

  if (specialsSelect) {
    addEventListener(specialsSelect, 'change', (event) => {
      handleSelectChange('specials', event.target.value);
    });
  }

  if (typeof window !== 'undefined') {
    addEventListener(window, 'resize', handleWindowResize);
  }
}

function refreshCounts(useStored = false) {
  const digitsCount = parseInt(state.digitsSlider?.value || '0', 10);
  const specialsCount = parseInt(state.specialsSlider?.value || '0', 10);

  const allowStored = useStored && state.mode === 'visual';
  const storedDigits = allowStored ? getDigitPositions() : [];
  const storedSpecials = allowStored ? getSpecialPositions() : [];

  updateGroupCount('digits', digitsCount, storedDigits);
  updateGroupCount('specials', specialsCount, storedSpecials);
}

function updateGroupCount(type, count, preferred = []) {
  const target = Math.max(0, parseInt(count, 10) || 0);
  const fallback = target > 0
    ? distributeEvenly(target, DEFAULT_RANGE.start, DEFAULT_RANGE.end)
    : [];

  if (state.mode !== 'visual') {
    const placement = resolveAutoPlacement(type);
    const autoValues = buildAutoLayout(target, placement);
    const shouldUpdateBaseline = !Array.isArray(state.baseline[type])
      || state.baseline[type].length !== target;
    applyPositions(type, autoValues, {
      updateBaseline: shouldUpdateBaseline,
      baselineValues: fallback
    });
    return;
  }

  const preserved = state[type];
  const preferredArray = Array.isArray(preferred) ? preferred.slice(0, target) : [];
  const nextValues = [];

  for (let i = 0; i < target; i++) {
    const prefer = typeof preferredArray[i] === 'number' ? preferredArray[i] : null;
    const existing = preserved[i]?.percent;
    const value = prefer ?? existing ?? fallback[i];
    nextValues.push(value);
  }

  const shouldUpdateBaseline = state.mode === 'visual'
    || !Array.isArray(state.baseline[type])
    || state.baseline[type].length !== target;

  applyPositions(type, nextValues, {
    updateBaseline: shouldUpdateBaseline,
    baselineValues: fallback
  });
}

function applyPositions(type, values, { updateBaseline = false, baselineValues = null } = {}) {
  const sanitized = Array.isArray(values)
    ? values.map(roundPercent)
    : [];

  const nextItems = sanitized.map((value, index) => {
    const existing = state[type][index];
    return {
      id: existing?.id || `${type}-${cursorId++}`,
      percent: value
    };
  });

  state[type] = nextItems;

  if (updateBaseline) {
    state.baseline[type] = Array.isArray(baselineValues)
      ? baselineValues.map(roundPercent)
      : sanitized.slice();
  }

  renderGroup(type);
  scheduleBroadcast();
}

function renderGroup(type) {
  const items = state[type];
  const domList = state.dom[type] || [];
  const layer = state.layers[type];

  if (!layer) return;

  while (domList.length > items.length) {
    const element = domList.pop();
    if (element && element.parentNode) {
      element.classList.add('cursor-removing');
      element.addEventListener('animationend', () => {
        element.remove();
      }, { once: true });
      setTimeout(() => element.remove(), 300);
    }
  }

  items.forEach((item, index) => {
    let cursor = domList[index];
    if (!cursor) {
      cursor = createCursorElement(type, index);
      domList[index] = cursor;
      layer.appendChild(cursor);
      requestAnimationFrame(() => cursor.classList.add('cursor-mounted'));
    }
    updateCursorElement(cursor, type, index);
  });

  state.dom[type] = domList;
}

function createCursorElement(type, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `cursor ${type}`;
  button.dataset.type = type;
  button.dataset.index = String(index);
  button.setAttribute('tabindex', '0');
  button.innerHTML = sanitizeHTML('<span class=")cursor-label"></span>';

  addEventListener(button, 'pointerdown', handlePointerDown);
  addEventListener(button, 'wheel', handleWheel, { passive: false });
  addEventListener(button, 'keydown', handleKeydown);

  return button;
}

function updateCursorElement(element, type, index) {
  const item = state[type][index];
  if (!item) return;

  element.dataset.index = String(index);
  element.dataset.percent = String(item.percent);
  element.style.setProperty('left', computeCursorLeft(item.percent));

  const label = element.querySelector('.cursor-label');
  if (label) {
    label.textContent = type === 'digits' ? String(index + 1) : '!';
  }

  const readablePercent = formatPercent(item.percent);
  element.setAttribute('aria-valuetext', `${type === 'digits' ? 'Chiffre' : 'Spécial'} ${readablePercent}`);
  element.setAttribute('aria-label', `${type === 'digits' ? 'Position chiffre' : 'Position spécial'} ${readablePercent}`);
  element.setAttribute('data-tooltip', `${type === 'digits' ? 'Chiffre' : 'Spécial'} • ${readablePercent}`);
}

function formatPercent(value) {
  return `${roundPercent(value)}%`;
}

function handlePointerDown(event) {
  if (state.mode !== 'visual') {
    return;
  }

  const cursor = event.currentTarget;
  const type = cursor?.dataset?.type;
  const index = parseInt(cursor?.dataset?.index || '0', 10);

  if (!type || Number.isNaN(index) || !state.track) {
    return;
  }

  event.preventDefault();
  cursor.setPointerCapture(event.pointerId);
  cursor.classList.add('dragging');
  state.container?.classList.add('placement-grabbing');

  const move = (moveEvent) => {
    const percent = computePercent(moveEvent.clientX);
    moveCursor(type, index, percent);
  };

  const up = () => {
    cursor.classList.remove('dragging');
    state.container?.classList.remove('placement-grabbing');
    cursor.releasePointerCapture(event.pointerId);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    scheduleBroadcast(true);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
}

function handleWheel(event) {
  if (state.mode !== 'visual') {
    return;
  }

  event.preventDefault();
  const cursor = event.currentTarget;
  const type = cursor?.dataset?.type;
  const index = parseInt(cursor?.dataset?.index || '0', 10);

  if (!type || Number.isNaN(index)) {
    return;
  }

  const base = state[type][index]?.percent ?? 0;
  const delta = event.deltaY < 0 ? (event.shiftKey ? FINE_STEP : KEY_STEP) : (event.shiftKey ? -FINE_STEP : -KEY_STEP);
  moveCursor(type, index, base + delta, true);
}

function handleKeydown(event) {
  if (state.mode !== 'visual') {
    return;
  }

  const cursor = event.currentTarget;
  const type = cursor?.dataset?.type;
  const index = parseInt(cursor?.dataset?.index || '0', 10);

  if (!type || Number.isNaN(index)) {
    return;
  }

  let handled = true;
  const base = state[type][index]?.percent ?? 0;
  const modifier = event.shiftKey ? FINE_STEP : KEY_STEP;

  switch (event.key) {
    case 'ArrowLeft':
      moveCursor(type, index, base - modifier, true);
      break;
    case 'ArrowRight':
      moveCursor(type, index, base + modifier, true);
      break;
    case 'Home':
      moveCursor(type, index, 0, true);
      break;
    case 'End':
      moveCursor(type, index, 100, true);
      break;
    case 'PageDown':
      moveCursor(type, index, base - modifier * 5, true);
      break;
    case 'PageUp':
      moveCursor(type, index, base + modifier * 5, true);
      break;
    default:
      handled = false;
  }

  if (handled) {
    event.preventDefault();
  }
}

function computePercent(clientX) {
  const metrics = getTrackMetrics();
  if (!metrics || metrics.usableWidth === 0) {
    return 0;
  }
  const delta = clientX - metrics.startX;
  const clampedDelta = Math.max(0, Math.min(metrics.usableWidth, delta));
  const relative = (clampedDelta / metrics.usableWidth) * 100;
  return roundPercent(relative);
}

function computeCursorLeft(percent) {
  const metrics = getTrackMetrics();
  const projected = projectPercentToLayer(percent, metrics);

  // Position handles against the actual visual track (bar width minus the
  // curved caps) to avoid the "floating" effect on the rounded bar.
  return `${projected}%`;
}

function moveCursor(type, index, percent, silent = false) {
  const items = state[type];
  const target = items[index];
  if (!target) return;

  target.percent = roundPercent(percent);
  const cursor = state.dom[type][index];
  if (cursor) {
    updateCursorElement(cursor, type, index);
  }

  if (!silent) {
    scheduleBroadcast();
  }
}

function handleSelectChange(type, value) {
  if (state.suppressSelect) {
    return;
  }

  if (value === 'positions') {
    setMode('visual');
    return;
  }

  state.previousSelects[type] = value;

  if (state.mode === 'visual' && !bothSelectsInPositions()) {
    setMode('auto');
    return;
  }

  if (state.mode !== 'visual') {
    applyAutoLayout(type);
  }
}

function handleWindowResize() {
  if (state.resizeRaf) {
    return;
  }

  state.resizeRaf = requestFrame(() => {
    state.resizeRaf = null;
    realignCursorPositions();
  });
}

// Realign existing cursor DOM nodes after layout changes while avoiding the
// legacy global helper name that collides with scripts loaded elsewhere.
function realignCursorPositions() {
  ['digits', 'specials'].forEach((type) => {
    const domList = state.dom[type];
    if (!Array.isArray(domList)) {
      return;
    }

    domList.forEach((cursor, index) => {
      if (cursor) {
        updateCursorElement(cursor, type, index);
      }
    });
  });

  updateLabels();
  updateSummary();
}

function projectPercentToLayer(percent, metrics = null) {
  const clamped = clampPercent(percent);
  const data = metrics || getTrackMetrics();

  if (!data || data.usableWidth === 0 || !data.layerWidth) {
    return clamped;
  }

  const pixelPosition = data.offsetStart + ((data.usableWidth * clamped) / 100);
  const normalized = (pixelPosition / data.layerWidth) * 100;
  return Math.max(0, Math.min(100, normalized));
}

function updateLabels() {
  if (!state.labelLayer) {
    return;
  }

  const labels = state.labelLayer.querySelectorAll('.bar-label');
  if (!labels.length) {
    return;
  }

  const metrics = getTrackMetrics();

  labels.forEach((label) => {
    const raw = label.dataset.percent;
    const logical = typeof raw === 'string' ? parseFloat(raw) : NaN;

    if (Number.isNaN(logical)) {
      return;
    }

    const projected = projectPercentToLayer(logical, metrics);
    label.style.setProperty('left', `${projected}%`);
  });
}

function bothSelectsInPositions() {
  const digitsValue = state.placementSelects.digits?.value;
  const specialsValue = state.placementSelects.specials?.value;
  return digitsValue === 'positions' && specialsValue === 'positions';
}

function setMode(newMode) {
  if (state.mode === newMode) {
    return;
  }

  const targetMode = newMode === 'visual' ? 'visual' : 'auto';

  if (targetMode === 'auto') {
    captureManualSnapshot();
  }

  state.mode = targetMode;

  if (state.mode === 'visual') {
    activateVisualMode();
    restoreManualSnapshot();
  } else {
    activateAutoMode();
    applyAutoLayout();
  }

  updateModeIndicator();
  scheduleBroadcast(true);
}

function activateVisualMode() {
  const { digits, specials } = state.placementSelects;

  if (digits && digits.value !== 'positions') {
    state.previousSelects.digits = digits.value;
  }

  if (specials && specials.value !== 'positions') {
    state.previousSelects.specials = specials.value;
  }

  setSelectValue(digits, 'positions');
  setSelectValue(specials, 'positions');
}

function activateAutoMode() {
  const { digits, specials } = state.placementSelects;
  const nextDigits = state.previousSelects.digits === 'positions' ? 'aleatoire' : state.previousSelects.digits;
  const nextSpecials = state.previousSelects.specials === 'positions' ? 'aleatoire' : state.previousSelects.specials;

  setSelectValue(digits, nextDigits || 'aleatoire');
  setSelectValue(specials, nextSpecials || 'aleatoire');
}

function setSelectValue(select, value) {
  if (!select) return;
  state.suppressSelect = true;
  select.value = value;
  state.suppressSelect = false;
}

function captureManualSnapshot() {
  state.manualSnapshot.digits = state.digits.map(item => roundPercent(item.percent));
  state.manualSnapshot.specials = state.specials.map(item => roundPercent(item.percent));
  state.manualSnapshot.baselineDigits = Array.isArray(state.baseline.digits)
    ? state.baseline.digits.slice()
    : [];
  state.manualSnapshot.baselineSpecials = Array.isArray(state.baseline.specials)
    ? state.baseline.specials.slice()
    : [];
}

function restoreManualSnapshot() {
  const digitsCount = parseInt(state.digitsSlider?.value || '0', 10);
  const specialsCount = parseInt(state.specialsSlider?.value || '0', 10);

  const digitsFallback = digitsCount > 0
    ? distributeEvenly(digitsCount, DEFAULT_RANGE.start, DEFAULT_RANGE.end)
    : [];
  const specialsFallback = specialsCount > 0
    ? distributeEvenly(specialsCount, DEFAULT_RANGE.start, DEFAULT_RANGE.end)
    : [];

  const digitsValues = mergeSnapshotWithFallback(state.manualSnapshot.digits, digitsFallback, digitsCount);
  const specialsValues = mergeSnapshotWithFallback(state.manualSnapshot.specials, specialsFallback, specialsCount);

  const digitsBaseline = mergeSnapshotWithFallback(state.manualSnapshot.baselineDigits, digitsFallback, digitsCount);
  const specialsBaseline = mergeSnapshotWithFallback(state.manualSnapshot.baselineSpecials, specialsFallback, specialsCount);

  applyPositions('digits', digitsValues, { updateBaseline: true, baselineValues: digitsBaseline });
  applyPositions('specials', specialsValues, { updateBaseline: true, baselineValues: specialsBaseline });
}

function mergeSnapshotWithFallback(snapshot, fallback, targetLength) {
  if (!Array.isArray(snapshot) || targetLength <= 0) {
    return fallback.slice();
  }

  if (snapshot.length >= targetLength) {
    return snapshot.slice(0, targetLength);
  }

  const merged = fallback.slice();
  for (let i = 0; i < snapshot.length && i < merged.length; i++) {
    merged[i] = snapshot[i];
  }
  return merged;
}

function applyAutoLayout(forceType = null) {
  const targets = forceType ? [forceType] : ['digits', 'specials'];
  targets.forEach((group) => {
    const slider = group === 'digits' ? state.digitsSlider : state.specialsSlider;
    const count = parseInt(slider?.value || '0', 10);
    updateGroupCount(group, count);
  });
}

function resolveAutoPlacement(type) {
  const selectValue = state.placementSelects[type]?.value;
  const stored = state.previousSelects[type] && state.previousSelects[type] !== 'positions'
    ? state.previousSelects[type]
    : 'aleatoire';

  if (!selectValue || selectValue === 'positions') {
    return stored || 'aleatoire';
  }

  return selectValue;
}

function buildAutoLayout(count, placement) {
  if (count <= 0) {
    return [];
  }

  const range = getAutoPresetRange(placement);
  if (!range) {
    return distributeEvenly(count, DEFAULT_RANGE.start, DEFAULT_RANGE.end);
  }

  const span = Math.abs(range.end - range.start);
  if (span < 0.001) {
    return new Array(count).fill(roundPercent(range.start));
  }

  if (count === 1) {
    switch (placement) {
      case 'debut':
        return [roundPercent(range.start)];
      case 'fin':
        return [roundPercent(range.end)];
      case 'milieu': {
        const mid = DEFAULT_RANGE.start + ((DEFAULT_RANGE.end - DEFAULT_RANGE.start) / 2);
        return [roundPercent(mid)];
      }
      default:
        return [roundPercent((range.start + range.end) / 2)];
    }
  }

  return distributeEvenly(count, range.start, range.end);
}

function getAutoPresetRange(placement) {
  const safe = typeof placement === 'string' ? placement : 'aleatoire';
  const totalSpan = Math.max(0, DEFAULT_RANGE.end - DEFAULT_RANGE.start);
  const cluster = Math.max(6, Math.min(24, totalSpan / 2));
  const halfCluster = cluster / 2;
  const center = DEFAULT_RANGE.start + (totalSpan / 2);

  switch (safe) {
    case 'debut':
      return {
        start: DEFAULT_RANGE.start,
        end: Math.min(DEFAULT_RANGE.start + cluster, DEFAULT_RANGE.end)
      };
    case 'milieu':
      return {
        start: Math.max(center - halfCluster, DEFAULT_RANGE.start),
        end: Math.min(center + halfCluster, DEFAULT_RANGE.end)
      };
    case 'fin':
      return {
        start: Math.max(DEFAULT_RANGE.end - cluster, DEFAULT_RANGE.start),
        end: DEFAULT_RANGE.end
      };
    case 'aleatoire':
    default:
      return {
        start: DEFAULT_RANGE.start,
        end: DEFAULT_RANGE.end
      };
  }
}

function updateModeIndicator() {
  if (!state.modeLabel) return;

  state.modeLabel.textContent = state.mode === 'visual' ? 'Visuel' : 'Auto';
  state.modeLabel.classList.toggle('mode-visual', state.mode === 'visual');
  state.modeLabel.classList.toggle('mode-auto', state.mode !== 'visual');
  state.container?.classList.toggle('mode-visual', state.mode === 'visual');
  state.container?.classList.toggle('mode-auto', state.mode !== 'visual');

  if (state.toggleBtn) {
    state.toggleBtn.textContent = state.mode === 'visual' ? '📊 → 🎯' : '🎯 → 📊';
  }
}

function autoDistribute() {
  const digits = state.digits.length;
  const specials = state.specials.length;

  const digitsDist = distributeEvenly(digits, DEFAULT_RANGE.start, DEFAULT_RANGE.end);
  const specialsDist = distributeEvenly(specials, DEFAULT_RANGE.start, DEFAULT_RANGE.end);

  applyPositions('digits', digitsDist, { updateBaseline: true });
  applyPositions('specials', specialsDist, { updateBaseline: true });
  flash('auto');
  scheduleBroadcast(true);
}

function resetToBaseline() {
  applyPositions('digits', state.baseline.digits || [], { updateBaseline: false });
  applyPositions('specials', state.baseline.specials || [], { updateBaseline: false });
  flash('reset');
  scheduleBroadcast(true);
}

function flash(kind) {
  if (!state.container) return;
  const className = kind === 'auto' ? 'flash-auto' : 'flash-reset';
  state.container.classList.remove(className);
  void state.container.offsetWidth; // reflow pour redémarrer l'animation
  state.container.classList.add(className);
  setTimeout(() => state.container?.classList.remove(className), 500);
}

function scheduleBroadcast(immediate = false) {
  if (immediate) {
    persistPositions();
    return;
  }

  if (state.broadcastRaf) {
    return;
  }

  state.broadcastRaf = requestFrame(() => {
    state.broadcastRaf = null;
    persistPositions();
  });
}

function persistPositions() {
  const digitValues = state.digits.map(item => roundPercent(item.percent));
  const specialValues = state.specials.map(item => roundPercent(item.percent));

  setDigitPositions(digitValues);
  setSpecialPositions(specialValues);
  updateSummary();
  notifyCallbacks();
}

function updateSummary() {
  if (!state.summaryEl) return;

  const digitsText = state.digits.length > 0
    ? state.digits.map(item => formatPercent(item.percent)).join(' · ')
    : '--';

  const specialsText = state.specials.length > 0
    ? state.specials.map(item => formatPercent(item.percent)).join(' · ')
    : '--';

  state.summaryEl.innerHTML = sanitizeHTML(`
    <span>Chiffres : <strong>${digitsText}</strong></span>
    <span>Spéciaux : <strong>${specialsText}</strong></span>
  `);
}

function notifyCallbacks() {
  const snapshot = getVisualPlacement();
  state.callbacks.forEach((cb) => {
    // ROBUSTNESS: Double-check callback is function before calling
    if (typeof cb !== 'function') {
      safeLog('placement.js: invalid callback type, skipping');
      return;
    }
    try {
      cb(snapshot);
    } catch (error) {
      safeLog(`placement.js: callback erreur - ${error.message}`);
    }
  });
}

function getVisualPlacement() {
  return {
    mode: state.mode,
    digits: state.digits.map(item => roundPercent(item.percent)),
    specials: state.specials.map(item => roundPercent(item.percent)),
    baseline: {
      digits: (state.baseline.digits || []).slice(),
      specials: (state.baseline.specials || []).slice()
    }
  };
}

function createAPI() {
  return {
    onUpdate(callback) {
      if (typeof callback === 'function') {
        state.callbacks.add(callback);
        return () => state.callbacks.delete(callback);
      }
      return () => {};
    },
    refresh: () => refreshCounts(true),
    getState: () => getVisualPlacement()
  };
}

export { initVisualPlacement, getVisualPlacement };
