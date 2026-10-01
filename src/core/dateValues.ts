/** Returns the calendar portion accepted by an HTML date input. */
export function dateInputValue(raw: string): string {
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10)
}

/** Sorts date-like values without mutating the source array. */
export function sortDateLike<T>(values: T[], getValue: (value: T) => string): T[] {
  return [...values].sort((left, right) => getValue(right).localeCompare(getValue(left)))
}
