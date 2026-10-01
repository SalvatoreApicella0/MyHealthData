/**
 * Pure cycle logic shared by the Web "Ciclo" section.
 *
 * Mirrors the phases and predictions of the iOS `CyclePredictor`
 * (`Models/CyclePrediction.swift`) without any clinical interpretation: it only
 * estimates day, phase and next period from the entries and the user settings.
 */

export interface CycleEntry {
  id: string
  date: Date
  flow?: string
  mood?: string
  symptoms?: string
  note?: string
  isPeriodStart: boolean
  isPeriodEnd: boolean
  isPeriodDay: boolean
}

export interface CycleSettings {
  typicalCycleLength?: number
  typicalPeriodLength?: number
  predictionMethod?: string
  showsFertileWindow: boolean
  isConfigured: boolean
}

export type CyclePhase = 'menstrual' | 'follicular' | 'fertile' | 'luteal'

export type DayState = 'period' | 'fertile' | 'logged' | 'none'

export interface CycleHistoryItem {
  id: string
  start: Date
  cycleLength?: number
  periodLength?: number
}

export interface CountedLabel {
  label: string
  count: number
}

export interface CycleForecast {
  hasEntries: boolean
  hasStart: boolean
  starts: CycleEntry[]
  lastStart?: CycleEntry
  cycleDay?: number
  cycleLength: number
  periodLength: number
  nextPeriodStart?: Date
  daysUntilNext?: number
  phase?: CyclePhase
  fertileStart?: Date
  fertileEnd?: Date
  upcomingFertileStart?: Date
  upcomingFertileEnd?: Date
  fertileToday: boolean
  average?: number
  variation?: number
  periodAverage?: number
  cycleLengths: number[]
  history: CycleHistoryItem[]
  symptoms: CountedLabel[]
  moods: CountedLabel[]
}

const FERTILE_BEFORE_OVULATION = 5
const LUTEAL_LENGTH = 14
const MAX_PERIOD_DAYS = 14

export function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isCycleEntryDateAllowed(date: Date, today: Date = new Date()): boolean {
  return startOfDay(date) <= startOfDay(today)
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export function daysBetween(later: Date, earlier: Date): number {
  return Math.round((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / 86_400_000)
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function sameDay(left: Date, right: Date): boolean {
  return left.getTime() === right.getTime()
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined
  }
  const localDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (localDate) {
    const year = Number(localDate[1])
    const month = Number(localDate[2])
    const day = Number(localDate[3])
    const date = new Date(year, month - 1, day)
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined
    return date
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : startOfDay(date)
}

export function parseEntries(records: Array<Record<string, unknown>>): CycleEntry[] {
  const parsed: CycleEntry[] = []
  for (const record of records) {
    const date = parseDate(record.date)
    if (!date) {
      continue
    }
    parsed.push({
      id: typeof record.id === 'string' ? record.id : dayKey(date),
      date,
      flow: typeof record.flow === 'string' ? record.flow : undefined,
      mood: typeof record.mood === 'string' ? record.mood : undefined,
      symptoms: typeof record.symptoms === 'string' ? record.symptoms : undefined,
      note: typeof record.note === 'string' ? record.note : undefined,
      isPeriodStart: record.isPeriodStart === true,
      isPeriodEnd: record.isPeriodEnd === true,
      isPeriodDay: record.isPeriodDay === true,
    })
  }
  return parsed.sort((left, right) => left.date.getTime() - right.date.getTime())
}

export function parseSettings(value: unknown): CycleSettings {
  const source = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const cycleLength = Number(source.typicalCycleLength)
  const periodLength = Number(source.typicalPeriodLength)
  return {
    typicalCycleLength: Number.isFinite(cycleLength) && cycleLength > 0 ? cycleLength : undefined,
    typicalPeriodLength: Number.isFinite(periodLength) && periodLength > 0 ? periodLength : undefined,
    predictionMethod: typeof source.predictionMethod === 'string' ? source.predictionMethod : undefined,
    // iOS defaults this field to true when older records omit it.
    showsFertileWindow: source.showsFertileWindow === undefined ? true : source.showsFertileWindow === true,
    isConfigured: source.isConfigured === true,
  }
}

function recordsPeriod(entry: CycleEntry): boolean {
  return entry.isPeriodDay || entry.isPeriodStart || Boolean(entry.flow)
}

/** Explicit period starts, or inferred starts when only flow days were logged. */
export function normalizePeriodStarts(entries: CycleEntry[]): CycleEntry[] {
  const explicit = entries.filter((entry) => entry.isPeriodStart)
  if (explicit.length > 0) {
    return explicit
  }
  const candidates = entries.filter(recordsPeriod).map((entry) => entry.date).sort((left, right) => left.getTime() - right.getTime())
  const inferred: Date[] = []
  for (const day of candidates) {
    const previous = inferred[inferred.length - 1]
    if (!previous || daysBetween(day, previous) > MAX_PERIOD_DAYS) {
      inferred.push(day)
    }
  }
  return inferred.map((date) => ({
    id: `inferred-${dayKey(date)}`,
    date,
    isPeriodStart: true,
    isPeriodEnd: false,
    isPeriodDay: true,
  }))
}

export function cycleStats(starts: CycleEntry[]): { average?: number; variation?: number; lengths: number[] } {
  const lengths: number[] = []
  for (let index = 1; index < starts.length; index += 1) {
    const previous = starts[index - 1]
    const current = starts[index]
    if (!previous || !current) {
      continue
    }
    const length = daysBetween(current.date, previous.date)
    if (length > 0) {
      lengths.push(length)
    }
  }
  if (lengths.length === 0) {
    return { lengths }
  }
  const average = Math.round(lengths.reduce((total, value) => total + value, 0) / lengths.length)
  return { average, variation: Math.max(...lengths) - Math.min(...lengths), lengths }
}

function recordedPeriodLength(entries: CycleEntry[], start: CycleEntry, next: CycleEntry | undefined): number | undefined {
  const cap = addDays(start.date, MAX_PERIOD_DAYS)
  let end: Date | undefined
  let counted = 0
  for (const entry of entries) {
    if (entry.date.getTime() < start.date.getTime()) {
      continue
    }
    if (entry.date.getTime() > cap.getTime()) {
      break
    }
    if (next && entry.date.getTime() >= next.date.getTime()) {
      break
    }
    if (entry.isPeriodEnd) {
      end = entry.date
    }
    if (recordsPeriod(entry)) {
      counted += 1
    }
  }
  if (end) {
    return daysBetween(end, start.date) + 1
  }
  return counted > 0 ? counted : undefined
}

function averagePeriodLength(entries: CycleEntry[], starts: CycleEntry[]): number | undefined {
  const lengths: number[] = []
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index]
    if (!start) {
      continue
    }
    const length = recordedPeriodLength(entries, start, starts[index + 1])
    if (length !== undefined) {
      lengths.push(length)
    }
  }
  if (lengths.length === 0) {
    return undefined
  }
  return Math.round(lengths.reduce((total, value) => total + value, 0) / lengths.length)
}

export function periodDays(entries: CycleEntry[], starts: CycleEntry[]): Set<string> {
  const keys = new Set<string>()
  for (const entry of entries) {
    if (recordsPeriod(entry)) {
      keys.add(dayKey(entry.date))
    }
  }
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index]
    if (!start) {
      continue
    }
    const next = starts[index + 1]
    let end = start.date
    for (const entry of entries) {
      if (entry.date.getTime() < start.date.getTime()) {
        continue
      }
      if (next && entry.date.getTime() >= next.date.getTime()) {
        break
      }
      if (entry.isPeriodEnd) {
        end = entry.date
      }
    }
    for (let cursor = new Date(start.date); cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
      keys.add(dayKey(cursor))
    }
  }
  return keys
}

export function stripDays(
  today: Date,
  entries: CycleEntry[],
  period: Set<string>,
  fertileStart: Date | undefined,
  fertileEnd: Date | undefined,
  count: number,
): Array<{ key: string; date: Date; state: DayState }> {
  const logged = new Set(entries.map((entry) => dayKey(entry.date)))
  const fertile = new Set<string>()
  if (fertileStart && fertileEnd) {
    for (let cursor = new Date(fertileStart); cursor.getTime() <= fertileEnd.getTime(); cursor = addDays(cursor, 1)) {
      fertile.add(dayKey(cursor))
    }
  }
  const days: Array<{ key: string; date: Date; state: DayState }> = []
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset)
    const key = dayKey(date)
    const state: DayState = period.has(key) ? 'period' : fertile.has(key) ? 'fertile' : logged.has(key) ? 'logged' : 'none'
    days.push({ key, date, state })
  }
  return days
}

function countSymptoms(entries: CycleEntry[]): CountedLabel[] {
  const counts = new Map<string, CountedLabel>()
  for (const entry of entries) {
    if (!entry.symptoms) {
      continue
    }
    for (const token of entry.symptoms.split(/[,;]/)) {
      const label = token.trim()
      if (!label) {
        continue
      }
      const key = label.toLocaleLowerCase()
      const current = counts.get(key)
      if (current) {
        current.count += 1
      } else {
        counts.set(key, { label, count: 1 })
      }
    }
  }
  return [...counts.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)).slice(0, 5)
}

function countMoods(entries: CycleEntry[]): CountedLabel[] {
  const counts = new Map<string, CountedLabel>()
  for (const entry of entries) {
    if (!entry.mood) {
      continue
    }
    const current = counts.get(entry.mood)
    if (current) {
      current.count += 1
    } else {
      counts.set(entry.mood, { label: entry.mood, count: 1 })
    }
  }
  return [...counts.values()].sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)).slice(0, 5)
}

export function computeForecast(entries: CycleEntry[], settings: CycleSettings, today: Date): CycleForecast {
  const normalized = normalizePeriodStarts(entries)
  const starts = normalized.filter((entry) => entry.date.getTime() <= today.getTime())
  const lastStart = starts[starts.length - 1]
  const stats = cycleStats(starts)
  const measuredPeriod = averagePeriodLength(entries, starts)
  const periodAverage = measuredPeriod ?? settings.typicalPeriodLength
  const cycleLength = settings.typicalCycleLength ?? stats.average ?? 28
  const periodLength = settings.typicalPeriodLength ?? periodAverage ?? 5

  const history: CycleHistoryItem[] = starts
    .map((start, index) => ({
      id: start.id,
      start: start.date,
      cycleLength: starts[index + 1] ? daysBetween(starts[index + 1]!.date, start.date) : undefined,
      periodLength: recordedPeriodLength(entries, start, starts[index + 1]),
    }))
    .reverse()

  const scope = lastStart ? entries.filter((entry) => entry.date.getTime() >= lastStart.date.getTime()) : entries

  const forecast: CycleForecast = {
    hasEntries: entries.length > 0,
    hasStart: starts.length > 0,
    starts,
    lastStart,
    cycleLength,
    periodLength,
    average: stats.average,
    variation: stats.variation,
    periodAverage,
    cycleLengths: stats.lengths,
    history,
    symptoms: countSymptoms(scope),
    moods: countMoods(scope),
    fertileToday: false,
  }

  if (!lastStart) {
    return forecast
  }

  const cycleDay = daysBetween(today, lastStart.date) + 1
  const nextPeriodStart = addDays(lastStart.date, cycleLength)
  const ovulation = addDays(lastStart.date, cycleLength - LUTEAL_LENGTH)
  const fertileStart = addDays(ovulation, -FERTILE_BEFORE_OVULATION)
  const periodToday = entries.some((entry) => sameDay(entry.date, today) && recordsPeriod(entry))
  const fertileToday = today.getTime() >= fertileStart.getTime() && today.getTime() <= ovulation.getTime()

  let phase: CyclePhase
  if (cycleDay <= periodLength || periodToday) {
    phase = 'menstrual'
  } else if (fertileToday) {
    phase = 'fertile'
  } else if (today.getTime() > ovulation.getTime()) {
    phase = 'luteal'
  } else {
    phase = 'follicular'
  }

  let upcomingFertileStart = fertileStart
  let upcomingFertileEnd = ovulation
  if (today.getTime() > upcomingFertileEnd.getTime()) {
    upcomingFertileStart = addDays(upcomingFertileStart, cycleLength)
    upcomingFertileEnd = addDays(upcomingFertileEnd, cycleLength)
  }

  return {
    ...forecast,
    cycleDay,
    nextPeriodStart,
    daysUntilNext: daysBetween(nextPeriodStart, today),
    phase,
    fertileStart,
    fertileEnd: ovulation,
    upcomingFertileStart,
    upcomingFertileEnd,
    fertileToday,
  }
}
