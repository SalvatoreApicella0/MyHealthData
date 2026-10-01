import { useMemo, useState } from 'react'
import { MetricChart } from '../components/MetricChart'
import { dailyAggregates } from '../core/metrics'
import type { HealthModuleDefinition } from '../core/healthModules'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'
import { tintStyle } from './moduleViewSupport'

/* ------------------------------------------------------------------ trends */

const TREND_TYPES = [
  'weight',
  'body_fat_percentage',
  'step_count',
  'heart_rate',
  'resting_heart_rate',
  'heart_rate_variability',
  'oxygen_saturation',
  'sleep_hours',
  'active_energy_burned',
  'dietary_water',
  'blood_glucose',
  'systolic_pressure',
]

export function TrendsModuleView({ data, module }: { data: HealthDataController; module: HealthModuleDefinition }) {
  const { t, measurementLabel } = useI18n()
  const snapshot = data as unknown as Record<string, unknown>
  const [windowDays, setWindowDays] = useState(90)

  const cards = useMemo(
    () =>
      TREND_TYPES.map((type) => ({ type, series: dailyAggregates(snapshot, type, windowDays) })).filter(
        (card) => card.series.length > 1,
      ),
    [snapshot, windowDays],
  )

  return (
    <section className="page-stack">
      <div className="module-toolbar">
        <div className="segmented" role="group">
          {[30, 90, 365].map((days) => (
            <button aria-pressed={windowDays === days} key={days} onClick={() => setWindowDays(days)} type="button">
              {days}d
            </button>
          ))}
        </div>
      </div>
      {cards.length === 0 ? (
        <p className="empty-state">{t('common.none')}</p>
      ) : (
        <div className="metric-grid">
          {cards.map((card) => (
            <article className="metric-card" key={card.type} style={tintStyle(module.tint)}>
              <div className="metric-card__head">
                <h3>{measurementLabel(card.type)}</h3>
              </div>
              <MetricChart
                label={measurementLabel(card.type)}
                points={card.series.map((entry) => ({ at: new Date(entry.day).getTime(), value: entry.value }))}
                tint={module.tint}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
