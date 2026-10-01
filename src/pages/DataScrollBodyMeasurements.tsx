import { useMemo } from 'react'
import { getHealthModule } from '../core/healthModules'
import { lastValue } from '../core/metrics'
import { timeAgo } from '../core/timeAgo'
import type { MeasurementType } from '../core/types'
import type { HealthDataController } from '../storage/useHealthData'
import { MetricTile, OtherDataRow } from './DataScrollMetricViews'
import { MeasurementHistory } from './MeasurementHistory'
import {
  MAIN_BODY_METRICS,
  PAIRED_CIRCUMFERENCE_ZONES,
  UNPAIRED_CIRCUMFERENCE_TYPES,
} from './dataScrollModel'
import { SizesSection } from './sections/SizesSection'

function MeasurementCell({ latest, formatValue, language, measurementUnit, type }: {
  latest: ReturnType<typeof lastValue>
  formatValue: (value: number, unit: string) => string
  language: string
  measurementUnit: (rawValue: string) => string
  type: string
}) {
  if (latest?.value === undefined) return <span className="scroll-data__table-empty">—</span>
  return (
    <>
      <span className="scroll-data__table-value">{formatValue(latest.value, latest.unit || measurementUnit(type) || '')}</span>
      {latest.measuredAt ? <span className="scroll-data__table-time">{timeAgo(latest.measuredAt, language)}</span> : null}
    </>
  )
}

export function BodyMeasurementsSection({ data, favorites, formatValue, language, measurementLabel, measurementUnit, onToggleFavorite, snapshot, visibleTypes, windowDays }: {
  data: HealthDataController
  favorites: string[]
  formatValue: (value: number, unit: string) => string
  language: string
  measurementLabel: (rawValue: string) => string
  measurementUnit: (rawValue: string) => string
  onToggleFavorite: (id: string) => void
  snapshot: Record<string, unknown>
  visibleTypes?: MeasurementType[]
  windowDays: number
}) {
  const tint = getHealthModule('bodyMeasurements')?.tint ?? '#126E7A'
  const partition = visibleTypes === undefined
  const mainCandidates = useMemo(
    () => (visibleTypes ? MAIN_BODY_METRICS.filter((type) => visibleTypes.includes(type)) : MAIN_BODY_METRICS),
    [visibleTypes],
  )
  const unpairedCandidates = useMemo(
    () => UNPAIRED_CIRCUMFERENCE_TYPES.filter((type) => !visibleTypes || visibleTypes.includes(type)),
    [visibleTypes],
  )
  const mainTypes = useMemo(
    () => (partition ? mainCandidates.filter((type) => lastValue(snapshot, type)?.value !== undefined) : mainCandidates),
    [mainCandidates, partition, snapshot],
  )
  const pairedRows = useMemo(
    () => PAIRED_CIRCUMFERENCE_ZONES
      .filter((zone) => !visibleTypes || visibleTypes.includes(zone.type) || visibleTypes.includes(zone.left) || visibleTypes.includes(zone.right))
      .map((zone) => ({ zone, left: lastValue(snapshot, zone.left), right: lastValue(snapshot, zone.right) }))
      .filter(({ left, right }) => !partition || left?.value !== undefined || right?.value !== undefined),
    [partition, snapshot, visibleTypes],
  )
  const unpairedTypes = useMemo(
    () => (partition ? unpairedCandidates.filter((type) => lastValue(snapshot, type)?.value !== undefined) : unpairedCandidates),
    [partition, snapshot, unpairedCandidates],
  )
  const otherTypes = useMemo(
    () => (partition
      ? [
          ...mainCandidates.filter((type) => lastValue(snapshot, type)?.value === undefined),
          ...unpairedCandidates.filter((type) => lastValue(snapshot, type)?.value === undefined),
        ]
      : []),
    [mainCandidates, partition, snapshot, unpairedCandidates],
  )
  const hasRecordedMeasurement = mainTypes.length > 0 || pairedRows.length > 0 || unpairedTypes.length > 0

  return (
    <>
      {!hasRecordedMeasurement && partition ? (
        <p className="scroll-data__empty scroll-data__empty--compact">
          {language === 'it' ? 'Nessuna misura registrata. Inizia dal peso o da una circonferenza.' : 'No measurements yet. Start with weight or one circumference.'}
        </p>
      ) : null}
      {mainTypes.length > 0 ? (
        <div className="scroll-data__kpis scroll-data__kpis--body" data-dense="true">
          {mainTypes.map((type) => (
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
      {pairedRows.length > 0 ? (
        <div className="scroll-data__table-wrap">
          <table className="scroll-data__table">
            <thead>
              <tr>
                <th scope="col">{language === 'it' ? 'Zona' : 'Zone'}</th>
                <th scope="col">{language === 'it' ? 'Sinistra' : 'Left'}</th>
                <th scope="col">{language === 'it' ? 'Destra' : 'Right'}</th>
              </tr>
            </thead>
            <tbody>
              {pairedRows.map(({ zone, left, right }) => (
                <tr key={zone.id}>
                  <th scope="row">{measurementLabel(zone.type)}</th>
                  <td><MeasurementCell formatValue={formatValue} language={language} latest={left} measurementUnit={measurementUnit} type={zone.left} /><MeasurementHistory label={measurementLabel(zone.left)} language={language} snapshot={snapshot} type={zone.left} /></td>
                  <td><MeasurementCell formatValue={formatValue} language={language} latest={right} measurementUnit={measurementUnit} type={zone.right} /><MeasurementHistory label={measurementLabel(zone.right)} language={language} snapshot={snapshot} type={zone.right} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {unpairedTypes.length > 0 ? (
        <>
          <h3 className="scroll-data__subhead">{language === 'it' ? 'Circonferenze singole' : 'Single circumferences'}</h3>
          <div className="scroll-data__kpis scroll-data__kpis--body" data-dense="true">
            {unpairedTypes.map((type) => (
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
        </>
      ) : null}
      {otherTypes.length > 0 ? <OtherDataRow language={language} measurementLabel={measurementLabel} types={otherTypes} /> : null}
      <SizesSection data={data} language={language} />
    </>
  )
}
