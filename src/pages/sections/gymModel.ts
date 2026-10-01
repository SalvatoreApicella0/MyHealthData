import { createId } from '../../core/id'

export interface GymSetData {
  id: string
  exerciseId: string
  setNumber?: number
  repetitions?: number
  load?: number
  unit?: string
}

export interface Volume {
  total: number
  unit?: string
}

export interface GymWorkoutData {
  id: string
  name: string
  startedAtMs?: number
  planId?: string
  planDayId?: string
  notes?: string
  sets: GymSetData[]
  volume?: Volume
}

export interface GymExerciseData {
  id: string
  label: string
  sets?: number
  repetitions?: number
  load?: number
  unit?: string
  notes?: string
}

export interface GymDayData {
  id: string
  name: string
  order: number
  exercises: GymExerciseData[]
}

export interface GymPlanData {
  id: string
  name: string
  days: GymDayData[]
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function asTime(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? undefined : time
}

function objectRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    : []
}

function volumeOf(sets: GymSetData[]): Volume | undefined {
  let total = 0
  let counted = 0
  const units = new Set<string>()
  for (const set of sets) {
    if (set.repetitions === undefined || set.load === undefined) continue
    total += set.repetitions * set.load
    counted += 1
    if (set.unit) units.add(set.unit)
  }
  if (counted === 0) return undefined
  return { total, unit: units.size === 1 ? [...units][0] : undefined }
}

export function parsePlans(records: Array<Record<string, unknown>>): GymPlanData[] {
  return records.map((record, planIndex) => ({
    id: asString(record.id) ?? `gym-plan-${planIndex}`,
    name: asString(record.name) ?? 'Scheda',
    days: objectRecords(record.days)
      .map((day, dayIndex) => ({
        id: asString(day.id) ?? `gym-day-${planIndex}-${dayIndex}`,
        name: asString(day.name) ?? `Giorno ${dayIndex + 1}`,
        order: asNumber(day.order) ?? dayIndex,
        exercises: objectRecords(day.exercises).map((exercise, exerciseIndex) => ({
          id: asString(exercise.id) ?? `gym-exercise-${planIndex}-${dayIndex}-${exerciseIndex}`,
          label: asString(exercise.name) ?? asString(exercise.exerciseId) ?? '—',
          sets: asNumber(exercise.sets),
          repetitions: asNumber(exercise.repetitions),
          load: asNumber(exercise.load),
          unit: asString(exercise.unit),
          notes: asString(exercise.notes),
        })),
      }))
      .sort((left, right) => left.order - right.order),
  }))
}

export function parseWorkouts(records: Array<Record<string, unknown>>): GymWorkoutData[] {
  return records
    .map((record, workoutIndex) => {
      const sets = objectRecords(record.sets).map((set, setIndex) => ({
        id: asString(set.id) ?? `gym-set-${workoutIndex}-${setIndex}`,
        exerciseId: asString(set.exerciseId) ?? '',
        setNumber: asNumber(set.setNumber),
        repetitions: asNumber(set.repetitions),
        load: asNumber(set.load),
        unit: asString(set.unit),
      }))
      return {
        id: asString(record.id) ?? `gym-workout-${workoutIndex}`,
        name: asString(record.name) ?? 'Allenamento',
        startedAtMs: asTime(record.startedAt),
        planId: asString(record.planId),
        planDayId: asString(record.planDayId),
        notes: asString(record.notes),
        sets,
        volume: volumeOf(sets),
      }
    })
    .sort((left, right) => (right.startedAtMs ?? 0) - (left.startedAtMs ?? 0))
}

function workoutMatchesPlan(workout: GymWorkoutData, plan: GymPlanData): boolean {
  return workout.planId === plan.id
    || workout.name === plan.name
    || workout.name.startsWith(`${plan.name} ·`)
}

export function indexLastWorkoutsByPlan(
  plans: GymPlanData[],
  workouts: GymWorkoutData[],
): Map<string, GymWorkoutData> {
  const result = new Map<string, GymWorkoutData>()
  for (const plan of plans) {
    const last = workouts.find((workout) => workoutMatchesPlan(workout, plan))
    if (last) result.set(plan.id, last)
  }
  return result
}

export function plannedSetsForDay(day: GymDayData | undefined): GymSetData[] {
  if (!day) return []
  return day.exercises.flatMap((exercise) => {
    const count = Math.max(1, Math.round(exercise.sets ?? 1))
    return Array.from({ length: count }, (_, index) => ({
      id: createId('gym_set'),
      exerciseId: exercise.label,
      setNumber: index + 1,
      repetitions: exercise.repetitions,
      load: exercise.load,
      unit: exercise.unit ?? 'kg',
    }))
  })
}
