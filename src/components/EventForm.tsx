import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CircleAlert,
  CircleHelp,
  Cross,
  Expand,
  Flame,
  Lock,
  Sparkles,
  StickyNote,
  Waves,
  Zap,
} from 'lucide-react'
import { BODY_REGIONS } from '../core/bodyRegions'
import { applyEventValues, type EventFormValues } from '../core/eventPatch'
import { fromDateTimeLocal, joinTags, splitTags, toDateTimeLocal } from '../core/format'
import { SYMPTOM_PRESETS } from '../core/symptomPresets'
import type { AttachmentMetadata, BodyPoint, BodyRegionId, EventType, HealthEvent } from '../core/types'
import { createId } from '../core/id'
import { WEB_BODY_MODEL_VERSION } from '../body3d/eventMarkers'
import { useI18n } from '../i18n'
import type { HealthAttachmentInput } from '../storage/useHealthData'

const SYMPTOM_TYPE_IDS: EventType[] = [
  'pain',
  'discomfort',
  'burning',
  'swelling',
  'stiffness',
  'tingling',
  'wound',
  'general_symptom',
  'note',
  'other',
]

const TYPE_ICONS: Record<string, JSX.Element> = {
  pain: <Zap size={16} />,
  discomfort: <Waves size={16} />,
  burning: <Flame size={16} />,
  swelling: <Expand size={16} />,
  stiffness: <Lock size={16} />,
  tingling: <Sparkles size={16} />,
  wound: <Cross size={16} />,
  general_symptom: <CircleAlert size={16} />,
  note: <StickyNote size={16} />,
  other: <CircleHelp size={16} />,
}

const DURATION_CHIPS = [
  { minutes: 5, labelKey: 'symptom.duration.5' },
  { minutes: 30, labelKey: 'symptom.duration.30' },
  { minutes: 60, labelKey: 'symptom.duration.60' },
  { minutes: 120, labelKey: 'symptom.duration.120' },
  { minutes: 1440, labelKey: 'symptom.duration.day' },
]

const INTENSITY_WORDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface EventFormProps {
  regionId?: BodyRegionId
  point?: BodyPoint
  event?: HealthEvent
  onSave: (event: HealthEvent, attachments?: HealthAttachmentInput[]) => Promise<void>
  onCancel?: () => void
}

export function EventForm({ regionId, point, event, onSave, onCancel }: EventFormProps) {
  const { t } = useI18n()
  const [type, setType] = useState<EventType>(event?.type ?? 'pain')
  const [bodyRegionId, setBodyRegionId] = useState<BodyRegionId | ''>(event?.bodyRegionId ?? regionId ?? '')
  const [bodyPoint, setBodyPoint] = useState<BodyPoint | undefined>(point ?? event?.bodyPoint)
  const [occurredAt, setOccurredAt] = useState(toDateTimeLocal(event?.occurredAt ?? new Date().toISOString()))
  const [intensity, setIntensity] = useState<number | undefined>(event?.intensity)
  const [durationMinutes, setDurationMinutes] = useState(event?.durationMinutes?.toString() ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [suspectedTrigger, setSuspectedTrigger] = useState(event?.suspectedTrigger ?? '')
  const [helpedBy, setHelpedBy] = useState(event?.helpedBy ?? '')
  const [tags, setTags] = useState(event ? joinTags(event.tags) : '')
  const [attachments, setAttachments] = useState<AttachmentMetadata[]>(event?.attachments ?? [])
  const [attachmentFiles, setAttachmentFiles] = useState<HealthAttachmentInput[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setBodyPoint(point ?? event?.bodyPoint)
  }, [point, event])

  useEffect(() => {
    if (!event && window.matchMedia?.('(min-width: 1024px)').matches) {
      descriptionRef.current?.focus()
    }
  }, [event])

  useEffect(() => {
    const onKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const descriptionError = touched && description.trim().length === 0
  const tagsPreview = useMemo(() => splitTags(tags), [tags])

  const applyPreset = (presetId: string) => {
    const preset = SYMPTOM_PRESETS.find((candidate) => candidate.id === presetId)
    if (!preset) return
    setType(preset.type)
    if (preset.regionId) setBodyRegionId(preset.regionId)
    setDescription(t(preset.descriptionKey))
  }

  const handleSubmit = async (formEvent: React.FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    setTouched(true)
    if (description.trim().length === 0) {
      descriptionRef.current?.focus()
      return
    }
    setSaveError('')
    setSaving(true)
    const values: EventFormValues = {
      type,
      bodyRegionId: bodyRegionId || undefined,
      occurredAt: fromDateTimeLocal(occurredAt),
      intensity,
      durationMinutes: durationMinutes === '' ? undefined : Number(durationMinutes),
      description: description.trim(),
      suspectedTrigger: suspectedTrigger.trim() || undefined,
      helpedBy: helpedBy.trim() || undefined,
      tags: splitTags(tags),
      attachments,
    }
    try {
      await onSave(applyEventValues(event, values, bodyPoint, new Date().toISOString()), attachmentFiles)
    } catch {
      setSaveError(t('symptom.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="symptom-form" noValidate onSubmit={handleSubmit}>
      <header className="symptom-form__header">
        <div>
          <h2>{event ? t('symptom.editTitle') : t('symptom.newTitle')}</h2>
          <p className="small-copy">
            {bodyRegionId ? t(`region.${bodyRegionId}`) : t('symptom.noRegion')}
            {bodyPoint?.modelVersion === WEB_BODY_MODEL_VERSION ? ` · ${t('symptom.precisePoint')}` : ''}
          </p>
        </div>
      </header>

      <p className="symptom-form__hint">{t('symptom.formHint')}</p>

      <section aria-label={t('symptom.presets')} className="symptom-presets">
        {SYMPTOM_PRESETS.map((preset) => (
          <button
            className="chip"
            key={preset.id}
            onClick={() => applyPreset(preset.id)}
            type="button"
          >
            {t(`symptom.preset.${preset.id}`)}
          </button>
        ))}
      </section>

      <fieldset className="symptom-types">
        <legend>{t('symptom.type')}</legend>
        {SYMPTOM_TYPE_IDS.map((id) => (
          <button
            aria-pressed={type === id}
            className="symptom-type"
            key={id}
            onClick={() => setType(id)}
            type="button"
          >
            {TYPE_ICONS[id] ?? <CircleHelp size={16} />}
            <span>{t(`event.${id}`)}</span>
          </button>
        ))}
      </fieldset>

      <div className="symptom-row">
        <label>
          {t('symptom.when')}
          <input required type="datetime-local" value={occurredAt} onChange={(event_) => setOccurredAt(event_.target.value)} />
        </label>
        <button className="btn btn--small btn--ghost" onClick={() => setOccurredAt(toDateTimeLocal(new Date().toISOString()))} type="button">
          {t('symptom.now')}
        </button>
      </div>

      <label className="symptom-intensity">
        <span>
          {t('symptom.intensity')}
          <output>{intensity ?? '—'}</output>
        </span>
        <input
          aria-valuetext={intensity === undefined ? t('symptom.intensityUnset') : String(intensity)}
          max="10"
          min="0"
          onChange={(event_) => setIntensity(Number(event_.target.value))}
          step="1"
          type="range"
          value={intensity ?? 0}
        />
        <span className="symptom-intensity__scale">
          <em>{t('symptom.intensityLow')}</em>
          <em>{INTENSITY_WORDS.length - 1}</em>
          <em>{t('symptom.intensityHigh')}</em>
        </span>
        {intensity !== undefined ? (
          <button className="btn btn--small btn--ghost" onClick={() => setIntensity(undefined)} type="button">
            {t('symptom.intensityClear')}
          </button>
        ) : null}
      </label>

      <label>
        {t('symptom.duration')}
        <input
          inputMode="numeric"
          min="0"
          onChange={(event_) => setDurationMinutes(event_.target.value)}
          placeholder={t('common.optional')}
          type="number"
          value={durationMinutes}
        />
      </label>
      <div className="symptom-presets">
        {DURATION_CHIPS.map((chip) => (
          <button
            className="chip"
            key={chip.minutes}
            onClick={() => setDurationMinutes(String(chip.minutes))}
            type="button"
          >
            {t(chip.labelKey)}
          </button>
        ))}
      </div>

      <label className={descriptionError ? 'symptom-field--error' : undefined}>
        {t('symptom.description')}
        <textarea
          onChange={(event_) => setDescription(event_.target.value)}
          placeholder={t('symptom.descriptionPlaceholder')}
          ref={descriptionRef}
          required
          value={description}
        />
        {descriptionError ? <span className="form-note">{t('symptom.descriptionRequired')}</span> : null}
      </label>

      <button
        aria-expanded={detailsOpen}
        className="btn btn--ghost btn--small"
        onClick={() => setDetailsOpen((value) => !value)}
        type="button"
      >
        <span>{detailsOpen ? t('symptom.detailsHide') : t('symptom.details')}</span>
        <span aria-hidden="true" className="symptom-details-toggle__mark">{detailsOpen ? '−' : '+'}</span>
      </button>

      {detailsOpen ? (
        <div className="symptom-details">
          <label>
            {t('symptom.region')}
            <select
              value={bodyRegionId}
              onChange={(event_) => {
                setBodyRegionId(event_.target.value as BodyRegionId | '')
                setBodyPoint(undefined)
              }}
            >
              <option value="">{t('symptom.noRegion')}</option>
              {BODY_REGIONS.map((region) => (
                <option key={region.id} value={region.id}>
                  {t(`region.${region.id}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('symptom.trigger')}
            <input value={suspectedTrigger} onChange={(event_) => setSuspectedTrigger(event_.target.value)} />
          </label>
          <label>
            {t('symptom.helpedBy')}
            <input value={helpedBy} onChange={(event_) => setHelpedBy(event_.target.value)} />
          </label>
          <label>
            {t('symptom.tags')}
            <input onChange={(event_) => setTags(event_.target.value)} placeholder={t('symptom.tagsPlaceholder')} value={tags} />
          </label>
          {tagsPreview.length > 0 ? (
            <div className="chip-row">
              {tagsPreview.map((tag) => (
                <span className="chip" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          <label>
            {t('symptom.attachments')}
            <input
              multiple
              onChange={(event_) => {
                const files = Array.from(event_.target.files ?? [])
                const inputs = files.map((file) => ({
                  metadata: {
                    id: createId('attachment'),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    lastModified: file.lastModified,
                  },
                  file,
                }))
                setAttachmentFiles(inputs)
                setAttachments(inputs.map(({ metadata }) => metadata))
              }}
              type="file"
            />
          </label>
          {attachments.length > 0 ? (
            <p className="form-note">{t('symptom.attachmentsNote')}: {attachments.map((attachment) => attachment.name).join(', ')}</p>
          ) : null}
        </div>
      ) : null}

      {saveError ? <p aria-live="polite" className="module-form-error" role="alert">{saveError}</p> : null}

      <div className="form-actions">
        {onCancel ? (
          <button className="btn btn--ghost" onClick={onCancel} type="button">
            {t('common.cancel')}
          </button>
        ) : null}
        <button className="btn btn--primary" disabled={saving} type="submit">
          {event ? t('common.save') : t('symptom.add')}
        </button>
      </div>
    </form>
  )
}
