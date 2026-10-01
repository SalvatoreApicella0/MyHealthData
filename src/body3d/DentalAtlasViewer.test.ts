import { describe, expect, it } from 'vitest'
import { createProceduralToothGeometry, DENTAL_3D_EXPECTED_FDI, DENTAL_PROCEDURAL_FDI, dentalMeshPlan, fdiForPart } from './DentalAtlasViewer'
import atlasManifest from '../../public/models/atlas.json'
import { dentalToneLabel } from '../core/dental'

describe('dental atlas mapping', () => {
  it('maps the shipped anatomical names to FDI positions', () => {
    expect(fdiForPart('Left upper central secondary incisor tooth')).toBe('21')
    expect(fdiForPart('Right upper first secondary molar tooth')).toBe('16')
    expect(fdiForPart('Left lower second secondary premolar tooth')).toBe('35')
    expect(fdiForPart('Right lower third secondary molar tooth')).toBe('48')
    expect(fdiForPart('Gingiva of upper jaw')).toBeUndefined()
    expect(fdiForPart('Right upper unknown tooth')).toBeUndefined()
  })

  it('keeps a complete 32-tooth FDI contract', () => {
    expect(DENTAL_3D_EXPECTED_FDI).toHaveLength(32)
    expect(DENTAL_3D_EXPECTED_FDI).toContain('18')
    expect(DENTAL_3D_EXPECTED_FDI).toContain('28')
    expect(DENTAL_3D_EXPECTED_FDI).toContain('38')
    expect(DENTAL_3D_EXPECTED_FDI).toContain('48')
  })

  it('maps 28 atlas meshes and supplies explicit fallbacks for the four third molars', () => {
    const names = atlasManifest.parts.filter((part) => /tooth/i.test(part.name))
    const plan = dentalMeshPlan(names)
    expect(names).toHaveLength(28)
    expect(plan).toHaveLength(32)
    expect(new Set(plan.map((entry) => entry.tooth))).toEqual(new Set(DENTAL_3D_EXPECTED_FDI))
    expect(plan.filter((entry) => entry.source === 'atlas')).toHaveLength(28)
    expect(plan.filter((entry) => entry.source === 'procedural').map((entry) => entry.tooth)).toEqual([...DENTAL_PROCEDURAL_FDI])
  })

  it('creates a lightweight real mesh for each procedural fallback', () => {
    const geometry = createProceduralToothGeometry()
    expect(geometry.getAttribute('position').count).toBeGreaterThan(0)
    expect(geometry.index?.count).toBeGreaterThan(0)
    geometry.dispose()
  })

  it('keeps clinical state labels identical across the visual modes', () => {
    const state = new Map([['16', 'caries'], ['17', 'extraction'], ['18', 'treated']])
    expect(dentalToneLabel('16', state, 'it')).toBe('carie')
    expect(dentalToneLabel('17', state, 'en')).toBe('removed')
    expect(dentalToneLabel('18', state, 'it')).toBe('intervento')
    expect(dentalToneLabel('48', state, 'it')).toBe('nessun intervento')
  })
})
