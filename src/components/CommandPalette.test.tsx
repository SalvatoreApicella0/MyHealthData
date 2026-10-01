import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { CommandPalette } from './CommandPalette'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('CommandPalette navigation', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => { act(() => root.unmount()); container.remove() })

  it('navigates to a module without starting entry, and keeps explicit new actions', async () => {
    const openModule = vi.fn()
    const openRoute = vi.fn()
    await act(async () => root.render(<I18nProvider><CommandPalette navigateTab={vi.fn()} openModule={openModule} openRoute={openRoute} /></I18nProvider>))
    const open = async () => act(async () => container.querySelector<HTMLButtonElement>('.command-trigger')!.click())
    const search = async (value: string) => act(async () => {
      const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await open()
    await search('sonno')
    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!
    expect(document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent).toContain('Sonno')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(openRoute).toHaveBeenCalledWith('#/modules/sleep')
    expect(openModule).not.toHaveBeenCalled()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    await open()
    expect(container.querySelector<HTMLInputElement>('[role="combobox"]')!.value).toBe('')
    await search('Nuovo documento')
    await act(async () => container.querySelector<HTMLButtonElement>('[role="option"]')!.click())
    expect(openModule).toHaveBeenCalledWith('documents')
  })

  it('recovers keyboard selection after an empty search and finds backup', async () => {
    const openRoute = vi.fn()
    await act(async () => root.render(<I18nProvider><CommandPalette navigateTab={vi.fn()} openModule={vi.fn()} openRoute={openRoute} /></I18nProvider>))
    await act(async () => container.querySelector<HTMLButtonElement>('.command-trigger')!.click())
    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!
    const search = async (value: string) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await search('nessuna corrispondenza')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
    await search('backup')
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(openRoute).toHaveBeenCalledWith('#/settings/data')
  })
})
