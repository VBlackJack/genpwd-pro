import { VaultRepository } from './interfaces.js';
import { VaultEntry, VaultGroup } from './models.js';

/**
 * Deep clone a VaultEntry with all its properties
 * @param {VaultEntry} entry
 * @returns {VaultEntry}
 */
function cloneEntry(entry) {
  return new VaultEntry({
    id: entry.id,
    title: entry.title,
    type: entry.type,
    username: entry.username,
    secret: Array.from(entry.secret || []),
    notes: entry.notes,
    uri: entry.uri,
    tags: Array.from(entry.tags || []),
    otpConfig: entry.otpConfig ? { ...entry.otpConfig } : null,
    groupId: entry.groupId ?? null,
    fields: entry.fields ? entry.fields.map(f => ({ ...f })) : [],
    metadata: entry.metadata ? { ...entry.metadata } : null,
    color: entry.color ?? null,
    icon: entry.icon ?? null
  });
}

/**
 * Deep clone a VaultGroup with all its properties
 * @param {VaultGroup} group
 * @returns {VaultGroup}
 */
function cloneGroup(group) {
  return new VaultGroup({
    id: group.id,
    name: group.name,
    parentId: group.parentId ?? null,
    icon: group.icon ?? null,
    color: group.color ?? null
  });
}

/**
 * Parse search query for operators
 * Supports: tag:value, type:value, folder:value, has:totp, -exclude
 * @param {string} query
 * @returns {{ text: string, operators: Map<string, string[]>, excludes: string[] }}
 */
function parseSearchQuery(query) {
  const operators = new Map();
  const excludes = [];


  // Match operators: key:value or key:"value with spaces"
  const operatorRegex = /(\w+):(?:"([^"]+)"|(\S+))/g;
  const excludeRegex = /-(\S+)/g;

  let match;
  let processedQuery = query;

  // Extract operators
  while ((match = operatorRegex.exec(query)) !== null) {
    const key = match[1].toLowerCase();
    const value = (match[2] || match[3]).toLowerCase();

    if (!operators.has(key)) {
      operators.set(key, []);
    }
    operators.get(key).push(value);

    // Remove from query
    processedQuery = processedQuery.replace(match[0], '');
  }

  // Extract excludes
  while ((match = excludeRegex.exec(processedQuery)) !== null) {
    excludes.push(match[1].toLowerCase());
    processedQuery = processedQuery.replace(match[0], '');
  }

  // Clean up remaining text
  const text = processedQuery.trim().toLowerCase();

  return { text, operators, excludes };
}

/**
 * Simple in-memory implementation of VaultRepository used for tests
 * and headless environments.
 */
export class InMemoryVaultRepository extends VaultRepository {
  constructor() {
    super();
    this.groups = new Map();
    this.entries = new Map();
  }

  async createGroup(group) {
    const record = cloneGroup(group);
    if (this.groups.has(record.id)) {
      throw new Error(`Group ${record.id} already exists`);
    }
    this.groups.set(record.id, record);
    return record.clone();
  }

  async updateGroup(group) {
    if (!this.groups.has(group.id)) {
      throw new Error(`Group ${group.id} not found`);
    }
    const record = cloneGroup(group);
    this.groups.set(record.id, record);
    return record.clone();
  }

  async deleteGroup(groupId) {
    for (const [entryId, entry] of this.entries.entries()) {
      if (entry.groupId === groupId) {
        const updated = cloneEntry({ ...entry, groupId: null });
        this.entries.set(entryId, updated);
      }
    }
    this.groups.delete(groupId);
  }

  async getGroupById(groupId) {
    const record = this.groups.get(groupId);
    return record ? record.clone() : null;
  }

  async listGroups() {
    return Array.from(this.groups.values()).map((group) => group.clone());
  }

  async createEntry(entry) {
    const record = cloneEntry(entry);
    if (this.entries.has(record.id)) {
      throw new Error(`Entry ${record.id} already exists`);
    }
    this.entries.set(record.id, record);
    return record.clone();
  }

  async updateEntry(entry) {
    if (!this.entries.has(entry.id)) {
      throw new Error(`Entry ${entry.id} not found`);
    }
    const record = cloneEntry(entry);
    this.entries.set(record.id, record);
    return record.clone();
  }

  async deleteEntry(entryId) {
    this.entries.delete(entryId);
  }

  async getEntryById(entryId) {
    const record = this.entries.get(entryId);
    return record ? record.clone() : null;
  }

  async listEntriesByGroup(groupId) {
    return Array.from(this.entries.values())
      .filter((entry) => entry.groupId === groupId)
      .map((entry) => entry.clone());
  }

  /**
   * Advanced search with operator support
   * Operators: tag:value, type:value, folder:value, has:totp, -exclude
   * @param {string} query - Search query with optional operators
   * @param {Object} options
   * @param {string[]} [options.tags] - Filter by tags (legacy)
   * @param {string} [options.groupId] - Filter by group/folder
   * @param {string} [options.type] - Filter by entry type
   * @returns {Promise<VaultEntry[]>}
   */
  async searchEntries(query = '', { tags = [], groupId = null, type = null } = {}) {
    const { text, operators, excludes } = parseSearchQuery(query);

    // Merge legacy tag filter with operator-based tags
    const requiredTags = new Set([
      ...(tags || []).map(t => t.toLowerCase()),
      ...(operators.get('tag') || [])
    ]);

    // Type filter (from options or operator)
    const typeFilters = new Set([
      ...(type ? [type.toLowerCase()] : []),
      ...(operators.get('type') || [])
    ]);

    // Folder filter (from options or operator)
    const folderFilters = new Set([
      ...(groupId ? [groupId.toLowerCase()] : []),
      ...(operators.get('folder') || []),
      ...(operators.get('group') || [])
    ]);

    // Has filters (e.g., has:totp, has:notes)
    const hasFilters = new Set(operators.get('has') || []);

    return Array.from(this.entries.values())
      .filter((entry) => {
        // ========== EXCLUSIONS ==========
        for (const exclude of excludes) {
          const haystacks = [entry.title, entry.username, entry.notes, entry.uri];
          if (haystacks.some(v => v && v.toLowerCase().includes(exclude))) {
            return false;
          }
        }

        // ========== TAG FILTER ==========
        if (requiredTags.size > 0) {
          const entryTagSet = new Set((entry.tags || []).map(t => t.toLowerCase()));
          for (const tag of requiredTags) {
            if (!entryTagSet.has(tag)) {
              return false;
            }
          }
        }

        // ========== TYPE FILTER ==========
        if (typeFilters.size > 0) {
          const entryType = (entry.type || 'login').toLowerCase();
          let typeMatch = false;
          for (const tf of typeFilters) {
            if (entryType.includes(tf) || tf.includes(entryType)) {
              typeMatch = true;
              break;
            }
          }
          if (!typeMatch) return false;
        }

        // ========== FOLDER FILTER ==========
        if (folderFilters.size > 0) {
          const entryGroup = (entry.groupId || '').toLowerCase();
          // Also check group name
          const group = this.groups.get(entry.groupId);
          const groupName = (group?.name || '').toLowerCase();

          let folderMatch = false;
          for (const ff of folderFilters) {
            if (entryGroup === ff || groupName.includes(ff)) {
              folderMatch = true;
              break;
            }
          }
          if (!folderMatch) return false;
        }

        // ========== HAS FILTERS ==========
        for (const has of hasFilters) {
          if (has === 'totp' || has === '2fa') {
            if (!entry.otpConfig) return false;
          } else if (has === 'notes') {
            if (!entry.notes || !entry.notes.trim()) return false;
          } else if (has === 'url' || has === 'uri') {
            if (!entry.uri || !entry.uri.trim()) return false;
          } else if (has === 'fields') {
            if (!entry.fields || entry.fields.length === 0) return false;
          } else if (has === 'expired') {
            if (!entry.metadata?.expiresAt || entry.metadata.expiresAt > Date.now()) return false;
          }
        }

        // ========== TEXT SEARCH ==========
        if (!text) return true;

        // Search in standard fields
        const haystacks = [
          entry.title,
          entry.username,
          entry.notes,
          entry.uri,
          ...(entry.tags || [])
        ];

        // Search in custom fields (non-secured only)
        if (entry.fields) {
          for (const field of entry.fields) {
            if (!field.isSecured) {
              haystacks.push(field.label, field.value);
            } else {
              // For secured fields, only search label
              haystacks.push(field.label);
            }
          }
        }

        return haystacks.some(value => value && value.toLowerCase().includes(text));
      })
      .map((entry) => entry.clone());
  }

  /**
   * Move a group to a new parent
   * @param {string} groupId - Group to move
   * @param {string|null} newParentId - New parent group ID (null for root)
   * @returns {Promise<VaultGroup>}
   */
  async moveGroup(groupId, newParentId) {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    // Prevent circular reference
    if (newParentId) {
      let parent = this.groups.get(newParentId);
      while (parent) {
        if (parent.id === groupId) {
          throw new Error('Cannot move group into its own descendant');
        }
        parent = parent.parentId ? this.groups.get(parent.parentId) : null;
      }
    }

    const updated = new VaultGroup({
      id: group.id,
      name: group.name,
      parentId: newParentId,
      icon: group.icon,
      color: group.color
    });

    this.groups.set(groupId, updated);
    return updated.clone();
  }

  /**
   * Get all descendant group IDs for a group
   * @param {string} groupId
   * @returns {Promise<string[]>}
   */
  async getDescendantGroupIds(groupId) {
    const descendants = [];
    const queue = [groupId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      for (const [id, group] of this.groups) {
        if (group.parentId === currentId) {
          descendants.push(id);
          queue.push(id);
        }
      }
    }

    return descendants;
  }

  /**
   * Get the full path of a group (e.g., "Work > Projects > Active")
   * @param {string} groupId
   * @returns {Promise<string>}
   */
  async getGroupPath(groupId) {
    const path = [];
    let current = this.groups.get(groupId);

    while (current) {
      path.unshift(current.name);
      current = current.parentId ? this.groups.get(current.parentId) : null;
    }

    return path.join(' > ');
  }

  /**
   * Get groups as a tree structure
   * @returns {Promise<Array>}
   */
  async getGroupTree() {
    const groups = Array.from(this.groups.values());

    function buildTree(parentId) {
      return groups
        .filter(g => g.parentId === parentId)
        .map(g => ({
          ...g.clone(),
          children: buildTree(g.id),
          entryCount: 0 // Will be filled by caller
        }));
    }

    return buildTree(null);
  }

  /**
   * Bulk import entries and groups
   * @param {VaultEntry[]} entries
   * @param {VaultGroup[]} groups
   * @returns {Promise<{ entriesImported: number, groupsImported: number }>}
   */
  async bulkImport(entries, groups) {
    let entriesImported = 0;
    let groupsImported = 0;

    // Import groups first (for groupId references)
    for (const group of groups) {
      try {
        const record = cloneGroup(group);
        if (!this.groups.has(record.id)) {
          this.groups.set(record.id, record);
          groupsImported++;
        }
      } catch (e) {
        console.warn(`[Repository] Failed to import group: ${e.message}`);
      }
    }

    // Import entries
    for (const entry of entries) {
      try {
        const record = cloneEntry(entry);
        if (!this.entries.has(record.id)) {
          this.entries.set(record.id, record);
          entriesImported++;
        }
      } catch (e) {
        console.warn(`[Repository] Failed to import entry: ${e.message}`);
      }
    }

    return { entriesImported, groupsImported };
  }
}
