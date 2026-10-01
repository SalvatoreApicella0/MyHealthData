import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { createId } from '../../core/id'
import {
  isCycleEntryDateAllowed,
  localDateKey,
  parseEntries,
  startOfDay,
} from './cycleModel'
import {
  COPY,
  FLOW_LABELS,
  FLOW_OPTIONS,
  MOOD_LABELS,
  MOOD_OPTIONS,
} from './cycleFormsModel'
import type { CycleRole } from './cycleFormsModel'

function longDate(date: Date, language: 'it' | 'en'): string {
  return new Intl.DateTimeFormat(language === 'it' ? 'it-IT' : 'en-US', { dateStyle: 'medium' }).format(date)
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function sameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
}

const WEEKDAYS: Record<'it' | 'en', string[]> = {
  it: ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}

export function CycleMarkForm({
  language,
  onClose,
  onSave,
  defaultRole,
  defaultFlow,
  existing,
  onBusyChange,
}: {
  language: 'it' | 'en'
  onClose: () => void
  onSave: (record: Record<string, unknown>) => Promise<void>
  defaultRole: CycleRole
  defaultFlow: string
  existing?: Record<string, unknown>
  onBusyChange?: (busy: boolean) => void
}) {
  const copy = COPY[language]
  const today = startOfDay(new Date())
  const currentMonth = monthStart(today)
  const initialDate = existing ? parseEntries([existing])[0]?.date ?? today : today
  const [month, setMonth] = useState(() => monthStart(initialDate))
  const [selected, setSelected] = useState(initialDate)
  const [role, setRole] = useState<CycleRole>(defaultRole)
  const [flow, setFlow] = useState(defaultFlow)
  const [mood, setMood] = useState(typeof existing?.mood === 'string' ? existing.mood : '')
  const [symptoms, setSymptoms] = useState(typeof existing?.symptoms === 'string' ? existing.symptoms : '')
  const [note, setNote] = useState(typeof existing?.note === 'string' ? existing.note : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [recordId] = useState(() => existing?.id ?? createId('cycle'))
  const inFlight = useRef(false)

  const monthLabel = new Intl.DateTimeFormat(language === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' }).format(month)
  const selectedLabel = longDate(selected, language)
  const leading = (month.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: Array<Date | undefined> = [
    ...Array.from({ length: leading }, () => undefined),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
  ]

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (inFlight.current) return
    if (!isCycleEntryDateAllowed(selected, today)) {
      setError(language === 'it' ? 'Scegli una data non futura.' : 'Choose a date that is not in the future.')
      return
    }
    const now = new Date().toISOString()
    const record: Record<string, unknown> = {
      ...existing,
      id: recordId,
      date: localDateKey(selected),
      isPeriodStart: role === 'start',
      isPeriodEnd: role === 'end',
      isPeriodDay: role === 'day',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    if (existing && role === defaultRole) {
      record.isPeriodStart = existing.isPeriodStart
      record.isPeriodEnd = existing.isPeriodEnd
      record.isPeriodDay = existing.isPeriodDay
    }
    record.flow = flow || undefined
    record.mood = mood || undefined
    record.symptoms = symptoms.trim() || undefined
    record.note = note.trim() || undefined
    inFlight.current = true
    onBusyChange?.(true)
    setSaving(true)
    setError('')
    void onSave(record)
      .catch(() => setError(language === 'it' ? 'Impossibile salvare il dato. Riprova.' : 'Could not save the entry. Try again.'))
      .finally(() => { inFlight.current = false; onBusyChange?.(false); setSaving(false) })
  }

  const roleOptions: Array<{ id: CycleRole; label: string }> = [
    { id: 'start', label: copy.roleStart },
    { id: 'end', label: copy.roleEnd },
    { id: 'day', label: copy.roleDay },
  ]

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="cycle-calendar full-width">
        <div className="cycle-calendar__head">
          <button
            aria-label={language === 'it' ? 'Mese precedente' : 'Previous month'}
            className="btn btn--icon btn--ghost"
            disabled={saving}
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            type="button"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="cycle-calendar__label">{monthLabel}</span>
          <button
            aria-label={language === 'it' ? 'Mese successivo' : 'Next month'}
            className="btn btn--icon btn--ghost"
            disabled={saving || month >= currentMonth}
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            type="button"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="cycle-calendar__weekdays">
          {WEEKDAYS[language].map((day) => (
            <span className="cycle-calendar__weekday" key={day}>{day}</span>
          ))}
        </div>
        <div className="cycle-calendar__grid">
          {cells.map((day, index) =>
            day ? (
              <button
                aria-label={longDate(day, language)}
                aria-pressed={sameDay(day, selected)}
                className="cycle-calendar__day"
                data-selected={sameDay(day, selected)}
                data-today={sameDay(day, today)}
                key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                disabled={saving || !isCycleEntryDateAllowed(day, today)}
                onClick={() => setSelected(day)}
                type="button"
              >
                {day.getDate()}
              </button>
            ) : (
              <span className="cycle-calendar__blank" key={`blank-${index}`} />
            ),
          )}
        </div>
        <p className="cycle-calendar__selected">
          {copy.selectedDay}: <strong>{selectedLabel}</strong>
        </p>
      </div>

      <div aria-label={language === 'it' ? 'Tipo di registrazione' : 'Entry type'} className="segmented full-width" role="group">
        {roleOptions.map((option) => (
          <button
            aria-pressed={role === option.id}
            disabled={saving}
            key={option.id}
            onClick={() => setRole(option.id)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      <label>
        {copy.flow}
        <select disabled={saving} onChange={(event) => setFlow(event.target.value)} value={flow}>
          <option value="">{copy.unit}</option>
          {flow && !FLOW_OPTIONS.some((option) => option === flow) ? <option value={flow}>{flow}</option> : null}
          {FLOW_OPTIONS.map((option) => (
            <option key={option} value={option}>{FLOW_LABELS[option]?.[language] ?? option}</option>
          ))}
        </select>
      </label>
      <label>
        {copy.mood}
        <select disabled={saving} onChange={(event) => setMood(event.target.value)} value={mood}>
          <option value="">{copy.unit}</option>
          {mood && !MOOD_OPTIONS.some((option) => option === mood) ? <option value={mood}>{mood}</option> : null}
          {MOOD_OPTIONS.map((option) => (
            <option key={option} value={option}>{MOOD_LABELS[option]?.[language] ?? option}</option>
          ))}
        </select>
      </label>
      <label className="full-width">
        {copy.symptoms}
        <input disabled={saving} onChange={(event) => setSymptoms(event.target.value)} value={symptoms} />
      </label>
      <label className="full-width">
        {copy.markNote}
        <textarea disabled={saving} onChange={(event) => setNote(event.target.value)} value={note} />
      </label>

      {error ? <p aria-live="polite" className="scroll-data__empty full-width" role="alert">{error}</p> : null}
      <div className="form-actions full-width">
        <button className="btn btn--ghost btn--small" disabled={saving} onClick={onClose} type="button">
          {copy.cancel}
        </button>
        <button className="btn btn--primary btn--small" disabled={saving} type="submit">
          <Check aria-hidden="true" size={13} />
          {saving ? (language === 'it' ? 'Salvataggio…' : 'Saving…') : copy.save}
        </button>
      </div>
    </form>
  )
}
