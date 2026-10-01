import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import type { HealthEvent } from '../../core/types'
import type { HealthDataController } from '../../storage/useHealthData'
import { AllergiesSection } from './AllergiesSection'
import { SexualSection } from './SexualSection'
import { DentalSection } from './DentalSection'
import { GutSection } from './GutSection'
import { VisionSection } from './VisionSection'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const fixture = (type: HealthEvent['type'], tags: string[]): HealthEvent => ({
  id: `synthetic-${type}`, type, occurredAt: '2026-09-20T10:00:00Z', description: 'Dato sintetico', tags,
  attachments: [{ id: 'synthetic-file', name: 'demo.txt', type: 'text/plain', size: 10 }],
  source: 'manual', sourceRecordId: 'synthetic-source', createdAt: '2026-09-20T10:00:00Z', updatedAt: '2026-09-20T10:00:00Z',
})

describe('Specialty editing', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
  afterEach(() => { act(() => root.unmount()); container.remove() })

  it.each([
    { View: AllergiesSection, event: fixture('allergy', ['category=Altro', 'severity=Grave', 'confirmed', 'custom=keep']) },
    { View: DentalSection, event: fixture('dental_care', ['action=extraction', 'tooth=11', 'note=demo', 'custom=keep']) },
    { View: GutSection, event: fixture('digestive_health', ['kind=Evacuazione', 'bristol=3', 'custom=keep']) },
    { View: SexualSection, event: fixture('sexual_activity', ['partner:demo', 'protected', 'custom=keep']) },
    { View: VisionSection, event: fixture('vision_prescription', ['kind=Occhiali', 'rs=-1.25', 'ls=-2.00', 'custom=keep']) },
  ])('edits $event.type without replacing its identity, provenance or attachment', async ({ View, event }) => {
    const saveEvent = vi.fn(async (_event: HealthEvent) => undefined)
    const data = { events: [event], saveEvent, deleteEvent: vi.fn() } as unknown as HealthDataController
    await act(async () => root.render(<I18nProvider><View data={data} language="it" /></I18nProvider>))
    await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label')?.startsWith('Modifica'))!.click())
    const form = container.querySelector('form')!
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(saveEvent).toHaveBeenCalledTimes(1)
    expect(saveEvent.mock.calls[0]?.[0]).toMatchObject({ id: event.id, source: event.source, sourceRecordId: event.sourceRecordId, attachments: event.attachments, createdAt: event.createdAt, tags: expect.arrayContaining(['custom=keep']) })
  })

  it('exposes old prescriptions with their values', async () => {
    const older = { ...fixture('vision_prescription', ['rs=-3.00']), id: 'synthetic-old', occurredAt: '2025-01-01T10:00:00Z' }
    const data = { events: [older, fixture('vision_prescription', ['rs=-1.25'])], saveEvent: vi.fn() } as unknown as HealthDataController
    await act(async () => root.render(<I18nProvider><VisionSection data={data} language="it" /></I18nProvider>))
    expect(container.querySelector('.spec-prescription-history')?.textContent).toContain('-3.00')
    expect(container.querySelector('.spec-hero')?.textContent).toContain('-1.25')
  })
})
