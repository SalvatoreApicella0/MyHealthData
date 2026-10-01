import { dictionaries, measurementUnits } from '../i18n/messages'
import type { DocumentType, EventType, MeasurementType } from './types'

export const APP_NAME = 'MyHealthData'
export const SCHEMA_VERSION = '0.1.0'

export const MEDICAL_DISCLAIMER_EN =
  'MyHealthData is not a medical device and does not provide diagnosis, treatment, or medical advice. It helps users record, organize, visualize, and export their personal health data. Always consult a qualified healthcare professional for medical concerns.'

export const MEDICAL_DISCLAIMER_IT =
  'MyHealthData non è un dispositivo medico e non fornisce diagnosi, trattamenti o consigli medici. Aiuta gli utenti a registrare, organizzare, visualizzare ed esportare i propri dati salute personali. Per dubbi o problemi medici, consulta sempre un professionista sanitario qualificato.'

/**
 * Canonical vocabularies.
 *
 * The raw values are the iOS `EventType` / `MeasurementType` cases and the
 * labels come from the shared localization dictionaries, so the Web app cannot
 * drift from the native vocabulary (66 measurement types, 19 event types).
 */
const EVENT_TYPE_IDS: EventType[] = [
  'pain',
  'discomfort',
  'burning',
  'swelling',
  'stiffness',
  'tingling',
  'wound',
  'general_symptom',
  'measurement',
  'note',
  'medication',
  'document',
  'other',
  'sexual_activity',
  'masturbation',
  'allergy',
  'vision_prescription',
  'digestive_health',
  'dental_care',
]

const MEASUREMENT_TYPE_IDS: MeasurementType[] = [
  'weight',
  'height',
  'waist_circumference',
  'chest_circumference',
  'hip_circumference',
  'neck_circumference',
  'shoulder_circumference',
  'arm_circumference',
  'forearm_circumference',
  'upper_abdomen_circumference',
  'lower_abdomen_circumference',
  'thigh_circumference',
  'calf_circumference',
  'left_arm_circumference',
  'right_arm_circumference',
  'left_forearm_circumference',
  'right_forearm_circumference',
  'left_thigh_circumference',
  'right_thigh_circumference',
  'left_calf_circumference',
  'right_calf_circumference',
  'systolic_pressure',
  'diastolic_pressure',
  'heart_rate',
  'blood_glucose',
  'body_temperature',
  'step_count',
  'active_energy_burned',
  'basal_energy_burned',
  'distance_walking_running',
  'flights_climbed',
  'oxygen_saturation',
  'respiratory_rate',
  'resting_heart_rate',
  'heart_rate_variability',
  'vo2_max',
  'body_mass_index',
  'body_fat_percentage',
  'lean_body_mass',
  'exercise_minutes',
  'sleep_hours',
  'mindful_minutes',
  'walking_heart_rate_average',
  'walking_speed',
  'walking_step_length',
  'walking_asymmetry',
  'walking_double_support',
  'stair_ascent_speed',
  'stair_descent_speed',
  'distance_cycling',
  'distance_swimming',
  'swimming_stroke_count',
  'wheelchair_push_count',
  'distance_wheelchair',
  'dietary_water',
  'dietary_energy',
  'dietary_caffeine',
  'stand_minutes',
  'daylight_minutes',
  'physical_effort',
  'environmental_audio_exposure',
  'headphone_audio_exposure',
  'workout_minutes',
  'alcohol_units',
  'treadmill_corrected_distance',
  'treadmill_corrected_energy',
]

export const EVENT_TYPES: Array<{ id: EventType; label: string }> = EVENT_TYPE_IDS.map((id) => ({
  id,
  label: dictionaries.en[`event.${id}`] ?? id,
}))

export const MEASUREMENT_TYPES: Array<{ id: MeasurementType; label: string; defaultUnit: string }> =
  MEASUREMENT_TYPE_IDS.map((id) => ({
    id,
    label: dictionaries.en[`measurement.${id}`] ?? id,
    defaultUnit: measurementUnits[id] ?? '',
  }))

export const DOCUMENT_TYPES: Array<{ id: DocumentType; label: string }> = [
  { id: 'medical_report', label: 'Medical report' },
  { id: 'blood_test', label: 'Blood test' },
  { id: 'xray', label: 'X-ray' },
  { id: 'mri', label: 'MRI' },
  { id: 'ultrasound', label: 'Ultrasound' },
  { id: 'specialist_visit', label: 'Specialist visit' },
  { id: 'prescription', label: 'Prescription' },
  { id: 'photo', label: 'Photo' },
  { id: 'other', label: 'Other' },
]
