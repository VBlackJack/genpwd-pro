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
// src/js/ui/render.js - Rendu des résultats et cartes
import { getElement, addEventListener } from './dom.js';
import { copyToClipboard } from '../utils/clipboard.js';
import { showToast } from '../utils/toast.js';
import { compositionCounts, escapeHtml } from '../utils/helpers.js';
import { safeLog } from '../utils/logger.js';

const clickTimers = new WeakMap();

export function renderResults(results, mask) {
  const wrap = getElement('#results-list');
  if (!wrap) return;

  try {
    cleanupPasswordListeners();
    wrap.innerHTML = '';

    if (!Array.isArray(results) || results.length === 0) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔐</div>
          <p>Cliquez sur "Générer" pour créer vos mots de passe</p>
        </div>`;
      return;
    }

    results.forEach((item, idx) => {
      const { value } = item;
      if (typeof value !== 'string') return;

      const card = createPasswordCard(item, idx + 1, mask);
      wrap.appendChild(card);
    });

    bindPasswordClickEvents();
  } catch (e) {
    safeLog(`Erreur renderResults: ${e.message}`);
  }
}

function createPasswordCard(item, id, mask) {
  const { value, entropy, mode, dictionary } = item;
  const counts = compositionCounts(value);
  const total = value.length || 1;
  
  // Calcul des segments pour la barre de composition
  const segU = Math.round(counts.U / total * 1000) / 10;
  const segL = Math.round(counts.L / total * 1000) / 10;
  const segD = Math.round(counts.D / total * 1000) / 10;
  const segS = Math.round(counts.S / total * 1000) / 10;

  // Information sur le dictionnaire
  const dictInfo = mode === 'passphrase' && dictionary ? 
    `${dictionary.charAt(0).toUpperCase() + dictionary.slice(1)}` : 
    mode || 'unknown';

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-sec card-header">
      <div class="id">#${id}</div>
      <span class="spacer"></span>
      <div class="stat"><span class="dot"></span><strong>${(entropy || 0).toFixed(1)}</strong>&nbsp;bits</div>
      <div class="len">${total} chars</div>
    </div>
    <div class="card-sec pwd ${mask ? 'masked' : ''}" data-index="${id-1}" data-password="${escapeHtml(value)}" title="Cliquer pour copier • Double-clic pour afficher/masquer">
      <div class="value mono">${escapeHtml(value)}</div>
      <div class="actions">
        <svg class="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copier</span>
      </div>
    </div>
    <div class="card-sec comp">
      <div class="comp-bar">
        ${segU > 0 ? `<div class="seg u" style="width:${segU}%"></div>` : ''}
        ${segL > 0 ? `<div class="seg l" style="width:${segL}%"></div>` : ''}
        ${segD > 0 ? `<div class="seg d" style="width:${segD}%"></div>` : ''}
        ${segS > 0 ? `<div class="seg s" style="width:${segS}%"></div>` : ''}
      </div>
      <div class="comp-legend">
        <span class="legend-item"><span class="legend-dot" style="background:var(--accent-blue)"></span>${counts.U} MAJ</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--accent-purple)"></span>${counts.L} min</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--accent-yellow)"></span>${counts.D} chiffres</span>
        <span class="legend-item"><span class="legend-dot" style="background:var(--accent-green)"></span>${counts.S} spé</span>
      </div>
    </div>
    <div class="card-sec info"><div>Mode: ${dictInfo}</div><div>CLI-Safe: ✓</div></div>
  `;

  return card;
}

function bindPasswordClickEvents() {
  const passwordElements = document.querySelectorAll('.pwd');
  
  passwordElements.forEach(el => {
    addEventListener(el, 'click', async (e) => {
      e.preventDefault();
      
      const existingTimer = clickTimers.get(el);
      if (existingTimer) {
        clearTimeout(existingTimer);
        clickTimers.delete(el);
        
        // Double-clic : basculer masquage
        el.classList.toggle('masked');
        const actionsEl = el.querySelector('.actions span');
        if (actionsEl) {
          actionsEl.textContent = 'Copier';
        }
        return;
      }

      // Simple clic : programmer la copie
      const timer = setTimeout(async () => {
        clickTimers.delete(el);
        
        const password = el.getAttribute('data-password');
        if (password) {
          el.classList.add('copying');
          
          const success = await copyToClipboard(password);
          if (success) {
            showToast('Mot de passe copié !', 'success');
            safeLog(`Copié: ${password.substring(0, 8)}...`);
          } else {
            showToast('Erreur lors de la copie', 'error');
          }
          
          setTimeout(() => {
            el.classList.remove('copying');
          }, 600);
        }
      }, 250);

      clickTimers.set(el, timer);
    });
  });
}

function cleanupPasswordListeners() {
  document.querySelectorAll('.pwd').forEach(el => {
    const timer = clickTimers.get(el);
    if (timer) {
      clearTimeout(timer);
      clickTimers.delete(el);
    }
  });
}

export function updateMaskDisplay(mask) {
  document.querySelectorAll('.pwd').forEach(el => {
    el.classList.toggle('masked', mask);
  });
}

export function renderEmptyState() {
  const wrap = getElement('#results-list');
  if (wrap) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔐</div>
        <p>Cliquez sur "Générer" pour créer vos mots de passe</p>
      </div>`;
  }
}
