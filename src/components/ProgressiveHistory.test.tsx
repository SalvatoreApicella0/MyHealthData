import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { ProgressiveHistory } from './ProgressiveHistory'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it('makes every historical entry reachable without duplicates and retains the final control', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const items = Array.from({ length: 12 }, (_, index) => `synthetic-${index}`)
  await act(async () => root.render(<ProgressiveHistory items={items} language="it">{(visible) => <ul>{visible.map((item) => <li key={item}>{item}</li>)}</ul>}</ProgressiveHistory>))
  expect(container.querySelectorAll('li')).toHaveLength(5)
  await act(async () => container.querySelector('button')!.click())
  expect(container.querySelectorAll('li')).toHaveLength(10)
  await act(async () => container.querySelector('button')!.click())
  expect(Array.from(container.querySelectorAll('li')).map((item) => item.textContent)).toEqual(items)
  expect(container.querySelector('button')!.disabled).toBe(true)
  expect(container.querySelector('[role="status"]')!.textContent).toContain('12 di 12')
  act(() => root.unmount())
})
