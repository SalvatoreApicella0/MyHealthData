import { snapshotRecords } from '../../core/healthModules'

export type Loc = 'it' | 'en'
export type Level = 'ok' | 'warn' | 'bad' | 'none'
export type Trend = 'up' | 'down' | 'flat'

export interface AnalyteSpec {
  id: string
  it: string
  en: string
  unit: string
  low?: number
  high?: number
  aliases?: string[]
}

export interface LabRecord {
  id: string
  storedId?: string
  analyte: string
  value?: number
  comparator?: string
  unit: string
  low?: number
  high?: number
  referenceRange?: string
  laboratoryFlag?: string
  spec?: AnalyteSpec
  at: number
  day: string
  readOnly?: boolean
}

export interface LabDay {
  key: string
  at: number
  date?: Date
  rows: LabRecord[]
}

export const CURATED: AnalyteSpec[] = [
  { id: 'hemoglobin', it: 'Emoglobina', en: 'Hemoglobin', unit: 'g/dL', low: 12, high: 17, aliases: ['hb', 'hgb'] },
  { id: 'rbc', it: 'Globuli rossi', en: 'Red blood cells', unit: '10^6/µL', low: 4, high: 5.5, aliases: ['rbc', 'eritrociti'] },
  { id: 'wbc', it: 'Globuli bianchi', en: 'White blood cells', unit: '10^3/µL', low: 4, high: 10, aliases: ['wbc', 'leucociti'] },
  { id: 'platelets', it: 'Piastrine', en: 'Platelets', unit: '10^3/µL', low: 150, high: 400, aliases: ['plt', 'trombociti'] },
  { id: 'hematocrit', it: 'Ematocrito', en: 'Hematocrit', unit: '%', low: 38, high: 52, aliases: ['hct'] },
  { id: 'mcv', it: 'MCV', en: 'MCV', unit: 'fL', low: 80, high: 100 },
  { id: 'mch', it: 'MCH', en: 'MCH', unit: 'pg', low: 27, high: 33 },
  { id: 'ferritin', it: 'Ferritina', en: 'Ferritin', unit: 'ng/mL', low: 20, high: 300 },
  { id: 'serum-iron', it: 'Sideremia', en: 'Serum iron', unit: 'µg/dL', low: 60, high: 170, aliases: ['ferro', 'sideremia'] },
  { id: 'transferrin', it: 'Transferrina', en: 'Transferrin', unit: 'mg/dL', low: 200, high: 360 },
  { id: 'crp', it: 'PCR', en: 'CRP', unit: 'mg/dL', low: 0, high: 0.5, aliases: ['proteina c reattiva', 'crp'] },
  { id: 'esr', it: 'VES', en: 'ESR', unit: 'mm/h', low: 0, high: 20, aliases: ['velocita di eritrosedimentazione', 'esr'] },
  { id: 'glucose', it: 'Glicemia', en: 'Glucose', unit: 'mg/dL', low: 70, high: 100, aliases: ['glucosio', 'glucose'] },
  { id: 'hba1c', it: 'HbA1c', en: 'HbA1c', unit: '%', low: 4, high: 5.6, aliases: ['emoglobina glicata', 'emoglobina glicosilata', 'a1c'] },
  { id: 'total-cholesterol', it: 'Colesterolo totale', en: 'Total cholesterol', unit: 'mg/dL', low: 0, high: 200, aliases: ['colesterolo', 'cholesterol'] },
  { id: 'hdl', it: 'HDL', en: 'HDL', unit: 'mg/dL', low: 40, aliases: ['colesterolo hdl', 'hdl colesterolo'] },
  { id: 'ldl', it: 'LDL', en: 'LDL', unit: 'mg/dL', low: 0, high: 115, aliases: ['colesterolo ldl', 'ldl colesterolo'] },
  { id: 'triglycerides', it: 'Trigliceridi', en: 'Triglycerides', unit: 'mg/dL', low: 0, high: 150 },
  { id: 'creatinine', it: 'Creatinina', en: 'Creatinine', unit: 'mg/dL', low: 0.7, high: 1.2 },
  { id: 'egfr', it: 'eGFR', en: 'eGFR', unit: 'mL/min/1.73m²', low: 90, aliases: ['vfg', 'filtrato glomerulare'] },
  { id: 'urea', it: 'Urea', en: 'Urea', unit: 'mg/dL', low: 10, high: 50 },
  { id: 'ast', it: 'AST/GOT', en: 'AST/GOT', unit: 'U/L', low: 5, high: 40, aliases: ['ast', 'got', 'sgot', 'tgo', 'aspartato aminotransferasi'] },
  { id: 'alt', it: 'ALT/GPT', en: 'ALT/GPT', unit: 'U/L', low: 5, high: 40, aliases: ['alt', 'gpt', 'sgpt', 'tgp', 'alanina aminotransferasi'] },
  { id: 'ggt', it: 'GGT', en: 'GGT', unit: 'U/L', low: 5, high: 55, aliases: ['gamma gt', 'ggtp'] },
  { id: 'bilirubin', it: 'Bilirubina', en: 'Bilirubin', unit: 'mg/dL', low: 0.2, high: 1.2, aliases: ['bilirubina totale'] },
  { id: 'alp', it: 'Fosfatasi alcalina', en: 'Alkaline phosphatase', unit: 'U/L', low: 40, high: 130, aliases: ['alp'] },
  { id: 'sodium', it: 'Sodio', en: 'Sodium', unit: 'mmol/L', low: 135, high: 145, aliases: ['sodium'] },
  { id: 'potassium', it: 'Potassio', en: 'Potassium', unit: 'mmol/L', low: 3.5, high: 5.1, aliases: ['potassium'] },
  { id: 'calcium', it: 'Calcio', en: 'Calcium', unit: 'mg/dL', low: 8.5, high: 10.5, aliases: ['calcium'] },
  { id: 'magnesium', it: 'Magnesio', en: 'Magnesium', unit: 'mg/dL', low: 1.7, high: 2.2, aliases: ['magnesium'] },
  { id: 'tsh', it: 'TSH', en: 'TSH', unit: 'µUI/mL', low: 0.4, high: 4 },
  { id: 'ft3', it: 'FT3', en: 'FT3', unit: 'pg/mL', low: 2.3, high: 4.2 },
  { id: 'ft4', it: 'FT4', en: 'FT4', unit: 'ng/dL', low: 0.8, high: 1.8 },
  { id: 'vitamin-d', it: 'Vitamina D', en: 'Vitamin D', unit: 'ng/mL', low: 30, high: 100, aliases: ['25-oh vitamina d'] },
  { id: 'vitamin-b12', it: 'Vitamina B12', en: 'Vitamin B12', unit: 'pg/mL', low: 200, high: 900, aliases: ['cobalamina', 'b12'] },
  { id: 'folate', it: 'Folati', en: 'Folate', unit: 'ng/mL', low: 3, high: 17, aliases: ['folato', 'acido folico'] },
  { id: 'uric-acid', it: 'Acido urico', en: 'Uric acid', unit: 'mg/dL', low: 3.5, high: 7.2, aliases: ['urato', 'uric acid'] },
  { id: 'albumin', it: 'Albumina', en: 'Albumin', unit: 'g/dL', low: 3.5, high: 5.2 },
  { id: 'total-protein', it: 'Proteine totali', en: 'Total protein', unit: 'g/dL', low: 6.4, high: 8.3, aliases: ['proteine', 'proteinemia'] },
  { id: 'ldh', it: 'LDH', en: 'LDH', unit: 'U/L', low: 120, high: 246, aliases: ['lattato deidrogenasi'] },
  { id: 'cpk', it: 'CPK', en: 'CPK', unit: 'U/L', low: 30, high: 200, aliases: ['creatinfosfochinasi', 'creatin fosfochinasi', 'ck'] },
  { id: 'amylase', it: 'Amilasi', en: 'Amylase', unit: 'U/L', low: 25, high: 125 },
  { id: 'lipase', it: 'Lipasi', en: 'Lipase', unit: 'U/L', low: 10, high: 140 },
  { id: 'inr', it: 'INR', en: 'INR', unit: '', low: 0.8, high: 1.2 },
  { id: 'd-dimer', it: 'D-dimero', en: 'D-dimer', unit: 'ng/mL', low: 0, high: 500, aliases: ['d dimero'] },
  { id: 'psa', it: 'PSA', en: 'PSA', unit: 'ng/mL', low: 0, high: 4, aliases: ['antigene prostatico specifico'] },
  { id: 'testosterone', it: 'Testosterone', en: 'Testosterone', unit: 'ng/mL', low: 3, high: 10, aliases: ['testosterone totale'] },
  { id: 'estradiol', it: 'Estradiol', en: 'Estradiol', unit: 'pg/mL', low: 20, high: 350, aliases: ['estradiolo', 'e2'] },
  { id: 'cortisol', it: 'Cortisolo', en: 'Cortisol', unit: 'µg/dL', low: 5, high: 25 },
  { id: 'insulin', it: 'Insulina', en: 'Insulin', unit: 'µUI/mL', low: 2, high: 25 },
  { id: 'homocysteine', it: 'Omocisteina', en: 'Homocysteine', unit: 'µmol/L', low: 5, high: 15 },
]

export const SPEC_ORDER = new Map(CURATED.map((spec, index) => [spec.id, index]))

export function locale(language: string): Loc {
  return language === 'en' ? 'en' : 'it'
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function specNames(spec: AnalyteSpec): string[] {
  return [spec.it, spec.en, ...(spec.aliases ?? [])]
}

function matchSpec(analyte: string): AnalyteSpec | undefined {
  const key = normalizeName(analyte)
  if (!key) return undefined
  let best: AnalyteSpec | undefined
  let bestScore = 0
  for (const spec of CURATED) {
    for (const candidate of specNames(spec)) {
      const name = normalizeName(candidate)
      if (!name) continue
      let score = 0
      if (name === key) score = 10000 + name.length
      else if (name.length >= 4 && key.includes(name)) score = 1000 + name.length
      else if (key.length >= 4 && name.includes(key)) score = 100 + key.length
      if (score > bestScore) {
        bestScore = score
        best = spec
      }
    }
  }
  return best
}

function numberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function recordDate(record: Record<string, unknown>): Date | undefined {
  for (const key of ['collectedAt', 'date', 'recordedAt', 'createdAt']) {
    const date = parseDate(record[key])
    if (date) return date
  }
  return undefined
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function toRecord(record: Record<string, unknown>, index: number): LabRecord {
  const analyte = stringField(record, 'analyte') ?? '—'
  const date = recordDate(record)
  const storedId = typeof record.id === 'string' && record.id !== '' ? record.id : undefined
  return {
    id: storedId ?? `lab-missing-${index}`,
    storedId,
    analyte,
    value: numberField(record, 'value'),
    comparator: stringField(record, 'comparator'),
    unit: stringField(record, 'unit') ?? '',
    low: numberField(record, 'referenceLow'),
    high: numberField(record, 'referenceHigh'),
    referenceRange: stringField(record, 'referenceRange'),
    laboratoryFlag: stringField(record, 'laboratoryFlag'),
    spec: matchSpec(analyte),
    at: date?.getTime() ?? 0,
    day: date ? dayKey(date) : 'unknown',
  }
}

export function glucoseMeasurements(snapshot: Record<string, unknown>, language: Loc): LabRecord[] {
  return snapshotRecords(snapshot, 'measurements')
    .filter((record) => record.type === 'blood_glucose')
    .map((record, index) => {
      const value = numberField(record, 'value')
      const measuredAt = stringField(record, 'measuredAt')
      const id = stringField(record, 'id') ?? `unknown-${index}`
      return {
        id: `measurement-glucose-${id}`,
        analyte: language === 'it' ? 'Glicemia' : 'Glucose',
        value,
        unit: stringField(record, 'unit') ?? 'mg/dL',
        low: 70,
        high: 100,
        spec: CURATED.find((spec) => spec.id === 'glucose'),
        at: measuredAt ? new Date(measuredAt).getTime() : 0,
        day: measuredAt ? dayKey(new Date(measuredAt)) : 'unknown',
        readOnly: true,
      }
    })
    .filter((record) => Number.isFinite(record.at))
}

export function levelFor(value: number, low?: number, high?: number): Level {
  if (low === undefined && high === undefined) return 'none'
  const above = high !== undefined && value > high
  const below = low !== undefined && value < low
  if (!above && !below) return 'ok'
  if (above && high !== undefined) return value <= high * 1.2 ? 'warn' : 'bad'
  if (below && low !== undefined) return low > 0 && value >= low * 0.8 ? 'warn' : 'bad'
  return 'none'
}

export function formatNumber(value: number, lang: Loc): string {
  return new Intl.NumberFormat(lang === 'it' ? 'it-IT' : 'en-US', { maximumFractionDigits: 3 }).format(value)
}

export function formatDay(value: Date, lang: Loc): string {
  return new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: 'long', year: 'numeric' }).format(value)
}

export function todayKey(): string {
  return dayKey(new Date())
}

export function specRangeText(spec: AnalyteSpec, lang: Loc): string {
  if (spec.low !== undefined && spec.high !== undefined) return `${formatNumber(spec.low, lang)}–${formatNumber(spec.high, lang)}`
  if (spec.low !== undefined) return `≥ ${formatNumber(spec.low, lang)}`
  if (spec.high !== undefined) return `≤ ${formatNumber(spec.high, lang)}`
  return ''
}

export function specRangeValue(spec: AnalyteSpec): string {
  if (spec.low !== undefined && spec.high !== undefined) return `${spec.low}-${spec.high}`
  if (spec.low !== undefined) return `>=${spec.low}`
  if (spec.high !== undefined) return `<=${spec.high}`
  return ''
}

export function recordRangeText(record: LabRecord, lang: Loc): string {
  if (record.referenceRange) return record.referenceRange
  if (record.low !== undefined && record.high !== undefined) return `${formatNumber(record.low, lang)}–${formatNumber(record.high, lang)}`
  if (record.low !== undefined) return `≥ ${formatNumber(record.low, lang)}`
  if (record.high !== undefined) return `≤ ${formatNumber(record.high, lang)}`
  return ''
}

export const MAX_VISIBLE_ROWS = 5
