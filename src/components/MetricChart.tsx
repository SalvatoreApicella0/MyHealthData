import { memo, useId } from 'react'

export interface ChartPoint {
  /** Timestamp in milliseconds. */
  at: number
  value: number
}

interface MetricChartProps {
  points: ChartPoint[]
  tint: string
  /** Fixed lower bound; omit for an adaptive domain like the iOS charts. */
  minimum?: number
  /** Fixed upper bound; omit for an adaptive domain like the iOS charts. */
  maximum?: number
  variant?: 'sparkline' | 'panel'
  label: string
  formatValue?: (value: number) => string
}

export interface MetricChartBounds {
  dataMin: number
  dataMax: number
  timeMin: number
  timeMax: number
}

/**
 * Finds chart bounds without spreading a potentially large series into a
 * function call. Health imports can contain tens of thousands of samples;
 * `Math.min(...values)` over such a series can throw a RangeError in the VM.
 */
export function metricChartBounds(points: readonly ChartPoint[]): MetricChartBounds | undefined {
  let dataMin = Infinity
  let dataMax = -Infinity
  let timeMin = Infinity
  let timeMax = -Infinity

  for (const point of points) {
    if (!Number.isFinite(point.value) || !Number.isFinite(point.at)) continue
    if (point.value < dataMin) dataMin = point.value
    if (point.value > dataMax) dataMax = point.value
    if (point.at < timeMin) timeMin = point.at
    if (point.at > timeMax) timeMax = point.at
  }

  return Number.isFinite(dataMin) && Number.isFinite(dataMax) && Number.isFinite(timeMin) && Number.isFinite(timeMax)
    ? { dataMin, dataMax, timeMin, timeMax }
    : undefined
}

const PADDING = 6

/**
 * Linear metric chart with a bounded adaptive Y domain.
 *
 * Mirrors the iOS behaviour documented in the delivery log: continuous metrics
 * get a domain padded around the actual data instead of being pinned to zero,
 * while score/consumption charts can pass an explicit `minimum`.
 */
export const MetricChart = memo(function MetricChart({
  points,
  tint,
  minimum,
  maximum,
  variant = 'panel',
  label,
  formatValue = (value) => value.toFixed(1),
}: MetricChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const sorted = [...points]
    .filter((point) => Number.isFinite(point.value) && Number.isFinite(point.at))
    .sort((left, right) => left.at - right.at)

  if (sorted.length === 0) {
    return <div className="chart-empty">—</div>
  }

  const width = 300
  const height = variant === 'sparkline' ? 42 : 150
  const bounds = metricChartBounds(sorted)
  if (!bounds) {
    return <div className="chart-empty">—</div>
  }
  const { dataMin, dataMax, timeMin, timeMax } = bounds
  const span = dataMax - dataMin
  const pad = span === 0 ? Math.max(Math.abs(dataMax) * 0.08, 1) : span * 0.18
  const domainMin = minimum ?? dataMin - pad
  const domainMax = maximum ?? dataMax + pad
  const range = domainMax - domainMin || 1

  const timeRange = timeMax - timeMin || 1

  const x = (at: number) => PADDING + ((at - timeMin) / timeRange) * (width - PADDING * 2)
  const y = (value: number) => height - PADDING - ((value - domainMin) / range) * (height - PADDING * 2)

  const line = sorted.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.at).toFixed(2)},${y(point.value).toFixed(2)}`).join(' ')
  const area = `${line} L${x(timeMax).toFixed(2)},${height - PADDING} L${x(timeMin).toFixed(2)},${height - PADDING} Z`
  const last = sorted.at(-1)
  if (!last) {
    return <div className="chart-empty">—</div>
  }

  return (
    <svg
      aria-label={`${label}: ${formatValue(last.value)}`}
      className={variant === 'sparkline' ? 'widget__spark' : 'chart chart--tall'}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <linearGradient id={`fill-${gradientId}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={tint} stopOpacity="0.32" />
          <stop offset="100%" stopColor={tint} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {variant === 'panel' ? (
        <>
          <line stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" x1="0" x2={width} y1={y(domainMax)} y2={y(domainMax)} />
          <line stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" x1="0" x2={width} y1={y(domainMin)} y2={y(domainMin)} />
        </>
      ) : null}
      <path d={area} fill={`url(#fill-${gradientId})`} />
      <path d={line} fill="none" stroke={tint} strokeLinecap="round" strokeLinejoin="round" strokeWidth={variant === 'sparkline' ? 2 : 2.4} />
      {variant === 'panel' ? <circle cx={x(last.at)} cy={y(last.value)} fill={tint} r="4" /> : null}
    </svg>
  )
})
