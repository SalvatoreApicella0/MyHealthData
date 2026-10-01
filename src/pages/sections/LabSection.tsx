import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Minus, Pencil, Plus, TrendingDown, TrendingUp, X } from 'lucide-react'
import { EntrySheet } from '../../components/EntrySheet'
import { createId } from '../../core/id'
import { snapshotRecords } from '../../core/healthModules'
import type { HealthDataController } from '../../storage/useHealthData'
import {
  CURATED,
  MAX_VISIBLE_ROWS,
  SPEC_ORDER,
  formatDay,
  formatNumber,
  glucoseMeasurements,
  levelFor,
  locale,
  recordRangeText,
  specRangeText,
  specRangeValue,
  todayKey,
  toRecord,
} from './labModel'
import type { AnalyteSpec, LabDay, LabRecord, Trend } from './labModel'
import { LabResultEditor } from './LabResultEditor'
import './labSection.css'

interface LabSectionProps {
  data: HealthDataController
  language: string
}
export function LabSection({ data, language }: LabSectionProps) {
  const lang = locale(language)
  const it = lang === 'it'
  const t = (itText: string, enText: string) => (it ? itText : enText)

  const [editingRecord, setEditingRecord] = useState<Record<string, unknown>>()
  const [open, setOpen] = useState(false)
  const [collectionDate, setCollectionDate] = useState(() => todayKey())
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [batchId, setBatchId] = useState(() => createId('lab_batch'))
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)

  const toggleExpanded = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const records = useMemo(() => {
    const snapshot = data as unknown as Record<string, unknown>
    return [
      ...snapshotRecords(snapshot, 'labResults').map(toRecord),
      ...glucoseMeasurements(snapshot, lang),
    ]
  }, [data.labResults, data.measurements, lang])

  const trends = useMemo(() => {
    const map = new Map<string, Array<{ id: string; value: number; at: number }>>()
    for (const record of records) {
      if (!record.spec || record.value === undefined) continue
      const list = map.get(record.spec.id) ?? []
      list.push({ id: record.id, value: record.value, at: record.at })
      map.set(record.spec.id, list)
    }
    for (const list of map.values()) list.sort((left, right) => left.at - right.at)
    return map
  }, [records])

  const days = useMemo(() => {
    const groups = new Map<string, LabDay>()
    for (const record of records) {
      const group = groups.get(record.day) ?? {
        key: record.day,
        at: 0,
        date: record.day === 'unknown' ? undefined : new Date(record.at),
        rows: [],
      }
      group.rows.push(record)
      group.at = Math.max(group.at, record.at)
      groups.set(record.day, group)
    }
    const list = [...groups.values()]
    for (const group of list) {
      group.rows.sort((left, right) => {
        const leftIndex = left.spec ? SPEC_ORDER.get(left.spec.id) ?? 999 : 999
        const rightIndex = right.spec ? SPEC_ORDER.get(right.spec.id) ?? 999 : 999
        return leftIndex - rightIndex || left.analyte.localeCompare(right.analyte, it ? 'it-IT' : 'en-US')
      })
    }
    return list.sort((left, right) => right.at - left.at)
  }, [records, it])

  const missing = useMemo(() => {
    const present = new Set<string>()
    for (const record of records) {
      if (record.spec) present.add(record.spec.id)
    }
    return CURATED.filter((spec) => !present.has(spec.id))
  }, [records])

  const trendFor = (record: LabRecord): Trend | undefined => {
    if (!record.spec) return undefined
    const list = trends.get(record.spec.id)
    if (!list || list.length < 2) return undefined
    const last = list[list.length - 1]
    if (!last || last.id !== record.id) return undefined
    const previous = list[list.length - 2]
    if (!previous) return undefined
    const delta = last.value - previous.value
    const epsilon = Math.abs(previous.value) * 0.001
    if (Math.abs(delta) <= epsilon) return 'flat'
    return delta > 0 ? 'up' : 'down'
  }

  const trendIcon = (trend: Trend) => {
    if (trend === 'up') return <TrendingUp aria-hidden="true" size={12} />
    if (trend === 'down') return <TrendingDown aria-hidden="true" size={12} />
    return <Minus aria-hidden="true" size={12} />
  }

  const openSheet = () => {
    setCollectionDate(todayKey())
    setDraft({})
    setError('')
    setSaving(false)
    setBatchId(createId('lab_batch'))
    setOpen(true)
  }

  const removeRecord = async (record: LabRecord): Promise<void> => {
    if (!record.storedId || deletingId !== null) return
    setDeletingId(record.storedId)
    setDeleteError(null)
    try {
      await data.deleteCanonicalRecord('labResults', record.storedId)
    } catch {
      setDeleteError({ id: record.storedId, message: t('Impossibile eliminare il risultato. Riprova.', 'Could not delete the result. Try again.') })
    } finally {
      setDeletingId(null)
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const collected = new Date(`${collectionDate}T00:00:00`)
    if (!collectionDate || Number.isNaN(collected.getTime())) {
      setError(t('Seleziona la data del prelievo.', 'Choose the collection date.'))
      return
    }
    const filled: Array<{ spec: AnalyteSpec; value: number }> = []
    for (const spec of CURATED) {
      const raw = draft[spec.id]
      if (raw === undefined || raw.trim() === '') continue
      const parsed = Number(raw.replace(',', '.'))
      if (!Number.isFinite(parsed)) {
        setError(t(`Valore non valido per ${spec.it}.`, `Invalid value for ${spec.en}.`))
        return
      }
      filled.push({ spec, value: parsed })
    }
    if (filled.length === 0) {
      setError(t('Inserisci almeno un valore.', 'Enter at least one value.'))
      return
    }
    const now = new Date().toISOString()
    const panel = t('Analisi sangue', 'Blood test')
    setError('')
    setSaving(true)
    try {
      for (const entry of filled) {
        await data.saveCanonicalRecord('labResults', {
          // Reusing the same id on retry makes a partially completed batch
          // idempotent instead of duplicating earlier analytes.
          id: `${batchId}_${entry.spec.id}`,
          panelName: panel,
          analyte: it ? entry.spec.it : entry.spec.en,
          value: entry.value,
          unit: entry.spec.unit,
          referenceLow: entry.spec.low ?? null,
          referenceHigh: entry.spec.high ?? null,
          referenceRange: specRangeValue(entry.spec),
          collectedAt: collected.toISOString(),
          laboratoryFlag: null,
          note: null,
          source: 'manual',
          createdAt: now,
          updatedAt: now,
        })
      }
      setDraft({})
      setOpen(false)
    } catch {
      setError(t('Impossibile salvare le analisi. Riprova.', 'Could not save the tests. Try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="labx">
      <header className="labx-head">
        <button className="btn btn--ghost btn--small" onClick={openSheet} type="button">
          <Plus size={14} />
          {t('Aggiungi analisi', 'Add tests')}
        </button>
      </header>

      {days.map((day) => (
        <article className="labx-card" key={day.key}>
          <header className="labx-card-head">
            <span className="labx-card-date">
              {day.date ? formatDay(day.date, lang) : t('Data sconosciuta', 'Unknown date')}
            </span>
            <span className="labx-card-count">
              {t(`${day.rows.length} valori`, `${day.rows.length} values`)}
            </span>
          </header>
          <ul className="labx-rows">
            {(() => {
              const isOpen = expanded.has(day.key)
              const rows = isOpen ? day.rows : day.rows.slice(0, MAX_VISIBLE_ROWS)
              const hidden = day.rows.length - rows.length
              return (
                <>
                  {rows.map((record) => {
                    const level = record.value === undefined ? 'none' : levelFor(record.value, record.low, record.high)
                    const trend = trendFor(record)
                    return (
                      <li className="labx-row" data-level={level} key={record.id}>
                        <span className="labx-row-name">
                          {record.analyte}
                          {trend ? (
                            <span className="labx-row-trend" data-trend={trend} title={t('Tendenza', 'Trend')}>
                              {trendIcon(trend)}
                            </span>
                          ) : null}
                          {record.laboratoryFlag ? <span className="labx-row-flag">{record.laboratoryFlag}</span> : null}
                        </span>
                        {record.readOnly || !record.storedId ? (
                          <span className="labx-row-value" data-level={level}>
                          {record.value === undefined
                            ? '—'
                            : `${record.comparator ?? ''}${formatNumber(record.value, lang)}`}
                          {record.unit ? <small>{record.unit}</small> : null}
                        </span>
                        ) : (
                          <button aria-label={t(`Modifica ${record.analyte}`, `Edit ${record.analyte}`)} className="labx-row-value labx-row-edit" data-level={level} onClick={() => {
                            const original = snapshotRecords(data as unknown as Record<string, unknown>, 'labResults').find((item) => item.id === record.storedId)
                            if (original) setEditingRecord(original)
                          }} type="button">

                          {record.value === undefined
                            ? '—'
                            : `${record.comparator ?? ''}${formatNumber(record.value, lang)}`}
                          {record.unit ? <small>{record.unit}</small> : null}

                            <Pencil aria-hidden="true" size={12} />
                          </button>
                        )}
                        <span className="labx-row-range">{recordRangeText(record, lang)}</span>
                        {record.readOnly ? (
                          <span className="labx-row-source" title={t('Importata dalle misurazioni sincronizzate', 'Imported from synced measurements')}>
                            {t('Sincronizzata', 'Synced')}
                          </span>
                        ) : (
                          <button
                            aria-label={t(`Elimina ${record.analyte}`, `Delete ${record.analyte}`)}
                            className="labx-row-delete"
                            disabled={deletingId !== null}
                            onClick={() => void removeRecord(record)}
                            type="button"
                          >
                            <X aria-hidden="true" size={11} />
                          </button>
                        )}
                        {deleteError?.id === record.storedId ? <span aria-live="polite" className="labx-row-error" role="alert">{deleteError?.message}</span> : null}
                      </li>
                    )
                  })}
                  {isOpen || hidden > 0 ? (
                    <li className="labx-more-row">
                      <button className="labx-more" onClick={() => toggleExpanded(day.key)} type="button">
                        {isOpen
                          ? t('Mostra meno', 'Show less')
                          : t(`Mostra altri ${hidden}`, `Show ${hidden} more`)}
                      </button>
                    </li>
                  ) : null}
                </>
              )
            })()}
          </ul>
        </article>
      ))}

      {missing.length > 0 ? (
        <article className="labx-card labx-card--missing">
          <header className="labx-card-head">
            <span className="labx-card-date">{t('Non disponibile', 'Not available')}</span>
            <span className="labx-card-count">{missing.length}</span>
          </header>
          <ul className="labx-rows">
            {(() => {
              const isOpen = expanded.has('missing')
              const rows = isOpen ? missing : missing.slice(0, MAX_VISIBLE_ROWS)
              const hidden = missing.length - rows.length
              return (
                <>
                  {rows.map((spec) => (
                    <li className="labx-row labx-row--missing" key={spec.id}>
                      <span className="labx-row-name">{it ? spec.it : spec.en}</span>
                      <span className="labx-row-value">
                        {spec.unit ? <small>{spec.unit}</small> : '—'}
                      </span>
                      <span className="labx-row-range" />
                      <span />
                    </li>
                  ))}
                  {isOpen || hidden > 0 ? (
                    <li className="labx-more-row">
                      <button className="labx-more" onClick={() => toggleExpanded('missing')} type="button">
                        {isOpen
                          ? t('Mostra meno', 'Show less')
                          : t(`Mostra altri ${hidden}`, `Show ${hidden} more`)}
                      </button>
                    </li>
                  ) : null}
                </>
              )
            })()}
          </ul>
        </article>
      ) : null}

      {editingRecord ? <LabResultEditor language={language} onClose={() => setEditingRecord(undefined)} onSave={(record) => data.saveCanonicalRecord('labResults', record)} record={editingRecord} /> : null}

      {open ? (
        <EntrySheet title={t('Aggiungi analisi', 'Add tests')} onClose={saving ? () => undefined : () => setOpen(false)}>
          <form className="labx-add" onSubmit={(event) => void submit(event)}>
            <label className="labx-add-date">
              {t('Data del prelievo', 'Collection date')}
              <input
                onChange={(event) => setCollectionDate(event.target.value)}
                disabled={saving}
                type="date"
                value={collectionDate}
              />
            </label>
            <div className="labx-add-scroll">
              <table className="labx-add-table">
                <thead>
                  <tr>
                    <th>{t('Analita', 'Analyte')}</th>
                    <th>{t('Unità', 'Unit')}</th>
                    <th>{t('Intervallo', 'Range')}</th>
                    <th>{t('Valore', 'Value')}</th>
                  </tr>
                </thead>
                <tbody>
                  {CURATED.map((spec) => (
                    <tr key={spec.id}>
                      <td className="labx-add-label">{it ? spec.it : spec.en}</td>
                      <td className="labx-add-unit">{spec.unit || '—'}</td>
                      <td className="labx-add-range">{specRangeText(spec, lang)}</td>
                      <td>
                        <input
                          aria-label={it ? spec.it : spec.en}
                          className="labx-add-input"
                          disabled={saving}
                          inputMode="decimal"
                          onChange={(event) => setDraft((current) => ({ ...current, [spec.id]: event.target.value }))}
                          placeholder="—"
                          value={draft[spec.id] ?? ''}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error ? <p className="labx-add-error">{error}</p> : null}
            <div className="labx-add-actions">
              <button className="btn btn--ghost btn--small" disabled={saving} onClick={() => setOpen(false)} type="button">
                {t('Annulla', 'Cancel')}
              </button>
              <button className="btn btn--primary btn--small" disabled={saving} type="submit">
                {saving ? t('Salvataggio…', 'Saving…') : t('Salva analisi', 'Save tests')}
              </button>
            </div>
          </form>
        </EntrySheet>
      ) : null}
    </section>
  )
}
