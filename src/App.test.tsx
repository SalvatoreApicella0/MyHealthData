import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthDataController } from './storage/useHealthData'
import { I18nProvider } from './i18n'
import App from './App'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let mockedData: HealthDataController

vi.mock('./storage/useHealthData', () => ({
  useHealthData: () => mockedData,
}))

function makeData(): HealthDataController {
  const noop = vi.fn(async () => undefined)
  return {
    events: [],
    measurements: [],
    documents: [],
    loading: false,
    syncStatus: { available: false, pendingCount: 0, failedCount: 0, documentStates: {} },
    refresh: noop,
    saveProfile: noop,
    saveEvent: noop,
    deleteEvent: noop,
    saveMeasurement: noop,
    deleteMeasurement: noop,
    saveDocument: noop,
    deleteDocument: noop,
    replaceAll: noop,
    clearAll: noop,
    saveCanonicalRecord: noop,
    deleteCanonicalRecord: noop,
    retrySync: noop,
  } as unknown as HealthDataController
}

describe('App', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/#/settings')
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.colorScheme = ''
    mockedData = makeData()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('updates the settings selector when the theme changes', async () => {
    await act(async () => {
      root.render(createElement(I18nProvider, null, createElement(App)))
    })
    await act(async () => {
      await vi.dynamicImportSettled()
    })

    const darkButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Scuro')
    expect(darkButton).not.toBeUndefined()
    expect(darkButton?.getAttribute('aria-pressed')).toBe('false')

    await act(async () => {
      darkButton?.click()
    })

    const updatedDarkButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Scuro')
    expect(updatedDarkButton?.getAttribute('aria-pressed')).toBe('true')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
