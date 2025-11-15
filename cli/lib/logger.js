/*
 * GenPwd Pro CLI - Logger
 * Copyright 2025 Julien Bombled
 */

export function safeLog(message, data = null) {
  if (data !== null) {
    console.log(message, data);
  } else {
    console.log(message);
  }
}

export function safeError(message, error = null) {
  if (error !== null) {
    console.error(message, error);
  } else {
    console.error(message);
  }
}
