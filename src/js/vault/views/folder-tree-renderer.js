/**
 * @fileoverview Folder Tree Renderer
 * Pure rendering functions for vault folder tree
 */

import { escapeHtml } from '../utils/formatter.js';
import { getFolderColor } from '../components/color-picker.js';
import { t } from '../../utils/i18n.js';

/**
 * Build a hierarchical tree from flat folder list
 * @param {Object} options - Build options
 * @param {Array} options.folders - Flat folder list
 * @param {Array} options.entries - All entries (for counting)
 * @returns {Array} Tree structure with children arrays
 */
export function buildFolderTree({ folders, entries }) {
  const childMap = new Map(); // parentId -> children[]

  // First pass: group by parentId
  for (const folder of folders) {
    const parentId = folder.parentId || null;
    if (!childMap.has(parentId)) {
      childMap.set(parentId, []);
    }
    childMap.get(parentId).push(folder);
  }

  // Build tree recursively
  const buildNode = (folder, depth = 0) => {
    const children = childMap.get(folder.id) || [];
    const entryCount = entries.filter(e => e.folderId === folder.id).length;
    const descendantCount = getDescendantEntryCount(folder.id, childMap, entries);

    return {
      ...folder,
      depth,
      entryCount,
      totalCount: entryCount + descendantCount,
      children: children.map(child => buildNode(child, depth + 1)),
      hasChildren: children.length > 0
    };
  };

  // Start with root folders (no parent)
  const roots = childMap.get(null) || [];
  return roots.map(folder => buildNode(folder, 0));
}

/**
 * Get total entry count for all descendants of a folder
 * @param {string} folderId - Folder ID
 * @param {Map} childMap - Map of parentId -> children
 * @param {Array} entries - All entries
 * @returns {number} Total count
 */
export function getDescendantEntryCount(folderId, childMap, entries) {
  let count = 0;
  const children = childMap.get(folderId) || [];
  for (const child of children) {
    count += entries.filter(e => e.folderId === child.id).length;
    count += getDescendantEntryCount(child.id, childMap, entries);
  }
  return count;
}

/**
 * Render the folder tree as HTML
 * @param {Object} options - Render options
 * @param {Array} options.folders - Flat folder list
 * @param {Array} options.entries - All entries
 * @param {Set} options.expandedFolders - Set of expanded folder IDs
 * @param {string|null} options.selectedFolder - Currently selected folder ID
 * @returns {string} HTML string
 */
export function renderFolderTree({ folders, entries, expandedFolders, selectedFolder }) {
  if (folders.length === 0) {
    return `<div class="vault-nav-empty">${t('vault.sidebar.noFolders')}</div>`;
  }

  const tree = buildFolderTree({ folders, entries });
  return renderFolderNodes({ nodes: tree, expandedFolders, selectedFolder });
}

/**
 * Render folder nodes recursively
 * @param {Object} options - Render options
 * @param {Array} options.nodes - Tree nodes to render
 * @param {Set} options.expandedFolders - Set of expanded folder IDs
 * @param {string|null} options.selectedFolder - Currently selected folder ID
 * @returns {string} HTML string
 */
export function renderFolderNodes({ nodes, expandedFolders, selectedFolder }) {
  return nodes.map(node => {
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedFolder === node.id;
    const folderColor = getFolderColor(node.id);
    const paddingLeft = node.depth * 16;

    const expandIcon = node.hasChildren ? `
      <button class="vault-folder-toggle ${isExpanded ? 'expanded' : ''}"
              data-folder-toggle="${node.id}"
              aria-expanded="${isExpanded}"
              aria-label="${isExpanded ? t('common.collapse') : t('common.expand')} ${node.name}">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    ` : '<span class="vault-folder-toggle-spacer"></span>';

    const folderIcon = isExpanded && node.hasChildren ? '📂' : '📁';

    let html = `
      <div class="vault-folder-node" role="treeitem" aria-selected="${isSelected}" data-folder-depth="${node.depth}">
        <button class="vault-nav-item vault-folder-item vault-nav-folder ${isSelected ? 'active' : ''}"
                data-folder="${node.id}"
                data-padding="${8 + paddingLeft}"
                aria-current="${isSelected ? 'true' : 'false'}"
                draggable="true">
          ${expandIcon}
          <span class="vault-nav-icon vault-folder-color" ${folderColor ? `data-folder-color="${folderColor}"` : ''} aria-hidden="true">${folderIcon}</span>
          <span class="vault-nav-label">${escapeHtml(node.name)}</span>
          <span class="vault-nav-count" title="${node.entryCount} in this folder, ${node.totalCount} total">${node.totalCount}</span>
        </button>
    `;

    // Render children if expanded
    if (node.hasChildren && isExpanded) {
      html += `<div class="vault-folder-children" role="group">${renderFolderNodes({ nodes: node.children, expandedFolders, selectedFolder })}</div>`;
    }

    html += '</div>';
    return html;
  }).join('');
}
