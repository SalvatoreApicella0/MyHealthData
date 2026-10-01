import type { CyclePhase, CycleSettings } from './cycleModel'

export interface CycleCopy {
  empty: string
  noStart: string
  cycleDayCap: string
  nextCycleIn: (days: number) => string
  nextCycleToday: string
  nextCycleLate: (days: number) => string
  estimateNote: string
  fertileToday: string
  fertileWindow: (start: string, end: string) => string
  phaseName: Record<CyclePhase, string>
  phaseNote: Record<CyclePhase, string>
  avgCycle: string
  periodAvg: string
  lastCycle: string
  regularity: string
  variation: string
  days: string
  regular: string
  variable: string
  unknown: string
  currentCycle: string
  recentCycle: string
  historyTitle: string
  stripLabel: string
  legendPeriod: string
  legendFertile: string
  legendLogged: string
  settingsButton: string
  markStart: string
  markFlow: string
  settingsTitle: string
  markStartTitle: string
  markFlowTitle: string
  unit: string
  settingsLine: (cycle: string, period: string, method: string) => string
  typicalCycle: string
  typicalPeriod: string
  method: string
  fertileWindowToggle: string
  configured: string
  save: string
  cancel: string
  role: string
  roleStart: string
  roleEnd: string
  roleDay: string
  flow: string
  mood: string
  symptoms: string
  markNote: string
  selectedDay: string
}

export const COPY: Record<'it' | 'en', CycleCopy> = {
  it: {
    empty: 'Nessun dato del ciclo. Segna un inizio per vedere le stime.',
    noStart: 'Aggiungi un inizio ciclo per calcolare le stime.',
    cycleDayCap: 'Giorno',
    nextCycleIn: (days) => `Prossimo ciclo stimato fra ${days} ${days === 1 ? 'giorno' : 'giorni'}`,
    nextCycleToday: 'Prossimo ciclo stimato oggi',
    nextCycleLate: (days) => `Prossimo ciclo stimato in ritardo di ${days} ${days === 1 ? 'giorno' : 'giorni'}`,
    estimateNote: 'Stima indicativa basata sui tuoi dati.',
    fertileToday: 'Oggi fertile',
    fertileWindow: (start, end) => `Finestra fertile: ${start}–${end}`,
    phaseName: {
      menstrual: 'Mestruazioni',
      follicular: 'Follicolare',
      fertile: 'Finestra fertile',
      luteal: 'Luteale',
    },
    phaseNote: {
      menstrual: 'Giorni di flusso: il ciclo è iniziato da poco.',
      follicular: 'Il corpo si prepara e l’energia tende a salire.',
      fertile: 'Finestra fertile stimata a partire dai tuoi dati.',
      luteal: 'Fase dopo l’ovulazione stimata, verso il prossimo ciclo.',
    },
    avgCycle: 'Media ciclo',
    periodAvg: 'Mestruazioni (media)',
    lastCycle: 'Ultimo ciclo',
    regularity: 'Regolarità',
    variation: 'Variazione',
    days: 'g',
    regular: 'Regolare',
    variable: 'Variabile',
    unknown: '—',
    currentCycle: 'Ciclo attuale',
    recentCycle: 'Ultimo ciclo',
    historyTitle: 'Ultimi cicli',
    stripLabel: 'Ultimi 35 giorni',
    legendPeriod: 'Ciclo',
    legendFertile: 'Fertile',
    legendLogged: 'Registrato',
    settingsButton: 'Impostazioni',
    markStart: 'Segna inizio',
    markFlow: 'Segna flusso',
    settingsTitle: 'Impostazioni del ciclo',
    markStartTitle: 'Segna inizio',
    markFlowTitle: 'Segna flusso',
    unit: '—',
    settingsLine: (cycle, period, method) => `Ciclo ${cycle} g · Mestruazioni ${period} g · ${method}`,
    typicalCycle: 'Durata tipica del ciclo',
    typicalPeriod: 'Durata tipica delle mestruazioni',
    method: 'Metodo di previsione',
    fertileWindowToggle: 'Mostra finestra fertile',
    configured: 'Configurato',
    save: 'Salva',
    cancel: 'Annulla',
    role: 'Tipo',
    roleStart: 'Inizio',
    roleEnd: 'Fine',
    roleDay: 'Giorno',
    flow: 'Flusso',
    mood: 'Umore',
    symptoms: 'Sintomi',
    markNote: 'Nota',
    selectedDay: 'Giorno selezionato',
  },
  en: {
    empty: 'No cycle data. Mark a start to see estimates.',
    noStart: 'Add a period start to compute estimates.',
    cycleDayCap: 'Day',
    nextCycleIn: (days) => `Next cycle estimated in ${days} ${days === 1 ? 'day' : 'days'}`,
    nextCycleToday: 'Next cycle estimated today',
    nextCycleLate: (days) => `Next cycle estimated ${days} ${days === 1 ? 'day' : 'days'} late`,
    estimateNote: 'Indicative estimate based on your data.',
    fertileToday: 'Fertile today',
    fertileWindow: (start, end) => `Fertile window: ${start}–${end}`,
    phaseName: {
      menstrual: 'Menstrual',
      follicular: 'Follicular',
      fertile: 'Fertile window',
      luteal: 'Luteal',
    },
    phaseNote: {
      menstrual: 'Flow days: the cycle just started.',
      follicular: 'The body prepares and energy tends to rise.',
      fertile: 'Fertile window estimated from your data.',
      luteal: 'After the estimated ovulation, heading to the next cycle.',
    },
    avgCycle: 'Average cycle',
    periodAvg: 'Period (average)',
    lastCycle: 'Last cycle',
    regularity: 'Regularity',
    variation: 'Variation',
    days: 'd',
    regular: 'Regular',
    variable: 'Variable',
    unknown: '—',
    currentCycle: 'Current cycle',
    recentCycle: 'Last cycle',
    historyTitle: 'Recent cycles',
    stripLabel: 'Last 35 days',
    legendPeriod: 'Period',
    legendFertile: 'Fertile',
    legendLogged: 'Logged',
    settingsButton: 'Settings',
    markStart: 'Mark start',
    markFlow: 'Mark flow',
    settingsTitle: 'Cycle settings',
    markStartTitle: 'Mark start',
    markFlowTitle: 'Mark flow',
    unit: '—',
    settingsLine: (cycle, period, method) => `Cycle ${cycle} d · Period ${period} d · ${method}`,
    typicalCycle: 'Typical cycle length',
    typicalPeriod: 'Typical period length',
    method: 'Prediction method',
    fertileWindowToggle: 'Show fertile window',
    configured: 'Configured',
    save: 'Save',
    cancel: 'Cancel',
    role: 'Type',
    roleStart: 'Start',
    roleEnd: 'End',
    roleDay: 'Day',
    flow: 'Flow',
    mood: 'Mood',
    symptoms: 'Symptoms',
    markNote: 'Note',
    selectedDay: 'Selected day',
  },
}

export const FLOW_LABELS: Record<string, { it: string; en: string }> = {
  none: { it: 'Nessuno', en: 'None' },
  spotting: { it: 'Spotting', en: 'Spotting' },
  light: { it: 'Leggero', en: 'Light' },
  medium: { it: 'Medio', en: 'Medium' },
  heavy: { it: 'Abbondante', en: 'Heavy' },
}

export const MOOD_LABELS: Record<string, { it: string; en: string }> = {
  low: { it: 'Basso', en: 'Low' },
  sensitive: { it: 'Sensibile', en: 'Sensitive' },
  calm: { it: 'Calmo', en: 'Calm' },
  good: { it: 'Buono', en: 'Good' },
  energetic: { it: 'Energico', en: 'Energetic' },
  neutral: { it: 'Neutro', en: 'Neutral' },
  great: { it: 'Ottimo', en: 'Great' },
}

export const METHOD_LABELS: Record<string, { it: string; en: string }> = {
  calendar: { it: 'Calendario', en: 'Calendar' },
  temperature: { it: 'Temperatura basale', en: 'Basal temperature' },
  basalTemperature: { it: 'Temperatura basale', en: 'Basal temperature' },
  ovulation: { it: 'Test ovulazione', en: 'Ovulation test' },
  ovulationTest: { it: 'Test ovulazione', en: 'Ovulation test' },
  none: { it: 'Nessuno', en: 'None' },
}

export const METHOD_OPTIONS = ['calendar', 'temperature', 'ovulation', 'none'] as const
export const FLOW_OPTIONS = ['spotting', 'light', 'medium', 'heavy'] as const
export const MOOD_OPTIONS = ['low', 'sensitive', 'calm', 'good', 'energetic', 'neutral', 'great'] as const

export type CycleRole = 'start' | 'end' | 'day'

export function validateCycleSettings(cycleLength: string, periodLength: string): 'cycle' | 'period' | undefined {
  const cycle = Number(cycleLength.replace(',', '.'))
  const period = Number(periodLength.replace(',', '.'))
  if (!Number.isInteger(cycle) || cycle < 3 || cycle > 60) return 'cycle'
  if (!Number.isInteger(period) || period < 1 || period > 15 || period > cycle) return 'period'
  return undefined
}

export type { CycleSettings }
