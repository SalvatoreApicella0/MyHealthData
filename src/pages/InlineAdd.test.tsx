import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthDataController } from '../storage/useHealthData'
import { InlineAdd } from './InlineAdd'
import type { SectionSpec } from './dataScrollModel'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function changeInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function submitForm(form: HTMLFormElement | null) {
  form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

function inputForLabel(container: HTMLElement, text: string): HTMLInputElement {
  const label = Array.from(container.querySelectorAll('label')).find((candidate) => candidate.textContent?.startsWith(text))
  const input = label?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) throw new Error(`Missing input for ${text}`)
  return input
}

const sharedProps = {
  language: 'it',
  measurementLabel: (value: string) => value,
  measurementUnit: () => 'unit',
}

describe('InlineAdd', () => {
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

  it('saves a measurement and notifies the parent', async () => {
    const saveMeasurement = vi.fn().mockResolvedValue(undefined)
    const onDone = vi.fn()
    const onSaved = vi.fn()
    const section: SectionSpec = { id: 'cuore', title: 'Cuore e respiro', kind: 'measurements', moduleId: 'heart' }

    await act(async () => {
      root.render(
        <InlineAdd
          {...sharedProps}
          data={{ saveMeasurement } as unknown as HealthDataController}
          onDone={onDone}
          onSaved={onSaved}
          section={section}
        />,
      )
    })

    const valueInput = container.querySelector('input:not([type="datetime-local"])')
    expect(valueInput).toBeInstanceOf(HTMLInputElement)
    await act(async () => {
      if (valueInput instanceof HTMLInputElement) changeInput(valueInput, '72,5')
      submitForm(container.querySelector('form'))
      await Promise.resolve()
    })

    expect(saveMeasurement).toHaveBeenCalledTimes(1)
    expect(saveMeasurement.mock.calls[0]?.[0]).toMatchObject({ value: 72.5, unit: 'unit' })
    expect(onSaved).toHaveBeenCalledWith(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('validates required canonical fields before saving', async () => {
    const saveCanonicalRecord = vi.fn().mockResolvedValue(undefined)
    const section: SectionSpec = { id: 'farmaci', title: 'Farmaci', kind: 'canonical', moduleId: 'medications', domain: 'medications' }

    await act(async () => {
      root.render(
        <InlineAdd
          {...sharedProps}
          data={{ saveCanonicalRecord } as unknown as HealthDataController}
          onDone={vi.fn()}
          onSaved={vi.fn()}
          section={section}
        />,
      )
    })

    await act(async () => {
      submitForm(container.querySelector('form'))
    })

    expect(saveCanonicalRecord).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Inserisci: Farmaco.')
  })

  it('builds and saves a canonical medication record', async () => {
    const saveCanonicalRecord = vi.fn().mockResolvedValue(undefined)
    const onDone = vi.fn()
    const section: SectionSpec = { id: 'farmaci', title: 'Farmaci', kind: 'canonical', moduleId: 'medications', domain: 'medications' }

    await act(async () => {
      root.render(
        <InlineAdd
          {...sharedProps}
          data={{ saveCanonicalRecord } as unknown as HealthDataController}
          onDone={onDone}
          onSaved={vi.fn()}
          section={section}
        />
      )
    })

    await act(async () => {
      changeInput(inputForLabel(container, 'Farmaco'), 'Ibuprofene')
      changeInput(inputForLabel(container, 'Dose'), '400 mg')
      changeInput(inputForLabel(container, 'Programma'), 'Ogni 8 ore')
      submitForm(container.querySelector('form'))
      await Promise.resolve()
    })

    expect(saveCanonicalRecord).toHaveBeenCalledTimes(1)
    expect(saveCanonicalRecord.mock.calls[0]?.[0]).toBe('medications')
    expect(saveCanonicalRecord.mock.calls[0]?.[1]).toMatchObject({
      id: expect.stringMatching(/^medication_/),
      name: 'Ibuprofene',
      dose: '400 mg',
      schedule: 'Ogni 8 ore',
      status: 'active',
    })
    expect(saveCanonicalRecord.mock.calls[0]?.[1].createdAt).toEqual(expect.any(String))
    expect(saveCanonicalRecord.mock.calls[0]?.[1].updatedAt).toEqual(expect.any(String))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
