import type { ChangeEvent, FormEventHandler } from 'react'
import { Paperclip, Pencil, Plus } from 'lucide-react'
import { EntrySheet } from '../components/EntrySheet'
import { BODY_REGIONS } from '../core/bodyRegions'
import { DOCUMENT_TYPES } from '../core/constants'
import { createId } from '../core/id'
import type { AttachmentMetadata, BodyRegionId, DocumentType } from '../core/types'
import type { ParsedLabCandidate } from '../core/labReportParser'
import type { Language } from '../i18n'
import { DOCUMENT_MODULES, isPdfAttachment } from './documentsModel'

export interface DocumentsEditorProps {
  appointments: ReadonlyArray<Record<string, unknown>>
  attachment?: AttachmentMetadata
  bodyRegionId: BodyRegionId | ''
  description: string
  documentDate: string
  documentType: DocumentType
  editingId?: string
  labCandidates: ParsedLabCandidate[]
  language: Language
  linkedAppointmentId: string
  linkedModuleId: string
  ocrBusy: boolean
  ocrStatus?: string
  ocrText: string
  saveError?: string
  saving: boolean
  title: string
  formatDate: (value: string | number | Date) => string
  formatNumber: (value: number) => string
  onAnalyzeLabText: () => void
  onAttachmentChange: (file: File | undefined, metadata: AttachmentMetadata | undefined) => void
  onBodyRegionChange: (value: BodyRegionId | '') => void
  onClose: () => void
  onDescriptionChange: (value: string) => void
  onDocumentDateChange: (value: string) => void
  onDocumentTypeChange: (value: DocumentType) => void
  onExtractEmbeddedPdfText: () => void
  onLabCandidateChange: (index: number, selected: boolean) => void
  onLinkedAppointmentChange: (value: string) => void
  onLinkedModuleChange: (value: string) => void
  onOcrTextChange: (value: string) => void
  onSubmit: FormEventHandler<HTMLFormElement>
  onTitleChange: (value: string) => void
  t: (key: string) => string
}

export function DocumentsEditor({
  appointments,
  attachment,
  bodyRegionId,
  description,
  documentDate,
  documentType,
  editingId,
  labCandidates,
  language,
  linkedAppointmentId,
  linkedModuleId,
  ocrBusy,
  ocrStatus,
  ocrText,
  saveError,
  saving,
  title,
  formatDate,
  formatNumber,
  onAnalyzeLabText,
  onAttachmentChange,
  onBodyRegionChange,
  onClose,
  onDescriptionChange,
  onDocumentDateChange,
  onDocumentTypeChange,
  onExtractEmbeddedPdfText,
  onLabCandidateChange,
  onLinkedAppointmentChange,
  onLinkedModuleChange,
  onOcrTextChange,
  onSubmit,
  onTitleChange,
  t,
}: DocumentsEditorProps) {
  const isItalian = language === 'it'

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    onAttachmentChange(
      file,
      file
        ? {
            id: createId('attachment'),
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
          }
        : undefined,
    )
  }

  return (
    <EntrySheet
      title={editingId ? (isItalian ? 'Modifica documento' : 'Edit document') : (isItalian ? 'Nuovo documento' : 'New document')}
      onClose={saving ? () => undefined : onClose}
    >
      <form className="form-grid" onSubmit={onSubmit}>
        <label className="full-width">
          {isItalian ? 'Titolo' : 'Title'}
          <input autoFocus onChange={(event) => onTitleChange(event.target.value)} required value={title} />
        </label>
        <label>
          {t('common.type')}
          <select onChange={(event) => onDocumentTypeChange(event.target.value as DocumentType)} value={documentType}>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type.id} value={type.id}>
                {t(`document.${type.id}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('common.date')}
          <input onChange={(event) => onDocumentDateChange(event.target.value)} required type="date" value={documentDate} />
        </label>
        <label className="full-width">
          {isItalian ? 'Zona del corpo' : 'Body region'}
          <select onChange={(event) => onBodyRegionChange(event.target.value as BodyRegionId | '')} value={bodyRegionId}>
            <option value="">{isItalian ? 'Nessuna zona' : 'No body region'}</option>
            {BODY_REGIONS.map((region) => (
              <option key={region.id} value={region.id}>
                {t(`region.${region.id}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {isItalian ? 'Modulo collegato' : 'Linked module'}
          <select onChange={(event) => onLinkedModuleChange(event.target.value)} value={linkedModuleId}>
            <option value="">{isItalian ? 'Nessun modulo' : 'No module'}</option>
            {DOCUMENT_MODULES.map((module) => (
              <option key={module.id} value={module.id}>{module[isItalian ? 'it' : 'en']}</option>
            ))}
          </select>
        </label>
        <label>
          {isItalian ? 'Visita collegata' : 'Linked visit'}
          <select onChange={(event) => onLinkedAppointmentChange(event.target.value)} value={linkedAppointmentId}>
            <option value="">{isItalian ? 'Nessuna visita' : 'No visit'}</option>
            {appointments.map((appointment) => (
              <option key={String(appointment.id)} value={String(appointment.id)}>
                {String(appointment.title ?? (isItalian ? 'Visita' : 'Visit'))} · {formatDate(String(appointment.scheduledAt ?? ''))}
              </option>
            ))}
          </select>
        </label>
        <label className="full-width">
          {isItalian ? 'Descrizione' : 'Description'}
          <textarea onChange={(event) => onDescriptionChange(event.target.value)} value={description} />
        </label>
        <label className="full-width">
          {isItalian ? 'Testo OCR o trascrizione' : 'OCR text or transcription'}
          <textarea
            onChange={(event) => onOcrTextChange(event.target.value)}
            placeholder={isItalian ? 'Incolla qui il testo riconosciuto dal referto…' : 'Paste recognized report text here…'}
            rows={5}
            value={ocrText}
          />
          {isPdfAttachment(attachment) ? (
            <button className="btn btn--ghost btn--small documents-ocr__extract" disabled={ocrBusy} onClick={onExtractEmbeddedPdfText} type="button">
              {ocrBusy ? (isItalian ? 'Estrazione…' : 'Extracting…') : (isItalian ? 'Estrai testo dal PDF' : 'Extract PDF text')}
            </button>
          ) : null}
          {documentType === 'blood_test' && ocrText.trim() ? (
            <button className="btn btn--ghost btn--small documents-ocr__extract" onClick={onAnalyzeLabText} type="button">
              {isItalian ? 'Analizza valori del referto' : 'Analyze report values'}
            </button>
          ) : null}
          {ocrStatus ? <span aria-live="polite" className="form-note">{ocrStatus}</span> : null}
          {documentType === 'blood_test' && labCandidates.length > 0 ? (
            <fieldset className="documents-lab-review">
              <legend>{isItalian ? 'Valori riconosciuti — verifica prima di salvare' : 'Recognized values — review before saving'}</legend>
              {labCandidates.map((candidate, index) => (
                <label className="documents-lab-review__row" key={`${candidate.analyte}-${index}`}>
                  <input
                    checked={candidate.selected}
                    onChange={(event) => onLabCandidateChange(index, event.target.checked)}
                    type="checkbox"
                  />
                  <span>{candidate.analyte}</span>
                  <strong>{candidate.value} {candidate.unit}</strong>
                  {candidate.referenceRange ? <small>{candidate.referenceRange}</small> : null}
                </label>
              ))}
            </fieldset>
          ) : null}
          <span className="form-note">{isItalian ? 'Resta cifrato e ricercabile insieme al documento.' : 'It remains encrypted and searchable with the document.'}</span>
        </label>
        <label className={`documents-file-drop full-width${attachment ? ' documents-file-drop--selected' : ''}`}>
          <input
            aria-label={isItalian ? 'Scegli allegato' : 'Choose attachment'}
            onChange={handleAttachmentChange}
            accept=".pdf,application/pdf,image/*,.txt,text/plain"
            type="file"
          />
          <Paperclip aria-hidden="true" size={18} />
          <span className="documents-file-drop__copy">
            <strong>{attachment ? attachment.name : (isItalian ? 'Aggiungi un allegato' : 'Add an attachment')}</strong>
            <small>{attachment ? (isItalian ? 'Clicca per sostituirlo' : 'Click to replace it') : (isItalian ? 'PDF, immagini o testo' : 'PDF, images or text')}</small>
          </span>
        </label>
        {attachment ? (
          <p className="form-note full-width">
            {attachment.name} · {formatNumber(Math.round(attachment.size / 1024))} KB
          </p>
        ) : null}
        {saveError ? <p aria-live="polite" className="form-note documents-attachment-error full-width" role="alert">{saveError}</p> : null}
        <div className="form-actions full-width">
          <button className="btn btn--ghost btn--small" disabled={saving} onClick={onClose} type="button">
            {t('common.close')}
          </button>
          <button className="btn btn--primary btn--small" disabled={!title.trim() || saving} type="submit">
            {editingId ? <Pencil size={15} /> : <Plus size={15} />}
            {saving ? (isItalian ? 'Salvataggio…' : 'Saving…') : (editingId ? (isItalian ? 'Aggiorna' : 'Update') : t('common.save'))}
          </button>
        </div>
      </form>
    </EntrySheet>
  )
}
