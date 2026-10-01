import { MEASUREMENT_MODULE_TYPES, getHealthModule } from '../core/healthModules'
import { normalizeFavoriteIds, normalizeSectionOrder } from '../core/sectionPreferences'
import type { HealthModuleId } from '../core/healthModules'
import type { MeasurementType } from '../core/types'
import type { HealthDataController } from '../storage/useHealthData'

export type SectionKind = 'measurements' | 'canonical' | 'events'

export interface SectionSpec {
  id: string
  title: string
  kind: SectionKind
  moduleId?: HealthModuleId
  measurementTypes?: MeasurementType[]
  domain?: string
  /** Per-section aggregation window; defaults to the last 12 months. */
  windowDays?: number
}

export const EVENT_TYPE_MODULES: Record<string, string> = {
  allergies: 'allergy',
  vision: 'vision_prescription',
  gutHealth: 'digestive_health',
  dental: 'dental_care',
  sexualHealth: 'sexual_activity',
}

export const BASE_SECTIONS: SectionSpec[] = [
  { id: 'dolori', title: 'Dolori corporei', kind: 'events', moduleId: 'body' },
  { id: 'misure', title: 'Misure corporee', kind: 'measurements', moduleId: 'bodyMeasurements' },
  { id: 'cuore', title: 'Cuore e respiro', kind: 'measurements', moduleId: 'heart' },
  { id: 'movimento', title: 'Movimento', kind: 'measurements', moduleId: 'activity' },
  { id: 'sonno', title: 'Sonno', kind: 'measurements', moduleId: 'sleep' },
  { id: 'alimentazione', title: 'Alimentazione', kind: 'measurements', moduleId: 'nutrition' },
  { id: 'farmaci', title: 'Farmaci', kind: 'canonical', moduleId: 'medications', domain: 'medications' },
  { id: 'ciclo', title: 'Ciclo', kind: 'canonical', moduleId: 'cycle', domain: 'cycleEntries' },
  { id: 'palestra', title: 'Palestra', kind: 'canonical', moduleId: 'gym', domain: 'gymWorkouts' },
  { id: 'analisi', title: 'Analisi', kind: 'canonical', moduleId: 'bloodwork', domain: 'labResults' },
  { id: 'allergie', title: 'Allergie', kind: 'events', moduleId: 'allergies' },
  { id: 'vista', title: 'Vista', kind: 'events', moduleId: 'vision' },
  { id: 'intestino', title: 'Salute intestinale', kind: 'events', moduleId: 'gutHealth' },
  { id: 'denti', title: 'Denti', kind: 'events', moduleId: 'dental' },
  { id: 'sessuale', title: 'Salute sessuale', kind: 'events', moduleId: 'sexualHealth' },
]

/** Default Web order. Persisted orders are treated as a partial override. */
export const DEFAULT_SECTION_ORDER: readonly string[] = BASE_SECTIONS.map((section) => section.id)
export const SECTION_IDS = DEFAULT_SECTION_ORDER

export const DEFAULT_WINDOW_DAYS = 365

const ORDER_KEY = 'mhd.data.sections'
const FAVORITES_KEY = 'mhd.favorites'

export const MAIN_BODY_METRICS: MeasurementType[] = [
  'weight',
  'body_mass_index',
  'body_fat_percentage',
  'lean_body_mass',
]

export interface PairedCircumferenceZone {
  id: string
  /** Generic zone type; its localized label is used as the row heading. */
  type: MeasurementType
  left: MeasurementType
  right: MeasurementType
}

/** Left/right body circumferences rendered as one table (Zona | Sinistra | Destra). */
export const PAIRED_CIRCUMFERENCE_ZONES: PairedCircumferenceZone[] = [
  { id: 'arm', type: 'arm_circumference', left: 'left_arm_circumference', right: 'right_arm_circumference' },
  { id: 'forearm', type: 'forearm_circumference', left: 'left_forearm_circumference', right: 'right_forearm_circumference' },
  { id: 'thigh', type: 'thigh_circumference', left: 'left_thigh_circumference', right: 'right_thigh_circumference' },
  { id: 'calf', type: 'calf_circumference', left: 'left_calf_circumference', right: 'right_calf_circumference' },
]

/** Unpaired, single-value body circumferences (Zona | Ultimo valore). */
export const UNPAIRED_CIRCUMFERENCE_TYPES: MeasurementType[] = [
  'neck_circumference',
  'shoulder_circumference',
  'waist_circumference',
  'hip_circumference',
  'chest_circumference',
  'upper_abdomen_circumference',
  'lower_abdomen_circumference',
]

/** Body metrics shown as tiles when they carry data; the rest fall into "Altri dati". */
export const BODY_DISPLAY_TYPES: MeasurementType[] = [
  ...MAIN_BODY_METRICS,
  ...UNPAIRED_CIRCUMFERENCE_TYPES,
]

/** Cuore e respiro display set; walking-derived metrics stay in Movimento. */
export const HEART_DISPLAY_TYPES: MeasurementType[] = [
  'heart_rate',
  'resting_heart_rate',
  'heart_rate_variability',
  'oxygen_saturation',
  'respiratory_rate',
  'systolic_pressure',
  'diastolic_pressure',
  'body_temperature',
  'vo2_max',
]

/** Curated Movimento groups; duplicate workout minutes stay discoverable in Altri dati. */
export const MOVEMENT_MINUTES_TYPE: MeasurementType = 'exercise_minutes'
export const MOVEMENT_DAILY_TYPES: MeasurementType[] = [
  'step_count',
  'active_energy_burned',
  'stand_minutes',
  'daylight_minutes',
]
export const MOVEMENT_DISTANCE_DAILY_TYPE: MeasurementType = 'distance_walking_running'
export const MOVEMENT_DISTANCE_TYPES: MeasurementType[] = ['distance_cycling', 'distance_swimming']
export const MOVEMENT_STAIR_TYPES: MeasurementType[] = ['stair_ascent_speed', 'stair_descent_speed']
export const MOVEMENT_GAIT_TYPES: MeasurementType[] = [
  'walking_speed',
  'walking_step_length',
  'walking_asymmetry',
  'walking_double_support',
]
/** Held back from the cards but kept discoverable in the collapsed "Altri dati" row. */
export const MOVEMENT_OTHER_TYPES: MeasurementType[] = [
  'workout_minutes',
  'treadmill_corrected_distance',
  'treadmill_corrected_energy',
]
export const MOVEMENT_DISPLAY_TYPES: MeasurementType[] = [
  MOVEMENT_MINUTES_TYPE,
  ...MOVEMENT_DAILY_TYPES,
  MOVEMENT_DISTANCE_DAILY_TYPE,
  ...MOVEMENT_DISTANCE_TYPES,
  ...MOVEMENT_STAIR_TYPES,
  ...MOVEMENT_GAIT_TYPES,
]
export const STAIR_SPEED_TYPES: ReadonlySet<string> = new Set<string>(MOVEMENT_STAIR_TYPES)

export function readOrder(): string[] {
  try {
    const raw = window.localStorage.getItem(ORDER_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed)
      ? normalizeSectionOrder(parsed.filter((value): value is string => typeof value === 'string'), SECTION_IDS)
      : []
  } catch {
    return []
  }
}

export function readFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed)
      ? normalizeFavoriteIds(parsed.filter((value): value is string => typeof value === 'string' && !value.startsWith('section:')), SECTION_IDS)
      : []
  } catch {
    return []
  }
}

export function writeFavorites(values: string[]): void {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(values))
  } catch {
    /* storage disabled */
  }
}

export function writeOrder(order: string[]): void {
  try {
    window.localStorage.setItem(ORDER_KEY, JSON.stringify(order))
  } catch {
    /* storage disabled: order only applies to this session */
  }
}

export function measurementTypesFor(section: SectionSpec): MeasurementType[] {
  if (section.measurementTypes) return section.measurementTypes
  const module = section.moduleId ? getHealthModule(section.moduleId) : undefined
  if (module?.measurementModule) return MEASUREMENT_MODULE_TYPES[module.measurementModule] as MeasurementType[]
  return []
}

export function sortCanonicalRecords(records: Array<Record<string, unknown>>, dateField: string): Array<Record<string, unknown>> {
  return [...records].sort((left, right) => String(right[dateField] ?? '').localeCompare(String(left[dateField] ?? '')))
}

export function sortEventsByOccurredAt<T extends { occurredAt?: string }>(events: T[]): T[] {
  return [...events].sort((left, right) => String(right.occurredAt ?? '').localeCompare(String(left.occurredAt ?? '')))
}

const eventPreviewCache = new WeakMap<HealthDataController['events'], Map<string, HealthDataController['events']>>()

export function previewEvents(events: HealthDataController['events'], eventType?: string): HealthDataController['events'] {
  const key = eventType ?? ''
  let byType = eventPreviewCache.get(events)
  if (!byType) {
    byType = new Map()
    eventPreviewCache.set(events, byType)
  }
  const cached = byType.get(key)
  if (cached) return cached
  const matching = eventType ? events.filter((event) => event.type === eventType) : events
  const preview = sortEventsByOccurredAt(matching).slice(0, 3)
  byType.set(key, preview)
  return preview
}

/** Curated display sets for measurement sections; add forms keep the full module list. */
export function displayTypesFor(section: SectionSpec): MeasurementType[] {
  if (section.id === 'cuore') return HEART_DISPLAY_TYPES
  if (section.id === 'movimento') return MOVEMENT_DISPLAY_TYPES
  if (section.id === 'misure') return BODY_DISPLAY_TYPES
  return measurementTypesFor(section)
}
