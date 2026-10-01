import { describe, expect, it } from 'vitest'
import { BODY_REGIONS } from './bodyRegions'
import { EVENT_TYPES } from './constants'
import { SYMPTOM_PRESETS } from './symptomPresets'

const EVENT_TYPE_IDS = EVENT_TYPES.map((entry) => entry.id)

describe('symptom presets', () => {
  it('uses unique ids, valid types and valid regions', () => {
    expect(new Set(SYMPTOM_PRESETS.map((preset) => preset.id)).size).toBe(SYMPTOM_PRESETS.length)
    for (const preset of SYMPTOM_PRESETS) {
      expect(EVENT_TYPE_IDS).toContain(preset.type)
      if (preset.regionId) {
        expect(BODY_REGIONS.some((region) => region.id === preset.regionId)).toBe(true)
      }
      expect(preset.descriptionKey).toMatch(/^symptom\.preset\./)
    }
  })

  it('avoids lateral presets so a preset never guesses a side', () => {
    for (const preset of SYMPTOM_PRESETS) {
      expect(preset.regionId?.startsWith('left_') || preset.regionId?.startsWith('right_')).toBeFalsy()
    }
  })
})
