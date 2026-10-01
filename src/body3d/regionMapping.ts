import type { BodyRegionId } from '../core/types'
import type { Atlas, AtlasPart } from './anatomy'

export interface Point3 {
  x: number
  y: number
  z: number
}

type Side = 'left' | 'right' | 'mid'

interface KeywordRule {
  pattern: RegExp
  region: BodyRegionId
  lateral: boolean
}

// Order matters: first match wins, so muscles that sit in the abdomen are
// listed before generic abdominal organs.
const KEYWORD_RULES: KeywordRule[] = [
  { pattern: /\bpatella\b|\bknee\b/, region: 'left_knee', lateral: true },
  { pattern: /femur/, region: 'left_leg', lateral: true },
  { pattern: /\btibia\b|\bfibula\b/, region: 'left_leg', lateral: true },
  { pattern: /\bankle\b|\btarsal\b(?! plate)|\bmetatarsal\b|\bcalcaneus\b|\btalus\b|\btoe\b|\bfoot\b/, region: 'left_foot', lateral: true },
  { pattern: /\bhip bone\b|\bglute|\bbuttock|\bpelvi|\bilium\b|\bischium\b|\bpubis\b/, region: 'left_hip', lateral: true },
  { pattern: /\bsacrum\b|\blumbar\b/, region: 'lower_back', lateral: false },
  { pattern: /\bthoracic vertebra\b|\brib\b|\bscapula\b|\btrapezius\b|\blatissimus\b/, region: 'upper_back', lateral: false },
  { pattern: /\bpectoral|\bsternum\b|\bmamma/, region: 'chest', lateral: false },
  { pattern: /\bheart\b|\blung\b|\bthymus\b/, region: 'chest', lateral: false },
  { pattern: /\bstomach\b|\bliver\b|\bintestin|\bcolon\b|\bcaecum\b|\bcecum\b|\brectum\b|\bappendix\b|\bspleen\b|\bpancreas\b|\bgallbladder\b|\bduodenum\b|\bjejunum\b|\bileum\b|(external|internal) oblique|\bkidney\b|\bbladder\b|\bprostate\b|\buterus\b|\bovary\b/, region: 'abdomen', lateral: false },
  { pattern: /\bcervical\b|\bthyroid\b|\btrachea\b|\blarynx\b|\bhyoid\b/, region: 'neck', lateral: false },
  { pattern: /\bskull\b|\bcranium\b|\bmandible\b|\bmaxilla\b|\bbrain\b|\beye\b|\bear\b|\bnose\b|\btongue\b|\btooth\b|\bteeth\b|\bgingiva\b|\blip\b|\bhair\b|\beyebrow\b|\bface\b|\bfacial\b/, region: 'head', lateral: false },
  { pattern: /\bclavicle\b|\bacromion\b|\bdeltoid\b/, region: 'left_shoulder', lateral: true },
  { pattern: /\bhumerus\b|\bradius\b|\bulna\b|\barm\b/, region: 'left_arm', lateral: true },
  { pattern: /\belbow\b/, region: 'left_elbow', lateral: true },
  { pattern: /\bcarpal\b|\bmetacarpal\b|\bfinger\b|\bthumb\b|\bhand\b/, region: 'left_hand', lateral: true },
]

function laterality(name: string, x: number): Side {
  if (/\bleft\b/i.test(name)) return 'left'
  if (/\bright\b/i.test(name)) return 'right'
  if (x > 0.03) return 'left'
  if (x < -0.03) return 'right'
  return 'mid'
}

function sided(region: BodyRegionId, side: Side): BodyRegionId {
  if (side === 'mid') return region
  return region.replace(/^left_/, `${side}_`) as BodyRegionId
}

function centroid(part: AtlasPart): Point3 {
  return {
    x: (part.bounds[0][0]! + part.bounds[1][0]!) / 2,
    y: (part.bounds[0][1]! + part.bounds[1][1]!) / 2,
    z: (part.bounds[0][2]! + part.bounds[1][2]!) / 2,
  }
}

export function regionForPoint(point: Point3): BodyRegionId {
  const { x, y, z } = point
  const side: Side = Math.abs(x) < 0.03 ? 'mid' : x > 0 ? 'left' : 'right'
  const lateral = (region: BodyRegionId) => sided(region, side)
  const axial = Math.abs(x)

  if (y >= 1.56) return 'head'
  if (y >= 1.44) {
    return axial >= 0.135 ? lateral('left_shoulder') : 'neck'
  }
  if (y >= 1.15) {
    if (axial >= 0.135 && y >= 1.3) return lateral('left_shoulder')
    if (axial >= 0.135) return lateral('left_arm')
    return z >= 0 ? 'chest' : 'upper_back'
  }
  if (y >= 1.03) {
    if (axial >= 0.19) return lateral('left_elbow')
    if (axial >= 0.135) return lateral('left_arm')
    return z >= 0 ? 'abdomen' : 'lower_back'
  }
  if (y >= 0.9) {
    if (axial >= 0.19) return lateral('left_arm')
    return z >= 0 ? 'abdomen' : 'lower_back'
  }
  if (y >= 0.8) {
    if (axial >= 0.18) return lateral('left_hand')
    if (axial >= 0.03) return lateral('left_hip')
    return z >= 0 ? 'abdomen' : 'lower_back'
  }
  if (y >= 0.52) {
    if (axial >= 0.18) return lateral('left_hand')
    return lateral('left_leg')
  }
  if (y >= 0.4) return lateral('left_knee')
  if (y >= 0.13) return lateral('left_leg')
  return lateral('left_foot')
}

export function regionForPart(part: AtlasPart): BodyRegionId | undefined {
  if (part.system === 'integumentary') {
    return undefined
  }
  const center = centroid(part)
  const side = laterality(part.name, center.x)
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(part.name.toLowerCase())) {
      return rule.lateral ? sided(rule.region, side) : rule.region
    }
  }
  return regionForPoint(center)
}

export function regionForTap(part: AtlasPart, point: Point3): BodyRegionId {
  return regionForPart(part) ?? regionForPoint(point)
}

const regionCache = new WeakMap<Atlas, Map<BodyRegionId, string[]>>()

export function partIdsByRegion(atlas: Atlas, regionId: BodyRegionId): string[] {
  let cache = regionCache.get(atlas)
  if (!cache) {
    cache = new Map()
    for (const part of atlas.parts) {
      const region = regionForPart(part)
      if (!region) continue
      const list = cache.get(region) ?? []
      list.push(part.id)
      cache.set(region, list)
    }
    regionCache.set(atlas, cache)
  }
  return cache.get(regionId) ?? []
}
