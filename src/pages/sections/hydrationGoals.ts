export interface HydrationGoals {
  waterMl: number
  alcoholUnitsPerWeek: number
  caffeineMgPerDay: number
}

export const DEFAULT_HYDRATION_GOALS: HydrationGoals = {
  waterMl: 2000,
  alcoholUnitsPerWeek: 10,
  caffeineMgPerDay: 400,
}

function positiveNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.')) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export function parseHydrationGoals(raw: string | null): Partial<HydrationGoals> | undefined {
  if (!raw) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const record = parsed as Record<string, unknown>
  const result: Partial<HydrationGoals> = {}
  const water = positiveNumber(record.waterMl)
  if (water !== undefined) result.waterMl = water
  const alcohol = positiveNumber(record.alcoholUnitsPerWeek)
  if (alcohol !== undefined) result.alcoholUnitsPerWeek = alcohol
  const caffeine = positiveNumber(record.caffeineMgPerDay)
  if (caffeine !== undefined) result.caffeineMgPerDay = caffeine
  return Object.keys(result).length > 0 ? result : undefined
}

export function withDefaultGoals(goals: Partial<HydrationGoals> | undefined): HydrationGoals {
  return {
    waterMl: goals?.waterMl ?? DEFAULT_HYDRATION_GOALS.waterMl,
    alcoholUnitsPerWeek: goals?.alcoholUnitsPerWeek ?? DEFAULT_HYDRATION_GOALS.alcoholUnitsPerWeek,
    caffeineMgPerDay: goals?.caffeineMgPerDay ?? DEFAULT_HYDRATION_GOALS.caffeineMgPerDay,
  }
}

export function ringShare(value: number, goal: number | undefined): number {
  if (goal === undefined || goal <= 0) return 0
  return Math.min(Math.max(value / goal, 0), 1)
}

export function serializeHydrationGoals(goals: HydrationGoals): string {
  return JSON.stringify(goals)
}
