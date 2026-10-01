import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'
import { tintStyle } from './moduleViewSupport'

/* ---------------------------------------------------------- share for care */

const SHARE_DOMAINS: Array<{ key: string; it: string; en: string }> = [
  { key: 'profile', it: 'Profilo', en: 'Profile' },
  { key: 'events', it: 'Sintomi ed eventi', en: 'Symptoms and events' },
  { key: 'measurements', it: 'Misure', en: 'Measurements' },
  { key: 'documents', it: 'Documenti', en: 'Documents' },
  { key: 'labResults', it: 'Analisi', en: 'Lab results' },
  { key: 'medications', it: 'Farmaci', en: 'Medications' },
  { key: 'appointments', it: 'Appuntamenti', en: 'Appointments' },
  { key: 'sleepSessions', it: 'Sonno', en: 'Sleep' },
  { key: 'cycleEntries', it: 'Ciclo', en: 'Cycle' },
  { key: 'gymWorkouts', it: 'Allenamenti', en: 'Workouts' },
]

/**
 * "Condividi per il medico": the user explicitly chooses which domains leave
 * the vault. The app itself sends nothing anywhere — the user downloads a file
 * and decides what to do with it.
 */
export function ShareModuleView({ data }: { data: HealthDataController }) {
  const { language } = useI18n()
  const source = data as unknown as Record<string, unknown>
  const [selected, setSelected] = useState<string[]>(['profile', 'measurements', 'documents'])
  const [includeNotes, setIncludeNotes] = useState(false)

  const toggle = (key: string) =>
    setSelected((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]))

  const download = () => {
    const payload: Record<string, unknown> = {
      manifest: {
        app: 'MyHealthData',
        schemaVersion: '0.1.0',
        exportedAt: new Date().toISOString(),
        purpose: 'share-for-care',
      },
    }

    for (const key of selected) {
      const value = source[key]
      if (value === undefined) {
        continue
      }
      if (!includeNotes && (key === 'events' || key === 'measurements')) {
        const records = Array.isArray(value) ? value : []
        payload[key] = records.map((record) => {
          if (typeof record !== 'object' || record === null) {
            return record
          }
          const { note: _note, ...rest } = record as Record<string, unknown>
          return rest
        })
      } else {
        payload[key] = value
      }
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `myhealthdata-per-il-medico-${new Date().toISOString().slice(0, 10)}.json`
    anchor.rel = 'noopener'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="page-stack">
      <div className="banner banner--warn">
        <Share2 aria-hidden="true" size={18} />
        <span>
          {language === 'it'
            ? 'Scegli esplicitamente quali sezioni condividere. Il file viene creato sul tuo dispositivo: MyHealthData non invia nulla.'
            : 'Explicitly choose which sections to share. The file is created on your device: MyHealthData sends nothing.'}
        </span>
      </div>

      <section className="panel">
        <div className="panel__header">
          <h2>{language === 'it' ? 'Sezioni da includere' : 'Sections to include'}</h2>
          <span className="tag">
            {selected.length}/{SHARE_DOMAINS.length}
          </span>
        </div>
        <div className="chip-row">
          {SHARE_DOMAINS.map((domain) => (
            <button
              aria-pressed={selected.includes(domain.key)}
              className="chip"
              key={domain.key}
              onClick={() => toggle(domain.key)}
              style={tintStyle('#32ADE6')}
              type="button"
            >
              {selected.includes(domain.key) ? <Check size={14} /> : null}
              {language === 'it' ? domain.it : domain.en}
              <span className="tag">
                {Array.isArray(source[domain.key]) ? (source[domain.key] as unknown[]).length : source[domain.key] ? 1 : 0}
              </span>
            </button>
          ))}
        </div>

        <label className="chip" style={{ marginTop: 14, width: 'fit-content' }}>
          <input
            checked={includeNotes}
            onChange={(event) => setIncludeNotes(event.target.checked)}
            style={{ minHeight: 0, width: 'auto' }}
            type="checkbox"
          />
          {language === 'it' ? 'Includi le note personali' : 'Include personal notes'}
        </label>

        <div className="form-actions" style={{ marginTop: 16 }}>
          <button className="btn btn--primary" disabled={selected.length === 0} onClick={download} type="button">
            <Share2 size={17} />
            {language === 'it' ? 'Crea pacchetto per il medico' : 'Create care package'}
          </button>
        </div>
        <p className="small-copy" style={{ marginTop: 10 }}>
          {language === 'it'
            ? 'Per dati più sensibili usa l’export cifrato in Impostazioni → Dati e backup.'
            : 'For more sensitive data use the encrypted export in Settings → Data and backup.'}
        </p>
      </section>
    </section>
  )
}
