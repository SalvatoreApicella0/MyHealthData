import { ProgressiveHistory } from '../../components/ProgressiveHistory'
import { useMemo, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { EntrySheet } from '../../components/EntrySheet'
import { createId } from '../../core/id'
import { snapshotRecords } from '../../core/healthModules'
import type { HealthDataController } from '../../storage/useHealthData'
import { GymCompletionSheet, GymPlanSheet, GymWorkoutSheet } from './GymForms'
import {
  indexLastWorkoutsByPlan,
  parsePlans,
  parseWorkouts,
  plannedSetsForDay,
} from './gymModel'
import type { GymDayData, GymPlanData, GymWorkoutData } from './gymModel'
import './gymSection.css'

export { indexLastWorkoutsByPlan, plannedSetsForDay } from './gymModel'

type Loc = 'it' | 'en'

export function GymSection({ data, language }: { data: HealthDataController; language: string }) {
  const lang: Loc = language === 'en' ? 'en' : 'it'
  const t = (itText: string, enText: string) => (lang === 'it' ? itText : enText)

  const [createOpen, setCreateOpen] = useState(false)
  const [completion, setCompletion] = useState<{ plan: GymPlanData; day?: GymDayData } | null>(null)
  const [detail, setDetail] = useState<GymWorkoutData | null>(null)

  const plans = useMemo(
    () => parsePlans(snapshotRecords(data as unknown as Record<string, unknown>, 'gymPlans')),
    [data.gymPlans],
  )
  const workouts = useMemo(
    () => parseWorkouts(snapshotRecords(data as unknown as Record<string, unknown>, 'gymWorkouts')),
    [data.gymWorkouts],
  )
  const recent = workouts
  const lastWorkoutByPlan = useMemo(
    () => indexLastWorkoutsByPlan(plans, workouts),
    [plans, workouts],
  )

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    [lang],
  )
  const dateTimeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [lang],
  )
  const numberFormat = useMemo(
    () => new Intl.NumberFormat(lang === 'it' ? 'it-IT' : 'en-US', { maximumFractionDigits: 1 }),
    [lang],
  )

  const saveCompletion = async (plan: GymPlanData, day: GymDayData | undefined, startedAt: Date, notes: string) => {
    const sets = plannedSetsForDay(day)
    const record: Record<string, unknown> = {
      id: createId('gym'),
      name: day ? `${plan.name} · ${day.name}` : plan.name,
      startedAt: startedAt.toISOString(),
      planId: plan.id,
      planDayId: day?.id ?? null,
      sets,
      notes: notes.trim() || null,
      source: 'manual',
    }
    await data.saveCanonicalRecord('gymWorkouts', record)
  }

  const detailPlan = detail?.planId ? plans.find((plan) => plan.id === detail.planId) : undefined

  return (
    <section className="gymx">
      <header className="gymx-head">
        <button className="btn btn--ghost btn--small" onClick={() => setCreateOpen(true)} type="button">
          <Plus size={14} />
          {t('Crea scheda', 'Create plan')}
        </button>
      </header>

      <div className="gymx-block">
        <h3 className="gymx-title">{t('Schede', 'Plans')}</h3>
        {plans.length === 0 ? (
          <p className="gymx-empty">{t('Nessuna scheda: crea la tua prima scheda.', 'No plans yet: create your first plan.')}</p>
        ) : (
          <div className="gymx-plans">
            {plans.map((plan) => {
              const last = lastWorkoutByPlan.get(plan.id)
              return (
                <article className="gymx-plan" key={plan.id}>
                  <header className="gymx-plan__head">
                    <span className="gymx-plan__name">{plan.name}</span>
                    <span className="gymx-plan__last">
                      {last && last.startedAtMs !== undefined
                        ? `${t('Ultima volta', 'Last time')} ${dateLabel.format(new Date(last.startedAtMs))}`
                        : t('Mai fatta', 'Never done')}
                    </span>
                  </header>
                  {plan.days.length === 0 ? (
                    <div className="gymx-day">
                      <span className="gymx-day__count">{t('Nessun giorno', 'No days')}</span>
                      <button className="gymx-done" onClick={() => setCompletion({ plan })} type="button">
                        <Check size={13} />
                        {t('Fatta', 'Done')}
                      </button>
                    </div>
                  ) : (
                    <ul className="gymx-days">
                      {plan.days.map((day) => (
                        <li className="gymx-day" key={day.id}>
                          <span className="gymx-day__name">{day.name}</span>
                          <span className="gymx-day__count">
                            {t(`${day.exercises.length} esercizi`, `${day.exercises.length} exercises`)}
                          </span>
                          <button className="gymx-done" onClick={() => setCompletion({ plan, day })} type="button">
                            <Check size={13} />
                            {t('Fatta', 'Done')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>

      <div className="gymx-block">
        <h3 className="gymx-title">{t('Storico', 'History')}</h3>
        {recent.length === 0 ? (
          <p className="gymx-empty">{t('Nessun allenamento registrato.', 'No workouts recorded.')}</p>
        ) : (
          <ProgressiveHistory items={recent} initialCount={5} language={language}>
          {(visible) => (
          <ul className="gymx-history">
            {visible.map((workout) => (
              <li className="gymx-workout" key={workout.id}>
                <button className="gymx-workout__btn" onClick={() => setDetail(workout)} type="button">
                  <span className="gymx-workout__date">
                    {workout.startedAtMs === undefined ? '—' : dateTimeLabel.format(new Date(workout.startedAtMs))}
                  </span>
                  <span className="gymx-workout__name">{workout.name}</span>
                  <span className="gymx-workout__meta">
                    {t(`${workout.sets.length} serie`, `${workout.sets.length} sets`)}
                    {workout.volume
                      ? ` · ${numberFormat.format(workout.volume.total)}${workout.volume.unit ? ` ${workout.volume.unit}` : ''}`
                      : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          )}
        </ProgressiveHistory>
        )}
      </div>

      {createOpen ? (
        <EntrySheet title={t('Crea scheda', 'Create plan')} onClose={() => setCreateOpen(false)}>
          <GymPlanSheet
            language={lang}
            onClose={() => setCreateOpen(false)}
            onSave={(record) => data.saveCanonicalRecord('gymPlans', record)}
          />
        </EntrySheet>
      ) : null}

      {completion ? (
        <EntrySheet title={t('Segna come fatta', 'Mark as done')} onClose={() => setCompletion(null)}>
          <GymCompletionSheet
            day={completion.day}
            language={lang}
            onClose={() => setCompletion(null)}
            onSave={(startedAt, notes) => saveCompletion(completion.plan, completion.day, startedAt, notes)}
            plan={completion.plan}
          />
        </EntrySheet>
      ) : null}

      {detail ? (
        <EntrySheet title={detail.name} onClose={() => setDetail(null)}>
          <GymWorkoutSheet
            language={lang}
            onClose={() => setDetail(null)}
            onDelete={(id) => data.deleteCanonicalRecord('gymWorkouts', id)}
            plan={detailPlan}
            workout={detail}
          />
        </EntrySheet>
      ) : null}
    </section>
  )
}
