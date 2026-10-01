import type { BodyRegionId } from './types'

export const BODY_REGIONS: Array<{ id: BodyRegionId; label: string; group: 'head' | 'torso' | 'arm' | 'leg' }> = [
  { id: 'head', label: 'Head', group: 'head' },
  { id: 'neck', label: 'Neck', group: 'head' },
  { id: 'chest', label: 'Chest', group: 'torso' },
  { id: 'abdomen', label: 'Abdomen', group: 'torso' },
  { id: 'upper_back', label: 'Upper back', group: 'torso' },
  { id: 'lower_back', label: 'Lower back', group: 'torso' },
  { id: 'right_shoulder', label: 'Right shoulder', group: 'arm' },
  { id: 'left_shoulder', label: 'Left shoulder', group: 'arm' },
  { id: 'right_arm', label: 'Right arm', group: 'arm' },
  { id: 'left_arm', label: 'Left arm', group: 'arm' },
  { id: 'right_elbow', label: 'Right elbow', group: 'arm' },
  { id: 'left_elbow', label: 'Left elbow', group: 'arm' },
  { id: 'right_hand', label: 'Right hand', group: 'arm' },
  { id: 'left_hand', label: 'Left hand', group: 'arm' },
  { id: 'right_hip', label: 'Right hip', group: 'leg' },
  { id: 'left_hip', label: 'Left hip', group: 'leg' },
  { id: 'right_leg', label: 'Right leg', group: 'leg' },
  { id: 'left_leg', label: 'Left leg', group: 'leg' },
  { id: 'right_knee', label: 'Right knee', group: 'leg' },
  { id: 'left_knee', label: 'Left knee', group: 'leg' },
  { id: 'right_foot', label: 'Right foot', group: 'leg' },
  { id: 'left_foot', label: 'Left foot', group: 'leg' },
]

export const BODY_REGION_LABELS: Record<BodyRegionId, string> = BODY_REGIONS.reduce(
  (labels, region) => ({ ...labels, [region.id]: region.label }),
  {} as Record<BodyRegionId, string>,
)

export function getBodyRegionLabel(regionId?: BodyRegionId): string {
  return regionId ? BODY_REGION_LABELS[regionId] : 'No body region'
}
