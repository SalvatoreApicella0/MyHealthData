import type { SyncOutboxEntry } from './db'

export type SyncEntryState = 'pending' | 'error' | 'synced'

export interface HealthSyncStatus {
  available: boolean
  pendingCount: number
  failedCount: number
  documentStates: Readonly<Record<string, SyncEntryState>>
}

export const EMPTY_HEALTH_SYNC_STATUS: HealthSyncStatus = {
  available: false,
  pendingCount: 0,
  failedCount: 0,
  documentStates: {},
}

/**
 * Reduces outbox metadata to UI-safe state. Record payloads and error messages
 * never leave IndexedDB through this projection, so PHI cannot leak into a
 * banner or attachment row.
 */
export function summarizeHealthSync(entries: readonly SyncOutboxEntry[], available: boolean, confirmedDocumentIds: readonly string[] = []): HealthSyncStatus {
  const documentStates: Record<string, SyncEntryState> = {}
  let failedCount = 0

  for (const documentId of confirmedDocumentIds) documentStates[documentId] = 'synced'

  for (const entry of entries) {
    const state: SyncEntryState = entry.lastError ? 'error' : 'pending'
    if (entry.lastError) failedCount += 1
    if (entry.domain === 'documents') {
      const current = documentStates[entry.recordId]
      // An error is more actionable than an entry that is still pending.
      if (current !== 'error') documentStates[entry.recordId] = state
      if (state === 'error') documentStates[entry.recordId] = state
    }
  }

  return {
    available,
    pendingCount: entries.length,
    failedCount,
    documentStates,
  }
}

/** A Hub probe alone never creates a synced state. */
export function isDocumentSyncConfirmed(documentId: string, expected: Record<string, unknown>, acknowledged: unknown): boolean {
  if (!acknowledged || typeof acknowledged !== 'object' || (acknowledged as Record<string, unknown>).id !== documentId) return false
  const expectedAttachment = expected.attachment
  if (!expectedAttachment || typeof expectedAttachment !== 'object') return true
  const remoteAttachment = (acknowledged as Record<string, unknown>).attachment
  if (!remoteAttachment || typeof remoteAttachment !== 'object') return false
  const expectedMeta = expectedAttachment as Record<string, unknown>
  const remoteMeta = remoteAttachment as Record<string, unknown>
  const expectedDigest = expectedMeta.sha256
  const remoteDigest = remoteMeta.sha256
  const isSha256Hex = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value)
  return remoteMeta.id === expectedMeta.id
    && remoteMeta.size === expectedMeta.size
    && isSha256Hex(expectedDigest)
    && isSha256Hex(remoteDigest)
    && remoteDigest.toLowerCase() === expectedDigest.toLowerCase()
}

export function documentSyncState(
  status: HealthSyncStatus,
  documentId: string,
): SyncEntryState | 'synced' | 'local' {
  return status.documentStates[documentId] ?? 'local'
}
