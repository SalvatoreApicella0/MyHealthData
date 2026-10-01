import type { CSSProperties } from 'react'
import { Plus } from 'lucide-react'
import { getHealthModule } from '../core/healthModules'
import type { I18nController } from '../i18n'
import { EntrySheet } from '../components/EntrySheet'
import type { HealthDataController } from '../storage/useHealthData'
import { InlineAdd } from './InlineAdd'
import { SectionBody } from './DataScrollSectionBody'
import { DEFAULT_WINDOW_DAYS, type SectionSpec } from './dataScrollModel'

export interface DataScrollSavedSummary {
  section: string
  count: number
}

export interface DataScrollSectionListProps {
  data: HealthDataController
  favorites: string[]
  formatDate: I18nController['formatDate']
  language: string
  measurementLabel: I18nController['measurementLabel']
  measurementUnit: I18nController['measurementUnit']
  onClearSavedSummary: () => void
  onCloseForm: () => void
  onOpenRequestHandled: (token: number) => void
  onSaved: (section: string, count: number) => void
  onToggleFavorite: (id: string) => void
  onToggleForm: (section: string) => void
  openForm: string
  sectionHeights: Record<string, number>
  sectionRef: (id: string) => (element: HTMLDivElement | null) => void
  sections: SectionSpec[]
  snapshot: Record<string, unknown>
  specialistAddRequest: { sectionId: string; token: number } | null
  savedSummary: DataScrollSavedSummary | null
  visible: ReadonlySet<string>
}

export function DataScrollSectionList({
  data,
  favorites,
  formatDate,
  language,
  measurementLabel,
  measurementUnit,
  onClearSavedSummary,
  onCloseForm,
  onOpenRequestHandled,
  onSaved,
  onToggleFavorite,
  onToggleForm,
  openForm,
  sectionHeights,
  sectionRef,
  sections,
  snapshot,
  specialistAddRequest,
  savedSummary,
  visible,
}: DataScrollSectionListProps) {
  return (
    <>
      {sections.map((section) => {
        const module = section.moduleId ? getHealthModule(section.moduleId) : undefined
        const Icon = module?.icon
        const canAdd = (
          (section.kind === 'measurements' && section.id !== 'sonno')
          || section.id === 'sonno'
          || section.id === 'ciclo'
        )
        return (
          <section className="scroll-data__section" id={section.id} key={section.id}>
            <header className="scroll-data__head">
              <h2>
                {Icon ? (
                  <span className="scroll-data__head-icon" style={{ '--tint': module?.tint } as CSSProperties}>
                    <Icon aria-hidden="true" size={16} />
                  </span>
                ) : null}
                {section.title}
              </h2>
              {canAdd ? (
                <button
                  className="scroll-data__open"
                  onClick={() => {
                    onClearSavedSummary()
                    onToggleForm(section.id)
                  }}
                  type="button"
                >
                  <Plus size={15} />
                  {language === 'it' ? 'Aggiungi' : 'Add'}
                </button>
              ) : null}
            </header>
            {savedSummary?.section === section.id ? (
              <p className="scroll-data__saved">
                {language === 'it'
                  ? `${savedSummary.count} ${savedSummary.count === 1 ? 'valore salvato' : 'valori salvati'}.`
                  : `${savedSummary.count} ${savedSummary.count === 1 ? 'value' : 'values'} saved.`}
              </p>
            ) : null}
            {openForm === section.id && section.kind !== 'events' ? (
              <EntrySheet
                onClose={onCloseForm}
                title={language === 'it' ? `Aggiungi · ${section.title}` : `Add · ${section.title}`}
              >
                <InlineAdd
                  data={data}
                  language={language}
                  measurementLabel={measurementLabel}
                  measurementUnit={measurementUnit}
                  onDone={onCloseForm}
                  onSaved={(count) => onSaved(section.id, count)}
                  section={section}
                />
              </EntrySheet>
            ) : null}
            <div
              className="scroll-data__section-body"
              ref={sectionRef(section.id)}
              style={!visible.has(section.id) && sectionHeights[section.id]
                ? { minHeight: `${sectionHeights[section.id]}px` }
                : undefined}
            >
              {visible.has(section.id) ? (
                <SectionBody
                  data={data}
                  favorites={favorites}
                  formatDate={formatDate}
                  language={language}
                  measurementLabel={measurementLabel}
                  measurementUnit={measurementUnit}
                  onToggleFavorite={onToggleFavorite}
                  openRequest={specialistAddRequest?.sectionId === section.id ? specialistAddRequest.token : undefined}
                  onOpenRequestHandled={onOpenRequestHandled}
                  section={section}
                  windowDays={section.windowDays ?? DEFAULT_WINDOW_DAYS}
                  snapshot={snapshot}
                />
              ) : (
                <div className="scroll-data__placeholder" />
              )}
            </div>
          </section>
        )
      })}
    </>
  )
}
