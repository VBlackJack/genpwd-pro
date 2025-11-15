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

// src/plugins/xml-export-plugin.js - Demo Plugin: XML Export Format

/**
 * XML Export Plugin
 *
 * This plugin demonstrates how to add custom export/import formats to GenPwd Pro.
 * It provides XML format for exporting and importing passwords.
 *
 * Export format:
 * <?xml version="1.0" encoding="UTF-8"?>
 * <passwords>
 *   <password>
 *     <value>SecurePass123</value>
 *     <metadata>
 *       <length>15</length>
 *       <entropy>65.4</entropy>
 *       <generated>2025-01-14T10:30:00Z</generated>
 *     </metadata>
 *   </password>
 * </passwords>
 *
 * Hooks used:
 * - onExport: Convert passwords to XML format
 * - onImport: Parse XML format to passwords
 */

import { sanitizeHTML } from '../js/utils/dom-sanitizer.js';

const XMLExportPlugin = {
  name: 'xml-export',
  version: '1.0.0',
  author: 'GenPwd Pro Team',
  description: 'Export and import passwords in XML format',

  config: {
    prettyPrint: true,
    includeMetadata: true,
    encoding: 'UTF-8',
    rootElement: 'passwords'
  },

  // Lifecycle hooks
  lifecycle: {
    onLoad() {
      console.log('[XML Export Plugin] Loaded successfully');
    },

    onUnload() {
      console.log('[XML Export Plugin] Unloaded');
    }
  },

  // Feature hooks
  hooks: {
    /**
     * Export passwords to XML format
     * @param {Array} passwords - Array of password objects
     * @param {Object} options - Export options
     * @returns {string} - XML string
     */
    onExport(passwords, options = {}) {
      const format = options.format || 'json';

      // Only handle XML format
      if (format !== 'xml') {
        return null;
      }

      try {
        const indent = XMLExportPlugin.config.prettyPrint ? '  ' : '';
        const nl = XMLExportPlugin.config.prettyPrint ? '\n' : '';

        let xml = `<?xml version="1.0" encoding="${XMLExportPlugin.config.encoding}"?>` + nl;
        xml += `<${XMLExportPlugin.config.rootElement}>` + nl;

        passwords.forEach((pwd, index) => {
          xml += `${indent}<password id="${index + 1}">` + nl;

          // Escape XML special characters
          const escapedPassword = XMLExportPlugin.escapeXML(pwd.password || pwd);
          xml += `${indent}${indent}<value><![CDATA[${escapedPassword}]]></value>` + nl;

          if (XMLExportPlugin.config.includeMetadata && pwd.metadata) {
            xml += `${indent}${indent}<metadata>` + nl;

            if (pwd.metadata.length) {
              xml += `${indent}${indent}${indent}<length>${pwd.metadata.length}</length>` + nl;
            }

            if (pwd.metadata.entropy) {
              xml += `${indent}${indent}${indent}<entropy>${pwd.metadata.entropy.toFixed(2)}</entropy>` + nl;
            }

            if (pwd.metadata.mode) {
              xml += `${indent}${indent}${indent}<mode>${pwd.metadata.mode}</mode>` + nl;
            }

            if (pwd.metadata.timestamp || pwd.timestamp) {
              const timestamp = pwd.metadata.timestamp || pwd.timestamp || new Date().toISOString();
              xml += `${indent}${indent}${indent}<generated>${timestamp}</generated>` + nl;
            }

            xml += `${indent}${indent}</metadata>` + nl;
          }

          xml += `${indent}</password>` + nl;
        });

        xml += `</${XMLExportPlugin.config.rootElement}>`;

        return xml;
      } catch (error) {
        console.error('[XML Export Plugin] Export error:', error);
        return null;
      }
    },

    /**
     * Import passwords from XML format
     * @param {string} xmlString - XML string
     * @param {Object} options - Import options
     * @returns {Array|null} - Array of password objects or null
     */
    onImport(xmlString, options = {}) {
      const format = options.format || 'json';

      // Only handle XML format
      if (format !== 'xml') {
        return null;
      }

      try {
        // SECURITY: Validate XML size (limit to 5MB for plugin)
        const MAX_XML_SIZE = 5 * 1024 * 1024;
        if (xmlString.length > MAX_XML_SIZE) {
          console.error('[XML Export Plugin] XML file too large');
          return null;
        }

        // SECURITY: Check for dangerous XML patterns (XXE protection)
        const dangerousPatterns = [
          /<!ENTITY/i,
          /<!DOCTYPE[^>]*\[/i,
          /SYSTEM\s+["']/i,
          /PUBLIC\s+["']/i,
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(xmlString)) {
            console.error('[XML Export Plugin] XML contains forbidden patterns');
            return null;
          }
        }

        // SECURITY: Strip DOCTYPE declarations
        xmlString = xmlString.replace(/<!DOCTYPE[^>]*>/gi, '');

        // Parse XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

        // Check for parse errors
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
          console.error('[XML Export Plugin] Parse error:', parseError.textContent);
          return null;
        }

        // Extract passwords
        const passwordNodes = xmlDoc.querySelectorAll('password');
        const passwords = [];

        passwordNodes.forEach(node => {
          const valueNode = node.querySelector('value');
          if (!valueNode) return;

          const password = valueNode.textContent.trim();

          // Extract metadata
          const metadata = {};
          const metadataNode = node.querySelector('metadata');

          if (metadataNode) {
            const lengthNode = metadataNode.querySelector('length');
            const entropyNode = metadataNode.querySelector('entropy');
            const modeNode = metadataNode.querySelector('mode');
            const generatedNode = metadataNode.querySelector('generated');

            if (lengthNode) metadata.length = parseInt(lengthNode.textContent);
            if (entropyNode) metadata.entropy = parseFloat(entropyNode.textContent);
            if (modeNode) metadata.mode = modeNode.textContent;
            if (generatedNode) metadata.timestamp = generatedNode.textContent;
          }

          passwords.push({
            password: password,
            metadata: metadata,
            imported: true,
            importedAt: new Date().toISOString()
          });
        });

        return passwords;
      } catch (error) {
        console.error('[XML Export Plugin] Import error:', error);
        return null;
      }
    },

    /**
     * Custom UI rendering for XML export settings
     * @param {HTMLElement} container - Container element
     */
    onUIRender(container) {
      const settingsHTML = `
        <div class="plugin-settings xml-export-settings">
          <h4>📄 XML Export Settings</h4>
          <div class="setting-row">
            <label>
              <input type="checkbox" id="xml-pretty-print" ${XMLExportPlugin.config.prettyPrint ? 'checked' : ''}>
              Pretty Print (formatted output)
            </label>
          </div>
          <div class="setting-row">
            <label>
              <input type="checkbox" id="xml-include-metadata" ${XMLExportPlugin.config.includeMetadata ? 'checked' : ''}>
              Include Metadata
            </label>
          </div>
          <div class="setting-row">
            <label for="xml-root-element">Root Element:</label>
            <input type="text" id="xml-root-element" value="${XMLExportPlugin.config.rootElement}" maxlength="50">
          </div>
          <div class="setting-row">
            <button id="xml-test-export" class="btn-mini">Test Export</button>
          </div>
          <div class="setting-row">
            <pre id="xml-preview" style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 0.85em; max-height: 200px; overflow: auto;"></pre>
          </div>
        </div>
      `;

      container.innerHTML = sanitizeHTML(settingsHTML);

      // Bind settings
      const prettyPrintCheck = container.querySelector('#xml-pretty-print');
      const metadataCheck = container.querySelector('#xml-include-metadata');
      const rootElementInput = container.querySelector('#xml-root-element');
      const testBtn = container.querySelector('#xml-test-export');
      const preview = container.querySelector('#xml-preview');

      if (prettyPrintCheck) {
        prettyPrintCheck.addEventListener('change', (e) => {
          XMLExportPlugin.config.prettyPrint = e.target.checked;
        });
      }

      if (metadataCheck) {
        metadataCheck.addEventListener('change', (e) => {
          XMLExportPlugin.config.includeMetadata = e.target.checked;
        });
      }

      if (rootElementInput) {
        rootElementInput.addEventListener('change', (e) => {
          XMLExportPlugin.config.rootElement = e.target.value || 'passwords';
        });
      }

      if (testBtn && preview) {
        testBtn.addEventListener('click', () => {
          const testData = [
            {
              password: 'TestPassword123!',
              metadata: {
                length: 16,
                entropy: 72.3,
                mode: 'syllables',
                timestamp: new Date().toISOString()
              }
            },
            {
              password: 'AnotherSecure456@',
              metadata: {
                length: 18,
                entropy: 85.7,
                mode: 'passphrase',
                timestamp: new Date().toISOString()
              }
            }
          ];

          const xml = XMLExportPlugin.hooks.onExport(testData, { format: 'xml' });
          preview.textContent = xml || 'Export failed';
        });
      }
    }
  },

  /**
   * Utility: Escape XML special characters
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeXML(text) {
    if (typeof text !== 'string') return '';

    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
};

// Export for ES6 modules
export default XMLExportPlugin;

// Also make available for direct registration
if (typeof window !== 'undefined') {
  window.XMLExportPlugin = XMLExportPlugin;
}
