import { ProgressiveHistory } from '../../components/ProgressiveHistory'
import { useEffect, useMemo, useRef, useState } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import { createId } from '../../core/id'
import { fromDateTimeLocal, toDateTimeLocal } from '../../core/format'
import { snapshotRecords } from '../../core/healthModules'
import type { HealthDataController } from '../../storage/useHealthData'
import type { Measurement } from '../../core/types'
import './sleepSection.css'

interface SleepSectionProps {
  data: HealthDataController
  language: string
  openRequest?: number
  onOpenRequestHandled?: (token: number) => void
}

interface Night {
  id: string
  start: number
  end: number
  hours: number
  quality?: number
  awakenings?: number
  note?: string
  raw: Record<string, unknown>
}

const STAGE_LABELS: Record<string, { it: string; en: string }> = {
  deep: { it: 'Profondo', en: 'Deep' },
  rem: { it: 'REM', en: 'REM' },
  core: { it: 'Principale', en: 'Core' },
  asleep: { it: 'Non classificato', en: 'Unclassified' },
}

function toTime(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? undefined : time
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}

function formatDuration(hours: number): string {
  const totalMinutes = Math.max(Math.round(hours * 60), 0)
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, '0')}`
}

function formatDelta(minutes: number): string {
  const rounded = Math.round(minutes)
  return `${rounded >= 0 ? '+' : '−'}${Math.abs(rounded)} min`
}

export function validateSleepEntry(startAt: string, endAt: string, quality: string, awakenings: string): string | undefined {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (!startAt || !endAt || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'time'
  if (quality !== '' && (!Number.isInteger(Number(quality)) || Number(quality) < 1 || Number(quality) > 5)) return 'quality'
  if (awakenings !== '' && (!Number.isInteger(Number(awakenings)) || Number(awakenings) < 0)) return 'awakenings'
  return undefined
}

function bedtimeVariation(nights: Night[]): number | null {
  if (nights.length < 2) return null
  const bedtimes = nights.map((night) => {
    const date = new Date(night.start)
    const minutes = date.getHours() * 60 + date.getMinutes()
    return minutes < 720 ? minutes + 1440 : minutes
  })
  const mean = bedtimes.reduce((total, value) => total + value, 0) / bedtimes.length
  return Math.round(bedtimes.reduce((total, value) => total + Math.abs(value - mean), 0) / bedtimes.length)
}

function readings(data: HealthDataController): Night[] {
  const records = snapshotRecords(data as unknown as Record<string, unknown>, 'sleepSessions')
  const nights: Night[] = []
  for (const record of records) {
    const start = toTime(record.startAt ?? record.startDate)
    const end = toTime(record.endAt ?? record.endDate)
    if (start === undefined || end === undefined) continue
    nights.push({
      raw: record,
      id: String(record.id ?? `${start}`),
      start,
      end,
      hours: Math.max((end - start) / 3_600_000, 0),
      quality: toNumber(record.quality),
      awakenings: toNumber(record.awakenings),
      note: typeof record.note === 'string' && record.note.trim() !== '' ? record.note.trim() : undefined,
    })
  }
  return nights.sort((left, right) => right.start - left.start)
}

const STAGE_WINDOW_DAYS = 14

/** Average minutes per night for each stage over the recent window (not a lifetime total). */
export function stageAverages(measurements: readonly Measurement[], now = Date.now()): Map<string, number> {
  const sums = new Map<string, number>()
  const days = new Map<string, Set<string>>()
  const since = now - STAGE_WINDOW_DAYS * 86_400_000
  for (const measurement of measurements) {
    if (measurement.type !== 'sleep_hours' || typeof measurement.note !== 'string') continue
    if (new Date(measurement.measuredAt).getTime() < since) continue
    const marker = measurement.note.split('|').find((part) => part.startsWith('sleep_stage='))
    if (!marker) continue
    const stage = marker.slice('sleep_stage='.length).trim() || 'asleep'
    sums.set(stage, (sums.get(stage) ?? 0) + (Number(measurement.value) || 0) * 60)
    const day = measurement.measuredAt.slice(0, 10)
    const set = days.get(stage) ?? new Set<string>()
    set.add(day)
    days.set(stage, set)
  }
  const averages = new Map<string, number>()
  for (const [stage, total] of sums) {
    const count = Math.max(1, days.get(stage)?.size ?? 1)
    averages.set(stage, total / count)
  }
  return averages
}

export function SleepSection({ data, language, openRequest, onOpenRequestHandled }: SleepSectionProps) {
  const t = (it: string, en: string) => (language === 'it' ? it : en)
  const [addOpen, setAddOpen] = useState(false)
  const [startAt, setStartAt] = useState(() => toDateTimeLocal(new Date(Date.now() - 8 * 60 * 60_000).toISOString()))
  const [endAt, setEndAt] = useState(() => toDateTimeLocal(new Date().toISOString()))
  const [quality, setQuality] = useState('')
  const [awakenings, setAwakenings] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Record<string, unknown>>()
  const [recordId, setRecordId] = useState(() => createId('sleep'))
  const openNew = () => {
    setEditing(undefined)
    setRecordId(createId('sleep'))
    setStartAt(toDateTimeLocal(new Date(Date.now() - 8 * 60 * 60_000).toISOString()))
    setEndAt(toDateTimeLocal(new Date().toISOString()))
    setQuality(''); setAwakenings(''); setNote(''); setError('')
    setAddOpen(true)
  }
  const openEdit = (night: Night) => {
    setEditing(night.raw)
    setRecordId(night.id)
    setStartAt(toDateTimeLocal(new Date(night.start).toISOString()))
    setEndAt(toDateTimeLocal(new Date(night.end).toISOString()))
    setQuality(night.quality === undefined ? '' : String(night.quality))
    setAwakenings(night.awakenings === undefined ? '' : String(night.awakenings))
    setNote(night.note ?? ''); setError(''); setAddOpen(true)
  }

  useEffect(() => {
    if (openRequest === undefined) return
    openNew()
    onOpenRequestHandled?.(openRequest)
  }, [openRequest, onOpenRequestHandled])

  const nights = useMemo(() => readings(data), [data.sleepSessions])
  const stages = useMemo(() => stageAverages(data.measurements), [data.measurements])
  const goalMinutes = useMemo(() => {
    const settings = (data as unknown as Record<string, unknown>).sleepSettings as { goalMinutes?: unknown } | undefined
    return toNumber(settings?.goalMinutes) ?? 480
  }, [data.sleepSettings])

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'it' ? 'it-IT' : 'en-US', {
        day: '2-digit',
        month: 'short',
        weekday: 'short',
      }),
    [language],
  )
  const dayLabel = useMemo(
    () => new Intl.DateTimeFormat(language === 'it' ? 'it-IT' : 'en-US', { day: 'numeric' }),
    [language],
  )

  if (nights.length === 0 && stages.size === 0) {
    return (
      <section className="sleepx">
        <p className="sleepx-empty">
          {t('Nessuna notte registrata: importa i dati da Apple Health o aggiungi una sessione.', 'No nights recorded: import from Apple Health or add a session.')}
        </p>
        <SleepAddAction
          addOpen={addOpen}
          awakenings={awakenings}
          data={data}
          existing={editing}
          recordId={recordId}
          endAt={endAt}
          error={error}
          language={language}
          note={note}
          onClose={() => setAddOpen(false)}
          onOpen={openNew}
          onSaved={() => {
            setAddOpen(false)
            setError('')
          }}
          quality={quality}
          setAwakenings={setAwakenings}
          setEndAt={setEndAt}
          setError={setError}
          setNote={setNote}
          setQuality={setQuality}
          setStartAt={setStartAt}
          startAt={startAt}
        />
      </section>
    )
  }

  const lastNight = nights[0]
  const recent = nights.slice(0, 7)
  const average = recent.length > 0 ? recent.reduce((total, night) => total + night.hours, 0) / recent.length : undefined
  const variation = bedtimeVariation(recent)
  const goalHours = goalMinutes / 60
  const delta = average === undefined ? undefined : average * 60 - goalMinutes

  const chartCount = nights.length > 7 ? 14 : 7
  const chartNights = [...nights.slice(0, chartCount)].reverse()
  const chartMax = Math.max(goalHours, ...chartNights.map((night) => night.hours), 1)
  const goalPercent = Math.min((goalHours / chartMax) * 100, 100)

  const stageOrder = ['deep', 'rem', 'core', 'asleep']
  const orderedStages = stageOrder.filter((stage) => stages.has(stage))

  return (
    <section className="sleepx">
      <SleepAddAction
        addOpen={addOpen}
        awakenings={awakenings}
        data={data}
        existing={editing}
        recordId={recordId}
        endAt={endAt}
        error={error}
        language={language}
        note={note}
        onClose={() => setAddOpen(false)}
        onOpen={openNew}
        onSaved={() => {
          setAddOpen(false)
          setError('')
        }}
        quality={quality}
        setAwakenings={setAwakenings}
        setEndAt={setEndAt}
        setError={setError}
        setNote={setNote}
        setQuality={setQuality}
        setStartAt={setStartAt}
        startAt={startAt}
      />
      <div className="sleepx-kpis">
        <article className="sleepx-kpi">
          <span className="sleepx-kpi__label">{t('Ultima notte', 'Last night')}</span>
          <p className="sleepx-kpi__value">{lastNight ? formatDuration(lastNight.hours) : '—'}</p>
          <span className="sleepx-kpi__hint">{lastNight ? dateLabel.format(new Date(lastNight.start)) : ''}</span>
        </article>
        <article className="sleepx-kpi">
          <span className="sleepx-kpi__label">{t('Media 7 notti', '7-night average')}</span>
          <p className="sleepx-kpi__value">{average === undefined ? '—' : formatDuration(average)}</p>
          <span className="sleepx-kpi__hint">{t('per notte registrata', 'per recorded night')}</span>
        </article>
        <article className="sleepx-kpi">
          <span className="sleepx-kpi__label">{t('Obiettivo', 'Goal')}</span>
          <p className="sleepx-kpi__value">{formatDuration(goalHours)}</p>
          <span className="sleepx-kpi__hint" data-state={delta !== undefined && delta >= 0 ? 'good' : 'low'}>
            {delta === undefined ? t('nessuna media', 'no average') : `${formatDelta(delta)} ${t('vs media', 'vs average')}`}
          </span>
        </article>
        <article className="sleepx-kpi">
          <span className="sleepx-kpi__label">{t('Variazione orario', 'Bedtime variation')}</span>
          <p className="sleepx-kpi__value">{variation === null ? '—' : `± ${variation} min`}</p>
          <span className="sleepx-kpi__hint">
            {variation === null ? t('servono almeno 2 notti', 'needs at least 2 nights') : t('media rispetto all’orario abituale', 'average vs usual time')}
          </span>
        </article>
      </div>

      {chartNights.length > 0 ? (
        <div className="sleepx-chart">
          <div className="sleepx-chart__head">
            <span>{t('Durata recente', 'Recent duration')}</span>
            <span className="sleepx-chart__goal-label">
              {t('Obiettivo', 'Goal')} {formatDuration(goalHours)}
            </span>
          </div>
          <div className="sleepx-chart__plot">
            <div className="sleepx-chart__goal" style={{ bottom: `${goalPercent}%` }} />
            <div className="sleepx-chart__bars">
              {chartNights.map((night) => (
                <div className="sleepx-chart__bar" data-met={night.hours * 60 >= goalMinutes} key={night.id}>
                  <div className="sleepx-chart__fill" style={{ height: `${Math.min((night.hours / chartMax) * 100, 100)}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="sleepx-chart__labels">
            {chartNights.map((night) => (
              <span className="sleepx-chart__label" key={night.id}>{dayLabel.format(new Date(night.start))}</span>
            ))}
          </div>
        </div>
      ) : null}

      {orderedStages.length > 0 ? (
        <div className="sleepx-stages">
          {orderedStages.map((stage) => (
            <div className="sleepx-stage" key={stage}>
              <span className="sleepx-stage__label">{STAGE_LABELS[stage]?.[language === 'it' ? 'it' : 'en'] ?? stage}</span>
              <span className="sleepx-stage__value">{formatDuration(stages.get(stage) ?? 0)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {nights.length > 0 ? (
        <ProgressiveHistory items={nights} initialCount={5} language={language}>
          {(visible) => (
          <ul className="sleepx-rows">
          {visible.map((night) => (
            <li className="sleepx-row" key={night.id}>
              <span className="sleepx-row__date">{dateLabel.format(new Date(night.start))}</span>
              <span className="sleepx-row__duration">{formatDuration(night.hours)}</span>
              <span className="sleepx-row__meta">
                {night.quality !== undefined ? `${night.quality}/5` : '—'}
                {night.awakenings !== undefined ? ` · ${night.awakenings} ${t('risvegli', 'awakenings')}` : ''}
              </span>
              <span className="sleepx-row__meta">{typeof night.raw.source === 'string' ? night.raw.source : t('Registrazione locale', 'Local entry')}</span>
              <button className="btn btn--ghost btn--small" aria-label={`${t('Modifica notte', 'Edit night')}: ${dateLabel.format(new Date(night.start))}`} onClick={() => openEdit(night)} type="button">{t('Modifica', 'Edit')}</button>
              {night.note ? <span className="sleepx-row__note">{night.note.slice(0, 80)}{night.note.length > 80 ? '…' : ''}</span> : null}
            </li>
          ))}
        </ul>
          )}
        </ProgressiveHistory>
      ) : null}
    </section>
  )
}

interface SleepAddActionProps {
  addOpen: boolean
  existing?: Record<string, unknown>
  recordId: string
  data: HealthDataController
  endAt: string
  error: string
  language: string
  note: string
  quality: string
  awakenings: string
  startAt: string
  onClose: () => void
  onOpen: () => void
  onSaved: () => void
  setEndAt: (value: string) => void
  setError: (value: string) => void
  setNote: (value: string) => void
  setQuality: (value: string) => void
  setAwakenings: (value: string) => void
  setStartAt: (value: string) => void
}

function SleepAddAction({ addOpen, existing, recordId, data, endAt, error, language, note, quality, awakenings, startAt, onClose, onOpen, onSaved, setEndAt, setError, setNote, setQuality, setAwakenings, setStartAt }: SleepAddActionProps) {
  const it = language === 'it'
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  return (
    <>
      <button className="btn btn--ghost btn--small" onClick={onOpen} type="button">
        {it ? 'Aggiungi notte' : 'Add night'}
      </button>
      {addOpen ? (
        <EntrySheet onClose={() => { if (!inFlight.current) onClose() }} title={existing ? (it ? 'Modifica notte' : 'Edit night') : (it ? 'Aggiungi notte' : 'Add night')}>
          <form
            className="scroll-data__add"
            onSubmit={(event) => {
              event.preventDefault()
              if (inFlight.current) return
              const validation = validateSleepEntry(startAt, endAt, quality, awakenings)
              if (validation) {
                setError(validation === 'quality'
                  ? (it ? 'La qualità deve essere tra 1 e 5.' : 'Quality must be between 1 and 5.')
                  : validation === 'awakenings'
                    ? (it ? 'I risvegli devono essere un numero intero non negativo.' : 'Awakenings must be a non-negative integer.')
                    : (it ? 'Inserisci un intervallo valido.' : 'Enter a valid time range.'))
                return
              }
              const record: Record<string, unknown> = {
                ...existing,
                id: recordId,
                startAt: fromDateTimeLocal(startAt),
                endAt: fromDateTimeLocal(endAt),
              }
              const originalStart = toTime(existing?.startAt ?? existing?.startDate)
              const originalEnd = toTime(existing?.endAt ?? existing?.endDate)
              if (originalStart !== undefined && startAt === toDateTimeLocal(new Date(originalStart).toISOString())) record.startAt = existing?.startAt ?? existing?.startDate
              if (originalEnd !== undefined && endAt === toDateTimeLocal(new Date(originalEnd).toISOString())) record.endAt = existing?.endAt ?? existing?.endDate
              record.quality = quality ? Number(quality) : undefined
              record.awakenings = awakenings ? Number(awakenings) : undefined
              record.note = note.trim() || undefined
              if (existing) record.updatedAt = new Date().toISOString()
              inFlight.current = true
              setError('')
              setSaving(true)
              void data.saveCanonicalRecord('sleepSessions', record)
                .then(onSaved)
                .catch(() => setError(it ? 'Impossibile salvare la notte. Riprova.' : 'Could not save the night. Try again.'))
                .finally(() => { inFlight.current = false; setSaving(false) })
            }}
          >
            <label>{it ? 'Inizio' : 'Start'}<input disabled={saving} onChange={(event) => setStartAt(event.target.value)} required type="datetime-local" value={startAt} /></label>
            <label>{it ? 'Fine' : 'End'}<input disabled={saving} onChange={(event) => setEndAt(event.target.value)} required type="datetime-local" value={endAt} /></label>
            <label>{it ? 'Qualità (1–5)' : 'Quality (1–5)'}<input disabled={saving} inputMode="numeric" max="5" min="1" onChange={(event) => setQuality(event.target.value)} type="number" value={quality} /></label>
            <label>{it ? 'Risvegli' : 'Awakenings'}<input disabled={saving} inputMode="numeric" min="0" onChange={(event) => setAwakenings(event.target.value)} type="number" value={awakenings} /></label>
            <label>{it ? 'Nota' : 'Note'}<textarea disabled={saving} onChange={(event) => setNote(event.target.value)} value={note} /></label>
            {error ? <p aria-live="polite" className="scroll-data__empty" role="alert">{error}</p> : null}
            <div className="scroll-data__add-actions">
              <button className="btn btn--ghost btn--small" disabled={saving} onClick={onClose} type="button">{it ? 'Annulla' : 'Cancel'}</button>
              <button className="btn btn--primary btn--small" disabled={saving} type="submit">{saving ? (it ? 'Salvataggio…' : 'Saving…') : (it ? 'Salva notte' : 'Save night')}</button>
            </div>
          </form>
        </EntrySheet>
      ) : null}
    </>
  )
}
