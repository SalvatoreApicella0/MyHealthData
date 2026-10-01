import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import type { HealthDocument } from '../core/types'
import type { HealthDataController } from '../storage/useHealthData'
import { DocumentsModuleView } from './DocumentsModuleView'

const { localAttachment, hubAttachment, resolveVerifiedAttachment } = vi.hoisted(() => ({
  localAttachment: vi.fn<() => Promise<Blob | undefined>>(),
  hubAttachment: vi.fn<() => Promise<Blob>>(),
  resolveVerifiedAttachment: vi.fn(),
}))
const originalDialogShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal')
const originalDialogClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close')

vi.mock('../storage/repository', () => ({
  getAttachmentBlob: localAttachment,
  saveAttachmentBlob: vi.fn(async () => undefined),
}))

vi.mock('../storage/hubRepository', () => ({
  getHubAttachment: hubAttachment,
}))

vi.mock('../core/attachmentResolution', () => ({
  resolveVerifiedAttachment,
}))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('DocumentsModuleView attachment opening', () => {
  let container: HTMLDivElement
  let root: Root
  let originalCreateObjectURL: typeof URL.createObjectURL | undefined
  let originalRevokeObjectURL: typeof URL.revokeObjectURL | undefined

  beforeEach(() => {
    window.sessionStorage.removeItem('mhd.pending-document')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) { this.setAttribute('open', '') },
    })
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) { this.removeAttribute('open') },
    })
    localAttachment.mockReset()
    hubAttachment.mockReset()
    resolveVerifiedAttachment.mockReset()
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test-report') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
    else Reflect.deleteProperty(URL, 'createObjectURL')
    if (originalRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL })
    else Reflect.deleteProperty(URL, 'revokeObjectURL')
    if (originalDialogShowModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalDialogShowModal)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
    if (originalDialogClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalDialogClose)
    else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
    vi.restoreAllMocks()
  })

  it('opens PDFs in the in-app preview without creating an about:blank tab', async () => {
    const file = new Blob(['%PDF-1.4 synthetic test'], { type: 'application/octet-stream' })
    localAttachment.mockResolvedValue(file)
    resolveVerifiedAttachment.mockResolvedValue({ blob: file, source: 'local', status: 'ok' })
    const attachment = { id: 'attachment_synthetic_pdf', name: 'referto-test.pdf', type: 'application/octet-stream', size: file.size }
    const data = {
      documents: [{ id: 'document_synthetic', title: 'Referto sintetico', documentType: 'medical_report', documentDate: '2026-09-20', attachment } as HealthDocument],
      appointments: [],
      syncStatus: { available: false, pendingCount: 0, failedCount: 0, documentStates: {} },
    } as unknown as HealthDataController
    const open = vi.spyOn(window, 'open')

    await act(async () => {
      root.render(<I18nProvider><DocumentsModuleView data={data} /></I18nProvider>)
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Apri allegato: Referto sintetico"]')?.click()
      await Promise.resolve()
    })

    expect(container.querySelector('.documents-row__expand')).toBeNull()
    expect(open).not.toHaveBeenCalled()
    expect(hubAttachment).not.toHaveBeenCalled()
    expect(container.querySelector('dialog iframe')?.getAttribute('src')).toBe('blob:test-report')
    expect(container.querySelector('dialog')?.open).toBe(true)
    expect(container.querySelector('dialog[aria-modal="true"]')).not.toBeNull()
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'application/pdf' }))
  })

  it('opens a linked document after navigation mounts the archive', async () => {
    window.sessionStorage.setItem('mhd.pending-document', 'linked-demo')
    const data = {
      documents: [{ id: 'linked-demo', title: 'Documento collegato sintetico', documentType: 'medical_report', documentDate: '2026-09-20' }],
      appointments: [],
      syncStatus: { available: false, pendingCount: 0, failedCount: 0, documentStates: {} },
    } as unknown as HealthDataController
    await act(async () => root.render(<I18nProvider><DocumentsModuleView data={data} /></I18nProvider>))
    expect(container.querySelector('.documents-row__expand')).not.toBeNull()
    expect(window.sessionStorage.getItem('mhd.pending-document')).toBeNull()
  })

  it('finds attachments by file name and restores the archive after an empty search', async () => {
    const data = {
      documents: [
        { id: 'synthetic-a', title: 'Controllo sintetico', documentType: 'medical_report', documentDate: '2026-09-20', attachment: { id: 'file-a', name: 'laboratorio-demo.pdf', type: 'application/pdf', size: 100 } },
        { id: 'synthetic-b', title: 'Foto sintetica', documentType: 'photo', documentDate: '2026-09-19' },
      ],
      appointments: [],
      syncStatus: { available: false, pendingCount: 0, failedCount: 0, documentStates: {} },
    } as unknown as HealthDataController
    await act(async () => root.render(<I18nProvider><DocumentsModuleView data={data} /></I18nProvider>))
    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!
    const searchFor = async (value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    }
    await searchFor('LABORATORIO')
    expect(container.querySelectorAll('[data-document-id]')).toHaveLength(1)
    expect(container.querySelector('[data-document-id]')?.getAttribute('data-document-id')).toBe('synthetic-a')
    await searchFor('nessuna corrispondenza')
    expect(container.querySelectorAll('[data-document-id]')).toHaveLength(0)
    await act(async () => {
      Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Mostra tutti i documenti'))!.click()
    })
    expect(input.value).toBe('')
    expect(container.querySelectorAll('[data-document-id]')).toHaveLength(2)
  })

})
