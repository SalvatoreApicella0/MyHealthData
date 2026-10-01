import { describe, expect, it } from 'vitest'
import {
  medicationIsActive,
  medicationStatus,
  nextScheduledTime,
  parseTimeList,
  scheduleSummary,
  scheduledTimes,
  timeLabel,
} from './medicationsModel'

describe('medications model', () => {
  it('parses and orders fixed times while rejecting invalid values', () => {
    const times = parseTimeList('20:00, 08:30 99:00; 7:05')
    expect(times.map(timeLabel)).toEqual(['07:05', '08:30', '20:00'])
    expect(scheduledTimes({ scheduledTimes: [{ hour: 20, minute: 0 }, { hour: 8, minute: 30 }] })).toEqual([
      { hour: 8, minute: 30 },
      { hour: 20, minute: 0 },
    ])
  })

  it('localizes schedule summaries and status fallbacks', () => {
    expect(scheduleSummary({ scheduleStyle: 'fixedTimes', scheduledTimes: [{ hour: 8, minute: 0 }] }, true)).toBe('08:00')
    expect(scheduleSummary({ scheduleStyle: 'interval', intervalHours: 6 }, false)).toBe('Every 6 h')
    expect(scheduleSummary({ scheduleStyle: 'asNeeded' }, true)).toBe('Al bisogno')
    expect(medicationIsActive({ status: 'active' })).toBe(true)
    expect(medicationIsActive({ status: 'stopped' })).toBe(false)
    expect(medicationStatus({ active: 'false' })).toBe('stopped')
  })

  it('finds the next occurrence without mutating the input date', () => {
    const now = new Date(2026, 0, 2, 9, 15)
    const next = nextScheduledTime({ scheduledTimes: [{ hour: 8, minute: 0 }, { hour: 10, minute: 30 }] }, now)
    expect(next?.getDate()).toBe(2)
    expect(next?.getHours()).toBe(10)
    expect(next?.getMinutes()).toBe(30)
    expect(now.getHours()).toBe(9)
  })
})
