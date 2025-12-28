/**
 * @fileoverview Vault Modals Index
 * Re-exports all modal modules
 */

// Base modal components
export {
  renderModal,
  renderCloseButton,
  renderModalActions,
  renderFormInput,
  renderFormSelect,
  renderColorPicker,
  TAG_COLORS
} from './base-modal.js';

// Folder and tag modals
export {
  renderAddFolderModal,
  renderAddTagModal,
  renderEditTagModal,
  renderMoveFolderModal,
  renderBulkTagModal
} from './folder-tag-modals.js';

// Confirm dialog
export {
  renderConfirmDialog,
  showConfirmDialog,
  showDangerConfirm,
  showWarningConfirm
} from './confirm-dialog.js';

// Shortcuts modal
export {
  renderShortcutsModal,
  getShortcutCategories
} from './shortcuts-modal.js';

// Form field templates
export {
  FIELD_KIND_OPTIONS,
  renderPasswordField,
  renderExpiryPicker,
  renderLoginFields,
  renderNoteFields,
  renderCardFields,
  renderIdentityFields,
  renderTypeFields
} from './form-fields.js';

// Custom fields
export {
  renderCustomFieldsSection,
  renderCustomField,
  createCustomFieldElement,
  collectCustomFieldsData,
  createCustomFieldsController
} from './custom-fields.js';

// Entry form modals
export {
  ENTRY_TYPE_DEFS,
  renderTypeSelector,
  renderTagPicker,
  renderFolderSelector,
  renderAddEntryModal,
  renderEditEntryModal,
  renderEditEntryContent,
  collectEntryFormData
} from './entry-form.js';
