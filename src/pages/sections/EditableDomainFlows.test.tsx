import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import type { HealthDataController } from '../../storage/useHealthData'
import { NutritionSection } from './NutritionSection'
import { LabSection } from './LabSection'
import { SleepSection } from './SleepSection'
import { CycleSection } from './CycleSection'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('Focused domain edits', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
  afterEach(() => { act(() => root.unmount()); container.remove() })
  const editField = async (label: string, value: string) => act(async () => {
    const input = Array.from(container.querySelectorAll('label')).find((node) => node.textContent?.startsWith(label))!.querySelector('input')!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const submit = async () => act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))

  it('edits a cycle diary record preserving source, date and simultaneous period flags', async () => {
    const original = { id: 'cycle-demo', date: '2026-09-20', isPeriodStart: true, isPeriodDay: true, flow: 'medium', mood: 'calm', note: 'demo', source: 'imported', sourceRecordId: 'cycle-import', createdAt: '2026-09-20T10:00:00Z', extra: 'preserve' }
    const save = vi.fn(async (_domain: string, _record: Record<string, unknown>) => undefined)
    const data = { cycleEntries: [original], saveCanonicalRecord: save } as unknown as HealthDataController
    await act(async () => root.render(<I18nProvider><CycleSection data={data} language="it" /></I18nProvider>))
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label^="Modifica registrazione"]')!.click())
    expect(container.querySelector('textarea')?.value).toBe('demo')
    await act(async () => {
      const field = container.querySelector('textarea')!
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'Nota corretta')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await submit()
    expect(save).toHaveBeenCalledWith('cycleEntries', expect.objectContaining({ ...original, note: 'Nota corretta' }))
  })

  it('creates distinct nights and keeps a stable identity when editing an imported night', async () => {
    const save = vi.fn(async (_domain: string, _record: Record<string, unknown>) => undefined)
    const data = { measurements: [], sleepSessions: [], saveCanonicalRecord: save } as unknown as HealthDataController
    await act(async () => root.render(<I18nProvider><SleepSection data={data} language="it" /></I18nProvider>))
    for (let index = 0; index < 2; index++) {
      await act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Aggiungi notte')!.click())
      await submit()
    }
    expect(save.mock.calls[0]?.[1].id).not.toBe(save.mock.calls[1]?.[1].id)
    const original = { id: 'sleep-demo', startAt: '2026-09-19T22:00:00Z', endAt: '2026-09-20T06:00:00Z', source: 'HealthKit', sourceRecordId: 'import-demo', createdAt: '2026-09-20T06:01:00Z', quality: 4 }
    await act(async () => root.render(<I18nProvider><SleepSection data={{ ...data, sleepSessions: [original] } as unknown as HealthDataController} language="it" /></I18nProvider>))
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label^="Modifica notte"]')!.click())
    await editField('Risvegli', '2')
    await submit()
    expect(save).toHaveBeenLastCalledWith('sleepSessions', expect.objectContaining({ ...original, awakenings: 2 }))
  })

  it('edits food in place and preserves its date, favorite and imported provenance', async () => {
    const original = { id: 'synthetic-food', name: 'Alimento demo', meal: 'breakfast', loggedAt: new Date().toISOString(), calories: 100, protein: 2, carbohydrates: 15, fat: 3, quantity: 100, servingUnit: 'g', isFavorite: true, source: 'imported', sourceRecordId: 'synthetic-source', note: 'demo' }
    const save = vi.fn(async (_domain: string, _record: Record<string, unknown>) => undefined)
    const data = { measurements: [], foodLogEntries: [original], foodRecipes: [], saveCanonicalRecord: save } as unknown as HealthDataController
    await act(async () => root.render(<I18nProvider><NutritionSection data={data} language="it" /></I18nProvider>))
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Modifica alimento: Alimento demo"]')!.click())
    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Modifica alimento')
    await editField('Calorie', '120')
    await submit()
    expect(save).toHaveBeenCalledWith('foodLogEntries', expect.objectContaining({ id: original.id, calories: 120, loggedAt: original.loggedAt, isFavorite: true, source: 'imported', sourceRecordId: 'synthetic-source' }))
  })

  it('edits the lab value while keeping comparator, range, linkage and source', async () => {
    const original = { id: 'synthetic-lab', analyte: 'Glucosio', value: 90, unit: 'mg/dL', comparator: '<', referenceLow: 70, referenceHigh: 100, collectedAt: '2026-09-20T09:00:00Z', linkedDocumentId: 'synthetic-doc', source: 'imported' }
    const save = vi.fn(async (_domain: string, _record: Record<string, unknown>) => undefined)
    const data = { measurements: [], labResults: [original], saveCanonicalRecord: save } as unknown as HealthDataController
    await act(async () => root.render(<I18nProvider><LabSection data={data} language="it" /></I18nProvider>))
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Modifica Glucosio"]')!.click())
    await editField('Valore', '91,5')
    await submit()
    expect(save).toHaveBeenCalledWith('labResults', expect.objectContaining({ ...original, value: 91.5 }))
  })
})
