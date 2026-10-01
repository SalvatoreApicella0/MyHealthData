import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Coffee, Droplet, Plus, Wine } from 'lucide-react'
import { MetricChart } from '../components/MetricChart'
import type { HealthModuleDefinition, MeasurementModuleId } from '../core/healthModules'
import {
  dailyAggregates,
  formatDelta,
  formatValue,
  isCumulativeMeasurement,
  measurementRecords,
} from '../core/metrics'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'
import { tintStyle, toDateTimeLocalValue, useSaveMeasurement } from './moduleViewSupport'

export function MeasurementModuleView({
  data,
  module,
  types,
  quickAddTypes = [],
}: {
  data: HealthDataController
  module: HealthModuleDefinition
  types: string[]
  quickAddTypes?: MeasurementModuleId[]
}) {
  const { t, language, measurementLabel, measurementUnit } = useI18n()
  const snapshot = data as unknown as Record<string, unknown>
  const [windowDays, setWindowDays] = useState(30)
  const [formType, setFormType] = useState(types[0] ?? 'weight')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [when, setWhen] = useState(() => toDateTimeLocalValue(new Date().toISOString()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [quickAction, setQuickAction] = useState<string | null>(null)
  const saveMeasurement = useSaveMeasurement(data)

  const cards = useMemo(
    () =>
      types.map((type) => {
        const series = dailyAggregates(snapshot, type, windowDays)
        const records = measurementRecords(snapshot, type)
        const latest = records.at(-1)
        const previous = records.length > 1 ? records.at(-2) : undefined
        return {
          type,
          series,
          latest,
          delta: latest && previous ? latest.value - previous.value : undefined,
          count: records.length,
        }
      }),
    [snapshot, types, windowDays],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsedValue = Number(value.replace(',', '.'))
    if (!value.trim() || !Number.isFinite(parsedValue)) {
      setError(language === 'it' ? 'Inserisci un numero valido.' : 'Enter a valid number.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await saveMeasurement(formType, parsedValue, measurementUnit(formType) || 'unit', when, note.trim() || undefined)
      setValue('')
      setNote('')
    } catch {
      setError(language === 'it' ? 'Impossibile salvare la misura. Riprova.' : 'Could not save the measurement. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const quickAdd = async (type: string, amount: number): Promise<void> => {
    if (quickAction !== null) return
    const key = `${type}:${amount}`
    setQuickAction(key)
    setError('')
    try {
      await saveMeasurement(type, amount, measurementUnit(type) || 'unit', new Date().toISOString())
    } catch {
      setError(language === 'it' ? 'Impossibile registrare il dato rapido. Riprova.' : 'Could not record the quick entry. Try again.')
    } finally {
      setQuickAction(null)
    }
  }

  return (
    <section className="page-stack">
      <div className="module-toolbar">
        <div className="segmented" role="group" aria-label={language === 'it' ? 'Intervallo' : 'Range'}>
          {[7, 30, 365].map((days) => (
            <button aria-pressed={windowDays === days} key={days} onClick={() => setWindowDays(days)} type="button">
              {days === 7 ? t('common.week') : days === 30 ? t('common.month') : t('common.year')}
            </button>
          ))}
        </div>
        <p className="small-copy">
          {language === 'it'
            ? `${cards.reduce((total, card) => total + card.count, 0)} misure in questo modulo`
            : `${cards.reduce((total, card) => total + card.count, 0)} measurements in this module`}
        </p>
      </div>

      {quickAddTypes.includes('hydration') ? (
        <div className="chip-row">
          <button className="btn btn--tinted btn--small" disabled={quickAction !== null} onClick={() => void quickAdd('dietary_water', 250)} style={tintStyle('#00ADB8')} type="button">
            <Droplet size={15} /> +250 mL
          </button>
          <button className="btn btn--tinted btn--small" disabled={quickAction !== null} onClick={() => void quickAdd('dietary_water', 500)} style={tintStyle('#00ADB8')} type="button">
            <Droplet size={15} /> +500 mL
          </button>
          <button className="btn btn--tinted btn--small" disabled={quickAction !== null} onClick={() => void quickAdd('dietary_caffeine', 80)} style={tintStyle('#F7AB45')} type="button">
            <Coffee size={15} /> {language === 'it' ? 'Caffè (80 mg)' : 'Coffee (80 mg)'}
          </button>
          <button className="btn btn--tinted btn--small" disabled={quickAction !== null} onClick={() => void quickAdd('alcohol_units', 1)} style={tintStyle('#6161EB')} type="button">
            <Wine size={15} /> {language === 'it' ? '1 unità alcolica' : '1 alcohol unit'}
          </button>
        </div>
      ) : null}
      {error ? <p aria-live="polite" className="module-form-error" role="alert">{error}</p> : null}

      <div className="metric-grid">
        {cards.map((card) => (
          <article className="metric-card" key={card.type} style={tintStyle(module.tint)}>
            <div className="metric-card__head">
              <span className="metric-card__title">
                <span className="icon-orb" style={tintStyle(module.tint)}>
                  <module.icon aria-hidden="true" size={18} />
                </span>
                <h3>{measurementLabel(card.type)}</h3>
              </span>
              <button
                aria-label={`${t('module.addRecord')}: ${measurementLabel(card.type)}`}
                className="btn btn--icon btn--ghost"
                onClick={() => {
                  setFormType(card.type)
                  window.dispatchEvent(new CustomEvent('mhd:open-add', { detail: module.id }))
                }}
                type="button"
              >
                <Plus size={16} />
              </button>
            </div>
            <p className="metric-card__value">
              {card.latest ? formatValue(card.latest.value, '') : '—'}
              <small>{card.latest?.unit ?? measurementUnit(card.type)}</small>
            </p>
            <div className="metric-card__meta">
              <span>
                {card.count} {language === 'it' ? 'record' : 'records'}
              </span>
              {card.delta !== undefined ? (
                <span>
                  Δ {formatDelta(card.delta)} {card.latest?.unit ?? ''}
                </span>
              ) : null}
              {isCumulativeMeasurement(card.type) ? <span>{language === 'it' ? 'totale/giorno' : 'daily total'}</span> : null}
            </div>
            {card.series.length > 1 ? (
              <MetricChart
                label={measurementLabel(card.type)}
                points={card.series.map((entry) => ({ at: new Date(entry.day).getTime(), value: entry.value }))}
                tint={module.tint}
              />
            ) : (
              <div className="chart-empty">{t('common.none')}</div>
            )}
          </article>
        ))}
      </div>

      <section className="panel module-add-panel" id="module-add-record">
        <div className="panel__header">
          <div>
            <h2>{t('module.addRecord')}</h2>
            <p>{language === 'it' ? 'Il record resta nel vault locale di questo browser.' : 'The record stays in this browser vault.'}</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            {t('common.type')}
            <select onChange={(event) => setFormType(event.target.value)} value={formType}>
              {types.map((type) => (
                <option key={type} value={type}>
                  {measurementLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('common.value')}
            <input inputMode="decimal" onChange={(event) => setValue(event.target.value)} value={value} />
          </label>
          <label>
            {t('common.unit')}
            <input readOnly value={measurementUnit(formType)} />
          </label>
          <label>
            {t('common.dateTime')}
            <input onChange={(event) => setWhen(event.target.value)} type="datetime-local" value={when} />
          </label>
          <label className="full-width">
            {t('common.note')} <span className="small-copy">({t('common.optional')})</span>
            <textarea onChange={(event) => setNote(event.target.value)} value={note} />
          </label>
          <div className="form-actions full-width">
            <button className="btn btn--primary" disabled={saving || !value.trim()} type="submit">
              <Check size={17} />
              {t('common.save')}
            </button>
          </div>
        </form>
      </section>
    </section>
  )
}
