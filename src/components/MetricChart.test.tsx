import { describe, expect, it } from 'vitest'
import { metricChartBounds } from './MetricChart'

describe('metric chart bounds', () => {
  it('handles large imported series without argument-spread overflow', () => {
    const points = Array.from({ length: 200_000 }, (_, index) => ({
      at: index,
      value: (index % 101) - 50,
    }))

    expect(metricChartBounds(points)).toEqual({ dataMin: -50, dataMax: 50, timeMin: 0, timeMax: 199_999 })
  })

  it('ignores non-finite values and timestamps', () => {
    expect(metricChartBounds([
      { at: 3, value: 12 },
      { at: Number.NaN, value: 1 },
      { at: 4, value: Number.POSITIVE_INFINITY },
    ])).toEqual({ dataMin: 12, dataMax: 12, timeMin: 3, timeMax: 3 })
  })
})
