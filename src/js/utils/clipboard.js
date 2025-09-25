// src/js/utils/clipboard.js - Gestion sécurisée du presse-papiers
import { safeLog } from './logger.js';

export async function copyToClipboard(text) {
  if (!text) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    return fallbackCopyTextToClipboard(text);
  } catch (err) {
    safeLog(`Erreur copie clipboard: ${err.message}`);
    return fallbackCopyTextToClipboard(text);
  }
}

function fallbackCopyTextToClipboard(text) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    Object.assign(textArea.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '2em',
      height: '2em',
      padding: '0',
      border: 'none',
      outline: 'none',
      boxShadow: 'none',
      background: 'transparent',
      opacity: '0'
    });

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return successful;
  } catch (err) {
    safeLog(`Erreur fallback clipboard: ${err.message}`);
    return false;
  }
}