// src/js/utils/logger.js - Système de logs sécurisé
const MAX_LOG_LINES = 100;
const LOG_TRIM_SIZE = 50;

function nowTime() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

export function safeLog(msg) {
  console.log('LOG:', msg);
  
  requestAnimationFrame(() => {
    const el = document.getElementById('logs');
    if (!el) return;

    try {
      if (el.textContent.trim() === '[--:--:--] En attente d\'initialisation...') {
        el.textContent = '';
      }

      const newLine = `[${nowTime()}] ${msg}\n`;
      el.textContent += newLine;

      const lines = el.textContent.split('\n');
      if (lines.length > MAX_LOG_LINES) {
        el.textContent = lines.slice(-LOG_TRIM_SIZE).join('\n');
        el.textContent = `[${nowTime()}] ...logs précédents tronqués...\n` + el.textContent;
      }

      el.scrollTop = el.scrollHeight;
    } catch (e) {
      console.error('Erreur dans safeLog:', e);
    }
  });
}

export function clearLogs() {
  const logsEl = document.getElementById('logs');
  if (logsEl) {
    logsEl.textContent = '';
    safeLog('Logs effacés');
  }
}