export type BodyRegionId =
  | 'head'
  | 'neck'
  | 'chest'
  | 'abdomen'
  | 'upper_back'
  | 'lower_back'
  | 'right_shoulder'
  | 'left_shoulder'
  | 'right_arm'
  | 'left_arm'
  | 'right_elbow'
  | 'left_elbow'
  | 'right_hand'
  | 'left_hand'
  | 'right_hip'
  | 'left_hip'
  | 'right_leg'
  | 'left_leg'
  | 'right_knee'
  | 'left_knee'
  | 'right_foot'
  | 'left_foot'

export type EventType =
  | 'pain'
  | 'discomfort'
  | 'burning'
  | 'swelling'
  | 'stiffness'
  | 'tingling'
  | 'wound'
  | 'general_symptom'
  | 'measurement'
  | 'note'
  | 'medication'
  | 'document'
  | 'other'
  | 'sexual_activity'
  | 'masturbation'
  | 'allergy'
  | 'vision_prescription'
  | 'digestive_health'
  | 'dental_care'

export type MeasurementType =
  | 'weight'
  | 'height'
  | 'waist_circumference'
  | 'chest_circumference'
  | 'hip_circumference'
  | 'neck_circumference'
  | 'shoulder_circumference'
  | 'arm_circumference'
  | 'forearm_circumference'
  | 'upper_abdomen_circumference'
  | 'lower_abdomen_circumference'
  | 'thigh_circumference'
  | 'calf_circumference'
  | 'left_arm_circumference'
  | 'right_arm_circumference'
  | 'left_forearm_circumference'
  | 'right_forearm_circumference'
  | 'left_thigh_circumference'
  | 'right_thigh_circumference'
  | 'left_calf_circumference'
  | 'right_calf_circumference'
  | 'systolic_pressure'
  | 'diastolic_pressure'
  | 'heart_rate'
  | 'blood_glucose'
  | 'body_temperature'
  | 'step_count'
  | 'active_energy_burned'
  | 'basal_energy_burned'
  | 'distance_walking_running'
  | 'flights_climbed'
  | 'oxygen_saturation'
  | 'respiratory_rate'
  | 'resting_heart_rate'
  | 'heart_rate_variability'
  | 'vo2_max'
  | 'body_mass_index'
  | 'body_fat_percentage'
  | 'lean_body_mass'
  | 'exercise_minutes'
  | 'sleep_hours'
  | 'mindful_minutes'
  | 'walking_heart_rate_average'
  | 'walking_speed'
  | 'walking_step_length'
  | 'walking_asymmetry'
  | 'walking_double_support'
  | 'six_minute_walk_distance'
  | 'stair_ascent_speed'
  | 'stair_descent_speed'
  | 'distance_cycling'
  | 'distance_swimming'
  | 'swimming_stroke_count'
  | 'wheelchair_push_count'
  | 'distance_wheelchair'
  | 'dietary_water'
  | 'dietary_energy'
  | 'dietary_caffeine'
  | 'stand_minutes'
  | 'daylight_minutes'
  | 'physical_effort'
  | 'environmental_audio_exposure'
  | 'headphone_audio_exposure'
  | 'workout_minutes'
  | 'alcohol_units'
  | 'treadmill_corrected_distance'
  | 'treadmill_corrected_energy'

export type DocumentType =
  | 'medical_report'
  | 'blood_test'
  | 'xray'
  | 'mri'
  | 'ultrasound'
  | 'specialist_visit'
  | 'prescription'
  | 'photo'
  | 'other'

export type BiologicalSex = 'female' | 'male' | 'intersex' | 'unspecified'

export interface LocalProfile {
  id: 'local-profile'
  alias?: string
  birthDate?: string
  biologicalSex?: BiologicalSex
  gender?: string
  heightCm?: number
  currentWeightKg?: number
  personalNotes?: string
  knownAllergies?: string
  regularMedications?: string
  knownConditions?: string
  updatedAt: string
}

export interface AttachmentMetadata {
  id: string
  name: string
  type: string
  size: number
  lastModified?: number
  /** Canonical iOS vault fields: present when the record came from the native app. */
  vaultFileName?: string
  sha256?: string
  storedAt?: string
}

export interface BodyPoint {
  x: number
  y: number
  z: number
  id?: string
  modelVersion?: string
  approximateRegionId?: BodyRegionId
}

export interface HealthEvent {
  id: string
  type: EventType
  bodyRegionId?: BodyRegionId
  occurredAt: string
  intensity?: number
  durationMinutes?: number
  description: string
  suspectedTrigger?: string
  helpedBy?: string
  tags: string[]
  attachments: AttachmentMetadata[]
  createdAt: string
  updatedAt: string
  /** Normalised position on the 3D body twin (iOS `BodyPoint`). */
  bodyPoint?: BodyPoint
  /** Record provenance, mirroring iOS `RecordSource` raw values. */
  source?: string
  sourceRecordId?: string
}

export interface Measurement {
  id: string
  type: MeasurementType
  value: number
  unit: string
  measuredAt: string
  note?: string
  createdAt: string
  source?: string
  sourceRecordId?: string
}

export interface HealthDocument {
  id: string
  title: string
  documentType: DocumentType
  documentDate: string
  description?: string
  linkedEventId?: string
  linkedModuleId?: string
  linkedAppointmentId?: string
  bodyRegionId?: BodyRegionId
  attachment?: AttachmentMetadata
  ocrText?: string
  needsClassification?: boolean
  createdAt: string
  updatedAt: string
}

export interface HealthDataSnapshot {
  profile?: LocalProfile
  events: HealthEvent[]
  measurements: Measurement[]
  documents: HealthDocument[]
  /** Canonical iOS domains not yet rendered by the browser must round-trip intact. */
  [domain: string]: unknown
}

export interface MhdExportManifest {
  app: 'MyHealthData'
  schemaVersion: '0.1.0'
  exportedAt: string
}

export interface MhdExportFile extends HealthDataSnapshot {
  manifest: MhdExportManifest
  metadata: {
    source: 'local-browser'
    encrypted: false
    recordCounts: {
      events: number
      measurements: number
      documents: number
    }
  }
}

export interface EncryptedMhdExportFile {
  manifest: MhdExportManifest & {
    encrypted: true
    cryptoVersion: '0.1.0'
  }
  crypto: {
    algorithm: 'AES-GCM'
    kdf: 'PBKDF2-SHA-256'
    iterations: number
    salt: string
    iv: string
  }
  ciphertext: string
}
