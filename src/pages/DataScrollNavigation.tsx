import { useState, type CSSProperties } from 'react'
import { ArrowDown, ArrowUp, ChevronDown } from 'lucide-react'
import { getHealthModule } from '../core/healthModules'
import type { SectionSpec } from './dataScrollModel'

interface DataScrollNavigationProps {
  active: string
  language: string
  railRef: (element: HTMLElement | null) => void
  reordering: boolean
  sectionMenuOpen: boolean
  sections: SectionSpec[]
  onMove: (id: string, direction: -1 | 1) => void
  onSelectSection: (id: string) => void
  onToggleMenu: () => void
  onToggleReordering: () => void
}

export function DataScrollNavigation({
  active,
  language,
  railRef,
  reordering,
  sectionMenuOpen,
  sections,
  onMove,
  onSelectSection,
  onToggleMenu,
  onToggleReordering,
}: DataScrollNavigationProps) {
  const [query, setQuery] = useState('')
  const normalized = query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
  const matches = (section: SectionSpec) => section.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(normalized)
  const activeSection = sections.find((section) => section.id === active) ?? sections[0]

  return (
    <nav
      aria-label={language === 'it' ? 'Sezioni dati' : 'Data sections'}
      className="scroll-data__rail"
      data-open={sectionMenuOpen || reordering}
      ref={railRef}
    >
      <button
        aria-expanded={sectionMenuOpen || reordering}
        className="scroll-data__mobile-toggle"
        onClick={onToggleMenu}
        type="button"
      >
        <span className="scroll-data__mobile-toggle-label">{language === 'it' ? 'Sezione dati' : 'Data section'}</span>
        <span className="scroll-data__mobile-toggle-value">{activeSection?.title ?? (language === 'it' ? 'Dati' : 'Data')}</span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>
      <div className="scroll-data__rail-items">
        {!reordering ? (
          <label className="scroll-data__section-search">
            <span>{language === 'it' ? 'Trova una sezione' : 'Find a section'}</span>
            <input onChange={(event) => setQuery(event.target.value)} placeholder={language === 'it' ? 'Nome della sezione' : 'Section name'} type="search" value={query} />
          </label>
        ) : null}
        {!reordering && !sections.some(matches) ? (
          <div className="scroll-data__section-search">
            <p role="status">{language === 'it' ? 'Nessuna sezione trovata.' : 'No sections found.'}</p>
            <button className="btn btn--ghost btn--small" onClick={() => setQuery('')} type="button">{language === 'it' ? 'Mostra tutte' : 'Show all'}</button>
          </div>
        ) : null}
        <button
          aria-pressed={reordering}
          className="scroll-data__reorder"
          onClick={onToggleReordering}
          type="button"
        >
          {reordering ? (language === 'it' ? 'Fine' : 'Done') : (language === 'it' ? 'Riordina' : 'Reorder')}
        </button>
        {sections.map((section, index) => {
          if (!reordering && !matches(section)) return null
          const module = section.moduleId ? getHealthModule(section.moduleId) : undefined
          const Icon = module?.icon
          return (
            <div className="scroll-data__rail-item" key={section.id}>
              <button
                aria-controls={section.id}
                aria-current={active === section.id ? 'location' : undefined}
                className="scroll-data__dot"
                data-active={active === section.id}
                data-section={section.id}
                onClick={() => { setQuery(''); onSelectSection(section.id) }}
                title={section.title}
                type="button"
              >
                <span className="scroll-data__dot-mark" style={{ '--tint': module?.tint } as CSSProperties} />
                {Icon ? <Icon aria-hidden="true" className="scroll-data__dot-icon" size={15} /> : null}
                <span className="scroll-data__dot-label">{section.title}</span>
              </button>
              {reordering ? (
                <div className="scroll-data__moves">
                  <button disabled={index === 0} aria-label={`${language === 'it' ? 'Sposta su' : 'Move up'}: ${section.title}`} onClick={() => onMove(section.id, -1)} type="button"><ArrowUp size={12} /></button>
                  <button disabled={index === sections.length - 1} aria-label={`${language === 'it' ? 'Sposta giù' : 'Move down'}: ${section.title}`} onClick={() => onMove(section.id, 1)} type="button"><ArrowDown size={12} /></button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
