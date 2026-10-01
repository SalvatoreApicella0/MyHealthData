import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { EntrySheet } from '../../components/EntrySheet'
import { eventSubsetSignature, eventsForTypes } from '../../core/eventSignatures'
import { fromDateTimeLocal, toDateTimeLocal } from '../../core/format'
import {
  DENTAL_QUADRANTS,
  dentalRestorationTags,
  dentalToneByTooth,
  dentalToneLabel,
  FDI_TEETH,
  resolveDentalEvents,
} from '../../core/dental'
import type { DentalVisualTone } from '../../core/dental'
import type { HealthEvent } from '../../core/types'
import { buildEvent, editedEvent, excerpt, formatDay, locale, nowInput, t, tagValue, type Loc } from './specialtyModel'
import { DeleteButton, EditButton, DateField, Empty, SheetActions, useEventDelete, useSheetSave } from './SpecialtyShared'
import type { SectionProps } from './SpecialtyShared'

const DentalAtlasViewer = lazy(() => import('../../body3d/DentalAtlasViewer'))

/* ---------------------------------- Denti ---------------------------------- */

interface DentalActionSpec {
  id: string
  it: string
  en: string
}

const DENTAL_ACTIONS: DentalActionSpec[] = [
  { id: 'cleaning', it: 'Igiene e pulizia', en: 'Cleaning' },
  { id: 'checkup', it: 'Controllo', en: 'Checkup' },
  { id: 'filling', it: 'Otturazione', en: 'Filling' },
  { id: 'rootCanal', it: 'Devitalizzazione', en: 'Root canal' },
  { id: 'crown', it: 'Corona', en: 'Crown' },
  { id: 'implant', it: 'Impianto', en: 'Implant' },
  { id: 'extraction', it: 'Estrazione', en: 'Extraction' },
  { id: 'orthodontics', it: 'Ortodonzia', en: 'Orthodontics' },
  { id: 'caries', it: 'Carie', en: 'Caries' },
  { id: 'pain', it: 'Dolore', en: 'Pain' },
  { id: 'brushing', it: 'Spazzolamento', en: 'Brushing' },
]

const PROFESSIONAL_ACTIONS = ['cleaning', 'checkup', 'filling', 'rootCanal', 'crown', 'implant', 'extraction', 'orthodontics', 'caries', 'pain']

function dentalAction(id: string | undefined): DentalActionSpec | undefined {
  return DENTAL_ACTIONS.find((action) => action.id === id)
}

const DENTAL_ARCH_ROWS = [
  {
    id: 'upper',
    labelIt: 'Arcata superiore',
    labelEn: 'Upper arch',
    quadrants: [
      { ...DENTAL_QUADRANTS.upper[0], sideIt: 'destra', sideEn: 'right' },
      { ...DENTAL_QUADRANTS.upper[1], sideIt: 'sinistra', sideEn: 'left' },
    ],
  },
  {
    id: 'lower',
    labelIt: 'Arcata inferiore',
    labelEn: 'Lower arch',
    quadrants: [
      { ...DENTAL_QUADRANTS.lower[0], sideIt: 'destra', sideEn: 'right' },
      { ...DENTAL_QUADRANTS.lower[1], sideIt: 'sinistra', sideEn: 'left' },
    ],
  },
] as const

type ToothTone = DentalVisualTone

export function dentalSummaryCounts(toothState: Map<string, ToothTone>, entriesByTooth: Map<string, HealthEvent[]>): { tracked: number; treated: number; caries: number; removed: number } {
  let treated = 0
  let caries = 0
  let removed = 0
  for (const tone of toothState.values()) {
    if (tone === 'treated') treated += 1
    if (tone === 'caries') caries += 1
    if (tone === 'extraction') removed += 1
  }
  return { treated, caries, removed, tracked: entriesByTooth.size }
}

export function DentalSection({ data, language, autoOpenRequest, onOpenRequestHandled }: SectionProps & { autoOpenRequest?: number; onOpenRequestHandled?: (token: number) => void }) {
  const lang = locale(language)
  const [sheet, setSheet] = useState<{ tooth?: string; existing?: HealthEvent } | null>(null)
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)
  const [showDental3D, setShowDental3D] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState('')

  // A tooth selected in the 3D canvas remains selected when switching back to
  // the clinical map, and a removed record can never leave a stale selection.
  useEffect(() => {
    if (selectedTooth && !FDI_TEETH.includes(selectedTooth as typeof FDI_TEETH[number])) setSelectedTooth(null)
  }, [selectedTooth])

  useEffect(() => {
    if (autoOpenRequest !== undefined) {
      setSheet({})
      onOpenRequestHandled?.(autoOpenRequest)
    }
  }, [autoOpenRequest, onOpenRequestHandled])

  const dentalSignature = eventSubsetSignature(data.events, ['dental_care'])
  const dentalProjection = useMemo(
    () => resolveDentalEvents(eventsForTypes(data.events, ['dental_care'])),
    [data.events, dentalSignature],
  )
  const toothState = useMemo(() => dentalToneByTooth(dentalProjection), [dentalProjection])

  const entriesByTooth = useMemo(() => {
    const groupedByTooth = new Map<string, HealthEvent[]>()
    for (const [tooth, projection] of dentalProjection.byTooth) {
      groupedByTooth.set(tooth, [...projection.history].reverse().map((entry) => entry.event))
    }
    return groupedByTooth
  }, [dentalProjection])

  const professionalEntries = useMemo(
    () => [...dentalProjection.events].reverse().filter((entry) => PROFESSIONAL_ACTIONS.includes(entry.action ?? '')),
    [dentalProjection],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, HealthEvent[]>()
    for (const entry of professionalEntries) {
      const action = entry.action ?? 'other'
      const list = map.get(action) ?? []
      list.push(entry.event)
      map.set(action, list)
    }
    return DENTAL_ACTIONS.filter((action) => map.has(action.id)).map((action) => ({ action, list: map.get(action.id) ?? [] }))
  }, [professionalEntries])

  const { deletingId, error: deleteError, remove } = useEventDelete((id) => data.deleteEvent(id), lang)
  const selectedToothProjection = selectedTooth && FDI_TEETH.includes(selectedTooth as typeof FDI_TEETH[number])
    ? dentalProjection.byTooth.get(selectedTooth as typeof FDI_TEETH[number])
    : undefined
  const selectedHistory = selectedToothProjection ? [...selectedToothProjection.history].reverse() : []
  const dentalSummary = useMemo(() => dentalSummaryCounts(toothState, entriesByTooth), [entriesByTooth, toothState])

  return (
    <section className="spec" data-module="dental">
      <header className="spec-head">
        <button className="btn btn--ghost btn--small" onClick={() => setSheet({})} type="button">
          <Plus size={14} />
          {t(lang, 'Registra', 'Record')}
        </button>
      </header>

      {deleteError ? <p aria-live="polite" className="spec-form__error" role="alert">{deleteError}</p> : null}
      {restoreError ? <p aria-live="polite" className="spec-form__error" role="alert">{restoreError}</p> : null}

      <div className="spec-dental-summary" aria-label={t(lang, 'Riepilogo dentale', 'Dental summary')}>
        <div className="spec-dental-summary__total"><strong>{dentalSummary.tracked}</strong><span>{t(lang, 'denti annotati', 'tracked teeth')}</span></div>
        {(['caries', 'treated', 'extraction'] as const).map((tone) => {
          const count = tone === 'caries' ? dentalSummary.caries : tone === 'treated' ? dentalSummary.treated : dentalSummary.removed
          const firstTooth = [...toothState.entries()].find(([, value]) => value === tone)?.[0]
          return <button className="spec-dental-summary__filter" data-tone={tone} disabled={!firstTooth} key={tone} onClick={() => firstTooth && setSelectedTooth(firstTooth)} type="button"><strong>{count}</strong><span>{tone === 'caries' ? t(lang, 'con carie', 'with caries') : tone === 'treated' ? t(lang, 'trattati', 'treated') : t(lang, 'rimossi', 'removed')}</span></button>
        })}
      </div>

      <div aria-label={t(lang, 'Mappa dentale', 'Dental map')} className="spec-odontogram" role="group">
        <div className="spec-odontogram__head">
          <span className="spec-odontogram__mode">FDI · {t(lang, 'vista frontale', 'front view')}</span>
          <div className="spec-odontogram__legend">
            <span><i data-tone="treated" /> {t(lang, 'Intervento', 'Treatment')}</span>
            <span><i data-tone="caries" /> {t(lang, 'Carie', 'Caries')}</span>
            <span><i data-tone="extraction" /> {t(lang, 'Rimosso', 'Removed')}</span>
          </div>
        </div>
        <div className="spec-odontogram__rows">
          {DENTAL_ARCH_ROWS.map((row) => (
            <div className="spec-odontogram__row" key={row.id}>
              <span className="spec-odontogram__row-label">{t(lang, row.labelIt, row.labelEn)}</span>
              <div className="spec-odontogram__quadrants">
                {row.quadrants.map((quadrant) => (
                  <div className="spec-dental-quadrant" key={quadrant.id}>
                    <div className="spec-dental-quadrant__head">
                      <strong>Q{quadrant.id}</strong>
                      <span>{t(lang, quadrant.sideIt, quadrant.sideEn)}</span>
                    </div>
                    <div className="spec-dental-quadrant__grid">
                      {quadrant.teeth.map((tooth) => {
                        const tone = toothState.get(tooth)
                        const marker = tone === 'caries' ? '!' : tone === 'treated' ? '•' : tone === 'extraction' ? '×' : '·'
                        return (
                          <button
                            aria-label={`${t(lang, `Dente ${tooth}`, `Tooth ${tooth}`)} · ${dentalToneLabel(tooth, toothState, lang)}`}
                            aria-pressed={selectedTooth === tooth}
                            aria-disabled={tone === 'extraction'}
                            className="spec-tooth"
                            data-tone={tone ?? 'none'}
                            key={tooth}
                            onClick={() => setSelectedTooth(tooth)}
                            type="button"
                          >
                            <span aria-hidden="true" className="spec-tooth__marker">{marker}</span>
                            <span className="spec-tooth__id">{tooth}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="spec-dental-view-toggle" role="group" aria-label={t(lang, 'Vista dentale', 'Dental view')}>
        <button aria-pressed={!showDental3D} className="chip" onClick={() => setShowDental3D(false)} type="button">{t(lang, '2D clinica', 'Clinical 2D')}</button>
        <button aria-pressed={showDental3D} className="chip" onClick={() => setShowDental3D(true)} type="button">{t(lang, 'Anteprima 3D', '3D preview')}</button>
      </div>
      {showDental3D ? (
        <Suspense fallback={<div className="spec-dental-3d__status">Preparazione della vista 3D…</div>}>
          <DentalAtlasViewer language={lang} onSelect={setSelectedTooth} selectedTooth={selectedTooth} state={toothState} />
        </Suspense>
      ) : null}

      {selectedTooth ? (
        <aside aria-live="polite" className="spec-tooth-detail">
          <div className="spec-tooth-detail__head">
            <div>
              <span className="spec-caption">{t(lang, 'Dente selezionato', 'Selected tooth')}</span>
              <h4>{t(lang, `Dente ${selectedTooth}`, `Tooth ${selectedTooth}`)}</h4>
            </div>
            <span className="spec-chip" data-tone={toothState.get(selectedTooth)}>
              {toothState.get(selectedTooth) === 'extraction'
                ? t(lang, 'Rimosso', 'Removed')
                : selectedToothProjection?.removed === false && selectedToothProjection.history.some((entry) => entry.isRestoration)
                  ? t(lang, 'Ripristinato', 'Restored')
                : toothState.get(selectedTooth) === 'caries'
                  ? t(lang, 'Carie', 'Caries')
                    : selectedToothProjection?.history.some((entry) => PROFESSIONAL_ACTIONS.includes(entry.action ?? ''))
                    ? t(lang, 'Intervento', 'Treatment')
                    : t(lang, 'Nessun intervento', 'No treatment')}
            </span>
          </div>
          {selectedHistory.length > 0 ? (
            <ul className="spec-tooth-detail__history">
              {selectedHistory.map((entry) => {
                const action = dentalAction(entry.action)
                return <li key={entry.event.id}><strong>{action ? t(lang, action.it, action.en) : entry.event.description}</strong><span>{formatDay(entry.event.occurredAt, lang)}</span></li>
              })}
            </ul>
          ) : <Empty label={t(lang, 'Nessun intervento registrato su questo dente.', 'No treatment recorded for this tooth.')} />}
          <div className="spec-tooth-detail__actions">
            {selectedToothProjection?.removed ? (
              <button
                className="btn btn--primary btn--small"
                disabled={restoring}
                onClick={() => {
                  if (restoring) return
                  setRestoring(true)
                  setRestoreError('')
                  const now = new Date().toISOString()
                  const tooth = selectedTooth as typeof FDI_TEETH[number]
                  const restoration = buildEvent(
                    'dental_care',
                    now,
                    t(lang, 'Ripristino dente', 'Tooth restoration'),
                    dentalRestorationTags(tooth),
                  )
                  void data.saveEvent(restoration)
                    .then(() => setSelectedTooth(tooth))
                    .catch(() => setRestoreError(t(lang, 'Impossibile ripristinare il dente. Riprova.', 'Could not restore the tooth. Try again.')))
                    .finally(() => setRestoring(false))
                }}
                type="button"
              >
                {restoring ? t(lang, 'Ripristino…', 'Restoring…') : t(lang, 'Ripristina dente', 'Restore tooth')}
              </button>
            ) : toothState.get(selectedTooth) !== 'extraction' ? (
              <button className="btn btn--primary btn--small" onClick={() => setSheet({ tooth: selectedTooth })} type="button"><Plus size={14} /> {t(lang, 'Registra intervento', 'Record treatment')}</button>
            ) : (
              <span className="spec-caption">{t(lang, 'Dente rimosso: nessun nuovo intervento', 'Tooth removed: no new treatment')}</span>
            )}
            <button className="btn btn--ghost btn--small" onClick={() => setSelectedTooth(null)} type="button">{t(lang, 'Chiudi', 'Close')}</button>
          </div>
        </aside>
      ) : null}

      <div className="spec-block">
        <h4 className="spec-title">{t(lang, 'Attività professionali', 'Professional activities')}</h4>
        {grouped.length === 0 ? (
          <Empty label={t(lang, 'Nessuna attività registrata.', 'No activities recorded.')} />
        ) : (
          <div className="spec-dental-groups">
            {grouped.map(({ action, list }) => (
              <div className="spec-dental-group" key={action.id}>
                <span className="spec-dental-group__title">{t(lang, action.it, action.en)}</span>
                <ul className="spec-list">
                  {list.map((entry) => {
                    const tooth = tagValue(entry.tags, 'tooth')
                    const note = tagValue(entry.tags, 'note')
                    return (
                      <li className="spec-row" key={entry.id}>
                        <span className="spec-row__main">
                          <span className="spec-row__titleline">
                            <span className="spec-row__title">
                              {tooth ? `${t(lang, 'Dente', 'Tooth')} ${tooth}` : t(lang, 'Trattamento', 'Treatment')}
                            </span>
                            <span className="spec-row__date">{formatDay(entry.occurredAt, lang)}</span>
                          </span>
                          {note ? <span className="spec-row__note">{excerpt(note)}</span> : null}
                        </span>
                        <div className="spec-row__actions">
                          <EditButton label={`${t(lang, 'Modifica note e data', 'Edit notes and date')}: ${entry.description}`} onClick={() => setSheet({ existing: entry })} />
                          <DeleteButton disabled={deletingId !== null} label={t(lang, 'Elimina', 'Delete')} onClick={() => remove(entry.id)} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {sheet ? (
        <EntrySheet
          onClose={() => setSheet(null)}
          title={sheet.existing ? t(lang, 'Modifica note e data', 'Edit notes and date') : sheet.tooth ? t(lang, `Dente ${sheet.tooth}`, `Tooth ${sheet.tooth}`) : t(lang, 'Registra', 'Record')}
        >
          <DentalForm
            existing={sheet.existing}
            initialTooth={sheet.tooth}
            language={lang}
            removedToothIds={new Set([...toothState].filter(([, tone]) => tone === 'extraction').map(([tooth]) => tooth))}
            onClose={() => setSheet(null)}
            onSave={async (event) => {
              const tooth = tagValue(event.tags, 'tooth')
              if (!sheet.existing && tooth && toothState.get(tooth) === 'extraction') throw new Error('dental_tooth_removed')
              await data.saveEvent(event)
            }}
          />
        </EntrySheet>
      ) : null}
    </section>
  )
}

function DentalForm({
  existing,
  initialTooth,
  language,
  removedToothIds,
  onClose,
  onSave,
}: {
  existing?: HealthEvent
  initialTooth?: string
  language: Loc
  removedToothIds: ReadonlySet<string>
  onClose: () => void
  onSave: (event: HealthEvent) => Promise<void>
}) {
  const [tooth, setTooth] = useState(tagValue(existing?.tags ?? [], 'tooth') ?? initialTooth ?? '')
  const [action, setAction] = useState(tagValue(existing?.tags ?? [], 'action') ?? DENTAL_ACTIONS[0]?.id ?? 'cleaning')
  const [note, setNote] = useState(tagValue(existing?.tags ?? [], 'note') ?? '')
  const [date, setDate] = useState(() => existing ? toDateTimeLocal(existing.occurredAt) : nowInput())
  const { error, save, saving } = useSheetSave(onSave, onClose, language)

  const submit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    const selected = dentalAction(action)
    const tags = [`action=${action}`, `note=${note}`]
    if (tooth) tags.push(`tooth=${tooth}`)
    save(editedEvent(existing, buildEvent('dental_care', fromDateTimeLocal(date), existing?.description ?? (selected ? t(language, selected.it, selected.en) : action), tags), ['action', 'tooth', 'note']))
  }

  return (
    <form className="spec-form" onSubmit={submit}>
      <label>
        {t(language, 'Dente (FDI)', 'Tooth (FDI)')}
        <select disabled={Boolean(existing)} onChange={(event) => setTooth(event.target.value)} value={tooth}>
          <option value="">{t(language, 'Nessun dente', 'No tooth')}</option>
          {FDI_TEETH.filter((option) => !removedToothIds.has(option) || option === tooth).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <label>
        {t(language, 'Attività', 'Action')}
        <select disabled={Boolean(existing)} onChange={(event) => setAction(event.target.value)} value={action}>
          {DENTAL_ACTIONS.map((option) => (
            <option key={option.id} value={option.id}>{t(language, option.it, option.en)}</option>
          ))}
        </select>
      </label>
      <DateField language={language} onChange={setDate} value={date} />
      <label>
        {t(language, 'Nota', 'Note')}
        <textarea onChange={(event) => setNote(event.target.value)} rows={3} value={note} />
      </label>
      <SheetActions error={error} label={t(language, 'Salva', 'Save')} language={language} onClose={onClose} saving={saving} />
    </form>
  )
}
