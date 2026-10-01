import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ChevronDown, Coffee, Droplet, Settings, Wine } from 'lucide-react'
import { EntrySheet } from '../../components/EntrySheet'
import { createId } from '../../core/id'
import type { Measurement, MeasurementType } from '../../core/types'
import type { HealthDataController } from '../../storage/useHealthData'
import {
  DEFAULT_HYDRATION_GOALS,
  parseHydrationGoals,
  ringShare,
  serializeHydrationGoals,
  withDefaultGoals,
} from './hydrationGoals'
import type { HydrationGoals } from './hydrationGoals'
import { hydrationSummary } from './hydrationAmounts'
import './hydrationSection.css'

const DEFAULTS_KEY = 'mhd.quicklog'
const GOALS_KEY = 'mhd.hydration.goals'

type Kind = 'water' | 'caffeine' | 'alcohol'

interface QuickOption {
  id: string
  it: string
  en: string
  value: number
  unit: string
  type: MeasurementType
}

interface QuickDefaults {
  water: string
  caffeine: string
  alcohol: string
}

const OPTIONS: Record<Kind, QuickOption[]> = {
  water: [
    { id: 'water-250', it: 'Bicchiere 250 mL', en: 'Glass 250 mL', value: 250, unit: 'mL', type: 'dietary_water' },
    { id: 'water-500', it: 'Bottiglia 500 mL', en: 'Bottle 500 mL', value: 500, unit: 'mL', type: 'dietary_water' },
    { id: 'water-750', it: 'Borraccia 750 mL', en: 'Bottle 750 mL', value: 750, unit: 'mL', type: 'dietary_water' },
    { id: 'water-1000', it: 'Litro 1000 mL', en: 'Litre 1000 mL', value: 1000, unit: 'mL', type: 'dietary_water' },
  ],
  caffeine: [
    { id: 'coffee-espresso', it: 'Espresso', en: 'Espresso', value: 80, unit: 'mg', type: 'dietary_caffeine' },
    { id: 'coffee-cappuccino', it: 'Cappuccino', en: 'Cappuccino', value: 80, unit: 'mg', type: 'dietary_caffeine' },
    { id: 'coffee-americano', it: 'Americano', en: 'Americano', value: 120, unit: 'mg', type: 'dietary_caffeine' },
  ],
  alcohol: [
    { id: 'alcohol-wine', it: 'Vino', en: 'Wine', value: 1, unit: 'UA', type: 'alcohol_units' },
    { id: 'alcohol-beer', it: 'Birra', en: 'Beer', value: 1, unit: 'UA', type: 'alcohol_units' },
    { id: 'alcohol-long', it: 'Long drink', en: 'Long drink', value: 2, unit: 'UA', type: 'alcohol_units' },
    { id: 'alcohol-short', it: 'Short drink', en: 'Short drink', value: 1.5, unit: 'UA', type: 'alcohol_units' },
    { id: 'alcohol-shot', it: 'Shot', en: 'Shot', value: 1, unit: 'UA', type: 'alcohol_units' },
  ],
}

const DEFAULT_IDS: QuickDefaults = { water: 'water-250', caffeine: 'coffee-espresso', alcohol: 'alcohol-wine' }

const KIND_ORDER: Kind[] = ['water', 'caffeine', 'alcohol']

const KIND_ICON: Record<Kind, typeof Droplet> = { water: Droplet, caffeine: Coffee, alcohol: Wine }

const KIND_COLOR: Record<Kind, string> = { water: '#00ADB8', caffeine: '#A05A2C', alcohol: '#8A3FFC' }

function readDefaults(): QuickDefaults {
  try {
    const raw = window.localStorage.getItem(DEFAULTS_KEY)
    if (!raw) return DEFAULT_IDS
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const pick = (kind: Kind, fallback: string): string => {
      const value = parsed[kind]
      const exists = typeof value === 'string' && OPTIONS[kind].some((option) => option.id === value)
      return exists ? (value as string) : fallback
    }
    return {
      water: pick('water', DEFAULT_IDS.water),
      caffeine: pick('caffeine', DEFAULT_IDS.caffeine),
      alcohol: pick('alcohol', DEFAULT_IDS.alcohol),
    }
  } catch {
    return DEFAULT_IDS
  }
}

function writeDefaults(value: QuickDefaults): void {
  try {
    window.localStorage.setItem(DEFAULTS_KEY, JSON.stringify(value))
  } catch {
    /* storage disabled: defaults only live in memory */
  }
}

function readGoals(): Partial<HydrationGoals> | undefined {
  try {
    return parseHydrationGoals(window.localStorage.getItem(GOALS_KEY))
  } catch {
    return undefined
  }
}

function optionFor(kind: Kind, id: string): QuickOption {
  return OPTIONS[kind].find((option) => option.id === id) ?? OPTIONS[kind][0] as QuickOption
}

function kindLabel(kind: Kind, it: boolean): string {
  if (kind === 'water') return it ? 'Acqua' : 'Water'
  if (kind === 'caffeine') return it ? 'Caffè' : 'Coffee'
  return it ? 'Alcol' : 'Alcohol'
}

function HydrationRing({ label, value, goal, unit, color, format }: {
  label: string
  value: number
  goal: number
  unit: string
  color: string
  format: Intl.NumberFormat
}) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const share = ringShare(value, goal)
  return (
    <div className="hydration-ring">
      <svg aria-label={`${label}: ${format.format(Math.round(value))} / ${format.format(Math.round(goal))} ${unit}`} height="56" role="img" viewBox="0 0 56 56" width="56">
        <circle cx="28" cy="28" fill="none" r={radius} stroke="color-mix(in srgb, currentColor 14%, transparent)" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          fill="none"
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - share)}
          strokeLinecap="round"
          strokeWidth="6"
          transform="rotate(-90 28 28)"
        />
      </svg>
      <span className="hydration-ring__value">
        {format.format(Math.round(value))} / {format.format(Math.round(goal))} {unit}
      </span>
      <span className="hydration-ring__label">{label} · {Math.round(share * 100)}%</span>
    </div>
  )
}

export function HydrationSection({ data, language, selectedDate }: { data: HealthDataController; language: string; selectedDate?: Date }) {
  const it = language !== 'en'
  const logInFlight = useRef(false)
  const day = selectedDate ?? new Date()
  const dateLabel = new Intl.DateTimeFormat(it ? 'it-IT' : 'en-US', { day: 'numeric', month: 'short' }).format(day)
  const t = (itText: string, enText: string) => (it ? itText : enText)
  const numberFormat = useMemo(() => new Intl.NumberFormat(it ? 'it-IT' : 'en-US', { maximumFractionDigits: 1 }), [it])
  const [defaults, setDefaults] = useState<QuickDefaults>(() => readDefaults())
  const [menu, setMenu] = useState<Kind | null>(null)
  const [settings, setSettings] = useState<Kind | null>(null)
  const [storedGoals, setStoredGoals] = useState<Partial<HydrationGoals> | undefined>(() => readGoals())
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [savingOptionId, setSavingOptionId] = useState<string | null>(null)
  const [pendingLog, setPendingLog] = useState<{ optionId: string; id: string } | null>(null)
  const [logError, setLogError] = useState<{ optionId: string; message: string } | null>(null)
  const [goalsDraft, setGoalsDraft] = useState<{ waterMl: string; alcoholUnitsPerWeek: string; caffeineMgPerDay: string }>({
    waterMl: '',
    alcoholUnitsPerWeek: '',
    caffeineMgPerDay: '',
  })

  const goals = withDefaultGoals(storedGoals)

  const counters = useMemo(() => hydrationSummary(data.measurements, day), [data.measurements, day.getTime()])

  const rings = [
    { key: 'water', label: `${t('Acqua', 'Water')} · ${dateLabel}`, value: counters.waterToday, goal: goals.waterMl, unit: 'mL' },
    { key: 'caffeine', label: `${t('Caffeina 7 giorni', 'Caffeine 7 days')} · ${dateLabel}`, value: counters.caffeineWeek, goal: goals.caffeineMgPerDay * 7, unit: 'mg' },
    { key: 'alcohol', label: `${t('Alcol 7 giorni', 'Alcohol 7 days')} · ${dateLabel}`, value: counters.alcoholWeek, goal: goals.alcoholUnitsPerWeek, unit: 'UA' },
  ] as const

  const log = async (option: QuickOption): Promise<void> => {
    if (savingOptionId !== null || logInFlight.current) return
    const clock = new Date()
    const now = clock.toISOString()
    const recorded = new Date(day.getFullYear(), day.getMonth(), day.getDate(), clock.getHours(), clock.getMinutes(), clock.getSeconds())
    const measurement: Measurement = {
      id: pendingLog?.optionId === option.id ? pendingLog.id : createId('measurement'),
      type: option.type,
      value: option.value,
      unit: option.unit,
      measuredAt: recorded.toISOString(),
      createdAt: now,
    }
    logInFlight.current = true
    setSavingOptionId(option.id)
    setPendingLog({ optionId: option.id, id: measurement.id })
    setLogError(null)
    try {
      await data.saveMeasurement(measurement)
      setPendingLog(null)
      setLogError(null)
      setMenu(null)
    } catch {
      setLogError({ optionId: option.id, message: t('Non è stato possibile salvare. Riprova.', 'Could not save this entry. Try again.') })
    } finally {
      logInFlight.current = false
      setSavingOptionId(null)
    }
  }

  const saveDefault = (kind: Kind, optionId: string) => {
    const next = { ...defaults, [kind]: optionId }
    writeDefaults(next)
    setDefaults(next)
  }

  const openGoals = () => {
    setGoalsDraft({
      waterMl: String(Math.round(goals.waterMl)),
      alcoholUnitsPerWeek: String(goals.alcoholUnitsPerWeek),
      caffeineMgPerDay: String(goals.caffeineMgPerDay),
    })
    setGoalsOpen(true)
  }

  const saveGoals = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = parseHydrationGoals(JSON.stringify(goalsDraft)) ?? DEFAULT_HYDRATION_GOALS
    try {
      window.localStorage.setItem(GOALS_KEY, serializeHydrationGoals(withDefaultGoals(parsed)))
    } catch {
      /* storage disabled: goals only live in memory */
    }
    setStoredGoals(withDefaultGoals(parsed))
    setGoalsOpen(false)
  }

  return (
    <section className="hydration">
      <div className="hydration-head">
        <span className="hydration-head__label">{t('Obiettivi idratazione', 'Hydration goals')}</span>
        <button aria-label={t('Imposta obiettivi idratazione', 'Set hydration goals')} className="hydration-iconbtn" onClick={openGoals} type="button">
          <Settings size={14} />
        </button>
      </div>

      <div className="hydration-rings">
        {rings.map((ring) => (
          <HydrationRing color={KIND_COLOR[ring.key]} format={numberFormat} goal={ring.goal} key={ring.key} label={ring.label} unit={ring.unit} value={ring.value} />
        ))}
      </div>

      {storedGoals === undefined ? (
        <p className="hydration-hint">
          {t('Obiettivi predefiniti in uso: tocca l’ingranaggio per personalizzarli.', 'Using default goals: tap the gear to customize them.')}
        </p>
      ) : null}

      {counters.unsupported > 0 ? <p className="hydration-note" role="status">{t(`${counters.unsupported} misure escluse dai totali: controlla valore e unità.`, `${counters.unsupported} measurements excluded from totals: check values and units.`)}</p> : null}
      <p className="hydration-note">
        {t(
          'Le registrazioni rapide si riferiscono al giorno selezionato. Gli obiettivi sono personali e modificabili.',
          'Quick entries use the selected day. Goals are personal and editable.',
        )}
      </p>

      <div className="hydration-buttons">
        {KIND_ORDER.map((kind) => {
          const Icon = KIND_ICON[kind]
          const active = optionFor(kind, defaults[kind])
          return (
            <div className="hydration-tile" key={kind}>
              <button
                aria-busy={savingOptionId === active.id}
                className="hydration-log"
                disabled={savingOptionId !== null}
                onClick={() => void log(active)}
                type="button"
              >
                <span className="hydration-log__icon" data-kind={kind}>
                  <Icon aria-hidden="true" size={20} />
                </span>
                <span className="hydration-log__title">{kindLabel(kind, it)}</span>
                <span className="hydration-log__meta">
                  {it ? active.it : active.en} · {numberFormat.format(active.value)} {active.unit}
                </span>
              </button>
              <div className="hydration-tile__controls">
                <button
                  aria-label={t(`Imposta predefinito ${kindLabel(kind, it)}`, `Set ${kindLabel(kind, it)} default`)}
                  className="hydration-tile__control"
                  onClick={() => setSettings(kind)}
                  type="button"
                >
                  <Settings size={14} />
                </button>
                <button
                  aria-expanded={menu === kind}
                  aria-label={t(`Altre opzioni ${kindLabel(kind, it)}`, `More ${kindLabel(kind, it)} options`)}
                  className="hydration-tile__control"
                  onClick={() => setMenu((current) => (current === kind ? null : kind))}
                  type="button"
                >
                  <ChevronDown size={15} />
                </button>
              </div>
              {menu === kind ? (
                <div className="hydration-menu" role="menu">
                  {OPTIONS[kind].map((option) => (
                    <button
                      className="hydration-menu__item"
                      disabled={savingOptionId !== null}
                      key={option.id}
                      onClick={() => void log(option)}
                      role="menuitem"
                      type="button"
                    >
                      <span>{it ? option.it : option.en}</span>
                      <small>{numberFormat.format(option.value)} {option.unit}</small>
                    </button>
                  ))}
                  {logError && OPTIONS[kind].some((option) => option.id === logError.optionId) ? <p aria-live="polite" className="hydration-menu__error" role="alert">{logError.message}</p> : null}
                </div>
              ) : null}
              {menu !== kind && logError && logError.optionId === active.id && savingOptionId === null ? <p aria-live="polite" className="hydration-tile__error" role="alert">{logError.message}</p> : null}
            </div>
          )
        })}
      </div>

      {settings ? (
        <EntrySheet
          onClose={() => setSettings(null)}
          title={t(`Predefinito · ${kindLabel(settings, it)}`, `Default · ${kindLabel(settings, it)}`)}
        >
          <DefaultForm
            defaults={defaults}
            it={it}
            kind={settings}
            onClose={() => setSettings(null)}
            onSave={saveDefault}
          />
        </EntrySheet>
      ) : null}

      {goalsOpen ? (
        <EntrySheet onClose={() => setGoalsOpen(false)} title={t('Obiettivi idratazione', 'Hydration goals')}>
          <form className="hydration-form" onSubmit={saveGoals}>
            <p className="hydration-form__hint">
              {t('Valori usati per riempire gli anelli.', 'Values used to fill the rings.')}
            </p>
            <div className="form-grid">
              <label>
                {t('Acqua al giorno (mL)', 'Water per day (mL)')}
                <input inputMode="decimal" onChange={(event) => setGoalsDraft((current) => ({ ...current, waterMl: event.target.value }))} value={goalsDraft.waterMl} />
              </label>
              <label>
                {t('Alcol a settimana (UA)', 'Alcohol per week (UA)')}
                <input inputMode="decimal" onChange={(event) => setGoalsDraft((current) => ({ ...current, alcoholUnitsPerWeek: event.target.value }))} value={goalsDraft.alcoholUnitsPerWeek} />
              </label>
              <label>
                {t('Caffeina al giorno (mg)', 'Caffeine per day (mg)')}
                <input inputMode="decimal" onChange={(event) => setGoalsDraft((current) => ({ ...current, caffeineMgPerDay: event.target.value }))} value={goalsDraft.caffeineMgPerDay} />
              </label>
            </div>
            <div className="hydration-form__actions">
              <button className="btn btn--ghost btn--small" onClick={() => setGoalsOpen(false)} type="button">
                {t('Annulla', 'Cancel')}
              </button>
              <button className="btn btn--primary btn--small" type="submit">
                {t('Salva obiettivi', 'Save goals')}
              </button>
            </div>
          </form>
        </EntrySheet>
      ) : null}
    </section>
  )
}

function DefaultForm({
  defaults,
  it,
  kind,
  onClose,
  onSave,
}: {
  defaults: QuickDefaults
  it: boolean
  kind: Kind
  onClose: () => void
  onSave: (kind: Kind, optionId: string) => void
}) {
  const t = (itText: string, enText: string) => (it ? itText : enText)
  const [selected, setSelected] = useState(defaults[kind])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSave(kind, selected)
    onClose()
  }

  return (
    <form className="hydration-form" onSubmit={submit}>
      <p className="hydration-form__hint">
        {t('Scegli cosa registra il pulsante rapido.', 'Choose what the quick button records.')}
      </p>
      <div className="hydration-form__options">
        {OPTIONS[kind].map((option) => (
          <label className="hydration-form__option" key={option.id}>
            <input
              checked={selected === option.id}
              name="hydration-default"
              onChange={() => setSelected(option.id)}
              type="radio"
            />
            <span>{it ? option.it : option.en}</span>
            <small>{option.value} {option.unit}</small>
          </label>
        ))}
      </div>
      <div className="hydration-form__actions">
        <button className="btn btn--ghost btn--small" onClick={onClose} type="button">
          {t('Annulla', 'Cancel')}
        </button>
        <button className="btn btn--primary btn--small" type="submit">
          {t('Salva', 'Save')}
        </button>
      </div>
    </form>
  )
}
