import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronsLeft, Database, FileText, FolderOpen, HeartPulse, Home, Plus, RefreshCw, Ruler, Settings, Stethoscope } from 'lucide-react'
import { CommandPalette } from './components/CommandPalette'
import { moduleCopy } from './core/healthModules'
import type { AddTargetId, HealthModuleId } from './core/healthModules'
import { useHealthData } from './storage/useHealthData'
import { PRIMARY_TAB_IDS, useRoute } from './router'
import type { PrimaryTabId } from './router'
import { useI18n } from './i18n'
import { useTheme } from './theme'
/**
 * Route-level code splitting keeps the first paint light: the module views and
 * the 3D body model load only when the user opens them.
 */
const DataScrollPage = lazy(() => import('./pages/DataScrollPage').then((module) => ({ default: module.DataScrollPage })))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage').then((module) => ({ default: module.DocumentsPage })))
const ModuleDetailPage = lazy(() =>
  import('./pages/ModuleDetailPage').then((module) => ({ default: module.ModuleDetailPage })),
)
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))

function PageFallback() {
  return (
    <div aria-busy="true" className="panel" role="status">
      <p className="small-copy">MyHealthData…</p>
    </div>
  )
}

function dataErrorMessage(error: string, language: string): string {
  if (language === 'en') {
    if (error === 'conflict') return 'This data changed on another device. Your local copy is preserved: refresh and try again.'
    if (error === 'hub_unavailable') return 'The Hub is unavailable. Local data is still available; try again later.'
    if (error === 'hub_partial_sync_failed') return 'Some sections could not be refreshed from the Hub. Other sections remain available; retry to sync the missing data.'
    if (error === 'record_not_owned') return 'This data belongs to another synchronized source. Your local copy was not overwritten.'
    if (error === 'record_not_found') return 'This data no longer exists on the Hub. Refresh to realign this screen.'
    return 'The operation could not be completed. Your local data is safe; try again.'
  }
  if (error === 'conflict') return 'Il dato è cambiato su un altro dispositivo. La copia locale è stata preservata: aggiorna e riprova.'
  if (error === 'hub_unavailable') return 'Il Hub non è raggiungibile. I dati locali restano disponibili e puoi riprovare più tardi.'
  if (error === 'hub_partial_sync_failed') return 'Alcune sezioni non sono state aggiornate dal Hub. Le altre restano disponibili; riprova per sincronizzare i dati mancanti.'
  if (error === 'record_not_owned') return 'Questo dato appartiene a un’altra sorgente sincronizzata. La copia locale non è stata sovrascritta.'
  if (error === 'record_not_found') return 'Il dato non esiste più sul Hub. Aggiorna per riallineare questa schermata.'
  return 'Operazione non riuscita. I dati locali sono al sicuro: riprova.'
}

function SyncStatusNotice({
  language,
  pendingCount,
  failedCount,
  onRetry,
}: {
  language: string
  pendingCount: number
  failedCount: number
  onRetry: () => void
}) {
  if (pendingCount === 0) return null
  const retrying = failedCount > 0
  return (
    <div aria-live="polite" className={`banner ${retrying ? 'banner--error' : 'banner--info'}`} role={retrying ? 'alert' : 'status'}>
      <span>
        {retrying
          ? (language === 'it'
            ? `${failedCount} ${failedCount === 1 ? 'elemento richiede' : 'elementi richiedono'} un nuovo tentativo di sincronizzazione.`
            : `${failedCount} ${failedCount === 1 ? 'item needs' : 'items need'} a synchronization retry.`)
          : (language === 'it'
            ? `${pendingCount} ${pendingCount === 1 ? 'elemento è' : 'elementi sono'} in attesa di sincronizzazione.`
            : `${pendingCount} ${pendingCount === 1 ? 'item is' : 'items are'} waiting to sync.`)}
      </span>
      {retrying ? (
        <button className="btn btn--ghost btn--small" onClick={onRetry} type="button">
          <RefreshCw size={14} />
          {language === 'it' ? 'Riprova' : 'Try again'}
        </button>
      ) : null}
    </div>
  )
}

interface NewEntry {
  id: AddTargetId
  label: string
  icon: typeof Home
}

const UNIFIED_SECTION_BY_MODULE: Partial<Record<HealthModuleId, string>> = {
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

function NewMenu({ language, onOpenModule }: { language: string; onOpenModule: (id: AddTargetId) => void }) {
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const entries: NewEntry[] = [
    { id: 'body', label: language === 'it' ? 'Evento corporeo' : 'Body event', icon: HeartPulse },
    { id: 'bodyMeasurements', label: language === 'it' ? 'Misura' : 'Measurement', icon: Ruler },
    { id: 'documents', label: language === 'it' ? 'Documento' : 'Document', icon: FileText },
    { id: 'visits', label: language === 'it' ? 'Appuntamento' : 'Appointment', icon: Stethoscope },
  ]

  return (
    <div className="new-menu" ref={container}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="btn btn--primary btn--small"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Plus size={16} />
        {language === 'it' ? 'Nuovo' : 'New'}
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="menu-panel" role="menu">
          {entries.map((entry) => {
            const Icon = entry.icon
            return (
              <button
                className="menu-item"
                key={entry.id}
                onClick={() => {
                  setOpen(false)
                  onOpenModule(entry.id)
                }}
                role="menuitem"
                type="button"
              >
                <Icon size={16} />
                {entry.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function rememberPendingAdd(kind: string): void {
  try {
    window.sessionStorage.setItem('mhd.pending-add', kind)
  } catch {
    // Storage can be disabled; the dispatched event remains the fast path.
  }
}

const TAB_ICONS: Record<PrimaryTabId, typeof Home> = {
  data: Database,
  documents: FolderOpen,
  calendar: CalendarDays,
  settings: Settings,
}

export default function App() {
  const { t, language } = useI18n()
  const { route, navigate, back } = useRoute()
  const data = useHealthData()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.localStorage.getItem('mhd.sidebar') === 'collapsed')
  const [theme, setTheme] = useTheme()

  useEffect(() => {
    const main = document.getElementById('main')
    main?.focus({ preventScroll: true })
  }, [route.tab])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((value) => {
      const next = !value
      window.localStorage.setItem('mhd.sidebar', next ? 'collapsed' : 'expanded')
      return next
    })
  }, [])

  const openModule = useCallback((moduleId: AddTargetId) => {
    if (moduleId === 'documents') {
      rememberPendingAdd('documents')
      navigate({ tab: 'documents' })
      window.setTimeout(() => window.dispatchEvent(new Event('mhd:open-add')), 0)
      return
    }
    if (moduleId === 'visits') {
      rememberPendingAdd('appointment')
      navigate({ tab: 'calendar' })
      window.setTimeout(() => window.dispatchEvent(new Event('mhd:open-appointment')), 0)
      return
    }
    const section = UNIFIED_SECTION_BY_MODULE[moduleId]
    if (section) {
      rememberPendingAdd(section)
      navigate({ tab: 'data', section })
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('mhd:open-add', { detail: section })), 0)
      return
    }
    navigate({ tab: 'modules', moduleId })
  }, [navigate])

  const openRoute = useCallback((hash: string) => {
    window.location.hash = hash.replace(/^#/, '')
  }, [])

  const tabs: Array<{ id: PrimaryTabId; label: string }> = PRIMARY_TAB_IDS.map((id) => ({
    id,
    label: t(`nav.${id}`),
  }))

  const title = useMemo(() => {
    if (route.tab === 'modules' && route.moduleId && UNIFIED_SECTION_BY_MODULE[route.moduleId]) {
      return t('nav.data')
    }
    if (route.tab === 'modules' && route.moduleId) {
      return moduleCopy(route.moduleId, language).title
    }
    return t(`nav.${route.tab}`)
  }, [language, route, t])

  const content = useMemo(() => {
    switch (route.tab) {
      case 'dashboard':
        return <DataScrollPage data={data} />
      case 'data':
        return <DataScrollPage data={data} focusSection={route.section} />
      case 'documents':
        return <DocumentsPage data={data} />
      case 'modules':
        return route.moduleId && UNIFIED_SECTION_BY_MODULE[route.moduleId] ? (
          <DataScrollPage data={data} focusSection={UNIFIED_SECTION_BY_MODULE[route.moduleId]} />
        ) : route.moduleId ? (
          <ModuleDetailPage data={data} moduleId={route.moduleId} onBack={back} />
        ) : <DataScrollPage data={data} />
      case 'calendar':
        return <CalendarPage data={data} />
      case 'settings':
        return (
          <SettingsPage
            data={data}
            onOpenSection={(section) => navigate({ tab: 'settings', section })}
            section={route.section}
            setTheme={setTheme}
            theme={theme}
          />
        )
      default:
        return null
    }
  }, [back, data, navigate, route, setTheme, theme])

  return (
    <>
      <a className="skip-link" href="#main">
        {t('app.skipToContent')}
      </a>
      <div className="app-shell" data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'}>
        <aside aria-label="MyHealthData" className="sidebar">
          <div className="brand">
            <span aria-hidden="true" className="brand-mark">
              <img alt="" src="/brand-mark.png?v=2" />
            </span>
            <span className="brand-copy">
              <span className="brand-name">MyHealthData</span>
              <span className="brand-subtitle">{t('app.tagline')}</span>
            </span>
          </div>

          <nav className="nav-list">
            {tabs.map((tab) => {
              const Icon = TAB_ICONS[tab.id]
              const active = route.tab === tab.id || (
                tab.id === 'data' &&
                route.tab === 'modules' &&
                route.moduleId !== undefined &&
                UNIFIED_SECTION_BY_MODULE[route.moduleId] !== undefined
              )
              return (
                <button
                  aria-current={active ? 'page' : undefined}
                  className="nav-item"
                  data-active={active}
                  key={tab.id}
                  onClick={() => navigate({ tab: tab.id })}
                  title={tab.label}
                  type="button"
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>

          <button
            aria-label={sidebarCollapsed ? 'Espandi' : 'Comprimi'}
            className="sidebar-toggle"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Espandi' : 'Comprimi'}
            type="button"
          >
            <ChevronsLeft size={16} />
            <span>{sidebarCollapsed ? 'Espandi' : 'Comprimi'}</span>
          </button>
        </aside>

        <main className="main-panel" id="main" tabIndex={-1}>
          <header className="topbar">
            <div className="topbar__titles">
              <h1>{title}</h1>
            </div>
            <div className="topbar__actions">
              <CommandPalette navigateTab={(tab) => navigate({ tab })} openModule={openModule} openRoute={openRoute} />
              <NewMenu language={language} onOpenModule={openModule} />
            </div>
          </header>

          {data.error ? (
            <div className="banner banner--error" role="alert">
              <span>{dataErrorMessage(data.error, language)}</span>
              <button className="btn btn--ghost btn--small" onClick={() => void data.refresh()} type="button">
                {language === 'it' ? 'Aggiorna' : 'Refresh'}
              </button>
            </div>
          ) : null}

          <SyncStatusNotice
            failedCount={data.syncStatus.failedCount}
            language={language}
            onRetry={() => void data.refresh().catch(() => undefined)}
            pendingCount={data.syncStatus.pendingCount}
          />

          <Suspense fallback={<PageFallback />}>{content}</Suspense>
        </main>
      </div>

      <nav aria-label="MyHealthData" className="bottom-tabs">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.id]
          return (
            <button
              aria-current={route.tab === tab.id ? 'page' : undefined}
              data-active={route.tab === tab.id}
              key={tab.id}
              onClick={() => navigate({ tab: tab.id })}
              type="button"
            >
              <Icon size={19} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
