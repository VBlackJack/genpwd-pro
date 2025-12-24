/**
 * @fileoverview Duress Manager
 * Handles Plausible Deniability logic:
 * 1. Chaffing (Noise Generation)
 * 2. Fake Data Generation (Decoy Population)
 */

import crypto from 'crypto';
import { createEntry } from '../models/vault-types.js';

export class DuressManager {

    /**
     * Generate random noise indistinguishable from AES encrypted data
     * @param {number} sizeBytes - Size of chaff to generate
     * @returns {Buffer} Random buffer
     */
    static generateChaff(sizeBytes) {
        if (sizeBytes <= 0) return Buffer.alloc(0);
        // Use system PRNG which is CSPRNG
        // This is indistinguishable from AES-GCM output (random-looking)
        return crypto.randomBytes(sizeBytes);
    }

    /**
     * Generate a realistic decoy vault content
     * @returns {Object} VaultData structure populated with fake entries
     */
    static generateDecoyVault() {
        const fakeLogins = [
            { t: 'Google', u: 'john.doe@gmail.com', url: 'https://accounts.google.com' },
            { t: 'Amazon', u: 'john.doe@gmail.com', url: 'https://amazon.com' },
            { t: 'Facebook', u: 'john.d', url: 'https://facebook.com' },
            { t: 'Netflix', u: 'john.doe@gmail.com', url: 'https://netflix.com' },
            { t: 'Twitter', u: '@johndoe', url: 'https://twitter.com' },
            { t: 'LinkedIn', u: 'john.doe@gmail.com', url: 'https://linkedin.com' },
            { t: 'Bank of America', u: 'johndoe88', url: 'https://bankofamerica.com' },
            { t: 'PayPal', u: 'john.doe@gmail.com', url: 'https://paypal.com' },
            { t: 'Dropbox', u: 'john.doe@gmail.com', url: 'https://dropbox.com' },
            { t: 'Spotify', u: 'john.doe@gmail.com', url: 'https://spotify.com' }
        ];

        // Select random subset to vary the decoy size (using CSPRNG)
        const countRandom = crypto.randomBytes(1)[0];
        const count = 5 + (countRandom % 6); // 5 to 10 entries

        // Fisher-Yates shuffle with CSPRNG
        const shuffled = [...fakeLogins];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = crypto.randomBytes(1)[0] % (i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const selected = shuffled.slice(0, count);

        const entries = selected.map(site => {
            const entry = createEntry('login', site.t, {
                username: site.u,
                password: this.#generateFakePassword(),
                url: site.url
            });
            return entry;
        });

        return {
            metadata: {
                id: crypto.randomUUID(),
                name: 'My Vault',
                description: '',
                version: '1.0.0',
                createdAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString(),
                entryCount: entries.length,
                settings: { autoLockMinutes: 5 }
            },
            folders: [],
            entries: entries,
            tags: []
        };
    }

    static #generateFakePassword() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        // Use CSPRNG for password length and character selection
        const lenRandom = crypto.randomBytes(1)[0];
        const len = 12 + (lenRandom % 9); // 12-20 chars
        const randomBytes = crypto.randomBytes(len);
        let pass = '';
        for (let i = 0; i < len; i++) {
            pass += chars.charAt(randomBytes[i] % chars.length);
        }
        return pass;
    }
}
