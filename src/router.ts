import { useCallback, useEffect, useState } from 'react'
import { isHealthModuleId } from './core/healthModules'
import type { HealthModuleId } from './core/healthModules'

export type TabId = 'dashboard' | 'data' | 'documents' | 'modules' | 'calendar' | 'settings'
export type PrimaryTabId = 'data' | 'calendar' | 'documents' | 'settings'

/** The only tabs the product shell is allowed to render. Legacy tabs below
 * remain parse-only so old bookmarks can converge without resurfacing UI. */
export const PRIMARY_TAB_IDS = ['data', 'calendar', 'documents', 'settings'] as const satisfies readonly PrimaryTabId[]

export interface Route {
  tab: TabId
  moduleId?: HealthModuleId
  section?: string
}

const TABS: readonly TabId[] = ['dashboard', ...PRIMARY_TAB_IDS, 'modules']

const LEGACY_VIEW_MAP: Record<string, Route> = {
  dashboard: { tab: 'data' },
  data: { tab: 'data' },
  documents: { tab: 'documents' },
  visits: { tab: 'calendar' },
  appointments: { tab: 'calendar' },
  modules: { tab: 'data' },
  body: { tab: 'data', section: 'dolori' },
  timeline: { tab: 'data' },
  measurements: { tab: 'data', section: 'misure' },
  profile: { tab: 'settings', section: 'profile' },
  export: { tab: 'settings', section: 'data' },
  report: { tab: 'settings', section: 'report' },
  privacy: { tab: 'settings', section: 'privacy' },
  devices: { tab: 'settings', section: 'devices' },
}

const LEGACY_MODULE_SECTIONS: Record<string, string> = {
  body: 'dolori',
  bodyMeasurements: 'misure',
  heart: 'cuore',
  activity: 'movimento',
  sleep: 'sonno',
  nutrition: 'alimentazione',
  medications: 'farmaci',
  cycle: 'ciclo',
  gym: 'palestra',
  bloodwork: 'analisi',
  allergies: 'allergie',
  vision: 'vista',
  gutHealth: 'intestino',
  dental: 'denti',
  sexualHealth: 'sessuale',
}

/** Sections retired from the unified data stream keep old bookmarks useful. */
const RETIRED_DATA_SECTIONS: Record<string, Route> = {
  diabete: { tab: 'data', section: 'analisi' },
  respirazione: { tab: 'data', section: 'cuore' },
  visite: { tab: 'calendar' },
  appuntamenti: { tab: 'calendar' },
  documenti: { tab: 'documents' },
  diario: { tab: 'data', section: 'alimentazione' },
  idratazione: { tab: 'data', section: 'alimentazione' },
}

/** Retired module bookmarks remain readable, but never reopen a removed module page. */
const RETIRED_MODULES: Record<string, Route> = {
  diabetes: { tab: 'data', section: 'analisi' },
  diabete: { tab: 'data', section: 'analisi' },
  respiratory: { tab: 'data', section: 'cuore' },
  respirazione: { tab: 'data', section: 'cuore' },
  visits: { tab: 'calendar' },
  appuntamenti: { tab: 'calendar' },
  documents: { tab: 'documents' },
  documenti: { tab: 'documents' },
  diario: { tab: 'data', section: 'alimentazione' },
  hydration: { tab: 'data', section: 'alimentazione' },
}

export function routeToHash(route: Route): string {
  const segments: string[] = [route.tab]
  if (route.moduleId) {
    segments.push(route.moduleId)
  } else if (route.section) {
    segments.push(route.section)
  }
  return `#/${segments.join('/')}`
}

export function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, '')
  const [first, second] = cleaned.split('/')

  if (!first) {
    return { tab: 'data' }
  }

  if (!TABS.includes(first as TabId)) {
    return { tab: 'data' }
  }

  const tab = first as TabId
  if (tab === 'dashboard') {
    return { tab: 'data' }
  }
  if (!second) {
    if (tab === 'modules') return { tab: 'data' }
    return { tab }
  }

  if (tab === 'modules') {
    if (RETIRED_MODULES[second]) return RETIRED_MODULES[second]
    if (!isHealthModuleId(second)) return { tab: 'data' }
    if (LEGACY_MODULE_SECTIONS[second]) return { tab: 'data', section: LEGACY_MODULE_SECTIONS[second] }
    return { tab, moduleId: second }
  }

  if (tab === 'data') {
    if (RETIRED_DATA_SECTIONS[second]) return RETIRED_DATA_SECTIONS[second]
    return { tab, section: second }
  }

  if (tab === 'settings') {
    return { tab, section: second }
  }

  return { tab }
}

/** Reads the pre-router `?view=` links so existing bookmarks keep working. */
function routeFromQuery(): Route | undefined {
  const requested = new URLSearchParams(window.location.search).get('view')
  if (!requested) {
    return undefined
  }
  return LEGACY_VIEW_MAP[requested] ?? { tab: 'data' }
}

function currentRoute(): Route {
  if (window.location.hash.length > 1) {
    return parseHash(window.location.hash)
  }
  return routeFromQuery() ?? { tab: 'data' }
}

export function useRoute(): { route: Route; navigate: (route: Route) => void; back: () => void } {
  const [route, setRoute] = useState<Route>(() => currentRoute())

  useEffect(() => {
    const handleChange = () => {
      const next = currentRoute()
      if (window.location.hash.length > 1) {
        const canonicalHash = routeToHash(next)
        if (window.location.hash !== canonicalHash) {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${canonicalHash}`)
        }
      } else if (new URLSearchParams(window.location.search).has('view')) {
        const url = new URL(window.location.href)
        url.searchParams.delete('view')
        url.hash = routeToHash(next)
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
      }
      setRoute(next)
    }
    handleChange()
    window.addEventListener('hashchange', handleChange)
    return () => window.removeEventListener('hashchange', handleChange)
  }, [])

  const navigate = useCallback((next: Route) => {
    const target = routeToHash(next)
    if (window.location.hash === target) {
      setRoute(next)
      return
    }
    window.location.hash = target
  }, [])

  const back = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location.hash = routeToHash({ tab: 'data' })
    }
  }, [])

  return { route, navigate, back }
}
