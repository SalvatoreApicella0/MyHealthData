import { ProgressiveHistory } from '../../components/ProgressiveHistory'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, MapPin, Plus, Trash2 } from 'lucide-react'
import { EntrySheet } from '../../components/EntrySheet'
import { createId } from '../../core/id'
import { eventSubsetSignature } from '../../core/eventSignatures'
import type { HealthEvent } from '../../core/types'
import type { HealthDataController } from '../../storage/useHealthData'
import { loadVerifiedAttachment } from '../../storage/attachmentAccess'
import { useI18n } from '../../i18n'
import { BodyPainFlow } from './BodyPainFlow'
import {
  COPY,
  PAIN_TYPES,
  RECENT_WINDOW_MS,
  emptyDraft,
  excerpt,
  isPainEvent,
  locale,
} from './bodyPainModel'
import type { BodyPainStep, Draft } from './bodyPainModel'
import './bodyPainSection.css'

const BodyAtlasViewerAsync = lazy(() => import('../../body3d/BodyAtlasViewer'))

type Step = BodyPainStep


function ignoreBodyPick(): void {
  /* read-only viewer: taps do not change the stored point */
}

export function BodyPainSection({ autoOpenRequest, data, language, onOpenRequestHandled }: { autoOpenRequest?: number; data: HealthDataController; language: string; onOpenRequestHandled?: (token: number) => void }) {
  const { t, formatDate } = useI18n()
  const lang = locale(language)
  const copy = COPY[lang]
  const [detail, setDetail] = useState<HealthEvent>()
  const [flowOpen, setFlowOpen] = useState(false)
  const [step, setStep] = useState<Step>(0)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [attachmentBusyId, setAttachmentBusyId] = useState<string>()
  const [attachmentError, setAttachmentError] = useState('')
  const painSignature = eventSubsetSignature(data.events, PAIN_TYPES)

  const events = useMemo(
    () =>
      data.events
        .filter(isPainEvent)
        .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()),
    [data.events, painSignature],
  )

  const recentCount = useMemo(() => {
    const since = Date.now() - RECENT_WINDOW_MS
    return events.filter((event) => new Date(event.occurredAt).getTime() >= since).length
  }, [events])

  const recent = events
  const latest = events[0]

  const draftPreview = useMemo<HealthEvent[]>(() => {
    if (!draft.point) return []
    const now = new Date().toISOString()
    return [
      {
        id: 'bp-draft-preview',
        type: draft.type,
        bodyRegionId: draft.regionId,
        bodyPoint: draft.point,
        occurredAt: now,
        intensity: draft.intensity,
        description: copy.descriptionPlaceholder,
        tags: [],
        attachments: [],
        createdAt: now,
        updatedAt: now,
      },
    ]
  }, [copy.descriptionPlaceholder, draft.intensity, draft.point, draft.regionId, draft.type])

  const openFlow = () => {
    setDraft(emptyDraft())
    setStep(0)
    setSaving(false)
    setSaveError('')
    setFlowOpen(true)
  }

  useEffect(() => {
    if (autoOpenRequest !== undefined) {
      openFlow()
      onOpenRequestHandled?.(autoOpenRequest)
    }
  }, [autoOpenRequest, onOpenRequestHandled])

  useEffect(() => {
    const openRequested = (event: Event) => {
      if ((event as CustomEvent<unknown>).detail === 'dolori') openFlow()
    }
    let pending = false
    try {
      pending = window.sessionStorage.getItem('mhd.pending-add') === 'dolori'
      if (pending) window.sessionStorage.removeItem('mhd.pending-add')
    } catch {
      // Storage can be disabled; the event remains the normal path.
    }
    if (pending) openFlow()
    window.addEventListener('mhd:open-add', openRequested)
    return () => window.removeEventListener('mhd:open-add', openRequested)
  }, [])

  const closeFlow = () => {
    setFlowOpen(false)
    setSaving(false)
    setSaveError('')
  }

  const saveDraft = async () => {
    if (saving) return
    setSaving(true)
    const occurredAt = new Date(draft.occurredAt)
    if (!draft.occurredAt || Number.isNaN(occurredAt.getTime())) {
      setSaveError(lang === 'it' ? 'Inserisci una data e un’ora valide.' : 'Enter a valid date and time.')
      setSaving(false)
      return
    }
    const now = new Date().toISOString()
    const event: HealthEvent = {
      id: createId('event'),
      type: draft.type,
      bodyRegionId: draft.regionId,
      bodyPoint: draft.point,
      occurredAt: occurredAt.toISOString(),
      intensity: draft.intensity,
      description: draft.description.trim(),
      suspectedTrigger: draft.trigger.trim() || undefined,
      tags: [],
      attachments: draft.attachments.map(({ metadata }) => metadata),
      createdAt: now,
      updatedAt: now,
      source: 'manual',
    }
    try {
      await data.saveEvent(event, draft.attachments)
      closeFlow()
    } catch {
      setSaveError(lang === 'it' ? 'Impossibile salvare il dolore. Riprova.' : 'Could not save the pain entry. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const removeDetail = async () => {
    if (!detail || deleting || !window.confirm(copy.deleteConfirm)) return
    const id = detail.id
    setDeleting(true)
    setDeleteError('')
    try {
      await data.deleteEvent(id)
      setDetail(undefined)
    } catch {
      setDeleteError(lang === 'it' ? 'Impossibile eliminare il dolore. Riprova.' : 'Could not delete the pain entry. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  const resolveAttachment = async (id: string) => {
    const metadata = detail?.attachments.find((item) => item.id === id)
    if (!metadata) return undefined
    return loadVerifiedAttachment(metadata)
  }

  const openAttachment = async (id: string) => {
    if (attachmentBusyId) return
    setAttachmentBusyId(id)
    setAttachmentError('')
    const pendingWindow = window.open('', '_blank', 'noopener,noreferrer')
    try {
      const blob = await resolveAttachment(id)
      if (!blob) throw new Error('missing_attachment')
      const url = URL.createObjectURL(blob)
      if (pendingWindow) pendingWindow.location.href = url
      else window.open(url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      pendingWindow?.close()
      setAttachmentError(lang === 'it' ? 'Allegato non disponibile sul dispositivo o sul Hub.' : 'Attachment unavailable on this device or Hub.')
    } finally {
      setAttachmentBusyId(undefined)
    }
  }

  const downloadAttachment = async (id: string) => {
    if (attachmentBusyId) return
    setAttachmentBusyId(id)
    setAttachmentError('')
    try {
      const blob = await resolveAttachment(id)
      const metadata = detail?.attachments.find((item) => item.id === id)
      if (!blob || !metadata) throw new Error('missing_attachment')
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = metadata.name
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      setAttachmentError(lang === 'it' ? 'Impossibile scaricare l’allegato.' : 'Could not download the attachment.')
    } finally {
      setAttachmentBusyId(undefined)
    }
  }

  const detailRows: Array<{ label: string; value?: string }> = detail
    ? [
        { label: copy.fieldDate, value: formatDate(detail.occurredAt, { dateStyle: 'medium', timeStyle: 'short' }) },
        { label: copy.fieldRegion, value: detail.bodyRegionId ? t(`region.${detail.bodyRegionId}`) : copy.noRegion },
        { label: copy.fieldIntensity, value: detail.intensity === undefined ? undefined : `${detail.intensity}/10` },
        { label: copy.fieldDuration, value: detail.durationMinutes === undefined ? undefined : copy.minutes(detail.durationMinutes) },
        { label: copy.fieldDescription, value: detail.description || copy.noDescription },
        { label: copy.fieldTrigger, value: detail.suspectedTrigger },
        { label: copy.fieldHelpedBy, value: detail.helpedBy },
        { label: copy.fieldTags, value: detail.tags.length > 0 ? detail.tags.join(', ') : undefined },
        { label: copy.fieldAttachments, value: detail.attachments.length > 0 ? detail.attachments.map((item) => item.name).join(', ') : undefined },
        { label: copy.fieldRecordedAt, value: formatDate(detail.createdAt, { dateStyle: 'medium' }) },
      ].filter((row): row is { label: string; value: string } => Boolean(row.value))
    : []

  const viewerFallback = (
    <div className="bp-viewer-loading" role="status">
      {t('body3d.loading')}
    </div>
  )

  return (
    <div className="bp-section">
      <header className="bp-header">
        <div className="bp-header__stats">
          <p className="bp-header__count">
            <strong>{recentCount}</strong> {copy.recentLabel(recentCount)}
          </p>
          <p className="bp-header__last">
            {latest ? copy.last(formatDate(latest.occurredAt, { dateStyle: 'medium' })) : copy.noEvents}
          </p>
        </div>
        <button className="btn btn--primary btn--small" onClick={openFlow} type="button">
          <Plus size={15} /> {copy.addButton}
        </button>
      </header>

      {recent.length === 0 ? (
        <p className="bp-empty">{copy.empty}</p>
      ) : (
        <ProgressiveHistory items={recent} initialCount={3} language={language}>
          {(visible) => (
          <ul className="bp-list">
          {visible.map((event) => (
            <li key={event.id}>
              <button className="bp-row" onClick={() => setDetail(event)} type="button">
                <span className="bp-row__top">
                  <span className="bp-row__date">{formatDate(event.occurredAt, { dateStyle: 'medium' })}</span>
                  <span className="bp-row__intensity" data-empty={event.intensity === undefined}>
                    {event.intensity === undefined ? '—' : `${event.intensity}/10`}
                  </span>
                </span>
                <span className="bp-row__meta">
                  <span className="bp-row__region">
                    <MapPin aria-hidden="true" size={12} />
                    {event.bodyRegionId ? t(`region.${event.bodyRegionId}`) : copy.noRegion}
                  </span>
                  <span className="bp-row__desc">{excerpt(event.description) || copy.noDescription}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
          )}
        </ProgressiveHistory>
      )}

      {detail ? (
        <EntrySheet onClose={() => setDetail(undefined)} title={`${copy.detailTitle} · ${t(`event.${detail.type}`)}`}>
          <div className="bp-detail">
            <div className="bp-chip-row">
              <span className="bp-chip bp-chip--type" data-type={detail.type}>
                {t(`event.${detail.type}`)}
              </span>
              <span className="bp-chip bp-chip--muted">
                {formatDate(detail.occurredAt, { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
              {detail.intensity === undefined ? null : (
                <span className="bp-chip bp-chip--muted">{detail.intensity}/10</span>
              )}
            </div>

            <div className="bp-map">
              {detail.bodyRegionId || detail.bodyPoint ? (
                <Suspense fallback={viewerFallback}>
                  <BodyAtlasViewerAsync
                    events={[detail]}
                    onPick={ignoreBodyPick}
                    selectedRegionId={detail.bodyRegionId}
                  />
                </Suspense>
              ) : (
                <p className="bp-note">{copy.noPosition}</p>
              )}
            </div>

            <dl className="bp-recap">
              {detailRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>

            {detail.attachments.length > 0 ? (
              <div className="bp-attachments" aria-label={copy.fieldAttachments}>
                <p className="bp-note">{copy.attachments(detail.attachments.length)}</p>
                {detail.attachments.map((attachment) => (
                  <div className="bp-attachment" key={attachment.id}>
                    <span className="bp-attachment__name">{attachment.name}</span>
                    <span className="bp-attachment__actions">
                      <button className="btn btn--ghost btn--small" disabled={attachmentBusyId !== undefined} onClick={() => void openAttachment(attachment.id)} type="button">
                        <ExternalLink size={13} /> {lang === 'it' ? 'Apri' : 'Open'}
                      </button>
                      <button className="btn btn--ghost btn--small" disabled={attachmentBusyId !== undefined} onClick={() => void downloadAttachment(attachment.id)} type="button">
                        <Download size={13} /> {lang === 'it' ? 'Scarica' : 'Download'}
                      </button>
                    </span>
                  </div>
                ))}
                {attachmentError ? <p className="bp-note bp-note--warn" role="alert">{attachmentError}</p> : null}
              </div>
            ) : null}

            <div className="bp-actions">
              {deleteError ? <p aria-live="polite" className="bp-note bp-note--warn" role="alert">{deleteError}</p> : null}
              <button className="btn btn--danger btn--small bp-actions__danger" disabled={deleting} onClick={() => void removeDetail()} type="button">
                <Trash2 size={14} /> {t('common.delete')}
              </button>
              <button className="btn btn--ghost btn--small" disabled={deleting} onClick={() => setDetail(undefined)} type="button">
                {t('common.close')}
              </button>
            </div>
          </div>
        </EntrySheet>
      ) : null}

      {flowOpen ? (
        <BodyPainFlow
          copy={copy}
          draft={draft}
          draftPreview={draftPreview}
          formatDate={formatDate}
          lang={lang}
          onClose={closeFlow}
          onSave={() => void saveDraft()}
          saveError={saveError}
          saving={saving}
          setDraft={setDraft}
          setSaveError={setSaveError}
          setStep={setStep}
          step={step}
          t={t}
        />
      ) : null}
    </div>
  )
}
