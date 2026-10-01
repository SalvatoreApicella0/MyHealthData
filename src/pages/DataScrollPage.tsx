import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import { moduleCopy } from '../core/healthModules'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'
import {
  BASE_SECTIONS,
  DEFAULT_SECTION_ORDER,
  SECTION_IDS,
  readFavorites,
  readOrder,
  sortCanonicalRecords,
  sortEventsByOccurredAt,
  writeFavorites,
  writeOrder,
  type SectionSpec,
} from './dataScrollModel'
import { FavoritesGrid } from './DataScrollSectionBody'
import { DataScrollNavigation } from './DataScrollNavigation'
import { DataScrollSectionList } from './DataScrollSectionList'
import {
  SCROLL_ANCHOR_MANUAL_EVENTS,
  firstIntersectingSection,
  scrollAnchorCompensation,
  scrollToSection,
  shouldDisarmScrollAnchor,
} from './dataScrollViewport'
import './datascroll.css'

export { DEFAULT_SECTION_ORDER, sortCanonicalRecords, sortEventsByOccurredAt }
export { firstIntersectingSection, scrollAnchorCompensation, shouldDisarmScrollAnchor } from './dataScrollViewport'

interface DataScrollPageProps {
  data: HealthDataController
  /** Legacy module links can focus the equivalent section in the unified page. */
  focusSection?: string
}

export function DataScrollPage({ data, focusSection }: DataScrollPageProps) {
  const { language, formatDate, measurementLabel, measurementUnit } = useI18n()
  const snapshot = useMemo(() => data as unknown as Record<string, unknown>, [data])
  const [order, setOrder] = useState<string[]>(() => readOrder())
  const [reordering, setReordering] = useState(false)
  const [openForm, setOpenForm] = useState('')
  const [savedSummary, setSavedSummary] = useState<{ section: string; count: number } | null>(null)
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites())
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [active, setActive] = useState('')
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false)
  // Keep the first viewport warm before IntersectionObserver emits its first
  // entry. This avoids a blank/placeholder first frame on a fresh load.
  const [visible, setVisible] = useState<Set<string>>(() => {
    const initialOrder = readOrder()
    const ids = [...initialOrder, ...SECTION_IDS.filter((id) => !initialOrder.includes(id))]
    return new Set(ids.slice(0, 3))
  })
  const [sectionHeights, setSectionHeights] = useState<Record<string, number>>({})
  const sectionObservers = useRef(new Map<string, ResizeObserver>())
  const sectionRefs = useRef(new Map<string, (element: HTMLDivElement | null) => void>())
  const pendingSectionHeights = useRef(new Map<string, number>())
  const sectionHeightFrame = useRef<number | undefined>()
  const scrollAnchor = useRef<{ id: string; top: number; precedingIds: ReadonlySet<string> }>()
  const programmaticScroll = useRef(false)
  const programmaticScrollFrame = useRef<number | undefined>()
  const addRequestSequence = useRef(0)
  const rail = useRef<HTMLElement | null>(null)
  const setRail = useCallback((element: HTMLElement | null) => {
    rail.current = element
  }, [])
  const [specialistAddRequest, setSpecialistAddRequest] = useState<{ sectionId: string; token: number } | null>(null)

  const sections = useMemo(() => {
    const byId = new Map(BASE_SECTIONS.map((section) => [section.id, section]))
    const saved = order.map((id) => byId.get(id)).filter((section): section is SectionSpec => Boolean(section))
    const remaining = BASE_SECTIONS.filter((section) => !order.includes(section.id))
    return [...saved, ...remaining].map((section) => (
      section.moduleId
        ? { ...section, title: moduleCopy(section.moduleId, language).title }
        : section
    ))
  }, [language, order])

  useEffect(() => {
    const spy = new IntersectionObserver(
      (entries) => {
        if (scrollAnchor.current) return
        const nextActive = firstIntersectingSection(entries)
        if (nextActive) setActive((current) => (current === nextActive ? current : nextActive))
      },
      // Observe a generous vertical band. The active section changes early
      // enough to mount the next lazy chunk before a fast touch/wheel fling
      // reaches it, while the negative bottom margin still avoids thrashing
      // on tiny intersections at the end of a section.
      { rootMargin: '-8% 0px -45% 0px' },
    )
    for (const section of sections) {
      const element = document.getElementById(section.id)
      if (!element) continue
      spy.observe(element)
    }
    return () => {
      spy.disconnect()
    }
  }, [sections.map((section) => section.id).join('|')])

  const acknowledgeSpecialistRequest = useCallback((token: number) => {
    setSpecialistAddRequest((current) => current?.token === token ? null : current)
  }, [])

  useEffect(() => {
    const openRequestedSection = (event: Event) => {
      const sectionId = (event as CustomEvent<unknown>).detail
      const target = typeof sectionId === 'string' ? sections.find((section) => section.id === sectionId) : undefined
      if (!target) return
      if (target.kind === 'events') {
        addRequestSequence.current += 1
        setSpecialistAddRequest({ sectionId: target.id, token: addRequestSequence.current })
        setSavedSummary(null)
        return
      }
      setOpenForm(target.id)
      setSavedSummary(null)
      try {
        if (window.sessionStorage.getItem('mhd.pending-add') === sectionId) window.sessionStorage.removeItem('mhd.pending-add')
      } catch {
        // Storage can be disabled; the event itself already opened the form.
      }
    }
    try {
      const pending = window.sessionStorage.getItem('mhd.pending-add')
      const pendingSection = pending ? sections.find((section) => section.id === pending) : undefined
      if (pendingSection) {
        if (pendingSection.kind === 'events') {
          addRequestSequence.current += 1
          setSpecialistAddRequest({ sectionId: pendingSection.id, token: addRequestSequence.current })
        } else setOpenForm(pendingSection.id)
        window.sessionStorage.removeItem('mhd.pending-add')
      }
    } catch {
      // Storage can be disabled.
    }
    window.addEventListener('mhd:open-add', openRequestedSection)
    return () => window.removeEventListener('mhd:open-add', openRequestedSection)
  }, [sections])

  useEffect(() => {
    const index = sections.findIndex((section) => section.id === active)
    if (index < 0) return
    if (scrollAnchor.current && scrollAnchor.current.id !== active) scrollAnchor.current = undefined
    // Keep only the local neighborhood mounted. This is the key difference
    // between content-visibility and real virtualization: heavy specialist
    // modules leave the DOM after the user has moved away from them.
    // Keep a slightly wider warm window than the visible neighborhood. This
    // prevents a fast wheel/touch fling from exposing two lazy fallbacks in a
    // row and gives the browser time to resolve the next chunk before paint.
    const start = Math.max(0, index - 2)
    const end = Math.min(sections.length, index + 3)
    const nearby = sections.slice(start, end).map((section) => section.id)
    setVisible((current) => {
      if (current.size === nearby.length && nearby.every((id) => current.has(id))) return current
      return new Set(nearby)
    })
    rail.current?.querySelector(`[data-section='${active}']`)?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [active, sections])

  useEffect(() => () => {
    for (const observer of sectionObservers.current.values()) observer.disconnect()
    sectionObservers.current.clear()
    sectionRefs.current.clear()
    if (sectionHeightFrame.current !== undefined) window.cancelAnimationFrame(sectionHeightFrame.current)
    sectionHeightFrame.current = undefined
    if (programmaticScrollFrame.current !== undefined) window.cancelAnimationFrame(programmaticScrollFrame.current)
    programmaticScrollFrame.current = undefined
    programmaticScroll.current = false
    pendingSectionHeights.current.clear()
    scrollAnchor.current = undefined
  }, [])

  useEffect(() => {
    const disarmOnManualInput = (event: Event) => {
      if (!shouldDisarmScrollAnchor(event, programmaticScroll.current)) return
      scrollAnchor.current = undefined
      if (event.type !== 'scroll') programmaticScroll.current = false
    }
    for (const eventType of SCROLL_ANCHOR_MANUAL_EVENTS) {
      window.addEventListener(eventType, disarmOnManualInput, { passive: true })
    }
    return () => {
      for (const eventType of SCROLL_ANCHOR_MANUAL_EVENTS) {
        window.removeEventListener(eventType, disarmOnManualInput)
      }
    }
  }, [])

  const armScrollAnchor = useCallback((id: string) => {
    const target = document.getElementById(id)
    const index = sections.findIndex((section) => section.id === id)
    if (!target || index < 0) return
    scrollAnchor.current = {
      id,
      top: target.getBoundingClientRect().top,
      precedingIds: new Set(sections.slice(0, index).map((section) => section.id)),
    }
  }, [sections])

  const preserveScrollAnchor = useCallback((changedSectionId: string) => {
    const anchor = scrollAnchor.current
    if (!anchor || !anchor.precedingIds.has(changedSectionId)) return
    const target = document.getElementById(anchor.id)
    if (!target) return
    const correction = scrollAnchorCompensation(anchor.top, target.getBoundingClientRect().top)
    if (correction === 0 || typeof window.scrollBy !== 'function') return
    try {
      // ResizeObserver fires after layout. Correct only the measured delta so
      // the direct-link target stays at the same viewport coordinate while a
      // nearby lazy section replaces its fallback.
      if (programmaticScrollFrame.current !== undefined) window.cancelAnimationFrame(programmaticScrollFrame.current)
      programmaticScroll.current = true
      window.scrollBy({ behavior: 'auto', left: 0, top: correction })
      programmaticScrollFrame.current = window.requestAnimationFrame(() => {
        programmaticScroll.current = false
        programmaticScrollFrame.current = undefined
      })
    } catch {
      // Embedded browsers may expose scrollBy but reject the options overload.
      programmaticScroll.current = false
      programmaticScrollFrame.current = undefined
    }
  }, [])

  const jumpToSection = useCallback((id: string) => {
    if (programmaticScrollFrame.current !== undefined) window.cancelAnimationFrame(programmaticScrollFrame.current)
    programmaticScroll.current = true
    scrollToSection(id, 'auto')
    armScrollAnchor(id)
    programmaticScrollFrame.current = window.requestAnimationFrame(() => {
      programmaticScroll.current = false
      programmaticScrollFrame.current = undefined
    })
  }, [armScrollAnchor])

  const selectSection = useCallback((id: string) => {
    setOnlyFavorites(false)
    setActive(id)
    setSectionMenuOpen(false)
    window.requestAnimationFrame(() => jumpToSection(id))
  }, [jumpToSection])

  const measureSection = useCallback((id: string, element: HTMLDivElement | null) => {
    sectionObservers.current.get(id)?.disconnect()
    sectionObservers.current.delete(id)
    if (!element) return

    // Keep a usable fallback for older embedded browsers without
    // ResizeObserver. The browser still paints the section normally, but the
    // measured height from a previous mount can preserve scroll position.
    if (typeof ResizeObserver === 'undefined') return

    const update = () => {
      preserveScrollAnchor(id)
      const height = Math.ceil(element.getBoundingClientRect().height)
      if (height <= 0) return
      pendingSectionHeights.current.set(id, height)
      if (sectionHeightFrame.current !== undefined) return
      sectionHeightFrame.current = window.requestAnimationFrame(() => {
        sectionHeightFrame.current = undefined
        const pending = pendingSectionHeights.current
        if (pending.size === 0) return
        setSectionHeights((current) => {
          let changed = false
          const next = { ...current }
          for (const [sectionId, sectionHeight] of pending) {
            if (next[sectionId] === sectionHeight) continue
            next[sectionId] = sectionHeight
            changed = true
          }
          pending.clear()
          return changed ? next : current
        })
      })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    sectionObservers.current.set(id, observer)
  }, [preserveScrollAnchor])

  const sectionRef = useCallback((id: string) => {
    const existing = sectionRefs.current.get(id)
    if (existing) return existing
    const callback = (element: HTMLDivElement | null) => measureSection(id, element)
    sectionRefs.current.set(id, callback)
    return callback
  }, [measureSection])

  useEffect(() => {
    if (!focusSection) return
    setOnlyFavorites(false)
    setActive(focusSection)
  }, [focusSection, sections])

  const focusSectionVisible = focusSection ? visible.has(focusSection) : false

  useEffect(() => {
    if (!focusSection || !focusSectionVisible) return
    // The active-section effect warms the target and its neighborhood first.
    // Align once after that render, then pin the measured target coordinate.
    // ResizeObserver applies only the delta from sections above the target as
    // their lazy bodies replace the fallback; the rest of the page stays
    // virtualized and does not render globally.
    const frame = window.requestAnimationFrame(() => {
      jumpToSection(focusSection)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusSection, focusSectionVisible, jumpToSection])

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
      writeFavorites(next)
      return next
    })
  }, [])

  const move = useCallback((id: string, direction: -1 | 1) => {
    const ids = sections.map((section) => section.id)
    const index = ids.indexOf(id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ids.length) return
    const next = [...ids]
    const moved = next[index] as string
    next[index] = next[target] as string
    next[target] = moved
    setOrder(next)
    writeOrder(next)
  }, [sections])

  return (
    <div className="scroll-data">
      <DataScrollNavigation
        active={active}
        language={language}
        onMove={move}
        onSelectSection={selectSection}
        onToggleMenu={() => setSectionMenuOpen((value) => !value)}
        onToggleReordering={() => setReordering((value) => !value)}
        railRef={setRail}
        reordering={reordering}
        sectionMenuOpen={sectionMenuOpen}
        sections={sections}
      />

      <MeasurementSaveContext.Provider value={data.saveMeasurement}>
      <div className="scroll-data__content">
        <div className="scroll-data__filters">
          <button
            aria-pressed={onlyFavorites}
            className="chip"
            onClick={() => setOnlyFavorites((value) => !value)}
            type="button"
          >
            <Star size={14} fill={onlyFavorites ? 'currentColor' : 'none'} />
            {language === 'it' ? 'Preferiti' : 'Favorites'}
          </button>
        </div>
        {onlyFavorites ? (
          <>
          <button className="btn btn--ghost btn--small" onClick={() => setOnlyFavorites(false)} type="button">
            {language === 'it' ? 'Mostra tutti i dati' : 'Show all data'}
          </button>
          <FavoritesGrid
            favorites={favorites}
            formatDate={formatDate}
            language={language}
            measurementLabel={measurementLabel}
            measurementUnit={measurementUnit}
            onToggleFavorite={toggleFavorite}
            sections={sections}
            snapshot={snapshot}
          />
          </>
        ) : null}
        {!onlyFavorites ? (
          <DataScrollSectionList
            data={data}
            favorites={favorites}
            formatDate={formatDate}
            language={language}
            measurementLabel={measurementLabel}
            measurementUnit={measurementUnit}
            onClearSavedSummary={() => setSavedSummary(null)}
            onCloseForm={() => setOpenForm('')}
            onOpenRequestHandled={acknowledgeSpecialistRequest}
            onSaved={(section, count) => setSavedSummary({ section, count })}
            onToggleFavorite={toggleFavorite}
            onToggleForm={(section) => {
              setSavedSummary(null)
              setOpenForm((current) => (current === section ? '' : section))
            }}
            openForm={openForm}
            savedSummary={savedSummary}
            sectionHeights={sectionHeights}
            sectionRef={sectionRef}
            sections={sections}
            snapshot={snapshot}
            specialistAddRequest={specialistAddRequest}
            visible={visible}
          />
        ) : null}
      </div>
      </MeasurementSaveContext.Provider>
    </div>
  )
}
import { MeasurementSaveContext } from './MeasurementHistory'
