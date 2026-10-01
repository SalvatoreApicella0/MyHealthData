import type { BodyRegionId, EventType } from './types'

export interface SymptomPreset {
  id: string
  type: EventType
  regionId?: BodyRegionId
  descriptionKey: string
}

// Presets never guess a side: lateral regions are left to the tap on the body.
export const SYMPTOM_PRESETS: SymptomPreset[] = [
  { id: 'headache', type: 'pain', regionId: 'head', descriptionKey: 'symptom.preset.headache.description' },
  { id: 'back_pain', type: 'pain', regionId: 'lower_back', descriptionKey: 'symptom.preset.back_pain.description' },
  { id: 'neck_pain', type: 'stiffness', regionId: 'neck', descriptionKey: 'symptom.preset.neck_pain.description' },
  { id: 'stomach', type: 'discomfort', regionId: 'abdomen', descriptionKey: 'symptom.preset.stomach.description' },
  { id: 'nausea', type: 'general_symptom', regionId: 'abdomen', descriptionKey: 'symptom.preset.nausea.description' },
  { id: 'fever', type: 'general_symptom', descriptionKey: 'symptom.preset.fever.description' },
  { id: 'cramps', type: 'discomfort', regionId: 'abdomen', descriptionKey: 'symptom.preset.cramps.description' },
  { id: 'toothache', type: 'pain', regionId: 'head', descriptionKey: 'symptom.preset.toothache.description' },
]
