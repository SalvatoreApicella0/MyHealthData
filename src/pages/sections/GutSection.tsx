import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { EntrySheet } from '../../components/EntrySheet'
import { eventSubsetSignature, eventsForTypes } from '../../core/eventSignatures'
import { fromDateTimeLocal, toDateTimeLocal } from '../../core/format'
import type { HealthEvent } from '../../core/types'
import { byDateDesc, buildEvent, editedEvent, excerpt, formatDayTime, isToday, locale, nowInput, t, tagValue, type Loc } from './specialtyModel'
import { DateField, DeleteButton, EditButton, Empty, SheetActions, useEventDelete, useSheetSave } from './SpecialtyShared'
import type { SectionProps } from './SpecialtyShared'

/* ---------------------------- Salute intestinale --------------------------- */

const GUT_SYMPTOMS = ['Mal di pancia', 'Gonfiore', 'Reflusso', 'Nausea', 'Crampi', 'Diarrea', 'Stitichezza', 'Altro']

export function GutSection({ data, language }: SectionProps) {
  const lang = locale(language)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HealthEvent>()

  const gutSignature = eventSubsetSignature(data.events, ['digestive_health'])
  const entries = useMemo(() => byDateDesc(eventsForTypes(data.events, ['digestive_health'])), [data.events, gutSignature])
  const { lastBristol, todayCount } = useMemo(() => {
    let today = 0
    let bristol: string | undefined
    for (const entry of entries) {
      if (isToday(entry.occurredAt)) today += 1
      if (bristol === undefined && tagValue(entry.tags, 'kind') === 'Evacuazione') bristol = tagValue(entry.tags, 'bristol')
    }
    return { lastBristol: bristol, todayCount: today }
  }, [entries])

  const { deletingId, error: deleteError, remove } = useEventDelete((id) => data.deleteEvent(id), lang)

  return (
    <section className="spec" data-module="gut">
      <header className="spec-head">
        <button className="btn btn--ghost btn--small" onClick={() => { setEditing(undefined); setOpen(true) }} type="button">
          <Plus size={14} />
          {t(lang, 'Registra', 'Record')}
        </button>
      </header>

      {deleteError ? <p aria-live="polite" className="spec-form__error" role="alert">{deleteError}</p> : null}

      <div className="spec-stats">
        <div className="spec-stat">
          <span className="spec-stat__value">{todayCount}</span>
          <span className="spec-stat__label">{t(lang, 'Oggi', 'Today')}</span>
        </div>
        <div className="spec-stat">
          <span className="spec-stat__value">{lastBristol ?? '—'}</span>
          <span className="spec-stat__label">{t(lang, 'Ultimo Bristol', 'Last Bristol')}</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <Empty label={t(lang, 'Nessuna registrazione intestinale.', 'No gut entries recorded.')} />
      ) : (
        <ul className="spec-list">
          {entries.map((entry) => {
            const kind = tagValue(entry.tags, 'kind') ?? 'Sintomo'
            const symptom = tagValue(entry.tags, 'symptom')
            const intensity = tagValue(entry.tags, 'intensity')
            const bristol = tagValue(entry.tags, 'bristol')
            const trigger = tagValue(entry.tags, 'trigger')
            const evacuation = kind === 'Evacuazione'
            return (
              <li className="spec-row" key={entry.id}>
                <span className="spec-row__main">
                  <span className="spec-row__titleline">
                    <span className="spec-row__title">{evacuation ? t(lang, 'Evacuazione', 'Bowel movement') : symptom ?? entry.description}</span>
                    <span className="spec-row__date">{formatDayTime(entry.occurredAt, lang)}</span>
                  </span>
                  <span className="spec-chips">
                    <span className="spec-chip spec-chip--quiet">{evacuation ? t(lang, 'Evacuazione', 'Evacuation') : t(lang, 'Sintomo', 'Symptom')}</span>
                    {intensity ? <span className="spec-chip">{intensity}/10</span> : null}
                    {bristol ? <span className="spec-chip spec-chip--ok">{t(lang, 'Bristol', 'Bristol')} {bristol}</span> : null}
                    {trigger ? <span className="spec-chip spec-chip--quiet">{excerpt(trigger, 40)}</span> : null}
                  </span>
                  {tagValue(entry.tags, 'symptom') && entry.description ? <span className="spec-row__note">{excerpt(entry.description)}</span> : null}
                </span>
                <div className="spec-row__actions">
                  <EditButton label={`${t(lang, 'Modifica', 'Edit')}: ${entry.description}`} onClick={() => { setEditing(entry); setOpen(true) }} />
                  <DeleteButton disabled={deletingId !== null} label={t(lang, 'Elimina', 'Delete')} onClick={() => remove(entry.id)} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {open ? (
        <EntrySheet onClose={() => setOpen(false)} title={editing ? t(lang, 'Modifica registrazione', 'Edit entry') : t(lang, 'Registra sintomo o evacuazione', 'Record symptom or bowel movement')}>
          <GutForm existing={editing} language={lang} onClose={() => setOpen(false)} onSave={(event) => data.saveEvent(event)} />
        </EntrySheet>
      ) : null}
    </section>
  )
}

function GutForm({
  existing,
  language,
  onClose,
  onSave,
}: {
  existing?: HealthEvent
  language: Loc
  onClose: () => void
  onSave: (event: HealthEvent) => Promise<void>
}) {
  const originalKind = tagValue(existing?.tags ?? [], 'kind') ?? 'Sintomo'
  const originalSymptom = tagValue(existing?.tags ?? [], 'symptom') ?? GUT_SYMPTOMS[0] ?? 'Mal di pancia'
  const originalIntensity = Number(tagValue(existing?.tags ?? [], 'intensity') ?? 5)
  const originalBristol = Number(tagValue(existing?.tags ?? [], 'bristol') ?? 4)
  const prefix = originalKind === 'Sintomo' ? `${originalSymptom} · ${originalIntensity}/10` : `Tipo ${originalBristol}`
  const originalNote = existing?.description.startsWith(prefix) ? existing.description.slice(prefix.length).replace(/^ · /, '') : existing?.description ?? ''
  const [kind, setKind] = useState(originalKind)
  const [symptom, setSymptom] = useState(originalSymptom)
  const [intensity, setIntensity] = useState(originalIntensity)
  const [bristol, setBristol] = useState(originalBristol)
  const [trigger, setTrigger] = useState(tagValue(existing?.tags ?? [], 'trigger') ?? '')
  const [note, setNote] = useState(originalNote)
  const [date, setDate] = useState(() => existing ? toDateTimeLocal(existing.occurredAt) : nowInput())
  const { error, save, saving } = useSheetSave(onSave, onClose, language)

  const submit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    const summary =
      kind === 'Sintomo'
        ? `${symptom} · ${intensity}/10${note ? ` · ${note}` : ''}`
        : `Tipo ${bristol}${note ? ` · ${note}` : ''}`
    const tags = [`kind=${kind}`, `symptom=${symptom}`, `intensity=${intensity}`, `bristol=${bristol}`, `trigger=${trigger}`]
    const unchangedSummary = existing && kind === originalKind && symptom === originalSymptom && intensity === originalIntensity && bristol === originalBristol && note === originalNote
    save(editedEvent(existing, buildEvent('digestive_health', fromDateTimeLocal(date), unchangedSummary ? existing.description : summary, tags), ['kind', 'symptom', 'intensity', 'bristol', 'trigger']))
  }

  return (
    <form className="spec-form" onSubmit={submit}>
      <div className="spec-segmented" role="group">
        <button aria-pressed={kind === 'Sintomo'} onClick={() => setKind('Sintomo')} type="button">
          {t(language, 'Sintomo', 'Symptom')}
        </button>
        <button aria-pressed={kind === 'Evacuazione'} onClick={() => setKind('Evacuazione')} type="button">
          {t(language, 'Evacuazione', 'Bowel movement')}
        </button>
      </div>

      <DateField language={language} onChange={setDate} value={date} />

      {kind === 'Sintomo' ? (
        <>
          <label>
            {t(language, 'Sintomo', 'Symptom')}
            <select onChange={(event) => setSymptom(event.target.value)} value={symptom}>
              {GUT_SYMPTOMS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            {t(language, `Intensità ${intensity}/10`, `Intensity ${intensity}/10`)}
            <input max={10} min={1} onChange={(event) => setIntensity(Number(event.target.value))} type="range" value={intensity} />
          </label>
        </>
      ) : (
        <label>
          {t(language, 'Scala Bristol', 'Bristol scale')}
          <select onChange={(event) => setBristol(Number(event.target.value))} value={bristol}>
            {[1, 2, 3, 4, 5, 6, 7].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <small>{t(language, '1–2 duro · 3–4 formato · 5–7 morbido/liquido', '1–2 hard · 3–4 formed · 5–7 soft/liquid')}</small>
        </label>
      )}

      <label>
        {t(language, 'Possibile alimento o trigger', 'Possible food or trigger')}
        <input onChange={(event) => setTrigger(event.target.value)} value={trigger} />
      </label>
      <label>
        {t(language, 'Nota', 'Note')}
        <textarea onChange={(event) => setNote(event.target.value)} rows={2} value={note} />
      </label>
      <SheetActions error={error} label={t(language, 'Salva', 'Save')} language={language} onClose={onClose} saving={saving} />
    </form>
  )
}
