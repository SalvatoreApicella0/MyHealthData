import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthDataController } from '../storage/useHealthData'
import { BodyMeasurementAdd } from './BodyMeasurementAdd'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('BodyMeasurementAdd', () => {
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

  it('requires at least one value before saving', async () => {
    const saveMeasurement = vi.fn().mockResolvedValue(undefined)
    await act(async () => {
      root.render(
        <BodyMeasurementAdd
          data={{ saveMeasurement, profile: { id: 'profile', alias: 'Test', updatedAt: '2026-09-25T12:00:00.000Z', heightCm: 180 } } as unknown as HealthDataController}
          language="it"
          measurementUnit={(type) => type === 'weight' ? 'kg' : 'cm'}
          onDone={vi.fn()}
          onSaved={vi.fn()}
        />,
      )
    })

    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(saveMeasurement).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Inserisci almeno un valore.')
  })

  it('keeps optional measurement groups collapsed by default', async () => {
    await act(async () => {
      root.render(
        <BodyMeasurementAdd
          data={{ saveMeasurement: vi.fn().mockResolvedValue(undefined), profile: { id: 'profile', alias: 'Test', updatedAt: '2026-09-25T12:00:00.000Z', heightCm: 180 } } as unknown as HealthDataController}
          language="it"
          measurementUnit={(type) => type === 'weight' ? 'kg' : 'cm'}
          onDone={vi.fn()}
          onSaved={vi.fn()}
        />,
      )
    })

    const optionalGroups = Array.from(container.querySelectorAll('details.scroll-data__body-optional'))
    expect(optionalGroups).toHaveLength(2)
    expect(optionalGroups.every((group) => !(group as HTMLDetailsElement).open)).toBe(true)
    expect(optionalGroups.map((group) => group.querySelector('summary')?.textContent?.trim())).toEqual([
      'Composizione2 valori facoltativi',
      'Circonferenze4 appaiate · 7 singole',
    ])
  })

  it('saves the entered weight together with the derived BMI in one batch', async () => {
    const saveMeasurement = vi.fn().mockResolvedValue(undefined)
    const onDone = vi.fn()
    const onSaved = vi.fn()
    await act(async () => {
      root.render(
        <BodyMeasurementAdd
          data={{ saveMeasurement, profile: { id: 'profile', alias: 'Test', updatedAt: '2026-09-25T12:00:00.000Z', heightCm: 180 } } as unknown as HealthDataController}
          language="it"
          measurementUnit={(type) => type === 'weight' ? 'kg' : 'cm'}
          onDone={onDone}
          onSaved={onSaved}
        />,
      )
    })

    const numericInputs = Array.from(container.querySelectorAll('input')).filter((input) => input.type !== 'datetime-local')
    expect(numericInputs.length).toBeGreaterThan(0)
    await act(async () => {
      changeInput(numericInputs[0]!, '72')
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(saveMeasurement).toHaveBeenCalledTimes(2)
    expect(saveMeasurement.mock.calls.map(([measurement]) => measurement.type)).toEqual(['weight', 'body_mass_index'])
    expect(saveMeasurement.mock.calls[0]?.[0].value).toBe(72)
    expect(saveMeasurement.mock.calls[1]?.[0].value).toBe(22.2)
    expect(onSaved).toHaveBeenCalledWith(2)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
