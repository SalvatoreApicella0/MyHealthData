export type SystemId =
  | 'skeletal'
  | 'muscular'
  | 'arterial'
  | 'venous'
  | 'nervous'
  | 'digestive'
  | 'respiratory'
  | 'urinary'
  | 'reproductive'
  | 'lymphatic'
  | 'endocrine'
  | 'integumentary'
  | 'connective'
  | 'sensory'
  | 'cardiac'

export type ViewId = 'three-quarter' | 'front' | 'side' | 'back'

export interface AtlasChunk {
  url: string
  bytes: number
  gzip?: string
  gzipBytes?: number
}

export interface AtlasPart {
  id: string
  name: string
  conceptId: string
  system: SystemId
  chunk: number
  positions: number
  normals: number
  indices: number
  vertexCount: number
  indexCount: number
  bounds: [number[], number[]]
}

export interface AtlasConcept {
  id: string
  name: string
  elements: string[]
}

export interface Atlas {
  version: string
  parts: AtlasPart[]
  concepts: AtlasConcept[]
  chunks: AtlasChunk[]
  triangles: number
}

export interface SystemDef {
  id: SystemId
  color: string
}

// Upstream Human Atlas order and colors; indexes are stable across the app.
export const SYSTEMS: SystemDef[] = [
  { id: 'skeletal', color: '#e2d9ba' },
  { id: 'muscular', color: '#a85b50' },
  { id: 'cardiac', color: '#b96760' },
  { id: 'sensory', color: '#b0c8ce' },
  { id: 'arterial', color: '#c05245' },
  { id: 'venous', color: '#527c9f' },
  { id: 'nervous', color: '#d8b565' },
  { id: 'respiratory', color: '#b98991' },
  { id: 'digestive', color: '#b8916b' },
  { id: 'urinary', color: '#b47961' },
  { id: 'lymphatic', color: '#879f7c' },
  { id: 'endocrine', color: '#c5a09a' },
  { id: 'reproductive', color: '#bda098' },
  { id: 'integumentary', color: '#ba9b7d' },
  { id: 'connective', color: '#aec3bb' },
]

const ORDERED_IDS = SYSTEMS.map((system) => system.id)

function ordered(ids: SystemId[]): SystemId[] {
  return ORDERED_IDS.filter((id) => ids.includes(id))
}

export const LAYER_PRESETS: { id: 'pain' | 'organs' | 'all'; systems: SystemId[] }[] = [
  { id: 'pain', systems: ordered(['integumentary', 'skeletal', 'muscular', 'nervous']) },
  {
    id: 'organs',
    systems: ordered(['cardiac', 'sensory', 'respiratory', 'digestive', 'urinary', 'lymphatic', 'endocrine', 'reproductive']),
  },
  { id: 'all', systems: ordered([...ORDERED_IDS]) },
]

export const DEFAULT_VISIBLE: SystemId[] = LAYER_PRESETS[0]?.systems ?? ['skeletal']
