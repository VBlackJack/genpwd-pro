import { VaultRepository } from './interfaces.js';
import { VaultEntry, VaultGroup } from './models.js';

function cloneEntry(entry) {
  return new VaultEntry({
    id: entry.id,
    title: entry.title,
    username: entry.username,
    secret: Array.from(entry.secret || []),
    notes: entry.notes,
    uri: entry.uri,
    tags: Array.from(entry.tags || []),
    otpConfig: entry.otpConfig ? { ...entry.otpConfig } : null,
    groupId: entry.groupId ?? null
  });
}

function cloneGroup(group) {
  return new VaultGroup({ id: group.id, name: group.name, parentId: group.parentId ?? null });
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

  async searchEntries(query = '', { tags = [] } = {}) {
    const normalized = query.trim().toLowerCase();
    const tagSet = new Set((tags || []).map((t) => t.toLowerCase()));

    return Array.from(this.entries.values())
      .filter((entry) => {
        // PERFORMANCE: Use Set for O(1) tag lookups instead of O(n) includes()
        // This changes complexity from O(n³) to O(n) for tag filtering
        if (tagSet.size > 0) {
          const entryTagSet = new Set(entry.tags.map((t) => t.toLowerCase()));
          // Check if all required tags exist in entry tags
          for (const tag of tagSet) {
            if (!entryTagSet.has(tag)) {
              return false;
            }
          }
        }
        if (!normalized) return true;
        const haystacks = [entry.title, entry.username, entry.notes, entry.uri, ...(entry.tags || [])];
        return haystacks.some((value) => value && value.toLowerCase().includes(normalized));
      })
      .map((entry) => entry.clone());
  }
}
