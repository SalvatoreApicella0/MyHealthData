import type { HealthEvent } from '../../core/types'

export type VisionLocale = 'it' | 'en'

export const VISION_KINDS = ['Occhiali', 'Lenti a contatto', 'Lettura', 'Progressive']

function text(language: VisionLocale, italian: string, english: string): string {
  return language === 'it' ? italian : english
}

export function eyeSummary(language: VisionLocale, side: 'r' | 'l', sphere?: string, cylinder?: string): string {
  const sideLabel = side === 'r' ? text(language, 'destro', 'right') : text(language, 'sinistro', 'left')
  const findings: string[] = []
  const parsedSphere = sphere ? Number(sphere.replace(',', '.')) : NaN
  if (Number.isFinite(parsedSphere) && parsedSphere !== 0) {
    findings.push(parsedSphere < 0
      ? `${text(language, 'miopia', 'myopia')} ${sphere}`
      : `${text(language, 'ipermetropia', 'hyperopia')} ${sphere}`)
  }
  const parsedCylinder = cylinder ? Number(cylinder.replace(',', '.')) : NaN
  if (Number.isFinite(parsedCylinder) && parsedCylinder !== 0) {
    findings.push(`${text(language, 'astigmatismo', 'astigmatism')} ${cylinder}`)
  }
  const prefix = `${text(language, 'Occhio', 'Eye')} ${sideLabel}:`
  return findings.length === 0
    ? `${prefix} ${text(language, 'nessuna correzione', 'no correction')}`
    : `${prefix} ${findings.join(' + ')}`
}

const DESCRIPTION_FIELDS: Record<string, string> = {
  rs: 'rs',
  rc: 'rc',
  ra: 'ra',
  ls: 'ls',
  lc: 'lc',
  la: 'la',
  add: 'add',
  pd: 'pd',
  od: 'rs',
  dx: 'rs',
  os: 'ls',
  sx: 'ls',
}

export function parsePrescriptionDescription(description: string): Record<string, string> {
  const values: Record<string, string> = {}
  const pattern = /([a-zà-ù]+)\s*[:=]?\s*([+-]?\d+(?:[.,]\d+)?\s*°?)/gi
  for (const match of description.matchAll(pattern)) {
    const key = (match[1] ?? '').toLowerCase()
    const value = (match[2] ?? '').trim()
    const field = DESCRIPTION_FIELDS[key]
    if (field && value && !values[field]) values[field] = value
  }
  return values
}

function tagValue(tags: string[], key: string): string | undefined {
  const prefix = `${key}=`
  const found = tags.find((tag) => tag.startsWith(prefix))
  if (!found) return undefined
  const value = found.slice(prefix.length).trim()
  return value.length > 0 ? value : undefined
}

export function prescriptionParts(event: Pick<HealthEvent, 'description' | 'tags'>): Record<string, string | undefined> {
  const parsed = parsePrescriptionDescription(event.description)
  const read = (key: string) => tagValue(event.tags, key) ?? parsed[key]
  return {
    kind: tagValue(event.tags, 'kind'),
    rs: read('rs'),
    rc: read('rc'),
    ra: read('ra'),
    ls: read('ls'),
    lc: read('lc'),
    la: read('la'),
    add: read('add'),
    pd: read('pd'),
  }
}

export function isVisionIssue(event: Pick<HealthEvent, 'tags'>): boolean {
  return event.tags.includes('record=issue')
}
