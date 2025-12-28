/**
 * @fileoverview Result Pattern Implementation
 * Provides a functional approach to error handling without exceptions.
 *
 * @example
 * // Creating results
 * const success = Result.ok(42);
 * const failure = Result.err('Something went wrong');
 *
 * // Using results
 * if (success.isOk()) {
 *   console.log(success.value); // 42
 * }
 *
 * // Chaining operations
 * const doubled = success.map(x => x * 2); // Result.ok(84)
 *
 * // Safe unwrapping
 * const value = failure.unwrapOr(0); // 0
 */

/**
 * Result class representing either success (Ok) or failure (Err)
 * @template T - The success value type
 * @template E - The error type (defaults to Error)
 */
export class Result {
  #ok;
  #value;
  #error;

  /**
   * Private constructor - use Result.ok() or Result.err() instead
   * @param {boolean} ok - Whether this is a success result
   * @param {T} value - The success value (if ok)
   * @param {E} error - The error value (if not ok)
   */
  constructor(ok, value, error) {
    this.#ok = ok;
    this.#value = value;
    this.#error = error;
    Object.freeze(this);
  }

  /**
   * Creates a successful result
   * @template T
   * @param {T} value - The success value
   * @returns {Result<T, never>}
   */
  static ok(value) {
    return new Result(true, value, null);
  }

  /**
   * Creates a failure result
   * @template E
   * @param {E} error - The error value
   * @returns {Result<never, E>}
   */
  static err(error) {
    return new Result(false, null, error);
  }

  /**
   * Creates a Result from a potentially throwing function
   * @template T
   * @param {() => T} fn - Function that might throw
   * @returns {Result<T, Error>}
   */
  static fromTry(fn) {
    try {
      return Result.ok(fn());
    } catch (e) {
      return Result.err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Creates a Result from an async potentially throwing function
   * @template T
   * @param {() => Promise<T>} fn - Async function that might throw
   * @returns {Promise<Result<T, Error>>}
   */
  static async fromTryAsync(fn) {
    try {
      const value = await fn();
      return Result.ok(value);
    } catch (e) {
      return Result.err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Creates a Result from a value that might be null/undefined
   * @template T
   * @param {T|null|undefined} value - The value to check
   * @param {string} errorMsg - Error message if value is null/undefined
   * @returns {Result<T, Error>}
   */
  static fromNullable(value, errorMsg = 'Value is null or undefined') {
    if (value === null || value === undefined) {
      return Result.err(new Error(errorMsg));
    }
    return Result.ok(value);
  }

  /**
   * Checks if this is a success result
   * @returns {boolean}
   */
  isOk() {
    return this.#ok;
  }

  /**
   * Checks if this is a failure result
   * @returns {boolean}
   */
  isErr() {
    return !this.#ok;
  }

  /**
   * Gets the success value (read-only)
   * @returns {T|null}
   */
  get value() {
    return this.#value;
  }

  /**
   * Gets the error value (read-only)
   * @returns {E|null}
   */
  get error() {
    return this.#error;
  }

  /**
   * Unwraps the success value, throws if this is an error
   * @returns {T}
   * @throws {Error} If this is an error result
   */
  unwrap() {
    if (this.#ok) {
      return this.#value;
    }
    throw this.#error instanceof Error ? this.#error : new Error(String(this.#error));
  }

  /**
   * Unwraps the success value or returns a default
   * @template D
   * @param {D} defaultValue - Value to return if this is an error
   * @returns {T|D}
   */
  unwrapOr(defaultValue) {
    return this.#ok ? this.#value : defaultValue;
  }

  /**
   * Unwraps the success value or computes a default from the error
   * @template D
   * @param {(error: E) => D} fn - Function to compute default from error
   * @returns {T|D}
   */
  unwrapOrElse(fn) {
    return this.#ok ? this.#value : fn(this.#error);
  }

  /**
   * Unwraps the error value, throws if this is a success
   * @returns {E}
   * @throws {Error} If this is a success result
   */
  unwrapErr() {
    if (!this.#ok) {
      return this.#error;
    }
    throw new Error('Called unwrapErr on an Ok value');
  }

  /**
   * Transforms the success value
   * @template U
   * @param {(value: T) => U} fn - Transformation function
   * @returns {Result<U, E>}
   */
  map(fn) {
    if (this.#ok) {
      return Result.ok(fn(this.#value));
    }
    return this;
  }

  /**
   * Transforms the error value
   * @template F
   * @param {(error: E) => F} fn - Transformation function
   * @returns {Result<T, F>}
   */
  mapErr(fn) {
    if (!this.#ok) {
      return Result.err(fn(this.#error));
    }
    return this;
  }

  /**
   * Chains another Result-returning operation
   * @template U
   * @param {(value: T) => Result<U, E>} fn - Function returning a Result
   * @returns {Result<U, E>}
   */
  andThen(fn) {
    if (this.#ok) {
      return fn(this.#value);
    }
    return this;
  }

  /**
   * Recovers from an error with another Result
   * @param {(error: E) => Result<T, E>} fn - Recovery function
   * @returns {Result<T, E>}
   */
  orElse(fn) {
    if (!this.#ok) {
      return fn(this.#error);
    }
    return this;
  }

  /**
   * Executes a side effect if this is a success
   * @param {(value: T) => void} fn - Side effect function
   * @returns {Result<T, E>} Returns this for chaining
   */
  tap(fn) {
    if (this.#ok) {
      fn(this.#value);
    }
    return this;
  }

  /**
   * Executes a side effect if this is an error
   * @param {(error: E) => void} fn - Side effect function
   * @returns {Result<T, E>} Returns this for chaining
   */
  tapErr(fn) {
    if (!this.#ok) {
      fn(this.#error);
    }
    return this;
  }

  /**
   * Pattern matches on the result
   * @template U
   * @param {{ok: (value: T) => U, err: (error: E) => U}} handlers - Match handlers
   * @returns {U}
   */
  match(handlers) {
    if (this.#ok) {
      return handlers.ok(this.#value);
    }
    return handlers.err(this.#error);
  }

  /**
   * Converts to a plain object for serialization
   * @returns {{ok: boolean, value?: T, error?: E}}
   */
  toJSON() {
    if (this.#ok) {
      return { ok: true, value: this.#value };
    }
    return {
      ok: false,
      error: this.#error instanceof Error ? this.#error.message : this.#error
    };
  }

  /**
   * Creates a Result from a plain object
   * @template T, E
   * @param {{ok: boolean, value?: T, error?: E}} obj - Plain object
   * @returns {Result<T, E>}
   */
  static fromJSON(obj) {
    if (obj.ok) {
      return Result.ok(obj.value);
    }
    return Result.err(obj.error);
  }
}

/**
 * Combines multiple Results into a single Result
 * Returns Ok with array of values if all are Ok, or first Err
 * @template T, E
 * @param {Result<T, E>[]} results - Array of Results
 * @returns {Result<T[], E>}
 */
export function combineResults(results) {
  const values = [];
  for (const result of results) {
    if (result.isErr()) {
      return result;
    }
    values.push(result.value);
  }
  return Result.ok(values);
}

/**
 * Collects all Results, returning all errors if any failed
 * @template T, E
 * @param {Result<T, E>[]} results - Array of Results
 * @returns {Result<T[], E[]>}
 */
export function collectResults(results) {
  const values = [];
  const errors = [];

  for (const result of results) {
    if (result.isOk()) {
      values.push(result.value);
    } else {
      errors.push(result.error);
    }
  }

  if (errors.length > 0) {
    return Result.err(errors);
  }
  return Result.ok(values);
}

// Convenience aliases
export const Ok = Result.ok;
export const Err = Result.err;
