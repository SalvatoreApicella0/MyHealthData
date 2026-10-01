import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import type { HealthDataController } from '../storage/useHealthData'
import { CalendarPage } from './CalendarPage'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function submitForm(form: HTMLFormElement | null): void {
  form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function makeData(saveCanonicalRecord: HealthDataController['saveCanonicalRecord']): HealthDataController {
  return {
    events: [],
    measurements: [],
    documents: [],
    appointments: [],
    loading: false,
    syncStatus: { available: false, pendingCount: 0, failedCount: 0, documentStates: {} },
    refresh: vi.fn(async () => undefined),
    saveCanonicalRecord,
    deleteCanonicalRecord: vi.fn(async () => undefined),
    saveProfile: vi.fn(async () => undefined),
    saveEvent: vi.fn(async () => undefined),
    deleteEvent: vi.fn(async () => undefined),
    saveMeasurement: vi.fn(async () => undefined),
    deleteMeasurement: vi.fn(async () => undefined),
    saveDocument: vi.fn(async () => undefined),
    deleteDocument: vi.fn(async () => undefined),
    replaceAll: vi.fn(async () => undefined),
    clearAll: vi.fn(async () => undefined),
    retrySync: vi.fn(async () => undefined),
  } as unknown as HealthDataController
}

describe('CalendarPage entry sheet', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('closes after a successful save and ignores duplicate submits while saving', async () => {
    const pending = deferred<void>()
    const saveCanonicalRecord = vi.fn(() => pending.promise)
    const data = makeData(saveCanonicalRecord)

    await act(async () => {
      root.render(<I18nProvider><CalendarPage data={data} /></I18nProvider>)
    })
    await act(async () => {
      const openButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Nuovo appuntamento'))
      openButton?.click()
    })

    const title = container.querySelector<HTMLInputElement>('input[placeholder]')
    if (!title) throw new Error('calendar title input missing')
    await act(async () => {
      setInputValue(title, 'Appointment')
    })
    const form = container.querySelector<HTMLFormElement>('form')
    await act(async () => {
      submitForm(form)
      submitForm(form)
    })

    expect(saveCanonicalRecord).toHaveBeenCalledTimes(1)
    expect(container.querySelector('[role="dialog"]')).not.toBeNull()

    await act(async () => {
      pending.resolve(undefined)
      await pending.promise
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('keeps the draft available and allows a retry after a failed save', async () => {
    const first = deferred<void>()
    const saveCanonicalRecord = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(undefined)
    const data = makeData(saveCanonicalRecord)

    await act(async () => {
      root.render(<I18nProvider><CalendarPage data={data} /></I18nProvider>)
    })
    await act(async () => {
      const openButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Nuovo appuntamento'))
      openButton?.click()
    })

    const title = container.querySelector<HTMLInputElement>('input[placeholder]')
    if (!title) throw new Error('calendar title input missing')
    await act(async () => {
      setInputValue(title, 'Appointment')
    })
    const form = container.querySelector<HTMLFormElement>('form')
    await act(async () => {
      submitForm(form)
      first.reject(new Error('temporary failure'))
      await first.promise.catch(() => undefined)
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(container.textContent).toContain('Impossibile salvare. Riprova.')

    await act(async () => {
      submitForm(container.querySelector<HTMLFormElement>('form'))
    })

    expect(saveCanonicalRecord).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('uses an adjacent-month day in the form and preserves its local date on save', async () => {
    const save = vi.fn(async () => undefined)
    await act(async () => root.render(<I18nProvider><CalendarPage data={makeData(save)} /></I18nProvider>))
    // Every month grid includes an adjacent month on at least one edge.
    const adjacent = container.querySelector<HTMLButtonElement>('.calendar-grid__day[data-in-month="false"]')!
    const label = adjacent.getAttribute('aria-label')!
    await act(async () => adjacent.click())
    await act(async () => {
      Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Aggiungi a questo giorno'))!.click()
    })
    const dateInput = container.querySelector<HTMLInputElement>('input[type="datetime-local"]')!
    const localDate = new Date(`${dateInput.value}:00`)
    expect(new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(localDate)).toBe(label)
    await act(async () => {
      setInputValue(container.querySelector<HTMLInputElement>('input[placeholder]')!, 'Visita sintetica')
      setInputValue(dateInput, `${dateInput.value.slice(0, 10)}T09:30`)
    })
    const expected = new Date(dateInput.value).toISOString()
    await act(async () => submitForm(container.querySelector('form')))
    expect(save).toHaveBeenCalledWith('appointments', expect.objectContaining({ scheduledAt: expected, title: 'Visita sintetica' }))
  })

  it('sorts the day agenda by time and opens the selected visit with its existing edit actions', async () => {
    const data = makeData(vi.fn(async () => undefined))
    const day = new Date()
    const at = (hour: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour).toISOString()
    data.appointments = [
      { id: 'synthetic-later', title: 'Visita pomeriggio', scheduledAt: at(18), category: 'general', status: 'cancelled' },
      { id: 'synthetic-earlier', title: 'Visita mattina', scheduledAt: at(9), category: 'general', clinician: 'Medico demo', reason: 'Motivo sintetico', status: 'completed' },
    ] as unknown as HealthDataController['appointments']
    await act(async () => root.render(<I18nProvider><CalendarPage data={data} /></I18nProvider>))
    const agenda = container.querySelector('.calendar-agenda__list')!
    expect(Array.from(agenda.querySelectorAll('strong')).map((node) => node.textContent)).toEqual(['Visita mattina', 'Visita pomeriggio'])
    expect(agenda.textContent).toContain('Medico demo')
    expect(agenda.textContent).toContain('Motivo sintetico')
    expect(agenda.textContent).toContain('Annullato')
    await act(async () => agenda.querySelector<HTMLButtonElement>('button')!.click())
    const dialog = container.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Visita mattina')
    expect(dialog.textContent).not.toContain('Visita pomeriggio')
    expect(Array.from(dialog.querySelectorAll('button')).some((button) => button.textContent?.includes('Modifica'))).toBe(true)
  })

})
