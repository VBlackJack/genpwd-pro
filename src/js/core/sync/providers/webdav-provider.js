/*
 * Copyright 2025 Julien Bombled
 * Licensed under the Apache License, Version 2.0
 */

import { CloudProvider } from '../cloud-provider.js';
import { CloudResult, CloudErrorType, VaultSyncMetadata, VaultSyncData } from '../models.js';
import { safeLog } from '../../../utils/logger.js';

/**
 * WebDAV Cloud Provider
 * Enables syncing with self-hosted instances (Nextcloud, Synology, etc.)
 */
export class WebDAVProvider extends CloudProvider {
    constructor() {
        super('webdav', 'WebDAV (Private Cloud)');
        this.serverUrl = null;
        this.username = null;
        this.password = null; // Stored in Electron SafeStorage in production
    }

    /**
     * Configure the provider with user credentials
     * @param {Object} config - { url, username, password }
     */
    async configure(config) {
        if (!config.url || !config.username || !config.password) {
            throw new Error('WebDAV configuration requires URL, username, and password');
        }
        // Ensure URL ends with slash
        this.serverUrl = config.url.endsWith('/') ? config.url : `${config.url}/`;
        this.username = config.username;
        this.password = config.password;

        // Verify connection
        await this.listVaults();
    }

    getAuthHeader() {
        const token = btoa(`${this.username}:${this.password}`);
        return { 'Authorization': `Basic ${token}` };
    }

    async isAuthenticated() {
        return !!(this.serverUrl && this.username && this.password);
    }

    async login() {
        // WebDAV uses Basic Auth, "login" is just configuration
        return true;
    }

    async logout() {
        this.serverUrl = null;
        this.username = null;
        this.password = null;
    }

    async uploadVault(vaultData, _options = {}) {
        if (!this.isAuthenticated()) throw new Error('Not configured');

        const vaultId = vaultData.id || crypto.randomUUID();
        const filename = `${vaultId}.genpwd`;
        const targetUrl = `${this.serverUrl}${filename}`;

        try {
            const content = JSON.stringify(vaultData);

            const response = await fetch(targetUrl, {
                method: 'PUT',
                headers: {
                    ...this.getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: content
            });

            if (!response.ok) {
                throw new Error(`WebDAV Upload failed: ${response.statusText}`);
            }

            return new CloudResult(true, {
                fileId: filename,
                revision: response.headers.get('etag') || Date.now().toString(),
                modifiedTime: new Date().toISOString()
            });

        } catch (error) {
            safeLog.error('WebDAV upload error', error);
            return new CloudResult(false, null, {
                type: CloudErrorType.NETWORK_ERROR,
                message: error.message
            });
        }
    }

    async downloadVault(fileId) {
        if (!this.isAuthenticated()) throw new Error('Not configured');

        const targetUrl = `${this.serverUrl}${fileId}`;

        try {
            const response = await fetch(targetUrl, {
                method: 'GET',
                headers: this.getAuthHeader()
            });

            if (!response.ok) {
                if (response.status === 404) {
                    return new CloudResult(false, null, { type: CloudErrorType.FILE_NOT_FOUND });
                }
                throw new Error(`WebDAV Download failed: ${response.statusText}`);
            }

            const data = await response.json();
            const metadata = new VaultSyncMetadata();
            metadata.fileId = fileId;
            metadata.revision = response.headers.get('etag') || '1';
            metadata.modifiedTime = new Date().toISOString();

            const syncData = new VaultSyncData(data, metadata);
            return new CloudResult(true, syncData);

        } catch (error) {
            safeLog.error('WebDAV download error', error);
            return new CloudResult(false, null, {
                type: CloudErrorType.NETWORK_ERROR,
                message: error.message
            });
        }
    }

    async listVaults() {
        if (!this.isAuthenticated()) throw new Error('Not configured');

        try {
            // PROPFIND to list files (Depth: 1 for immediate children)
            const response = await fetch(this.serverUrl, {
                method: 'PROPFIND',
                headers: {
                    ...this.getAuthHeader(),
                    'Depth': '1',
                    'Content-Type': 'application/xml'
                }
            });

            if (!response.ok) {
                throw new Error(`WebDAV List failed: ${response.statusText}`);
            }

            // Simple XML parsing (could assume filenames match *.genpwd)
            // For MVP, we'll try to use a convention or simple regex on text text
            const text = await response.text();
            const matches = [...text.matchAll(/<d:href>(.*?)<\/d:href>/g)];

            const files = matches
                .map(m => m[1])
                .filter(path => path.endsWith('.genpwd'))
                .map(path => {
                    const name = path.split('/').pop();
                    return {
                        id: name,
                        name: name,
                        modifiedTime: new Date().toISOString() // XML parsing for date is complex without a library
                    };
                });

            return new CloudResult(true, files);

        } catch (error) {
            safeLog.error('WebDAV list error', error);
            return new CloudResult(false, [], {
                type: CloudErrorType.NETWORK_ERROR,
                message: error.message
            });
        }
    }

    async deleteVault(fileId) {
        if (!this.isAuthenticated()) throw new Error('Not configured');

        try {
            const response = await fetch(`${this.serverUrl}${fileId}`, {
                method: 'DELETE',
                headers: this.getAuthHeader()
            });

            if (!response.ok && response.status !== 404) {
                throw new Error(`WebDAV Delete failed: ${response.statusText}`);
            }
            return new CloudResult(true);
        } catch (error) {
            return new CloudResult(false, null, { type: CloudErrorType.NETWORK_ERROR });
        }
    }
}
