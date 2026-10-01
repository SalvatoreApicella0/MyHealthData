import { memo, useCallback, useMemo } from 'react'
import { Star } from 'lucide-react'
import { MetricChart } from '../components/MetricChart'
import {
  averageDailyValue,
  dailyAggregates,
  formatPace,
  formatValue,
  isCumulativeMeasurement,
  lastValue,
  measurementTypesWithValues,
  measurementRecords,
  stairFloorsPerMinute,
  totalForDay,
  walkingPaceMinPerKm,
} from '../core/metrics'
import { timeAgo } from '../core/timeAgo'
import type { MeasurementType } from '../core/types'
import { STAIR_SPEED_TYPES } from './dataScrollModel'
import { MeasurementHistory } from './MeasurementHistory'

/** Metrics with a real time series (>=3 points over >=30 days): the only ones that keep a chart. */
const TREND_TYPES: ReadonlySet<string> = new Set<MeasurementType>([
  'weight',
  'body_fat_percentage',
  'lean_body_mass',
  'vo2_max',
])

interface MetricTileProps {
  type: MeasurementType
  tint: string
  language: string
  snapshot: Record<string, unknown>
  windowDays: number
  favorite: boolean
  onToggleFavorite: (id: string) => void
  measurementLabel: (rawValue: string) => string
  measurementUnit: (rawValue: string) => string
}

/**
 * Metric presentation driven by `docs/product/metric-presentation.md`:
 * daily cumulative metrics show today + 7/30-day averages (no chart), snapshot
 * metrics show value + relative time (no chart), trend metrics keep a sparkline.
 */
export const MetricTile = memo(function MetricTile({
  type,
  tint,
  language,
  snapshot,
  windowDays,
  favorite,
  onToggleFavorite,
  measurementLabel,
  measurementUnit,
}: MetricTileProps) {
  const latest = lastValue(snapshot, type)
  const daily = isCumulativeMeasurement(type)
  const trend = TREND_TYPES.has(type)
  const mixedUnits = useMemo(() => new Set(measurementRecords(snapshot, type).map((record) => record.unit.trim().toLowerCase())).size > 1, [snapshot, type])
  const value = daily ? (mixedUnits ? undefined : totalForDay(snapshot, type)) : latest?.value
  const avg7 = daily && !mixedUnits ? averageDailyValue(snapshot, type, 7) : undefined
  const avg30 = daily && !mixedUnits ? averageDailyValue(snapshot, type, 30) : undefined
  const series = useMemo(
    () => (trend && !mixedUnits ? dailyAggregates(snapshot, type, windowDays) : []),
    [trend, mixedUnits, snapshot, type, windowDays],
  )
  const chartPoints = useMemo(
    () => series.map((entry) => ({ at: new Date(entry.day).getTime(), value: entry.value })),
    [series],
  )
  const chartFormatValue = useCallback((entry: number) => formatValue(entry, ''), [])
  const unit = latest?.unit || measurementUnit(type) || ''
  const pace = type === 'walking_speed' ? walkingPaceMinPerKm(latest?.value, latest?.unit) : undefined
  const floors = STAIR_SPEED_TYPES.has(type) ? stairFloorsPerMinute(latest?.value, latest?.unit) : undefined

  return (
    <article className="scroll-data__kpi" data-static={!trend} style={{ '--tint': tint } as React.CSSProperties}>
      <button
        aria-label={language === 'it'
          ? `${favorite ? 'Rimuovi' : 'Aggiungi'} ${measurementLabel(type)} ${favorite ? 'dai' : 'ai'} preferiti`
          : `${favorite ? 'Remove' : 'Add'} ${measurementLabel(type)} ${favorite ? 'from' : 'to'} favorites`}
        aria-pressed={favorite}
        className="scroll-data__star scroll-data__star--kpi"
        onClick={() => onToggleFavorite(`measurement:${type}`)}
        type="button"
      >
        <Star size={13} fill={favorite ? 'currentColor' : 'none'} />
      </button>
      <span className="scroll-data__kpi-label">{measurementLabel(type)}</span>
      {daily ? <span className="scroll-data__kpi-time">{language === 'it' ? 'Totale di oggi' : "Today's total"}</span> : null}
      {mixedUnits ? <p className="scroll-data__kpi-note">{language === 'it' ? 'Unità diverse: consulta le registrazioni originali.' : 'Different units: view the original records.'}</p> : null}
      <p className="scroll-data__kpi-value">
        {pace !== undefined ? (
          <>
            {formatPace(pace)}
            <small>min/km</small>
          </>
        ) : floors !== undefined ? (
          <>
            {formatValue(floors, '')}
            <small>{language === 'it' ? 'piani/min' : 'floors/min'}</small>
          </>
        ) : (
          <>
            {value === undefined ? '—' : formatValue(value, '')}
            <small>{unit}</small>
          </>
        )}
        {latest?.measuredAt ? <span className="scroll-data__kpi-time">{timeAgo(latest.measuredAt, language)}</span> : null}
      </p>
      {floors !== undefined ? (
        <p className="scroll-data__kpi-note">{language === 'it' ? 'stima · 3 m per piano' : 'estimate · 3 m per floor'}</p>
      ) : null}
      {daily && (avg7 !== undefined || avg30 !== undefined) ? (
        <p className="scroll-data__kpi-avg">
          {avg7 !== undefined ? <span>{language === 'it' ? 'Media 7g' : '7d avg'} <b>{formatValue(avg7, '')}</b></span> : null}
          {avg30 !== undefined ? <span>{language === 'it' ? 'Media 30g' : '30d avg'} <b>{formatValue(avg30, '')}</b></span> : null}
        </p>
      ) : null}
      {trend && series.length > 1 ? (
        <MetricChart
          formatValue={chartFormatValue}
          label={measurementLabel(type)}
          points={chartPoints}
          tint={tint}
          variant="sparkline"
        />
      ) : null}
      <MeasurementHistory label={measurementLabel(type)} language={language} snapshot={snapshot} type={type} />
    </article>
  )
})

interface MetricTiersProps {
  types: MeasurementType[]
  /** When false (favorites view) every type is rendered as a tile. */
  partition: boolean
  language: string
  snapshot: Record<string, unknown>
  tint: string
  favorites: string[]
  onToggleFavorite: (id: string) => void
  measurementLabel: (rawValue: string) => string
  measurementUnit: (rawValue: string) => string
  windowDays: number
}

/** Metrics with no records stay discoverable inside the collapsed "Altri dati" row. */
export function OtherDataRow({ types, language, measurementLabel }: {
  types: MeasurementType[]
  language: string
  measurementLabel: (rawValue: string) => string
}) {
  return (
    <details className="scroll-data__others">
      <summary className="scroll-data__others-summary">
        {language === 'it' ? 'Altri dati' : 'Other data'}
        <span className="scroll-data__others-count">{types.length}</span>
      </summary>
      <div className="scroll-data__others-chips">
        {types.map((type) => (
          <span className="chip scroll-data__others-chip" key={type}>{measurementLabel(type)}</span>
        ))}
      </div>
    </details>
  )
}

/**
 * Splits curated metrics into the main grid (records present) and the
 * collapsed "Altri dati" row (zero records), per
 * `docs/product/metric-presentation.md`.
 */
export const MetricTiers = memo(function MetricTiers({ types, partition, language, snapshot, tint, favorites, onToggleFavorite, measurementLabel, measurementUnit, windowDays }: MetricTiersProps) {
  const { main, others } = useMemo(() => {
    if (!partition) return { main: types, others: [] as MeasurementType[] }
    const available = measurementTypesWithValues(snapshot)
    const present: MeasurementType[] = []
    const missing: MeasurementType[] = []
    for (const type of types) {
      if (available.has(type)) present.push(type)
      else missing.push(type)
    }
    return { main: present, others: missing }
  }, [types, partition, snapshot])

  return (
    <>
      {main.length > 0 ? (
        <div className="scroll-data__kpis" data-dense={main.length > 4}>
          {main.map((type) => (
            <MetricTile
              favorite={favorites.includes(`measurement:${type}`)}
              key={type}
              language={language}
              measurementLabel={measurementLabel}
              measurementUnit={measurementUnit}
              onToggleFavorite={onToggleFavorite}
              snapshot={snapshot}
              tint={tint}
              type={type}
              windowDays={windowDays}
            />
          ))}
        </div>
      ) : null}
      {others.length > 0 ? <OtherDataRow language={language} measurementLabel={measurementLabel} types={others} /> : null}
    </>
  )
})
