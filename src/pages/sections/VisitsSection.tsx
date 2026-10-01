import { CalendarClock, CalendarDays, Check, ClipboardList, Clock3, FileText, MessageCircleQuestion, Pencil, Stethoscope, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { snapshotRecords } from '../../core/healthModules'
import { isUpcomingAppointment } from '../calendarModel'
import { VISIT_CATEGORIES, VISIT_CATEGORY_LABELS as CATEGORY_LABELS } from '../../core/canonicalDomains'
import { appointmentFormValuesFromRecord, appointmentRecordFromForm } from '../calendarModel'
import type { HealthDataController } from '../../storage/useHealthData'
import './visitsSection.css'

interface VisitsSectionProps {
  data: HealthDataController
  language: string
  onOpenDocuments?: () => void
  appointmentId?: string
}

const STATUS_LABELS: Record<string, { it: string; en: string }> = {
  planned: { it: 'Programmato', en: 'Planned' },
  awaitingReport: { it: 'Referto da ritirare', en: 'Report to collect' },
  completed: { it: 'Fatto', en: 'Done' },
  cancelled: { it: 'Annullato', en: 'Cancelled' },
}

type Loc = 'it' | 'en'

function locale(language: string): Loc {
  return language === 'en' ? 'en' : 'it'
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function formatDateTime(value: Date, lang: Loc): string {
  return new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function formatDate(value: Date, lang: Loc): string {
  return new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value)
}

function categoryLabel(raw: string | undefined, lang: Loc): string | undefined {
  if (!raw) return undefined
  const known = CATEGORY_LABELS[raw]
  if (known) return known[lang]
  return raw.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function statusLabel(raw: string | undefined, lang: Loc): string | undefined {
  if (!raw) return undefined
  const known = STATUS_LABELS[raw]
  if (known) return known[lang]
  return raw
}

function localDateTime(value: unknown): string {
  const date = parseDate(value) ?? new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function localDate(value: unknown): string {
  return localDateTime(value).slice(0, 10)
}

function LinkedDocument({ record, data, lang, onOpen }: { record: Record<string, unknown>; data: HealthDataController; lang: Loc; onOpen?: () => void }) {
  const documentId = stringField(record, 'linkedDocumentId')
  if (!documentId) return null
  const document = data.documents.find((item) => item.id === documentId)
  if (!document) return null
  return (
    <button
      className="visitsx__tag visitsx__tag--accent visitsx__tag-button"
      onClick={() => {
        if (!onOpen) return
        try { window.sessionStorage.setItem('mhd.pending-document', documentId) } catch { /* Event remains available when storage is disabled. */ }
        window.dispatchEvent(new CustomEvent('mhd:open-document', { detail: documentId }))
        onOpen()
      }}
      type="button"
    >
      <FileText size={12} />{document.title || (lang === 'it' ? 'Documento collegato' : 'Linked document')}
    </button>
  )
}

function VisitActions({ record, data, lang }: { record: Record<string, unknown>; data: HealthDataController; lang: Loc }) {
  const [editing, setEditing] = useState(false)
  const initialForm = appointmentFormValuesFromRecord(record)
  const [title, setTitle] = useState(initialForm.title)
  const [scheduledAt, setScheduledAt] = useState(initialForm.scheduledAt)
  const [category, setCategory] = useState(initialForm.category)
  const [clinician, setClinician] = useState(initialForm.clinician)
  const [reason, setReason] = useState(initialForm.reason)
  const [preparationNotes, setPreparationNotes] = useState(initialForm.preparationNotes)
  const [outcome, setOutcome] = useState(initialForm.outcome)
  const [recurrenceNote, setRecurrenceNote] = useState(initialForm.recurrenceNote)
  const [reportCollectionAt, setReportCollectionAt] = useState(() => localDate(record.reportCollectionAt))
  const [questions, setQuestions] = useState(initialForm.questions)
  const [followUpAt, setFollowUpAt] = useState(initialForm.followUpAt)
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(initialForm.reminderMinutesBefore)
  const [linkedDocumentId, setLinkedDocumentId] = useState(initialForm.linkedDocumentId)
  const [status, setStatus] = useState(initialForm.status ?? 'planned')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const terminal = record.status === 'completed' || record.status === 'cancelled'
  const update = async (changes: Record<string, unknown>) => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await data.saveCanonicalRecord('appointments', { ...record, ...changes, updatedAt: new Date().toISOString() })
      setEditing(false)
    } catch {
      setError(lang === 'it' ? 'Impossibile aggiornare la visita. Riprova.' : 'Could not update the visit. Try again.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="visitsx__actions">
      {!terminal ? (
        <>
          <button className="btn btn--ghost btn--small" disabled={saving} onClick={() => void update({ status: 'completed' })} type="button">
            <Check size={13} /> {lang === 'it' ? 'Completa' : 'Complete'}
          </button>
          <button className="btn btn--ghost btn--small" disabled={saving} onClick={() => void update({ status: 'cancelled' })} type="button">
            <X size={13} /> {lang === 'it' ? 'Annulla' : 'Cancel'}
          </button>
        </>
      ) : null}
      <button className="btn btn--ghost btn--small" disabled={saving} onClick={() => setEditing((value) => !value)} type="button">
        <Pencil size={13} /> {lang === 'it' ? 'Modifica' : 'Edit'}
      </button>
      {editing ? (
        <form className="visitsx__edit" onSubmit={(event) => {
          event.preventDefault()
          const existingLinkedDocumentId = stringField(record, 'linkedDocumentId')
          const validDocument = linkedDocumentId ? data.documents.some((document) => document.id === linkedDocumentId) || linkedDocumentId === existingLinkedDocumentId : true
          const nextRecord = appointmentRecordFromForm({
            title,
            scheduledAt,
            category,
            clinician,
            reason,
            preparationNotes,
            outcome,
            recurrenceNote,
            reportCollectionAt,
            questions,
            followUpAt,
            reminderMinutesBefore,
            linkedDocumentId,
            status,
          }, { id: String(record.id ?? ''), now: new Date().toISOString() }, record)
          if (!nextRecord || !validDocument) {
            setError(lang === 'it' ? 'Controlla titolo, data, promemoria e documento collegato.' : 'Check the title, date, reminder and linked document.')
            return
          }
          void update(nextRecord)
        }}>
          <label>
            {lang === 'it' ? 'Titolo' : 'Title'}
            <input disabled={saving} onChange={(event) => setTitle(event.target.value)} required value={title} />
          </label>
          <label>
            {lang === 'it' ? 'Quando' : 'When'}
            <input disabled={saving} onChange={(event) => setScheduledAt(event.target.value)} type="datetime-local" value={scheduledAt} />
          </label>
          <label>
            {lang === 'it' ? 'Categoria' : 'Category'}
            <select disabled={saving} onChange={(event) => setCategory(event.target.value)} value={category}>
              {VISIT_CATEGORIES.map((option) => <option key={option} value={option}>{CATEGORY_LABELS[option]?.[lang] ?? option}</option>)}
            </select>
          </label>
          <label>
            {lang === 'it' ? 'Medico o struttura' : 'Clinician or site'}
            <input disabled={saving} onChange={(event) => setClinician(event.target.value)} value={clinician} />
          </label>
          <label>
            {lang === 'it' ? 'Motivo' : 'Reason'}
            <textarea disabled={saving} onChange={(event) => setReason(event.target.value)} rows={2} value={reason} />
          </label>
          <label>
            {lang === 'it' ? 'Note / preparazione' : 'Notes / preparation'}
            <textarea disabled={saving} onChange={(event) => setPreparationNotes(event.target.value)} rows={2} value={preparationNotes} />
          </label>
          <details className="visitsx__advanced" open={Boolean(outcome || recurrenceNote || reportCollectionAt || questions || followUpAt || reminderMinutesBefore || linkedDocumentId)}>
            <summary>
              <span>{lang === 'it' ? 'Dettagli avanzati' : 'Advanced details'}</span>
              <small>{lang === 'it' ? 'Referto, controllo, promemoria e domande' : 'Report, follow-up, reminder and questions'}</small>
            </summary>
            <div className="visitsx__advanced-grid">
              <label>
                {lang === 'it' ? 'Esito' : 'Outcome'}
                <textarea disabled={saving} onChange={(event) => setOutcome(event.target.value)} rows={2} value={outcome} />
              </label>
              <label>
                {lang === 'it' ? 'Ricorrenza' : 'Recurrence'}
                <input disabled={saving} onChange={(event) => setRecurrenceNote(event.target.value)} value={recurrenceNote} />
              </label>
              <label>
                {lang === 'it' ? 'Ritiro referto' : 'Report collection'}
                <input disabled={saving} onChange={(event) => setReportCollectionAt(event.target.value)} type="date" value={reportCollectionAt} />
              </label>
              <label>
                {lang === 'it' ? 'Controllo successivo' : 'Follow-up'}
                <input disabled={saving} onChange={(event) => setFollowUpAt(event.target.value)} type="datetime-local" value={followUpAt} />
              </label>
              <label>
                {lang === 'it' ? 'Promemoria' : 'Reminder'}
                <select disabled={saving} onChange={(event) => setReminderMinutesBefore(event.target.value)} value={reminderMinutesBefore}>
                  <option value="">{lang === 'it' ? 'Nessun promemoria' : 'No reminder'}</option>
                  <option value="60">{lang === 'it' ? '1 ora prima' : '1 hour before'}</option>
                  <option value="1440">{lang === 'it' ? '1 giorno prima' : '1 day before'}</option>
                  <option value="2880">{lang === 'it' ? '2 giorni prima' : '2 days before'}</option>
                  <option value="10080">{lang === 'it' ? '1 settimana prima' : '1 week before'}</option>
                </select>
              </label>
              <label>
                {lang === 'it' ? 'Domande da ricordare' : 'Questions to remember'}
                <textarea disabled={saving} onChange={(event) => setQuestions(event.target.value)} placeholder={lang === 'it' ? 'Una domanda per riga' : 'One question per line'} rows={3} value={questions} />
              </label>
              {data.documents.length > 0 || linkedDocumentId ? (
                <label>
                  {lang === 'it' ? 'Documento collegato' : 'Linked document'}
                  <select disabled={saving} onChange={(event) => setLinkedDocumentId(event.target.value)} value={linkedDocumentId}>
                    <option value="">{lang === 'it' ? 'Nessun documento' : 'No document'}</option>
                    {linkedDocumentId && !data.documents.some((document) => document.id === linkedDocumentId) ? <option value={linkedDocumentId}>{lang === 'it' ? 'Documento collegato non disponibile' : 'Linked document unavailable'}</option> : null}
                    {data.documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
          </details>
          <label>
            {lang === 'it' ? 'Stato' : 'Status'}
            <select disabled={terminal} onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="planned">{lang === 'it' ? 'Programmato' : 'Planned'}</option>
              <option value="awaitingReport">{lang === 'it' ? 'Referto da ritirare' : 'Report to collect'}</option>
              <option value="completed">{lang === 'it' ? 'Fatto' : 'Completed'}</option>
              <option value="cancelled">{lang === 'it' ? 'Annullato' : 'Cancelled'}</option>
            </select>
          </label>
          {error ? <p aria-live="polite" className="visitsx__error" role="alert">{error}</p> : null}
          <button className="btn btn--primary btn--small" disabled={saving} type="submit">{lang === 'it' ? 'Salva' : 'Save'}</button>
        </form>
      ) : null}
    </div>
  )
}

export function VisitsSection({ data, language, onOpenDocuments, appointmentId }: VisitsSectionProps) {
  const lang = locale(language)
  const appointments = useMemo(
    () => snapshotRecords(data as unknown as Record<string, unknown>, 'appointments').filter((record) => appointmentId === undefined || record.id === appointmentId),
    [data.appointments, appointmentId],
  )
  const { history, needingAction, pastCount, upcoming } = useMemo(() => {
    const now = Date.now()
    const parsed = appointments.map((record) => ({ record, at: parseDate(record.scheduledAt ?? record.date) }))
    const upcoming = parsed
      .filter((entry): entry is { record: Record<string, unknown>; at: Date } => entry.at !== undefined && isUpcomingAppointment(entry.record, now))
      .sort((left, right) => left.at.getTime() - right.at.getTime())
      .slice(0, 4)
    const needingAction = appointments.filter((record) => record.status === 'awaitingReport')
    const pastCount = parsed.filter((entry) => entry.record.status !== 'cancelled' && Boolean(entry.at && entry.at.getTime() < now)).length
    const history = parsed
      .filter((entry): entry is { record: Record<string, unknown>; at: Date } => {
        if (entry.record.status === 'awaitingReport') return false
        return entry.record.status === 'completed' || entry.record.status === 'cancelled' || Boolean(entry.at && entry.at.getTime() < now)
      })
      .sort((left, right) => right.at.getTime() - left.at.getTime())
    return { history, needingAction, pastCount, upcoming }
  }, [appointments])

  const empty = upcoming.length === 0 && needingAction.length === 0 && history.length === 0

  if (appointments.length === 0) {
    return (
      <div className="visitsx">
        <p className="visitsx__empty">
          {lang === 'it' ? 'Nessun appuntamento registrato.' : 'No appointments recorded.'}
        </p>
      </div>
    )
  }

  return (
    <div className="visitsx">
      {needingAction.length > 0 ? (
        <div className="visitsx__group">
          <h4 className="visitsx__group-title">
            <ClipboardList aria-hidden="true" size={14} />
            {lang === 'it' ? 'Da fare' : 'To do'}
          </h4>
          <ul className="visitsx__list">
            {needingAction.map((record, index) => {
              const report = parseDate(record.reportCollectionAt)
              return (
                <li className="visitsx__row" data-status="awaitingReport" key={String(record.id ?? index)}>
                  <div className="visitsx__titleline">
                    <span className="visitsx__title">{stringField(record, 'title') ?? (lang === 'it' ? 'Appuntamento' : 'Appointment')}</span>
                    <span className="visitsx__status" data-status="awaitingReport">{statusLabel('awaitingReport', lang)}</span>
                  </div>
                  <div className="visitsx__meta">
                    {report ? <span className="visitsx__tag visitsx__tag--warn"><Clock3 size={12} />{lang === 'it' ? 'Ritiro referto' : 'Report from'} {formatDate(report, lang)}</span> : null}
                  </div>
                  <VisitActions data={data} lang={lang} record={record} />
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="visitsx__group">
          <h4 className="visitsx__group-title">
            <CalendarClock aria-hidden="true" size={14} />
            {lang === 'it' ? 'Prossimi' : 'Upcoming'}
          </h4>
          <ul className="visitsx__list">
            {upcoming.map(({ record, at }) => {
              const category = categoryLabel(stringField(record, 'category'), lang)
              const clinician = stringField(record, 'clinician')
              const notes = stringField(record, 'preparationNotes')
              const followUp = parseDate(record.followUpAt)
              const questions = Array.isArray(record.questions) ? record.questions.length : 0
              return (
                <li className="visitsx__row" data-status={String(record.status ?? 'planned')} key={String(record.id ?? at.getTime())}>
                  <div className="visitsx__titleline">
                    <span className="visitsx__title">{stringField(record, 'title') ?? (lang === 'it' ? 'Appuntamento' : 'Appointment')}</span>
                    <span className="visitsx__date">{formatDateTime(at, lang)}</span>
                  </div>
              <div className="visitsx__meta">
                {category ? <span className="visitsx__tag">{category}</span> : null}
                {clinician ? <span className="visitsx__tag visitsx__tag--muted"><Stethoscope size={12} />{clinician}</span> : null}
                {stringField(record, 'reason') ? <span className="visitsx__tag visitsx__tag--muted">{stringField(record, 'reason')}</span> : null}
                {questions > 0 ? (
                      <span className="visitsx__tag visitsx__tag--accent"><MessageCircleQuestion size={12} />{questions} {lang === 'it' ? 'domande' : 'questions'}</span>
                  ) : null}
                  {typeof record.reminderMinutesBefore === 'number' ? <p className="visitsx__follow">{lang === 'it' ? `Promemoria ${record.reminderMinutesBefore} min prima` : `Reminder ${record.reminderMinutesBefore} min before`}</p> : null}
                    <LinkedDocument data={data} lang={lang} onOpen={onOpenDocuments} record={record} />
                    <span className="visitsx__status" data-status={String(record.status ?? 'planned')}>{statusLabel(String(record.status ?? 'planned'), lang)}</span>
                  </div>
                  {notes ? <p className="visitsx__note">{notes}</p> : null}
                  {followUp ? <p className="visitsx__follow">{lang === 'it' ? 'Controllo' : 'Follow-up'} {formatDate(followUp, lang)}</p> : null}
                  <VisitActions data={data} lang={lang} record={record} />
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div className="visitsx__group">
          <h4 className="visitsx__group-title">
            <CalendarDays aria-hidden="true" size={14} />
            {lang === 'it' ? 'Storico' : 'History'}
          </h4>
          <ul className="visitsx__list">
            {history.map(({ record, at }) => {
              const category = categoryLabel(stringField(record, 'category'), lang)
              return (
                <li className="visitsx__row" data-status={String(record.status ?? 'planned')} key={`history-${String(record.id ?? at.getTime())}`}>
                  <div className="visitsx__titleline">
                    <span className="visitsx__title">{stringField(record, 'title') ?? (lang === 'it' ? 'Visita' : 'Visit')}</span>
                    <span className="visitsx__date">{formatDateTime(at, lang)}</span>
                  </div>
                  <div className="visitsx__meta">
                    {category ? <span className="visitsx__tag">{category}</span> : null}
                    <LinkedDocument data={data} lang={lang} onOpen={onOpenDocuments} record={record} />
                    <span className="visitsx__status" data-status={String(record.status ?? 'planned')}>{statusLabel(String(record.status ?? 'planned'), lang)}</span>
                  </div>
                  <VisitActions data={data} lang={lang} record={record} />
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {empty ? (
        <p className="visitsx__empty">
          {lang === 'it' ? 'Nessun appuntamento in programma.' : 'No upcoming appointments.'}
        </p>
      ) : null}

      {pastCount > 0 && history.length === 0 ? (
        <p className="visitsx__past">
          <CalendarDays aria-hidden="true" size={13} />
          {lang === 'it' ? `${pastCount} appuntamenti passati` : `${pastCount} past appointments`}
        </p>
      ) : null}
    </div>
  )
}
