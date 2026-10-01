export type Row = Record<string, unknown>

export interface TimeOfDay {
  hour: number
  minute: number
}

export const DAY_MS = 24 * 60 * 60 * 1000

export const MED_STATUS: Record<string, { it: string; en: string }> = {
  active: { it: 'Attivo', en: 'Active' },
  paused: { it: 'In pausa', en: 'Paused' },
  stopped: { it: 'Interrotto', en: 'Stopped' },
}

export const DOSE_STATUS: Record<string, { it: string; en: string }> = {
  taken: { it: 'Presa', en: 'Taken' },
  skipped: { it: 'Saltata', en: 'Skipped' },
  postponed: { it: 'Posticipata', en: 'Postponed' },
}

export function asString(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

export function scheduledTimes(row: Row): TimeOfDay[] {
  const raw = row.scheduledTimes
  if (!Array.isArray(raw)) return []
  const times: TimeOfDay[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Row
    const hour = asNumber(record.hour)
    const minute = asNumber(record.minute)
    if (hour === undefined || minute === undefined) continue
    times.push({ hour, minute })
  }
  return times.sort((left, right) => left.hour - right.hour || left.minute - right.minute)
}

export function timeLabel({ hour, minute }: TimeOfDay): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function parseTimeList(value: string): TimeOfDay[] {
  const times: TimeOfDay[] = []
  for (const raw of value.split(/[\s,;]+/).map((entry) => entry.trim()).filter(Boolean)) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(raw)
    if (!match) continue
    const hour = Number(match[1])
    const minute = Number(match[2])
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) times.push({ hour, minute })
  }
  return times.sort((left, right) => left.hour - right.hour || left.minute - right.minute)
}

export function parseDate(value: unknown): Date | undefined {
  const raw = asString(value)
  if (!raw) return undefined
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export function formatMoment(value: unknown, language: string): string {
  const date = parseDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDay(value: unknown, language: string): string {
  const date = parseDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function medStatusLabel(status: string, it: boolean): string {
  const entry = MED_STATUS[status]
  return entry ? (it ? entry.it : entry.en) : status
}

export function doseStatusLabel(status: string, it: boolean): string {
  const entry = DOSE_STATUS[status]
  return entry ? (it ? entry.it : entry.en) : status
}

export function scheduleSummary(row: Row, it: boolean): string {
  const schedule = asString(row.schedule)
  switch (asString(row.scheduleStyle)) {
    case 'fixedTimes': {
      const times = scheduledTimes(row)
      if (times.length > 0) return times.map(timeLabel).join(' · ')
      return schedule ?? (it ? 'Orari non indicati' : 'No schedule')
    }
    case 'interval': {
      const hours = asNumber(row.intervalHours)
      if (hours !== undefined) return it ? `Ogni ${hours} ore` : `Every ${hours} h`
      return schedule ?? (it ? 'Intervallo non indicato' : 'No interval')
    }
    case 'asNeeded':
      return it ? 'Al bisogno' : 'As needed'
    default:
      return schedule ?? (it ? 'Orario non indicato' : 'No schedule')
  }
}

export function medicationIsActive(row: Row): boolean {
  if ('active' in row) return row.active === true || row.active === 'true'
  const status = asString(row.status)
  return status ? status === 'active' : true
}

export function medicationStatus(row: Row): string {
  const explicit = asString(row.status)
  if (explicit) return explicit
  return medicationIsActive(row) ? 'active' : 'stopped'
}

export function nextScheduledTime(row: Row, now: Date): Date | undefined {
  const times = scheduledTimes(row)
  if (times.length === 0) return undefined
  for (const time of times) {
    const candidate = new Date(now)
    candidate.setHours(time.hour, time.minute, 0, 0)
    if (candidate.getTime() >= now.getTime()) return candidate
  }
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(times[0]!.hour, times[0]!.minute, 0, 0)
  return tomorrow
}
