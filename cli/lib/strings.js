/*
 * GenPwd Pro CLI - Centralized Strings
 * Copyright 2025 Julien Bombled
 *
 * All user-facing strings for the CLI tool.
 * This allows for easier maintenance and potential future i18n.
 */

export const ERRORS = {
  // Parameter validation
  INVALID_PARAMS: (min, max) => `randInt: invalid parameters (${min}, ${max})`,
  EMPTY_ARRAY: 'pick: empty or invalid array',
  NOT_ARRAY: 'shuffle: parameter must be an array',
  PARAMS_NOT_ARRAYS: 'insertWithPlacement: parameters must be arrays',

  // Generator errors
  UNKNOWN_MODE: (mode) => `Unknown mode: ${mode}`
};

export const STRENGTH = {
  WEAK: 'Weak',
  MEDIUM: 'Medium',
  STRONG: 'Strong',
  VERY_STRONG: 'Very Strong',
  EXCELLENT: 'Excellent'
};
