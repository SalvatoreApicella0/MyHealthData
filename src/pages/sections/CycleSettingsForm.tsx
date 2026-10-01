import { useState } from 'react'
import type { FormEvent } from 'react'
import { Check } from 'lucide-react'
import type { CycleSettings } from './cycleModel'
import {
  COPY,
  METHOD_LABELS,
  METHOD_OPTIONS,
  validateCycleSettings,
} from './cycleFormsModel'

export function CycleSettingsForm({
  settings,
  language,
  onClose,
  onSave,
}: {
  settings: CycleSettings
  language: 'it' | 'en'
  onClose: () => void
  onSave: (settings: CycleSettings) => void
}) {
  const copy = COPY[language]
  const [cycleLength, setCycleLength] = useState(settings.typicalCycleLength !== undefined ? String(settings.typicalCycleLength) : '')
  const [periodLength, setPeriodLength] = useState(settings.typicalPeriodLength !== undefined ? String(settings.typicalPeriodLength) : '')
  const [method, setMethod] = useState(settings.predictionMethod ?? '')
  const [fertile, setFertile] = useState(settings.showsFertileWindow)
  const [configured, setConfigured] = useState(settings.isConfigured)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validation = validateCycleSettings(cycleLength, periodLength)
    if (validation) return
    const cycle = Number(cycleLength.replace(',', '.'))
    const period = Number(periodLength.replace(',', '.'))
    onSave({
      typicalCycleLength: Number.isFinite(cycle) && cycle > 0 ? cycle : undefined,
      typicalPeriodLength: Number.isFinite(period) && period > 0 ? period : undefined,
      predictionMethod: method || undefined,
      showsFertileWindow: fertile,
      isConfigured: configured,
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>
        {copy.typicalCycle}
        <input
          inputMode="numeric"
          min={1}
          onChange={(event) => setCycleLength(event.target.value)}
          type="number"
          value={cycleLength}
        />
      </label>
      <label>
        {copy.typicalPeriod}
        <input
          inputMode="numeric"
          min={1}
          onChange={(event) => setPeriodLength(event.target.value)}
          type="number"
          value={periodLength}
        />
      </label>
      <label className="full-width">
        {copy.method}
        <select onChange={(event) => setMethod(event.target.value)} value={method}>
          <option value="">{copy.unit}</option>
          {METHOD_OPTIONS.map((option) => (
            <option key={option} value={option}>{METHOD_LABELS[option]?.[language] ?? option}</option>
          ))}
        </select>
      </label>
      <label className="cycle-check full-width">
        <span>
          <input checked={fertile} onChange={(event) => setFertile(event.target.checked)} type="checkbox" />
          {copy.fertileWindowToggle}
        </span>
      </label>
      <label className="cycle-check full-width">
        <span>
          <input checked={configured} onChange={(event) => setConfigured(event.target.checked)} type="checkbox" />
          {copy.configured}
        </span>
      </label>
      <div className="form-actions full-width">
        <button className="btn btn--ghost btn--small" onClick={onClose} type="button">
          {copy.cancel}
        </button>
        <button className="btn btn--primary btn--small" type="submit">
          <Check aria-hidden="true" size={13} />
          {copy.save}
        </button>
      </div>
    </form>
  )
}
