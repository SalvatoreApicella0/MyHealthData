import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Plus, Trash2, X } from 'lucide-react'
import { createId } from '../../core/id'
import type { GymDayData, GymPlanData, GymWorkoutData } from './gymModel'

type Loc = 'it' | 'en'

interface DraftExercise {
  key: string
  name: string
  sets: string
  repetitions: string
  load: string
  unit: string
  notes: string
}

interface DraftDay {
  key: string
  name: string
  exercises: DraftExercise[]
}

function draftExercise(): DraftExercise {
  return { key: createId('gym_draft'), name: '', sets: '3', repetitions: '10', load: '0', unit: 'kg', notes: '' }
}

function draftDay(index: number): DraftDay {
  return { key: createId('gym_draft'), name: `Giorno ${index + 1}`, exercises: [] }
}

function positiveInt(value: string, fallback: number): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback
}

function nonNegative(value: string, fallback: number): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function dateValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function timeValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function GymCompletionSheet({
  plan,
  day,
  language,
  onClose,
  onSave,
}: {
  plan: GymPlanData
  day?: GymDayData
  language: Loc
  onClose: () => void
  onSave: (startedAt: Date, notes: string) => Promise<void>
}) {
  const t = (itText: string, enText: string) => (language === 'it' ? itText : enText)
  const [date, setDate] = useState(() => dateValue(new Date()))
  const [time, setTime] = useState(() => timeValue(new Date()))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const startedAt = new Date(`${date}T${time}`)
    if (!date || !time || Number.isNaN(startedAt.getTime())) {
      setError(t('Inserisci data e ora valide.', 'Enter a valid date and time.'))
      return
    }
    setError('')
    setSaving(true)
    try {
      await onSave(startedAt, notes)
      onClose()
    } catch {
      setError(t('Impossibile salvare l’allenamento. Riprova.', 'Could not save the workout. Try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="gymx-form" onSubmit={(event) => void submit(event)}>
      <p className="gymx-form__target">{day ? `${plan.name} · ${day.name}` : plan.name}</p>
      <div className="gymx-form__grid">
        <label>
          {t('Data', 'Date')}
          <input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </label>
        <label>
          {t('Ora', 'Time')}
          <input onChange={(event) => setTime(event.target.value)} type="time" value={time} />
        </label>
      </div>
      <label>
        {t('Note', 'Notes')}
        <textarea onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} />
      </label>
      {error ? <p className="gymx-form__error">{error}</p> : null}
      <div className="gymx-form__actions">
        <button className="btn btn--ghost btn--small" onClick={onClose} type="button">
          {t('Annulla', 'Cancel')}
        </button>
        <button className="btn btn--primary btn--small" disabled={saving} type="submit">
          <Check size={13} />
          {saving ? t('Salvataggio…', 'Saving…') : t('Salva', 'Save')}
        </button>
      </div>
    </form>
  )
}

export function GymPlanSheet({
  language,
  onClose,
  onSave,
}: {
  language: Loc
  onClose: () => void
  onSave: (record: Record<string, unknown>) => Promise<void>
}) {
  const t = (itText: string, enText: string) => (language === 'it' ? itText : enText)
  const [name, setName] = useState('')
  const [days, setDays] = useState<DraftDay[]>(() => [draftDay(0)])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const patchDay = (key: string, patch: Partial<DraftDay>) => {
    setDays((current) => current.map((day) => (day.key === key ? { ...day, ...patch } : day)))
  }

  const patchExercise = (dayKey: string, key: string, patch: Partial<DraftExercise>) => {
    setDays((current) =>
      current.map((day) =>
        day.key === dayKey
          ? {
              ...day,
              exercises: day.exercises.map((exercise) =>
                exercise.key === key ? { ...exercise, ...patch } : exercise,
              ),
            }
          : day,
      ),
    )
  }

  const addExercise = (dayKey: string) => {
    setDays((current) =>
      current.map((day) =>
        day.key === dayKey ? { ...day, exercises: [...day.exercises, draftExercise()] } : day,
      ),
    )
  }

  const removeExercise = (dayKey: string, key: string) => {
    setDays((current) =>
      current.map((day) =>
        day.key === dayKey
          ? { ...day, exercises: day.exercises.filter((exercise) => exercise.key !== key) }
          : day,
      ),
    )
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const planName = name.trim()
    if (!planName) {
      setError(t('Inserisci il nome della scheda.', 'Enter the plan name.'))
      return
    }
    if (days.length === 0) {
      setError(t('Aggiungi almeno un giorno.', 'Add at least one day.'))
      return
    }
    const emptyDay = days.find((day) => !day.exercises.some((exercise) => exercise.name.trim() !== ''))
    if (emptyDay) {
      setError(t('Aggiungi almeno un esercizio a ogni giorno oppure rimuovi il giorno vuoto.', 'Add at least one exercise to every day or remove the empty day.'))
      return
    }
    const now = new Date().toISOString()
    const record: Record<string, unknown> = {
      id: createId('gym_plan'),
      name: planName,
      days: days.map((day, dayIndex) => ({
        id: createId('gym_plan_day'),
        name: day.name.trim() || `Giorno ${dayIndex + 1}`,
        order: dayIndex,
        exercises: day.exercises
          .filter((exercise) => exercise.name.trim() !== '')
          .map((exercise) => {
            const planned: Record<string, unknown> = {
              id: createId('gym_plan_exercise'),
              exerciseId: exercise.name.trim(),
              sets: positiveInt(exercise.sets, 3),
              repetitions: positiveInt(exercise.repetitions, 10),
              load: nonNegative(exercise.load, 0),
              unit: exercise.unit.trim() || 'kg',
            }
            const notes = exercise.notes.trim()
            if (notes) planned.notes = notes
            return planned
          }),
      })),
      createdAt: now,
      updatedAt: now,
    }
    setError('')
    setSaving(true)
    try {
      await onSave(record)
      onClose()
    } catch {
      setError(t('Impossibile salvare la scheda. Riprova.', 'Could not save the plan. Try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="gymx-form" onSubmit={(event) => void submit(event)}>
      <label>
        {t('Nome scheda', 'Plan name')}
        <input
          autoFocus
          onChange={(event) => setName(event.target.value)}
          placeholder={t('Scheda base', 'Base plan')}
          value={name}
        />
      </label>

      <div className="gymx-editor__days">
        {days.map((day, dayIndex) => (
          <article className="gymx-editor__day" key={day.key}>
            <div className="gymx-editor__day-head">
              <input
                aria-label={t(`Nome giorno ${dayIndex + 1}`, `Day ${dayIndex + 1} name`)}
                onChange={(event) => patchDay(day.key, { name: event.target.value })}
                value={day.name}
              />
              <button
                aria-label={t('Rimuovi giorno', 'Remove day')}
                className="gymx-iconbtn"
                onClick={() => setDays((current) => current.filter((entry) => entry.key !== day.key))}
                type="button"
              >
                <Trash2 size={13} />
              </button>
            </div>

            {day.exercises.map((exercise) => (
              <div className="gymx-editor__exercise" key={exercise.key}>
                <label className="gymx-editor__exercise-name">
                  {t('Esercizio', 'Exercise')}
                  <input
                    onChange={(event) => patchExercise(day.key, exercise.key, { name: event.target.value })}
                    value={exercise.name}
                  />
                </label>
                <div className="gymx-editor__row">
                  <label>
                    {t('Serie', 'Sets')}
                    <input
                      inputMode="numeric"
                      onChange={(event) => patchExercise(day.key, exercise.key, { sets: event.target.value })}
                      value={exercise.sets}
                    />
                  </label>
                  <label>
                    {t('Ripetizioni', 'Reps')}
                    <input
                      inputMode="numeric"
                      onChange={(event) =>
                        patchExercise(day.key, exercise.key, { repetitions: event.target.value })
                      }
                      value={exercise.repetitions}
                    />
                  </label>
                  <label>
                    {t('Carico', 'Load')}
                    <input
                      inputMode="decimal"
                      onChange={(event) => patchExercise(day.key, exercise.key, { load: event.target.value })}
                      value={exercise.load}
                    />
                  </label>
                </div>
                <div className="gymx-editor__row gymx-editor__row--two">
                  <label>
                    {t('Unità', 'Unit')}
                    <input
                      onChange={(event) => patchExercise(day.key, exercise.key, { unit: event.target.value })}
                      value={exercise.unit}
                    />
                  </label>
                  <label>
                    {t('Note', 'Notes')}
                    <input
                      onChange={(event) => patchExercise(day.key, exercise.key, { notes: event.target.value })}
                      value={exercise.notes}
                    />
                  </label>
                </div>
                <button
                  className="gymx-editor__remove"
                  onClick={() => removeExercise(day.key, exercise.key)}
                  type="button"
                >
                  <X size={12} />
                  {t('Rimuovi esercizio', 'Remove exercise')}
                </button>
              </div>
            ))}

            <button className="btn btn--ghost btn--small" onClick={() => addExercise(day.key)} type="button">
              <Plus size={13} />
              {t('Aggiungi esercizio', 'Add exercise')}
            </button>
          </article>
        ))}
      </div>

      <button
        className="btn btn--ghost btn--small"
        onClick={() => setDays((current) => [...current, draftDay(current.length)])}
        type="button"
      >
        <Plus size={13} />
        {t('Aggiungi giorno', 'Add day')}
      </button>

      {error ? <p className="gymx-form__error">{error}</p> : null}
      <div className="gymx-form__actions">
        <button className="btn btn--ghost btn--small" onClick={onClose} type="button">
          {t('Annulla', 'Cancel')}
        </button>
        <button className="btn btn--primary btn--small" disabled={saving} type="submit">
          {saving ? t('Salvataggio…', 'Saving…') : t('Salva scheda', 'Save plan')}
        </button>
      </div>
    </form>
  )
}

export function GymWorkoutSheet({
  workout,
  plan,
  language,
  onClose,
  onDelete,
}: {
  workout: GymWorkoutData
  plan?: GymPlanData
  language: Loc
  onClose: () => void
  onDelete: (id: string) => Promise<void>
}) {
  const t = (itText: string, enText: string) => (language === 'it' ? itText : enText)
  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'it' ? 'it-IT' : 'en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [language],
  )
  const number = useMemo(
    () => new Intl.NumberFormat(language === 'it' ? 'it-IT' : 'en-US', { maximumFractionDigits: 1 }),
    [language],
  )
  const day = workout.planDayId && plan ? plan.days.find((entry) => entry.id === workout.planDayId) : undefined
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const remove = async (): Promise<void> => {
    if (deleting || !window.confirm(`${t('Elimina', 'Delete')}?`)) return
    setDeleting(true)
    setError('')
    try {
      await onDelete(workout.id)
      onClose()
    } catch {
      setError(t('Impossibile eliminare l’allenamento. Riprova.', 'Could not delete the workout. Try again.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="gymx-detail">
      <p className="gymx-detail__meta">
        <span>{workout.startedAtMs === undefined ? '—' : dateTime.format(new Date(workout.startedAtMs))}</span>
        {plan ? <span>{day ? `${plan.name} · ${day.name}` : plan.name}</span> : null}
        <span>{t(`${workout.sets.length} serie`, `${workout.sets.length} sets`)}</span>
        {workout.volume ? (
          <span>
            {t('Volume', 'Volume')} {number.format(workout.volume.total)}
            {workout.volume.unit ? ` ${workout.volume.unit}` : ''}
          </span>
        ) : null}
      </p>

      {workout.sets.length > 0 ? (
        <table className="gymx-detail__sets">
          <thead>
            <tr>
              <th>#</th>
              <th>{t('Esercizio', 'Exercise')}</th>
              <th>{t('Ripetizioni', 'Reps')}</th>
              <th>{t('Carico', 'Load')}</th>
            </tr>
          </thead>
          <tbody>
            {workout.sets.map((set, index) => (
              <tr key={set.id}>
                <td>{set.setNumber ?? index + 1}</td>
                <td>{set.exerciseId || '—'}</td>
                <td>{set.repetitions ?? '—'}</td>
                <td>{set.load === undefined ? '—' : `${number.format(set.load)}${set.unit ? ` ${set.unit}` : ''}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="gymx-empty">{t('Nessuna serie registrata.', 'No sets recorded.')}</p>
      )}

      {workout.notes ? <p className="gymx-detail__notes">{workout.notes}</p> : null}
      {error ? <p aria-live="polite" className="gymx-form__error" role="alert">{error}</p> : null}

      <div className="gymx-detail__actions">
        <button
          className="btn btn--ghost btn--small gymx-delete"
          disabled={deleting}
          onClick={() => void remove()}
          type="button"
        >
          <Trash2 size={13} />
          {deleting ? t('Eliminazione…', 'Deleting…') : t('Elimina', 'Delete')}
        </button>
        <button className="btn btn--primary btn--small" disabled={deleting} onClick={onClose} type="button">
          {t('Chiudi', 'Close')}
        </button>
      </div>
    </div>
  )
}
