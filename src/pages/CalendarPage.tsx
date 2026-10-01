import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Plus } from 'lucide-react'
import { EntrySheet } from '../components/EntrySheet'
import { createId } from '../core/id'
import { isoFromLocalInput } from '../core/canonicalForm'
import { VISIT_CATEGORIES, VISIT_CATEGORY_LABELS } from '../core/canonicalDomains'
import { snapshotRecords } from '../core/healthModules'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'
import { appointmentRecordFromForm, isUpcomingAppointment } from './calendarModel'
import { VisitsSection } from './sections/VisitsSection'
import './calendarPage.css'

interface CalendarPageProps {
  data: HealthDataController
}

function localDateTimeNow(): string {
  const date = new Date()
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function monthStart(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function monthDays(value: Date): Date[] {
  const start = monthStart(value)
  const firstWeekday = (start.getDay() + 6) % 7
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  return Array.from({ length: Math.ceil((firstWeekday + days) / 7) * 7 }, (_, index) => {
    const offset = index - firstWeekday
    return new Date(start.getFullYear(), start.getMonth(), offset + 1)
  })
}

export function calendarDayKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

export function CalendarPage({ data }: CalendarPageProps) {
  const { t, language } = useI18n()
  const [addOpen, setAddOpen] = useState(false)
  const [detailId, setDetailId] = useState<string>()
  const [title, setTitle] = useState('')
  const [scheduledAt, setScheduledAt] = useState(localDateTimeNow)
  const [category, setCategory] = useState('general')
  const [clinician, setClinician] = useState('')
  const [reason, setReason] = useState('')
  const [preparationNotes, setPreparationNotes] = useState('')
  const [outcome, setOutcome] = useState('')
  const [recurrenceNote, setRecurrenceNote] = useState('')
  const [reportCollectionAt, setReportCollectionAt] = useState('')
  const [questions, setQuestions] = useState('')
  const [followUpAt, setFollowUpAt] = useState('')
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState('')
  const [linkedDocumentId, setLinkedDocumentId] = useState('')
  const [saving, setSaving] = useState(false)
  const saveInFlight = useRef(false)
  const [error, setError] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => monthStart(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => calendarDayKey(new Date()))
  const locale = language === 'it' ? 'it-IT' : 'en-US'
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale])
  const dayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }), [locale])
  const selectedDayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }), [locale])
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { timeStyle: 'short' }), [locale])
  const appointments = useMemo(
    () => snapshotRecords(data as unknown as Record<string, unknown>, 'appointments'),
    [data.appointments],
  )
  const appointmentCount = appointments.length
  const upcomingAppointmentCount = useMemo(
    () => appointments.filter((record) => isUpcomingAppointment(record)).length,
    [appointments],
  )
  const calendarCells = useMemo(() => monthDays(calendarMonth), [calendarMonth])
  const appointmentsByDay = useMemo(() => {
    const grouped = new Map<string, Array<Record<string, unknown>>>()
    for (const appointment of appointments) {
      const date = new Date(String(appointment.scheduledAt ?? appointment.date ?? ''))
      if (Number.isNaN(date.getTime())) continue
      const key = calendarDayKey(date)
      const day = grouped.get(key)
      if (day) day.push(appointment)
      else grouped.set(key, [appointment])
    }
    for (const entries of grouped.values()) {
      entries.sort((a, b) => new Date(String(a.scheduledAt ?? a.date)).getTime() - new Date(String(b.scheduledAt ?? b.date)).getTime())
    }
    return grouped
  }, [appointments])
  const monthLabel = monthFormatter.format(calendarMonth)
  const weekdayLabels = language === 'it' ? ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const selectedAppointments = appointmentsByDay.get(selectedDay) ?? []
  const selectedDayLabel = selectedDayFormatter.format(new Date(`${selectedDay}T12:00:00`))

  const openAdd = () => {
    if (addOpen || saving || saveInFlight.current) return
    // Preserve a visible, editable local time; never derive the day through UTC.
    setScheduledAt(`${selectedDay}T${localDateTimeNow().slice(11)}`)
    setAddOpen(true)
  }
  const openDocuments = () => { window.location.hash = '#/documents' }
  const detailAppointment = appointments.find((appointment) => appointment.id === detailId)

  const closeAdd = (force = false) => {
    if (!force && (saving || saveInFlight.current)) return
    setAddOpen(false)
    setTitle('')
    setScheduledAt(localDateTimeNow())
    setCategory('general')
    setClinician('')
    setReason('')
    setPreparationNotes('')
    setOutcome('')
    setRecurrenceNote('')
    setReportCollectionAt('')
    setQuestions('')
    setFollowUpAt('')
    setReminderMinutesBefore('')
    setLinkedDocumentId('')
    setError('')
  }
  useEffect(() => {
    const openRequestedAppointment = openAdd
    try {
      if (window.sessionStorage.getItem('mhd.pending-add') === 'appointment') {
        openAdd()
        window.sessionStorage.removeItem('mhd.pending-add')
      }
    } catch {
      // Storage can be disabled; the event below remains available.
    }
    window.addEventListener('mhd:open-appointment', openRequestedAppointment)
    return () => window.removeEventListener('mhd:open-appointment', openRequestedAppointment)
  }, [selectedDay, addOpen, saving])

  return (
    <section className="page-stack">
      <div className="module-toolbar">
        <div className="module-header">
          <span className="icon-orb icon-orb--lg" style={{ '--orb-tint': '#007AFF' } as React.CSSProperties}>
            <CalendarDays aria-hidden="true" size={24} />
          </span>
          <span className="module-header__copy">
            <h1>{t('calendar.title')}</h1>
            <p>{t('calendar.subtitle')}</p>
          </span>
        </div>
        <div className="chip-row">
          <button className="btn btn--primary btn--small" onClick={openAdd} type="button">
            <Plus size={15} />
            {t('calendar.newAppointment')}
          </button>
          <button className="btn btn--ghost btn--small" onClick={() => window.location.hash = '#/documents'} type="button">
            <FileText size={15} />
            {t('nav.documents')}
          </button>
        </div>
      </div>

      {appointmentCount === 0 ? (
        <div className="banner banner--info">
          <CalendarDays aria-hidden="true" size={18} />
          <span>
            {language === 'it' ? 'Scegli un giorno e aggiungi il primo appuntamento. Puoi gestire le visite anche senza Hub.' : 'Choose a day and add your first appointment. You can manage visits without a Hub.'}
          </span>
        </div>
      ) : null}

      <section className="panel">
        <div className="calendar-grid__toolbar">
          <button aria-label={language === 'it' ? 'Mese precedente' : 'Previous month'} className="btn btn--ghost btn--small" onClick={() => setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))} type="button"><ChevronLeft size={15} /></button>
          <div className="calendar-grid__month-copy">
            <h2>{monthLabel}</h2>
            <button className="calendar-grid__today" onClick={() => { const today = new Date(); setCalendarMonth(monthStart(today)); setSelectedDay(calendarDayKey(today)) }} type="button">
              {language === 'it' ? 'Oggi' : 'Today'}
            </button>
          </div>
          <button aria-label={language === 'it' ? 'Mese successivo' : 'Next month'} className="btn btn--ghost btn--small" onClick={() => setCalendarMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))} type="button"><ChevronRight size={15} /></button>
        </div>
        <div aria-label={language === 'it' ? 'Calendario appuntamenti' : 'Appointment calendar'} className="calendar-grid">
          {weekdayLabels.map((day) => <span className="calendar-grid__weekday" key={day}>{day}</span>)}
          {calendarCells.map((day, index) => {
            const key = calendarDayKey(day)
            const entries = appointmentsByDay.get(key) ?? []
            const inMonth = day.getMonth() === calendarMonth.getMonth()
            const dayLabel = dayFormatter.format(day)
            return <button aria-label={`${dayLabel}${entries.length > 0 ? ` · ${entries.length} ${language === 'it' ? 'appuntamenti' : 'appointments'}` : ''}`} aria-pressed={selectedDay === key} className="calendar-grid__day" data-in-month={inMonth} data-selected={selectedDay === key} data-today={key === calendarDayKey(new Date())} key={`${key}-${index}`} onClick={() => setSelectedDay(key)} type="button">
              <span className="calendar-grid__number">{day.getDate()}</span>
              {entries.length > 0 ? <small>{entries.length} {language === 'it' ? (entries.length === 1 ? 'visita' : 'visite') : (entries.length === 1 ? 'visit' : 'visits')}</small> : null}
            </button>
          })}
        </div>
        <div className="calendar-agenda">
          <div className="calendar-agenda__heading">
            <div>
              <span className="calendar-agenda__eyebrow">{language === 'it' ? 'Agenda del giorno' : 'Day agenda'}</span>
              <h3>{selectedDayLabel}</h3>
            </div>
            <button className="btn btn--ghost btn--small" onClick={openAdd} type="button">
              <Plus aria-hidden="true" size={15} />
              {language === 'it' ? 'Aggiungi a questo giorno' : 'Add to this day'}
            </button>
          </div>
          {selectedAppointments.length === 0 ? <p className="calendar-agenda__empty">{language === 'it' ? 'Nessun appuntamento per questo giorno.' : 'No appointments for this day.'}</p> : (
            <ul className="calendar-agenda__list">
              {selectedAppointments.map((appointment) => {
                const title = String(appointment.title ?? (language === 'it' ? 'Appuntamento' : 'Appointment'))
                const category = VISIT_CATEGORY_LABELS[String(appointment.category)]?.[language === 'it' ? 'it' : 'en']
                const status = { planned: ['Programmato', 'Planned'], completed: ['Fatto', 'Done'], cancelled: ['Annullato', 'Cancelled'], awaitingReport: ['Referto da ritirare', 'Report to collect'] }[String(appointment.status ?? 'planned')]
                return <li key={String(appointment.id)}>
                  <button aria-label={`${language === 'it' ? 'Dettagli appuntamento' : 'Appointment details'}: ${title}`} className="calendar-agenda__appointment" onClick={() => setDetailId(String(appointment.id))} type="button">
                    <time>{timeFormatter.format(new Date(String(appointment.scheduledAt ?? appointment.date)))}</time>
                    <span className="calendar-agenda__copy">
                      <strong>{title}</strong>
                      <span>{[category, appointment.clinician, status?.[language === 'it' ? 0 : 1]].filter(Boolean).join(' · ')}</span>
                      {typeof appointment.reason === 'string' && appointment.reason ? <span>{appointment.reason}</span> : null}
                    </span>
                    <ChevronRight aria-hidden="true" size={16} />
                  </button>
                </li>
              })}
            </ul>
          )}
        </div>
        <div className="panel__header">
          <h2>{t('calendar.upcoming')}</h2>
          <span className="tag">{upcomingAppointmentCount}</span>
        </div>
          <VisitsSection data={data} language={language} onOpenDocuments={openDocuments} />
      </section>

      {detailAppointment ? (
        <EntrySheet onClose={() => setDetailId(undefined)} title={language === 'it' ? 'Dettagli appuntamento' : 'Appointment details'}>
          <VisitsSection appointmentId={detailId} data={data} language={language} onOpenDocuments={openDocuments} />
        </EntrySheet>
      ) : null}

      {addOpen ? (
        <EntrySheet onClose={closeAdd} title={t('calendar.newAppointment')}>
          <form
            className="form-grid form-grid--single"
            onSubmit={(event) => {
              event.preventDefault()
              if (saving || saveInFlight.current) return
              const scheduledIso = isoFromLocalInput(scheduledAt)
              const linkedDocument = linkedDocumentId ? data.documents.some((document) => document.id === linkedDocumentId) : true
              const record = scheduledIso ? appointmentRecordFromForm({
                title,
                scheduledAt: scheduledIso,
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
              }, { id: createId('appointment'), now: new Date().toISOString() }) : undefined
              if (!record || !linkedDocument) {
                setError(t('calendar.validation'))
                return
              }
              saveInFlight.current = true
              setSaving(true)
              setError('')
              void data.saveCanonicalRecord('appointments', record as unknown as Record<string, unknown>).then(() => {
                closeAdd(true)
              }).catch(() => setError(t('calendar.saveError')))
                .finally(() => {
                  saveInFlight.current = false
                  setSaving(false)
                })
            }}
          >
            <label>
              {t('calendar.titleLabel')}
              <input autoFocus onChange={(event) => setTitle(event.target.value)} placeholder={t('calendar.titlePlaceholder')} required value={title} />
            </label>
            <label>
              {t('calendar.when')}
              <input onChange={(event) => setScheduledAt(event.target.value)} required type="datetime-local" value={scheduledAt} />
            </label>
            <label>
              {language === 'it' ? 'Categoria' : 'Category'}
              <select onChange={(event) => setCategory(event.target.value)} value={category}>
                {VISIT_CATEGORIES.map((option) => <option key={option} value={option}>{VISIT_CATEGORY_LABELS[option]?.[language === 'it' ? 'it' : 'en'] ?? option}</option>)}
              </select>
            </label>
            <label>
              {t('calendar.clinicianOptional')}
              <input onChange={(event) => setClinician(event.target.value)} value={clinician} />
            </label>
            <label>
              {t('calendar.reasonOptional')}
              <textarea onChange={(event) => setReason(event.target.value)} rows={3} value={reason} />
            </label>
            <label>
              {language === 'it' ? 'Note / preparazione' : 'Notes / preparation'}
              <textarea onChange={(event) => setPreparationNotes(event.target.value)} rows={3} value={preparationNotes} />
            </label>
            <details className="calendar-form__advanced">
              <summary>
                <span>{language === 'it' ? 'Dettagli avanzati' : 'Advanced details'}</span>
                <small>{language === 'it' ? 'Promemoria, referto e controllo successivo' : 'Reminder, report and follow-up'}</small>
              </summary>
              <div className="calendar-form__advanced-grid">
                <label>
                  {language === 'it' ? 'Esito' : 'Outcome'}
                  <textarea onChange={(event) => setOutcome(event.target.value)} rows={2} value={outcome} />
                </label>
                <label>
                  {language === 'it' ? 'Ricorrenza' : 'Recurrence'}
                  <input onChange={(event) => setRecurrenceNote(event.target.value)} placeholder={language === 'it' ? 'Es. ogni 6 mesi' : 'e.g. every 6 months'} value={recurrenceNote} />
                </label>
                <label>
                  {language === 'it' ? 'Ritiro referto' : 'Report collection'}
                  <input onChange={(event) => setReportCollectionAt(event.target.value)} type="date" value={reportCollectionAt} />
                </label>
                <label>
                  {language === 'it' ? 'Controllo successivo' : 'Follow-up'}
                  <input onChange={(event) => setFollowUpAt(event.target.value)} type="datetime-local" value={followUpAt} />
                </label>
                <label>
                  {language === 'it' ? 'Promemoria' : 'Reminder'}
                  <select onChange={(event) => setReminderMinutesBefore(event.target.value)} value={reminderMinutesBefore}>
                    <option value="">{language === 'it' ? 'Nessun promemoria' : 'No reminder'}</option>
                    <option value="60">{language === 'it' ? '1 ora prima' : '1 hour before'}</option>
                    <option value="1440">{language === 'it' ? '1 giorno prima' : '1 day before'}</option>
                    <option value="2880">{language === 'it' ? '2 giorni prima' : '2 days before'}</option>
                    <option value="10080">{language === 'it' ? '1 settimana prima' : '1 week before'}</option>
                  </select>
                </label>
                <label>
                  {language === 'it' ? 'Domande da ricordare' : 'Questions to remember'}
                  <textarea onChange={(event) => setQuestions(event.target.value)} placeholder={language === 'it' ? 'Una domanda per riga' : 'One question per line'} rows={3} value={questions} />
                </label>
                {data.documents.length > 0 ? (
                  <label>
                    {t('calendar.linkedDocumentOptional')}
                    <select onChange={(event) => setLinkedDocumentId(event.target.value)} value={linkedDocumentId}>
                      <option value="">{t('calendar.noDocument')}</option>
                      {data.documents.map((document) => (
                        <option key={document.id} value={document.id}>{document.title}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </details>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <div className="form-actions">
              <button className="btn btn--ghost" onClick={() => closeAdd()} type="button">{t('common.cancel')}</button>
              <button className="btn btn--primary" disabled={saving} type="submit">{saving ? '…' : t('common.save')}</button>
            </div>
          </form>
        </EntrySheet>
      ) : null}
    </section>
  )
}
