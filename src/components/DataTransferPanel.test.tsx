import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createExportFile } from '../core/schema'
import { I18nProvider } from '../i18n'
import type { HealthDataController } from '../storage/useHealthData'
import { DataTransferPanel } from './DataTransferPanel'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('Import review', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container) })
  afterEach(() => { act(() => root.unmount()); container.remove() })
  const setup = async (replaceAll = vi.fn(async () => undefined)) => {
    const data = { events: [], measurements: [], documents: [], replaceAll } as unknown as HealthDataController
    await act(async () => root.render(<I18nProvider><DataTransferPanel data={data} /></I18nProvider>))
    return replaceAll
  }
  const select = async (content: string) => {
    const file = new File([content], 'synthetic-backup.mhd.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => content })
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    await act(async () => {
      Object.defineProperty(input, 'files', { configurable: true, value: [file] })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }
  const click = async (text: string) => act(async () => Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes(text))!.click())

  it('validates and previews a file without replacing data, and can cancel', async () => {
    const replace = await setup()
    await select(JSON.stringify(createExportFile({ events: [], measurements: [], documents: [], appointments: [] })))
    expect(replace).not.toHaveBeenCalled()
    expect(container.querySelector('.import-review')?.textContent).toContain('synthetic-backup.mhd.json')
    expect(container.querySelector('.import-review')?.textContent).toContain('sostituisce')
    await click('Annulla importazione')
    expect(container.querySelector('.import-review')).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })

  it('keeps the reviewed file available after failure and imports only after confirmation', async () => {
    const replace = vi.fn().mockRejectedValueOnce(new Error('synthetic')).mockResolvedValueOnce(undefined)
    await setup(replace)
    const payload = createExportFile({ events: [], measurements: [], documents: [], appointments: [{ id: 'synthetic-a', title: 'Demo' }] })
    await select(JSON.stringify(payload))
    await click('Sostituisci i dati')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Riprova')
    expect(container.querySelector('.import-review')).not.toBeNull()
    await click('Sostituisci i dati')
    expect(replace).toHaveBeenCalledTimes(2)
    expect(replace).toHaveBeenLastCalledWith(expect.objectContaining({ appointments: payload.appointments }))
    expect(container.querySelector('.import-review')).toBeNull()
  })

  it('rejects malformed files before review or replacement', async () => {
    const replace = await setup()
    await select('{invalid')
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
    expect(container.querySelector('.import-review')).toBeNull()
    expect(replace).not.toHaveBeenCalled()
  })
})
