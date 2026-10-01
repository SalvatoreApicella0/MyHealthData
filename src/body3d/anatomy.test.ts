import { describe, expect, it } from 'vitest'
import { DEFAULT_VISIBLE, LAYER_PRESETS, SYSTEMS } from './anatomy'

describe('anatomy systems', () => {
  it('defines the 15 upstream systems with unique colors', () => {
    expect(SYSTEMS).toHaveLength(15)
    expect(new Set(SYSTEMS.map((system) => system.id)).size).toBe(15)
    expect(new Set(SYSTEMS.map((system) => system.color)).size).toBe(15)
  })

  it('keeps pain-relevant systems in the default layer', () => {
    expect(DEFAULT_VISIBLE).toEqual(['skeletal', 'muscular', 'nervous', 'integumentary'])
  })

  it('covers every system in the all preset and keeps presets in SYSTEMS order', () => {
    const all = LAYER_PRESETS.find((preset) => preset.id === 'all')
    expect(all?.systems).toEqual(SYSTEMS.map((system) => system.id))
    for (const preset of LAYER_PRESETS) {
      const indexes = preset.systems.map((id) => SYSTEMS.findIndex((system) => system.id === id))
      expect(indexes).not.toContain(-1)
      expect([...indexes].sort((a, b) => a - b)).toEqual(indexes)
    }
  })
})
