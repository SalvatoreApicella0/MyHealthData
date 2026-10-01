import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createId } from '../core/id'
import { moduleCopy } from '../core/healthModules'
import type { HealthModuleDefinition } from '../core/healthModules'
import type { EventType } from '../core/types'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'
import { tintStyle, toDateTimeLocalValue } from './moduleViewSupport'

/* ------------------------------------------------------------------- events */

export function EventModuleView({
  data,
  module,
  eventType,
}: {
  data: HealthDataController
  module: HealthModuleDefinition
  eventType: string
}) {
  const { t, language, formatDate } = useI18n()
  const [description, setDescription] = useState('')
  const [intensity, setIntensity] = useState('5')
  const [occurredAt, setOccurredAt] = useState(() => toDateTimeLocalValue(new Date().toISOString()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)

  const events = useMemo(
    () =>
      data.events
        .filter((event) => event.type === eventType)
        .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()),
    [data.events, eventType],
  )

  const handleSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    if (!description.trim()) {
      return
    }
    setError('')
    setSaving(true)
    try {
      const now = new Date().toISOString()
      await data.saveEvent({
        id: createId('event'),
        type: eventType as EventType,
        occurredAt: new Date(occurredAt).toISOString(),
        intensity: intensity === '' ? undefined : Number(intensity),
        description: description.trim(),
        tags: [],
        attachments: [],
        createdAt: now,
        updatedAt: now,
      })
      setDescription('')
    } catch {
      setError(language === 'it' ? 'Impossibile salvare l’episodio. Riprova.' : 'Could not save the episode. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const removeEvent = async (id: string): Promise<void> => {
    if (deletingId !== null) return
    setDeletingId(id)
    setDeleteError(null)
    try {
      await data.deleteEvent(id)
    } catch {
      setDeleteError({ id, message: language === 'it' ? 'Impossibile eliminare l’episodio. Riprova.' : 'Could not delete the episode. Try again.' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="page-stack">
      <div className="three-column">
        <article className="widget" style={tintStyle(module.tint)}>
          <span className="widget__label">{language === 'it' ? 'Record totali' : 'Total records'}</span>
          <p className="widget__value">{events.length}</p>
        </article>
        <article className="widget" style={tintStyle(module.tint)}>
          <span className="widget__label">{language === 'it' ? 'Ultimo' : 'Latest'}</span>
          <p className="widget__value" style={{ fontSize: 18 }}>
            {events[0] ? formatDate(events[0].occurredAt) : '—'}
          </p>
        </article>
        <article className="widget" style={tintStyle(module.tint)}>
          <span className="widget__label">{language === 'it' ? 'Intensità media' : 'Average intensity'}</span>
          <p className="widget__value">
            {events.length > 0
              ? (events.reduce((total, event) => total + (event.intensity ?? 0), 0) / events.length).toFixed(1)
              : '—'}
          </p>
        </article>
      </div>

      <section className="panel module-add-panel">
        <div className="panel__header">
          <div>
            <h2>
              {t(`event.${eventType}`) === `event.${eventType}`
                ? moduleCopy(module.id, language).title
                : t(`event.${eventType}`)}
            </h2>
            <p>{language === 'it' ? 'Registra un nuovo episodio.' : 'Record a new episode.'}</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="full-width">
            {language === 'it' ? 'Descrizione' : 'Description'}
            <textarea onChange={(event) => setDescription(event.target.value)} required value={description} />
          </label>
          {error ? <p aria-live="polite" className="module-form-error full-width" role="alert">{error}</p> : null}
          <label>
            {language === 'it' ? 'Intensità (0-10)' : 'Intensity (0-10)'}
            <input max={10} min={0} onChange={(event) => setIntensity(event.target.value)} type="range" value={intensity} />
            <span className="small-copy">{intensity}/10</span>
          </label>
          <label>
            {t('common.dateTime')}
            <input onChange={(event) => setOccurredAt(event.target.value)} type="datetime-local" value={occurredAt} />
          </label>
          <div className="form-actions full-width">
            <button className="btn btn--primary" disabled={saving || !description.trim()} type="submit">
              <Plus size={17} />
              {t('common.save')}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>{t('module.history')}</h2>
        </div>
        {events.length === 0 ? (
          <p className="empty-state">{t('module.emptyTitle')}</p>
        ) : (
          <div className="list">
            {events.map((event) => (
              <div className="row" key={event.id}>
                <span className="row__main">
                  <span className="row__title">{event.description}</span>
                  <span className="row__detail">
                    {event.intensity !== undefined ? `${language === 'it' ? 'Intensità' : 'Intensity'} ${event.intensity}/10 · ` : ''}
                    {formatDate(event.occurredAt, { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </span>
                <span className="row__side">
                  <button
                    aria-label={t('common.delete')}
                    className="btn btn--icon btn--danger"
                    disabled={deletingId !== null}
                    onClick={() => void removeEvent(event.id)}
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                  {deleteError?.id === event.id ? <span aria-live="polite" className="module-form-error" role="alert">{deleteError.message}</span> : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
