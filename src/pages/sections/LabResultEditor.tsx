import { useRef, useState } from 'react'
import { EntrySheet } from '../../components/EntrySheet'

export function LabResultEditor({ record, language, onClose, onSave }: {
  record: Record<string, unknown>
  language: string
  onClose: () => void
  onSave: (record: Record<string, unknown>) => Promise<void>
}) {
  const it = language === 'it'
  const [value, setValue] = useState(String(record.value ?? ''))
  const [unit, setUnit] = useState(String(record.unit ?? ''))
  const [note, setNote] = useState(String(record.note ?? ''))
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState('')
  const close = () => { if (!inFlight.current) onClose() }
  return <EntrySheet onClose={close} title={`${it ? 'Modifica risultato' : 'Edit result'} · ${String(record.analyte ?? '')}`}>
    <form className="form-grid form-grid--single" onSubmit={(event) => {
      event.preventDefault()
      if (inFlight.current) return
      const numeric = Number(value.replace(',', '.'))
      if (!value.trim() || !Number.isFinite(numeric)) {
        setError(it ? 'Inserisci un valore numerico valido.' : 'Enter a valid numeric value.')
        return
      }
      inFlight.current = true
      setSaving(true)
      setError('')
      void onSave({ ...record, value: numeric, unit: unit.trim(), note: note.trim() || undefined, updatedAt: new Date().toISOString() })
        .then(onClose)
        .catch(() => setError(it ? 'Impossibile salvare il risultato. Riprova.' : 'Could not save the result. Try again.'))
        .finally(() => { inFlight.current = false; setSaving(false) })
    }}>
      {record.comparator ? <p>{it ? 'Comparatore del referto' : 'Report comparator'}: {String(record.comparator)}</p> : null}
      <label>{it ? 'Valore' : 'Value'}<input disabled={saving} inputMode="decimal" onChange={(event) => setValue(event.target.value)} required value={value} /></label>
      <label>{it ? 'Unità riportata nel referto' : 'Unit shown in the report'}<input disabled={saving} onChange={(event) => setUnit(event.target.value)} value={unit} /></label>
      <label>{it ? 'Nota' : 'Note'}<textarea disabled={saving} onChange={(event) => setNote(event.target.value)} value={note} /></label>
      {error ? <p role="alert">{error}</p> : null}
      <div className="chip-row">
        <button className="btn btn--ghost" disabled={saving} onClick={close} type="button">{it ? 'Annulla' : 'Cancel'}</button>
        <button className="btn btn--primary" disabled={saving} type="submit">{saving ? (it ? 'Salvataggio…' : 'Saving…') : (it ? 'Salva modifiche' : 'Save changes')}</button>
      </div>
    </form>
  </EntrySheet>
}
