import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { MeasurementHistory, MeasurementSaveContext } from './MeasurementHistory'
import { I18nProvider } from '../i18n'
import { MetricTile } from './DataScrollMetricViews'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it('shows stored units and full original history without combining incompatible units', async () => {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  const snapshot = { measurements: [
    { id: 'demo-a', type: 'distance_cycling', value: 1000, unit: 'm', measuredAt: '2026-09-20T10:00:00Z', source: 'HealthKit', note: 'Sintetico' },
    { id: 'demo-b', type: 'distance_cycling', value: 2, unit: 'km', measuredAt: '2026-09-21T10:00:00Z', source: 'manual' },
  ] }
  try {
    await act(async () => root.render(<I18nProvider><MetricTile type="distance_cycling" tint="#123" language="it" snapshot={snapshot} windowDays={30} favorite={false} onToggleFavorite={() => {}} measurementLabel={() => 'Distanza'} measurementUnit={() => 'km'} /></I18nProvider>))
    expect(host.textContent).toContain('Unità diverse')
    expect(host.querySelector('.scroll-data__kpi-avg')).toBeNull()
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Registrazioni: Distanza"]')!.click())
    const dialog = host.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('HealthKit')
    expect(dialog.textContent).toContain('manual')
    expect(dialog.textContent).toContain('Sintetico')
    expect(dialog.querySelectorAll('time')).toHaveLength(2)
    expect(dialog.textContent).toContain('2 km')
    expect(dialog.textContent).toMatch(/1[.,]?000 m/)
  } finally { act(() => root.unmount()); host.remove() }
})

it('corrects a measurement with retry while preserving provenance and timestamp precision', async () => {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  const original = { id: 'weight-demo', type: 'weight', value: 120.123, unit: 'lb', measuredAt: '2026-09-20T10:00:43.321Z', createdAt: '2026-09-20T10:01:00Z', source: 'imported', sourceRecordId: 'demo-source', extra: 'preserve' }
  const save = vi.fn().mockRejectedValueOnce(new Error('demo')).mockResolvedValue(undefined)
  try {
    await act(async () => root.render(<I18nProvider><MeasurementSaveContext.Provider value={save}><MeasurementHistory snapshot={{ measurements: [original] }} type="weight" label="Peso" language="it" /></MeasurementSaveContext.Provider></I18nProvider>))
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Registrazioni: Peso"]')!.click())
    expect(host.textContent).toContain('120,123 lb')
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label^="Modifica misura"]')!.click())
    expect(document.activeElement).toBe(host.querySelector('input'))
    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[type="submit"]')!.focus()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    })
    expect(document.activeElement).toBe(host.querySelector('.entry-sheet__close'))
    await act(async () => {
      const input = host.querySelector('input')!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '121,123')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const submit = () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await act(async () => { submit(); submit() })
    expect(save).toHaveBeenCalledTimes(1)
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Riprova')
    await act(async () => submit())
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ ...original, value: 121.123 }))
    expect(host.querySelector('form')).toBeNull()
  } finally { act(() => root.unmount()); host.remove() }
})
