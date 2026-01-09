/**
 * @fileoverview Vault Components Index
 * Re-exports all component modules
 */

// Entry context menu
export {
  renderContextMenuContent,
  showContextMenu,
  closeContextMenu
} from './context-menu.js';

// Folder context menu
export {
  showFolderContextMenu,
  closeFolderContextMenu,
  FOLDER_ACTIONS
} from './folder-context-menu.js';

// Password generator
export {
  showPasswordGenerator,
  closePasswordGenerator,
  generatePassword,
  DEFAULT_OPTIONS as PASSWORD_DEFAULTS
} from './password-generator.js';

// Timeout settings
export {
  showTimeoutSettings,
  closeTimeoutSettings,
  TIMEOUT_OPTIONS
} from './timeout-settings.js';

// Color picker
export {
  showColorPicker,
  closeColorPicker,
  getFolderColor,
  setFolderColor,
  FOLDER_COLORS
} from './color-picker.js';

// Entry preview
export {
  showEntryPreview,
  updateEntryPreviewPosition,
  hideEntryPreview
} from './entry-preview.js';

// Windows Hello settings
export {
  showHelloSettingsPopover,
  closeHelloSettingsPopover,
  updateHelloButtonState,
  showPasswordPrompt
} from './hello-settings.js';

// Tags display
export {
  renderTagsList,
  renderTagPicker,
  renderTagsInRow,
  renderTagsInDetail,
  TAG_COLORS
} from './tags-display.js';

// Entry fields
export {
  renderExpirationField,
  renderTOTPField,
  getTotpSecret,
  clearTotpSecret,
  clearAllTotpSecrets
} from './entry-fields.js';

// Attachments handling
export {
  getFileIcon,
  formatFileSize,
  readFileAsBase64,
  renderAttachmentsUI,
  downloadAttachment,
  MAX_ATTACHMENT_SIZE,
  isValidAttachmentSize
} from './attachments-handler.js';

// View mode switcher
export {
  VIEW_MODES,
  GROUP_BY_OPTIONS,
  initViewMode,
  getViewMode,
  getGroupBy,
  setViewMode,
  setGroupBy,
  onViewModeChange,
  renderViewModeSwitcher,
  renderGroupByDropdown,
  renderViewToolbar,
  initViewModeSwitcherEvents
} from './view-mode-switcher.js';
