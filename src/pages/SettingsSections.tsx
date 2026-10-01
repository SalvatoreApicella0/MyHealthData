import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  Download,
  ExternalLink,
  Smartphone,
} from 'lucide-react'
import { generateDoctorReportHtml } from '../reports/htmlReport'
import type { BiologicalSex, LocalProfile } from '../core/types'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'
import { webBuildIdentity, WEB_VERSION } from '../core/buildInfo'

export function ProfileSection({ data }: { data: HealthDataController }) {
  const { t, language } = useI18n()
  const [profile, setProfile] = useState<LocalProfile>(() => data.profile ?? { id: 'local-profile', updatedAt: new Date().toISOString() })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (data.profile) {
      setProfile(data.profile)
    }
  }, [data.profile])

  const update = <Key extends keyof LocalProfile>(key: Key, value: LocalProfile[Key]) =>
    setProfile((current) => ({ ...current, [key]: value }))

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (saving) return
        setSaving(true)
        setError('')
        void data.saveProfile({ ...profile, id: 'local-profile', updatedAt: new Date().toISOString() })
          .catch(() => setError(language === 'it' ? 'Impossibile salvare il profilo. Riprova.' : 'Could not save the profile. Try again.'))
          .finally(() => setSaving(false))
      }}
    >
      <section className="panel">
        <h3 className="settings-group">{language === 'it' ? 'Dati di base' : 'Baseline'}</h3>
        <div className="settings-grid">
          <label>
            {language === 'it' ? 'Nome o alias' : 'Name or alias'}
            <input disabled={saving} onChange={(event) => update('alias', event.target.value)} value={profile.alias ?? ''} />
          </label>
          <label>
            {language === 'it' ? 'Data di nascita' : 'Birth date'}
            <input disabled={saving} onChange={(event) => update('birthDate', event.target.value)} type="date" value={profile.birthDate ?? ''} />
          </label>
          <label>
            {language === 'it' ? 'Sesso biologico' : 'Biological sex'}
            <select
              disabled={saving}
              onChange={(event) => update('biologicalSex', (event.target.value || undefined) as BiologicalSex | undefined)}
              value={profile.biologicalSex ?? ''}
            >
              <option value="">{language === 'it' ? 'Non indicato' : 'Not set'}</option>
              <option value="female">{language === 'it' ? 'Femmina' : 'Female'}</option>
              <option value="male">{language === 'it' ? 'Maschio' : 'Male'}</option>
              <option value="intersex">{language === 'it' ? 'Intersessuale' : 'Intersex'}</option>
              <option value="unspecified">{language === 'it' ? 'Preferisco non dirlo' : 'Prefer not to say'}</option>
            </select>
          </label>
          <label>
            {language === 'it' ? 'Genere' : 'Gender'}
            <input disabled={saving} onChange={(event) => update('gender', event.target.value)} value={profile.gender ?? ''} />
          </label>
          <label>
            {language === 'it' ? 'Altezza, cm' : 'Height, cm'}
            <input
              inputMode="decimal"
              disabled={saving}
              onChange={(event) => update('heightCm', event.target.value === '' ? undefined : Number(event.target.value))}
              value={profile.heightCm ?? ''}
            />
          </label>
          <label>
            {language === 'it' ? 'Peso attuale, kg' : 'Current weight, kg'}
            <input
              inputMode="decimal"
              disabled={saving}
              onChange={(event) => update('currentWeightKg', event.target.value === '' ? undefined : Number(event.target.value))}
              value={profile.currentWeightKg ?? ''}
            />
          </label>
        </div>
      </section>

      <section className="panel">
        <h3 className="settings-group">{language === 'it' ? 'Note cliniche' : 'Clinical notes'}</h3>
        <div className="settings-grid">
          <label>
            {language === 'it' ? 'Allergie note' : 'Known allergies'}
            <textarea disabled={saving} onChange={(event) => update('knownAllergies', event.target.value)} value={profile.knownAllergies ?? ''} />
          </label>
          <label>
            {language === 'it' ? 'Farmaci abituali' : 'Regular medications'}
            <textarea disabled={saving} onChange={(event) => update('regularMedications', event.target.value)} value={profile.regularMedications ?? ''} />
          </label>
          <label>
            {language === 'it' ? 'Condizioni note' : 'Known conditions'}
            <textarea disabled={saving} onChange={(event) => update('knownConditions', event.target.value)} value={profile.knownConditions ?? ''} />
          </label>
          <label>
            {language === 'it' ? 'Note personali' : 'Personal notes'}
            <textarea disabled={saving} onChange={(event) => update('personalNotes', event.target.value)} value={profile.personalNotes ?? ''} />
          </label>
        </div>
      </section>

      {error ? <p aria-live="polite" className="settings-error" role="alert">{error}</p> : null}
      <div className="settings-save">
        <button className="btn btn--primary" disabled={saving} type="submit">
          {saving ? (language === 'it' ? 'Salvataggio…' : 'Saving…') : t('common.save')}
        </button>
      </div>
    </form>
  )
}

export function ModulesSection() {
  const { t } = useI18n()

  return (
    <section className="panel settings-row-panel">
      <span className="settings-field-label">{t('common.language')}</span>
      <span className="settings-value">{t('common.italian')}</span>
    </section>
  )
}

interface HubDevice {
  id: string
  name: string
  type: string
  pairedAt: string
  protocolVersion: string
  state: string
}

export function DevicesSection() {
  const { t, language, formatDate } = useI18n()
  const [devices, setDevices] = useState<HubDevice[]>([])
  const [pairingCode, setPairingCode] = useState<string>()
  const [qrCode, setQRCode] = useState<string>()
  const [error, setError] = useState<string>()
  const [hubAvailable, setHubAvailable] = useState(true)

  const refresh = async () => {
    try {
      const response = await fetch('/api/v1/devices', { headers: { accept: 'application/json' } })
      if (!response.ok) {
        throw new Error('hub_unavailable')
      }
      const payload = (await response.json()) as { devices?: HubDevice[] }
      setDevices(payload.devices ?? [])
      setHubAvailable(true)
      setError(undefined)
    } catch {
      setHubAvailable(false)
      setError(language === 'it' ? 'Hub non raggiungibile da questa pagina.' : 'Hub is not reachable from this page.')
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createPairing = async () => {
    try {
      const response = await fetch('/api/v1/pairings', { method: 'POST', headers: { accept: 'application/json' } })
      if (!response.ok) {
        throw new Error('pairing_failed')
      }
      const value = JSON.stringify(await response.json())
      setPairingCode(value)
      setQRCode(await QRCode.toDataURL(value, { width: 280, margin: 2, errorCorrectionLevel: 'M' }))
      setError(undefined)
      await refresh()
    } catch {
      setError(language === 'it' ? 'Impossibile creare un codice di pairing.' : 'Could not create a pairing code.')
    }
  }

  const revoke = async (id: string) => {
    await fetch(`/api/v1/devices/${id}/revoke`, { method: 'POST' })
    await refresh()
  }

  return (
    <section className="page-stack">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>{t('devices.title')}</h2>
            <p>{t('devices.subtitle')}</p>
          </div>
        </div>
        {hubAvailable ? (
          <div className="two-column" style={{ alignItems: 'start' }}>
            <div>
              <button className="btn btn--primary" onClick={() => void createPairing()} type="button">
                <Smartphone size={17} />
                {language === 'it' ? 'Genera codice di pairing' : 'Generate pairing code'}
              </button>
              {pairingCode ? (
                <details style={{ marginTop: 12 }}>
                  <summary className="small-copy">{language === 'it' ? 'Incolla il codice invece di scansionarlo' : 'Paste the code instead of scanning'}</summary>
                  <textarea aria-label="Hub pairing code" readOnly style={{ marginTop: 8 }} value={pairingCode} />
                </details>
              ) : null}
            </div>
            <div>
              {qrCode ? (
                <img
                  alt={language === 'it' ? 'Codice QR monouso per il pairing MyHealthData Hub' : 'Single-use MyHealthData Hub pairing QR code'}
                  className="pairing-qr"
                  height={280}
                  src={qrCode}
                  width={280}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <div className="banner banner--warn">
            <Smartphone aria-hidden="true" size={18} />
            <span>
              {language === 'it'
                ? 'Apri questa pagina dal MyHealthData Hub desktop per generare un codice di pairing. La Web app standalone resta completamente utilizzabile senza Hub.'
                : 'Open this page from the MyHealthData Hub desktop app to generate a pairing code. The standalone Web app stays fully usable without a Hub.'}
            </span>
          </div>
        )}
        {error && hubAvailable ? <p className="banner banner--error">{error}</p> : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>{language === 'it' ? 'Dispositivi collegati' : 'Paired devices'}</h2>
          <span className="tag">{devices.length}</span>
        </div>
        {devices.length === 0 ? (
          <p className="empty-state">{language === 'it' ? 'Ancora nessun dispositivo collegato.' : 'No paired device yet.'}</p>
        ) : (
          <div className="list">
            {devices.map((device) => (
              <div className="row" key={device.id}>
                <span className="row__main">
                  <span className="row__title">{device.name}</span>
                  <span className="row__detail">
                    {device.type} · {language === 'it' ? 'protocollo' : 'protocol'} {device.protocolVersion} ·{' '}
                    {formatDate(device.pairedAt, { dateStyle: 'medium' })}
                  </span>
                </span>
                <span className="row__side">
                  <span className="tag">{device.state}</span>
                  {device.state === 'active' ? (
                    <button className="btn btn--small btn--danger" onClick={() => void revoke(device.id)} type="button">
                      {language === 'it' ? 'Revoca' : 'Revoke'}
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export function PrivacySection() {
  const { language } = useI18n()
  return (
    <section className="panel">
      <p className="small-copy">
        {language === 'it'
          ? 'I dati restano su questo dispositivo (IndexedDB) finché non esporti un file cifrato con la tua passphrase. Nessun account, nessuna telemetria e nessun caricamento automatico: se colleghi un Hub, la sincronizzazione parte solo per i dati che scegli di usare con quel Hub. Gli allegati vengono conservati come file locali e, quando l’Hub è collegato, sincronizzati separatamente dai record. MyHealthData non è un dispositivo medico e non fornisce diagnosi o terapie.'
          : 'Data stays on this device (IndexedDB) until you export an encrypted file with your passphrase. No account, no telemetry and no automatic upload: when you connect a Hub, synchronization only covers data you choose to use with that Hub. Attachments are stored as local files and, when the Hub is connected, synchronized separately from records. MyHealthData is not a medical device and does not provide diagnosis or treatment.'}
      </p>
    </section>
  )
}

export function ReportSection({ data }: { data: HealthDataController }) {
  const { t, language } = useI18n()
  const reportSnapshot = useMemo(() => ({
    profile: data.profile,
    events: data.events,
    measurements: data.measurements,
    documents: data.documents,
  }), [data.profile, data.events, data.measurements, data.documents])
  const reportHtml = useMemo(() => generateDoctorReportHtml(reportSnapshot), [reportSnapshot])

  const download = () => {
    const blob = new Blob([reportHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `myhealthdata-report-${new Date().toISOString().slice(0, 10)}.html`
    anchor.rel = 'noopener'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="page-stack">
      <div className="module-toolbar">
        <div className="chip-row">
          <button className="btn btn--primary" onClick={download} type="button">
            <Download size={17} />
            {language === 'it' ? 'Scarica HTML' : 'Download HTML'}
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              const blob = new Blob([reportHtml], { type: 'text/html' })
              const url = URL.createObjectURL(blob)
              window.open(url, '_blank', 'noopener,noreferrer')
            }}
            type="button"
          >
            <ExternalLink size={17} />
            {language === 'it' ? 'Apri anteprima' : 'Open preview'}
          </button>
        </div>
      </div>
      <iframe
        className="report-preview"
        sandbox=""
        srcDoc={reportHtml}
        title={t('report.title')}
      />
    </section>
  )
}

export function AboutSection() {
  const { language } = useI18n()
  const buildIdentity = webBuildIdentity()
  return (
    <section className="panel">
      <dl className="kv-list">
        <div className="kv">
          <dt>{language === 'it' ? 'Versione Web' : 'Web version'}</dt>
          <dd>{WEB_VERSION}</dd>
        </div>
        <div className="kv">
          <dt>{language === 'it' ? 'Build servita' : 'Served build'}</dt>
          <dd>{buildIdentity}</dd>
        </div>
        <div className="kv">
          <dt>{language === 'it' ? 'Licenza' : 'License'}</dt>
          <dd>MIT</dd>
        </div>
      </dl>
    </section>
  )
}
