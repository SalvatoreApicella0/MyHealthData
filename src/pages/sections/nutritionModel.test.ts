import { describe, expect, it } from 'vitest'
import {
  computePlan,
  macroShare,
  monthGrid,
  parseEntry,
  recipeMacros,
} from './nutritionModel'
import type { SettingsDraft } from './nutritionModel'

describe('nutrition model', () => {
  it('normalizes persisted food entries and rejects incomplete records', () => {
    expect(parseEntry({ id: 'food-1', name: 'Pasta', meal: 'lunch', loggedAt: '2026-09-25T12:00:00.000Z', calories: '420,5' })).toMatchObject({
      id: 'food-1',
      name: 'Pasta',
      meal: 'lunch',
      calories: 420.5,
    })
    expect(parseEntry({ id: 'food-2', meal: 'lunch', loggedAt: Date.now() })).toBeUndefined()
  })

  it('computes recipe macros per serving and bounded macro shares', () => {
    expect(recipeMacros({ servings: 2, ingredients: [{ calories: 800, protein: 40, carbohydrates: 100, fat: 20 }] })).toEqual({
      calories: 400,
      protein: 20,
      carbohydrates: 50,
      fat: 10,
    })
    expect(macroShare(20, 40, 80, 100)).toBe(0.5)
    expect(macroShare(20, undefined, 80, 100)).toBe(0.8)
  })

  it('calculates a reproducible plan and a fixed-size calendar grid', () => {
    const settings: SettingsDraft = {
      weightKg: '70',
      heightCm: '175',
      age: '35',
      sex: 'male',
      activity: 'moderate',
      goal: 'maintain',
    }
    expect(computePlan(settings)).toEqual({ bmr: 1624, tdee: 2517, kcal: 2517, protein: 112, carbohydrates: 360, fat: 70, weightKg: 70 })
    expect(monthGrid(new Date(2026, 8, 25))).toHaveLength(42)
  })
})
