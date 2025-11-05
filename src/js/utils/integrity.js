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

// src/js/utils/integrity.js - Validation d'intégrité des ressources

/**
 * Computes SHA-256 hash of data using Web Crypto API
 * @param {string|ArrayBuffer} data - Data to hash
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 * @example
 * const hash = await computeSHA256('hello world');
 * // → '185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969'
 */
export async function computeSHA256(data) {
  // Convert string to Uint8Array if needed
  const buffer = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data;

  // Compute hash using Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

  // Convert ArrayBuffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Verifies the integrity of data against an expected SHA-256 hash
 * @param {string|ArrayBuffer} data - Data to verify
 * @param {string} expectedHash - Expected SHA-256 hash (hex-encoded)
 * @returns {Promise<boolean>} true if hash matches, false otherwise
 * @example
 * const isValid = await verifyIntegrity('hello world', '185f8db32271fe...');
 * // → true if hash matches
 */
export async function verifyIntegrity(data, expectedHash) {
  if (!expectedHash || typeof expectedHash !== 'string') {
    throw new Error('Expected hash must be a non-empty string');
  }

  const computedHash = await computeSHA256(data);
  const normalizedExpected = expectedHash.toLowerCase().trim();
  const normalizedComputed = computedHash.toLowerCase().trim();

  return normalizedComputed === normalizedExpected;
}

/**
 * Known SHA-256 hashes for dictionary files
 * These hashes should be updated whenever dictionary files are modified
 *
 * To generate a hash:
 * ```bash
 * sha256sum dictionaries/french.json
 * ```
 */
export const DICTIONARY_HASHES = {
  french: '22ba9cc4fc0223e889ad5f63903db0c35e53bb4994aa09cd498c9a3e61e05d36',
  english: 'ab8e2ddd99be10f221554bde6ec4775544e66597f8ddca08e03ff808b0946df8',
  latin: '21b300bc7ddaa9a4e8becd73796da1a57500f6ce1c3ba1c0b8bd1e0e09aba7b0'
};

/**
 * Validates a loaded dictionary against known hash
 * @param {string} dictionaryName - Name of dictionary (french, english, latin)
 * @param {string} content - Dictionary content (JSON string)
 * @returns {Promise<Object>} Validation result { valid: boolean, message: string }
 * @example
 * const result = await validateDictionary('french', jsonContent);
 * if (!result.valid) {
 *   console.warn('Dictionary integrity check failed:', result.message);
 * }
 */
export async function validateDictionary(dictionaryName, content) {
  const expectedHash = DICTIONARY_HASHES[dictionaryName];

  // If no hash is configured, skip validation but warn
  if (!expectedHash) {
    return {
      valid: true,
      message: `No integrity hash configured for ${dictionaryName} dictionary`,
      skipped: true
    };
  }

  try {
    const isValid = await verifyIntegrity(content, expectedHash);

    if (!isValid) {
      return {
        valid: false,
        message: `Integrity check FAILED for ${dictionaryName} dictionary - possible tampering detected`,
        computed: await computeSHA256(content),
        expected: expectedHash
      };
    }

    return {
      valid: true,
      message: `Integrity check PASSED for ${dictionaryName} dictionary`
    };

  } catch (error) {
    return {
      valid: false,
      message: `Error during integrity check: ${error.message}`,
      error: error
    };
  }
}

/**
 * Generates SHA-256 hash for a dictionary file (development/maintenance utility)
 * @param {string} dictionaryName - Name of dictionary
 * @param {string} content - Dictionary content (JSON string)
 * @returns {Promise<string>} SHA-256 hash for configuration
 * @example
 * const hash = await generateDictionaryHash('french', jsonContent);
 * console.log(`french: '${hash}',`);
 */
export async function generateDictionaryHash(dictionaryName, content) {
  const hash = await computeSHA256(content);
  console.log(`Generated hash for ${dictionaryName}:`, hash);
  console.log(`Add to DICTIONARY_HASHES: ${dictionaryName}: '${hash}',`);
  return hash;
}
