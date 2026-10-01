import type { BodyRegionId, EventType, HealthEvent } from '../../core/types'
import type { HealthAttachmentInput } from '../../storage/useHealthData'

export const RECENT_WINDOW_MS = 30 * 86_400_000
export const BODY_PAIN_EVENT_TYPES = [
  'pain',
  'discomfort',
  'burning',
  'swelling',
  'stiffness',
  'tingling',
  'wound',
] as const satisfies readonly EventType[]
export const PAIN_TYPES: readonly EventType[] = BODY_PAIN_EVENT_TYPES
export const FLOW_TYPES = BODY_PAIN_EVENT_TYPES
export type BodyPainEventType = typeof BODY_PAIN_EVENT_TYPES[number]

export type Loc = 'it' | 'en'
export type BodyPainStep = 0 | 1 | 2

export interface Draft {
  type: BodyPainEventType
  intensity: number
  description: string
  trigger: string
  occurredAt: string
  regionId?: BodyRegionId
  point?: HealthEvent['bodyPoint']
  attachments: HealthAttachmentInput[]
}

export interface Copy {
  recentLabel: (count: number) => string
  last: (date: string) => string
  noEvents: string
  addButton: string
  empty: string
  noDescription: string
  noRegion: string
  noPosition: string
  detailTitle: string
  fieldType: string
  fieldDate: string
  fieldRegion: string
  fieldIntensity: string
  fieldDuration: string
  fieldDescription: string
  fieldTrigger: string
  fieldHelpedBy: string
  fieldTags: string
  fieldAttachments: string
  fieldRecordedAt: string
  minutes: (value: number) => string
  attachments: (count: number) => string
  flowTitle: string
  steps: [string, string, string]
  stepsLabel: string
  tapHint: string
  pickFromList: string
  clearRegion: string
  precisePoint: string
  regionRequired: string
  intensityLow: string
  intensityHigh: string
  description: string
  descriptionPlaceholder: string
  descriptionRequired: string
  trigger: string
  triggerPlaceholder: string
  next: string
  back: string
  confirm: string
  recapTitle: string
  deleteConfirm: string
  recordedNow: string
}

export const COPY: Record<Loc, Copy> = {
  it: {
    recentLabel: (count) => (count === 1 ? 'evento negli ultimi 30 giorni' : 'eventi negli ultimi 30 giorni'),
    last: (date) => `Ultimo: ${date}`,
    noEvents: 'Nessun evento registrato.',
    addButton: 'Registra dolore',
    empty: 'Nessun dolore registrato. Usa “Registra dolore” per aggiungere il primo evento.',
    noDescription: 'Nessuna descrizione',
    noRegion: 'Zona non indicata',
    noPosition: 'Posizione non disponibile',
    detailTitle: 'Dettaglio dolore',
    fieldType: 'Tipo',
    fieldDate: 'Data',
    fieldRegion: 'Zona',
    fieldIntensity: 'Intensità',
    fieldDuration: 'Durata',
    fieldDescription: 'Descrizione',
    fieldTrigger: 'Possibile causa',
    fieldHelpedBy: 'Cosa ha aiutato',
    fieldTags: 'Tag',
    fieldAttachments: 'Allegati',
    fieldRecordedAt: 'Registrato il',
    minutes: (value) => `${value} min`,
    attachments: (count) => (count === 1 ? '1 allegato' : `${count} allegati`),
    flowTitle: 'Registra dolore',
    steps: ['Dettagli', 'Zona', 'Conferma'],
    stepsLabel: 'Passi',
    tapHint: 'Tocca il corpo nel punto del dolore',
    pickFromList: 'Oppure scegli dalla lista',
    clearRegion: 'Rimuovi zona',
    precisePoint: 'punto preciso',
    regionRequired: 'Tocca una zona del corpo per continuare',
    intensityLow: 'Lieve',
    intensityHigh: 'Forte',
    description: 'Descrizione',
    descriptionPlaceholder: 'Descrivi il dolore…',
    descriptionRequired: 'Descrivi il dolore prima di continuare.',
    trigger: 'Possibile causa',
    triggerPlaceholder: 'Es. sforzo, postura, cibo…',
    next: 'Avanti',
    back: 'Indietro',
    confirm: 'Conferma',
    recapTitle: 'Riepilogo',
    deleteConfirm: 'Eliminare questo evento?',
    recordedNow: 'Adesso',
  },
  en: {
    recentLabel: (count) => (count === 1 ? 'event in the last 30 days' : 'events in the last 30 days'),
    last: (date) => `Last: ${date}`,
    noEvents: 'No events recorded.',
    addButton: 'Log pain',
    empty: 'No pain recorded. Use “Log pain” to add the first event.',
    noDescription: 'No description',
    noRegion: 'No region',
    noPosition: 'Position not available',
    detailTitle: 'Pain detail',
    fieldType: 'Type',
    fieldDate: 'Date',
    fieldRegion: 'Region',
    fieldIntensity: 'Intensity',
    fieldDuration: 'Duration',
    fieldDescription: 'Description',
    fieldTrigger: 'Suspected trigger',
    fieldHelpedBy: 'Helped by',
    fieldTags: 'Tags',
    fieldAttachments: 'Attachments',
    fieldRecordedAt: 'Recorded at',
    minutes: (value) => `${value} min`,
    attachments: (count) => (count === 1 ? '1 attachment' : `${count} attachments`),
    flowTitle: 'Log pain',
    steps: ['Details', 'Region', 'Confirm'],
    stepsLabel: 'Steps',
    tapHint: 'Tap the body where it hurts',
    pickFromList: 'Or pick from the list',
    clearRegion: 'Clear region',
    precisePoint: 'exact point',
    regionRequired: 'Tap a body region to continue',
    intensityLow: 'Mild',
    intensityHigh: 'Strong',
    description: 'Description',
    descriptionPlaceholder: 'Describe the pain…',
    descriptionRequired: 'Describe the pain before continuing.',
    trigger: 'Suspected trigger',
    triggerPlaceholder: 'E.g. effort, posture, food…',
    next: 'Next',
    back: 'Back',
    confirm: 'Confirm',
    recapTitle: 'Summary',
    deleteConfirm: 'Delete this event?',
    recordedNow: 'Now',
  },
}

export function locale(language: string): Loc {
  return language === 'en' ? 'en' : 'it'
}

export function emptyDraft(): Draft {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return {
    type: 'pain',
    intensity: 5,
    description: '',
    trigger: '',
    occurredAt: local.toISOString().slice(0, 16),
    attachments: [],
  }
}

export function isPainEvent(event: HealthEvent): boolean {
  return PAIN_TYPES.includes(event.type)
}

export function excerpt(value: string, max = 96): string {
  const trimmed = value.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

export function intensityWord(value: number, lang: Loc): string {
  if (value <= 0) return lang === 'it' ? 'Nessuno' : 'None'
  if (value <= 3) return lang === 'it' ? 'Lieve' : 'Mild'
  if (value <= 6) return lang === 'it' ? 'Moderato' : 'Moderate'
  if (value <= 8) return lang === 'it' ? 'Forte' : 'Strong'
  return lang === 'it' ? 'Molto forte' : 'Severe'
}
