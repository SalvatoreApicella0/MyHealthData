/**
 * Canonical snapshot domains that the Web app can also *write*.
 *
 * Field names and shapes mirror the Codable models in
 * `apps/ios/MyHealthDataiOS/MyHealthDataiOS/Models/MHDModels.swift`, and the
 * snapshot keys mirror `MHDDataSnapshot`. The editor spec below drives one
 * generic form so every domain stays consistent instead of hand-rolling eight
 * different screens.
 */

import type { LucideIcon } from 'lucide-react'
import { CalendarClock, Coffee, Dumbbell, FlaskConical, HeartPulse, Pill } from 'lucide-react'

export type CanonicalFieldType = 'text' | 'textarea' | 'text-list' | 'number' | 'datetime' | 'date' | 'boolean' | 'select'

export interface CanonicalFieldSpec {
  key: string
  it: string
  en: string
  type: CanonicalFieldType
  options?: string[]
  optionLabels?: Record<string, { it: string; en: string }>
  required?: boolean
  suffix?: string
}

export interface CanonicalDomainSpec {
  /** Snapshot key, e.g. `appointments`. */
  key: string
  /** Identifier prefix used for new records, mirroring the iOS defaults. */
  idPrefix: string
  dateField: string
  titleFields: string[]
  detailFields: string[]
  icon: LucideIcon
  tint: string
  /** Fields shown in the "add record" form, in order. */
  fields: CanonicalFieldSpec[]
}

const FLOW_OPTIONS = ['none', 'light', 'medium', 'heavy', 'spotting']
const MOOD_OPTIONS = ['low', 'neutral', 'good', 'great']
const MEAL_OPTIONS = ['breakfast', 'lunch', 'dinner', 'snack']
const DOSE_STATUS = ['taken', 'skipped', 'postponed']
const EPISODE_STATUS = ['active', 'recovered', 'monitoring']
const CHECKIN_CHANGE = ['better', 'same', 'worse']
export const VISIT_CATEGORIES = [
  'general', 'familyMedicine', 'ophthalmology', 'dermatology', 'dentistry', 'orthodontics',
  'cardiology', 'neurology', 'orthopedics', 'physiatry', 'physiotherapy', 'psychology',
  'psychiatry', 'gynecology', 'urology', 'andrology', 'endocrinology', 'gastroenterology',
  'pneumology', 'otolaryngology', 'audiology', 'allergy', 'rheumatology', 'nephrology',
  'hematology', 'oncology', 'infectiousDiseases', 'pediatrics', 'nutrition', 'bloodwork',
  'xray', 'ctScan', 'mri', 'ultrasound', 'mammography', 'gastroscopy', 'colonoscopy',
  'vaccination', 'therapy', 'surgery', 'equipmentPickup', 'other',
]
export const VISIT_CATEGORY_LABELS: Record<string, { it: string; en: string }> = {
  general: { it: 'Visita medica', en: 'Medical visit' }, familyMedicine: { it: 'Medico di base', en: 'Family doctor' },
  ophthalmology: { it: 'Oculistica', en: 'Ophthalmology' }, dermatology: { it: 'Dermatologia', en: 'Dermatology' },
  dentistry: { it: 'Dentista', en: 'Dentistry' }, orthodontics: { it: 'Ortodonzia', en: 'Orthodontics' },
  cardiology: { it: 'Cardiologia', en: 'Cardiology' }, neurology: { it: 'Neurologia', en: 'Neurology' },
  orthopedics: { it: 'Ortopedia', en: 'Orthopedics' }, physiatry: { it: 'Fisiatria', en: 'Physiatry' },
  physiotherapy: { it: 'Fisioterapia', en: 'Physiotherapy' }, psychology: { it: 'Psicologia', en: 'Psychology' },
  psychiatry: { it: 'Psichiatria', en: 'Psychiatry' }, gynecology: { it: 'Ginecologia', en: 'Gynecology' },
  urology: { it: 'Urologia', en: 'Urology' }, andrology: { it: 'Andrologia', en: 'Andrology' },
  endocrinology: { it: 'Endocrinologia', en: 'Endocrinology' }, gastroenterology: { it: 'Gastroenterologia', en: 'Gastroenterology' },
  pneumology: { it: 'Pneumologia', en: 'Pulmonology' }, otolaryngology: { it: 'Otorinolaringoiatria', en: 'ENT' },
  audiology: { it: 'Audiologia', en: 'Audiology' }, allergy: { it: 'Allergologia', en: 'Allergy' },
  rheumatology: { it: 'Reumatologia', en: 'Rheumatology' }, nephrology: { it: 'Nefrologia', en: 'Nephrology' },
  hematology: { it: 'Ematologia', en: 'Hematology' }, oncology: { it: 'Oncologia', en: 'Oncology' },
  infectiousDiseases: { it: 'Malattie infettive', en: 'Infectious diseases' }, pediatrics: { it: 'Pediatria', en: 'Pediatrics' },
  nutrition: { it: 'Nutrizione', en: 'Nutrition' }, bloodwork: { it: 'Analisi del sangue', en: 'Blood test' },
  xray: { it: 'Radiografia', en: 'X-ray' }, ctScan: { it: 'TAC', en: 'CT scan' }, mri: { it: 'Risonanza magnetica', en: 'MRI' },
  ultrasound: { it: 'Ecografia', en: 'Ultrasound' }, mammography: { it: 'Mammografia', en: 'Mammography' },
  gastroscopy: { it: 'Gastroscopia', en: 'Gastroscopy' }, colonoscopy: { it: 'Colonscopia', en: 'Colonoscopy' },
  vaccination: { it: 'Vaccinazione', en: 'Vaccination' }, therapy: { it: 'Terapia / trattamento', en: 'Therapy / treatment' },
  surgery: { it: 'Intervento chirurgico', en: 'Surgery' }, equipmentPickup: { it: 'Ritiro attrezzatura', en: 'Equipment pickup' },
  other: { it: 'Altro', en: 'Other' },
}

export const CANONICAL_DOMAIN_SPECS: Record<string, CanonicalDomainSpec> = {
  appointments: {
    key: 'appointments',
    idPrefix: 'appointment',
    dateField: 'scheduledAt',
    titleFields: ['title'],
    detailFields: ['category', 'clinician', 'status', 'reason'],
    icon: CalendarClock,
    tint: '#007AFF',
    fields: [
      { key: 'title', it: 'Titolo', en: 'Title', type: 'text', required: true },
      { key: 'scheduledAt', it: 'Quando', en: 'When', type: 'datetime', required: true },
      { key: 'category', it: 'Categoria', en: 'Category', type: 'select', options: VISIT_CATEGORIES, optionLabels: VISIT_CATEGORY_LABELS },
      { key: 'clinician', it: 'Medico o struttura', en: 'Clinician or site', type: 'text' },
      { key: 'reason', it: 'Motivo', en: 'Reason', type: 'textarea' },
      { key: 'preparationNotes', it: 'Note / preparazione', en: 'Notes / preparation', type: 'textarea' },
      { key: 'outcome', it: 'Esito', en: 'Outcome', type: 'textarea' },
      { key: 'status', it: 'Stato', en: 'Status', type: 'select', options: ['planned', 'awaitingReport', 'completed', 'cancelled'], optionLabels: {
        planned: { it: 'Programmato', en: 'Planned' }, awaitingReport: { it: 'Referto da ritirare', en: 'Report to collect' },
        completed: { it: 'Fatto', en: 'Completed' }, cancelled: { it: 'Annullato', en: 'Cancelled' },
      } },
      { key: 'recurrenceNote', it: 'Ricorrenza', en: 'Recurrence', type: 'text' },
      { key: 'reportCollectionAt', it: 'Ritiro referto', en: 'Report collection', type: 'date' },
      { key: 'questions', it: 'Domande (una per riga)', en: 'Questions (one per line)', type: 'text-list' },
      { key: 'followUpAt', it: 'Controllo successivo', en: 'Follow-up', type: 'datetime' },
      { key: 'reminderMinutesBefore', it: 'Promemoria (minuti prima)', en: 'Reminder (minutes before)', type: 'number' },
      { key: 'linkedDocumentId', it: 'Documento collegato', en: 'Linked document', type: 'text' },
    ],
  },
  cycleEntries: {
    key: 'cycleEntries',
    idPrefix: 'cycle',
    dateField: 'date',
    titleFields: ['flow'],
    detailFields: ['flow', 'mood', 'symptoms', 'note'],
    icon: HeartPulse,
    tint: '#FF2D55',
    fields: [
      { key: 'date', it: 'Data', en: 'Date', type: 'date', required: true },
      { key: 'flow', it: 'Flusso', en: 'Flow', type: 'select', options: FLOW_OPTIONS },
      { key: 'isPeriodDay', it: 'Giorno di ciclo', en: 'Period day', type: 'boolean' },
      { key: 'mood', it: 'Umore', en: 'Mood', type: 'select', options: MOOD_OPTIONS },
      { key: 'energyLevel', it: 'Energia (1-5)', en: 'Energy (1-5)', type: 'number' },
      { key: 'basalTemperatureC', it: 'Temperatura basale', en: 'Basal temperature', type: 'number', suffix: '°C' },
      { key: 'symptoms', it: 'Sintomi', en: 'Symptoms', type: 'textarea' },
      { key: 'note', it: 'Nota', en: 'Note', type: 'textarea' },
    ],
  },
  sleepSessions: {
    key: 'sleepSessions',
    idPrefix: 'sleep',
    dateField: 'startAt',
    titleFields: ['quality'],
    detailFields: ['startAt', 'endAt', 'quality', 'awakenings', 'note'],
    icon: HeartPulse,
    tint: '#5856D6',
    fields: [
      { key: 'startAt', it: 'Inizio', en: 'Start', type: 'datetime', required: true },
      { key: 'endAt', it: 'Fine', en: 'End', type: 'datetime', required: true },
      { key: 'quality', it: 'Qualità (1-5)', en: 'Quality (1-5)', type: 'number' },
      { key: 'awakenings', it: 'Risvegli', en: 'Awakenings', type: 'number' },
      { key: 'note', it: 'Nota', en: 'Note', type: 'textarea' },
    ],
  },
  foodLogEntries: {
    key: 'foodLogEntries',
    idPrefix: 'food',
    dateField: 'loggedAt',
    titleFields: ['name'],
    detailFields: ['meal', 'quantity', 'servingUnit', 'calories'],
    icon: Coffee,
    tint: '#34C759',
    fields: [
      { key: 'name', it: 'Alimento', en: 'Food', type: 'text', required: true },
      { key: 'loggedAt', it: 'Quando', en: 'When', type: 'datetime', required: true },
      { key: 'meal', it: 'Pasto', en: 'Meal', type: 'select', options: MEAL_OPTIONS },
      { key: 'quantity', it: 'Quantità', en: 'Quantity', type: 'number' },
      { key: 'servingUnit', it: 'Unità', en: 'Unit', type: 'text' },
      { key: 'calories', it: 'Calorie', en: 'Calories', type: 'number', suffix: 'kcal' },
      { key: 'protein', it: 'Proteine', en: 'Protein', type: 'number', suffix: 'g' },
      { key: 'carbohydrates', it: 'Carboidrati', en: 'Carbohydrates', type: 'number', suffix: 'g' },
      { key: 'fat', it: 'Grassi', en: 'Fat', type: 'number', suffix: 'g' },
    ],
  },
  gymWorkouts: {
    key: 'gymWorkouts',
    idPrefix: 'gym_workout',
    dateField: 'startedAt',
    titleFields: ['name'],
    detailFields: ['startedAt', 'endedAt', 'notes'],
    icon: Dumbbell,
    tint: '#FF9500',
    fields: [
      { key: 'name', it: 'Nome', en: 'Name', type: 'text', required: true },
      { key: 'startedAt', it: 'Inizio', en: 'Start', type: 'datetime', required: true },
      { key: 'endedAt', it: 'Fine', en: 'End', type: 'datetime' },
      { key: 'notes', it: 'Note', en: 'Notes', type: 'textarea' },
    ],
  },
  medications: {
    key: 'medications',
    idPrefix: 'medication',
    dateField: 'startDate',
    titleFields: ['name'],
    detailFields: ['dose', 'schedule', 'status', 'scheduleStyle', 'startDate'],
    icon: Pill,
    tint: '#FF9500',
    fields: [
      { key: 'name', it: 'Farmaco', en: 'Medication', type: 'text', required: true },
      { key: 'dose', it: 'Dose', en: 'Dose', type: 'text', required: true },
      { key: 'unit', it: 'Unità', en: 'Unit', type: 'text' },
      { key: 'schedule', it: 'Programma', en: 'Schedule', type: 'text', required: true },
      { key: 'status', it: 'Stato', en: 'Status', type: 'select', options: ['active', 'paused', 'stopped'] },
      { key: 'scheduleStyle', it: 'Tipo di programma', en: 'Schedule type', type: 'select', options: ['fixedTimes', 'interval', 'asNeeded'] },
      { key: 'intervalHours', it: 'Intervallo (ore)', en: 'Interval (hours)', type: 'number' },
      { key: 'startDate', it: 'Inizio', en: 'Start', type: 'date' },
      { key: 'endDate', it: 'Fine', en: 'End', type: 'date' },
      { key: 'reason', it: 'Motivo', en: 'Reason', type: 'textarea' },
      { key: 'note', it: 'Nota', en: 'Note', type: 'textarea' },
      { key: 'stockQuantity', it: 'Scorta', en: 'Stock', type: 'number' },
      { key: 'refillThreshold', it: 'Soglia scorta', en: 'Refill threshold', type: 'number' },
      { key: 'remindersEnabled', it: 'Promemoria', en: 'Reminders', type: 'boolean' },
    ],
  },
  medicationDoseEvents: {
    key: 'medicationDoseEvents',
    idPrefix: 'dose',
    dateField: 'recordedAt',
    titleFields: ['medicationId'],
    detailFields: ['status', 'recordedAt', 'note'],
    icon: Pill,
    tint: '#FF9500',
    fields: [
      { key: 'medicationId', it: 'Farmaco (id o nome)', en: 'Medication (id or name)', type: 'text', required: true },
      { key: 'recordedAt', it: 'Quando', en: 'When', type: 'datetime', required: true },
      { key: 'status', it: 'Esito', en: 'Status', type: 'select', options: DOSE_STATUS },
      { key: 'note', it: 'Nota', en: 'Note', type: 'textarea' },
    ],
  },
  // Storage/sync compatibility for records created before this module was
  // retired. These domains are intentionally absent from active UI catalogs.
  conditionEpisodes: {
    key: 'conditionEpisodes',
    idPrefix: 'episode',
    dateField: 'startedAt',
    titleFields: ['title'],
    detailFields: ['status', 'summary'],
    icon: HeartPulse,
    tint: '#AF52DE',
    fields: [
      { key: 'title', it: 'Titolo', en: 'Title', type: 'text', required: true },
      { key: 'startedAt', it: 'Inizio', en: 'Start', type: 'datetime', required: true },
      { key: 'status', it: 'Stato', en: 'Status', type: 'select', options: EPISODE_STATUS },
      { key: 'summary', it: 'Riassunto', en: 'Summary', type: 'textarea' },
    ],
  },
  conditionCheckIns: {
    key: 'conditionCheckIns',
    idPrefix: 'checkin',
    dateField: 'recordedAt',
    titleFields: ['note'],
    detailFields: ['severity', 'change', 'impact', 'note'],
    icon: HeartPulse,
    tint: '#AF52DE',
    fields: [
      { key: 'episodeId', it: 'Episodio', en: 'Episode', type: 'text', required: true },
      { key: 'recordedAt', it: 'Quando', en: 'When', type: 'datetime', required: true },
      { key: 'severity', it: 'Intensità (0-10)', en: 'Severity (0-10)', type: 'number', required: true },
      { key: 'change', it: 'Variazione', en: 'Change', type: 'select', options: CHECKIN_CHANGE },
      { key: 'impact', it: 'Impatto (0-10)', en: 'Impact (0-10)', type: 'number' },
      { key: 'note', it: 'Nota', en: 'Note', type: 'textarea' },
    ],
  },
  labResults: {
    key: 'labResults',
    idPrefix: 'lab',
    dateField: 'collectedAt',
    titleFields: ['analyte'],
    detailFields: ['panelName', 'value', 'unit', 'referenceRange', 'laboratoryFlag'],
    icon: FlaskConical,
    tint: '#FF3B30',
    fields: [
      { key: 'analyte', it: 'Esame', en: 'Analyte', type: 'text', required: true },
      { key: 'panelName', it: 'Pannello', en: 'Panel', type: 'text' },
      { key: 'value', it: 'Valore', en: 'Value', type: 'number', required: true },
      { key: 'unit', it: 'Unità', en: 'Unit', type: 'text' },
      { key: 'referenceRange', it: 'Intervallo di riferimento', en: 'Reference range', type: 'text' },
      { key: 'collectedAt', it: 'Data prelievo', en: 'Collected at', type: 'datetime', required: true },
      { key: 'referenceLow', it: 'Limite inferiore', en: 'Lower reference limit', type: 'number' },
      { key: 'referenceHigh', it: 'Limite superiore', en: 'Upper reference limit', type: 'number' },
      { key: 'comparator', it: 'Comparatore', en: 'Comparator', type: 'text' },
      { key: 'laboratoryFlag', it: 'Flag di laboratorio', en: 'Laboratory flag', type: 'text' },
      { key: 'linkedDocumentId', it: 'Documento collegato', en: 'Linked document', type: 'text' },
      { key: 'note', it: 'Nota', en: 'Note', type: 'textarea' },
    ],
  },
}

export function domainSpec(key: string): CanonicalDomainSpec | undefined {
  return CANONICAL_DOMAIN_SPECS[key]
}
