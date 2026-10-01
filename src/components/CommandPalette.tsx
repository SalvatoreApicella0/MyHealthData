import { useEffect, useId, useMemo, useState } from 'react'
import { CalendarDays, Command, Database, FileText, HeartPulse, Home, Plus, Ruler, Search, Settings, Stethoscope } from 'lucide-react'
import { DASHBOARD_MODULES, moduleCopy } from '../core/healthModules'
import type { AddTargetId } from '../core/healthModules'
import { PRIMARY_TAB_IDS } from '../router'
import type { PrimaryTabId, TabId } from '../router'
import { useI18n } from '../i18n'
import { EntrySheet } from './EntrySheet'

interface CommandPaletteProps {
  navigateTab: (tab: TabId) => void
  openModule: (id: AddTargetId) => void
  openRoute: (hash: string) => void
}

type Entry = { id: string; label: string; hint?: string; icon: typeof Home; run: () => void }

export function CommandPalette({ navigateTab, openModule, openRoute }: CommandPaletteProps) {
  const { t, language } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listId = useId()

  const italian = language === 'it'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((value) => !value)
        setQuery('')
        setActiveIndex(0)
      }
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])


  const entries: Entry[] = useMemo(() => {
    const tabIcons: Record<PrimaryTabId, typeof Home> = {
      data: Database,
      calendar: CalendarDays,
      documents: FileText,
      settings: Settings,
    }
    const tabs: Array<{ id: PrimaryTabId; label: string; icon: typeof Home }> = PRIMARY_TAB_IDS.map((id) => ({
      id,
      label: t(`nav.${id}`),
      icon: tabIcons[id],
    }))
    return [
      ...tabs.map((tab) => ({
        id: `tab-${tab.id}`,
        label: tab.label,
        hint: italian ? 'Sezione' : 'Section',
        icon: tab.icon,
        run: () => navigateTab(tab.id),
      })),
      {
        id: 'new-body',
        label: italian ? 'Nuovo evento corporeo' : 'New body event',
        hint: italian ? 'Azione' : 'Action',
        icon: Plus,
        run: () => openModule('body'),
      },
      {
        id: 'new-measurement',
        label: italian ? 'Nuova misura' : 'New measurement',
        hint: italian ? 'Azione' : 'Action',
        icon: Ruler,
        run: () => openModule('bodyMeasurements'),
      },
      {
        id: 'new-document',
        label: italian ? 'Nuovo documento' : 'New document',
        hint: italian ? 'Azione' : 'Action',
        icon: FileText,
        run: () => openModule('documents'),
      },
      {
        id: 'new-appointment',
        label: italian ? 'Nuovo appuntamento' : 'New appointment',
        hint: italian ? 'Azione' : 'Action',
        icon: Stethoscope,
        run: () => openModule('visits'),
      },
      {
        id: 'devices',
        label: italian ? 'Dispositivi e QR' : 'Devices and QR',
        hint: italian ? 'Hub' : 'Hub',
        icon: HeartPulse,
        run: () => openRoute('#/settings/devices'),
      },
      ...[
        { id: 'data', it: 'Backup, importazione ed esportazione', en: 'Backup, import and export' },
        { id: 'profile', it: 'Profilo personale', en: 'Personal profile' },
        { id: 'report', it: 'Report dei dati', en: 'Data report' },
        { id: 'modules', it: 'Lingua', en: 'Language' },
        { id: 'privacy', it: 'Privacy', en: 'Privacy' },
      ].map((section) => ({
        id: `settings-${section.id}`,
        label: italian ? section.it : section.en,
        hint: italian ? 'Impostazioni' : 'Settings',
        icon: Settings,
        run: () => openRoute(`#/settings/${section.id}`),
      })),
      ...DASHBOARD_MODULES.map((module) => ({
        id: `module-${module.id}`,
        label: moduleCopy(module.id, language).title,
        hint: italian ? 'Modulo' : 'Module',
        icon: module.icon,
        run: () => openRoute(`#/modules/${module.id}`),
      })),
    ]
  }, [italian, language, navigateTab, openModule, openRoute, t])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return entries.slice(0, 10)
    return entries.filter((entry) => entry.label.toLowerCase().includes(needle)).slice(0, 12)
  }, [entries, query])

  useEffect(() => {
    if (open && filtered[activeIndex]) {
      document.getElementById(`${listId}-${filtered[activeIndex].id}`)?.scrollIntoView?.({ block: 'nearest' })
    }
  }, [open, activeIndex, filtered, listId])

  const run = (entry: Entry | undefined) => {
    if (!entry) return
    setOpen(false)
    entry.run()
  }

  return (
    <>
      <button
        aria-label={italian ? 'Cerca e vai' : 'Search and go'}
        className="command-trigger"
        onClick={() => { setQuery(''); setActiveIndex(0); setOpen(true) }}
        type="button"
      >
        <Search size={15} />
        <span>{italian ? 'Cerca' : 'Search'}</span>
        <kbd>⌘K</kbd>
      </button>
      {open ? (
        <EntrySheet onClose={() => setOpen(false)} title={italian ? 'Cerca e vai' : 'Search and go'}>
            <div className="command-input">
              <Command size={16} />
              <input
                aria-label={italian ? 'Cerca moduli e azioni' : 'Search modules and actions'}
                aria-autocomplete="list"
                aria-controls={listId}
                aria-expanded="true"
                aria-activedescendant={filtered[activeIndex] ? `${listId}-${filtered[activeIndex].id}` : undefined}
                role="combobox"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setActiveIndex((index) => Math.max(0, Math.min(index + 1, filtered.length - 1)))
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActiveIndex((index) => Math.max(index - 1, 0))
                  }
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    run(filtered[activeIndex])
                  }
                }}
                placeholder={italian ? 'Vai a un modulo o compi un’azione…' : 'Go to a module or run an action…'}
                value={query}
              />
            </div>
            <div aria-label={italian ? 'Risultati' : 'Results'} className="command-list" id={listId} role="listbox">
              {filtered.length === 0 ? (
                <p role="status" className="command-empty">{italian ? 'Nessun risultato.' : 'No results.'}</p>
              ) : (
                filtered.map((entry, index) => {
                  const Icon = entry.icon
                  return (
                    <button
                      aria-selected={index === activeIndex}
                      id={`${listId}-${entry.id}`}
                      role="option"
                      className="command-item"
                      data-active={index === activeIndex}
                      key={entry.id}
                      onClick={() => run(entry)}
                      onMouseEnter={() => setActiveIndex(index)}
                      type="button"
                    >
                      <Icon size={16} />
                      <span>{entry.label}</span>
                      {entry.hint ? <small>{entry.hint}</small> : null}
                    </button>
                  )
                })
              )}
            </div>
        </EntrySheet>
      ) : null}
    </>
  )
}
