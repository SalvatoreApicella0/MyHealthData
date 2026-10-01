import { useEffect, useMemo, useRef, useState } from 'react'
import { DOCUMENT_TYPES } from '../core/constants'
import { snapshotRecords } from '../core/healthModules'
import { parseLabReportText, type ParsedLabCandidate } from '../core/labReportParser'
import { createId } from '../core/id'
import { isValidDateInput } from '../core/canonicalForm'
import { dateInputValue, sortDateLike } from '../core/dateValues'
import type { AttachmentMetadata, BodyRegionId, DocumentType, HealthDocument } from '../core/types'
import type { HealthDataController } from '../storage/useHealthData'
import { getAttachmentBlob } from '../storage/repository'
import { AttachmentAccessError, loadVerifiedAttachment } from '../storage/attachmentAccess'
import { healthDataErrorCode } from '../storage/errorCodes'
import { useI18n } from '../i18n'
import { DocumentsEditor } from './DocumentsEditor'
import { DocumentsList } from './DocumentsList'
import { documentErrorMessage, isPdfAttachment } from './documentsModel'
import './documentsPage.css'

/**
 * Documents module.
 *
 * The iOS app keeps full attachments inside its encrypted vault; the Web vault
 * stores document records plus a local copy of attachment bytes. When a Hub is
 * available, both the record and the binary are replicated through separate
 * bounded channels.
 */
export function DocumentsModuleView({ data }: { data: HealthDataController }) {
  const { t, language, formatDate, formatNumber } = useI18n()
  const [title, setTitle] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType>('medical_report')
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [ocrText, setOcrText] = useState('')
  const [bodyRegionId, setBodyRegionId] = useState<BodyRegionId | ''>('')
  const [linkedModuleId, setLinkedModuleId] = useState('')
  const [linkedAppointmentId, setLinkedAppointmentId] = useState('')
  const [attachment, setAttachment] = useState<AttachmentMetadata | undefined>()
  const [attachmentFile, setAttachmentFile] = useState<File | undefined>()
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [filter, setFilter] = useState<DocumentType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | undefined>()
  const [documentError, setDocumentError] = useState<string | undefined>()
  const [attachmentError, setAttachmentError] = useState<string | undefined>()
  const [attachmentBusyId, setAttachmentBusyId] = useState<string | undefined>()
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()
  const [supportsNativeDialog] = useState(() =>
    typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function',
  )
  const previewDialogRef = useRef<HTMLDialogElement>(null)
  const previewCloseRef = useRef<HTMLButtonElement>(null)
  const previewOriginRef = useRef<HTMLElement | null>(null)
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrStatus, setOcrStatus] = useState<string | undefined>()
  const [labCandidates, setLabCandidates] = useState<ParsedLabCandidate[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | undefined>()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)

  const focusDocument = (documentId: string) => {
    const targetDocument = data.documents.find((item) => item.id === documentId)
    if (!targetDocument) {
      setDocumentError(language === 'it' ? 'Il documento collegato non è più disponibile.' : 'The linked document is no longer available.')
      return
    }
    setDocumentError(undefined)
    setFilter('all')
    setSearch('')
    setExpandedId(targetDocument.id)
    window.requestAnimationFrame(() => {
      const row = Array.from(globalThis.document.querySelectorAll<HTMLElement>('[data-document-id]'))
        .find((element) => element.dataset.documentId === targetDocument.id)
      row?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    })
  }

  useEffect(() => {
    const open = () => setAddOpen(true)
    try {
      if (window.sessionStorage.getItem('mhd.pending-add') === 'documents') {
        setAddOpen(true)
        window.sessionStorage.removeItem('mhd.pending-add')
      }
      const pendingDocument = window.sessionStorage.getItem('mhd.pending-document')
      if (pendingDocument && data.documents.some((document) => document.id === pendingDocument)) {
        focusDocument(pendingDocument)
        window.sessionStorage.removeItem('mhd.pending-document')
      }
    } catch (cause) {
      // Storage can be disabled; the event below remains available.
    }
    window.addEventListener('mhd:open-add', open)
    const openDocument = (event: Event) => {
      const documentId = (event as CustomEvent<string>).detail
      if (typeof documentId === 'string' && documentId) focusDocument(documentId)
    }
    window.addEventListener('mhd:open-document', openDocument)
    return () => {
      window.removeEventListener('mhd:open-add', open)
      window.removeEventListener('mhd:open-document', openDocument)
    }
  }, [data.documents, language])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    if (!previewUrl) return
    const dialog = previewDialogRef.current
    if (!dialog) return
    let handleFallbackKeyDown: ((event: KeyboardEvent) => void) | undefined
    if (!dialog.open) {
      if (supportsNativeDialog) {
        dialog.showModal()
        dialog.setAttribute('aria-modal', 'true')
      } else {
        dialog.setAttribute('open', '')
        handleFallbackKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            closePreview()
            return
          }
          if (event.key !== 'Tab') return
          const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
            'button, iframe, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          )).filter((element) => !element.hasAttribute('disabled'))
          if (focusable.length === 0) return
          const first = focusable[0] as HTMLElement
          const last = focusable[focusable.length - 1] as HTMLElement
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
        document.addEventListener('keydown', handleFallbackKeyDown)
        dialog.setAttribute('aria-modal', 'true')
      }
    }
    previewCloseRef.current?.focus()
    return () => {
      if (handleFallbackKeyDown) document.removeEventListener('keydown', handleFallbackKeyDown)
      if (!dialog.open) return
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [previewUrl, supportsNativeDialog])

  const documents = useMemo(
    () => sortDateLike(data.documents, (document) => document.documentDate),
    [data.documents],
  )
  const appointments = useMemo(
    () => snapshotRecords(data as unknown as Record<string, unknown>, 'appointments'),
    [data.appointments],
  )

  const presentTypes = useMemo(() => {
    const present = new Set(documents.map((document) => document.documentType))
    return DOCUMENT_TYPES.filter((type) => present.has(type.id))
  }, [documents])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return documents.filter((document) => {
      if (filter !== 'all' && document.documentType !== filter) return false
      if (!query) return true
      return [document.title, document.description, document.ocrText, document.attachment?.name]
        .filter((value): value is string => typeof value === 'string')
        .some((value) => value.toLocaleLowerCase().includes(query))
    })
  }, [documents, filter, search])

  const closeAdd = () => {
    setAddOpen(false)
    setEditingId(undefined)
    setTitle('')
    setDocumentType('medical_report')
    setDocumentDate(new Date().toISOString().slice(0, 10))
    setDescription('')
    setOcrText('')
    setBodyRegionId('')
    setAttachment(undefined)
    setAttachmentFile(undefined)
    setLinkedModuleId('')
    setLinkedAppointmentId('')
    setAttachmentError(undefined)
    setOcrStatus(undefined)
    setLabCandidates([])
    setSaving(false)
    setSaveError(undefined)
  }

  const removeDocument = async (id: string): Promise<void> => {
    if (deletingId !== null) return
    setDeletingId(id)
    setDeleteError(null)
    try {
      await data.deleteDocument(id)
    } catch {
      setDeleteError({ id, message: language === 'it' ? 'Impossibile eliminare il documento. Riprova.' : 'Could not delete the document. Try again.' })
    } finally {
      setDeletingId(null)
    }
  }

  const startEdit = (document: HealthDocument) => {
    setEditingId(document.id)
    setTitle(document.title)
    setDocumentType(document.documentType)
    setDocumentDate(dateInputValue(document.documentDate))
    setDescription(document.description ?? '')
    setOcrText(document.ocrText ?? '')
    setBodyRegionId(document.bodyRegionId ?? '')
    setLinkedModuleId(document.linkedModuleId ?? '')
    setLinkedAppointmentId(document.linkedAppointmentId ?? '')
    setAttachment(document.attachment)
    setAttachmentFile(undefined)
    setAttachmentError(undefined)
    setOcrStatus(undefined)
    setLabCandidates([])
    setAddOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const linkedAppointment = linkedAppointmentId ? appointments.some((appointment) => appointment.id === linkedAppointmentId) : true
    if (!title.trim() || !isValidDateInput(documentDate) || !linkedAppointment) {
      setSaveError(language === 'it' ? 'Controlla titolo, data e collegamento alla visita.' : 'Check the title, date, and linked visit.')
      return
    }
    const now = new Date().toISOString()
    const document: HealthDocument = {
      id: editingId ?? createId('document'),
      title: title.trim(),
      documentType,
      documentDate,
      description: description.trim() || undefined,
      ocrText: ocrText.trim() || undefined,
      linkedModuleId: linkedModuleId || undefined,
      linkedAppointmentId: linkedAppointmentId || undefined,
      bodyRegionId: bodyRegionId || undefined,
      attachment: attachment
        ? { ...attachment, storedAt: attachmentFile ? now : attachment.storedAt }
        : undefined,
      createdAt: editingId ? (data.documents.find((item) => item.id === editingId)?.createdAt ?? now) : now,
      updatedAt: now,
    }
    setSaveError(undefined)
    setSaving(true)
    try {
      await data.saveDocument(document, attachmentFile)
      // If lab reconciliation fails after the document itself was persisted,
      // retrying must update the same record instead of creating a duplicate.
      setEditingId(document.id)
      const shouldReconcileLabs = labCandidates.length > 0 || (Boolean(editingId) && documentType !== 'blood_test')
      if (shouldReconcileLabs) {
        const existing = snapshotRecords(data as unknown as Record<string, unknown>, 'labResults')
          .filter((record) => record.linkedDocumentId === document.id)
        for (const record of existing) {
          if (typeof record.id === 'string') await data.deleteCanonicalRecord('labResults', record.id)
        }
        for (const candidate of documentType === 'blood_test' ? labCandidates.filter((item) => item.selected) : []) {
          await data.saveCanonicalRecord('labResults', {
            id: createId('lab'),
            panelName: document.title,
            analyte: candidate.analyte,
            value: candidate.value,
            unit: candidate.unit,
            referenceRange: candidate.referenceRange,
            referenceLow: candidate.referenceLow,
            referenceHigh: candidate.referenceHigh,
            laboratoryFlag: candidate.laboratoryFlag,
            collectedAt: document.documentDate,
            linkedDocumentId: document.id,
            source: 'document_text_review',
            createdAt: now,
            updatedAt: now,
          })
        }
      }
      closeAdd()
    } catch (cause) {
      setSaveError(documentErrorMessage(healthDataErrorCode(cause), language))
    } finally {
      setSaving(false)
    }
  }

  const extractEmbeddedPdfText = async () => {
    if (!attachment) return
    setOcrBusy(true)
    setOcrStatus(undefined)
    try {
      const blob = attachmentFile ?? await getAttachmentBlob(attachment.id)
      if (!blob) throw new Error(language === 'it' ? 'File non disponibile localmente.' : 'File is not available locally.')
      const { extractPdfText } = await import('../services/pdfTextExtraction')
      const result = await extractPdfText(blob)
      if (!result.text) {
        setOcrStatus(language === 'it'
          ? 'Il PDF non contiene testo incorporato. Puoi incollare una trascrizione qui sotto.'
          : 'This PDF has no embedded text. You can paste a transcription below.')
      } else {
        setOcrText(result.text)
        if (documentType === 'blood_test') setLabCandidates(parseLabReportText(result.text))
        setOcrStatus(language === 'it' ? `Testo estratto da ${result.pages} pagine.` : `Text extracted from ${result.pages} pages.`)
      }
    } catch (cause) {
      setOcrStatus(language === 'it' ? 'Estrazione non riuscita. Il documento non è stato modificato.' : 'Extraction failed. The document was not changed.')
    } finally {
      setOcrBusy(false)
    }
  }

  const analyzeLabText = () => {
    const candidates = parseLabReportText(ocrText)
    setLabCandidates(candidates)
    setOcrStatus(candidates.length > 0
      ? (language === 'it' ? `${candidates.length} valori da verificare.` : `${candidates.length} values ready for review.`)
      : (language === 'it' ? 'Nessun valore riconosciuto con sufficiente sicurezza.' : 'No values recognized with sufficient confidence.'))
  }

  const resolveAttachmentBlob = async (metadata: AttachmentMetadata): Promise<Blob | undefined> => {
    try {
      return await loadVerifiedAttachment(metadata)
    } catch (cause) {
      if (cause instanceof AttachmentAccessError && cause.code === 'hash_mismatch') {
        setAttachmentError(language === 'it' ? 'Il file scaricato non corrisponde al referto sincronizzato.' : 'The downloaded file does not match the synchronized report.')
      } else {
        setAttachmentError(language === 'it' ? 'Questo allegato non è disponibile. Sincronizza il dispositivo e riprova.' : 'This attachment is unavailable. Sync the device and try again.')
      }
      return undefined
    }
  }

  const openAttachment = async (metadata: AttachmentMetadata) => {
    if (attachmentBusyId) return
    if (isPdfAttachment(metadata)) {
      await previewAttachment(metadata)
      return
    }
    setAttachmentError(undefined)
    setAttachmentBusyId(metadata.id)
    // `noopener` makes window.open return null in Chromium, leaving the
    // pre-opened about:blank tab impossible to navigate after async retrieval.
    const pendingWindow = window.open('', '_blank')
    if (pendingWindow) pendingWindow.opener = null
    try {
      if (!pendingWindow) {
        setAttachmentError(language === 'it'
          ? 'Il browser ha bloccato l’apertura. Usa Scarica per salvare il file.'
          : 'The browser blocked opening this file. Use Download to save it.')
        return
      }
      const blob = await resolveAttachmentBlob(metadata)
      if (!blob) {
        pendingWindow.close()
        setAttachmentError(language === 'it' ? 'Questo file non è disponibile sul dispositivo o sul Hub.' : 'This file is not available on the device or Hub.')
        return
      }
      const url = URL.createObjectURL(blob)
      if (!pendingWindow.closed) pendingWindow.location.replace(url)
      else {
        URL.revokeObjectURL(url)
        setAttachmentError(language === 'it'
          ? 'Il browser ha bloccato l’apertura. Usa Scarica per salvare il file.'
          : 'The browser blocked opening this file. Use Download to save it.')
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } finally {
      setAttachmentBusyId(undefined)
    }
  }

  const previewAttachment = async (metadata: AttachmentMetadata) => {
    if (!isPdfAttachment(metadata) || attachmentBusyId) return
    previewOriginRef.current = globalThis.document.activeElement instanceof HTMLElement
      ? globalThis.document.activeElement
      : null
    setAttachmentError(undefined)
    setAttachmentBusyId(metadata.id)
    try {
      const blob = await resolveAttachmentBlob(metadata)
      if (!blob) return
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current)
        return URL.createObjectURL(blob)
      })
    } finally {
      setAttachmentBusyId(undefined)
    }
  }

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(undefined)
    window.requestAnimationFrame(() => previewOriginRef.current?.focus())
  }

  const downloadAttachment = async (metadata: AttachmentMetadata) => {
    if (attachmentBusyId) return
    setAttachmentError(undefined)
    setAttachmentBusyId(metadata.id)
    try {
      const blob = await resolveAttachmentBlob(metadata)
      if (!blob) {
        setAttachmentError(language === 'it' ? 'Questo file non è disponibile sul dispositivo o sul Hub.' : 'This file is not available on the device or Hub.')
        return
      }
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = metadata.name
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setAttachmentBusyId(undefined)
    }
  }

  const attachmentLabel = language === 'it' ? 'Allegato' : 'Attachment'
  const retryDocumentSync = (documentId: string) => {
    void data.retrySync('documents', documentId).catch(() => undefined)
  }

  return (
    <section className="documents-module">
      <DocumentsList
        attachmentBusyId={attachmentBusyId}
        attachmentError={attachmentError}
        attachmentLabel={attachmentLabel}
        dataSyncStatus={data.syncStatus}
        deleteError={deleteError}
        deletingId={deletingId}
        documentError={documentError}
        documents={documents}
        expandedId={expandedId}
        filter={filter}
        filtered={filtered}
        formatDate={formatDate}
        formatNumber={formatNumber}
        language={language}
        onAdd={() => setAddOpen(true)}
        onClosePreview={closePreview}
        onDelete={(documentId) => void removeDocument(documentId)}
        onDownloadAttachment={(metadata) => void downloadAttachment(metadata)}
        onEdit={startEdit}
        onFilterChange={setFilter}
        onOpenAttachment={(metadata) => void openAttachment(metadata)}
        onRetryDocumentSync={retryDocumentSync}
        onSearchChange={setSearch}
        onToggleExpanded={(documentId) => setExpandedId((current) => (current === documentId ? undefined : documentId))}
        presentTypes={presentTypes}
        previewCloseRef={previewCloseRef}
        previewDialogRef={previewDialogRef}
        previewUrl={previewUrl}
        search={search}
        t={t}
      />

      {addOpen ? (
        <DocumentsEditor
          appointments={appointments}
          attachment={attachment}
          bodyRegionId={bodyRegionId}
          description={description}
          documentDate={documentDate}
          documentType={documentType}
          editingId={editingId}
          formatDate={formatDate}
          formatNumber={formatNumber}
          labCandidates={labCandidates}
          language={language}
          linkedAppointmentId={linkedAppointmentId}
          linkedModuleId={linkedModuleId}
          ocrBusy={ocrBusy}
          ocrStatus={ocrStatus}
          ocrText={ocrText}
          onAnalyzeLabText={analyzeLabText}
          onAttachmentChange={(file, metadata) => {
            setAttachmentFile(file)
            setAttachment(metadata)
          }}
          onBodyRegionChange={setBodyRegionId}
          onClose={closeAdd}
          onDescriptionChange={setDescription}
          onDocumentDateChange={setDocumentDate}
          onDocumentTypeChange={setDocumentType}
          onExtractEmbeddedPdfText={() => void extractEmbeddedPdfText()}
          onLabCandidateChange={(index, selected) => {
            setLabCandidates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, selected } : item))
          }}
          onLinkedAppointmentChange={setLinkedAppointmentId}
          onLinkedModuleChange={setLinkedModuleId}
          onOcrTextChange={setOcrText}
          onSubmit={(event) => void handleSubmit(event)}
          onTitleChange={setTitle}
          saveError={saveError}
          saving={saving}
          t={t}
          title={title}
        />
      ) : null}
    </section>
  )
}
