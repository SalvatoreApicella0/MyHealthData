import type { HealthDataSnapshot } from '../core/types'

function snapshotPartsEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime()
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    let canUseSignatures = true
    for (let index = 0; index < left.length; index += 1) {
      const leftSignature = versionedRecordSignature(left[index])
      const rightSignature = versionedRecordSignature(right[index])
      if (leftSignature === undefined || rightSignature === undefined) {
        canUseSignatures = false
        break
      }
      if (leftSignature !== rightSignature) return false
    }
    if (canUseSignatures) return true
    return left.every((value, index) => snapshotPartsEqual(value, right[index]))
  }
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key)
    && snapshotPartsEqual(left[key as keyof typeof left], right[key as keyof typeof right]))
}

/**
 * Most repository domains are immutable-by-id or carry an updatedAt revision.
 * Compare those cheap signatures before walking nested record payloads. Data
 * without a trustworthy revision deliberately falls back to the exact check.
 */
function versionedRecordSignature(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string') return undefined
  if (typeof record.type === 'string' && typeof record.measuredAt === 'string' && typeof record.value === 'number') {
    return `measurement:${record.id}:${record.type}:${record.value}:${record.unit ?? ''}:${record.measuredAt}:${record.updatedAt ?? ''}:${record.note ?? ''}`
  }
  if (typeof record.updatedAt === 'string') return `revision:${record.id}:${record.updatedAt}`
  return undefined
}

/**
 * `getSnapshot` reads fresh Dexie objects on every refresh. Preserve references
 * for unchanged domains so memoized sections can skip their work when another
 * domain is saved (for example a medication must not recalculate sleep).
 */
export function shareUnchangedSnapshotParts(previous: HealthDataSnapshot, next: HealthDataSnapshot): HealthDataSnapshot {
  const shared = { ...next } as HealthDataSnapshot
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)])
  for (const key of keys) {
    const before = previous[key]
    const after = next[key]
    if (before === after) continue
    if (Array.isArray(before) && Array.isArray(after)) {
      if (snapshotPartsEqual(before, after)) {
        shared[key] = before
      }
      continue
    }
    if (
      before !== null && after !== null &&
      typeof before === 'object' && typeof after === 'object' &&
      snapshotPartsEqual(before, after)
    ) {
      shared[key] = before
    }
  }
  return shared
}
