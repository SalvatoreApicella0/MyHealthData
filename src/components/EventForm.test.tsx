import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EventForm } from './EventForm'
import { I18nProvider } from '../i18n'
import { dictionaries } from '../i18n/messages'
import type { HealthEvent } from '../core/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function changeDescription(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(textarea, value)
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
}

function submitForm(form: HTMLFormElement | null) {
  form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

describe('EventForm', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    window.localStorage.setItem('mhd.language', 'it')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    window.localStorage.clear()
  })

  it('blocks saving an empty description and shows the required message', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    await act(async () => {
      root.render(
        <I18nProvider>
          <EventForm onSave={onSave} />
        </I18nProvider>,
      )
    })

    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    await act(async () => {
      submitForm(form)
    })

    expect(onSave).not.toHaveBeenCalled()
    expect(container.textContent).toContain(dictionaries.it['symptom.descriptionRequired'] ?? '')
  })

  it('preserves body point and unknown iOS fields when editing an existing event', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const bodyPoint = {
      x: 0.1,
      y: 0.9,
      z: -0.2,
      modelVersion: 'bodyparts3d-4.0',
      approximateRegionId: 'lower_back' as const,
    }
    const existing: HealthEvent = {
      id: 'event_1',
      type: 'pain',
      bodyRegionId: 'lower_back',
      occurredAt: '2026-09-14T10:00:00.000Z',
      description: 'old',
      tags: [],
      attachments: [],
      createdAt: '2026-09-10T10:00:00.000Z',
      updatedAt: '2026-09-10T10:00:00.000Z',
      bodyPoint,
      source: 'healthkit',
      sourceRecordId: 'abc',
    }

    await act(async () => {
      root.render(
        <I18nProvider>
          <EventForm event={existing} onSave={onSave} />
        </I18nProvider>,
      )
    })

    const textarea = container.querySelector('textarea')
    expect(textarea).not.toBeNull()
    await act(async () => {
      if (textarea) changeDescription(textarea, 'changed')
    })

    const form = container.querySelector('form')
    await act(async () => {
      submitForm(form)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0]?.[0] as HealthEvent | undefined
    expect(saved?.description).toBe('changed')
    expect(saved?.bodyPoint).toEqual(bodyPoint)
    expect(saved?.source).toBe('healthkit')
    expect(saved?.sourceRecordId).toBe('abc')
  })

  it('keeps the form open and exposes a retryable error when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('offline'))
    await act(async () => {
      root.render(
        <I18nProvider>
          <EventForm onSave={onSave} />
        </I18nProvider>,
      )
    })

    const textarea = container.querySelector('textarea')
    expect(textarea).not.toBeNull()
    await act(async () => {
      if (textarea) changeDescription(textarea, 'Mal di schiena')
      submitForm(container.querySelector('form'))
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(container.querySelector('form')).not.toBeNull()
    expect(container.textContent).toContain(dictionaries.it['symptom.saveError'] ?? '')
  })

  it('passes selected attachment bytes alongside the event metadata', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    await act(async () => {
      root.render(
        <I18nProvider>
          <EventForm onSave={onSave} />
        </I18nProvider>,
      )
    })

    await act(async () => {
      const details = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Dettagli'))
      details?.click()
      const description = container.querySelector('textarea')
      if (description) changeDescription(description, 'Referto collegato')
      const file = new File(['pdf-bytes'], 'referto.pdf', { type: 'application/pdf', lastModified: 123 })
      const input = container.querySelector('input[type="file"]')
      if (!input) throw new Error('file input missing')
      Object.defineProperty(input, 'files', { configurable: true, value: [file] })
      input.dispatchEvent(new Event('change', { bubbles: true }))
      submitForm(container.querySelector('form'))
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    const attachments = onSave.mock.calls[0]?.[1] as Array<{ metadata: { name: string }; file: File }> | undefined
    expect(attachments).toHaveLength(1)
    expect(attachments?.[0]?.metadata.name).toBe('referto.pdf')
    expect(attachments?.[0]?.file).toBeInstanceOf(File)
    expect(attachments?.[0]?.file.size).toBe(9)
  })
})
