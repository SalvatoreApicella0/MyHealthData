import { ProgressiveHistory } from '../../components/ProgressiveHistory'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarPlus, Droplets, Settings } from 'lucide-react'
import { EntrySheet } from '../../components/EntrySheet'
import { snapshotRecords } from '../../core/healthModules'
import { timeAgo } from '../../core/timeAgo'
import type { HealthDataController } from '../../storage/useHealthData'
import {
  computeForecast,
  parseEntries,
  parseSettings,
  periodDays,
  startOfDay,
  stripDays,
} from './cycleModel'
import type { CycleSettings } from './cycleModel'
import { COPY, CycleMarkForm, CycleSettingsForm, FLOW_LABELS, METHOD_LABELS, MOOD_LABELS } from './CycleForms'
import type { CycleRole } from './CycleForms'
import { CycleSparkline, Kpi, PhaseRing } from './CycleVisuals'
import './cycleSection.css'

export { validateCycleSettings } from './CycleForms'

const STRIP_DAYS = 35
const CYCLE_SETTINGS_KEY = 'mhd.cycle.settings'

function readStoredSettings(): CycleSettings | undefined {
  try {
    const raw = window.localStorage.getItem(CYCLE_SETTINGS_KEY)
    if (!raw) {
      return undefined
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined
    }
    return parseSettings(parsed)
  } catch {
    return undefined
  }
}

function persistSettings(settings: CycleSettings): void {
  try {
    window.localStorage.setItem(CYCLE_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage can be unavailable (private mode); the in-memory value still applies.
  }
}

function labelFor(map: Record<string, { it: string; en: string }>, value: string | undefined, language: 'it' | 'en'): string | undefined {
  if (!value) {
    return undefined
  }
  return map[value]?.[language] ?? value.replace(/_/g, ' ')
}

function methodLabel(value: string | undefined, language: 'it' | 'en'): string {
  if (!value) {
    return language === 'it' ? 'Nessuno' : 'None'
  }
  return METHOD_LABELS[value]?.[language] ?? value.replace(/_/g, ' ')
}

function shortDate(date: Date, language: 'it' | 'en'): string {
  return new Intl.DateTimeFormat(language === 'it' ? 'it-IT' : 'en-US', { day: 'numeric', month: 'short' }).format(date)
}

function longDate(date: Date, language: 'it' | 'en'): string {
  return new Intl.DateTimeFormat(language === 'it' ? 'it-IT' : 'en-US', { dateStyle: 'medium' }).format(date)
}

export function CycleSection({ data, language, openRequest, onOpenRequestHandled }: { data: HealthDataController; language: string; openRequest?: number; onOpenRequestHandled?: (token: number) => void }) {
  const lang: 'it' | 'en' = language === 'en' ? 'en' : 'it'
  const copy = COPY[lang]
  const snapshot = data as unknown as Record<string, unknown>
  const rawEntries = useMemo(() => snapshotRecords(snapshot, 'cycleEntries'), [data.cycleEntries])

  const [storedSettings, setStoredSettings] = useState<CycleSettings | undefined>(() => readStoredSettings())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [markOpen, setMarkOpen] = useState<{ role: CycleRole; flow?: string; existing?: Record<string, unknown> } | null>(null)
  const markBusy = useRef(false)

  useEffect(() => {
    if (openRequest === undefined) return
    setMarkOpen({ role: 'start' })
    onOpenRequestHandled?.(openRequest)
  }, [openRequest, onOpenRequestHandled])

  const entries = useMemo(() => parseEntries(rawEntries), [rawEntries])
  const settings = useMemo(
    () => storedSettings ?? parseSettings(data.cycleSettings),
    [storedSettings, data.cycleSettings],
  )

  const forecast = useMemo(() => computeForecast(entries, settings, startOfDay(new Date())), [entries, settings])

  const period = useMemo(() => periodDays(entries, forecast.starts), [entries, forecast.starts])
  const strip = useMemo(
    () => stripDays(startOfDay(new Date()), entries, period, forecast.fertileStart, forecast.fertileEnd, STRIP_DAYS),
    [entries, period, forecast.fertileStart, forecast.fertileEnd],
  )

  const phase = forecast.phase
  const fertileLine = (() => {
    if (!settings.showsFertileWindow) {
      return undefined
    }
    if (forecast.fertileToday) {
      return copy.fertileToday
    }
    if (forecast.upcomingFertileStart && forecast.upcomingFertileEnd) {
      return copy.fertileWindow(shortDate(forecast.upcomingFertileStart, lang), shortDate(forecast.upcomingFertileEnd, lang))
    }
    return undefined
  })()

  const countdown = (() => {
    if (forecast.daysUntilNext === undefined) {
      return undefined
    }
    if (forecast.daysUntilNext > 0) {
      return copy.nextCycleIn(forecast.daysUntilNext)
    }
    if (forecast.daysUntilNext === 0) {
      return copy.nextCycleToday
    }
    return copy.nextCycleLate(Math.abs(forecast.daysUntilNext))
  })()

  const regularity = forecast.variation === undefined
    ? copy.unknown
    : forecast.variation <= 4
      ? copy.regular
      : copy.variable

  const saveSettings = (next: CycleSettings) => {
    setStoredSettings(next)
    persistSettings(next)
    setSettingsOpen(false)
  }

  const saveEntry = async (record: Record<string, unknown>): Promise<void> => {
    await data.saveCanonicalRecord('cycleEntries', record)
    setMarkOpen(null)
  }

  return (
    <div className="cycle-section">
      <header className="cycle-head">
        <div className="cycle-head__actions">
          <button className="btn btn--ghost btn--small" onClick={() => setSettingsOpen(true)} type="button">
            <Settings aria-hidden="true" size={14} />
            {copy.settingsButton}
          </button>
          <button className="btn btn--ghost btn--small" onClick={() => setMarkOpen({ role: 'day', flow: 'medium' })} type="button">
            <Droplets aria-hidden="true" size={14} />
            {copy.markFlow}
          </button>
          <button className="btn btn--primary btn--small" onClick={() => setMarkOpen({ role: 'start' })} type="button">
            <CalendarPlus aria-hidden="true" size={14} />
            {copy.markStart}
          </button>
        </div>
      </header>

      {entries.length === 0 ? (
        <p className="empty-state cycle-empty">{copy.empty}</p>
      ) : !forecast.hasStart ? (
        <p className="empty-state cycle-empty">{copy.noStart}</p>
      ) : (
        <>
          <section className="cycle-hero" data-phase={phase ?? 'follicular'}>
            <PhaseRing
              cap={copy.cycleDayCap}
              day={forecast.cycleDay}
              label={`${copy.cycleDayCap} ${forecast.cycleDay ?? ''}, ${phase ? copy.phaseName[phase] : ''}`}
              phase={phase}
              phaseName={phase ? copy.phaseName[phase] : ''}
              forecast={forecast}
            />
            <div className="cycle-hero__copy">
              {countdown ? <p className="cycle-hero__countdown">{countdown}</p> : null}
              <p className="cycle-hero__estimate">{copy.estimateNote}</p>
              {fertileLine ? <p className="cycle-hero__fertile">{fertileLine}</p> : null}
              {phase ? <p className="cycle-phase-note">{copy.phaseNote[phase]}</p> : null}
            </div>
          </section>

          <div className="cycle-kpis">
            <Kpi
              label={copy.avgCycle}
              sub={forecast.variation !== undefined ? `${copy.variation} ±${forecast.variation} ${copy.days}` : undefined}
              unit={copy.days}
              value={forecast.average}
            />
            <Kpi label={copy.periodAvg} unit={copy.days} value={forecast.periodAverage} />
            <article className="cycle-kpi">
              <span className="cycle-kpi-label">{copy.lastCycle}</span>
              <p className="cycle-kpi-value">{forecast.lastStart ? shortDate(forecast.lastStart.date, lang) : copy.unit}</p>
              {forecast.lastStart ? <span className="cycle-kpi-delta">{timeAgo(forecast.lastStart.date.toISOString(), lang)}</span> : null}
            </article>
            <article className="cycle-kpi">
              <span className="cycle-kpi-label">{copy.regularity}</span>
              <p className="cycle-kpi-value cycle-kpi-value--text">{regularity}</p>
              {forecast.variation !== undefined ? <span className="cycle-kpi-delta">±{forecast.variation} {copy.days}</span> : null}
            </article>
          </div>

          <div className="cycle-strip-wrap">
            <div className="cycle-strip-head">
              <span className="cycle-strip-label">{copy.stripLabel}</span>
              <div className="cycle-legend">
                <span className="cycle-legend-item">
                  <span className="cycle-day" data-state="period" />{copy.legendPeriod}
                </span>
                {settings.showsFertileWindow ? (
                  <span className="cycle-legend-item">
                    <span className="cycle-day" data-state="fertile" />{copy.legendFertile}
                  </span>
                ) : null}
                <span className="cycle-legend-item">
                  <span className="cycle-day" data-state="logged" />{copy.legendLogged}
                </span>
              </div>
            </div>
            <div aria-label={copy.stripLabel} className="cycle-strip" role="img">
              {strip.map((day) => (
                <span className="cycle-day" data-state={day.state} key={day.key} title={shortDate(day.date, lang)} />
              ))}
            </div>
          </div>

          {forecast.symptoms.length > 0 || forecast.moods.length > 0 ? (
            <div className="cycle-summary">
              <span className="cycle-summary__title">{copy.recentCycle}</span>
              <div className="cycle-chips">
                {forecast.symptoms.map((symptom) => (
                  <span className="cycle-chip" key={`s-${symptom.label}`}>{symptom.label}</span>
                ))}
                {forecast.moods.map((mood) => (
                  <span className="cycle-chip cycle-chip--mood" key={`m-${mood.label}`}>
                    {labelFor(MOOD_LABELS, mood.label, lang) ?? mood.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <section className="cycle-history">
            <div className="cycle-history-head">
              <h3 className="cycle-subhead">{copy.historyTitle}</h3>
              <CycleSparkline
                label={copy.historyTitle}
                lengths={forecast.cycleLengths}
              />
            </div>
            <ProgressiveHistory items={forecast.history} initialCount={6} language={language}>
              {(visible) => (
              <ul className="cycle-history-rows">
              {visible.map((item) => (
                <li className="cycle-history-row" key={item.id}>
                  <span className="cycle-history-date">{longDate(item.start, lang)}</span>
                  <span className="cycle-history-meta">
                    <span>{item.cycleLength !== undefined ? `${item.cycleLength} ${copy.days}` : copy.currentCycle}</span>
                    {item.periodLength !== undefined ? <span className="cycle-history-period">{item.periodLength} {copy.days}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
              )}
            </ProgressiveHistory>
          </section>
        </>
      )}

      {entries.length > 0 ? (
        <section className="cycle-history">
          <h3 className="cycle-subhead">{lang === 'it' ? 'Diario delle registrazioni' : 'Entry diary'}</h3>
          <ProgressiveHistory items={[...entries].reverse()} initialCount={5} language={lang}>
            {(visible) => <ul className="cycle-history-rows">
              {visible.map((entry) => <li className="cycle-history-row cycle-diary-row" key={entry.id}>
                <span className="cycle-history-date">{longDate(entry.date, lang)}</span>
                <span className="cycle-history-meta">
                  <span>{entry.isPeriodStart ? copy.roleStart : entry.isPeriodEnd ? copy.roleEnd : entry.isPeriodDay ? copy.roleDay : (lang === 'it' ? 'Registrazione' : 'Entry')}</span>
                  {entry.flow ? <span>{FLOW_LABELS[entry.flow]?.[lang] ?? entry.flow}</span> : null}
                  {entry.mood ? <span>{MOOD_LABELS[entry.mood]?.[lang] ?? entry.mood}</span> : null}
                  {entry.note ? <span>{entry.note}</span> : null}
                </span>
                <button aria-label={`${lang === 'it' ? 'Modifica registrazione' : 'Edit entry'}: ${longDate(entry.date, lang)}`} className="btn btn--ghost btn--small" onClick={() => {
                  const existing = rawEntries.find((record) => record.id === entry.id)
                  if (existing) setMarkOpen({ role: entry.isPeriodStart ? 'start' : entry.isPeriodEnd ? 'end' : 'day', flow: entry.flow, existing })
                }} type="button">{lang === 'it' ? 'Modifica' : 'Edit'}</button>
              </li>)}
            </ul>}
          </ProgressiveHistory>
        </section>
      ) : null}

      {settings.isConfigured ? (
        <p className="cycle-settings">
          {copy.settingsLine(
            String(settings.typicalCycleLength ?? copy.unit),
            String(settings.typicalPeriodLength ?? copy.unit),
            methodLabel(settings.predictionMethod, lang),
          )}
        </p>
      ) : null}

      {settingsOpen ? (
        <EntrySheet title={copy.settingsTitle} onClose={() => setSettingsOpen(false)}>
          <CycleSettingsForm
            language={lang}
            onClose={() => setSettingsOpen(false)}
            onSave={saveSettings}
            settings={settings}
          />
        </EntrySheet>
      ) : null}

      {markOpen ? (
        <EntrySheet
          title={markOpen.existing ? (lang === 'it' ? 'Modifica registrazione' : 'Edit entry') : markOpen.flow ? copy.markFlowTitle : copy.markStartTitle}
          onClose={() => { if (!markBusy.current) setMarkOpen(null) }}
        >
          <CycleMarkForm
            defaultFlow={markOpen.flow ?? ''}
            defaultRole={markOpen.role}
            existing={markOpen.existing}
            key={String(markOpen.existing?.id ?? 'new')}
            onBusyChange={(busy) => { markBusy.current = busy }}
            language={lang}
            onClose={() => setMarkOpen(null)}
            onSave={saveEntry}
          />
        </EntrySheet>
      ) : null}
    </div>
  )
}
