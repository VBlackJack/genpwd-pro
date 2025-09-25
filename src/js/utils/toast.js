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
// src/js/utils/toast.js - Système de notifications temporaires
const activeToasts = new Set();

export function showToast(message, type = 'info') {
  const wrap = document.getElementById('toasts');
  if (!wrap) return;

  try {
    const div = document.createElement('div');
    div.className = 'toast';
    div.style.cssText = `
      position: fixed; top: ${20 + activeToasts.size * 60}px; right: 20px; z-index: 1000;
      background: var(--bg-secondary); color: var(--text-primary);
      padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border);
      box-shadow: var(--shadow); margin-bottom: 8px; max-width: 320px;
      border-left: 4px solid ${type === 'error' ? 'var(--accent-red)' : 
                             type === 'success' ? 'var(--accent-green)' : 'var(--accent-blue)'};
      opacity: 1; transform: translateX(0); transition: all 0.3s ease;
    `;
    div.textContent = message;
    
    activeToasts.add(div);
    wrap.appendChild(div);

    const cleanup = () => {
      activeToasts.delete(div);
      if (div.parentNode) div.remove();
    };

    setTimeout(() => {
      if (div.parentNode) {
        div.style.opacity = '0';
        div.style.transform = 'translateX(20px)';
      }
    }, 3200);

    setTimeout(cleanup, 3600);
  } catch (e) {
    console.error('Erreur toast:', e);
  }
}
