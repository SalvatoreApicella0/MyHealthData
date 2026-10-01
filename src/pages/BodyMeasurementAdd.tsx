import { useState, type FormEvent } from 'react'
import { createId } from '../core/id'
import type { Measurement, MeasurementType } from '../core/types'
import type { HealthDataController } from '../storage/useHealthData'

interface BodyMeasurementField {
  type: MeasurementType
  it: string
  en: string
  unit: string
}

const BODY_PRIMARY_FIELDS: BodyMeasurementField[] = [
  { type: 'weight', it: 'Peso', en: 'Weight', unit: 'kg' },
]

const BODY_COMPOSITION_FIELDS: BodyMeasurementField[] = [
  { type: 'body_fat_percentage', it: 'Massa grassa', en: 'Body fat', unit: '%' },
  { type: 'lean_body_mass', it: 'Massa magra', en: 'Lean mass', unit: 'kg' },
]

interface BodyPairedZone {
  id: string
  it: string
  en: string
  left: MeasurementType
  right: MeasurementType
}

const BODY_PAIRED_ZONES: BodyPairedZone[] = [
  { id: 'arm', it: 'Braccio', en: 'Arm', left: 'left_arm_circumference', right: 'right_arm_circumference' },
  { id: 'forearm', it: 'Avambraccio', en: 'Forearm', left: 'left_forearm_circumference', right: 'right_forearm_circumference' },
  { id: 'thigh', it: 'Coscia', en: 'Thigh', left: 'left_thigh_circumference', right: 'right_thigh_circumference' },
  { id: 'calf', it: 'Polpaccio', en: 'Calf', left: 'left_calf_circumference', right: 'right_calf_circumference' },
]

const BODY_SINGLE_FIELDS: BodyMeasurementField[] = [
  { type: 'neck_circumference', it: 'Collo', en: 'Neck', unit: 'cm' },
  { type: 'shoulder_circumference', it: 'Spalle', en: 'Shoulders', unit: 'cm' },
  { type: 'waist_circumference', it: 'Vita', en: 'Waist', unit: 'cm' },
  { type: 'hip_circumference', it: 'Fianchi', en: 'Hips', unit: 'cm' },
  { type: 'chest_circumference', it: 'Torace', en: 'Chest', unit: 'cm' },
  { type: 'upper_abdomen_circumference', it: 'Addome superiore', en: 'Upper abdomen', unit: 'cm' },
  { type: 'lower_abdomen_circumference', it: 'Addome inferiore', en: 'Lower abdomen', unit: 'cm' },
]

function parseMeasurementInput(raw: string): number | undefined {
  if (raw.trim() === '') return undefined
  const parsed = Number(raw.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : undefined
}

export function BodyMeasurementAdd({ data, language, measurementUnit, onDone, onSaved }: {
  data: HealthDataController
  language: string
  measurementUnit: (rawValue: string) => string
  onDone: () => void
  onSaved: (count: number) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [when, setWhen] = useState(() => new Date().toISOString().slice(0, 16))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [batchId, setBatchId] = useState<string | null>(null)

  const heightCm = data.profile?.heightCm
  const weight = parseMeasurementInput(values.weight ?? '')
  const bmi = heightCm && heightCm > 0 && weight !== undefined && weight > 0
    ? Math.round((weight / (heightCm / 100) ** 2) * 10) / 10
    : undefined

  const setValue = (type: string, raw: string) => {
    setValues((current) => ({ ...current, [type]: raw }))
  }

  const fieldLabel = (field: { it: string; en: string }) => (language === 'it' ? field.it : field.en)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const measuredAt = new Date(when).toISOString()
    const createdAt = new Date().toISOString()
    const entries: Array<{ type: MeasurementType; value: number }> = []
    for (const field of BODY_PRIMARY_FIELDS) {
      const value = parseMeasurementInput(values[field.type] ?? '')
      if (value !== undefined) entries.push({ type: field.type, value })
    }
    for (const field of BODY_COMPOSITION_FIELDS) {
      const value = parseMeasurementInput(values[field.type] ?? '')
      if (value !== undefined) entries.push({ type: field.type, value })
    }
    for (const zone of BODY_PAIRED_ZONES) {
      const left = parseMeasurementInput(values[zone.left] ?? '')
      const right = parseMeasurementInput(values[zone.right] ?? '')
      if (left !== undefined) entries.push({ type: zone.left, value: left })
      if (right !== undefined) entries.push({ type: zone.right, value: right })
    }
    for (const field of BODY_SINGLE_FIELDS) {
      const value = parseMeasurementInput(values[field.type] ?? '')
      if (value !== undefined) entries.push({ type: field.type, value })
    }
    if (bmi !== undefined) entries.push({ type: 'body_mass_index', value: bmi })
    if (entries.length === 0) {
      setError(language === 'it' ? 'Inserisci almeno un valore.' : 'Enter at least one value.')
      return
    }
    setError('')
    setSaving(true)
    const currentBatchId = batchId ?? createId('body-measurement-batch')
    setBatchId(currentBatchId)
    void (async () => {
      try {
        for (const entry of entries) {
          const measurement: Measurement = {
            id: `${currentBatchId}_${entry.type}`,
            type: entry.type,
            value: entry.value,
            unit: measurementUnit(entry.type),
            measuredAt,
            createdAt,
          }
          await data.saveMeasurement(measurement)
        }
        setBatchId(null)
        onSaved(entries.length)
        onDone()
      } catch {
        setError(language === 'it' ? 'Impossibile salvare tutte le misure. Riprova.' : 'Could not save all measurements. Try again.')
      } finally {
        setSaving(false)
      }
    })()
  }

  return (
    <form className="scroll-data__body-add" onSubmit={submit}>
      <label className="scroll-data__body-when">
        {language === 'it' ? 'Quando' : 'When'}
        <input disabled={saving} onChange={(event) => setWhen(event.target.value)} type="datetime-local" value={when} />
      </label>

      <div className="scroll-data__body-group scroll-data__body-group--primary">
        <h3>{language === 'it' ? 'Essenziale' : 'Essentials'}</h3>
        <div className="scroll-data__body-grid">
          {BODY_PRIMARY_FIELDS.map((field) => (
            <label className="scroll-data__body-field" key={field.type}>
              <span>{fieldLabel(field)}</span>
              <span className="scroll-data__body-input">
                <input disabled={saving} inputMode="decimal" onChange={(event) => setValue(field.type, event.target.value)} value={values[field.type] ?? ''} />
                <small>{field.unit}</small>
              </span>
            </label>
          ))}
          {bmi !== undefined ? (
            <div className="scroll-data__body-field scroll-data__body-field--readonly">
              <span>BMI</span>
              <span className="scroll-data__body-input">
                <output>{bmi}</output>
                <small>kg/m²</small>
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <details className="scroll-data__body-optional">
        <summary>
          <span>{language === 'it' ? 'Composizione' : 'Composition'}</span>
          <small>{language === 'it' ? '2 valori facoltativi' : '2 optional values'}</small>
        </summary>
        <div className="scroll-data__body-group">
          <div className="scroll-data__body-grid">
            {BODY_COMPOSITION_FIELDS.map((field) => (
              <label className="scroll-data__body-field" key={field.type}>
                <span>{fieldLabel(field)}</span>
                <span className="scroll-data__body-input">
                  <input disabled={saving} inputMode="decimal" onChange={(event) => setValue(field.type, event.target.value)} value={values[field.type] ?? ''} />
                  <small>{field.unit}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
      </details>

      <details className="scroll-data__body-optional">
        <summary>
          <span>{language === 'it' ? 'Circonferenze' : 'Circumferences'}</span>
          <small>{language === 'it' ? '4 appaiate · 7 singole' : '4 paired · 7 single'}</small>
        </summary>
        <div className="scroll-data__body-group">
          <h3>{language === 'it' ? 'Appaiate' : 'Paired'}</h3>
          <div className="scroll-data__body-paired">
            {BODY_PAIRED_ZONES.map((zone) => (
              <div className="scroll-data__body-paired-row" key={zone.id}>
                <span className="scroll-data__body-paired-label">{fieldLabel(zone)}</span>
                <label className="scroll-data__body-field">
                  <span>{language === 'it' ? 'Sinistra' : 'Left'}</span>
                  <span className="scroll-data__body-input">
                    <input disabled={saving} inputMode="decimal" onChange={(event) => setValue(zone.left, event.target.value)} value={values[zone.left] ?? ''} />
                    <small>cm</small>
                  </span>
                </label>
                <label className="scroll-data__body-field">
                  <span>{language === 'it' ? 'Destra' : 'Right'}</span>
                  <span className="scroll-data__body-input">
                    <input disabled={saving} inputMode="decimal" onChange={(event) => setValue(zone.right, event.target.value)} value={values[zone.right] ?? ''} />
                    <small>cm</small>
                  </span>
                </label>
              </div>
            ))}
          </div>
        </div>
        <div className="scroll-data__body-group">
          <h3>{language === 'it' ? 'Singole' : 'Single'}</h3>
          <div className="scroll-data__body-grid">
            {BODY_SINGLE_FIELDS.map((field) => (
              <label className="scroll-data__body-field" key={field.type}>
                <span>{fieldLabel(field)}</span>
                <span className="scroll-data__body-input">
                  <input disabled={saving} inputMode="decimal" onChange={(event) => setValue(field.type, event.target.value)} value={values[field.type] ?? ''} />
                  <small>{field.unit}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
      </details>

      {error ? <p aria-live="polite" className="scroll-data__empty" role="alert">{error}</p> : null}
      <div className="scroll-data__add-actions">
        <button className="btn btn--ghost btn--small" disabled={saving} onClick={onDone} type="button">{language === 'it' ? 'Chiudi' : 'Close'}</button>
        <button className="btn btn--primary btn--small" disabled={saving} type="submit">{saving ? (language === 'it' ? 'Salvataggio…' : 'Saving…') : (language === 'it' ? 'Salva' : 'Save')}</button>
      </div>
    </form>
  )
}
