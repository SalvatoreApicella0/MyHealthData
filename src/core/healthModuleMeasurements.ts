import type { MeasurementModuleId } from './healthModuleCatalog'

/**
 * Measurement types per metric module, mirroring
 * `HealthMetricModule.types` in `HealthMetricModules.swift`.
 */
export const MEASUREMENT_MODULE_TYPES: Record<MeasurementModuleId, string[]> = {
  heart: [
    'heart_rate',
    'resting_heart_rate',
    'walking_heart_rate_average',
    'heart_rate_variability',
    'oxygen_saturation',
    'respiratory_rate',
    'vo2_max',
    'systolic_pressure',
    'diastolic_pressure',
    'body_temperature',
  ],
  activity: [
    'step_count',
    'workout_minutes',
    'exercise_minutes',
    'stand_minutes',
    'active_energy_burned',
    'distance_walking_running',
    'treadmill_corrected_distance',
    'treadmill_corrected_energy',
    'distance_cycling',
    'distance_swimming',
    'walking_speed',
    'walking_step_length',
    'walking_asymmetry',
    'walking_double_support',
    'stair_ascent_speed',
    'stair_descent_speed',
    'daylight_minutes',
  ],
  // Hydration remains as a compatibility measurement group, while the active
  // nutrition module owns the complete food-and-beverages diary.
  hydration: ['dietary_water', 'dietary_caffeine', 'alcohol_units'],
  nutrition: ['dietary_energy', 'dietary_water', 'dietary_caffeine', 'alcohol_units'],
  bodyMeasurements: [
    'weight',
    'neck_circumference',
    'shoulder_circumference',
    'chest_circumference',
    'arm_circumference',
    'forearm_circumference',
    'waist_circumference',
    'upper_abdomen_circumference',
    'lower_abdomen_circumference',
    'hip_circumference',
    'thigh_circumference',
    'calf_circumference',
    'body_mass_index',
    'body_fat_percentage',
    'lean_body_mass',
  ],
}

export function measurementModuleTitle(module: MeasurementModuleId, language: 'it' | 'en'): string {
  const titles: Record<MeasurementModuleId, { it: string; en: string }> = {
    heart: { it: 'Cuore e respiro', en: 'Heart and breathing' },
    activity: { it: 'Movimento', en: 'Movement' },
    hydration: { it: 'Idratazione', en: 'Hydration' },
    nutrition: { it: 'Alimentazione', en: 'Nutrition' },
    bodyMeasurements: { it: 'Misure corporee', en: 'Body measurements' },
  }
  const canonicalModule = module === 'hydration' ? 'nutrition' : module
  return titles[canonicalModule][language]
}
