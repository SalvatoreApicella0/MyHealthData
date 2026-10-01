import { useMemo, useRef, useState } from 'react'
import { Download, Import, Lock, Trash2 } from 'lucide-react'
import { decryptMhdExport, encryptMhdExport, isEncryptedMhdExport } from '../crypto/mhdCrypto'
import { createExportFile, parseMhdExportFile } from '../core/schema'
import { IMPORT_LIMITS } from '../core/schema'
import type { HealthDataSnapshot } from '../core/types'
import type { HealthDataController } from '../storage/useHealthData'
import { useI18n } from '../i18n'

interface DataTransferPanelProps {
  data: HealthDataController
  /** Canonical domains are exported untouched, exactly like the iOS vault. */
  includeCanonical?: boolean
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.click()
  URL.revokeObjectURL(url)
}

function toSnapshot(data: HealthDataController, includeCanonical: boolean): HealthDataSnapshot {
  const base: HealthDataSnapshot = {
    profile: data.profile,
    events: data.events,
    measurements: data.measurements,
    documents: data.documents,
  }

  if (!includeCanonical) {
    return base
  }

  const source = data as unknown as Record<string, unknown>

  // Copy every data field, not a fixed list: an unknown domain that arrived
  // from a newer iOS build must survive an import → export cycle untouched.
  const skipped = new Set([
    'profile',
    'events',
    'measurements',
    'documents',
    'loading',
    'error',
    'refresh',
    'saveProfile',
    'saveEvent',
    'deleteEvent',
    'saveMeasurement',
    'deleteMeasurement',
    'saveDocument',
    'deleteDocument',
    'replaceAll',
    'clearAll',
    'saveCanonicalRecord',
    'deleteCanonicalRecord',
  ])

  for (const [key, value] of Object.entries(source)) {
    if (skipped.has(key) || typeof value === 'function' || value === undefined) {
      continue
    }
    base[key] = value
  }

  return base
}

export function DataTransferPanel({ data, includeCanonical = true }: DataTransferPanelProps) {
  const { t, language } = useI18n()
  const [passphrase, setPassphrase] = useState('')
  const [importPassphrase, setImportPassphrase] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'error' | 'success'>('idle')
  const [clearing, setClearing] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ file: ReturnType<typeof parseMhdExportFile>; name: string }>()
  const [importing, setImporting] = useState(false)
  const importInFlight = useRef(false)

  const exportFile = useMemo(
    () => createExportFile(toSnapshot(data, includeCanonical)),
    [data, includeCanonical],
  )

  const report = (text: string, nextStatus: 'error' | 'success') => {
    setMessage(text)
    setStatus(nextStatus)
  }

  const handlePlainExport = () => {
    downloadJson(`myhealthdata-${exportFile.manifest.exportedAt.slice(0, 10)}.mhd.json`, exportFile)
    report(language === 'it' ? 'Export JSON creato in locale.' : 'Plain JSON export created locally.', 'success')
  }

  const handleEncryptedExport = async () => {
    try {
      const encrypted = await encryptMhdExport(exportFile, passphrase)
      downloadJson(`myhealthdata-${encrypted.manifest.exportedAt.slice(0, 10)}.mhd.enc.json`, encrypted)
      report(
        language === 'it'
          ? 'Export cifrato creato. Conserva la passphrase: non viene salvata da nessuna parte.'
          : 'Encrypted export created. Keep the passphrase safe; it is never stored.',
        'success',
      )
    } catch (cause) {
      report(cause instanceof Error ? cause.message : 'Encrypted export failed.', 'error')
    }
  }

  const handleImport = async (file: File) => {
    if (importInFlight.current) return
    importInFlight.current = true
    setImporting(true)
    setPendingImport(undefined)
    setMessage('')
    try {
      if (file.size > IMPORT_LIMITS.maxFileBytes) {
        throw new Error(
          language === 'it'
            ? `File troppo grande: il limite è ${Math.round(IMPORT_LIMITS.maxFileBytes / (1024 * 1024))} MB.`
            : `File too large: the limit is ${Math.round(IMPORT_LIMITS.maxFileBytes / (1024 * 1024))} MB.`,
        )
      }
      const parsed = JSON.parse(await file.text()) as unknown
      const mhdFile = isEncryptedMhdExport(parsed)
        ? await decryptMhdExport(parsed, importPassphrase)
        : parseMhdExportFile(parsed)
      setPendingImport({ file: mhdFile, name: file.name })
    } catch (cause) {
      report(cause instanceof Error ? cause.message : (language === 'it' ? 'Impossibile leggere il file. Controlla il formato e riprova.' : 'Could not read the file. Check its format and try again.'), 'error')
    } finally {
      importInFlight.current = false
      setImporting(false)
    }
  }

  const confirmImport = async () => {
    if (!pendingImport || importInFlight.current) return
    const mhdFile = pendingImport.file
    importInFlight.current = true
    setImporting(true)
    setMessage('')
    try {
      await data.replaceAll({
        ...mhdFile,
        profile: mhdFile.profile,
        events: mhdFile.events,
        measurements: mhdFile.measurements,
        documents: mhdFile.documents,
      })
      report(
        language === 'it'
          ? `Importati ${mhdFile.events.length} eventi, ${mhdFile.measurements.length} misure e ${mhdFile.documents.length} documenti.`
          : `Imported ${mhdFile.events.length} events, ${mhdFile.measurements.length} measurements and ${mhdFile.documents.length} documents.`,
        'success',
      )
      setPendingImport(undefined)
    } catch {
      report(language === 'it' ? 'Impossibile importare i dati. Riprova.' : 'Could not import the data. Try again.', 'error')
    } finally {
      importInFlight.current = false
      setImporting(false)
    }
  }

  return (
    <div className="two-column">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>{language === 'it' ? 'Esporta' : 'Export'}</h2>
            <p>{language === 'it'
              ? 'Salva una copia del profilo e di tutti i dati. I file allegati non sono inclusi: vengono salvati solo i loro riferimenti.'
              : 'Save a copy of your profile and all records. Attached files are not included; only their references are saved.'}</p>
          </div>
        </div>
        <div className="form-grid form-grid--single">
          <button className="btn btn--primary" onClick={handlePlainExport} type="button">
            <Download size={18} />
            {language === 'it' ? 'Esporta .mhd.json' : 'Export .mhd.json'}
          </button>
          <label>
            {language === 'it' ? 'Passphrase per l’export cifrato' : 'Passphrase for encrypted export'}
            <input
              autoComplete="new-password"
              minLength={12}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder={language === 'it' ? 'Almeno 12 caratteri' : 'At least 12 characters'}
              type="password"
              value={passphrase}
            />
          </label>
          <button
            className="btn btn--tinted"
            disabled={passphrase.length < 12}
            onClick={() => void handleEncryptedExport()}
            style={{ '--tint': '#29458F' } as React.CSSProperties}
            type="button"
          >
            <Lock size={18} />
            {language === 'it' ? 'Esporta copia cifrata' : 'Export encrypted copy'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h2>{language === 'it' ? 'Ripristina' : 'Restore'}</h2>
            <p>{language === 'it'
              ? 'Scegli una copia dei dati e rivedi il contenuto prima di sostituire il vault attuale.'
              : 'Choose a backup and review its contents before replacing your current vault.'}</p>
          </div>
        </div>
        <label>
          {language === 'it' ? 'Passphrase per l’import cifrato' : 'Passphrase for encrypted import'}
          <input
            autoComplete="current-password"
            onChange={(event) => setImportPassphrase(event.target.value)}
            type="password"
            value={importPassphrase}
          />
        </label>
        <label className="file-drop">
          <Import size={22} />
          {language === 'it' ? 'Scegli un file .mhd.json o .mhd.enc.json' : 'Choose a .mhd.json or .mhd.enc.json file'}
          <input
            accept=".json,.mhd,.enc,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleImport(file)
              }
            }}
            disabled={importing || clearing}
            type="file"
          />
        </label>
        {importing ? <p role="status">{language === 'it' ? 'Elaborazione del file…' : 'Processing file…'}</p> : null}
        {pendingImport ? (
          <section className="import-review" aria-label={language === 'it' ? 'Rivedi importazione' : 'Review import'}>
            <h3>{language === 'it' ? 'Rivedi il file prima di importare' : 'Review the file before importing'}</h3>
            <p>{pendingImport.name}</p>
            <p>{language === 'it'
              ? `${pendingImport.file.events.length} eventi · ${pendingImport.file.measurements.length} misure · ${pendingImport.file.documents.length} documenti`
              : `${pendingImport.file.events.length} events · ${pendingImport.file.measurements.length} measurements · ${pendingImport.file.documents.length} documents`}</p>
            <p>{language === 'it'
              ? `${Object.entries(pendingImport.file).filter(([key, value]) => !['events', 'measurements', 'documents'].includes(key) && Array.isArray(value)).reduce((count, [, value]) => count + (value as unknown[]).length, 0)} registrazioni negli altri moduli`
              : `${Object.entries(pendingImport.file).filter(([key, value]) => !['events', 'measurements', 'documents'].includes(key) && Array.isArray(value)).reduce((count, [, value]) => count + (value as unknown[]).length, 0)} entries in other modules`}</p>
            <p>{language === 'it' ? 'L’importazione sostituisce i dati attuali. Esporta prima una copia se vuoi conservarli.' : 'Import replaces your current data. Export a copy first if you want to keep it.'}</p>
            <div className="chip-row">
              <button className="btn btn--ghost" disabled={importing} onClick={() => { setPendingImport(undefined); setMessage('') }} type="button">{language === 'it' ? 'Annulla importazione' : 'Cancel import'}</button>
              <button className="btn btn--primary" disabled={importing} onClick={() => void confirmImport()} type="button">{language === 'it' ? 'Sostituisci i dati con questo file' : 'Replace data with this file'}</button>
            </div>
          </section>
        ) : null}
        <button
          className="btn btn--danger"
          disabled={clearing || importing}
          onClick={() => {
            if (!window.confirm(t('common.delete') + '?') || clearing) return
            setClearing(true)
            setMessage('')
            void data.clearAll()
              .then(() => report(language === 'it' ? 'Dati locali eliminati.' : 'Local records cleared.', 'success'))
              .catch(() => report(language === 'it' ? 'Impossibile eliminare i dati locali. Riprova.' : 'Local data could not be cleared. Try again.', 'error'))
              .finally(() => setClearing(false))
          }}
          type="button"
        >
          <Trash2 size={18} />
          {clearing ? (language === 'it' ? 'Eliminazione…' : 'Clearing…') : (language === 'it' ? 'Elimina dati locali' : 'Clear local data')}
        </button>
      </section>

      {message ? (
        <p className={status === 'error' ? 'banner banner--error full-width' : 'banner banner--info full-width'} role={status === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      ) : null}
    </div>
  )
}
