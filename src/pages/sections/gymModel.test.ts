import { describe, expect, it } from 'vitest'
import { indexLastWorkoutsByPlan, plannedSetsForDay } from './gymModel'

describe('gym completion model', () => {
  it('materializes planned sets when a workout is marked complete', () => {
    const sets = plannedSetsForDay({
      id: 'day-1',
      name: 'Forza',
      order: 0,
      exercises: [{ id: 'squat', label: 'Squat', sets: 3, repetitions: 8, load: 60, unit: 'kg' }],
    })

    expect(sets).toHaveLength(3)
    expect(sets.map((set) => set.exerciseId)).toEqual(['Squat', 'Squat', 'Squat'])
    expect(sets[0]?.repetitions).toBe(8)
    expect(sets[0]?.load).toBe(60)
  })

  it('indexes the latest workout for each plan while preserving legacy name matching', () => {
    const plans = [{ id: 'plan-1', name: 'Forza', days: [] }]
    const workouts = [
      { id: 'new', name: 'Forza · Gambe', startedAtMs: 20, sets: [] },
      { id: 'old', name: 'Forza', startedAtMs: 10, sets: [] },
    ]

    expect(indexLastWorkoutsByPlan(plans, workouts).get('plan-1')?.id).toBe('new')
  })
})
