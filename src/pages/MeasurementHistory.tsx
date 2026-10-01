import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { EntrySheet } from '../components/EntrySheet'
import { ProgressiveHistory } from '../components/ProgressiveHistory'
import { fromDateTimeLocal, toDateTimeLocal } from '../core/format'
import type { Measurement } from '../core/types'

export const MeasurementSaveContext = createContext<((record: Measurement) => Promise<void>) | undefined>(undefined)

function MeasurementEditor({ record, language, onDone, onBusy }: { record: Record<string, unknown>; language: string; onDone: () => void; onBusy: (busy: boolean) => void }) {
  const save = useContext(MeasurementSaveContext)
  const [value, setValue] = useState(String(record.value))
  const [unit, setUnit] = useState(String(record.unit ?? ''))
  const [when, setWhen] = useState(toDateTimeLocal(String(record.measuredAt)))
  const [note, setNote] = useState(String(record.note ?? ''))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const valueInput = useRef<HTMLInputElement>(null)
  useEffect(() => { valueInput.current?.focus() }, [])
  const it = language === 'it'
  return <form className="form-grid" onSubmit={(event) => {
    event.preventDefault()
    if (!save || inFlight.current) return
    const number = Number(value.replace(',', '.'))
    if (!value.trim() || !Number.isFinite(number) || !unit.trim() || !when || !Number.isFinite(new Date(when).getTime())) {
      setError(it ? 'Controlla valore, unità e data.' : 'Check value, unit and date.'); return
    }
    inFlight.current = true; setSaving(true); onBusy(true); setError('')
    const measuredAt = when === toDateTimeLocal(String(record.measuredAt)) ? String(record.measuredAt) : fromDateTimeLocal(when)
    void save({ ...record, value: number, unit: unit.trim(), measuredAt, note: note.trim() || undefined } as unknown as Measurement)
      .then(onDone)
      .catch(() => setError(it ? 'Impossibile salvare. Riprova.' : 'Could not save. Try again.'))
      .finally(() => { inFlight.current = false; onBusy(false); setSaving(false) })
  }}>
    <p className="full-width">{it ? 'La modifica aggiorna questa registrazione. Cambiare unità non converte automaticamente il valore.' : 'Editing updates this record. Changing the unit does not automatically convert the value.'}</p>
    <label>{it ? 'Valore' : 'Value'}<input ref={valueInput} disabled={saving} inputMode="decimal" required value={value} onChange={(event) => setValue(event.target.value)} /></label>
    <label>{it ? 'Unità' : 'Unit'}<input disabled={saving} required value={unit} onChange={(event) => setUnit(event.target.value)} /></label>
    <label>{it ? 'Data e ora' : 'Date and time'}<input disabled={saving} required type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /></label>
    <label className="full-width">{it ? 'Nota' : 'Note'}<textarea disabled={saving} value={note} onChange={(event) => setNote(event.target.value)} /></label>
    {error ? <p className="full-width" role="alert">{error}</p> : null}
    <div className="form-actions full-width"><button className="btn btn--ghost" disabled={saving} onClick={onDone} type="button">{it ? 'Indietro' : 'Back'}</button><button className="btn btn--primary" disabled={saving} type="submit">{saving ? (it ? 'Salvataggio…' : 'Saving…') : (it ? 'Salva modifiche' : 'Save changes')}</button></div>
  </form>
}

export function MeasurementHistory({ snapshot, type, label, language }: {
  snapshot: Record<string, unknown>; type: string; label: string; language: string
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Record<string, unknown>>()
  const busy = useRef(false)
  const history = useRef<HTMLUListElement>(null)
  const focusRecord = useRef<string>()
  const save = useContext(MeasurementSaveContext)
  useEffect(() => {
    if (editing || !open || !focusRecord.current) return
    const frame = window.requestAnimationFrame(() => {
      Array.from(history.current?.querySelectorAll<HTMLButtonElement>('button[data-measurement-id]') ?? [])
        .find((button) => button.dataset.measurementId === focusRecord.current)?.focus()
      focusRecord.current = undefined
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editing, open])
  const records = useMemo(() => (Array.isArray(snapshot.measurements) ? snapshot.measurements : [])
    .filter((record): record is Record<string, unknown> => record && typeof record === 'object' && record.type === type && typeof record.value === 'number' && Number.isFinite(record.value) && typeof record.measuredAt === 'string' && Number.isFinite(new Date(record.measuredAt).getTime()))
    .sort((a, b) => new Date(String(b.measuredAt)).getTime() - new Date(String(a.measuredAt)).getTime()), [snapshot.measurements, type])
  const it = language === 'it'
  const date = new Intl.DateTimeFormat(it ? 'it-IT' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
  if (!records.length) return null
  return <>
    <button className="btn btn--ghost btn--small" aria-label={`${it ? 'Registrazioni' : 'Records'}: ${label}`} onClick={() => setOpen(true)} type="button">{it ? 'Registrazioni' : 'Records'} · {records.length}</button>
    {open ? <EntrySheet onClose={() => { if (!busy.current) { setOpen(false); setEditing(undefined) } }} title={label}>
      {editing ? <MeasurementEditor record={editing} language={language} onDone={() => setEditing(undefined)} onBusy={(value) => { busy.current = value }} /> : null}
      <div hidden={!!editing}>
      <p>{it ? 'Valori originali, con data e origine. Ogni riga rappresenta una registrazione.' : 'Original values, with date and source. Each row represents one record.'}</p>
      <ProgressiveHistory items={records} initialCount={10} language={language}>
        {(visible) => <ul className="measurement-history" ref={history}>
          {visible.map((record, index) => <li key={`${String(record.id)}-${index}`}>
            <strong>{Number(record.value).toLocaleString(it ? 'it-IT' : 'en-US', { maximumFractionDigits: 20 })} {String(record.unit ?? '')}</strong>
            <time dateTime={String(record.measuredAt)}>{date.format(new Date(String(record.measuredAt)))}</time>
            <span>{typeof record.source === 'string' && record.source ? record.source : (it ? 'Origine non specificata' : 'Source unspecified')}</span>
            {typeof record.note === 'string' && record.note ? <p>{record.note}</p> : null}
            {save && typeof record.id === 'string' && record.id ? <button data-measurement-id={record.id} aria-label={`${it ? 'Modifica misura' : 'Edit measurement'}: ${date.format(new Date(String(record.measuredAt)))}`} className="btn btn--ghost btn--small" onClick={() => { focusRecord.current = String(record.id); setEditing(record) }} type="button">{it ? 'Modifica' : 'Edit'}</button> : null}
          </li>)}
        </ul>}
      </ProgressiveHistory>
      </div>
    </EntrySheet> : null}
  </>
}
