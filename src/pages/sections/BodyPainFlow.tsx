import { Suspense, lazy } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { MapPin } from 'lucide-react'
import { EntrySheet } from '../../components/EntrySheet'
import { BODY_REGIONS } from '../../core/bodyRegions'
import { createId } from '../../core/id'
import type { HealthEvent } from '../../core/types'
import type { BodySelection } from '../../body3d/BodyAtlasViewer'
import { FLOW_TYPES, intensityWord } from './bodyPainModel'
import type { BodyPainStep, Copy, Draft, Loc } from './bodyPainModel'

const BodyAtlasViewerAsync = lazy(() => import('../../body3d/BodyAtlasViewer'))

export interface BodyPainFlowProps {
  copy: Copy
  draft: Draft
  draftPreview: HealthEvent[]
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
  lang: Loc
  saving: boolean
  saveError: string
  step: BodyPainStep
  t: (key: string, replacements?: Record<string, string | number>) => string
  onClose: () => void
  onSave: () => void
  setDraft: Dispatch<SetStateAction<Draft>>
  setSaveError: Dispatch<SetStateAction<string>>
  setStep: Dispatch<SetStateAction<BodyPainStep>>
}

export function BodyPainFlow({
  copy,
  draft,
  draftPreview,
  formatDate,
  lang,
  onClose,
  onSave,
  saveError,
  saving,
  setDraft,
  setSaveError,
  setStep,
  step,
  t,
}: BodyPainFlowProps) {
  const viewerFallback = (
    <div className="bp-viewer-loading" role="status">
      {t('body3d.loading')}
    </div>
  )

  return (
        <EntrySheet onClose={onClose} title={copy.flowTitle}>
          <div className="bp-flow">
            <p aria-live="polite" className="visually-hidden">
              {draft.regionId ? t('body3d.selectedAnnounce', { region: t(`region.${draft.regionId}`) }) : ''}
            </p>

            <ol aria-label={copy.stepsLabel} className="bp-steps">
              {copy.steps.map((label, index) => (
                <li aria-current={step === index ? 'step' : undefined} data-done={step > index} key={label}>
                  <span>{index + 1}</span>
                  {label}
                </li>
              ))}
            </ol>

            {step === 0 ? (
              <div className="bp-step">
                <div className="bp-field">
                  <span className="bp-field__label">{copy.fieldType}</span>
                  <div aria-label={copy.fieldType} className="bp-segmented" role="group">
                    {FLOW_TYPES.map((type) => (
                      <button
                        aria-pressed={draft.type === type}
                        className="bp-seg"
                        key={type}
                        onClick={() => setDraft((current) => ({ ...current, type }))}
                        type="button"
                      >
                        {t(`event.${type}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="bp-field">
                  <span className="bp-field__label">
                    {copy.fieldIntensity} <output>{draft.intensity}/10</output>
                    <em className="bp-intensity-word">{intensityWord(draft.intensity, lang)}</em>
                  </span>
                  <input
                    aria-valuetext={`${draft.intensity}/10 ${intensityWord(draft.intensity, lang)}`}
                    max={10}
                    min={0}
                    onChange={(changeEvent) =>
                      setDraft((current) => ({ ...current, intensity: Number(changeEvent.target.value) }))
                    }
                    step={1}
                    type="range"
                    value={draft.intensity}
                  />
                  <span className="bp-slider-scale">
                    <em>{copy.intensityLow}</em>
                    <em>{copy.intensityHigh}</em>
                  </span>
                </label>

                <label className="bp-field">
                  {copy.description}
                  <textarea
                    onChange={(changeEvent) =>
                      setDraft((current) => ({ ...current, description: changeEvent.target.value }))
                    }
                    placeholder={copy.descriptionPlaceholder}
                    rows={3}
                    value={draft.description}
                  />
                </label>

                <label className="bp-field">
                  {copy.trigger}
                  <input
                    onChange={(changeEvent) =>
                      setDraft((current) => ({ ...current, trigger: changeEvent.target.value }))
                    }
                    placeholder={copy.triggerPlaceholder}
                    value={draft.trigger}
                  />
                </label>

                <label className="bp-field">
                  {copy.fieldDate}
                  <input
                    onChange={(changeEvent) =>
                      setDraft((current) => ({ ...current, occurredAt: changeEvent.target.value }))
                    }
                    type="datetime-local"
                    value={draft.occurredAt}
                  />
                </label>

                <label className="bp-field">
                  {copy.fieldAttachments}
                  <input
                    multiple
                    onChange={(changeEvent) => {
                      const attachments = Array.from(changeEvent.target.files ?? []).map((file) => ({
                        metadata: {
                          id: createId('attachment'),
                          name: file.name,
                          type: file.type,
                          size: file.size,
                          lastModified: file.lastModified,
                        },
                        file,
                      }))
                      setDraft((current) => ({ ...current, attachments }))
                    }}
                    type="file"
                  />
                  {draft.attachments.length > 0 ? (
                    <span className="bp-note">{copy.attachments(draft.attachments.length)}: {draft.attachments.map(({ metadata }) => metadata.name).join(', ')}</span>
                  ) : null}
                </label>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="bp-step">
                <p className="bp-note">{copy.tapHint}</p>
                <div className="bp-map bp-map--picker">
                  <Suspense fallback={viewerFallback}>
                    <BodyAtlasViewerAsync
                      events={draftPreview}
                      onPick={(selection: BodySelection) =>
                        setDraft((current) => ({ ...current, regionId: selection.regionId, point: selection.point }))
                      }
                      selectedRegionId={draft.regionId}
                    />
                  </Suspense>
                </div>
                {draft.regionId ? (
                  <div className="bp-chip-row">
                    <span className="bp-chip bp-chip--selected">
                      <MapPin aria-hidden="true" size={13} />
                      {t(`region.${draft.regionId}`)}
                      {draft.point ? <small>{copy.precisePoint}</small> : null}
                      <button
                        aria-label={copy.clearRegion}
                        className="bp-chip__clear"
                        onClick={() => setDraft((current) => ({ ...current, regionId: undefined, point: undefined }))}
                        type="button"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                ) : (
                  <p className="bp-note bp-note--warn">{copy.regionRequired}</p>
                )}
                <details className="bp-region-fallback">
                  <summary>{copy.pickFromList}</summary>
                  <div className="bp-region-grid">
                    {BODY_REGIONS.map((region) => (
                      <button
                        aria-pressed={draft.regionId === region.id}
                        className="bp-region-chip"
                        key={region.id}
                        onClick={() =>
                          setDraft((current) => ({ ...current, regionId: region.id, point: undefined }))
                        }
                        type="button"
                      >
                        {t(`region.${region.id}`)}
                      </button>
                    ))}
                  </div>
                </details>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="bp-step">
                <h3 className="bp-recap__title">{copy.recapTitle}</h3>
                <dl className="bp-recap">
                  <div>
                    <dt>{copy.fieldType}</dt>
                    <dd>{t(`event.${draft.type}`)}</dd>
                  </div>
                  <div>
                    <dt>{copy.fieldIntensity}</dt>
                    <dd>
                      {draft.intensity}/10 · {intensityWord(draft.intensity, lang)}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.fieldRegion}</dt>
                    <dd>{draft.regionId ? t(`region.${draft.regionId}`) : copy.noRegion}</dd>
                  </div>
                  <div>
                    <dt>{copy.fieldDescription}</dt>
                    <dd>{draft.description.trim() || copy.noDescription}</dd>
                  </div>
                  <div>
                    <dt>{copy.fieldTrigger}</dt>
                    <dd>{draft.trigger.trim() || '—'}</dd>
                  </div>
                  <div>
                    <dt>{copy.fieldDate}</dt>
                    <dd>{draft.occurredAt ? formatDate(new Date(draft.occurredAt), { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div className="bp-actions">
              {saveError ? <p aria-live="polite" className="bp-note bp-note--warn" role="alert">{saveError}</p> : null}
              {step === 0 ? (
                <button className="btn btn--ghost btn--small" onClick={onClose} type="button">
                  {t('common.cancel')}
                </button>
              ) : (
                <button className="btn btn--ghost btn--small" onClick={() => setStep((step - 1) as BodyPainStep)} type="button">
                  {copy.back}
                </button>
              )}
              {step < 2 ? (
                <button
                  className="btn btn--primary btn--small"
                  disabled={step === 1 && !draft.regionId}
                  onClick={() => {
                    if (step === 0 && draft.description.trim().length === 0) {
                      setSaveError(copy.descriptionRequired)
                      return
                    }
                    setSaveError('')
                    setStep((step + 1) as BodyPainStep)
                  }}
                  type="button"
                >
                  {copy.next}
                </button>
              ) : (
                <button className="btn btn--primary btn--small" disabled={saving} onClick={() => void onSave()} type="button">
                  {copy.confirm}
                </button>
              )}
            </div>
          </div>
        </EntrySheet>
  )
}
