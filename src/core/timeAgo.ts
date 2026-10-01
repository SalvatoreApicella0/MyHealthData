/**
 * Relative time label for measurements, mirroring the compact iOS chips.
 *
 * Bands: <1m "ora", <60m "N min fa", <24h "N h fa", <365d "N g fa",
 * otherwise "N a" plus remaining days when greater than zero.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const YEAR = 365 * DAY

export function timeAgo(isoDate: string, language: string = 'it', now: Date = new Date()): string {
  const it = language !== 'en'
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const elapsed = now.getTime() - date.getTime()
  if (elapsed < MINUTE) {
    return it ? 'ora' : 'now'
  }
  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE)
    return it ? `${minutes} min fa` : `${minutes} min ago`
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR)
    return it ? `${hours} h fa` : `${hours} h ago`
  }
  if (elapsed < YEAR) {
    const days = Math.floor(elapsed / DAY)
    return it ? `${days} g fa` : `${days} d ago`
  }

  const years = Math.floor(elapsed / YEAR)
  const days = Math.floor((elapsed - years * YEAR) / DAY)
  if (days > 0) {
    return it ? `${years} a ${days} g fa` : `${years} y ${days} d ago`
  }
  return it ? `${years} a fa` : `${years} y ago`
}
