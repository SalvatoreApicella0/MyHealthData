import { ProgressiveHistory } from '../../components/ProgressiveHistory'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { EntrySheet } from '../../components/EntrySheet'
import { createId } from '../../core/id'
import { eventSubsetSignature, eventsForTypes } from '../../core/eventSignatures'
import { fromDateTimeLocal, toDateTimeLocal } from '../../core/format'
import type { HealthAttachmentInput } from '../../storage/useHealthData'
import type { HealthEvent } from '../../core/types'
import { byDateDesc, buildEvent, editedEvent, formatDay, locale, nowInput, t, tagValue, type Loc } from './specialtyModel'
import { eyeSummary, isVisionIssue, prescriptionParts, VISION_KINDS } from './visionModel'
import { DateField, EditButton, Empty, SheetActions, useSheetSave } from './SpecialtyShared'
import type { SectionProps } from './SpecialtyShared'

/* ---------------------------------- Vista ---------------------------------- */

export function VisionSection({ data, language }: SectionProps) {
  const lang = locale(language)
  const [editing, setEditing] = useState<HealthEvent>()
  const [sheet, setSheet] = useState<'prescription' | null>(null)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteError, setNoteError] = useState('')

  const visionSignature = eventSubsetSignature(data.events, ['vision_prescription'])
  const visionEvents = useMemo(() => eventsForTypes(data.events, ['vision_prescription']), [data.events, visionSignature])
  const prescriptions = useMemo(
    () =>
      byDateDesc(
        visionEvents.filter(
          (event) => event.type === 'vision_prescription' && !isVisionIssue(event) && tagValue(event.tags, 'record') !== 'note',
        ),
      ),
    [visionEvents],
  )
  const notes = useMemo(
    () => byDateDesc(visionEvents.filter((event) => tagValue(event.tags, 'record') === 'note')),
    [visionEvents],
  )

  const latest = prescriptions[0]
  const parts = latest ? prescriptionParts(latest) : undefined
  const lastNote = notes[0]

  useEffect(() => {
    setNote(tagValue(lastNote?.tags ?? [], 'note') ?? '')
    setSaved(false)
  }, [lastNote])

  const saveNote = async (): Promise<void> => {
    const text = note.trim()
    if (!text || noteSaving) return
    const event = buildEvent('vision_prescription', new Date().toISOString(), text, ['record=note', `note=${text}`])
    setNoteSaving(true)
    setNoteError('')
    try {
      await data.saveEvent(event)
      setSaved(true)
    } catch {
      setNoteError(t(lang, 'Impossibile salvare la nota. Riprova.', 'Could not save the note. Try again.'))
    } finally {
      setNoteSaving(false)
    }
  }

  return (
    <section className="spec" data-module="vision">
      <header className="spec-head">
        <button className="btn btn--ghost btn--small" onClick={() => { setEditing(undefined); setSheet('prescription') }} type="button">
          <Plus size={14} />
          {t(lang, 'Prescrizione', 'Prescription')}
        </button>
      </header>

      {latest && parts ? (
        <article className="spec-hero">
          <header className="spec-hero__head">
            <span className="spec-hero__label">{t(lang, 'Ultima prescrizione', 'Latest prescription')}</span>
            <span className="spec-hero__kind">
              {parts.kind ?? t(lang, 'Occhiali', 'Glasses')} · {formatDay(latest.occurredAt, lang)}
            </span>
          </header>
          <PrescriptionDetails event={latest} language={lang} />
          <EditButton label={t(lang, 'Modifica prescrizione', 'Edit prescription')} onClick={() => { setEditing(latest); setSheet('prescription') }} />
        </article>
      ) : (
        <Empty label={t(lang, 'Nessuna prescrizione registrata.', 'No prescriptions recorded.')} />
      )}

      {prescriptions.length > 1 ? (
        <section className="spec-block">
          <h4 className="spec-title">{t(lang, 'Prescrizioni precedenti', 'Previous prescriptions')}</h4>
          <ProgressiveHistory items={prescriptions.slice(1)} language={language}>
            {(visible) => visible.map((event) => (
              <details className="spec-prescription-history" key={event.id}>
                <summary>{formatDay(event.occurredAt, lang)} · {prescriptionParts(event).kind ?? event.description}</summary>
                <PrescriptionDetails event={event} language={lang} />
                <EditButton label={`${t(lang, 'Modifica', 'Edit')}: ${formatDay(event.occurredAt, lang)}`} onClick={() => { setEditing(event); setSheet('prescription') }} />
              </details>
            ))}
          </ProgressiveHistory>
        </section>
      ) : null}

      <div className="spec-block">
        <h4 className="spec-title">{t(lang, 'Come sento gli occhi ora', 'How my eyes feel now')}</h4>
        <textarea
          aria-label={t(lang, 'Come sento gli occhi ora', 'How my eyes feel now')}
          onChange={(event) => {
            setNote(event.target.value)
            setSaved(false)
            setNoteError('')
          }}
          placeholder={t(lang, 'Es. occhi stanchi la sera', 'E.g. tired eyes in the evening')}
          rows={2}
          value={note}
        />
        <div className="spec-vision-note-actions">
          <span className="spec-row__date">
            {lastNote
              ? `${t(lang, 'Ultima nota', 'Last note')}: ${formatDay(lastNote.occurredAt, lang)}`
              : t(lang, 'Nessuna nota precedente.', 'No previous note.')}
          </span>
          <button className="btn btn--primary btn--small" disabled={!note.trim() || noteSaving} onClick={() => void saveNote()} type="button">
            {noteSaving ? t(lang, 'Salvataggio…', 'Saving…') : saved ? t(lang, 'Salvata', 'Saved') : t(lang, 'Salva nota', 'Save note')}
          </button>
        </div>
        {noteError ? <p aria-live="polite" className="spec-form__error" role="alert">{noteError}</p> : null}
      </div>

      {sheet === 'prescription' ? (
        <EntrySheet onClose={() => setSheet(null)} title={editing ? t(lang, 'Modifica prescrizione', 'Edit prescription') : t(lang, 'Nuova prescrizione', 'New prescription')}>
          <VisionPrescriptionForm
            existing={editing}
            language={lang}
            onClose={() => setSheet(null)}
            onSave={(event) => data.saveEvent(event)}
          />
        </EntrySheet>
      ) : null}
    </section>
  )
}

function VisionPrescriptionForm({
  existing,
  language,
  onClose,
  onSave,
}: {
  existing?: HealthEvent
  language: Loc
  onClose: () => void
  onSave: (event: HealthEvent, attachments?: HealthAttachmentInput[]) => Promise<void>
}) {
  const original = existing ? prescriptionParts(existing) : undefined
  const [date, setDate] = useState(() => existing ? toDateTimeLocal(existing.occurredAt) : nowInput())
  const [kind, setKind] = useState(original?.kind ?? VISION_KINDS[0] ?? 'Occhiali')
  const [professional, setProfessional] = useState(existing?.description ?? '')
  const [rs, setRs] = useState(original?.rs ?? '')
  const [rc, setRc] = useState(original?.rc ?? '')
  const [ra, setRa] = useState(original?.ra ?? '')
  const [ls, setLs] = useState(original?.ls ?? '')
  const [lc, setLc] = useState(original?.lc ?? '')
  const [la, setLa] = useState(original?.la ?? '')
  const [add, setAdd] = useState(original?.add ?? '')
  const [pd, setPd] = useState(original?.pd ?? '')
  const [attachmentFiles, setAttachmentFiles] = useState<HealthAttachmentInput[]>([])
  const { error, save, saving } = useSheetSave(onSave, onClose, language)

  const submit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    const description = professional.trim() || kind
    const tags = [`kind=${kind}`, `rs=${rs}`, `rc=${rc}`, `ra=${ra}`, `ls=${ls}`, `lc=${lc}`, `la=${la}`, `add=${add}`, `pd=${pd}`]
    const draft = buildEvent('vision_prescription', fromDateTimeLocal(date), description, tags)
    const updated = editedEvent(existing, draft, ['kind', 'rs', 'rc', 'ra', 'ls', 'lc', 'la', 'add', 'pd'])
    updated.attachments = [...(existing?.attachments ?? []), ...attachmentFiles.map(({ metadata }) => metadata)]
    save(updated, attachmentFiles)
  }

  return (
    <form className="spec-form" onSubmit={submit}>
      <DateField language={language} onChange={setDate} value={date} />
      <label>
        {t(language, 'Uso', 'Use')}
        <select onChange={(event) => setKind(event.target.value)} value={kind}>
          {VISION_KINDS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <label>
        {t(language, 'Ottico o oculista', 'Optician or ophthalmologist')}
        <input onChange={(event) => setProfessional(event.target.value)} placeholder={t(language, 'Opzionale', 'Optional')} value={professional} />
      </label>

      <div className="spec-form__grid">
        <fieldset className="spec-form__eye">
          <legend>OD · {t(language, 'Occhio destro', 'Right eye')}</legend>
          <label>
            {t(language, 'Sfera', 'Sphere')}
            <input inputMode="decimal" onChange={(event) => setRs(event.target.value)} value={rs} />
          </label>
          <label>
            {t(language, 'Cilindro', 'Cylinder')}
            <input inputMode="decimal" onChange={(event) => setRc(event.target.value)} value={rc} />
          </label>
          <label>
            {t(language, 'Asse', 'Axis')}
            <input inputMode="numeric" onChange={(event) => setRa(event.target.value)} value={ra} />
          </label>
        </fieldset>
        <fieldset className="spec-form__eye">
          <legend>OS · {t(language, 'Occhio sinistro', 'Left eye')}</legend>
          <label>
            {t(language, 'Sfera', 'Sphere')}
            <input inputMode="decimal" onChange={(event) => setLs(event.target.value)} value={ls} />
          </label>
          <label>
            {t(language, 'Cilindro', 'Cylinder')}
            <input inputMode="decimal" onChange={(event) => setLc(event.target.value)} value={lc} />
          </label>
          <label>
            {t(language, 'Asse', 'Axis')}
            <input inputMode="numeric" onChange={(event) => setLa(event.target.value)} value={la} />
          </label>
        </fieldset>
      </div>

      <div className="spec-form__grid">
        <label>
          ADD
          <input inputMode="decimal" onChange={(event) => setAdd(event.target.value)} value={add} />
        </label>
        <label>
          PD
          <input inputMode="decimal" onChange={(event) => setPd(event.target.value)} value={pd} />
        </label>
      </div>

      <label>
        {t(language, 'Allegato (solo riferimento)', 'Attachment (reference only)')}
        <input
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
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
          type="file"
        />
      </label>
      {attachmentFiles.length > 0 ? <p className="spec-form__note">{attachmentFiles.map(({ metadata }) => metadata.name).join(', ')}</p> : null}

      <SheetActions error={error} label={t(language, 'Salva prescrizione', 'Save prescription')} language={language} onClose={onClose} saving={saving} />
    </form>
  )
}


function PrescriptionDetails({ event, language: lang }: { event: HealthEvent; language: Loc }) {
  const parts = prescriptionParts(event)
  return <>
          <table className="spec-vision-table">
            <thead>
              <tr>
                <th scope="col"> </th>
                <th scope="col">OD · {t(lang, 'Destro', 'Right')}</th>
                <th scope="col">OS · {t(lang, 'Sinistro', 'Left')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{t(lang, 'Sfera', 'Sphere')}</th>
                <td>{parts.rs ?? '—'}</td>
                <td>{parts.ls ?? '—'}</td>
              </tr>
              <tr>
                <th scope="row">{t(lang, 'Cilindro', 'Cylinder')}</th>
                <td>{parts.rc ?? '—'}</td>
                <td>{parts.lc ?? '—'}</td>
              </tr>
              <tr>
                <th scope="row">{t(lang, 'Asse', 'Axis')}</th>
                <td>{parts.ra ?? '—'}</td>
                <td>{parts.la ?? '—'}</td>
              </tr>
              <tr>
                <th scope="row">ADD</th>
                <td colSpan={2}>{parts.add ?? '—'}</td>
              </tr>
              <tr>
                <th scope="row">PD</th>
                <td colSpan={2}>{parts.pd ?? '—'}</td>
              </tr>
            </tbody>
          </table>
          <ul className="spec-vision-summary">
            <li>{eyeSummary(lang, 'r', parts.rs, parts.rc)}</li>
            <li>{eyeSummary(lang, 'l', parts.ls, parts.lc)}</li>
          </ul>
  </>
}
