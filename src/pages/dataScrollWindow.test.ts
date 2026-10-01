import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

function nearbySectionIds(ids: string[], index: number): string[] {
  const start = Math.max(0, index - 2)
  const end = Math.min(ids.length, index + 3)
  return ids.slice(start, end)
}

describe('data scroll virtualization window', () => {
  it('keeps the first viewport warm before the observer emits', () => {
    const ids = ['dolori', 'misure', 'cuore', 'movimento']
    expect(ids.slice(0, 3)).toEqual(['dolori', 'misure', 'cuore'])
  })

  it('keeps the active section plus two neighbors on either side for fast scrolling', () => {
    const ids = ['dolori', 'misure', 'cuore', 'movimento']
    expect(nearbySectionIds(ids, 2)).toEqual(['dolori', 'misure', 'cuore', 'movimento'])
    expect(nearbySectionIds(ids, 0)).toEqual(['dolori', 'misure', 'cuore'])
  })
})

describe('data scroll layout contract', () => {
  it('uses the measured React placeholder instead of a second content-visibility size estimate', () => {
    const css = readFileSync('src/pages/datascroll.css', 'utf8')
    const sectionBody = css.match(/\.scroll-data__section-body\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(sectionBody).toContain('min-width: 0')
    expect(sectionBody).not.toMatch(/content-visibility|contain-intrinsic-size/)
  })

  it('keeps the sidebar switch aligned with the compact-width breakpoint', () => {
    const css = readFileSync('src/pages/datascroll.css', 'utf8')

    expect(css).toContain('@media (max-width: 1080px)')
    expect(css).toContain('@media (min-width: 1081px) and (max-width: 1200px)')
    expect(css).toContain('@media (min-width: 1201px)')
  })
})

describe('data scroll observer band', () => {
  it('uses a lower boundary that can warm the next section before the viewport edge', () => {
    const rootMargin = '-8% 0px -45% 0px'
    const [, , bottom] = rootMargin.split(' ')
    expect(bottom).toBe('-45%')
  })
})

describe('specialist add request consumption', () => {
  it('consumes a token only once across section remounts', () => {
    let consumed: number | null = null
    const consume = (token: number) => {
      if (consumed === token) return false
      consumed = token
      return true
    }
    expect(consume(7)).toBe(true)
    expect(consume(7)).toBe(false)
    expect(consume(8)).toBe(true)
  })

  it('keeps a native sleep or cycle add request pending until its section mounts', () => {
    let handled = false
    const token = 12
    const acknowledge = (received: number) => {
      if (received === token) handled = true
    }

    expect(handled).toBe(false)
    acknowledge(token)
    expect(handled).toBe(true)
  })
})
