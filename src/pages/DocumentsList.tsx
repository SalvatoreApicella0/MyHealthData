import type { Ref, RefObject } from 'react'
import { CircleAlert, ChevronDown, Cloud, Download, ExternalLink, FileText, Paperclip, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react'
import { DOCUMENT_TYPES } from '../core/constants'
import type { AttachmentMetadata, DocumentType, HealthDocument } from '../core/types'
import type { HealthDataController } from '../storage/useHealthData'
import { documentSyncState } from '../storage/syncStatus'
import type { I18nController, Language } from '../i18n'
import { DOCUMENT_MODULES, syncStateLabel } from './documentsModel'

export interface DocumentsListProps {
  attachmentBusyId?: string
  attachmentError?: string
  attachmentLabel: string
  dataSyncStatus: HealthDataController['syncStatus']
  deleteError: { id: string; message: string } | null
  deletingId: string | null
  documentError?: string
  documents: ReadonlyArray<HealthDocument>
  expandedId?: string
  filter: DocumentType | 'all'
  filtered: ReadonlyArray<HealthDocument>
  formatDate: I18nController['formatDate']
  formatNumber: I18nController['formatNumber']
  language: Language
  onAdd: () => void
  onClosePreview: () => void
  onDelete: (documentId: string) => void
  onDownloadAttachment: (metadata: AttachmentMetadata) => void | Promise<void>
  onEdit: (document: HealthDocument) => void
  onFilterChange: (value: DocumentType | 'all') => void
  onOpenAttachment: (metadata: AttachmentMetadata) => void | Promise<void>
  onRetryDocumentSync: (documentId: string) => void
  onSearchChange: (value: string) => void
  onToggleExpanded: (documentId: string) => void
  presentTypes: ReadonlyArray<(typeof DOCUMENT_TYPES)[number]>
  previewCloseRef: RefObject<HTMLButtonElement | null>
  previewDialogRef: RefObject<HTMLDialogElement | null>
  previewUrl?: string
  search: string
  t: I18nController['t']
}

export function DocumentsList({
  attachmentBusyId,
  attachmentError,
  attachmentLabel,
  dataSyncStatus,
  deleteError,
  deletingId,
  documentError,
  documents,
  expandedId,
  filter,
  filtered,
  formatDate,
  formatNumber,
  language,
  onAdd,
  onClosePreview,
  onDelete,
  onDownloadAttachment,
  onEdit,
  onFilterChange,
  onOpenAttachment,
  onRetryDocumentSync,
  onSearchChange,
  onToggleExpanded,
  presentTypes,
  previewCloseRef,
  previewDialogRef,
  previewUrl,
  search,
  t,
}: DocumentsListProps) {
  return (
      <section className="panel documents-panel">
        <div className="panel__header">
          <div>
            <h2>{t('module.history')}</h2>
            <p aria-live="polite" role="status" className="documents-count">
              {filtered.length === documents.length
                ? `${documents.length} ${language === 'it' ? (documents.length === 1 ? 'documento' : 'documenti') : (documents.length === 1 ? 'document' : 'documents')}`
                : `${filtered.length} / ${documents.length}`}
            </p>
          </div>
          <button className="btn btn--primary btn--small" onClick={onAdd} type="button">
            <Plus size={15} />
            {t('common.add')}
          </button>
        </div>

        {documents.length > 0 ? (
          <>
            <label className="documents-search">
              <Search aria-hidden="true" size={15} />
              <span className="sr-only">{language === 'it' ? 'Cerca documenti' : 'Search documents'}</span>
              <input
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={language === 'it' ? 'Cerca titolo, nome file o contenuto' : 'Search title, file name or content'}
                type="search"
                value={search}
              />
            </label>
            <div aria-label={language === 'it' ? 'Filtra per tipo' : 'Filter by type'} className="chip-row documents-filters" role="group">
              <button aria-pressed={filter === 'all'} className="chip" onClick={() => onFilterChange('all')} type="button">
                {language === 'it' ? 'Tutti' : 'All'}
              </button>
              {presentTypes.map((type) => (
                <button
                  aria-pressed={filter === type.id}
                  className="chip"
                  key={type.id}
                  onClick={() => onFilterChange(type.id)}
                  type="button"
                >
                  {t(`document.${type.id}`)}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {documents.length === 0 ? (
          <p className="empty-state">{language === 'it' ? 'Aggiungi un PDF, una foto o una scansione: potrai ritrovarli qui per titolo, nome file o contenuto.' : 'Add a PDF, photo or scan and find it here by title, file name or content.'}</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>{language === 'it' ? 'Nessun documento corrisponde alla ricerca e ai filtri.' : 'No documents match your search and filters.'}</p>
            <button className="btn btn--ghost btn--small" onClick={() => { onSearchChange(''); onFilterChange('all') }} type="button">
              {language === 'it' ? 'Mostra tutti i documenti' : 'Show all documents'}
            </button>
          </div>
        ) : (
          <div className="list documents-list">
            {filtered.map((document) => {
              const expanded = expandedId === document.id
              const syncState = documentSyncState(dataSyncStatus, document.id)
              const showSyncState = syncState !== 'local' || dataSyncStatus.available
              return (
                <div className="row documents-row" data-document-id={document.id} data-expanded={expanded} key={document.id}>
                  <button
                    aria-expanded={expanded}
                    className="documents-row__main"
                    onClick={() => onToggleExpanded(document.id)}
                    type="button"
                  >
                    <span className="row__title documents-row__title">
                      <FileText aria-hidden="true" className="documents-row__icon" size={14} />
                      {document.title}
                      {document.attachment ? (
                        <Paperclip aria-label={attachmentLabel} className="documents-row__clip" size={13} />
                      ) : null}
                    </span>
                    <span className="row__detail">
                      {t(`document.${document.documentType}`)}
                      {document.bodyRegionId ? ` · ${t(`region.${document.bodyRegionId}`)}` : ''}
                    </span>
                    {document.description ? <span className="documents-row__summary">{document.description}</span> : null}
                    {document.attachment ? <span className="documents-row__filename">{document.attachment.name}</span> : null}
                  </button>
                  <span className="row__side">
                    {document.attachment ? (
                      <button
                        aria-label={`${language === 'it' ? 'Apri allegato' : 'Open attachment'}: ${document.title}`}
                        className="btn btn--ghost btn--small documents-row__open"
                        disabled={attachmentBusyId !== undefined}
                        onClick={() => void onOpenAttachment(document.attachment!)}
                        type="button"
                      >
                        <ExternalLink aria-hidden="true" size={14} />
                        {attachmentBusyId === document.attachment.id ? (language === 'it' ? 'Apertura…' : 'Opening…') : (language === 'it' ? 'Apri' : 'Open')}
                      </button>
                    ) : null}
                    <span className="row__meta">{formatDate(document.documentDate)}</span>
                    {showSyncState ? (
                      <span className="documents-sync-state" data-state={syncState} title={syncStateLabel(syncState, language)}>
                        {syncState === 'error' ? <CircleAlert aria-hidden="true" size={13} /> : <Cloud aria-hidden="true" size={13} />}
                        <span>{syncStateLabel(syncState, language)}</span>
                      </span>
                    ) : null}
                    <button
                      aria-label={t('common.delete')}
                      className="btn btn--icon btn--danger"
                      disabled={deletingId !== null}
                      onClick={() => {
                        if (window.confirm(`${t('common.delete')}?`)) {
                          void onDelete(document.id)
                        }
                      }}
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                    <ChevronDown aria-hidden="true" className="documents-row__chevron" data-open={expanded} size={15} />
                  </span>
                  {deleteError?.id === document.id ? <p aria-live="polite" className="form-note documents-attachment-error" role="alert">{deleteError.message}</p> : null}
                  {expanded ? (
                    <div className="documents-row__expand">
                      {document.description ? <p>{document.description}</p> : null}
                      {document.linkedModuleId ? (
                        <p className="row__detail">
                          {language === 'it' ? 'Modulo collegato: ' : 'Linked module: '}
                          {DOCUMENT_MODULES.find((module) => module.id === document.linkedModuleId)?.[language === 'it' ? 'it' : 'en'] ?? document.linkedModuleId}
                        </p>
                      ) : null}
                      {document.linkedAppointmentId ? (
                        <p className="row__detail">{language === 'it' ? 'Visita collegata' : 'Linked visit'}</p>
                      ) : null}
                      <div className="documents-row__actions">
                        <button className="btn btn--ghost btn--small" onClick={() => onEdit(document)} type="button">
                          <Pencil size={14} /> {language === 'it' ? 'Modifica' : 'Edit'}
                        </button>
                      </div>
                      {document.ocrText ? (
                        <details className="documents-ocr">
                          <summary>{language === 'it' ? 'Testo riconosciuto (OCR)' : 'Recognized text (OCR)'}</summary>
                          <p>{document.ocrText}</p>
                        </details>
                      ) : null}
                      {document.attachment ? (
                        <div className="documents-attachment">
                          <p className="form-note">
                            <Paperclip aria-hidden="true" size={12} /> {document.attachment.name} ·{' '}
                            {formatNumber(Math.round(document.attachment.size / 1024))} KB
                          </p>
                          <div className="documents-attachment__status" data-state={syncState}>
                            {syncState === 'error' ? <CircleAlert aria-hidden="true" size={13} /> : <Cloud aria-hidden="true" size={13} />}
                            <span>{syncStateLabel(syncState, language)}</span>
                            {syncState === 'error' ? (
                              <button className="btn btn--ghost btn--small" onClick={() => onRetryDocumentSync(document.id)} type="button">
                                <RefreshCw size={13} />
                                {language === 'it' ? 'Riprova' : 'Try again'}
                              </button>
                            ) : null}
                          </div>
                          <div className="documents-attachment__actions">
                            <button className="btn btn--ghost btn--small" disabled={attachmentBusyId !== undefined} onClick={() => void onOpenAttachment(document.attachment!)} type="button">
                              <ExternalLink size={14} /> {language === 'it' ? 'Apri' : 'Open'}
                            </button>
                            <button className="btn btn--ghost btn--small" disabled={attachmentBusyId !== undefined} onClick={() => void onDownloadAttachment(document.attachment!)} type="button">
                              <Download size={14} /> {language === 'it' ? 'Scarica' : 'Download'}
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {!document.description && !document.attachment ? (
                        <p className="row__detail">{language === 'it' ? 'Nessun dettaglio aggiuntivo.' : 'No extra details.'}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
        {documentError ? <p aria-live="polite" className="form-note documents-attachment-error" role="alert">{documentError}</p> : null}
        {attachmentError ? <p className="form-note documents-attachment-error" role="status">{attachmentError}</p> : null}
        {previewUrl ? (
          <dialog
            ref={previewDialogRef as unknown as Ref<HTMLDialogElement>}
            aria-labelledby="documents-preview-title"
            className="documents-preview"
            onCancel={(event) => {
              event.preventDefault()
              onClosePreview()
            }}
          >
            <div className="documents-preview__head">
              <strong id="documents-preview-title">{language === 'it' ? 'Anteprima PDF' : 'PDF preview'}</strong>
              <button ref={previewCloseRef as unknown as Ref<HTMLButtonElement>} className="btn btn--ghost btn--small" onClick={onClosePreview} type="button">{language === 'it' ? 'Chiudi' : 'Close'}</button>
            </div>
            <iframe title={language === 'it' ? 'Anteprima PDF' : 'PDF preview'} src={previewUrl} />
          </dialog>
        ) : null}
      </section>
  )
}
