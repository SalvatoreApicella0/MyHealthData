import { useMemo, useState } from 'react'
import { CalendarClock, Check, Coffee, FlaskConical, Plus, Search, Trash2 } from 'lucide-react'
import { createId } from '../core/id'
import { domainSpec } from '../core/canonicalDomains'
import { snapshotRecords } from '../core/healthModules'
import type { HealthModuleDefinition, HealthModuleId } from '../core/healthModules'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'
import { tintStyle } from './moduleViewSupport'

/* ------------------------------------------------------- canonical domains */

export interface CanonicalDomainConfig {
  key: string
  dateField: string
  titleFields: string[]
  detailFields: string[]
  icon: typeof CalendarClock
  tint: string
}

function readField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (value === null || value === undefined) {
    return undefined
  }
  if (typeof value === 'string') {
    return value.length > 160 ? `${value.slice(0, 157)}…` : value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return `${value.length} ×`
  }
  return undefined
}

function humanizeKey(key: string): string {
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function CanonicalDomainView({
  data,
  module,
  config,
}: {
  data: HealthDataController
  module: HealthModuleDefinition
  config: CanonicalDomainConfig
}) {
  const { t, language, formatDate } = useI18n()
  const [query, setQuery] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [recordId, setRecordId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)
  const snapshot = data as unknown as Record<string, unknown>
  const Icon = config.icon
  const spec = domainSpec(config.key)

  const records = useMemo(() => {
    const entries = snapshotRecords(snapshot, config.key)
    const sorted = [...entries].sort((left, right) => {
      const leftDate = readField(left, config.dateField) ?? ''
      const rightDate = readField(right, config.dateField) ?? ''
      return rightDate.localeCompare(leftDate)
    })
    if (!query.trim()) {
      return sorted
    }
    const needle = query.trim().toLowerCase()
    return sorted.filter((record) =>
      Object.values(record).some((value) => typeof value === 'string' && value.toLowerCase().includes(needle)),
    )
  }, [config.dateField, config.key, query, snapshot])

  const removeRecord = async (id: string): Promise<void> => {
    if (deletingId !== null) return
    setDeletingId(id)
    setDeleteError(null)
    try {
      await data.deleteCanonicalRecord(config.key, id)
    } catch {
      setDeleteError({ id, message: language === 'it' ? 'Impossibile eliminare il record. Riprova.' : 'Could not delete the record. Try again.' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="page-stack">
      <div className="banner banner--info">
        <Icon aria-hidden="true" size={18} />
        <span>
          <strong>{t('module.importedTitle')}. </strong>
          {t('module.importedBody')}
        </span>
      </div>

      {spec ? (
        <section className="panel module-add-panel">
          <div className="panel__header">
            <div>
              <h2>{t('module.addRecord')}</h2>
              <p>
                {language === 'it'
                  ? 'Il record usa gli stessi campi del modello iOS.'
                  : 'The record uses the same fields as the iOS model.'}
              </p>
            </div>
            <button
              aria-expanded={isAdding}
              className="btn btn--ghost btn--small"
              disabled={saving}
              onClick={() => {
                if (isAdding) {
                  setIsAdding(false)
                  return
                }
                // Prefill date/time fields with "now", like the iOS editors.
                const now = new Date()
                const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
                const defaults: Record<string, string> = {}
                for (const field of spec.fields) {
                  if (field.type === 'datetime') {
                    defaults[field.key] = localDateTime
                  } else if (field.type === 'date') {
                    defaults[field.key] = localDateTime.slice(0, 10)
                  }
                }
                setValues(defaults)
                setRecordId(createId(spec.idPrefix))
                setError('')
                setIsAdding(true)
              }}
              type="button"
            >
              <Plus size={15} />
              {isAdding ? t('common.close') : t('module.addRecord')}
            </button>
          </div>

          {isAdding ? (
            <form
              className="form-grid"
              onSubmit={async (event) => {
                event.preventDefault()
                if (saving) return
                setSaving(true)
                setError('')
                try {
                  const now = new Date().toISOString()
                  const record: Record<string, unknown> = {
                    id: recordId ?? createId(spec.idPrefix),
                    createdAt: now,
                    updatedAt: now,
                  }
                  for (const field of spec.fields) {
                    const raw = values[field.key]
                    if (field.type === 'boolean') {
                      record[field.key] = raw === 'true'
                    } else if (field.type === 'number') {
                      if (raw !== undefined && raw !== '') {
                        record[field.key] = Number(raw)
                      }
                    } else if (field.type === 'text-list') {
                      if (raw !== undefined && raw !== '') {
                        record[field.key] = raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
                      }
                    } else if (raw !== undefined && raw !== '') {
                      record[field.key] =
                        field.type === 'datetime' || field.type === 'date'
                          ? new Date(raw).toISOString()
                          : raw
                    }
                  }
                  await data.saveCanonicalRecord(config.key, record)
                  setValues({})
                  setRecordId(null)
                  setIsAdding(false)
                } catch {
                  setError(language === 'it' ? 'Impossibile salvare il record. Riprova.' : 'Could not save the record. Try again.')
                } finally {
                  setSaving(false)
                }
              }}
            >
              {error ? <p aria-live="polite" className="module-form-error full-width" role="alert">{error}</p> : null}
              {spec.fields.map((field) => (
                <label className={field.type === 'textarea' || field.type === 'text-list' ? 'full-width' : undefined} key={field.key}>
                  {language === 'it' ? field.it : field.en}
                  {field.suffix ? <span className="small-copy"> ({field.suffix})</span> : null}
                  {field.type === 'textarea' || field.type === 'text-list' ? (
                    <textarea
                      disabled={saving}
                      onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                      value={values[field.key] ?? ''}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      disabled={saving}
                      onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                      value={values[field.key] ?? ''}
                    >
                      <option value="">—</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option} value={option}>
                          {field.optionLabels?.[option]?.[language === 'it' ? 'it' : 'en'] ?? option}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'boolean' ? (
                    <input
                      checked={values[field.key] === 'true'}
                      disabled={saving}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, [field.key]: event.target.checked ? 'true' : 'false' }))
                      }
                      style={{ minHeight: 0, width: 'auto' }}
                      type="checkbox"
                    />
                  ) : (
                    <input
                      disabled={saving}
                      onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                      required={field.required}
                      type={
                        field.type === 'number'
                          ? 'number'
                          : field.type === 'date'
                            ? 'date'
                            : field.type === 'datetime'
                              ? 'datetime-local'
                              : 'text'
                      }
                      value={values[field.key] ?? ''}
                    />
                  )}
                </label>
              ))}
              <div className="form-actions full-width">
                <button className="btn btn--primary" disabled={saving} type="submit">
                  <Check size={16} />
                  {saving ? (language === 'it' ? 'Salvataggio…' : 'Saving…') : t('common.save')}
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      <div className="module-toolbar">
        <label style={{ maxWidth: 320 }}>
          <span className="visually-hidden">{language === 'it' ? 'Cerca' : 'Search'}</span>
          <span style={{ position: 'relative', display: 'block' }}>
            <Search aria-hidden="true" size={16} style={{ left: 12, opacity: 0.5, position: 'absolute', top: 13 }} />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder={language === 'it' ? 'Cerca nel modulo' : 'Search this module'}
              style={{ paddingLeft: 36 }}
              value={query}
            />
          </span>
        </label>
        <p className="small-copy">
          {records.length} {language === 'it' ? 'record canonici' : 'canonical records'}
        </p>
      </div>

      {records.length === 0 ? (
        <section className="panel">
          <p className="empty-state">{t('module.emptyTitle')}</p>
          <p className="small-copy" style={{ textAlign: 'center' }}>
            {t('module.emptyBody')}
          </p>
        </section>
      ) : (
        <section className="panel">
          <div className="list">
            {records.slice(0, 200).map((record, index) => {
              const title =
                config.titleFields.map((field) => readField(record, field)).find((value) => value) ??
                humanizeKey(config.key)
              const date = readField(record, config.dateField)
              const details = config.detailFields
                .map((field) => {
                  const value = readField(record, field)
                  return value ? `${humanizeKey(field)}: ${value}` : undefined
                })
                .filter(Boolean)
                .join(' · ')
              return (
                <div className="row" key={`${config.key}-${index}`} style={tintStyle(module.tint)}>
                  <span className="row__main">
                    <span className="row__title">{title}</span>
                    {details ? <span className="row__detail">{details}</span> : null}
                  </span>
                  <span className="row__side">
                    <span className="row__meta">{date ? formatDate(date, { dateStyle: 'medium' }) : ''}</span>
                    {typeof record.id === 'string' ? (
                      <button
                        aria-label={t('common.delete')}
                        className="btn btn--icon btn--danger"
                        disabled={deletingId !== null}
                        onClick={() => {
                          if (window.confirm(`${t('common.delete')}?`)) {
                            void removeRecord(String(record.id))
                          }
                        }}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                    {deleteError?.id === String(record.id) ? <span aria-live="polite" className="module-form-error" role="alert">{deleteError.message}</span> : null}
                  </span>
                </div>
              )
            })}
          </div>
          {records.length > 200 ? (
            <p className="small-copy" style={{ marginTop: 12 }}>
              {language === 'it' ? 'Mostrati i primi 200 record.' : 'Showing the first 200 records.'}
            </p>
          ) : null}
        </section>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ trends */

/** Maps a canonical module to its own view configuration. */
export const CANONICAL_CONFIGS: Partial<Record<HealthModuleId, CanonicalDomainConfig>> = {
  cycle: {
    key: 'cycleEntries',
    dateField: 'date',
    titleFields: ['flow', 'notes'],
    detailFields: ['flow', 'mood', 'symptoms'],
    icon: CalendarClock,
    tint: '#FF2D55',
  },
  sleep: {
    key: 'sleepSessions',
    dateField: 'startAt',
    titleFields: ['stage', 'source'],
    detailFields: ['endAt', 'quality', 'durationMinutes'],
    icon: CalendarClock,
    tint: '#5856D6',
  },
  nutrition: {
    key: 'foodLogEntries',
    dateField: 'loggedAt',
    titleFields: ['name', 'meal', 'title'],
    detailFields: ['meal', 'quantity', 'unit', 'energyKcal'],
    icon: Coffee,
    tint: '#34C759',
  },
  gym: {
    key: 'gymWorkouts',
    dateField: 'startedAt',
    titleFields: ['name', 'title', 'planId'],
    detailFields: ['endedAt', 'totalVolumeKg', 'notes'],
    icon: FlaskConical,
    tint: '#FF9500',
  },
  bloodwork: {
    key: 'labResults',
    dateField: 'collectedAt',
    titleFields: ['analyte', 'name', 'code'],
    detailFields: ['value', 'unit', 'referenceLow', 'referenceHigh'],
    icon: FlaskConical,
    tint: '#FF3B30',
  },
  medications: {
    key: 'medications',
    dateField: 'startedAt',
    titleFields: ['name', 'substance'],
    detailFields: ['dose', 'unit', 'schedule', 'active'],
    icon: FlaskConical,
    tint: '#FF9500',
  },
}
