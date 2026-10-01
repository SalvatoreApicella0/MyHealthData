import { useMemo, useRef } from 'react'
import { Star } from 'lucide-react'
import { MOVEMENT_DOMAIN_TYPES } from '../core/domainSignatures'
import {
  averageDailyValue,
  averageWeeklyTotal,
  formatPace,
  formatValue,
  lastValue,
  stairFloorsPerMinute,
  totalForDay,
  totalForWeek,
  walkingPaceMinPerKm,
} from '../core/metrics'
import { timeAgo } from '../core/timeAgo'
import type { Measurement, MeasurementType } from '../core/types'
import { measurementForTypes, measurementSubsetSignature } from '../core/measurementSignatures'
import {
  MOVEMENT_DAILY_TYPES,
  MOVEMENT_DISTANCE_DAILY_TYPE,
  MOVEMENT_DISTANCE_TYPES,
  MOVEMENT_GAIT_TYPES,
  MOVEMENT_MINUTES_TYPE,
  MOVEMENT_OTHER_TYPES,
  MOVEMENT_STAIR_TYPES,
} from './dataScrollModel'
import { MetricTile, OtherDataRow } from './DataScrollMetricViews'
import { MeasurementHistory } from './MeasurementHistory'

/**
 * Retain a domain slice when the repository publishes a new snapshot object
 * but the selected records did not change. This is intentionally local to a
 * mounted section: it cannot retain PHI globally and it makes the dependency
 * boundary explicit for hot paths such as Movimento.
 */
function useStableMeasurementDomain(
  measurements: readonly Measurement[],
  types: readonly MeasurementType[],
): readonly Measurement[] {
  const signature = useMemo(() => measurementSubsetSignature(measurements, types), [measurements, types])
  const previous = useRef<{ signature: string; records: readonly Measurement[] }>()
  if (!previous.current || previous.current.signature !== signature) {
    previous.current = {
      signature,
      records: measurementForTypes(measurements, types),
    }
  }
  return previous.current.records
}

function MetricStar({ type, favorite, language, onToggleFavorite }: {
  type: MeasurementType
  favorite: boolean
  language: string
  onToggleFavorite: (id: string) => void
}) {
  return (
    <button
      aria-label={language === 'it'
        ? `${favorite ? 'Rimuovi' : 'Aggiungi'} ${type} ${favorite ? 'dai' : 'ai'} preferiti`
        : `${favorite ? 'Remove' : 'Add'} ${type} ${favorite ? 'from' : 'to'} favorites`}
      aria-pressed={favorite}
      className="scroll-data__star"
      onClick={() => onToggleFavorite(`measurement:${type}`)}
      type="button"
    >
      <Star size={12} fill={favorite ? 'currentColor' : 'none'} />
    </button>
  )
}

interface MovementRow {
  type: MeasurementType
  value?: string
  unit?: string
  time?: string
  note?: string
}

/** Compact metric table used by the grouped Movimento cards. */
function MovementTableCard({ title, tint, rows, language, favorites, onToggleFavorite, measurementLabel, snapshot }: {
  title: string
  tint: string
  snapshot: Record<string, unknown>
  rows: MovementRow[]
  language: string
  favorites: string[]
  onToggleFavorite: (id: string) => void
  measurementLabel: (rawValue: string) => string
}) {
  return (
    <div className="scroll-data__table-wrap" style={{ '--tint': tint } as React.CSSProperties}>
      <p className="scroll-data__movement-title">{title}</p>
      <table className="scroll-data__table">
        <thead>
          <tr>
            <th scope="col">{language === 'it' ? 'Metrica' : 'Metric'}</th>
            <th scope="col">{language === 'it' ? 'Valore' : 'Value'}</th>
            <th scope="col">{language === 'it' ? 'Tempo' : 'Time'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.type}>
              <th scope="row">
                <span className="scroll-data__movement-metric">
                  <MetricStar
                    favorite={favorites.includes(`measurement:${row.type}`)}
                    language={language}
                    onToggleFavorite={onToggleFavorite}
                    type={row.type}
                  />
                  {measurementLabel(row.type)}
                </span>
              </th>
              <td>
                {row.value === undefined ? <span className="scroll-data__table-empty">—</span> : (
                  <>
                    <span className="scroll-data__table-value">{row.value}{row.unit ? ` ${row.unit}` : ''}</span>
                    {row.note ? <span className="scroll-data__table-time">{row.note}</span> : null}
                  </>
                )}
              </td>
              <td><MeasurementHistory label={measurementLabel(row.type)} language={language} snapshot={snapshot} type={row.type} />{row.time ? <span className="scroll-data__table-time">{row.time}</span> : <span className="scroll-data__table-empty">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface MovementSectionProps {
  measurements: readonly Measurement[]
  language: string
  tint: string
  windowDays: number
  favorites: string[]
  onToggleFavorite: (id: string) => void
  measurementLabel: (rawValue: string) => string
  measurementUnit: (rawValue: string) => string
}

/**
 * Movimento in fewer, chunkier cards: WHO-style weekly exercise minutes, daily
 * cumulative tiles, one distances card, one stairs card and one gait table.
 * Unused metrics fall into the collapsed "Altri dati" row.
 */
export function MovementSection({ measurements, language, tint, windowDays, favorites, onToggleFavorite, measurementLabel, measurementUnit }: MovementSectionProps) {
  const it = language === 'it'
  const movementMeasurements = useStableMeasurementDomain(measurements, MOVEMENT_DOMAIN_TYPES)
  const movementSnapshot = useMemo(() => ({ measurements: movementMeasurements }), [movementMeasurements])
  const {
    avg4,
    avg12,
    dailyTypes,
    distanceRows,
    gaitRows,
    hasMinutes,
    kpiCount,
    minutes,
    minutesUnit,
    mixedMinutes,
    otherTypes,
    stairRows,
    weekTotal,
  } = useMemo(() => {
    const has = (type: MeasurementType) => lastValue(movementSnapshot, type)?.value !== undefined
    const relative = (measuredAt?: string) => (measuredAt ? timeAgo(measuredAt, language) : undefined)
    const uniform = (type: MeasurementType) => new Set(movementMeasurements.filter((record) => record.type === type).map((record) => record.unit.trim().toLowerCase())).size <= 1
    const minutes = MOVEMENT_MINUTES_TYPE
    const mixedMinutes = !uniform(minutes)
    const weekTotal = totalForWeek(movementSnapshot, minutes, 0)
    const avg4 = mixedMinutes ? undefined : averageWeeklyTotal(movementSnapshot, minutes, 4)
    const avg12 = mixedMinutes ? undefined : averageWeeklyTotal(movementSnapshot, minutes, 12)
    const minutesUnit = lastValue(movementSnapshot, minutes)?.unit || measurementUnit(minutes) || 'min'
    const dailyTypes = MOVEMENT_DAILY_TYPES.filter(has)

    const distanceRows: MovementRow[] = []
    if (has(MOVEMENT_DISTANCE_DAILY_TYPE)) {
      const latest = lastValue(movementSnapshot, MOVEMENT_DISTANCE_DAILY_TYPE)
      const uniformDistance = uniform(MOVEMENT_DISTANCE_DAILY_TYPE)
      const avg7 = uniformDistance ? averageDailyValue(movementSnapshot, MOVEMENT_DISTANCE_DAILY_TYPE, 7) : undefined
      distanceRows.push({
        type: MOVEMENT_DISTANCE_DAILY_TYPE,
        value: uniformDistance ? formatValue(totalForDay(movementSnapshot, MOVEMENT_DISTANCE_DAILY_TYPE), '') : '—',
        unit: latest?.unit || 'km',
        note: !uniformDistance ? (it ? 'Unità diverse: consulta le registrazioni' : 'Different units: view records') : avg7 !== undefined ? `${it ? 'Media 7g' : '7d avg'} ${formatValue(avg7, '')} ${latest?.unit || 'km'}` : undefined,
        time: relative(latest?.measuredAt),
      })
    }
    for (const type of MOVEMENT_DISTANCE_TYPES) {
      const latest = lastValue(movementSnapshot, type)
      if (latest?.value === undefined) continue
      distanceRows.push({ type, value: formatValue(latest.value, ''), unit: latest.unit || 'km', time: relative(latest.measuredAt) })
    }

    const stairRows: MovementRow[] = MOVEMENT_STAIR_TYPES.flatMap((type) => {
      const latest = lastValue(movementSnapshot, type)
      if (latest?.value === undefined) return []
      const floors = stairFloorsPerMinute(latest.value, latest.unit)
      return [{
        type,
        value: floors !== undefined ? formatValue(floors, '') : formatValue(latest.value, ''),
        unit: floors !== undefined ? (it ? 'piani/min' : 'floors/min') : (latest.unit || measurementUnit(type)),
        note: floors !== undefined ? (it ? 'stima · 3 m per piano' : 'estimate · 3 m per floor') : undefined,
        time: relative(latest.measuredAt),
      }]
    })

    const gaitRows: MovementRow[] = MOVEMENT_GAIT_TYPES.flatMap((type) => {
      const latest = lastValue(movementSnapshot, type)
      if (latest?.value === undefined) return []
      const pace = type === 'walking_speed' ? walkingPaceMinPerKm(latest.value, latest.unit) : undefined
      return [{
        type,
        value: pace !== undefined ? formatPace(pace) : formatValue(latest.value, ''),
        unit: pace !== undefined ? 'min/km' : (latest.unit || measurementUnit(type)),
        time: relative(latest.measuredAt),
      }]
    })

    const rendered = new Set<MeasurementType>()
    const hasMinutes = has(minutes)
    if (hasMinutes) rendered.add(minutes)
    for (const type of dailyTypes) rendered.add(type)
    for (const row of distanceRows) rendered.add(row.type)
    for (const row of stairRows) rendered.add(row.type)
    for (const row of gaitRows) rendered.add(row.type)
    const otherTypes = MOVEMENT_OTHER_TYPES.filter((type) => !rendered.has(type))
    return { avg4, avg12, dailyTypes, distanceRows, gaitRows, hasMinutes, kpiCount: (hasMinutes ? 1 : 0) + dailyTypes.length, minutes, minutesUnit, mixedMinutes, otherTypes, stairRows, weekTotal }
  }, [it, language, measurementUnit, movementSnapshot])

  return (
    <>
      {kpiCount > 0 ? (
        <div className="scroll-data__kpis" data-dense={kpiCount > 4}>
          {hasMinutes ? (
            <article className="scroll-data__kpi scroll-data__kpi--minutes" data-static="true" style={{ '--tint': tint } as React.CSSProperties}>
              <button
                aria-label={it
                  ? `${favorites.includes(`measurement:${minutes}`) ? 'Rimuovi' : 'Aggiungi'} ${measurementLabel(minutes)} ${favorites.includes(`measurement:${minutes}`) ? 'dai' : 'ai'} preferiti`
                  : `${favorites.includes(`measurement:${minutes}`) ? 'Remove' : 'Add'} ${measurementLabel(minutes)} ${favorites.includes(`measurement:${minutes}`) ? 'from' : 'to'} favorites`}
                aria-pressed={favorites.includes(`measurement:${minutes}`)}
                className="scroll-data__star scroll-data__star--kpi"
                onClick={() => onToggleFavorite(`measurement:${minutes}`)}
                type="button"
              >
                <Star size={13} fill={favorites.includes(`measurement:${minutes}`) ? 'currentColor' : 'none'} />
              </button>
              <span className="scroll-data__kpi-label">{measurementLabel(minutes)}</span>
              <p className="scroll-data__kpi-value">
                {mixedMinutes ? '—' : formatValue(weekTotal, '')}
                <small>{minutesUnit}</small>
                <span className="scroll-data__kpi-time">{it ? 'questa settimana' : 'this week'}</span>
              </p>
              {avg4 !== undefined || avg12 !== undefined ? (
                <p className="scroll-data__kpi-avg">
                  {avg4 !== undefined ? <span>{it ? 'Media 4 sett.' : '4-wk avg'} <b>{formatValue(avg4, '')}</b></span> : null}
                  {avg12 !== undefined ? <span>{it ? '12 sett.' : '12-wk'} <b>{formatValue(avg12, '')}</b></span> : null}
                </p>
              ) : null}
              {mixedMinutes ? <p className="scroll-data__kpi-note">{it ? 'Unità diverse: consulta le registrazioni originali.' : 'Different units: view original records.'}</p> : null}
              <MeasurementHistory label={measurementLabel(minutes)} language={language} snapshot={movementSnapshot} type={minutes} />
              <p className="scroll-data__kpi-note">{it ? '150 min/sett. consigliati' : '150 min/wk recommended'}</p>
            </article>
          ) : null}
          {dailyTypes.map((type) => (
            <MetricTile
              favorite={favorites.includes(`measurement:${type}`)}
              key={type}
              language={language}
              measurementLabel={measurementLabel}
              measurementUnit={measurementUnit}
              onToggleFavorite={onToggleFavorite}
              snapshot={movementSnapshot}
              tint={tint}
              type={type}
              windowDays={windowDays}
            />
          ))}
        </div>
      ) : null}
      {distanceRows.length > 0 ? (
        <MovementTableCard
          favorites={favorites}
          language={language}
          measurementLabel={measurementLabel}
          onToggleFavorite={onToggleFavorite}
          snapshot={movementSnapshot}
          rows={distanceRows}
          tint={tint}
          title={it ? 'Distanze' : 'Distances'}
        />
      ) : null}
      {stairRows.length > 0 ? (
        <MovementTableCard
          favorites={favorites}
          language={language}
          measurementLabel={measurementLabel}
          onToggleFavorite={onToggleFavorite}
          snapshot={movementSnapshot}
          rows={stairRows}
          tint={tint}
          title={it ? 'Scale' : 'Stairs'}
        />
      ) : null}
      {gaitRows.length > 0 ? (
        <MovementTableCard
          favorites={favorites}
          language={language}
          measurementLabel={measurementLabel}
          onToggleFavorite={onToggleFavorite}
          snapshot={movementSnapshot}
          rows={gaitRows}
          tint={tint}
          title={it ? 'Andatura' : 'Gait'}
        />
      ) : null}
      {otherTypes.length > 0 ? <OtherDataRow language={language} measurementLabel={measurementLabel} types={otherTypes} /> : null}
    </>
  )
}
