/*
 * Copyright 2026 Julien Bombled
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

/**
 * Main Process Translations
 *
 * Internationalization for Electron main process components:
 * - Tray menu
 * - Dialog boxes
 * - Notifications
 * - Application menu
 *
 * @module translations
 */

const translations = {
  en: {
    // Tray menu
    trayTooltip: 'GenPwd Pro - Password Generator',
    showApp: 'Show GenPwd Pro',
    generatePassword: 'Generate password',
    lockVault: 'Lock vault',
    quit: 'Quit',
    passwordGenerated: 'Password generated',
    copiedToClipboard: 'Copied to clipboard (30s)',
    development: 'Development',

    // Context menu
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    undo: 'Undo',
    redo: 'Redo',

    // Close dialog
    minimizeToTray: 'Minimize to Tray',
    quitApp: 'Quit Application',
    alwaysMinimize: 'Always Minimize (Remember)',
    closePromptTitle: 'Close GenPwd Pro?',
    closePromptDetail: 'GenPwd Pro can run in the background to keep your vault accessible. Choose "Quit" to completely close the application.',

    // Tray notifications
    trayNotifyFirst: 'App minimized to tray. Click the tray icon to restore, or right-click for options.',
    trayNotifyRepeat: 'Running in background. Right-click tray icon to quit.',

    // Clipboard security
    securityTip: 'Security Tip',
    clipboardHistoryWarning: 'Windows Clipboard History (Win+V) may retain copied passwords. Consider disabling it in Windows Settings > System > Clipboard.',

    // Vault locked notifications
    vaultLockedTitle: 'GenPwd Pro - Vault Locked',
    vaultLockedScreenLock: 'Your vault was automatically locked for security when the screen was locked.',
    vaultLockedSuspend: 'Your vault was automatically locked for security when the system went to sleep.',

    // Admin warning
    securityWarning: 'Security Warning',
    runningAsAdmin: 'GenPwd Pro is running as Administrator',
    adminWarningDetail: 'Running as admin may cause vault files to have restricted permissions that other users cannot access.\n\nFor best security, run GenPwd Pro as a standard user.',
    iUnderstand: 'I Understand',

    // Auto-type
    autoTypeBlocked: 'Auto-type blocked: Cannot type into command-line windows for security reasons.',

    // File dialogs
    openFile: 'Open a file',
    openVault: 'Open a vault',
    saveVault: 'Save vault',
    allFiles: 'All files',
    genPwdVault: 'GenPwd Vault',
    jsonExport: 'JSON Export',

    // Menu - File
    menuFile: 'File',
    menuGenerateNew: 'Generate New Password',
    menuQuit: 'Quit',

    // Menu - Vault
    menuVault: 'Vault',
    menuNewVault: 'New Vault...',
    menuOpenVault: 'Open Vault...',
    menuLock: 'Lock',

    // Menu - Edit
    menuEdit: 'Edit',

    // Menu - View
    menuView: 'View',
    menuReload: 'Reload',
    menuForceReload: 'Force Reload',
    menuActualSize: 'Actual Size',
    menuZoomIn: 'Zoom In',
    menuZoomOut: 'Zoom Out',
    menuFullScreen: 'Full Screen',
    menuDevTools: 'Developer Tools',

    // Menu - Help
    menuHelp: 'Help',
    menuDocumentation: 'Documentation',
    menuReportBug: 'Report a Bug',
    menuAbout: 'About',

    // About dialog
    aboutTitle: 'About GenPwd Pro',
    aboutDescription: 'Secure Password Manager',

    // Dev menu
    menuDev: 'Development',
    menuDevTools2: 'Developer Tools',
    menuClearCache: 'Reload and clear cache',

    // Jump List / Thumbnail
    generateSecurePassword: 'Generate a new secure password',
    openPasswordVault: 'Open password vault',
    lockVaultImmediately: 'Lock the vault immediately',

    // Error messages
    errorAutoStartFailed: 'Setting was not applied. Check permissions or antivirus.',
    errorSecureStorageUnavailable: 'Secure storage not available',
    errorTooManyAttempts: 'Too many attempts. Try again in {seconds}s',
    errorNoMainWindow: 'No main window',
    errorInvalidFilePath: 'Invalid file path',
    errorNullBytes: 'Invalid path: contains null bytes',
    errorDirectoryTraversal: 'Invalid path: directory traversal not allowed',
    errorMustBeAbsolute: 'Invalid path: must be absolute',
    errorNotInAllowedDir: 'Invalid path: not in allowed directory',
    errorInvalidExtension: 'Invalid file extension. Allowed: {extensions}',
    errorPathNotFile: 'Path is not a file',
    errorFileNotFound: 'File not found',
    errorAutoTypeWindows: 'Auto-type currently only supported on Windows',
    errorMissingSequence: 'Missing sequence or data',
    errorAutoTypeWindowDetect: 'Could not detect target window. Auto-type cancelled for security.',
    errorAutoTypeTimeout: 'Auto-type timed out',
    clipboardAutoCleared: 'Clipboard auto-cleared for security'
  },

  fr: {
    // Tray menu
    trayTooltip: 'GenPwd Pro - Générateur de mots de passe',
    showApp: 'Afficher GenPwd Pro',
    generatePassword: 'Générer un mot de passe',
    lockVault: 'Verrouiller le coffre',
    quit: 'Quitter',
    passwordGenerated: 'Mot de passe généré',
    copiedToClipboard: 'Copié dans le presse-papier (30s)',
    development: 'Développement',

    // Context menu
    cut: 'Couper',
    copy: 'Copier',
    paste: 'Coller',
    selectAll: 'Tout sélectionner',
    undo: 'Annuler',
    redo: 'Rétablir',

    // Close dialog
    minimizeToTray: 'Réduire dans la barre',
    quitApp: 'Quitter l\'application',
    alwaysMinimize: 'Toujours réduire (Mémoriser)',
    closePromptTitle: 'Fermer GenPwd Pro ?',
    closePromptDetail: 'GenPwd Pro peut continuer en arrière-plan pour garder votre coffre accessible. Choisissez "Quitter" pour fermer complètement.',

    // Tray notifications
    trayNotifyFirst: 'Application réduite dans la barre. Cliquez sur l\'icône pour restaurer, ou clic droit pour les options.',
    trayNotifyRepeat: 'Exécution en arrière-plan. Clic droit sur l\'icône pour quitter.',

    // Clipboard security
    securityTip: 'Conseil de sécurité',
    clipboardHistoryWarning: 'L\'historique du presse-papier Windows (Win+V) peut conserver les mots de passe copiés. Pensez à le désactiver dans Paramètres > Système > Presse-papiers.',

    // Vault locked notifications
    vaultLockedTitle: 'GenPwd Pro - Coffre verrouillé',
    vaultLockedScreenLock: 'Votre coffre a été automatiquement verrouillé pour votre sécurité lors du verrouillage de l\'écran.',
    vaultLockedSuspend: 'Votre coffre a été automatiquement verrouillé pour votre sécurité lors de la mise en veille.',

    // Admin warning
    securityWarning: 'Avertissement de sécurité',
    runningAsAdmin: 'GenPwd Pro s\'exécute en tant qu\'Administrateur',
    adminWarningDetail: 'L\'exécution en tant qu\'admin peut créer des fichiers de coffre avec des permissions restreintes inaccessibles aux autres utilisateurs.\n\nPour une meilleure sécurité, lancez GenPwd Pro en utilisateur standard.',
    iUnderstand: 'Je comprends',

    // Auto-type
    autoTypeBlocked: 'Saisie automatique bloquée : impossible de saisir dans les fenêtres de ligne de commande pour des raisons de sécurité.',

    // File dialogs
    openFile: 'Ouvrir un fichier',
    openVault: 'Ouvrir un coffre',
    saveVault: 'Sauvegarder le coffre',
    allFiles: 'Tous les fichiers',
    genPwdVault: 'Coffre GenPwd',
    jsonExport: 'Export JSON',

    // Menu - File
    menuFile: 'Fichier',
    menuGenerateNew: 'Générer un nouveau mot de passe',
    menuQuit: 'Quitter',

    // Menu - Vault
    menuVault: 'Coffre',
    menuNewVault: 'Nouveau coffre...',
    menuOpenVault: 'Ouvrir un coffre...',
    menuLock: 'Verrouiller',

    // Menu - Edit
    menuEdit: 'Édition',

    // Menu - View
    menuView: 'Affichage',
    menuReload: 'Recharger',
    menuForceReload: 'Forcer le rechargement',
    menuActualSize: 'Taille réelle',
    menuZoomIn: 'Zoom avant',
    menuZoomOut: 'Zoom arrière',
    menuFullScreen: 'Plein écran',
    menuDevTools: 'Outils de développement',

    // Menu - Help
    menuHelp: 'Aide',
    menuDocumentation: 'Documentation',
    menuReportBug: 'Signaler un bug',
    menuAbout: 'À propos',

    // About dialog
    aboutTitle: 'À propos de GenPwd Pro',
    aboutDescription: 'Gestionnaire de mots de passe sécurisé',

    // Dev menu
    menuDev: 'Développement',
    menuDevTools2: 'Outils de développement',
    menuClearCache: 'Recharger et effacer le cache',

    // Jump List / Thumbnail
    generateSecurePassword: 'Générer un nouveau mot de passe sécurisé',
    openPasswordVault: 'Ouvrir le coffre de mots de passe',
    lockVaultImmediately: 'Verrouiller le coffre immédiatement',

    // Error messages
    errorAutoStartFailed: 'Paramètre non appliqué. Vérifiez les permissions ou l\'antivirus.',
    errorSecureStorageUnavailable: 'Stockage sécurisé non disponible',
    errorTooManyAttempts: 'Trop de tentatives. Réessayez dans {seconds}s',
    errorNoMainWindow: 'Pas de fenêtre principale',
    errorInvalidFilePath: 'Chemin de fichier invalide',
    errorNullBytes: 'Chemin invalide : contient des octets nuls',
    errorDirectoryTraversal: 'Chemin invalide : traversée de répertoire non autorisée',
    errorMustBeAbsolute: 'Chemin invalide : doit être absolu',
    errorNotInAllowedDir: 'Chemin invalide : pas dans le répertoire autorisé',
    errorInvalidExtension: 'Extension de fichier invalide. Autorisées : {extensions}',
    errorPathNotFile: 'Le chemin n\'est pas un fichier',
    errorFileNotFound: 'Fichier non trouvé',
    errorAutoTypeWindows: 'Saisie automatique uniquement supportée sur Windows actuellement',
    errorMissingSequence: 'Séquence ou données manquantes',
    errorAutoTypeWindowDetect: 'Impossible de détecter la fenêtre cible. Saisie automatique annulée par sécurité.',
    errorAutoTypeTimeout: 'Délai de saisie automatique expiré',
    clipboardAutoCleared: 'Presse-papiers effacé automatiquement par sécurité'
  },

  es: {
    // Tray menu
    trayTooltip: 'GenPwd Pro - Generador de contraseñas',
    showApp: 'Mostrar GenPwd Pro',
    generatePassword: 'Generar contraseña',
    lockVault: 'Bloquear bóveda',
    quit: 'Salir',
    passwordGenerated: 'Contraseña generada',
    copiedToClipboard: 'Copiado al portapapeles (30s)',
    development: 'Desarrollo',

    // Context menu
    cut: 'Cortar',
    copy: 'Copiar',
    paste: 'Pegar',
    selectAll: 'Seleccionar todo',
    undo: 'Deshacer',
    redo: 'Rehacer',

    // Close dialog
    minimizeToTray: 'Minimizar a bandeja',
    quitApp: 'Cerrar aplicación',
    alwaysMinimize: 'Siempre minimizar (Recordar)',
    closePromptTitle: '¿Cerrar GenPwd Pro?',
    closePromptDetail: 'GenPwd Pro puede ejecutarse en segundo plano para mantener su bóveda accesible. Elija "Cerrar" para salir completamente.',

    // Tray notifications
    trayNotifyFirst: 'Aplicación minimizada a la bandeja. Haga clic en el icono para restaurar, o clic derecho para opciones.',
    trayNotifyRepeat: 'Ejecutándose en segundo plano. Clic derecho en el icono para salir.',

    // Clipboard security
    securityTip: 'Consejo de seguridad',
    clipboardHistoryWarning: 'El historial del portapapeles de Windows (Win+V) puede retener contraseñas copiadas. Considere deshabilitarlo en Configuración > Sistema > Portapapeles.',

    // Vault locked notifications
    vaultLockedTitle: 'GenPwd Pro - Bóveda bloqueada',
    vaultLockedScreenLock: 'Su bóveda fue bloqueada automáticamente por seguridad cuando se bloqueó la pantalla.',
    vaultLockedSuspend: 'Su bóveda fue bloqueada automáticamente por seguridad cuando el sistema entró en suspensión.',

    // Admin warning
    securityWarning: 'Advertencia de seguridad',
    runningAsAdmin: 'GenPwd Pro se está ejecutando como Administrador',
    adminWarningDetail: 'Ejecutar como admin puede crear archivos de bóveda con permisos restringidos inaccesibles para otros usuarios.\n\nPara mayor seguridad, ejecute GenPwd Pro como usuario estándar.',
    iUnderstand: 'Entiendo',

    // Auto-type
    autoTypeBlocked: 'Escritura automática bloqueada: no se puede escribir en ventanas de línea de comandos por razones de seguridad.',

    // File dialogs
    openFile: 'Abrir un archivo',
    openVault: 'Abrir una bóveda',
    saveVault: 'Guardar bóveda',
    allFiles: 'Todos los archivos',
    genPwdVault: 'Bóveda GenPwd',
    jsonExport: 'Exportar JSON',

    // Menu - File
    menuFile: 'Archivo',
    menuGenerateNew: 'Generar nueva contraseña',
    menuQuit: 'Salir',

    // Menu - Vault
    menuVault: 'Bóveda',
    menuNewVault: 'Nueva bóveda...',
    menuOpenVault: 'Abrir bóveda...',
    menuLock: 'Bloquear',

    // Menu - Edit
    menuEdit: 'Editar',

    // Menu - View
    menuView: 'Ver',
    menuReload: 'Recargar',
    menuForceReload: 'Forzar recarga',
    menuActualSize: 'Tamaño real',
    menuZoomIn: 'Acercar',
    menuZoomOut: 'Alejar',
    menuFullScreen: 'Pantalla completa',
    menuDevTools: 'Herramientas de desarrollo',

    // Menu - Help
    menuHelp: 'Ayuda',
    menuDocumentation: 'Documentación',
    menuReportBug: 'Reportar un error',
    menuAbout: 'Acerca de',

    // About dialog
    aboutTitle: 'Acerca de GenPwd Pro',
    aboutDescription: 'Gestor de contraseñas seguro',

    // Dev menu
    menuDev: 'Desarrollo',
    menuDevTools2: 'Herramientas de desarrollo',
    menuClearCache: 'Recargar y limpiar caché',

    // Jump List / Thumbnail
    generateSecurePassword: 'Generar una nueva contraseña segura',
    openPasswordVault: 'Abrir bóveda de contraseñas',
    lockVaultImmediately: 'Bloquear la bóveda inmediatamente',

    // Error messages
    errorAutoStartFailed: 'Configuración no aplicada. Verifique permisos o antivirus.',
    errorSecureStorageUnavailable: 'Almacenamiento seguro no disponible',
    errorTooManyAttempts: 'Demasiados intentos. Reintente en {seconds}s',
    errorNoMainWindow: 'Sin ventana principal',
    errorInvalidFilePath: 'Ruta de archivo inválida',
    errorNullBytes: 'Ruta inválida: contiene bytes nulos',
    errorDirectoryTraversal: 'Ruta inválida: traversal de directorios no permitido',
    errorMustBeAbsolute: 'Ruta inválida: debe ser absoluta',
    errorNotInAllowedDir: 'Ruta inválida: no está en directorio permitido',
    errorInvalidExtension: 'Extensión de archivo inválida. Permitidas: {extensions}',
    errorPathNotFile: 'La ruta no es un archivo',
    errorFileNotFound: 'Archivo no encontrado',
    errorAutoTypeWindows: 'Escritura automática solo soportada en Windows actualmente',
    errorMissingSequence: 'Secuencia o datos faltantes',
    errorAutoTypeWindowDetect: 'No se pudo detectar ventana objetivo. Escritura automática cancelada por seguridad.',
    errorAutoTypeTimeout: 'Tiempo de escritura automática agotado',
    clipboardAutoCleared: 'Portapapeles limpiado automáticamente por seguridad'
  }
};

/**
 * Get translations for the current locale
 * @param {Object} app - Electron app object
 * @returns {Object} Translation object for current locale
 */
function getMainTranslations(app) {
  const locale = app.getLocale().split('-')[0];
  return translations[locale] || translations.en;
}

/**
 * Get a specific translation with optional interpolation
 * @param {Object} app - Electron app object
 * @param {string} key - Translation key
 * @param {Object} params - Interpolation parameters
 * @returns {string} Translated string
 */
function t(app, key, params = {}) {
  const trans = getMainTranslations(app);
  let value = trans[key] || translations.en[key] || key;

  // Simple interpolation: {key} -> value
  for (const [k, v] of Object.entries(params)) {
    value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }

  return value;
}

module.exports = {
  translations,
  getMainTranslations,
  t
};
