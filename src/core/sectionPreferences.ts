import { measurementTypeSchema } from './schema'
import type { MeasurementType } from './types'

/** Keep persisted section preferences compatible with the current catalog. */
export function normalizeSectionOrder(values: readonly string[], validIds: readonly string[]): string[] {
  const allowed = new Set(validIds)
  return [...new Set(values.filter((value) => allowed.has(value)))]
}

export type FavoriteId = `section:${string}` | `measurement:${MeasurementType}`

const measurementTypeIds = new Set<string>(measurementTypeSchema.options)
const favoritePartPattern = /^[a-z][a-zA-Z0-9_-]*$/

function parseFavoriteId(value: unknown, validSectionIds?: ReadonlySet<string>): FavoriteId | undefined {
  if (typeof value !== 'string') return undefined
  const separator = value.indexOf(':')
  if (separator <= 0 || separator === value.length - 1 || value.indexOf(':', separator + 1) !== -1) return undefined

  const namespace = value.slice(0, separator)
  const id = value.slice(separator + 1)
  if (!favoritePartPattern.test(id)) return undefined
  if (namespace === 'section' && (!validSectionIds || validSectionIds.has(id))) return `section:${id}`
  if (namespace === 'measurement' && measurementTypeIds.has(id)) return `measurement:${id as MeasurementType}`
  return undefined
}

/** Returns whether a persisted value follows the Web favorite contract. */
export function isFavoriteId(value: unknown, validSectionIds?: readonly string[]): value is FavoriteId {
  return parseFavoriteId(value, validSectionIds ? new Set(validSectionIds) : undefined) !== undefined
}

/**
 * Favorites are namespaced persisted IDs. Drop malformed or retired entries at
 * the boundary so every consumer can use the list without defensive parsing.
 * Preserve first-seen order because it is useful for stable storage diffs.
 */
export function normalizeFavoriteIds(values: readonly unknown[], validSectionIds?: readonly string[]): FavoriteId[] {
  const normalized: FavoriteId[] = []
  const seen = new Set<FavoriteId>()
  const validSections = validSectionIds ? new Set(validSectionIds) : undefined
  for (const value of values) {
    const id = parseFavoriteId(value, validSections)
    if (!id || seen.has(id)) continue
    seen.add(id)
    normalized.push(id)
  }
  return normalized
}
