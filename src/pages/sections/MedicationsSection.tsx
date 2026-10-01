import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { toDateTimeLocal } from '../../core/format'
import { createId } from '../../core/id'
import { snapshotRecords } from '../../core/healthModules'
import type { HealthDataController } from '../../storage/useHealthData'
import {
  DAY_MS,
  asNumber,
  asString,
  medicationIsActive,
  medicationStatus,
  nextScheduledTime,
  parseDate,
  parseTimeList,
  scheduledTimes,
  timeLabel,
} from './medicationsModel'
import type { Row } from './medicationsModel'
import { MedicationSheets } from './MedicationSheets'
import { MedicationAdherence, MedicationList, MedicationNextDoses, MedicationRecentDoses } from './MedicationOverview'
import './medicationsSection.css'


export function MedicationsSection({ data, language }: { data: HealthDataController; language: string }) {
  const it = language !== 'en'
  const [showAllMedications, setShowAllMedications] = useState(false)
  const doseInFlight = useRef(false)
  const medicationInFlight = useRef(false)
  const [doseMedication, setDoseMedication] = useState<Row | undefined>()
  const [doseStatus, setDoseStatus] = useState('taken')
  const [doseAt, setDoseAt] = useState(() => toDateTimeLocal(new Date().toISOString()))
  const [doseNote, setDoseNote] = useState('')
  const [doseError, setDoseError] = useState('')
  const [savingDose, setSavingDose] = useState(false)
  const [medicationSheet, setMedicationSheet] = useState(false)
  const [editingMedicationId, setEditingMedicationId] = useState<string | undefined>()
  const [medicationNameValue, setMedicationNameValue] = useState('')
  const [medicationDoseValue, setMedicationDoseValue] = useState('')
  const [medicationScheduleValue, setMedicationScheduleValue] = useState('')
  const [medicationScheduleStyle, setMedicationScheduleStyle] = useState('text')
  const [medicationTimesValue, setMedicationTimesValue] = useState('')
  const [medicationIntervalValue, setMedicationIntervalValue] = useState('')
  const [medicationReasonValue, setMedicationReasonValue] = useState('')
  const [medicationNoteValue, setMedicationNoteValue] = useState('')
  const [medicationStatusValue, setMedicationStatusValue] = useState('active')
  const [savingMedication, setSavingMedication] = useState(false)
  const [medicationError, setMedicationError] = useState('')
  const snapshot = data as unknown as Record<string, unknown>
  const medications = useMemo(() => snapshotRecords(snapshot, 'medications'), [snapshot.medications])
  const doseEvents = useMemo(() => snapshotRecords(snapshot, 'medicationDoseEvents'), [snapshot.medicationDoseEvents])

  const { activeMeds, nameById, nameByKey } = useMemo(() => {
    const byId = new Map<string, string>()
    const byKey = new Map<string, string>()
    for (const medication of medications) {
      const id = asString(medication.id)
      const name = asString(medication.name)
      if (!name) continue
      if (id) byId.set(id, name)
      byKey.set(name.toLowerCase(), name)
    }
    return { activeMeds: medications.filter(medicationIsActive), nameById: byId, nameByKey: byKey }
  }, [medications])

  const { taken, total, adherence } = useMemo(() => {
    const now = Date.now()
    const cutoff = now - 7 * DAY_MS
    let taken = 0
    let total = 0
    for (const event of doseEvents) {
      const date = parseDate(event.recordedAt) ?? parseDate(event.scheduledAt)
      if (!date) continue
      const at = date.getTime()
      if (at < cutoff || at > now) continue
      total += 1
      if (asString(event.status) === 'taken') taken += 1
    }
    return {
      taken,
      total,
      adherence: total > 0 ? Math.round((taken / total) * 100) : 0,
    }
  }, [doseEvents])

  const nextDoses = useMemo(() => {
    const now = new Date()
    return activeMeds
      .map((medication) => ({ medication, at: nextScheduledTime(medication, now) }))
      .filter((entry): entry is { medication: Row; at: Date } => entry.at !== undefined)
      .sort((left, right) => left.at.getTime() - right.at.getTime())
      .slice(0, 3)
  }, [activeMeds])

  const recent = useMemo(
    () => [...doseEvents]
      .sort((left, right) => String(right.recordedAt ?? '').localeCompare(String(left.recordedAt ?? '')))
,
    [doseEvents],
  )

  const medicationName = (event: Row): string => {
    const id = asString(event.medicationId)
    if (!id) return it ? 'Farmaco' : 'Medication'
    return nameById.get(id) ?? nameByKey.get(id.toLowerCase()) ?? id
  }

  const closeDose = () => {
    setDoseMedication(undefined)
    setDoseStatus('taken')
    setDoseAt(toDateTimeLocal(new Date().toISOString()))
    setDoseNote('')
    setDoseError('')
    setSavingDose(false)
  }

  const saveDose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingDose || doseInFlight.current) return
    const recordedAt = new Date(doseAt)
    if (!doseMedication || !asString(doseMedication.id) || Number.isNaN(recordedAt.getTime())) {
      setDoseError(it ? 'Inserisci un orario valido.' : 'Enter a valid time.')
      return
    }
    setDoseError('')
    doseInFlight.current = true
    setSavingDose(true)
    try {
      await data.saveCanonicalRecord('medicationDoseEvents', {
        id: createId('dose'),
        medicationId: asString(doseMedication.id),
        recordedAt: recordedAt.toISOString(),
        status: doseStatus,
        ...(doseNote.trim() ? { note: doseNote.trim() } : {}),
        createdAt: new Date().toISOString(),
      })
      closeDose()
    } catch {
      setDoseError(it ? 'Impossibile salvare la dose. Riprova.' : 'Could not save the dose. Try again.')
      setSavingDose(false)
    } finally {
      doseInFlight.current = false
    }
  }

  const closeMedication = () => {
    setMedicationSheet(false)
    setEditingMedicationId(undefined)
    setMedicationNameValue('')
    setMedicationDoseValue('')
    setMedicationScheduleValue('')
    setMedicationScheduleStyle('text')
    setMedicationTimesValue('')
    setMedicationIntervalValue('')
    setMedicationReasonValue('')
    setMedicationNoteValue('')
    setMedicationStatusValue('active')
    setMedicationError('')
    setSavingMedication(false)
  }

  const openMedicationEditor = (medication?: Row) => {
    setEditingMedicationId(asString(medication?.id))
    setMedicationNameValue(asString(medication?.name) ?? '')
    setMedicationDoseValue(asString(medication?.dose) ?? '')
    setMedicationScheduleValue(asString(medication?.schedule) ?? '')
    const style = asString(medication?.scheduleStyle)
    setMedicationScheduleStyle(style === 'fixedTimes' || style === 'interval' || style === 'asNeeded' ? style : 'text')
    setMedicationTimesValue(scheduledTimes(medication ?? {}).map(timeLabel).join(', '))
    setMedicationIntervalValue(asNumber(medication?.intervalHours)?.toString() ?? '')
    setMedicationReasonValue(asString(medication?.reason) ?? '')
    setMedicationNoteValue(asString(medication?.note) ?? '')
    setMedicationStatusValue(medicationStatus(medication ?? {}))
    setMedicationError('')
    setMedicationSheet(true)
  }

  const saveMedication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingMedication || medicationInFlight.current) return
    if (!medicationNameValue.trim()) {
      setMedicationError(it ? 'Inserisci il nome del farmaco.' : 'Enter the medication name.')
      return
    }
    const times = parseTimeList(medicationTimesValue)
    if (medicationScheduleStyle === 'fixedTimes' && times.length === 0) {
      setMedicationError(it ? 'Inserisci almeno un orario valido, per esempio 08:00, 20:00.' : 'Enter at least one valid time, for example 08:00, 20:00.')
      return
    }
    const intervalHours = Number(medicationIntervalValue.replace(',', '.'))
    if (medicationScheduleStyle === 'interval' && (!Number.isFinite(intervalHours) || intervalHours <= 0)) {
      setMedicationError(it ? 'Inserisci un intervallo valido in ore.' : 'Enter a valid interval in hours.')
      return
    }
    setMedicationError('')
    medicationInFlight.current = true
    setSavingMedication(true)
    const now = new Date().toISOString()
    try {
      const existing = editingMedicationId ? medications.find((item) => asString(item.id) === editingMedicationId) : undefined
      await data.saveCanonicalRecord('medications', {
        ...existing,
        id: editingMedicationId ?? createId('medication'),
        name: medicationNameValue.trim(),
        dose: medicationDoseValue.trim() || undefined,
        schedule: medicationScheduleStyle === 'text' ? medicationScheduleValue.trim() || undefined : undefined,
        scheduleStyle: medicationScheduleStyle,
        scheduledTimes: medicationScheduleStyle === 'fixedTimes' ? times : undefined,
        intervalHours: medicationScheduleStyle === 'interval' ? intervalHours : undefined,
        status: medicationStatusValue,
        reason: medicationReasonValue.trim() || undefined,
        note: medicationNoteValue.trim() || undefined,
        createdAt: asString(existing?.createdAt) ?? now,
        updatedAt: now,
      })
      closeMedication()
    } catch {
      setMedicationError(it ? 'Impossibile salvare la terapia. Riprova.' : 'Could not save the therapy. Try again.')
      setSavingMedication(false)
    } finally {
      medicationInFlight.current = false
    }
  }

  const openDose = (medication: Row) => {
    setDoseAt(toDateTimeLocal(new Date().toISOString()))
    setDoseStatus('taken')
    setDoseNote('')
    setDoseError('')
    setDoseMedication(medication)
  }

  return (
    <section className="meds-section">
      <div className="meds-summary-head">
        <p className="meds-count meds-count--summary">
          {it ? `${activeMeds.length} terapie attive` : `${activeMeds.length} active therapies`}
        </p>
        <button className="btn btn--primary btn--small" onClick={() => openMedicationEditor()} type="button">
          <Plus size={14} /> {it ? 'Nuova terapia' : 'New therapy'}
        </button>
      </div>

      {medications.length > activeMeds.length ? (
        <button aria-pressed={showAllMedications} className="chip" onClick={() => setShowAllMedications((value) => !value)} type="button">
          {showAllMedications ? (it ? 'Solo terapie attive' : 'Active therapies only') : (it ? `Mostra tutte le terapie (${medications.length})` : `Show all therapies (${medications.length})`)}
        </button>
      ) : null}

      {(showAllMedications ? medications : activeMeds).length === 0 ? (
        <p className="meds-empty">{it ? 'Nessuna terapia attiva.' : 'No active therapy.'}</p>
      ) : (
        <MedicationList medications={showAllMedications ? medications : activeMeds} language={language} onEdit={openMedicationEditor} onLogDose={openDose} />
      )}

      <MedicationNextDoses nextDoses={nextDoses} language={language} onLogDose={openDose} />
      <MedicationAdherence adherence={adherence} language={language} taken={taken} total={total} />
      <MedicationRecentDoses language={language} medicationName={medicationName} recent={recent} />

      <MedicationSheets
        doseAt={doseAt}
        doseError={doseError}
        doseMedication={doseMedication}
        doseNote={doseNote}
        doseStatus={doseStatus}
        editingMedicationId={editingMedicationId}
        it={it}
        medicationDoseValue={medicationDoseValue}
        medicationError={medicationError}
        medicationIntervalValue={medicationIntervalValue}
        medicationNameValue={medicationNameValue}
        medicationNoteValue={medicationNoteValue}
        medicationReasonValue={medicationReasonValue}
        medicationScheduleStyle={medicationScheduleStyle}
        medicationScheduleValue={medicationScheduleValue}
        medicationSheet={medicationSheet}
        medicationStatusValue={medicationStatusValue}
        medicationTimesValue={medicationTimesValue}
        onCloseDose={closeDose}
        onCloseMedication={closeMedication}
        onDoseAtChange={setDoseAt}
        onDoseNoteChange={setDoseNote}
        onDoseStatusChange={setDoseStatus}
        onDoseSubmit={(event) => void saveDose(event)}
        onMedicationDoseChange={setMedicationDoseValue}
        onMedicationIntervalChange={setMedicationIntervalValue}
        onMedicationNameChange={setMedicationNameValue}
        onMedicationNoteChange={setMedicationNoteValue}
        onMedicationReasonChange={setMedicationReasonValue}
        onMedicationScheduleChange={setMedicationScheduleValue}
        onMedicationScheduleStyleChange={setMedicationScheduleStyle}
        onMedicationStatusChange={setMedicationStatusValue}
        onMedicationSubmit={(event) => void saveMedication(event)}
        onMedicationTimesChange={setMedicationTimesValue}
        savingDose={savingDose}
        savingMedication={savingMedication}
      />
    </section>
  )
}
