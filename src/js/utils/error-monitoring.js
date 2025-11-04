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

// src/js/utils/error-monitoring.js - Système de monitoring d'erreurs

/**
 * Vérifie si l'application est en mode développement
 * @returns {boolean} true si en développement
 */
function isDevelopment() {
  return location.hostname === 'localhost' ||
         location.hostname === '127.0.0.1' ||
         location.protocol === 'file:';
}

/**
 * Configuration du monitoring d'erreurs
 */
const monitoringConfig = {
  enabled: !isDevelopment(),
  maxErrors: 50, // Maximum d'erreurs à garder en mémoire
  // URL de votre service de monitoring (Sentry, LogRocket, etc.)
  // endpoint: 'https://your-monitoring-service.com/api/errors',
  endpoint: null, // Désactivé par défaut
  apiKey: null
};

/**
 * Stockage des erreurs en mémoire
 */
const errorLog = [];

/**
 * Nettoie les données sensibles d'une erreur avant l'envoi
 * @param {Error} error - Erreur à nettoyer
 * @returns {Object} Erreur nettoyée
 */
function sanitizeError(error) {
  const sanitized = {
    message: error.message || 'Unknown error',
    stack: error.stack || '',
    name: error.name || 'Error',
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    // Retirer les paramètres sensibles de l'URL
    cleanUrl: window.location.origin + window.location.pathname
  };

  // Supprimer les informations potentiellement sensibles du stack trace
  if (sanitized.stack) {
    sanitized.stack = sanitized.stack
      .split('\n')
      .slice(0, 10) // Limiter à 10 lignes
      .join('\n');
  }

  return sanitized;
}

/**
 * Enregistre une erreur localement
 * @param {Error} error - Erreur à enregistrer
 */
function logErrorLocally(error) {
  const sanitized = sanitizeError(error);

  errorLog.push(sanitized);

  // Garder uniquement les N dernières erreurs
  if (errorLog.length > monitoringConfig.maxErrors) {
    errorLog.shift();
  }

  // En développement, logger dans la console
  if (isDevelopment()) {
    console.error('Error logged:', sanitized);
  }
}

/**
 * Envoie une erreur à un service de monitoring distant
 * @param {Error} error - Erreur à envoyer
 */
async function sendErrorToMonitoring(error) {
  // Ne pas envoyer en développement
  if (isDevelopment() || !monitoringConfig.enabled || !monitoringConfig.endpoint) {
    return;
  }

  try {
    const sanitized = sanitizeError(error);

    // Exemple d'envoi à Sentry ou service similaire
    await fetch(monitoringConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(monitoringConfig.apiKey && { 'Authorization': `Bearer ${monitoringConfig.apiKey}` })
      },
      body: JSON.stringify({
        error: sanitized,
        app: {
          name: 'GenPwd Pro',
          version: '2.5.1',
          environment: isDevelopment() ? 'development' : 'production'
        }
      })
    });
  } catch (sendError) {
    // En cas d'échec d'envoi, ne pas créer de boucle infinie
    console.warn('Failed to send error to monitoring service:', sendError);
  }
}

/**
 * Gère une erreur globale
 * @param {Error} error - Erreur à gérer
 * @param {Object} context - Contexte additionnel
 */
export function reportError(error, context = {}) {
  // Ajouter le contexte à l'erreur
  if (context && Object.keys(context).length > 0) {
    error.context = context;
  }

  // Logger localement
  logErrorLocally(error);

  // Envoyer au service de monitoring
  sendErrorToMonitoring(error);
}

/**
 * Configure le monitoring d'erreurs
 * @param {Object} config - Configuration
 * @param {boolean} config.enabled - Activer le monitoring
 * @param {string} config.endpoint - URL du service de monitoring
 * @param {string} config.apiKey - Clé API du service
 */
export function configureMonitoring(config) {
  Object.assign(monitoringConfig, config);
}

/**
 * Récupère les erreurs enregistrées localement
 * @returns {Array} Liste des erreurs
 */
export function getErrorLog() {
  return [...errorLog];
}

/**
 * Efface le log d'erreurs local
 */
export function clearErrorLog() {
  errorLog.length = 0;
}

/**
 * Initialise le système de monitoring d'erreurs global
 */
export function initErrorMonitoring() {
  // Capture des erreurs non gérées
  window.addEventListener('error', (event) => {
    const error = new Error(event.message);
    error.stack = event.error?.stack;
    error.filename = event.filename;
    error.lineno = event.lineno;
    error.colno = event.colno;

    reportError(error, {
      type: 'uncaught_error',
      filename: event.filename,
      line: event.lineno,
      column: event.colno
    });
  });

  // Capture des promesses rejetées non gérées
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    reportError(error, {
      type: 'unhandled_rejection',
      promise: true
    });

    // Empêcher l'affichage dans la console (déjà loggé)
    event.preventDefault();
  });

  console.log('Error monitoring initialized');
}

/**
 * Wrapper pour exécuter du code avec gestion d'erreurs
 * @param {Function} fn - Fonction à exécuter
 * @param {Object} context - Contexte pour le reporting
 * @returns {*} Résultat de la fonction ou null en cas d'erreur
 */
export async function withErrorHandling(fn, context = {}) {
  try {
    return await fn();
  } catch (error) {
    reportError(error, context);
    return null;
  }
}

// Export des stats d'erreurs
export const errorStats = {
  get count() {
    return errorLog.length;
  },
  get recent() {
    return errorLog.slice(-5);
  },
  get all() {
    return getErrorLog();
  }
};
