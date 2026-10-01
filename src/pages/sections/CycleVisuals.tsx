import { daysBetween } from './cycleModel'
import type { CycleForecast, CyclePhase } from './cycleModel'

export function Kpi({ label, value, unit, sub }: { label: string; value: number | undefined; unit: string; sub?: string }) {
  return (
    <article className="cycle-kpi">
      <span className="cycle-kpi-label">{label}</span>
      <p className="cycle-kpi-value">
        {value ?? '—'}
        {value !== undefined ? <small>{unit}</small> : null}
      </p>
      {sub ? <span className="cycle-kpi-delta">{sub}</span> : null}
    </article>
  )
}

export function PhaseRing({
  forecast,
  phase,
  phaseName,
  cap,
  day,
  label,
}: {
  forecast: CycleForecast
  phase: CyclePhase | undefined
  phaseName: string
  cap: string
  day: number | undefined
  label: string
}) {
  const size = 208
  const stroke = 15
  const radius = (size - stroke) / 2 - 3
  const circumference = 2 * Math.PI * radius
  const center = size / 2
  const cycleLength = Math.max(forecast.cycleLength, 1)
  const visibleDay = Math.min(Math.max(day ?? 1, 1), cycleLength)

  const segment = (from: number, to: number) => {
    const start = Math.min(Math.max(from, 0), 1)
    const end = Math.min(Math.max(to, 0), 1)
    const length = Math.max(end - start, 0) * circumference
    return { strokeDasharray: `${length} ${circumference - length}`, strokeDashoffset: `${-start * circumference}` }
  }

  const periodSegment = segment(0, forecast.periodLength / cycleLength)
  let fertileSegment: { strokeDasharray: string; strokeDashoffset: string } | undefined
  if (forecast.fertileStart && forecast.fertileEnd && forecast.lastStart) {
    const startOffset = daysBetween(forecast.fertileStart, forecast.lastStart.date)
    const endOffset = daysBetween(forecast.fertileEnd, forecast.lastStart.date) + 1
    fertileSegment = segment(startOffset / cycleLength, endOffset / cycleLength)
  }

  const angle = ((visibleDay - 1) / cycleLength) * 2 * Math.PI - Math.PI / 2
  const markerX = center + Math.cos(angle) * radius
  const markerY = center + Math.sin(angle) * radius

  return (
    <div className="cycle-ring" data-phase={phase ?? 'follicular'} role="img" aria-label={label}>
      <svg className="cycle-ring__svg" viewBox={`0 0 ${size} ${size}`}>
        <circle className="cycle-ring__track" cx={center} cy={center} fill="none" r={radius} strokeWidth={stroke} />
        <circle
          className="cycle-ring__arc cycle-ring__arc--period"
          cx={center}
          cy={center}
          fill="none"
          r={radius}
          strokeLinecap="butt"
          strokeWidth={stroke}
          style={periodSegment}
          transform={`rotate(-90 ${center} ${center})`}
        />
        {fertileSegment ? (
          <circle
            className="cycle-ring__arc cycle-ring__arc--fertile"
            cx={center}
            cy={center}
            fill="none"
            r={radius}
            strokeLinecap="butt"
            strokeWidth={stroke}
            style={fertileSegment}
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
        <circle className="cycle-ring__marker" cx={markerX} cy={markerY} r={7} />
      </svg>
      <div className="cycle-ring__center">
        <span className="cycle-ring__cap">{cap}</span>
        <strong className="cycle-ring__day">{day ?? '—'}</strong>
        <span className="cycle-ring__phase">{phaseName}</span>
      </div>
    </div>
  )
}

export function CycleSparkline({ lengths, label }: { lengths: number[]; label: string }) {
  if (lengths.length < 2) {
    return null
  }
  const width = 132
  const height = 30
  const pad = 3
  const min = Math.min(...lengths)
  const max = Math.max(...lengths)
  const range = max - min || 1
  const step = (width - pad * 2) / (lengths.length - 1)
  const points = lengths
    .map((value, index) => {
      const x = pad + index * step
      const y = height - pad - ((value - min) / range) * (height - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg aria-label={label} className="cycle-spark" preserveAspectRatio="none" role="img" viewBox={`0 0 ${width} ${height}`}>
      <polyline
        fill="none"
        points={points}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
