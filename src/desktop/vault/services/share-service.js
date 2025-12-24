/**
 * @fileoverview Share Service (GenPwd Send)
 * Handles encrypted ephemeral sharing Logic
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

export class ShareService {
    #sharesDir;

    #fileManager;

    constructor(fileManager) {
        this.#fileManager = fileManager;
        this.#sharesDir = path.join(app.getPath('userData'), 'shares');
        this.#ensureDir();
    }

    async #ensureDir() {
        try {
            await fs.mkdir(this.#sharesDir, { recursive: true });
        } catch (err) {
            console.error('Failed to create shares dir:', err);
        }
    }

    /**
     * Create a secure share
     * @param {string} secretData - The data to share (e.g. password)
     * @param {Object} options - Options (expiry, views)
     * @returns {Promise<{id: string, key: string, url: string}>}
     */
    async createShare(secretData, options = {}) {
        const id = crypto.randomUUID();

        // 1. Generate ephemeral key (32 bytes = 256 bits)
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(12);

        // 2. Encrypt
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(secretData, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');

        // 3. Create payload
        const payload = {
            id,
            meta: {
                createdAt: new Date().toISOString(),
                expiresAt: this.#calculateExpiry(options.expiryType),
                burnAfterReading: options.burnAfterReading || false,
                viewCount: 0
            },
            data: {
                iv: iv.toString('hex'),
                content: encrypted,
                tag: authTag
            }
        };

        // 4. Save to disk (Local backup)
        const filePath = path.join(this.#sharesDir, `${id}.json`);
        await fs.writeFile(filePath, JSON.stringify(payload, null, 2));

        // 4b. Upload to Cloud (if enabled)
        let cloudUrl = null;
        if (this.#fileManager) {
            const cloud = this.#fileManager.getCloudManager();
            if (cloud && cloud.config && cloud.config.provider === 'webdav') {
                const filename = `share_${id}.json`;
                const uploaded = await cloud.uploadFile(filename, JSON.stringify(payload, null, 2));
                if (uploaded) {
                    console.log(`[ShareService] Uploaded ${filename} to WebDAV`);
                    // Construct WebDAV URL (Best guess)
                    // If url ends with /, we append filename
                    const baseUrl = cloud.config.url.endsWith('/') ? cloud.config.url : cloud.config.url + '/';
                    cloudUrl = baseUrl + filename;
                }
            }
        }

        // 5. Construct URL - get key before wiping
        const keyBase64 = key.toString('base64url');

        // 6. Wipe sensitive buffers from memory
        key.fill(0);
        iv.fill(0);

        const url = `https://share.genpwd.local/v1/download#id=${id}&key=${keyBase64}`;

        return { id, key: keyBase64, url };
    }

    /**
     * Get share status (without decryption)
     */
    async getShareStatus(id) {
        // Logic to check if file exists and return cleartext metadata
    }

    #calculateExpiry(type) {
        const now = new Date();
        switch (type) {
            case '1h': return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
            case '1d': return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
            case '7d': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
            default: return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // Default 1 day
        }
    }
}
