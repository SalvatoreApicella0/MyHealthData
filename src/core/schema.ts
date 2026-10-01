import { z } from 'zod'
import { SCHEMA_VERSION } from './constants'
import type { HealthDataSnapshot, MhdExportFile } from './types'

export const bodyRegionIdSchema = z.enum([
  'head',
  'neck',
  'chest',
  'abdomen',
  'upper_back',
  'lower_back',
  'right_shoulder',
  'left_shoulder',
  'right_arm',
  'left_arm',
  'right_elbow',
  'left_elbow',
  'right_hand',
  'left_hand',
  'right_hip',
  'left_hip',
  'right_leg',
  'left_leg',
  'right_knee',
  'left_knee',
  'right_foot',
  'left_foot',
])

export const eventTypeSchema = z.enum([
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
])

export const measurementTypeSchema = z.enum([
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
  'six_minute_walk_distance',
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
])

export const documentTypeSchema = z.enum([
  'medical_report',
  'blood_test',
  'xray',
  'mri',
  'ultrasound',
  'specialist_visit',
  'prescription',
  'photo',
  'other',
])

// `.passthrough()` on every record schema is a parity requirement: the iOS app
// stores fields the Web UI does not render yet (`source`, `sourceRecordId`,
// `bodyPoint`, `linkedModuleId`, `ocrText`, attachment `vaultFileName`/`sha256`
// and friends). A Web import/export round trip must never drop them.
export const attachmentMetadataSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.string(),
  size: z.number().nonnegative(),
  lastModified: z.number().optional(),
}).passthrough()

export const profileSchema = z.object({
  id: z.literal('local-profile'),
  alias: z.string().optional(),
  birthDate: z.string().optional(),
  biologicalSex: z.enum(['female', 'male', 'intersex', 'unspecified']).optional(),
  gender: z.string().optional(),
  heightCm: z.number().positive().optional(),
  currentWeightKg: z.number().positive().optional(),
  personalNotes: z.string().optional(),
  knownAllergies: z.string().optional(),
  regularMedications: z.string().optional(),
  knownConditions: z.string().optional(),
  updatedAt: z.string().datetime(),
}).passthrough()

export const bodyPointSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
}).passthrough()

export const healthEventSchema = z.object({
  id: z.string().min(1),
  type: eventTypeSchema,
  bodyRegionId: bodyRegionIdSchema.optional(),
  bodyPoint: bodyPointSchema.optional(),
  occurredAt: z.string().datetime(),
  intensity: z.number().min(0).max(10).optional(),
  durationMinutes: z.number().nonnegative().optional(),
  description: z.string().min(1),
  suspectedTrigger: z.string().optional(),
  helpedBy: z.string().optional(),
  tags: z.array(z.string()),
  attachments: z.array(attachmentMetadataSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).passthrough()

export const measurementSchema = z.object({
  id: z.string().min(1),
  type: measurementTypeSchema,
  value: z.number(),
  unit: z.string().min(1),
  measuredAt: z.string().datetime(),
  note: z.string().optional(),
  createdAt: z.string().datetime(),
}).passthrough()

export const healthDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  documentType: documentTypeSchema,
  documentDate: z.string().min(1),
  description: z.string().optional(),
  linkedEventId: z.string().optional(),
  bodyRegionId: bodyRegionIdSchema.optional(),
  attachment: attachmentMetadataSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).passthrough()

export const healthDataSnapshotSchema = z.object({
  profile: profileSchema.optional(),
  events: z.array(healthEventSchema),
  measurements: z.array(measurementSchema),
  documents: z.array(healthDocumentSchema),
}).passthrough()

export const mhdExportFileSchema = healthDataSnapshotSchema.extend({
  manifest: z.object({
    app: z.literal('MyHealthData'),
    schemaVersion: z.literal(SCHEMA_VERSION),
    exportedAt: z.string().datetime(),
  }),
  metadata: z.object({
    source: z.literal('local-browser'),
    encrypted: z.literal(false),
    recordCounts: z.object({
      events: z.number().nonnegative(),
      measurements: z.number().nonnegative(),
      documents: z.number().nonnegative(),
    }),
  }),
})

export const encryptedMhdExportFileSchema = z.object({
  manifest: z.object({
    app: z.literal('MyHealthData'),
    schemaVersion: z.literal(SCHEMA_VERSION),
    exportedAt: z.string().datetime(),
    encrypted: z.literal(true),
    cryptoVersion: z.literal('0.1.0'),
  }),
  crypto: z.object({
    algorithm: z.literal('AES-GCM'),
    kdf: z.literal('PBKDF2-SHA-256'),
    iterations: z.number().positive(),
    salt: z.string().min(1),
    iv: z.string().min(1),
  }),
  ciphertext: z.string().min(1),
})

export function createExportFile(snapshot: HealthDataSnapshot): MhdExportFile {
  // The export must carry the whole canonical graph, not only the four
  // collections the Web UI edits directly: an iOS import/export round trip
  // through the Web app must not drop cycle, sleep, nutrition, gym, visits,
  // medications, conditions, labs or any future domain.
  return {
    ...snapshot,
    manifest: {
      app: 'MyHealthData',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
    },
    metadata: {
      source: 'local-browser',
      encrypted: false,
      recordCounts: {
        events: snapshot.events.length,
        measurements: snapshot.measurements.length,
        documents: snapshot.documents.length,
      },
    },
  }
}

export function parseMhdExportFile(value: unknown): MhdExportFile {
  const parsed = mhdExportFileSchema.parse(value)
  assertImportLimits(parsed)
  return parsed
}

export function parseHealthDataSnapshot(value: unknown): HealthDataSnapshot {
  const parsed = healthDataSnapshotSchema.parse(value)
  assertImportLimits(parsed)
  return parsed
}

/* ------------------------------------------------------------ import limits */

/**
 * Import hardening.
 *
 * An imported file is attacker-controlled input. These caps bound the memory
 * and work the browser will accept: a hostile file cannot use the vault as a
 * denial-of-service vector, and no record can hide an unbounded blob in a
 * single field. Limits are exported so the UI can reject oversized files before
 * reading them.
 */
export const IMPORT_LIMITS = {
  /** Maximum accepted export file size, in bytes (32 MiB). */
  maxFileBytes: 32 * 1024 * 1024,
  /** Maximum records per canonical domain. */
  maxRecordsPerDomain: 200_000,
  /** Maximum length of a single string value. */
  maxStringLength: 20_000,
  /** Maximum nesting depth of the snapshot graph. */
  maxDepth: 12,
} as const

function assertImportLimits(snapshot: Record<string, unknown>): void {
  let records = 0
  const queue: Array<{ value: unknown; depth: number }> = [{ value: snapshot, depth: 0 }]

  while (queue.length > 0) {
    const entry = queue.pop()
    if (!entry) {
      break
    }
    const { value, depth } = entry

    if (depth > IMPORT_LIMITS.maxDepth) {
      throw new Error(`Import rejected: nested deeper than ${IMPORT_LIMITS.maxDepth} levels.`)
    }

    if (typeof value === 'string') {
      if (value.length > IMPORT_LIMITS.maxStringLength) {
        throw new Error(`Import rejected: a text value is longer than ${IMPORT_LIMITS.maxStringLength} characters.`)
      }
      continue
    }

    if (Array.isArray(value)) {
      records += value.length
      if (value.length > IMPORT_LIMITS.maxRecordsPerDomain) {
        throw new Error(`Import rejected: more than ${IMPORT_LIMITS.maxRecordsPerDomain} records in one section.`)
      }
      if (records > IMPORT_LIMITS.maxRecordsPerDomain * 4) {
        throw new Error('Import rejected: too many records in total.')
      }
      for (const item of value) {
        queue.push({ value: item, depth: depth + 1 })
      }
      continue
    }

    if (typeof value === 'object' && value !== null) {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        queue.push({ value: nested, depth: depth + 1 })
      }
    }
  }
}
