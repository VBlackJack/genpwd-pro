import fs from 'node:fs';
import { EventEmitter } from 'node:events';

/**
 * Cloud Sync Manager
 * Handles automatic synchronization of vault files to WebDAV.
 * Runs in Main Process.
 */
export class CloudSyncManager extends EventEmitter {
    constructor() {
        super();
        this.config = null;
    }

    /**
     * Configure sync credentials
     * @param {Object} config 
     */
    setConfig(config) {
        this.config = config;
    }

    /**
     * Upload vault file to WebDAV
     * @param {string} localPath 
     * @param {string} vaultId 
     * @returns {Promise<boolean>}
     */
    async uploadVault(localPath, vaultId) {
        if (!this.config || this.config.provider !== 'webdav') return false;

        this.emit('status', { vaultId, status: 'syncing', message: 'Envoi vers le cloud...' });

        try {
            const stats = await fs.promises.stat(localPath);
            const content = await fs.promises.readFile(localPath);
            const remoteFilename = `${vaultId}.gpd`;

            console.log(`[CloudSync] Uploading ${remoteFilename} to WebDAV...`);

            const success = await this.#webdavPut(remoteFilename, content);
            if (success) {
                console.log(`[CloudSync] Upload successful. Size: ${stats.size}`);
                this.emit('status', { vaultId, status: 'synced', message: 'Synced', timestamp: new Date() });
                return true;
            }
        } catch (error) {
            console.error('[CloudSync] Upload failed:', error.message);
            this.emit('status', { vaultId, status: 'error', message: 'Sync error' });
        }

        // If we reached here without returning true, it failed
        this.emit('status', { vaultId, status: 'error', message: 'Upload error' });
        return false;
    }

    /**
     * Upload generic file to WebDAV
     * @param {string} filename 
     * @param {string|Buffer} content 
     * @returns {Promise<boolean>}
     */
    async uploadFile(filename, content) {
        if (!this.config || this.config.provider !== 'webdav') return false;

        console.log(`[CloudSync] Uploading file ${filename}...`);
        return this.#webdavPut(filename, content);
    }

    /**
     * Check for updates and download if newer
     * @param {string} localPath 
     * @param {string} vaultId 
     * @returns {Promise<{updated: boolean, data?: Uint8Array}>}
     */
    async downloadIfNewer(localPath, vaultId) {
        if (!this.config || this.config.provider !== 'webdav') return { updated: false };

        try {
            const localStats = await fs.promises.stat(localPath).catch(() => null);
            const remoteFilename = `${vaultId}.gpd`;

            // 1. Get Remote Info (HEAD or PROPFIND)
            const remoteInfo = await this.#webdavStat(remoteFilename);
            if (!remoteInfo) return { updated: false };

            // 2. Compare
            let shouldDownload = false;
            if (!localStats) {
                shouldDownload = true;
            } else if (remoteInfo.lastModified > localStats.mtime) {
                console.log(`[CloudSync] Remote file is newer (${remoteInfo.lastModified} > ${localStats.mtime})`);
                shouldDownload = true;
            }

            if (shouldDownload) {
                // 3. Download
                console.log(`[CloudSync] Downloading ${remoteFilename}...`);
                const content = await this.#webdavGet(remoteFilename);
                if (content) {
                    // Start atomic write
                    const tempPath = `${localPath}.sync.tmp`;
                    await fs.promises.writeFile(tempPath, content);
                    // If we are here, download is valid (at least IO worked).
                    // Caller should verify integrity before swapping.
                    return { updated: true, tempPath, timestamp: remoteInfo.lastModified };
                }
            }
        } catch (error) {
            console.error('[CloudSync] Download check failed:', error);
        }
        return { updated: false };
    }

    // ==================== WebDAV Helpers ====================

    /**
     * Perform PUT request
     * @private
     */
    async #webdavPut(filename, data) {
        const { url, username, password } = this.config;
        const targetUrl = this.#joinUrl(url, filename);
        const headers = this.#getAuthHeaders(username, password);

        try {
            const response = await fetch(targetUrl, {
                method: 'PUT',
                headers: headers,
                body: data
            });
            return response.ok;
        } catch (error) {
            console.error('[WebDAV] PUT Error:', error);
            return false;
        }
    }

    async #webdavGet(filename) {
        const { url, username, password } = this.config;
        const targetUrl = this.#joinUrl(url, filename);
        const headers = this.#getAuthHeaders(username, password);

        try {
            const response = await fetch(targetUrl, {
                method: 'GET',
                headers: headers
            });
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                return new Uint8Array(buffer);
            }
        } catch (error) {
            console.error('[WebDAV] GET Error:', error);
        }
        return null;
    }

    async #webdavStat(filename) {
        const { url, username, password } = this.config;
        const targetUrl = this.#joinUrl(url, filename);
        const headers = this.#getAuthHeaders(username, password);

        // Use HEAD to get Last-Modified
        try {
            const response = await fetch(targetUrl, {
                method: 'HEAD',
                headers: headers
            });

            if (response.ok) {
                const lastMod = response.headers.get('last-modified');
                if (lastMod) {
                    return { lastModified: new Date(lastMod) };
                }
            }
        } catch (error) {
            // Ignore 404
        }
        return null;
    }

    #getAuthHeaders(username, password) {
        const headers = {};
        if (username && password) {
            const auth = Buffer.from(`${username}:${password}`).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
        }
        return headers;
    }

    #joinUrl(base, file) {
        if (!base.endsWith('/')) base += '/';
        return base + file;
    }
}
