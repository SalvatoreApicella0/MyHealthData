// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Atlas, AtlasPart } from './anatomy'
import { partIdsByRegion, regionForPart, regionForPoint, regionForTap } from './regionMapping'

const atlas = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../public/models/atlas.json', import.meta.url)), 'utf8'),
) as Atlas

function part(name: string): AtlasPart {
  const found = atlas.parts.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`missing part: ${name}`)
  return found
}

describe('regionForPart', () => {
  it('maps landmark parts from the shipped atlas', () => {
    expect(regionForPart(part('Left femur'))).toBe('left_leg')
    expect(regionForPart(part('Right patella'))).toBe('right_knee')
    expect(regionForPart(part('Left humerus'))).toBe('left_arm')
    expect(regionForPart(part('Left radius'))).toBe('left_arm')
    expect(regionForPart(part('Left first metacarpal bone'))).toBe('left_hand')
    expect(regionForPart(part('Right gluteus maximus'))).toBe('right_hip')
    expect(regionForPart(part('Abdominal part of right pectoralis major'))).toBe('chest')
    expect(regionForPart(part('Body of sternum'))).toBe('chest')
    expect(regionForPart(part('Tenth thoracic vertebra'))).toBe('upper_back')
    expect(regionForPart(part('First lumbar vertebra'))).toBe('lower_back')
    expect(regionForPart(part('Sacrum'))).toBe('lower_back')
    expect(regionForPart(part('Left clavicle'))).toBe('left_shoulder')
    expect(regionForPart(part('Mandible'))).toBe('head')
    expect(regionForPart(part('Third cervical vertebra'))).toBe('neck')
    expect(regionForPart(part('Stomach'))).toBe('abdomen')
  })

  it('returns undefined for whole-body meshes', () => {
    expect(regionForPart(part('Skin'))).toBeUndefined()
  })
})

describe('regionForPoint', () => {
  it('classifies the body bands', () => {
    expect(regionForPoint({ x: 0, y: 1.65, z: 0.05 })).toBe('head')
    expect(regionForPoint({ x: 0, y: 1.5, z: 0 })).toBe('neck')
    expect(regionForPoint({ x: 0, y: 1.3, z: 0.1 })).toBe('chest')
    expect(regionForPoint({ x: 0, y: 1.0, z: 0.1 })).toBe('abdomen')
    expect(regionForPoint({ x: 0, y: 1.3, z: -0.1 })).toBe('upper_back')
    expect(regionForPoint({ x: 0, y: 1.0, z: -0.1 })).toBe('lower_back')
  })

  it('classifies limbs and laterality', () => {
    expect(regionForPoint({ x: 0.25, y: 1.25, z: 0 })).toBe('left_arm')
    expect(regionForPoint({ x: -0.24, y: 1.05, z: 0 })).toBe('right_elbow')
    expect(regionForPoint({ x: 0.28, y: 0.84, z: 0.04 })).toBe('left_hand')
    expect(regionForPoint({ x: 0.09, y: 0.88, z: -0.07 })).toBe('left_hip')
    expect(regionForPoint({ x: 0.09, y: 0.68, z: 0 })).toBe('left_leg')
    expect(regionForPoint({ x: 0.08, y: 0.46, z: 0.01 })).toBe('left_knee')
    expect(regionForPoint({ x: 0.1, y: 0.25, z: 0 })).toBe('left_leg')
    expect(regionForPoint({ x: 0.07, y: 0.05, z: -0.04 })).toBe('left_foot')
    expect(regionForPoint({ x: -0.07, y: 0.05, z: -0.04 })).toBe('right_foot')
  })
})

describe('regionForTap', () => {
  it('prefers the part mapping and falls back to the point for whole-body meshes', () => {
    expect(regionForTap(part('Left femur'), { x: 0.09, y: 0.68, z: 0 })).toBe('left_leg')
    expect(regionForTap(part('Skin'), { x: 0.28, y: 0.84, z: 0.04 })).toBe('left_hand')
  })
})

describe('partIdsByRegion', () => {
  it('lists parts for a region and caches the result', () => {
    const leftLeg = partIdsByRegion(atlas, 'left_leg')
    expect(leftLeg).toContain(part('Left femur').id)
    expect(leftLeg).not.toContain(part('Right femur').id)
    expect(partIdsByRegion(atlas, 'left_leg')).toBe(leftLeg)
  })
})

describe('regionForPart keyword regressions from the shipped atlas', () => {
  it('does not misclassify keyword substrings as head, foot, abdomen or shoulder regions', () => {
    expect(regionForPart(part('Interosseous membrane of left forearm'))).toBe('left_arm')
    expect(regionForPart(part('Tarsal plate of left upper eyelid'))).toBe('head')
    expect(regionForPart(part('Left superior oblique'))).toBe('head')
    expect(regionForPart(part('Thoracic rotator'))).toBe('upper_back')
    expect(regionForPart(part('Left lumbar rotator'))).toBe('lower_back')
    expect(regionForPart(part('Tributary of middle hepatic vein'))).toBe('chest')
    expect(regionForPart(part('Lateral head of right gastrocnemius'))).toBe('right_leg')
    expect(regionForPart(part('Long head of right biceps femoris'))).toBe('right_leg')
  })
})
