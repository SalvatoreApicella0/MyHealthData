const SCROLL_ANCHOR_MANUAL_EVENTS = ['scroll', 'touchstart', 'wheel', 'keydown'] as const

export function firstIntersectingSection(entries: readonly IntersectionObserverEntry[]): string | undefined {
  let candidate: IntersectionObserverEntry | undefined
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    if (!candidate || entry.boundingClientRect.top < candidate.boundingClientRect.top) candidate = entry
  }
  return candidate?.target.id
}

/**
 * Return the scroll correction required to keep an anchor at the same viewport
 * coordinate after content above it changes size. Sub-pixel changes are noise
 * and should not trigger a scroll operation.
 */
export function scrollAnchorCompensation(anchorTop: number, currentTop: number): number {
  const delta = currentTop - anchorTop
  return Math.abs(delta) < 0.5 ? 0 : delta
}

/**
 * Manual input ends anchor compensation. A scroll event emitted by the
 * programmatic section jump is allowed to complete that jump first.
 */
export function shouldDisarmScrollAnchor(event: Pick<Event, 'type'>, programmaticScroll = false): boolean {
  if (!SCROLL_ANCHOR_MANUAL_EVENTS.includes(event.type as (typeof SCROLL_ANCHOR_MANUAL_EVENTS)[number])) return false
  return !(event.type === 'scroll' && programmaticScroll)
}

export function scrollToSection(id: string, behavior: ScrollBehavior = 'smooth'): void {
  const element = document.getElementById(id)
  if (!element) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reducedMotion ? 'auto' : behavior, block: 'start' })
}

export { SCROLL_ANCHOR_MANUAL_EVENTS }
