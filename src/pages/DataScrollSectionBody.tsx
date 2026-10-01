import { lazy, memo, Suspense, useMemo } from 'react'
import { CANONICAL_DOMAIN_SPECS } from '../core/canonicalDomains'
import { movementMeasurementSignature } from '../core/domainSignatures'
import { getHealthModule, moduleCopy, snapshotRecords } from '../core/healthModules'
import type { HealthModuleId } from '../core/healthModules'
import { formatValue } from '../core/metrics'
import type { MeasurementType } from '../core/types'
import { eventSubsetSignature } from '../core/eventSignatures'
import { measurementSubsetSignature } from '../core/measurementSignatures'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'
import {
  DEFAULT_WINDOW_DAYS,
  EVENT_TYPE_MODULES,
  displayTypesFor,
  measurementTypesFor,
  previewEvents,
  sortCanonicalRecords,
  type SectionSpec,
} from './dataScrollModel'
import { MetricTile, MetricTiers } from './DataScrollMetricViews'
import { BodyMeasurementsSection } from './DataScrollBodyMeasurements'
import { MovementSection } from './DataScrollMovementViews'

const BodyPainSection = lazy(() => import('./sections/BodyPainSection').then(({ BodyPainSection: Component }) => ({ default: Component })))
const CycleSection = lazy(() => import('./sections/CycleSection').then(({ CycleSection: Component }) => ({ default: Component })))
const GymSection = lazy(() => import('./sections/GymSection').then(({ GymSection: Component }) => ({ default: Component })))
const LabSection = lazy(() => import('./sections/LabSection').then(({ LabSection: Component }) => ({ default: Component })))
const MedicationsSection = lazy(() => import('./sections/MedicationsSection').then(({ MedicationsSection: Component }) => ({ default: Component })))
const NutritionSection = lazy(() => import('./sections/NutritionSection').then(({ NutritionSection: Component }) => ({ default: Component })))
const SleepSection = lazy(() => import('./sections/SleepSection').then(({ SleepSection: Component }) => ({ default: Component })))
const AllergiesSection = lazy(() => import('./sections/AllergiesSection').then(({ AllergiesSection: Component }) => ({ default: Component })))
const DentalSection = lazy(() => import('./sections/DentalSection').then(({ DentalSection: Component }) => ({ default: Component })))
const GutSection = lazy(() => import('./sections/GutSection').then(({ GutSection: Component }) => ({ default: Component })))
const SexualSection = lazy(() => import('./sections/SexualSection').then(({ SexualSection: Component }) => ({ default: Component })))
const VisionSection = lazy(() => import('./sections/VisionSection').then(({ VisionSection: Component }) => ({ default: Component })))

export interface SectionBodyProps {
  section: SectionSpec
  data: HealthDataController
  snapshot: Record<string, unknown>
  language: string
  favorites: string[]
  windowDays: number
  visibleTypes?: MeasurementType[]
  onToggleFavorite: (id: string) => void
  formatDate: ReturnType<typeof useI18n>['formatDate']
  measurementLabel: ReturnType<typeof useI18n>['measurementLabel']
  measurementUnit: ReturnType<typeof useI18n>['measurementUnit']
  openRequest?: number
  onOpenRequestHandled?: (token: number) => void
}


const EMPTY_TYPES: MeasurementType[] = []

const SectionBodyContent = function SectionBodyContent({ section, data, snapshot, language, favorites, windowDays, visibleTypes, onToggleFavorite, formatDate, measurementLabel, measurementUnit, openRequest, onOpenRequestHandled }: SectionBodyProps) {
  const module = section.moduleId ? getHealthModule(section.moduleId) : undefined
  const tint = module?.tint ?? '#126E7A'
  const kpiTypes = useMemo(
    () => (section.kind === 'measurements' ? (visibleTypes ?? displayTypesFor(section)) : EMPTY_TYPES),
    [section, visibleTypes],
  )
  const foodEntries = useMemo(() => {
    if (section.moduleId !== 'nutrition') return { log: [] as Array<Record<string, unknown>>, sorted: [] as Array<Record<string, unknown>> }
    const foodSpec = CANONICAL_DOMAIN_SPECS.foodLogEntries
    const log = snapshotRecords(snapshot, 'foodLogEntries')
    const sorted = [...log].sort((left, right) => (
      String(right[foodSpec?.dateField ?? 'date'] ?? '').localeCompare(String(left[foodSpec?.dateField ?? 'date'] ?? ''))
    ))
    return { log, sorted }
  }, [section.moduleId, snapshot])
  if (section.id === 'ciclo') return <CycleSection data={data} language={language} onOpenRequestHandled={onOpenRequestHandled} openRequest={openRequest} />
  if (section.id === 'sonno') return <SleepSection data={data} language={language} onOpenRequestHandled={onOpenRequestHandled} openRequest={openRequest} />
  if (section.id === 'farmaci') return <MedicationsSection data={data} language={language} />
  if (section.id === 'analisi') return <LabSection data={data} language={language} />
  if (section.id === 'dolori') return <BodyPainSection autoOpenRequest={openRequest} data={data} language={language} onOpenRequestHandled={onOpenRequestHandled} />
  if (section.id === 'palestra') return <GymSection data={data} language={language} />
  if (section.id === 'vista') return <VisionSection data={data} language={language} />
  if (section.id === 'denti') return <DentalSection autoOpenRequest={openRequest} data={data} language={language} onOpenRequestHandled={onOpenRequestHandled} />
  if (section.id === 'allergie') return <AllergiesSection data={data} language={language} />
  if (section.id === 'intestino') return <GutSection data={data} language={language} />
  if (section.id === 'sessuale') return <SexualSection data={data} language={language} />
  if (section.id === 'alimentazione') return <NutritionSection data={data} language={language} />

  if (section.kind === 'measurements') {
    const partition = visibleTypes === undefined
    const types = kpiTypes
    const foodSpec = CANONICAL_DOMAIN_SPECS.foodLogEntries
    if (section.id === 'misure') {
      return (
        <BodyMeasurementsSection
          data={data}
          favorites={favorites}
          formatValue={formatValue}
          language={language}
          measurementLabel={measurementLabel}
          measurementUnit={measurementUnit}
          onToggleFavorite={onToggleFavorite}
          snapshot={snapshot}
          visibleTypes={visibleTypes}
          windowDays={windowDays}
        />
      )
    }
    if (section.id === 'movimento' && partition) {
      return (
        <MovementSection
          favorites={favorites}
          language={language}
          measurementLabel={measurementLabel}
          measurementUnit={measurementUnit}
          onToggleFavorite={onToggleFavorite}
          measurements={data.measurements}
          tint={tint}
          windowDays={windowDays}
        />
      )
    }
    return (
      <>
        <MetricTiers
          favorites={favorites}
          language={language}
          measurementLabel={measurementLabel}
          measurementUnit={measurementUnit}
          onToggleFavorite={onToggleFavorite}
          partition={partition}
          snapshot={snapshot}
          tint={tint}
          types={types}
          windowDays={windowDays}
        />
        {section.moduleId === 'nutrition' ? <MacroRings language={language} log={foodEntries.log} /> : null}
        {foodEntries.sorted.length > 0 ? (
          <ul className="scroll-data__rows scroll-data__food">
            {foodEntries.sorted.slice(0, 3).map((record, index) => {
              const titleFields = foodSpec?.titleFields ?? ['description']
              const title = titleFields.map((field) => record[field]).find((entry) => typeof entry === 'string' && entry) as string | undefined
              return (
                <li className="scroll-data__row" key={String(record.id ?? index)}>
                  <span className="scroll-data__row-title">{title ?? (language === 'it' ? 'Pasto' : 'Meal')}</span>
                  <span className="scroll-data__row-date">{record[foodSpec?.dateField ?? 'date'] ? formatDate(String(record[foodSpec?.dateField ?? 'date']), { dateStyle: 'medium' }) : ''}</span>
                </li>
              )
            })}
          </ul>
        ) : null}
      </>
    )
  }

  if (section.kind === 'canonical' && section.domain) {
    const spec = CANONICAL_DOMAIN_SPECS[section.domain]
    const records: Array<Record<string, unknown>> = snapshotRecords(snapshot, section.domain)
    const dateField = spec?.dateField ?? 'date'
    // Keep the canonical list stable while unrelated domains update. The
    // snapshot parts comparator already prevents this component from being
    // rendered for those changes; this memo also avoids sorting the same
    // records again when only parent UI state changes.
    const sorted = useMemo(() => sortCanonicalRecords(records, dateField), [section.domain, records, dateField])
    if (sorted.length === 0) return <p className="scroll-data__empty">{language === 'it' ? 'Nessun dato.' : 'No data.'}</p>
    const episodeRows = (
      sorted.length > 0 ? <ul className="scroll-data__rows">
        {sorted.slice(0, 3).map((record, index) => {
          const titleFields = spec?.titleFields ?? ['title']
          const title = titleFields.map((field) => record[field]).find((value) => typeof value === 'string' && value) as string | undefined
          return (
            <li className="scroll-data__row" key={String(record.id ?? index)}>
              <span className="scroll-data__row-title">{title ?? moduleCopy(section.moduleId as HealthModuleId, language as 'it' | 'en').title}</span>
              <span className="scroll-data__row-date">{record[dateField] ? formatDate(String(record[dateField]), { dateStyle: 'medium' }) : ''}</span>
            </li>
          )
        })}
      </ul> : <p className="scroll-data__empty">{language === 'it' ? 'Nessun episodio.' : 'No episodes.'}</p>
    )
    return episodeRows
  }

  if (section.kind === 'events') {
    const eventType = section.moduleId ? EVENT_TYPE_MODULES[section.moduleId] : undefined
    const events = previewEvents(data.events, eventType)
    if (events.length === 0) return <p className="scroll-data__empty">{language === 'it' ? 'Nessun dato.' : 'No data.'}</p>
    return (
      <ul className="scroll-data__rows">
        {events.map((event) => (
          <li className="scroll-data__row" key={event.id}>
            <span className="scroll-data__row-title">{event.description || event.type}</span>
            <span className="scroll-data__row-meta">{eventMarkers(event).join(' · ')}</span>
            <span className="scroll-data__row-date">{formatDate(event.occurredAt, { dateStyle: 'medium' })}</span>
          </li>
        ))}
      </ul>
    )
  }

  return <p className="scroll-data__empty">{language === 'it' ? 'Nessun dato.' : 'No data.'}</p>
}

function sectionDataParts(section: SectionSpec, data: HealthDataController): unknown[] {
  switch (section.id) {
    case 'alimentazione':
      return [data.foodLogEntries, data.foodRecipes, measurementSubsetSignature(data.measurements, measurementTypesFor(section)), data.profile]
    case 'sonno':
      return [data.sleepSessions, data.sleepSettings, measurementSubsetSignature(data.measurements, ['sleep_hours'])]
    case 'farmaci':
      return [data.medications, data.medicationDoseEvents]
    case 'ciclo':
      return [data.cycleEntries, data.cycleSettings]
    case 'palestra':
      return [data.gymPlans, data.gymWorkouts]
    case 'analisi':
      // HealthKit and older imports store glucose in measurements. LabSection
      // presents that legacy stream alongside canonical blood-test results.
      return [data.labResults, measurementSubsetSignature(data.measurements, ['blood_glucose'])]
    case 'dolori':
      return [eventSubsetSignature(data.events, ['pain', 'discomfort', 'burning', 'swelling', 'stiffness', 'tingling', 'wound'])]
    case 'allergie':
      return [eventSubsetSignature(data.events, ['allergy'])]
    case 'vista':
      return [eventSubsetSignature(data.events, ['vision_prescription'])]
    case 'intestino':
      return [eventSubsetSignature(data.events, ['digestive_health'])]
    case 'denti':
      return [eventSubsetSignature(data.events, ['dental_care'])]
    case 'sessuale':
      return [eventSubsetSignature(data.events, ['sexual_activity', 'masturbation'])]
    case 'movimento':
      return [movementMeasurementSignature(data.measurements)]
    default:
      if (section.kind === 'measurements') {
        return [measurementSubsetSignature(data.measurements, measurementTypesFor(section))]
      }
      if (section.kind === 'events') return [data.events]
      return [data.events, data.measurements]
  }
}

function areSectionBodyPropsEqual(previous: SectionBodyProps, next: SectionBodyProps): boolean {
  if (previous.section !== next.section || previous.language !== next.language) return false
  if (previous.windowDays !== next.windowDays || previous.visibleTypes !== next.visibleTypes) return false
  if (previous.openRequest !== next.openRequest) return false
  // Only metric sections render favorite controls. Event/canonical/document
  // modules can stay mounted and memoized when a favorite changes elsewhere.
  if (previous.section.kind === 'measurements' && (previous.favorites !== next.favorites || previous.onToggleFavorite !== next.onToggleFavorite)) return false
  const previousParts = sectionDataParts(previous.section, previous.data)
  const nextParts = sectionDataParts(next.section, next.data)
  return previousParts.length === nextParts.length && previousParts.every((part, index) => Object.is(part, nextParts[index]))
}

export const SectionBody = memo(function SectionBody(props: SectionBodyProps) {
  return (
    <Suspense fallback={<div aria-busy="true" className="scroll-data__section-loading" role="status">{props.language === 'it' ? 'Caricamento sezione…' : 'Loading section…'}</div>}>
      <SectionBodyContent {...props} />
    </Suspense>
  )
}, areSectionBodyPropsEqual)

export function FavoritesGrid({ favorites, formatDate, language, measurementLabel, measurementUnit, onToggleFavorite, sections, snapshot }: {
  favorites: string[]
  formatDate: ReturnType<typeof useI18n>['formatDate']
  language: string
  measurementLabel: (rawValue: string) => string
  measurementUnit: (rawValue: string) => string
  onToggleFavorite: (id: string) => void
  sections: SectionSpec[]
  snapshot: Record<string, unknown>
}) {
  const types = useMemo(() => {
    const seen = new Set<string>()
    const list: Array<{ type: MeasurementType; tint: string; windowDays: number }> = []
    for (const section of sections) {
      const module = section.moduleId ? getHealthModule(section.moduleId) : undefined
      const windowDays = section.windowDays ?? DEFAULT_WINDOW_DAYS
      for (const type of measurementTypesFor(section)) {
        const id = `measurement:${type}`
        if (!favorites.includes(id) || seen.has(type)) continue
        seen.add(type)
        list.push({ type, tint: module?.tint ?? '#126E7A', windowDays })
      }
    }
    return list
  }, [favorites, sections])

  const cards = types
  if (cards.length === 0) {
    return <p className="scroll-data__empty">{language === 'it' ? 'Nessun preferito: usa la stellina su una misura o un dato.' : 'No favorites yet: star a measurement or data item.'}</p>
  }
  return (
    <>
      {cards.length > 0 ? (
        <div className="scroll-data__kpis" data-dense={cards.length > 4} data-flat="true">
          {cards.map(({ type, tint, windowDays }) => (
            <MetricTile
              favorite
              key={type}
              language={language}
              measurementLabel={measurementLabel}
              measurementUnit={measurementUnit}
              onToggleFavorite={onToggleFavorite}
              snapshot={snapshot}
              tint={tint}
              type={type}
              windowDays={windowDays}
            />
          ))}
          <p className="scroll-data__empty">{formatDate(new Date(), { dateStyle: 'medium' })}</p>
        </div>
      ) : null}
    </>
  )
}

function eventMarkers(event: { tags?: string[]; description?: string; suspectedTrigger?: string; helpedBy?: string }): string[] {
  const markers: string[] = []
  for (const tag of event.tags ?? []) markers.push(tag.replace(/_/g, ' '))
  const text = [event.description, event.suspectedTrigger, event.helpedBy].filter(Boolean).join(' ')
  for (const match of text.matchAll(/([a-zA-Z_]+)=([^,|;\s]+)/g)) markers.push(`${(match[1] ?? '').replace(/_/g, ' ')} ${match[2] ?? ''}`)
  return markers.slice(0, 3)
}

function MacroRings({ log, language }: { log: Array<Record<string, unknown>>; language: string }) {
  const totals = { protein: 0, carbohydrates: 0, fat: 0 }
  for (const entry of log) {
    totals.protein += Number(entry.protein ?? 0) || 0
    totals.carbohydrates += Number(entry.carbohydrates ?? 0) || 0
    totals.fat += Number(entry.fat ?? 0) || 0
  }
  const energy = { protein: totals.protein * 4, carbohydrates: totals.carbohydrates * 4, fat: totals.fat * 9 }
  const sum = energy.protein + energy.carbohydrates + energy.fat
  if (sum <= 0) return null
  const rings: Array<{ key: keyof typeof totals; label: string; value: number; color: string }> = [
    { key: 'protein', label: language === 'it' ? 'Proteine' : 'Protein', value: Math.round(totals.protein), color: '#2EC794' },
    { key: 'carbohydrates', label: language === 'it' ? 'Carboidrati' : 'Carbs', value: Math.round(totals.carbohydrates), color: '#F7AB45' },
    { key: 'fat', label: language === 'it' ? 'Grassi' : 'Fat', value: Math.round(totals.fat), color: '#FA4F6E' },
  ]
  return (
    <div className="scroll-data__rings">
      {rings.map((ring) => {
        const share = energy[ring.key] / sum
        const radius = 22
        const circumference = 2 * Math.PI * radius
        return (
          <div className="scroll-data__ring" key={ring.key}>
            <svg height="56" viewBox="0 0 56 56" width="56">
              <circle cx="28" cy="28" fill="none" r={radius} stroke="color-mix(in srgb, currentColor 14%, transparent)" strokeWidth="6" />
              <circle
                cx="28"
                cy="28"
                fill="none"
                r={radius}
                stroke={ring.color}
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - share)}
                strokeLinecap="round"
                strokeWidth="6"
                transform="rotate(-90 28 28)"
              />
            </svg>
            <span className="scroll-data__ring-value">{ring.value}g</span>
            <span className="scroll-data__ring-label">{ring.label} · {Math.round(share * 100)}%</span>
          </div>
        )
      })}
    </div>
  )
}
