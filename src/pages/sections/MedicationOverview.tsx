import { ProgressiveHistory } from '../../components/ProgressiveHistory'
import { AlertTriangle, BellRing, Pencil, Plus } from 'lucide-react'
import {
  asNumber,
  asString,
  doseStatusLabel,
  formatDay,
  formatMoment,
  medicationStatus,
  medStatusLabel,
  scheduleSummary,
  scheduledTimes,
  timeLabel,
} from './medicationsModel'
import type { Row } from './medicationsModel'

interface MedicationListProps {
  medications: Row[]
  language: string
  onEdit: (medication: Row) => void
  onLogDose: (medication: Row) => void
}

export function MedicationList({ medications, language, onEdit, onLogDose }: MedicationListProps) {
  const it = language !== 'en'

  return (
    <ul className="meds-list">
      {medications.map((medication, index) => {
        const name = asString(medication.name) ?? (it ? 'Terapia' : 'Therapy')
        const dose = asString(medication.dose)
        const status = medicationStatus(medication)
        const times = scheduledTimes(medication)
        const stock = asNumber(medication.stockQuantity)
        const threshold = asNumber(medication.refillThreshold)
        const lowStock = stock !== undefined && threshold !== undefined && stock <= threshold
        const reminders = medication.remindersEnabled === true
        const start = formatDay(medication.startDate ?? medication.startedAt, language)
        const end = formatDay(medication.endDate ?? medication.endedAt, language)
        const reason = asString(medication.reason)
        const note = asString(medication.note)

        return (
          <li className="meds-item" key={asString(medication.id) ?? `${name}-${index}`}>
            <div className="meds-item-head">
              <div className="meds-item-main">
                <span className="meds-name">{name}</span>
                {dose ? <span className="meds-dose">{dose}</span> : null}
                <span className="meds-schedule">{scheduleSummary(medication, it)}</span>
              </div>
              <div className="meds-chips">
                <span className={`meds-status meds-status--${status}`}>{medStatusLabel(status, it)}</span>
                {lowStock ? (
                  <span className="meds-warn">
                    <AlertTriangle size={12} />
                    {it ? 'Scorta bassa' : 'Low stock'}
                  </span>
                ) : null}
                {reminders ? (
                  <span className="meds-flag">
                    <BellRing size={12} />
                    {it ? 'Promemoria' : 'Reminders'}
                  </span>
                ) : null}
              </div>
            </div>

            <button className="btn btn--ghost btn--small meds-edit" onClick={() => onEdit(medication)} type="button">
              <Pencil size={13} /> {it ? 'Modifica' : 'Edit'}
            </button>

            <button
              aria-label={it ? `Registra dose di ${name}` : `Log dose of ${name}`}
              className="btn btn--ghost btn--small meds-dose-action"
              onClick={() => onLogDose(medication)}
              type="button"
            >
              <Plus size={14} />
              {it ? 'Registra dose' : 'Log dose'}
            </button>

            {times.length > 0 ? (
              <div className="meds-times">
                {times.map((time) => (
                  <span className="meds-time" key={timeLabel(time)}>
                    {timeLabel(time)}
                  </span>
                ))}
              </div>
            ) : null}

            {start || end || stock !== undefined || reason || note ? (
              <div className="meds-meta">
                {start || end ? (
                  <span className="meds-meta-item">
                    {start || '—'}
                    {end ? ` → ${end}` : ''}
                  </span>
                ) : null}
                {stock !== undefined ? (
                  <span className="meds-meta-item">
                    {it ? 'Scorta' : 'Stock'} {stock}
                    {threshold !== undefined ? ` · ${it ? 'soglia' : 'threshold'} ${threshold}` : ''}
                  </span>
                ) : null}
                {reason ? (
                  <span className="meds-meta-item">
                    {it ? 'Motivo' : 'Reason'}: {reason}
                  </span>
                ) : null}
                {note ? <span className="meds-meta-item meds-meta-note">{note}</span> : null}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

interface MedicationNextDosesProps {
  nextDoses: Array<{ medication: Row; at: Date }>
  language: string
  onLogDose: (medication: Row) => void
}

export function MedicationNextDoses({ nextDoses, language, onLogDose }: MedicationNextDosesProps) {
  const it = language !== 'en'
  if (nextDoses.length === 0) return null

  return (
    <div className="meds-next" aria-label={it ? 'Prossime dosi' : 'Next doses'}>
      <div className="meds-next__heading">
        <h3>{it ? 'Prossime dosi' : 'Next doses'}</h3>
        <span>{it ? 'oggi' : 'today'}</span>
      </div>
      <ul className="meds-next__list">
        {nextDoses.map(({ medication, at }) => (
          <li key={String(medication.id)}>
            <span className="meds-next__time">{at.toLocaleTimeString(it ? 'it-IT' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            <strong>{asString(medication.name) ?? (it ? 'Farmaco' : 'Medication')}</strong>
            <button className="btn btn--ghost btn--small" onClick={() => onLogDose(medication)} type="button">
              {it ? 'Registra' : 'Log dose'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface MedicationAdherenceProps {
  taken: number
  total: number
  adherence: number
  language: string
}

export function MedicationAdherence({ taken, total, adherence, language }: MedicationAdherenceProps) {
  const it = language !== 'en'

  return (
    <div className="meds-adherence">
      <div className="meds-adherence-head">
        <span>{it ? 'Aderenza · 7 giorni' : 'Adherence · 7 days'}</span>
        {total > 0 ? <strong className="meds-adherence-value">{adherence}%</strong> : null}
      </div>
      {total > 0 ? (
        <>
          <div className="meds-bar" role="img" aria-label={`${adherence}%`}>
            <span className="meds-bar-fill" style={{ width: `${adherence}%` }} />
          </div>
          <span className="meds-adherence-meta">
            {it ? `${taken} prese su ${total} dosi` : `${taken} taken of ${total} doses`}
          </span>
        </>
      ) : (
        <p className="meds-empty">
          {it ? "Dati insufficienti per calcolare l'aderenza." : 'Not enough data to compute adherence.'}
        </p>
      )}
    </div>
  )
}

interface MedicationRecentDosesProps {
  recent: Row[]
  language: string
  medicationName: (event: Row) => string
}

export function MedicationRecentDoses({ recent, language, medicationName }: MedicationRecentDosesProps) {
  const it = language !== 'en'

  return (
    <div className="meds-recent">
      <h3 className="meds-recent-title">{it ? 'Dosi recenti' : 'Recent doses'}</h3>
      {recent.length === 0 ? (
        <p className="meds-empty">{it ? 'Nessuna dose registrata.' : 'No doses recorded.'}</p>
      ) : (
        <ProgressiveHistory items={recent} initialCount={5} language={language}>
          {(visible) => (
          <ul className="meds-events">
          {visible.map((event, index) => {
            const status = asString(event.status) ?? 'taken'
            const at = event.recordedAt ?? event.scheduledAt
            return (
              <li className="meds-event" key={asString(event.id) ?? `event-${index}`}>
                <span className={`meds-dot meds-dot--${status}`} />
                <span className="meds-event-name">{medicationName(event)}</span>
                <span className={`meds-event-status meds-event-status--${status}`}>
                  {doseStatusLabel(status, it)}
                </span>
                <span className="meds-event-time">{formatMoment(at, language)}</span>
              </li>
            )
          })}
        </ul>
          )}
        </ProgressiveHistory>
      )}
    </div>
  )
}
