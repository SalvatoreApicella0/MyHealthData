import { describe, expect, it } from 'vitest'
import {
  DASHBOARD_MODULES,
  HEALTH_MODULES,
  MEASUREMENT_MODULE_TYPES,
  getHealthModule,
  measurementModuleTitle,
  moduleCopy,
  resolveHealthModuleId,
  totalRecordCount,
} from './healthModules'
import { dictionaries } from '../i18n/messages'

/**
 * Parity guards.
 *
 * `HealthFeature.allCases` in HealthFeatureHubView.swift and
 * `HealthFeature.healthModules` define the canonical catalog. If the iOS
 * catalog changes, these expectations must change in the same commit — that is
 * the point of the test.
 */
describe('health module catalog', () => {
  it('keeps the iOS catalog order', () => {
    expect(HEALTH_MODULES.map((module) => module.id)).toEqual([
      'body',
      'cycle',
      'sexualHealth',
      'allergies',
      'vision',
      'gutHealth',
      'dental',
      'sleep',
      'heart',
      'activity',
      'gym',
      'bodyMeasurements',
      'nutrition',
      'medications',
      'bloodwork',
      'trends',
      'backupSync',
      'shareForCare',
    ])
  })

  it('mirrors HealthFeature.healthModules membership', () => {
    expect(DASHBOARD_MODULES.map((module) => module.id)).toEqual([
      'body',
      'cycle',
      'sexualHealth',
      'allergies',
      'vision',
      'gutHealth',
      'dental',
      'sleep',
      'heart',
      'activity',
      'bodyMeasurements',
      'nutrition',
      'medications',
      'bloodwork',
    ])
  })

  it('keeps tab-owned surfaces out of the unified data catalog', () => {
    expect(HEALTH_MODULES.map((module) => module.id)).not.toContain('visits')
    expect(HEALTH_MODULES.map((module) => module.id)).not.toContain('documents')
  })

  it('redirects the retired hydration module to the canonical food diary', () => {
    expect(HEALTH_MODULES.map((module) => module.id)).not.toContain('hydration')
    expect(resolveHealthModuleId('hydration')).toBe('nutrition')
    expect(getHealthModule('hydration').id).toBe('nutrition')
    expect(moduleCopy('hydration', 'it')).toEqual(moduleCopy('nutrition', 'it'))
    expect(measurementModuleTitle('hydration', 'it')).toBe(measurementModuleTitle('nutrition', 'it'))
  })

  it('gives every module unique artwork, tint and localized copy', () => {
    const images = HEALTH_MODULES.map((module) => module.cardImage)
    expect(new Set(images).size).toBeGreaterThan(12)

    for (const module of HEALTH_MODULES) {
      expect(module.cardImage.startsWith('/modules/Module')).toBe(true)
      expect(module.tint).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(module.symbol.length).toBeGreaterThan(0)
      expect(moduleCopy(module.id, 'it').title.length).toBeGreaterThan(0)
      expect(moduleCopy(module.id, 'en').title.length).toBeGreaterThan(0)
    }
  })

  it('mirrors HealthMetricModule.types groups', () => {
    expect(MEASUREMENT_MODULE_TYPES.heart).toContain('heart_rate')
    expect(MEASUREMENT_MODULE_TYPES.heart).toContain('body_temperature')
    expect(MEASUREMENT_MODULE_TYPES.activity).toContain('treadmill_corrected_distance')
    expect(MEASUREMENT_MODULE_TYPES.hydration).toEqual(['dietary_water', 'dietary_caffeine', 'alcohol_units'])
    expect(MEASUREMENT_MODULE_TYPES.nutrition).toEqual(['dietary_energy', 'dietary_water', 'dietary_caffeine', 'alcohol_units'])
    expect(MEASUREMENT_MODULE_TYPES.bodyMeasurements).toContain('neck_circumference')
    expect(MEASUREMENT_MODULE_TYPES.heart).toContain('respiratory_rate')
    expect(MEASUREMENT_MODULE_TYPES).not.toHaveProperty('diabetes')
    expect(MEASUREMENT_MODULE_TYPES).not.toHaveProperty('respiratory')
  })

  it('rejects unknown module identifiers', () => {
    expect(() => getHealthModule('nope' as never)).toThrow()
  })

  it('counts canonical records for the vault footer', () => {
    expect(
      totalRecordCount({
        profile: { id: 'local-profile' },
        events: [{ id: 'a' }],
        measurements: [{ id: 'b' }, { id: 'c' }],
        labResults: [{ id: 'd' }],
        unknownDomain: [{ id: 'e' }],
      }),
    ).toBe(5)
  })
})

describe('localization catalogs', () => {
  it('keeps Italian and English in sync', () => {
    const italian = Object.keys(dictionaries.it).sort()
    const english = Object.keys(dictionaries.en).sort()
    expect(english).toEqual(italian)
  })

  it('covers every canonical measurement, event, document and region label', () => {
    const required = [
      'measurement.heart_rate',
      'measurement.treadmill_corrected_distance',
      'measurement.dietary_water',
      'event.allergy',
      'event.vision_prescription',
      'event.dental_care',
      'document.medical_report',
      'region.lower_back',
    ]
    for (const key of required) {
      expect(dictionaries.it[key], `it:${key}`).toBeTruthy()
      expect(dictionaries.en[key], `en:${key}`).toBeTruthy()
    }
  })
})
