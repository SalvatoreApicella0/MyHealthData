import { createId } from '../../core/id'
import { toDateTimeLocal } from '../../core/format'
import type { AttachmentMetadata, EventType, HealthEvent } from '../../core/types'

export type Loc = 'it' | 'en'

export function locale(language: string): Loc {
  return language === 'en' ? 'en' : 'it'
}

export function t(lang: Loc, it: string, en: string): string {
  return lang === 'it' ? it : en
}

export function tagValue(tags: string[], key: string): string | undefined {
  const prefix = `${key}=`
  const found = tags.find((tag) => tag.startsWith(prefix))
  if (!found) return undefined
  const value = found.slice(prefix.length).trim()
  return value.length > 0 ? value : undefined
}

export function hasTag(tags: string[], tag: string): boolean {
  return tags.includes(tag)
}

export function buildEvent(
  type: EventType,
  occurredAt: string,
  description: string,
  tags: string[],
  attachments: AttachmentMetadata[] = [],
): HealthEvent {
  const now = new Date().toISOString()
  return {
    id: createId('event'),
    type,
    occurredAt,
    description,
    tags,
    attachments,
    createdAt: now,
    updatedAt: now,
  }
}

export function byDateDesc(events: HealthEvent[]): HealthEvent[] {
  return [...events].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
}

export function formatDay(value: string, lang: Loc): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function formatDayTime(value: string, lang: Loc): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function excerpt(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

export function nowInput(): string {
  return toDateTimeLocal(new Date().toISOString())
}

export function confirmDelete(lang: Loc): boolean {
  return window.confirm(t(lang, 'Eliminare questo dato?', 'Delete this record?'))
}

export function isToday(value: string): boolean {
  const date = new Date(value)
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

export function sexualTypeLabel(type: EventType, lang: Loc): string {
  return type === 'sexual_activity' ? t(lang, 'Con partner', 'With partner') : t(lang, 'Masturbazione', 'Masturbation')
}

export function partnerAlias(event: Pick<HealthEvent, 'tags'>): string | undefined {
  const tag = event.tags.find((entry) => entry.startsWith('partner:') || entry.startsWith('partner='))
  if (!tag) return undefined
  const value = tag.slice('partner:'.length).trim()
  return value.length > 0 ? value : undefined
}

/** Preserve provenance, attachments and unowned fields during a focused edit. */
export function editedEvent(existing: HealthEvent | undefined, draft: HealthEvent, managedTags: readonly string[]): HealthEvent {
  if (!existing) return draft
  const retainedTags = existing.tags.filter((tag) => !managedTags.some((key) => tag === key || tag.startsWith(`${key}=`) || tag.startsWith(`${key}:`)))
  return {
    ...existing,
    type: draft.type,
    occurredAt: draft.occurredAt,
    description: draft.description,
    tags: [...retainedTags, ...draft.tags],
    updatedAt: draft.updatedAt,
  }
}
