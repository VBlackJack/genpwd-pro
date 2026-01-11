/**
 * @fileoverview Vault SVG Icons
 * Centralized icon definitions for consistent UI
 */

/**
 * Create an SVG icon element
 * @param {string} path - SVG path content
 * @param {Object} options - Icon options
 * @param {number} options.size - Icon size (default: 24)
 * @param {number} options.strokeWidth - Stroke width (default: 2)
 * @param {string} options.className - Additional CSS class
 * @returns {string} SVG markup
 */
function createIcon(path, { size = 24, strokeWidth = 2, className = '' } = {}) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" class="${className}" aria-hidden="true">${path}</svg>`;
}

// Lock icons
export const ICON_LOCK = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>`;
export const ICON_UNLOCK = `<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>`;
export const ICON_KEY = `<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>`;

// Action icons
export const ICON_PLUS = `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line>`;
export const ICON_EDIT = `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>`;
export const ICON_DELETE = `<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>`;
export const ICON_COPY = `<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>`;
export const ICON_DUPLICATE = `<rect x="8" y="8" width="12" height="12" rx="2" ry="2"></rect><path d="M4 16V4a2 2 0 0 1 2-2h12"></path>`;
export const ICON_CLOSE = `<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>`;
export const ICON_CHECK = `<polyline points="20 6 9 17 4 12"></polyline>`;
export const ICON_REFRESH = `<polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>`;

// Navigation icons
export const ICON_CHEVRON_DOWN = `<polyline points="6 9 12 15 18 9"></polyline>`;
export const ICON_CHEVRON_LEFT = `<polyline points="15 18 9 12 15 6"></polyline>`;
export const ICON_CHEVRON_RIGHT = `<polyline points="9 18 15 12 9 6"></polyline>`;
export const ICON_ARROW_LEFT = `<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>`;
export const ICON_MENU = `<line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line>`;

// Entry type icons
export const ICON_LOGIN = `<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line>`;
export const ICON_NOTE = `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>`;
export const ICON_CARD = `<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>`;
export const ICON_IDENTITY = `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>`;

// UI icons
export const ICON_SEARCH = `<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>`;
export const ICON_FILTER = `<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>`;
export const ICON_SETTINGS = `<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>`;
export const ICON_EYE = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
export const ICON_EYE_OFF = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
export const ICON_STAR = `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>`;
export const ICON_STAR_FILLED = `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"></polygon>`;
export const ICON_CLOCK = `<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>`;
export const ICON_FOLDER = `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>`;
export const ICON_FOLDER_OPEN = `<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v1"></path><path d="M2 10h20l-2 9H4l-2-9z"></path>`;
export const ICON_TAG = `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>`;
export const ICON_CLOUD = `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>`;
export const ICON_SHIELD = `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>`;
export const ICON_ALERT = `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>`;
export const ICON_INFO = `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>`;
export const ICON_SUCCESS = `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>`;
export const ICON_ERROR = `<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>`;

// Theme icons
export const ICON_MOON = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
export const ICON_SUN = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;

// Windows Hello icon
export const ICON_HELLO = `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><circle cx="8.5" cy="10" r="1.5"/><circle cx="15.5" cy="10" r="1.5"/><path d="M12 18c2.21 0 4-1.79 4-4H8c0 2.21 1.79 4 4 4z"/>`;

// Import/Export icons
export const ICON_UPLOAD = `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line>`;
export const ICON_DOWNLOAD = `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>`;

// Health/Security icons
export const ICON_HEART = `<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>`;
export const ICON_ACTIVITY = `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>`;

// Sort icons
export const ICON_SORT_ASC = `<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>`;
export const ICON_SORT_DESC = `<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>`;

// BMAD Enhancement Icons
export const ICON_GENERATE = `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M13 6l-1.5 3-1.5-3-3-1.5 3-1.5 1.5-3 1.5 3 3 1.5-3 1.5z" fill="currentColor" stroke="none"></path>`;
export const ICON_CLIPBOARD = `<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>`;
export const ICON_TIMER = `<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline><path d="M12 2v2"></path><path d="M12 20v2"></path>`;
export const ICON_TRASH = `<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>`;
export const ICON_FLASK = `<path d="M9 3h6v5l4 9a2 2 0 0 1-1.8 3H6.8a2 2 0 0 1-1.8-3l4-9V3z"></path><path d="M9 3h6"></path><path d="M6 14h12"></path>`;
export const ICON_BUG = `<path d="M8 2l1.88 1.88"></path><path d="M14.12 3.88L16 2"></path><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"></path><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"></path><path d="M12 20v-9"></path><path d="M6.53 9C4.6 8.8 3 7.1 3 5"></path><path d="M6 13H2"></path><path d="M3 21c0-2.1 1.7-3.9 3.8-4"></path><path d="M17.47 9c1.93-.2 3.53-1.9 3.53-4"></path><path d="M22 13h-4"></path><path d="M21 21c0-2.1-1.7-3.9-3.8-4"></path>`;
export const ICON_VAULT = `<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="12" cy="12" r="4"></circle><path d="M12 8v8"></path><path d="M8 12h8"></path>`;
export const ICON_MORE = `<circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle>`;
export const ICON_MORE_VERTICAL = `<circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle>`;
export const ICON_SAVE = `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>`;
export const ICON_SYNC = `<path d="M21.5 2v6h-6"></path><path d="M2.5 22v-6h6"></path><path d="M22 11.5A10 10 0 0 0 3.2 7.2"></path><path d="M2 12.5a10 10 0 0 0 18.8 4.2"></path>`;
export const ICON_DASHBOARD = `<rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect>`;
export const ICON_SPARKLES = `<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"></path><path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z"></path><path d="M19 10l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5z"></path>`;
export const ICON_CALENDAR = `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>`;
export const ICON_LIGHTBULB = `<path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2z"></path>`;

/**
 * Get icon SVG by name
 * @param {string} name - Icon name
 * @param {Object} options - Icon options
 * @returns {string} SVG markup
 */
export function getIcon(name, options = {}) {
  const icons = {
    lock: ICON_LOCK,
    unlock: ICON_UNLOCK,
    key: ICON_KEY,
    plus: ICON_PLUS,
    edit: ICON_EDIT,
    delete: ICON_DELETE,
    copy: ICON_COPY,
    duplicate: ICON_DUPLICATE,
    close: ICON_CLOSE,
    check: ICON_CHECK,
    refresh: ICON_REFRESH,
    chevronDown: ICON_CHEVRON_DOWN,
    chevronLeft: ICON_CHEVRON_LEFT,
    chevronRight: ICON_CHEVRON_RIGHT,
    arrowLeft: ICON_ARROW_LEFT,
    menu: ICON_MENU,
    login: ICON_LOGIN,
    note: ICON_NOTE,
    card: ICON_CARD,
    identity: ICON_IDENTITY,
    search: ICON_SEARCH,
    filter: ICON_FILTER,
    settings: ICON_SETTINGS,
    eye: ICON_EYE,
    eyeOff: ICON_EYE_OFF,
    star: ICON_STAR,
    starFilled: ICON_STAR_FILLED,
    clock: ICON_CLOCK,
    folder: ICON_FOLDER,
    folderOpen: ICON_FOLDER_OPEN,
    tag: ICON_TAG,
    cloud: ICON_CLOUD,
    shield: ICON_SHIELD,
    alert: ICON_ALERT,
    info: ICON_INFO,
    success: ICON_SUCCESS,
    error: ICON_ERROR,
    moon: ICON_MOON,
    sun: ICON_SUN,
    hello: ICON_HELLO,
    upload: ICON_UPLOAD,
    download: ICON_DOWNLOAD,
    heart: ICON_HEART,
    activity: ICON_ACTIVITY,
    sortAsc: ICON_SORT_ASC,
    sortDesc: ICON_SORT_DESC,
    // BMAD Enhancement Icons
    generate: ICON_GENERATE,
    clipboard: ICON_CLIPBOARD,
    timer: ICON_TIMER,
    trash: ICON_TRASH,
    flask: ICON_FLASK,
    bug: ICON_BUG,
    vault: ICON_VAULT,
    more: ICON_MORE,
    moreVertical: ICON_MORE_VERTICAL,
    save: ICON_SAVE,
    sync: ICON_SYNC,
    dashboard: ICON_DASHBOARD,
    sparkles: ICON_SPARKLES,
    calendar: ICON_CALENDAR,
    lightbulb: ICON_LIGHTBULB
  };

  const path = icons[name];
  if (!path) return '';

  return createIcon(path, options);
}
