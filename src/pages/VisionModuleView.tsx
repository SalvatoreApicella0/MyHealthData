import { useMemo, useState } from 'react'
import { Eye, Plus, Trash2 } from 'lucide-react'
import { createId } from '../core/id'
import { fromDateTimeLocal, toDateTimeLocal } from '../core/format'
import { getHealthModule } from '../core/healthModules'
import type { EventType, HealthEvent } from '../core/types'
import type { HealthAttachmentInput, HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'
import { tintStyle } from './moduleViews'
import './vision.css'

type Language = 'it' | 'en'

const VISION_EVENT_TYPE: EventType = 'vision_prescription'

interface VisionValue {
  label: string
  value: string
}

function tagValue(tags: string[], key: string): string | undefined {
  const prefix = `${key}=`
  const found = tags.find((tag) => tag.startsWith(prefix))
  if (!found) {
    return undefined
  }
  const value = found.slice(prefix.length).trim()
  return value.length > 0 ? value : undefined
}

const DESCRIPTION_KEYWORDS: Record<string, { it: string; en: string }> = {
  od: { it: 'OD', en: 'OD' },
  os: { it: 'OS', en: 'OS' },
  dx: { it: 'OD', en: 'OD' },
  sx: { it: 'OS', en: 'OS' },
  sfera: { it: 'Sfera', en: 'Sphere' },
  sphere: { it: 'Sfera', en: 'Sphere' },
  cilindro: { it: 'Cilindro', en: 'Cylinder' },
  cylinder: { it: 'Cilindro', en: 'Cylinder' },
  cil: { it: 'Cilindro', en: 'Cylinder' },
  asse: { it: 'Asse', en: 'Axis' },
  axis: { it: 'Asse', en: 'Axis' },
  add: { it: 'ADD', en: 'ADD' },
  pd: { it: 'PD', en: 'PD' },
}

/** Reads numbers the user actually typed, next to a known optometry keyword. */
function parseDescriptionValues(description: string, language: Language): VisionValue[] {
  const values: VisionValue[] = []
  const pattern = /([a-zA-Zàèéìòù]+)\s*[:=]?\s*([+-]?\d+(?:[.,]\d+)?\s*°?)/g
  let match = pattern.exec(description)
  while (match !== null) {
    const keyword = match[1]?.toLowerCase()
    const value = match[2]?.trim()
    const keywordLabel = keyword ? DESCRIPTION_KEYWORDS[keyword] : undefined
    if (keywordLabel && value) {
      values.push({ label: language === 'it' ? keywordLabel.it : keywordLabel.en, value })
    }
    match = pattern.exec(description)
  }
  return values
}

function prescriptionValues(event: HealthEvent, language: Language): VisionValue[] {
  const it = language === 'it'
  const values: VisionValue[] = []
  const seen = new Set<string>()
  const add = (label: string, value: string | undefined) => {
    if (!value) {
      return
    }
    const key = `${label}|${value}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    values.push({ label, value })
  }

  // Canonical iOS records keep the measured values in tags.
  add(it ? 'Uso' : 'Use', tagValue(event.tags, 'kind'))
  add(`OD ${it ? 'sfera' : 'sphere'}`, tagValue(event.tags, 'rs'))
  add(`OD ${it ? 'cilindro' : 'cylinder'}`, tagValue(event.tags, 'rc'))
  add(`OD ${it ? 'asse' : 'axis'}`, tagValue(event.tags, 'ra'))
  add(`OS ${it ? 'sfera' : 'sphere'}`, tagValue(event.tags, 'ls'))
  add(`OS ${it ? 'cilindro' : 'cylinder'}`, tagValue(event.tags, 'lc'))
  add(`OS ${it ? 'asse' : 'axis'}`, tagValue(event.tags, 'la'))
  add('ADD', tagValue(event.tags, 'add'))
  add('PD', tagValue(event.tags, 'pd'))

  // Web records keep free text: only surface numbers that follow a known word.
  for (const item of parseDescriptionValues(event.description, language)) {
    add(item.label, item.value)
  }

  return values
}

function excerpt(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

function isIssue(event: HealthEvent): boolean {
  return event.tags.some((tag) => tag === 'record=issue')
}

export function VisionModuleView({ data }: { data: HealthDataController }) {
  const { t, language, formatDate } = useI18n()
  const module = getHealthModule('vision')
  const [description, setDescription] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => toDateTimeLocal(new Date().toISOString()))
  const [attachmentFiles, setAttachmentFiles] = useState<HealthAttachmentInput[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)

  const prescriptions = useMemo(
    () =>
      data.events
        .filter((event) => event.type === VISION_EVENT_TYPE && !isIssue(event))
        .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()),
    [data.events],
  )

  const latest = prescriptions[0]
  const previous = prescriptions.slice(1)

  const handleSubmit = async (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    if (!description.trim()) {
      return
    }
    setSaveError('')
    setSaving(true)
    try {
      const now = new Date().toISOString()
      await data.saveEvent({
        id: createId('event'),
        type: VISION_EVENT_TYPE,
        occurredAt: fromDateTimeLocal(occurredAt),
        description: description.trim(),
        tags: [],
        attachments: attachmentFiles.map(({ metadata }) => metadata),
        createdAt: now,
        updatedAt: now,
      }, attachmentFiles)
      setDescription('')
      setAttachmentFiles([])
    } catch {
      setSaveError(
        language === 'it'
          ? 'Impossibile salvare la prescrizione. Riprova.'
          : 'The prescription could not be saved. Try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  const removePrescription = async (id: string) => {
    if (deletingId !== null) {
      return
    }
    setDeletingId(id)
    setDeleteError(null)
    try {
      await data.deleteEvent(id)
    } catch {
      setDeleteError({
        id,
        message: language === 'it' ? 'Impossibile eliminare la prescrizione. Riprova.' : 'The prescription could not be deleted. Try again.',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const latestValues = latest ? prescriptionValues(latest, language) : []

  return (
    <section className="page-stack">
      {latest ? (
        <>
          <article className="metric-card vision-latest" style={tintStyle(module.tint)}>
            <div className="metric-card__head">
              <span className="metric-card__title">
                <span className="icon-orb" style={tintStyle(module.tint)}>
                  <Eye aria-hidden="true" size={18} />
                </span>
                <h3>{language === 'it' ? 'Ultima prescrizione' : 'Latest prescription'}</h3>
              </span>
              <button
                aria-label={t('common.delete')}
                className="btn btn--icon btn--danger"
                onClick={() => {
                  if (window.confirm(`${t('common.delete')}?`)) {
                    void removePrescription(latest.id)
                  }
                }}
                disabled={deletingId !== null}
                type="button"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {deleteError?.id === latest.id ? (
              <p className="module-form-error" role="alert">
                {deleteError.message}
              </p>
            ) : null}

            <p className="vision-latest__date">{formatDate(latest.occurredAt, { dateStyle: 'long' })}</p>
            <p className="vision-latest__text">{latest.description}</p>

            {latestValues.length > 0 ? (
              <div className="chip-row">
                {latestValues.map((value) => (
                  <span className="chip vision-value" key={`${value.label}-${value.value}`}>
                    {value.label} {value.value}
                  </span>
                ))}
              </div>
            ) : null}

            {latest.attachments.length > 0 ? (
              <div className="chip-row">
                {latest.attachments.map((attachment) => (
                  <span className="chip" key={attachment.id}>
                    {attachment.name}
                  </span>
                ))}
              </div>
            ) : null}
          </article>

          {previous.length > 0 ? (
            <section className="panel">
              <div className="panel__header">
                <h2>{language === 'it' ? 'Prescrizioni precedenti' : 'Previous prescriptions'}</h2>
                <span className="tag">{previous.length}</span>
              </div>
              <div className="list">
                {previous.map((event) => (
                  <div className="row" key={event.id}>
                    <span className="row__main">
                      <span className="row__title">{formatDate(event.occurredAt, { dateStyle: 'medium' })}</span>
                      <span className="row__detail">{excerpt(event.description)}</span>
                    </span>
                    <span className="row__side">
                      <span className="row__meta">
                        {event.attachments.length > 0
                          ? `${event.attachments.length} ${language === 'it' ? 'allegati' : 'attachments'}`
                          : ''}
                      </span>
                      <button
                        aria-label={t('common.delete')}
                        className="btn btn--icon btn--danger"
                        onClick={() => {
                          if (window.confirm(`${t('common.delete')}?`)) {
                            void removePrescription(event.id)
                          }
                        }}
                        disabled={deletingId !== null}
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                      {deleteError?.id === event.id ? (
                        <span className="module-form-error" role="alert">
                          {deleteError.message}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <p className="empty-state">
          {language === 'it'
            ? 'Nessuna prescrizione registrata. Usa Aggiungi per inserirla.'
            : 'No prescriptions yet. Use Add to record one.'}
        </p>
      )}

      <section className="panel module-add-panel" id="module-add-record">
        <div className="panel__header">
          <div>
            <h2>{language === 'it' ? 'Nuova prescrizione' : 'New prescription'}</h2>
            <p>
              {language === 'it'
                ? 'Testo e allegati restano nel vault locale di questo browser.'
                : 'Text and attachments stay in this browser vault.'}
            </p>
          </div>
        </div>
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="full-width">
            {language === 'it' ? 'Prescrizione' : 'Prescription'}
            <textarea
              required
              value={description}
              onChange={(changeEvent) => setDescription(changeEvent.target.value)}
              placeholder={language === 'it' ? 'Es. OD -1.50 sfera, cil -0.75 asse 90' : 'e.g. OD -1.50 sphere, cyl -0.75 axis 90'}
            />
          </label>
          <label>
            {t('common.dateTime')}
            <input
              required
              type="datetime-local"
              value={occurredAt}
              onChange={(changeEvent) => setOccurredAt(changeEvent.target.value)}
            />
          </label>
          <label className="full-width">
            {language === 'it' ? 'Allegati' : 'Attachments'}
            <input
              multiple
              type="file"
              onChange={(changeEvent) => {
                const files = Array.from(changeEvent.target.files ?? [])
                setAttachmentFiles(files.map((file) => ({
                  metadata: {
                    id: createId('attachment'),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified,
                  },
                  file,
                })))
              }}
            />
          </label>
          {attachmentFiles.length > 0 ? (
            <p className="form-note full-width">
              {attachmentFiles.map(({ metadata }) => metadata.name).join(', ')}
            </p>
          ) : null}
          {saveError ? (
            <p className="module-form-error full-width" role="alert">
              {saveError}
            </p>
          ) : null}
          <div className="form-actions full-width">
            <button className="btn btn--primary" disabled={saving || !description.trim()} type="submit">
              <Plus size={17} />
              {t('common.save')}
            </button>
          </div>
        </form>
      </section>
    </section>
  )
}
