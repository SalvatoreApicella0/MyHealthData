import { describe, expect, it } from 'vitest'
import { computeForecast, isCycleEntryDateAllowed, localDateKey, parseEntries, parseSettings } from './cycleModel'
import type { CycleEntry, CycleSettings } from './cycleModel'

const SETTINGS: CycleSettings = {
  typicalCycleLength: 28,
  typicalPeriodLength: 5,
  predictionMethod: 'calendar',
  showsFertileWindow: true,
  isConfigured: true,
}

function day(year: number, month: number, date: number): Date {
  return new Date(year, month - 1, date)
}

function entry(date: Date, extra: Partial<CycleEntry> = {}): CycleEntry {
  return {
    id: `cycle-${date.toISOString()}`,
    date,
    isPeriodStart: false,
    isPeriodEnd: false,
    isPeriodDay: false,
    ...extra,
  }
}

describe('cycle entry dates', () => {
  it('allows today and past days but rejects future days', () => {
    const today = new Date(2026, 8, 23, 15, 30)
    expect(isCycleEntryDateAllowed(new Date(2026, 8, 22), today)).toBe(true)
    expect(isCycleEntryDateAllowed(new Date(2026, 8, 23, 7), today)).toBe(true)
    expect(isCycleEntryDateAllowed(new Date(2026, 8, 24), today)).toBe(false)
  })

  it('round-trips a calendar day without converting it to a UTC instant', () => {
    const selected = day(2026, 3, 1)
    const value = localDateKey(selected)
    const [parsed] = parseEntries([{ id: 'local-day', date: value }])
    expect(value).toBe('2026-03-01')
    expect(parsed?.date.getFullYear()).toBe(2026)
    expect(parsed?.date.getMonth()).toBe(2)
    expect(parsed?.date.getDate()).toBe(1)
  })

  it('rejects invalid date-only values instead of normalizing them', () => {
    expect(parseEntries([{ id: 'invalid-day', date: '2026-02-30' }])).toEqual([])
  })
})

describe('computeForecast phase', () => {
  it('marks day 1 as menstrual', () => {
    const start = day(2026, 3, 1)
    const forecast = computeForecast([entry(start, { isPeriodStart: true })], SETTINGS, start)
    expect(forecast.cycleDay).toBe(1)
    expect(forecast.phase).toBe('menstrual')
  })

  it('marks mid-cycle before the fertile window as follicular', () => {
    const start = day(2026, 3, 1)
    const forecast = computeForecast([entry(start, { isPeriodStart: true })], SETTINGS, day(2026, 3, 7))
    expect(forecast.cycleDay).toBe(7)
    expect(forecast.phase).toBe('follicular')
  })

  it('marks the estimated fertile window as fertile', () => {
    const start = day(2026, 3, 1)
    const forecast = computeForecast([entry(start, { isPeriodStart: true })], SETTINGS, day(2026, 3, 13))
    expect(forecast.cycleDay).toBe(13)
    expect(forecast.phase).toBe('fertile')
    expect(forecast.fertileToday).toBe(true)
  })

  it('marks after ovulation as luteal', () => {
    const start = day(2026, 3, 1)
    const forecast = computeForecast([entry(start, { isPeriodStart: true })], SETTINGS, day(2026, 3, 21))
    expect(forecast.cycleDay).toBe(21)
    expect(forecast.phase).toBe('luteal')
  })
})

describe('computeForecast timing and stats', () => {
  it('reports a negative countdown when the next period is late', () => {
    const start = day(2026, 3, 1)
    const forecast = computeForecast([entry(start, { isPeriodStart: true })], SETTINGS, day(2026, 3, 31))
    expect(forecast.daysUntilNext).toBe(-2)
    expect(forecast.phase).toBe('luteal')
  })

  it('averages completed cycle lengths and reports variation', () => {
    const entries = [
      entry(day(2026, 1, 1), { isPeriodStart: true }),
      entry(day(2026, 1, 30), { isPeriodStart: true }),
      entry(day(2026, 2, 27), { isPeriodStart: true }),
    ]
    const forecast = computeForecast(entries, SETTINGS, day(2026, 3, 1))
    expect(forecast.average).toBe(29)
    expect(forecast.variation).toBe(1)
    expect(forecast.cycleLengths).toEqual([29, 28])
  })

  it('infers a start from flow days when no explicit start is logged', () => {
    const entries = [
      entry(day(2026, 3, 1), { isPeriodDay: true, flow: 'medium' }),
      entry(day(2026, 3, 2), { isPeriodDay: true, flow: 'light' }),
    ]
    const forecast = computeForecast(entries, SETTINGS, day(2026, 3, 3))
    expect(forecast.hasStart).toBe(true)
    expect(forecast.cycleDay).toBe(3)
    expect(forecast.phase).toBe('menstrual')
  })
})

describe('parsing', () => {
  it('parses entries and settings from raw records', () => {
    const entries = parseEntries([{ id: 'a', date: '2026-03-01T00:00:00.000Z', isPeriodStart: true, flow: 'medium' }])
    expect(entries).toHaveLength(1)
    expect(entries[0]?.isPeriodStart).toBe(true)

    const settings = parseSettings({ typicalCycleLength: 30, showsFertileWindow: true })
    expect(settings.typicalCycleLength).toBe(30)
    expect(settings.showsFertileWindow).toBe(true)
    expect(settings.isConfigured).toBe(false)
  })

  it('keeps the iOS default fertile-window behavior for partial legacy settings', () => {
    expect(parseSettings({ typicalCycleLength: 28 }).showsFertileWindow).toBe(true)
    expect(parseSettings({ typicalCycleLength: 28, showsFertileWindow: false }).showsFertileWindow).toBe(false)
  })
})
