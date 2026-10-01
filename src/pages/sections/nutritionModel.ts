import type { BiologicalSex } from '../../core/types'
import type { HealthDataController } from '../../storage/useHealthData'

export type MealType = 'other' | 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'morningSnack' | 'afternoonSnack' | 'eveningSnack'
export type MealGroup = 'breakfast' | 'lunch' | 'dinner' | 'snack'

const MEAL_TYPES: MealType[] = ['other', 'breakfast', 'lunch', 'dinner', 'snack', 'morningSnack', 'afternoonSnack', 'eveningSnack']

interface MealGroupSpec {
  value: MealGroup
  it: string
  en: string
  color: string
}

export const MEAL_GROUPS: MealGroupSpec[] = [
  { value: 'breakfast', it: 'Colazione', en: 'Breakfast', color: '#F7AB45' },
  { value: 'lunch', it: 'Pranzo', en: 'Lunch', color: '#4C9AFF' },
  { value: 'dinner', it: 'Cena', en: 'Dinner', color: '#8A7CFF' },
  { value: 'snack', it: 'Spuntini', en: 'Snacks', color: '#2EC794' },
]

export function groupForMeal(meal: MealType): MealGroup {
  switch (meal) {
    case 'breakfast':
      return 'breakfast'
    case 'lunch':
      return 'lunch'
    case 'dinner':
      return 'dinner'
    default:
      return 'snack'
  }
}

export function mealForGroup(group: MealGroup): MealType {
  switch (group) {
    case 'breakfast':
      return 'breakfast'
    case 'lunch':
      return 'lunch'
    case 'dinner':
      return 'dinner'
    default:
      return 'snack'
  }
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'veryHigh'
export type WeightGoal = 'lose' | 'maintain' | 'gain'

interface ActivitySpec {
  value: ActivityLevel
  factor: number
  it: string
  en: string
}

export const ACTIVITY_LEVELS: ActivitySpec[] = [
  { value: 'sedentary', factor: 1.2, it: 'Sedentario · 0 allenamenti', en: 'Sedentary · no workouts' },
  { value: 'light', factor: 1.375, it: 'Leggero · 1–2 a settimana', en: 'Light · 1–2 a week' },
  { value: 'moderate', factor: 1.55, it: 'Moderato · 3–4 a settimana', en: 'Moderate · 3–4 a week' },
  { value: 'high', factor: 1.725, it: 'Molto attivo · 5–6 a settimana', en: 'Very active · 5–6 a week' },
  { value: 'veryHigh', factor: 1.9, it: 'Intenso · 7+ o lavoro fisico', en: 'Intense · 7+ or physical job' },
]

interface WeightGoalSpec {
  value: WeightGoal
  factor: number
  it: string
  en: string
}

export const WEIGHT_GOALS: WeightGoalSpec[] = [
  { value: 'lose', factor: 0.85, it: 'Perdere peso · deficit 15%', en: 'Lose weight · 15% deficit' },
  { value: 'maintain', factor: 1, it: 'Mantenere', en: 'Maintain' },
  { value: 'gain', factor: 1.1, it: 'Aumentare · surplus 10%', en: 'Gain weight · 10% surplus' },
]

interface SexSpec {
  value: BiologicalSex
  it: string
  en: string
}

export const SEX_OPTIONS: SexSpec[] = [
  { value: 'female', it: 'Femmina', en: 'Female' },
  { value: 'male', it: 'Maschio', en: 'Male' },
  { value: 'intersex', it: 'Intersessuale', en: 'Intersex' },
  { value: 'unspecified', it: 'Non specificato', en: 'Unspecified' },
]

export interface NutritionGoals {
  kcal: number
  protein: number
  carbohydrates: number
  fat: number
  weightKg: number
  updatedAt: string
}

export const GOALS_KEY = 'mhd.nutrition.goals'

export interface SettingsDraft {
  weightKg: string
  heightCm: string
  age: string
  sex: BiologicalSex
  activity: ActivityLevel
  goal: WeightGoal
}

export interface NutritionPlan {
  bmr: number
  tdee: number
  kcal: number
  protein: number
  carbohydrates: number
  fat: number
  weightKg: number
}

export interface FoodEntry {
  id: string
  name: string
  meal: MealType
  loggedAt: number
  quantity?: number
  servingUnit?: string
  calories: number
  protein: number
  carbohydrates: number
  fat: number
  fiber?: number
  sugar?: number
  sodiumMilligrams?: number
  isFavorite: boolean
  note?: string
  raw: Record<string, unknown>
}

export interface Draft {
  name: string
  meal: MealGroup
  quantity: string
  servingUnit: string
  calories: string
  protein: string
  carbohydrates: string
  fat: string
  fiber: string
  sugar: string
  sodiumMilligrams: string
  note: string
}

export interface RecipeMacros {
  calories: number
  protein: number
  carbohydrates: number
  fat: number
}

export function emptyDraft(meal: MealGroup = 'breakfast'): Draft {
  return {
    name: '',
    meal,
    quantity: '100',
    servingUnit: 'g',
    calories: '',
    protein: '',
    carbohydrates: '',
    fat: '',
    fiber: '',
    sugar: '',
    sodiumMilligrams: '',
    note: '',
  }
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export function asTime(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? undefined : time
  }
  return undefined
}

export function asMeal(value: unknown): MealType | undefined {
  return typeof value === 'string' && MEAL_TYPES.some((meal) => meal === value) ? (value as MealType) : undefined
}

export function parseEntry(record: Record<string, unknown>): FoodEntry | undefined {
  const id = asString(record.id)
  const name = asString(record.name)
  const meal = asMeal(record.meal)
  const loggedAt = asTime(record.loggedAt)
  if (!id || !name || !meal || loggedAt === undefined) return undefined
  return {
    id,
    name,
    meal,
    loggedAt,
    quantity: asNumber(record.quantity),
    servingUnit: asString(record.servingUnit),
    calories: asNumber(record.calories) ?? 0,
    protein: asNumber(record.protein) ?? 0,
    carbohydrates: asNumber(record.carbohydrates) ?? 0,
    fat: asNumber(record.fat) ?? 0,
    fiber: asNumber(record.fiber),
    sugar: asNumber(record.sugar),
    sodiumMilligrams: asNumber(record.sodiumMilligrams),
    isFavorite: record.isFavorite === true,
    note: asString(record.note),
    raw: record,
  }
}

export function recipeMacros(record: Record<string, unknown>): RecipeMacros {
  const servingsRaw = asNumber(record.servings)
  const servings = servingsRaw !== undefined && servingsRaw > 0 ? servingsRaw : 1
  const ingredients: unknown[] = Array.isArray(record.ingredients) ? record.ingredients : []
  let calories = 0
  let protein = 0
  let carbohydrates = 0
  let fat = 0
  for (const ingredient of ingredients) {
    if (typeof ingredient !== 'object' || ingredient === null) continue
    const row = ingredient as Record<string, unknown>
    calories += asNumber(row.calories) ?? 0
    protein += asNumber(row.protein) ?? 0
    carbohydrates += asNumber(row.carbohydrates) ?? 0
    fat += asNumber(row.fat) ?? 0
  }
  return {
    calories: calories / servings,
    protein: protein / servings,
    carbohydrates: carbohydrates / servings,
    fat: fat / servings,
  }
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset)
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function monthGrid(month: Date): Date[] {
  const first = startOfMonth(month)
  const offset = (first.getDay() + 6) % 7
  const start = addDays(first, -offset)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

export function sameDay(time: number, day: Date): boolean {
  const date = new Date(time)
  return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate()
}

export function readGoals(): NutritionGoals | undefined {
  try {
    const raw = window.localStorage.getItem(GOALS_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const kcal = asNumber(parsed.kcal)
    const protein = asNumber(parsed.protein)
    const carbohydrates = asNumber(parsed.carbohydrates)
    const fat = asNumber(parsed.fat)
    const weightKg = asNumber(parsed.weightKg)
    const updatedAt = asString(parsed.updatedAt)
    if (kcal === undefined || protein === undefined || carbohydrates === undefined || fat === undefined || weightKg === undefined || !updatedAt) {
      return undefined
    }
    return { kcal, protein, carbohydrates, fat, weightKg, updatedAt }
  } catch {
    return undefined
  }
}

export function ageFromBirthDate(birthDate: string | undefined): number | undefined {
  if (!birthDate) return undefined
  const date = new Date(birthDate)
  if (Number.isNaN(date.getTime())) return undefined
  const now = new Date()
  let age = now.getFullYear() - date.getFullYear()
  const monthDelta = now.getMonth() - date.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < date.getDate())) age -= 1
  return age > 0 && age < 130 ? age : undefined
}

export function latestWeightKg(measurements: HealthDataController['measurements']): number | undefined {
  let best: { time: number; kg: number } | undefined
  for (const measurement of measurements) {
    if (measurement.type !== 'weight') continue
    const time = new Date(measurement.measuredAt).getTime()
    const value = Number(measurement.value)
    if (Number.isNaN(time) || !Number.isFinite(value) || value <= 0) continue
    const kg = (measurement.unit ?? '').toLowerCase().includes('lb') ? value / 2.2046226218 : value
    if (!best || time > best.time) best = { time, kg }
  }
  return best?.kg
}

export function emptySettingsDraft(): SettingsDraft {
  return { weightKg: '', heightCm: '', age: '', sex: 'unspecified', activity: 'moderate', goal: 'maintain' }
}

export function settingsDraftFor(data: HealthDataController, goals: NutritionGoals | undefined): SettingsDraft {
  const measured = latestWeightKg(data.measurements)
  const weight = goals?.weightKg ?? measured ?? data.profile?.currentWeightKg
  return {
    weightKg: weight !== undefined ? String(Math.round(weight * 10) / 10) : '',
    heightCm: data.profile?.heightCm !== undefined ? String(Math.round(data.profile.heightCm * 10) / 10) : '',
    age: ageFromBirthDate(data.profile?.birthDate)?.toString() ?? '',
    sex: data.profile?.biologicalSex ?? 'unspecified',
    activity: 'moderate',
    goal: 'maintain',
  }
}

export function computePlan(draft: SettingsDraft): NutritionPlan | undefined {
  const weightKg = asNumber(draft.weightKg)
  const heightCm = asNumber(draft.heightCm)
  const age = asNumber(draft.age)
  if (weightKg === undefined || weightKg <= 0 || heightCm === undefined || heightCm <= 0 || age === undefined || age <= 0) {
    return undefined
  }
  const sexOffset = draft.sex === 'male' ? 5 : draft.sex === 'female' ? -161 : -78
  const bmr = Math.max(10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset, 0)
  const activityFactor = ACTIVITY_LEVELS.find((level) => level.value === draft.activity)?.factor ?? 1.55
  const tdee = bmr * activityFactor
  const goalFactor = WEIGHT_GOALS.find((goal) => goal.value === draft.goal)?.factor ?? 1
  const kcal = Math.max(Math.round(tdee * goalFactor), 1200)
  const protein = Math.round(1.6 * weightKg)
  const fat = Math.round((kcal * 0.25) / 9)
  const carbohydrates = Math.max(Math.round((kcal - protein * 4 - fat * 9) / 4), 0)
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, carbohydrates, fat, weightKg }
}

export function macroShare(value: number, goal: number | undefined, energy: number, energyTotal: number): number {
  if (goal !== undefined && goal > 0) return value / goal
  return energyTotal > 0 ? energy / energyTotal : 0
}
