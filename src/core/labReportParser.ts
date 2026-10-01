export interface ParsedLabCandidate {
  analyte: string
  value: number
  unit: string
  referenceRange?: string
  referenceLow?: number
  referenceHigh?: number
  laboratoryFlag?: string
  selected: boolean
}

interface AnalyteRule {
  name: string
  aliases: string[]
  unit: string
}

const RULES: AnalyteRule[] = [
  { name: 'Emoglobina', aliases: ['emoglobina', 'hemoglobin', 'hgb', 'hb'], unit: 'g/dL' },
  { name: 'Globuli bianchi', aliases: ['globuli bianchi', 'leucociti', 'wbc'], unit: '10^3/µL' },
  { name: 'Piastrine', aliases: ['piastrine', 'platelets', 'plt'], unit: '10^3/µL' },
  { name: 'Ematocrito', aliases: ['ematocrito', 'hematocrit', 'hct'], unit: '%' },
  { name: 'Glicemia', aliases: ['glicemia', 'glucosio', 'glucose'], unit: 'mg/dL' },
  { name: 'Creatinina', aliases: ['creatinina', 'creatinine'], unit: 'mg/dL' },
  { name: 'Colesterolo totale', aliases: ['colesterolo totale', 'total cholesterol'], unit: 'mg/dL' },
  { name: 'HDL', aliases: ['hdl'], unit: 'mg/dL' },
  { name: 'LDL', aliases: ['ldl'], unit: 'mg/dL' },
  { name: 'Trigliceridi', aliases: ['trigliceridi', 'triglycerides'], unit: 'mg/dL' },
  { name: 'PCR', aliases: ['proteina c reattiva', 'crp', 'pcr'], unit: 'mg/dL' },
  { name: 'TSH', aliases: ['tsh'], unit: 'µUI/mL' },
  { name: 'Vitamina D', aliases: ['vitamina d', 'vitamin d', '25-oh vitamina d'], unit: 'ng/mL' },
  { name: 'Ferritina', aliases: ['ferritina', 'ferritin'], unit: 'ng/mL' },
  { name: 'AST/GOT', aliases: ['ast', 'got', 'sgot'], unit: 'U/L' },
  { name: 'ALT/GPT', aliases: ['alt', 'gpt', 'sgpt'], unit: 'U/L' },
]

function numberFrom(value: string): number | undefined {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalized(value: string): string {
  return value.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Conservative, review-first parser for one value per report line. */
export function parseLabReportText(text: string): ParsedLabCandidate[] {
  const candidates: ParsedLabCandidate[] = []
  const seen = new Set<string>()
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const lower = normalized(line)
    for (const rule of RULES) {
      const alias = rule.aliases.find((entry) => lower.includes(normalized(entry)))
      if (!alias || seen.has(rule.name)) continue
      const aliasIndex = lower.indexOf(normalized(alias))
      const afterAlias = line.slice(aliasIndex + alias.length)
      const valueMatch = afterAlias.match(/(?:[:=]|\s)\s*(-?\d+(?:[.,]\d+)?)/)
      if (!valueMatch) continue
      const rawValue = valueMatch[1]
      if (!rawValue) continue
      const value = numberFrom(rawValue)
      if (value === undefined) continue
      const rest = afterAlias.slice((valueMatch.index ?? 0) + valueMatch[0].length)
      const rangeMatch = rest.match(/(?:\(|\[)?\s*(-?\d+(?:[.,]\d+)?)\s*[-–]\s*(-?\d+(?:[.,]\d+)?)/)
      const flag = /\b(alto|high|h)\b/i.test(line) ? 'high' : /\b(basso|low|l)\b/i.test(line) ? 'low' : undefined
      const rawLow = rangeMatch?.[1]
      const rawHigh = rangeMatch?.[2]
      candidates.push({
        analyte: rule.name,
        value,
        unit: rule.unit,
        referenceRange: rangeMatch ? `${rangeMatch[1]}–${rangeMatch[2]}` : undefined,
        referenceLow: rawLow ? numberFrom(rawLow) : undefined,
        referenceHigh: rawHigh ? numberFrom(rawHigh) : undefined,
        laboratoryFlag: flag,
        selected: true,
      })
      seen.add(rule.name)
    }
  }
  return candidates
}
