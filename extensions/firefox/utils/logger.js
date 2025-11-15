/*
 * Copyright 2025 Julien Bombled
 * Licensed under the Apache License, Version 2.0
 */

export function safeLog(message, data = null) {
  if (typeof console !== 'undefined' && console.log) {
    if (data !== null) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
}

export function safeError(message, error = null) {
  if (typeof console !== 'undefined' && console.error) {
    if (error !== null) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  }
}
