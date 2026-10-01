import { useState } from 'react'
import { CANONICAL_DOMAIN_SPECS } from '../core/canonicalDomains'
import { validateCanonicalFields } from '../core/canonicalForm'
import { toDateTimeLocal } from '../core/format'
import { createId } from '../core/id'
import type { Measurement, MeasurementType } from '../core/types'
import type { HealthDataController } from '../storage/useHealthData'
import { BodyMeasurementAdd } from './BodyMeasurementAdd'
import { measurementTypesFor, type SectionSpec } from './dataScrollModel'

export interface InlineAddProps {
  section: SectionSpec
  data: HealthDataController
  language: string
  measurementLabel: (rawValue: string) => string
  measurementUnit: (rawValue: string) => string
  onDone: () => void
  onSaved: (count: number) => void
}

export function InlineAdd({ section, data, language, measurementLabel, measurementUnit, onDone, onSaved }: InlineAddProps) {
  const types = section.kind === 'measurements' ? measurementTypesFor(section) : []
  const spec = section.domain ? CANONICAL_DOMAIN_SPECS[section.domain] : undefined
  const [type, setType] = useState<string>(types[0] ?? '')
  const [value, setValue] = useState('')
  const [when, setWhen] = useState(() => toDateTimeLocal(new Date().toISOString()))
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    if (section.domain === 'medications') initial.status = 'active'
    if (section.domain === 'appointments') initial.status = 'planned'
    return initial
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (section.id === 'misure') {
    return (
      <BodyMeasurementAdd
        data={data}
        language={language}
        measurementUnit={measurementUnit}
        onDone={onDone}
        onSaved={onSaved}
      />
    )
  }

  if (section.kind === 'measurements') {
    return (
      <form
        className="scroll-data__add"
        onSubmit={(event) => {
          event.preventDefault()
          const parsed = Number(value.replace(',', '.'))
          if (!type) {
            setError(language === 'it' ? 'Scegli il tipo di valore.' : 'Choose a value type.')
            return
          }
          if (value.trim() === '' || !Number.isFinite(parsed)) {
            setError(language === 'it' ? 'Inserisci un numero valido.' : 'Enter a valid number.')
            return
          }
          const measuredDate = new Date(when)
          if (!when || Number.isNaN(measuredDate.getTime())) {
            setError(language === 'it' ? 'Inserisci una data e un orario validi.' : 'Enter a valid date and time.')
            return
          }
          if (saving) return
          setError('')
          const measurement: Measurement = {
            id: createId('measurement'),
            type: type as MeasurementType,
            value: parsed,
            unit: measurementUnit(type),
            measuredAt: measuredDate.toISOString(),
            createdAt: new Date().toISOString(),
          }
          setSaving(true)
          void data.saveMeasurement(measurement)
            .then(() => {
              setValue('')
              onSaved(1)
              onDone()
            })
            .catch(() => setError(language === 'it' ? 'Impossibile salvare il valore. Riprova.' : 'Could not save the value. Try again.'))
            .finally(() => setSaving(false))
        }}
      >
        <label>
          {language === 'it' ? 'Tipo' : 'Type'}
          <select onChange={(event) => setType(event.target.value)} value={type}>
            {types.map((entry) => (
              <option key={entry} value={entry}>{measurementLabel(entry)}</option>
            ))}
          </select>
        </label>
        <label>
          {language === 'it' ? 'Valore' : 'Value'} · {measurementUnit(type)}
          <input
            aria-invalid={Boolean(error)}
            inputMode="decimal"
            onChange={(event) => {
              setError('')
              setValue(event.target.value)
            }}
            required
            value={value}
          />
        </label>
        <label>
          {language === 'it' ? 'Quando' : 'When'}
          <input onChange={(event) => setWhen(event.target.value)} type="datetime-local" value={when} />
        </label>
        {error ? <p aria-live="polite" className="scroll-data__empty" role="alert">{error}</p> : null}
        <div className="scroll-data__add-actions">
          <button className="btn btn--ghost btn--small" disabled={saving} onClick={onDone} type="button">{language === 'it' ? 'Chiudi' : 'Close'}</button>
          <button className="btn btn--primary btn--small" disabled={saving} type="submit">{saving ? (language === 'it' ? 'Salvataggio…' : 'Saving…') : (language === 'it' ? 'Salva' : 'Save')}</button>
        </div>
      </form>
    )
  }

  if (section.kind === 'canonical' && spec) {
    return (
      <form
        className="scroll-data__add"
        onSubmit={(event) => {
          event.preventDefault()
          const invalidKey = validateCanonicalFields(spec, fields)
          const invalid = spec.fields.find((field) => field.key === invalidKey)
          if (invalid) {
            setError(language === 'it'
              ? `${invalid.required ? 'Inserisci' : 'Controlla'}: ${invalid.it}.`
              : `${invalid.required ? 'Enter' : 'Check'}: ${invalid.en}.`)
            return
          }
          setError('')
          const record: Record<string, unknown> = { id: createId(spec.idPrefix) }
          for (const field of spec.fields) {
            const raw = fields[field.key] ?? ''
            if (raw === '') continue
            if (field.type === 'number') record[field.key] = Number(raw.replace(',', '.'))
            else if (field.type === 'boolean') record[field.key] = raw === 'true'
            else if (field.type === 'text-list') record[field.key] = raw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)
            else if (field.type === 'datetime' || field.type === 'date') record[field.key] = new Date(raw).toISOString()
            else record[field.key] = raw
          }
          if (!fields[spec.dateField]) record[spec.dateField] = new Date().toISOString()
          const savedAt = new Date().toISOString()
          record.createdAt = savedAt
          record.updatedAt = savedAt
          if (saving) return
          setSaving(true)
          void data.saveCanonicalRecord(section.domain as string, record)
            .then(() => {
              setFields({})
              onDone()
            })
            .catch(() => setError(language === 'it' ? 'Impossibile salvare il dato. Riprova.' : 'Could not save the record. Try again.'))
            .finally(() => setSaving(false))
        }}
      >
        {spec.fields.map((field) => (
          <label key={field.key}>
            {language === 'it' ? field.it : field.en}
            {field.type === 'select' ? (
              <select
                onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                value={fields[field.key] ?? ''}
              >
                <option value="">—</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>{field.optionLabels?.[option]?.[language === 'it' ? 'it' : 'en'] ?? option}</option>
                ))}
              </select>
            ) : field.type === 'text-list' ? (
              <textarea
                onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                rows={3}
                value={fields[field.key] ?? ''}
              />
            ) : field.type === 'boolean' ? (
              <input
                aria-label={language === 'it' ? field.it : field.en}
                checked={fields[field.key] !== 'false'}
                onChange={(event) => setFields((current) => ({ ...current, [field.key]: String(event.target.checked) }))}
                type="checkbox"
              />
            ) : (
              <input
                inputMode={field.type === 'number' ? 'decimal' : undefined}
                onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                type={field.type === 'datetime' ? 'datetime-local' : field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                value={fields[field.key] ?? ''}
              />
            )}
          </label>
        ))}
        {error ? <p aria-live="polite" className="scroll-data__empty" role="alert">{error}</p> : null}
        <div className="scroll-data__add-actions">
          <button className="btn btn--ghost btn--small" disabled={saving} onClick={onDone} type="button">{language === 'it' ? 'Chiudi' : 'Close'}</button>
          <button className="btn btn--primary btn--small" disabled={saving} type="submit">{saving ? (language === 'it' ? 'Salvataggio…' : 'Saving…') : (language === 'it' ? 'Salva' : 'Save')}</button>
        </div>
      </form>
    )
  }

  return null
}
