import type { FormEventHandler } from 'react'
import { EntrySheet } from '../../components/EntrySheet'
import { asString } from './medicationsModel'
import type { Row } from './medicationsModel'

export interface MedicationSheetsProps {
  doseAt: string
  doseError: string
  doseMedication?: Row
  doseNote: string
  doseStatus: string
  editingMedicationId?: string
  it: boolean
  medicationDoseValue: string
  medicationError: string
  medicationIntervalValue: string
  medicationNameValue: string
  medicationNoteValue: string
  medicationReasonValue: string
  medicationScheduleStyle: string
  medicationScheduleValue: string
  medicationSheet: boolean
  medicationStatusValue: string
  medicationTimesValue: string
  savingDose: boolean
  savingMedication: boolean
  onCloseDose: () => void
  onCloseMedication: () => void
  onDoseAtChange: (value: string) => void
  onDoseNoteChange: (value: string) => void
  onDoseStatusChange: (value: string) => void
  onDoseSubmit: FormEventHandler<HTMLFormElement>
  onMedicationDoseChange: (value: string) => void
  onMedicationIntervalChange: (value: string) => void
  onMedicationNameChange: (value: string) => void
  onMedicationNoteChange: (value: string) => void
  onMedicationReasonChange: (value: string) => void
  onMedicationScheduleChange: (value: string) => void
  onMedicationScheduleStyleChange: (value: string) => void
  onMedicationStatusChange: (value: string) => void
  onMedicationSubmit: FormEventHandler<HTMLFormElement>
  onMedicationTimesChange: (value: string) => void
}

export function MedicationSheets({
  doseAt,
  doseError,
  doseMedication,
  doseNote,
  doseStatus,
  editingMedicationId,
  it,
  medicationDoseValue,
  medicationError,
  medicationIntervalValue,
  medicationNameValue,
  medicationNoteValue,
  medicationReasonValue,
  medicationScheduleStyle,
  medicationScheduleValue,
  medicationSheet,
  medicationStatusValue,
  medicationTimesValue,
  savingDose,
  savingMedication,
  onCloseDose,
  onCloseMedication,
  onDoseAtChange,
  onDoseNoteChange,
  onDoseStatusChange,
  onDoseSubmit,
  onMedicationDoseChange,
  onMedicationIntervalChange,
  onMedicationNameChange,
  onMedicationNoteChange,
  onMedicationReasonChange,
  onMedicationScheduleChange,
  onMedicationScheduleStyleChange,
  onMedicationStatusChange,
  onMedicationSubmit,
  onMedicationTimesChange,
}: MedicationSheetsProps) {
  return (
    <>
      {doseMedication ? (
        <EntrySheet
          onClose={savingDose ? () => undefined : onCloseDose}
          title={it ? `Registra dose · ${asString(doseMedication.name) ?? 'Farmaco'}` : `Log dose · ${asString(doseMedication.name) ?? 'Medication'}`}
        >
          <form className="scroll-data__add" onSubmit={onDoseSubmit}>
            <label>
              {it ? 'Esito' : 'Status'}
              <select onChange={(event) => onDoseStatusChange(event.target.value)} value={doseStatus}>
                <option value="taken">{it ? 'Presa' : 'Taken'}</option>
                <option value="skipped">{it ? 'Saltata' : 'Skipped'}</option>
                <option value="postponed">{it ? 'Posticipata' : 'Postponed'}</option>
              </select>
            </label>
            <label>
              {it ? 'Quando' : 'When'}
              <input onChange={(event) => onDoseAtChange(event.target.value)} required type="datetime-local" value={doseAt} />
            </label>
            <label>
              {it ? 'Nota' : 'Note'}
              <textarea onChange={(event) => onDoseNoteChange(event.target.value)} value={doseNote} />
            </label>
            {doseError ? <p aria-live="polite" className="scroll-data__empty" role="alert">{doseError}</p> : null}
            <div className="scroll-data__add-actions">
              <button className="btn btn--ghost btn--small" disabled={savingDose} onClick={onCloseDose} type="button">{it ? 'Annulla' : 'Cancel'}</button>
              <button className="btn btn--primary btn--small" disabled={savingDose} type="submit">{savingDose ? (it ? 'Salvataggio…' : 'Saving…') : (it ? 'Salva dose' : 'Save dose')}</button>
            </div>
          </form>
        </EntrySheet>
      ) : null}

      {medicationSheet ? (
        <EntrySheet
          onClose={savingMedication ? () => undefined : onCloseMedication}
          title={editingMedicationId ? (it ? 'Modifica terapia' : 'Edit therapy') : (it ? 'Nuova terapia' : 'New therapy')}
        >
          <form className="form-grid" onSubmit={onMedicationSubmit}>
            <p className="meds-form__hint full-width">{it ? 'Inserisci il farmaco e scegli come vuoi seguirlo. Gli orari sono facoltativi.' : 'Add the medication and choose how you want to track it. Times are optional.'}</p>
            <label className="full-width">
              {it ? 'Nome del farmaco' : 'Medication name'}
              <input autoFocus onChange={(event) => onMedicationNameChange(event.target.value)} placeholder={it ? 'Es. Amoxicillina' : 'e.g. Amoxicillin'} required value={medicationNameValue} />
            </label>
            <label>
              {it ? 'Dose' : 'Dose'}
              <input onChange={(event) => onMedicationDoseChange(event.target.value)} placeholder={it ? 'Es. 500 mg' : 'e.g. 500 mg'} value={medicationDoseValue} />
            </label>
            <label>
              {it ? 'Stato' : 'Status'}
              <select onChange={(event) => onMedicationStatusChange(event.target.value)} value={medicationStatusValue}>
                <option value="active">{it ? 'Attivo' : 'Active'}</option>
                <option value="paused">{it ? 'In pausa' : 'Paused'}</option>
                <option value="stopped">{it ? 'Interrotto' : 'Stopped'}</option>
              </select>
            </label>
            <label className="full-width">
              {it ? 'Programma' : 'Schedule'}
              <select onChange={(event) => onMedicationScheduleStyleChange(event.target.value)} value={medicationScheduleStyle}>
                <option value="text">{it ? 'Descrizione libera' : 'Free description'}</option>
                <option value="fixedTimes">{it ? 'Orari fissi' : 'Fixed times'}</option>
                <option value="interval">{it ? 'A intervalli regolari' : 'Regular interval'}</option>
                <option value="asNeeded">{it ? 'Al bisogno' : 'As needed'}</option>
              </select>
            </label>
            {medicationScheduleStyle === 'text' ? (
              <label className="full-width">
                {it ? 'Descrizione del programma' : 'Schedule description'}
                <input onChange={(event) => onMedicationScheduleChange(event.target.value)} placeholder={it ? 'Es. Dopo i pasti, ogni giorno' : 'e.g. After meals, every day'} value={medicationScheduleValue} />
              </label>
            ) : null}
            {medicationScheduleStyle === 'fixedTimes' ? (
              <label className="full-width">
                {it ? 'Orari della giornata' : 'Times of day'}
                <input inputMode="text" onChange={(event) => onMedicationTimesChange(event.target.value)} placeholder={it ? 'Es. 08:00, 20:00' : 'e.g. 08:00, 20:00'} value={medicationTimesValue} />
                <span className="form-note">{it ? 'Separa più orari con virgole o spazi. Potrai registrare ogni dose dalla scheda.' : 'Separate multiple times with commas or spaces. You can log each dose from the card.'}</span>
              </label>
            ) : null}
            {medicationScheduleStyle === 'interval' ? (
              <label className="full-width">
                {it ? 'Intervallo in ore' : 'Interval in hours'}
                <input inputMode="decimal" min="0.5" onChange={(event) => onMedicationIntervalChange(event.target.value)} step="0.5" type="number" value={medicationIntervalValue} />
              </label>
            ) : null}
            <label className="full-width">
              {it ? 'Motivo (facoltativo)' : 'Reason (optional)'}
              <input onChange={(event) => onMedicationReasonChange(event.target.value)} value={medicationReasonValue} />
            </label>
            <label className="full-width">
              {it ? 'Note (facoltative)' : 'Notes (optional)'}
              <textarea onChange={(event) => onMedicationNoteChange(event.target.value)} rows={3} value={medicationNoteValue} />
            </label>
            {medicationError ? <p aria-live="polite" className="form-error full-width" role="alert">{medicationError}</p> : null}
            <div className="form-actions full-width">
              <button className="btn btn--ghost" disabled={savingMedication} onClick={onCloseMedication} type="button">{it ? 'Annulla' : 'Cancel'}</button>
              <button className="btn btn--primary" disabled={savingMedication} type="submit">{savingMedication ? '…' : (it ? 'Salva terapia' : 'Save therapy')}</button>
            </div>
          </form>
        </EntrySheet>
      ) : null}
    </>
  )
}
