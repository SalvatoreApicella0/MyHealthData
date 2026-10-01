import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthDataController } from '../../storage/useHealthData'
import { I18nProvider } from '../../i18n'
import { toDateTimeLocal } from '../../core/format'
import { MedicationsSection } from './MedicationsSection'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('Medication flows', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers() })
  const therapy = { id: 'synthetic-med', name: 'Terapia demo', status: 'active', dose: 'test', stockQuantity: 20, source: { kind: 'synthetic' }, createdAt: '2026-01-01T00:00:00Z' }
  const setup = async (medications: Record<string, unknown>[], save = vi.fn(async () => undefined)) => {
    const data = { medications, medicationDoseEvents: [], saveCanonicalRecord: save } as unknown as HealthDataController
    await act(async () => root.render(<I18nProvider><MedicationsSection data={data} language="it" /></I18nProvider>))
    return save
  }
  const click = async (text: string) => act(async () => Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes(text))!.click())

  it('shows inactive therapies and preserves imported metadata when editing', async () => {
    const save = await setup([{ ...therapy, status: 'completed' }])
    expect(container.querySelector('.meds-list')).toBeNull()
    await click('Mostra tutte le terapie')
    expect(container.querySelector('.meds-list')?.textContent).toContain('Terapia demo')
    await click('Modifica')
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(save).toHaveBeenCalledWith('medications', expect.objectContaining({ id: therapy.id, stockQuantity: 20, source: therapy.source, createdAt: therapy.createdAt }))
  })

  it('defaults doses to local time and prevents duplicate submissions', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-30T12:30:00Z'))
    let finish!: () => void
    const pending = new Promise<void>((resolve) => { finish = resolve })
    const save = vi.fn(() => pending)
    await setup([therapy], save)
    await click('Registra dose')
    const input = container.querySelector<HTMLInputElement>('input[type="datetime-local"]')!
    expect(input.value).toBe(toDateTimeLocal(new Date().toISOString()))
    const form = container.querySelector('form')!
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('medicationDoseEvents', expect.objectContaining({ recordedAt: '2026-09-30T12:30:00.000Z' }))
    await act(async () => { finish(); await pending })
  })
})
