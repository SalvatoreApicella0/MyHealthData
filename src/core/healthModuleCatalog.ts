/**
 * Canonical module catalog.
 *
 * This file is a 1:1 translation of `HealthFeature` in
 * `apps/ios/MyHealthDataiOS/MyHealthDataiOS/Views/HealthFeatureCatalog.swift`
 * (title, subtitle, SF Symbol, tint, card artwork, destination and dashboard
 * membership). The Web app must not invent module names, icons or ordering:
 * `docs/hub/IOS_WEB_PARITY.md` makes the iOS catalog the single source.
 *
 * The iOS "tint" values are SwiftUI semantic colors; the hex values below are
 * the resolved sRGB equivalents used by the system palette.
 */

import {
  BedDouble,
  CalendarHeart,
  Dumbbell,
  Eye,
  FlaskConical,
  Footprints,
  Gauge,
  HardDriveDownload,
  HeartHandshake,
  HeartPulse,
  PersonStanding,
  Pill,
  Ruler,
  Share2,
  Soup,
  Sparkles,
  Utensils,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type CanonicalHealthModuleId =
  | 'body'
  | 'cycle'
  | 'sexualHealth'
  | 'allergies'
  | 'vision'
  | 'gutHealth'
  | 'dental'
  | 'sleep'
  | 'heart'
  | 'activity'
  | 'gym'
  | 'bodyMeasurements'
  | 'nutrition'
  | 'medications'
  | 'bloodwork'
  | 'trends'
  | 'backupSync'
  | 'shareForCare'

/** Legacy identifier kept for compatible callers and old links. */
export type LegacyHealthModuleId = 'hydration'
export type HealthModuleId = CanonicalHealthModuleId | LegacyHealthModuleId

/**
 * Quick actions owned by top-level tabs, not by the unified health catalog.
 * Keeping them separate prevents Documents and Calendar from reappearing as
 * modules in menus, deep links, or module-level analytics.
 */
export type AddTargetId = HealthModuleId | 'documents' | 'visits'

/** Hydration data now belongs to the canonical nutrition/food-diary module. */
export const RETIRED_MODULE_REDIRECTS: Readonly<Record<LegacyHealthModuleId, CanonicalHealthModuleId>> = {
  hydration: 'nutrition',
}

export type MeasurementModuleId =
  | 'heart'
  | 'activity'
  | 'hydration'
  | 'nutrition'
  | 'bodyMeasurements'

export type CardStyle = 'photography' | 'glass'

export interface HealthModuleDefinition {
  id: CanonicalHealthModuleId
  titleKey: string
  subtitleKey: string
  /** SF Symbol name, kept for traceability with the iOS catalog. */
  symbol: string
  icon: LucideIcon
  tint: string
  cardImage: string
  /** Module is a metric dashboard driven by `MeasurementType` panels. */
  measurementModule?: MeasurementModuleId
  /** Dashboard membership (`HealthFeature.healthModules` in iOS). */
  onDashboard: boolean
}

/** iOS `HealthFeature.healthModules` membership, mirrored exactly. */
const NOT_ON_DASHBOARD: ReadonlySet<CanonicalHealthModuleId> = new Set<CanonicalHealthModuleId>([
  'backupSync',
  'shareForCare',
  'trends',
  'gym',
])

interface RawModule {
  id: CanonicalHealthModuleId
  it: [title: string, subtitle: string]
  en: [title: string, subtitle: string]
  symbol: string
  icon: LucideIcon
  tint: string
  image: string
  measurementModule?: MeasurementModuleId
}

/** Catalog in the exact `HealthFeature.allCases` order. */
const RAW_MODULES: RawModule[] = [
  {
    id: 'body',
    it: ['Dolori corporei', 'Sintomi su punti precisi'],
    en: ['Body pain', 'Symptoms on exact points'],
    symbol: 'figure.stand',
    icon: PersonStanding,
    tint: '#126E7A',
    image: 'ModuleBodyPain.jpg',
  },
  {
    id: 'cycle',
    it: ['Ciclo mestruale', 'Flusso, sintomi e diario'],
    en: ['Menstrual cycle', 'Flow, symptoms and diary'],
    symbol: 'calendar.circle.fill',
    icon: CalendarHeart,
    tint: '#FF2D55',
    image: 'ModuleCycle.jpg',
  },
  {
    id: 'sexualHealth',
    it: ['Salute sessuale', 'Attività, protezione e controlli'],
    en: ['Sexual health', 'Activity, protection and checks'],
    symbol: 'heart.circle.fill',
    icon: HeartHandshake,
    tint: '#FF2D55',
    image: 'ModuleSexualHealth.jpg',
  },
  {
    id: 'allergies',
    it: ['Allergie', 'Allergeni, reazioni e piano'],
    en: ['Allergies', 'Allergens, reactions and plan'],
    symbol: 'allergens.fill',
    icon: Sparkles,
    tint: '#FF9500',
    image: 'ModuleAllergies.jpg',
  },
  {
    id: 'vision',
    it: ['Vista', 'Occhiali e prescrizioni'],
    en: ['Vision', 'Glasses and prescriptions'],
    symbol: 'eyeglasses',
    icon: Eye,
    tint: '#007AFF',
    image: 'ModuleVision.jpg',
  },
  {
    id: 'gutHealth',
    it: ['Salute intestinale', 'Sintomi e regolarità'],
    en: ['Gut health', 'Symptoms and regularity'],
    symbol: 'fork.knife.circle.fill',
    icon: Soup,
    tint: '#34C759',
    image: 'ModuleGutHealth.jpg',
  },
  {
    id: 'dental',
    it: ['Denti', 'Igiene e trattamenti'],
    en: ['Dental', 'Hygiene and treatments'],
    symbol: 'mouth.fill',
    icon: Sparkles,
    tint: '#32ADE6',
    image: 'ModuleDental.jpg',
  },
  {
    id: 'sleep',
    it: ['Sonno', 'Durata e qualità'],
    en: ['Sleep', 'Duration and quality'],
    symbol: 'bed.double.fill',
    icon: BedDouble,
    tint: '#5856D6',
    image: 'ModuleSleep.jpg',
  },
  {
    id: 'heart',
    it: ['Cuore e respiro', 'Parametri vitali e recupero'],
    en: ['Heart and breathing', 'Vitals and recovery'],
    symbol: 'heart.fill',
    icon: HeartPulse,
    tint: '#FA4F6E',
    image: 'ModuleHeart.jpg',
    measurementModule: 'heart',
  },
  {
    id: 'activity',
    it: ['Movimento', 'Movimento e mobilità'],
    en: ['Movement', 'Movement and mobility'],
    symbol: 'figure.run',
    icon: Footprints,
    tint: '#2EC794',
    image: 'ModuleMovement.jpg',
    measurementModule: 'activity',
  },
  {
    id: 'gym',
    it: ['Palestra', 'Allenamenti, serie e volume muscolare'],
    en: ['Gym', 'Workouts, sets and muscle volume'],
    symbol: 'figure.strengthtraining.traditional',
    icon: Dumbbell,
    tint: '#FF9500',
    image: 'ModuleGym.jpg',
  },
  {
    id: 'bodyMeasurements',
    it: ['Misure corporee', 'Peso e circonferenze'],
    en: ['Body measurements', 'Weight and circumferences'],
    symbol: 'figure.arms.open',
    icon: Ruler,
    tint: '#007AFF',
    image: 'ModuleBodyMeasurements.jpg',
    measurementModule: 'bodyMeasurements',
  },
  {
    id: 'nutrition',
    it: ['Diario alimentare', 'Pasti ed energia'],
    en: ['Food diary', 'Meals and energy'],
    symbol: 'fork.knife',
    icon: Utensils,
    tint: '#34C759',
    image: 'ModuleNutrition.jpg',
    measurementModule: 'nutrition',
  },
  {
    id: 'medications',
    it: ['Farmaci', 'Terapie e programmi'],
    en: ['Medications', 'Therapies and schedules'],
    symbol: 'pills.fill',
    icon: Pill,
    tint: '#FF9500',
    image: 'ModuleMedications.jpg',
  },
  {
    id: 'bloodwork',
    it: ['Analisi', 'Valori e confronti'],
    en: ['Blood work', 'Values and comparisons'],
    symbol: 'testtube.2',
    icon: FlaskConical,
    tint: '#FF3B30',
    image: 'ModuleBloodwork.jpg',
  },
  {
    id: 'trends',
    it: ['Trend', 'Andamenti nel tempo'],
    en: ['Trends', 'Change over time'],
    symbol: 'chart.xyaxis.line',
    icon: Gauge,
    tint: '#34C759',
    image: 'ModuleMovement.jpg',
  },
  {
    id: 'backupSync',
    it: ['Backup', 'Esporta e ripristina'],
    en: ['Backup', 'Export and restore'],
    symbol: 'externaldrive.fill.badge.checkmark',
    icon: HardDriveDownload,
    tint: '#30B0C7',
    image: 'ModuleDocuments.jpg',
  },
  {
    id: 'shareForCare',
    it: ['Condividi', 'Scegli cosa inviare'],
    en: ['Share for care', 'Choose what to send'],
    symbol: 'square.and.arrow.up.fill',
    icon: Share2,
    tint: '#32ADE6',
    image: 'ModuleDocuments.jpg',
  },
]

export const HEALTH_MODULES: HealthModuleDefinition[] = RAW_MODULES.map((module) => ({
  id: module.id,
  titleKey: `module.${module.id}.title`,
  subtitleKey: `module.${module.id}.subtitle`,
  symbol: module.symbol,
  icon: module.icon,
  tint: module.tint,
  cardImage: `/modules/${module.image}`,
  measurementModule: module.measurementModule,
  onDashboard: !NOT_ON_DASHBOARD.has(module.id),
}))

export const DASHBOARD_MODULES: HealthModuleDefinition[] = HEALTH_MODULES.filter((module) => module.onDashboard)

const MODULE_BY_ID = new Map<CanonicalHealthModuleId, HealthModuleDefinition>(HEALTH_MODULES.map((module) => [module.id, module]))

export function resolveHealthModuleId(id: HealthModuleId): CanonicalHealthModuleId {
  return RETIRED_MODULE_REDIRECTS[id as LegacyHealthModuleId] ?? id as CanonicalHealthModuleId
}

export function getHealthModule(id: HealthModuleId): HealthModuleDefinition {
  const module = MODULE_BY_ID.get(resolveHealthModuleId(id))
  if (!module) {
    throw new Error(`Unknown health module: ${id}`)
  }
  return module
}

/** Localized module copy, mirroring the Italian strings in the iOS catalog. */
const MODULE_COPY: Record<CanonicalHealthModuleId, { it: [string, string]; en: [string, string] }> = RAW_MODULES.reduce(
  (accumulator, module) => {
    accumulator[module.id] = { it: module.it, en: module.en }
    return accumulator
  },
  {} as Record<CanonicalHealthModuleId, { it: [string, string]; en: [string, string] }>,
)

export function moduleCopy(id: HealthModuleId, language: 'it' | 'en'): { title: string; subtitle: string } {
  const copy = MODULE_COPY[resolveHealthModuleId(id)]
  return { title: copy[language][0], subtitle: copy[language][1] }
}

export function healthModuleIds(): CanonicalHealthModuleId[] {
  return HEALTH_MODULES.map((module) => module.id)
}

export function isHealthModuleId(value: string): value is CanonicalHealthModuleId {
  return MODULE_BY_ID.has(value as CanonicalHealthModuleId)
}
