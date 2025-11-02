package com.genpwd.sync.conflict

import com.genpwd.corevault.PendingOp
import com.genpwd.corevault.Vault
import com.genpwd.corevault.VaultItem
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Resolves conflicts between local and remote vault states. The implementation follows a
 * Last-Writer-Wins policy at the item level while keeping conflicting copies when timestamps
 * are identical.
 */
@Singleton
class ConflictResolver @Inject constructor() {
    data class Resolution(
        val merged: Vault,
        val conflicts: List<Conflict>,
    )

    data class Conflict(
        val itemId: String,
        val local: VaultItem?,
        val remote: VaultItem?,
    )

    fun merge(local: Vault, remote: Vault, pendingOps: List<PendingOp>): Resolution {
        val conflicts = mutableListOf<Conflict>()
        val localItems = local.items.associateBy { it.itemId }.toMutableMap()
        val remoteItems = remote.items.associateBy { it.itemId }

        for ((id, remoteItem) in remoteItems) {
            val localItem = localItems[id]
            when {
                localItem == null -> localItems[id] = remoteItem
                remoteItem.updatedAtUtc > localItem.updatedAtUtc -> localItems[id] = remoteItem
                remoteItem.updatedAtUtc == localItem.updatedAtUtc && remoteItem.encryptedBlob != localItem.encryptedBlob -> {
                    val conflictId = "${id}_conflict"
                    conflicts.add(Conflict(id, localItem, remoteItem))
                    localItems[conflictId] = remoteItem.copy(itemId = conflictId)
                }
            }
        }

        // Apply local pending operations on top of the merged base.
        for (op in pendingOps) {
            when (op) {
                is PendingOp.Add -> localItems[op.item.itemId] = op.item
                is PendingOp.Update -> localItems[op.item.itemId] = op.item
                is PendingOp.Delete -> localItems.remove(op.itemId)
            }
        }

        val mergedVault = local.copy(items = localItems.values.sortedBy { it.itemId })
        return Resolution(merged = mergedVault, conflicts = conflicts)
    }
}
