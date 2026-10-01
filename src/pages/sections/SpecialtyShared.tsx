import { useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { HealthEvent } from '../../core/types'
import type { HealthAttachmentInput, HealthDataController } from '../../storage/useHealthData'
import { confirmDelete, t, type Loc } from './specialtyModel'
import './specialtySections.css'

export interface SectionProps {
  data: HealthDataController
  language: string
}

export function Empty({ label }: { label: string }) {
  return <p className="spec-empty">{label}</p>
}

export function DeleteButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button aria-label={label} className="spec-row__delete" disabled={disabled} onClick={onClick} title={label} type="button">
      <Trash2 size={14} />
    </button>
  )
}

export function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button aria-label={label} className="btn btn--ghost btn--small" onClick={onClick} type="button"><Pencil aria-hidden="true" size={14} /></button>
}

export function DateField({ language, value, onChange }: { language: Loc; value: string; onChange: (next: string) => void }) {
  return (
    <label>
      {t(language, 'Data', 'Date')}
      <input required onChange={(event) => onChange(event.target.value)} type="datetime-local" value={value} />
    </label>
  )
}

export function useSheetSave(onSave: (event: HealthEvent, attachments?: HealthAttachmentInput[]) => Promise<void>, onClose: () => void, language: Loc) {
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const [error, setError] = useState('')

  const save = (event: HealthEvent, attachments?: HealthAttachmentInput[]) => {
    if (saving || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setError('')
    void Promise.resolve()
      .then(() => onSave(event, attachments))
      .then(onClose)
      .catch(() => setError(t(language, 'Impossibile salvare il dato. Riprova.', 'Could not save the entry. Try again.')))
      .finally(() => { inFlight.current = false; setSaving(false) })
  }

  return { error, save, saving }
}

export function useEventDelete(onDelete: (id: string) => Promise<void>, language: Loc) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const remove = (id: string) => {
    if (deletingId !== null || !confirmDelete(language)) return
    setDeletingId(id)
    setError('')
    void onDelete(id)
      .catch(() => setError(t(language, 'Impossibile eliminare il dato. Riprova.', 'Could not delete the entry. Try again.')))
      .finally(() => setDeletingId(null))
  }

  return { deletingId, error, remove }
}

export function SheetActions({ language, onClose, label, error, saving }: { language: Loc; onClose: () => void; label: string; error?: string; saving?: boolean }) {
  return (
    <>
      {error ? <p aria-live="polite" className="spec-form__error" role="alert">{error}</p> : null}
      <div className="spec-form__actions">
      <button className="btn btn--ghost btn--small" disabled={saving} onClick={onClose} type="button">
        {t(language, 'Annulla', 'Cancel')}
      </button>
      <button className="btn btn--primary btn--small" disabled={saving} type="submit">
        {saving ? t(language, 'Salvataggio…', 'Saving…') : null}
        {!saving ? label : null}
      </button>
      </div>
    </>
  )
}
