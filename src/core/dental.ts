import type { HealthEvent } from './types'

export const FDI_TEETH = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '31', '32', '33', '34', '35', '36', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48',
] as const

export type FdiTooth = (typeof FDI_TEETH)[number]
export type DentalToothKind = 'incisor' | 'canine' | 'premolar' | 'molar'
export type DentalActionId =
  | 'cleaning'
  | 'checkup'
  | 'filling'
  | 'rootCanal'
  | 'crown'
  | 'implant'
  | 'extraction'
  | 'orthodontics'
  | 'caries'
  | 'pain'
  | 'brushing'
  | 'flossing'
  | 'mouthwash'
  | 'restoration'

export type DentalToothState = 'healthy' | 'observation' | 'caries' | 'treated' | 'crown' | 'implant' | 'removed'
export type DentalVisualTone = 'caries' | 'extraction' | 'treated'

/** Canonical iOS/Web tags for an explicit tooth restoration. */
export function dentalRestorationTags(tooth: FdiTooth): string[] {
  return [`tooth=${tooth}`, 'action=restoration', 'state=healthy', 'restored=true']
}

export interface DentalEventResolution {
  event: HealthEvent
  tooth?: FdiTooth
  action?: DentalActionId
  state?: DentalToothState
  isRestoration: boolean
}

export interface DentalToothProjection {
  tooth: FdiTooth
  state?: DentalToothState
  tone?: DentalVisualTone
  removed: boolean
  latestEvent?: HealthEvent
  history: readonly DentalEventResolution[]
}

export interface DentalProjection {
  /** All accepted dental events, sorted oldest to newest for deterministic replay. */
  events: readonly DentalEventResolution[]
  /** One canonical, monotonic projection for every FDI tooth found in the history. */
  byTooth: ReadonlyMap<FdiTooth, DentalToothProjection>
}

export const DENTAL_ARCHES = [
  { id: 'upper', labelIt: 'Arcata superiore', labelEn: 'Upper arch', teeth: FDI_TEETH.slice(0, 16), lower: false },
  { id: 'lower', labelIt: 'Arcata inferiore', labelEn: 'Lower arch', teeth: FDI_TEETH.slice(16), lower: true },
] as const

/**
 * FDI quadrants in front-view order. The lower arch is stored in numeric order
 * (31–38, 41–48), while a clinical front view starts from the patient's right
 * (48–41, Q4) and then continues through the patient's left (31–38, Q3).
 */
export const DENTAL_QUADRANTS = {
  upper: [
    { id: '1', side: 'right', teeth: DENTAL_ARCHES[0].teeth.slice(0, 8) },
    { id: '2', side: 'left', teeth: DENTAL_ARCHES[0].teeth.slice(8) },
  ],
  lower: [
    { id: '4', side: 'right', teeth: [...DENTAL_ARCHES[1].teeth.slice(8)].reverse() },
    { id: '3', side: 'left', teeth: DENTAL_ARCHES[1].teeth.slice(0, 8) },
  ],
} as const

export function dentalToothKind(tooth: string): DentalToothKind {
  switch (tooth[1]) {
    case '1':
    case '2': return 'incisor'
    case '3': return 'canine'
    case '4':
    case '5': return 'premolar'
    default: return 'molar'
  }
}

export function dentalToneLabel(tooth: string, state: ReadonlyMap<string, string>, language: 'it' | 'en'): string {
  const tone = state.get(tooth)
  if (tone === 'extraction') return language === 'it' ? 'rimosso' : 'removed'
  if (tone === 'caries') return language === 'it' ? 'carie' : 'caries'
  if (tone === 'treated') return language === 'it' ? 'intervento' : 'treatment'
  return language === 'it' ? 'nessun intervento' : 'no treatment'
}

function normalizeDentalToken(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function dentalTagValues(tags: readonly string[] | undefined): Map<string, string> {
  const values = new Map<string, string>()
  for (const tag of tags ?? []) {
    const separator = tag.indexOf('=')
    if (separator <= 0) continue
    values.set(tag.slice(0, separator).trim().toLowerCase(), tag.slice(separator + 1).trim())
  }
  return values
}

const DENTAL_ACTION_ALIASES: Record<string, DentalActionId> = {
  cleaning: 'cleaning', pulizia: 'cleaning', igiene: 'cleaning',
  check: 'checkup', checkup: 'checkup', controllo: 'checkup', visita: 'checkup',
  filling: 'filling', otturazione: 'filling', restoration: 'restoration', ripristino: 'restoration', ripristinodente: 'restoration',
  rootcanal: 'rootCanal', devitalizzazione: 'rootCanal', endodonzia: 'rootCanal',
  crown: 'crown', corona: 'crown', implant: 'implant', impianto: 'implant',
  extraction: 'extraction', extracted: 'extraction', estrazione: 'extraction', rimozione: 'extraction',
  orthodontics: 'orthodontics', ortodonzia: 'orthodontics',
  caries: 'caries', carie: 'caries', pain: 'pain', dolore: 'pain', toothache: 'pain',
  brushing: 'brushing', spazzolamento: 'brushing', flossing: 'flossing', filo: 'flossing',
  mouthwash: 'mouthwash', collutorio: 'mouthwash',
}

/** Resolve legacy/localized action labels to one stable history ID. */
export function dentalActionIdFromTags(tags: readonly string[] | undefined): DentalActionId | undefined {
  const values = dentalTagValues(tags)
  for (const raw of [values.get('intervention'), values.get('action')]) {
    if (!raw) continue
    const action = DENTAL_ACTION_ALIASES[normalizeDentalToken(raw)]
    if (action) return action
  }
  return undefined
}

function dentalStateFromTags(values: Map<string, string>, action: DentalActionId | undefined): DentalToothState | undefined {
  const rawState = values.get('state') ?? values.get('status')
  const state = rawState ? normalizeDentalToken(rawState) : undefined
  if (state === 'removed' || state === 'extraction' || state === 'extracted') return 'removed'
  if (state === 'caries') return 'caries'
  if (state === 'crown') return 'crown'
  if (state === 'implant') return 'implant'
  if (state === 'treated' || state === 'restored') return 'treated'
  if (state === 'healthy') return 'healthy'
  if (state === 'observation' || state === 'tocheck') return 'observation'

  switch (action) {
    case 'caries': return 'caries'
    case 'extraction': return 'removed'
    case 'crown': return 'crown'
    case 'implant': return 'implant'
    case 'filling':
    case 'rootCanal':
    case 'orthodontics': return 'treated'
    case 'checkup':
    case 'pain': return 'observation'
    default: return undefined
  }
}

function fdiToothFromTags(values: Map<string, string>): FdiTooth | undefined {
  const raw = values.get('tooth')?.replace(/\s+/g, '')
  return raw && FDI_TEETH.includes(raw as FdiTooth) ? raw as FdiTooth : undefined
}

function isTrue(raw: string | undefined): boolean {
  return raw !== undefined && ['true', '1', 'yes', 'si'].includes(normalizeDentalToken(raw))
}

/** Resolve one event without applying chronological state rules. */
export function resolveDentalEvent(event: HealthEvent): DentalEventResolution {
  const values = dentalTagValues(event.tags)
  const action = dentalActionIdFromTags(event.tags)
  const taggedState = dentalStateFromTags(values, action)
  const isRestoration = isTrue(values.get('restored')) || action === 'restoration' || normalizeDentalToken(values.get('state') ?? '') === 'restored'
  const state = isRestoration && (!taggedState || taggedState === 'removed') ? 'healthy' : taggedState
  return { event, tooth: fdiToothFromTags(values), action, state, isRestoration }
}

function timestamp(value: string | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

function compareChronology(left: HealthEvent, right: HealthEvent): number {
  return timestamp(left.occurredAt) - timestamp(right.occurredAt)
    || timestamp(left.createdAt) - timestamp(right.createdAt)
    || timestamp(left.updatedAt) - timestamp(right.updatedAt)
    || left.id.localeCompare(right.id)
}

function compareRevision(left: HealthEvent, right: HealthEvent): number {
  return timestamp(left.updatedAt) - timestamp(right.updatedAt)
    || timestamp(left.createdAt) - timestamp(right.createdAt)
    || JSON.stringify(left).localeCompare(JSON.stringify(right))
}

function uniqueDentalEvents(events: readonly HealthEvent[]): HealthEvent[] {
  const byId = new Map<string, HealthEvent>()
  for (const event of events) {
    if (event.type !== 'dental_care') continue
    const previous = byId.get(event.id)
    if (!previous || compareRevision(event, previous) > 0) byId.set(event.id, event)
  }
  return [...byId.values()]
}

function visualTone(state: DentalToothState | undefined): DentalVisualTone | undefined {
  if (state === 'caries') return 'caries'
  if (state === 'removed') return 'extraction'
  if (state === 'treated' || state === 'crown' || state === 'implant') return 'treated'
  return undefined
}

/**
 * Replay the shared dental contract in chronological order.
 *
 * Extraction is a monotonic lock: later ordinary events are retained in the
 * history but cannot resurrect a tooth. Only `restored=true` (or the explicit
 * restoration action) unlocks it. Duplicate IDs are reduced to their newest
 * revision before replay, so imports and retries are deterministic.
 */
export function resolveDentalEvents(events: readonly HealthEvent[]): DentalProjection {
  const ordered = uniqueDentalEvents(events).sort(compareChronology).map(resolveDentalEvent)
  const histories = new Map<FdiTooth, DentalEventResolution[]>()
  for (const entry of ordered) {
    if (!entry.tooth) continue
    histories.set(entry.tooth, [...(histories.get(entry.tooth) ?? []), entry])
  }

  const byTooth = new Map<FdiTooth, DentalToothProjection>()
  for (const [tooth, history] of histories) {
    let state: DentalToothState | undefined
    let latestEvent: HealthEvent | undefined
    let removed = false
    for (const entry of history) {
      if (entry.isRestoration) {
        removed = false
        state = entry.state === 'removed' ? 'healthy' : entry.state ?? 'healthy'
        latestEvent = entry.event
        continue
      }
      if (entry.state === 'removed') {
        removed = true
        state = 'removed'
        latestEvent = entry.event
        continue
      }
      if (!removed && entry.state) {
        state = entry.state
        latestEvent = entry.event
      }
    }
    byTooth.set(tooth, { tooth, state, tone: visualTone(state), removed, latestEvent, history })
  }
  return { events: ordered, byTooth }
}

/** Resolve the current visual tone map used by the 2D and 3D Web viewers. */
export function dentalToneByTooth(projection: DentalProjection): Map<string, DentalVisualTone> {
  return new Map([...projection.byTooth].flatMap(([tooth, value]) => value.tone ? [[tooth, value.tone] as const] : []))
}

/** Normalize one event for callers that only need its visual tone. */
export function dentalToneFromTags(tags: readonly string[] | undefined): DentalVisualTone | undefined {
  return visualTone(resolveDentalEvent({
    id: 'dental-preview', type: 'dental_care', occurredAt: '', description: '', tags: [...(tags ?? [])],
    attachments: [], createdAt: '', updatedAt: '',
  }).state)
}
