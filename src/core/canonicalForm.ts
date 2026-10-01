import type { CanonicalDomainSpec } from './canonicalDomains'

export function isValidDateInput(raw: string): boolean {
  return raw.trim() !== '' && Number.isFinite(new Date(raw).getTime())
}

export function isoFromLocalInput(raw: string): string | undefined {
  if (!isValidDateInput(raw)) return undefined
  return new Date(raw).toISOString()
}

export function validateCanonicalFields(spec: CanonicalDomainSpec, fields: Record<string, string>): string | undefined {
  const missing = spec.fields.find((field) => field.required && !(fields[field.key] ?? '').trim())
  if (missing) return missing.key
  for (const field of spec.fields) {
    const raw = fields[field.key] ?? ''
    if (!raw.trim()) continue
    if (field.type === 'number' && !Number.isFinite(Number(raw.replace(',', '.')))) return field.key
    if ((field.type === 'date' || field.type === 'datetime') && !isValidDateInput(raw)) return field.key
  }
  return undefined
}
