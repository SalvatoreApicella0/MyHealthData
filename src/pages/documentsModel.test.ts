import { describe, expect, it } from 'vitest'
import { DOCUMENT_MODULES, documentErrorMessage, isPdfAttachment, syncStateLabel } from './documentsModel'

describe('documents model helpers', () => {
  it('recognizes PDFs by MIME type or filename', () => {
    expect(isPdfAttachment({ id: 'pdf-1', name: 'report.bin', type: 'application/pdf', size: 1 })).toBe(true)
    expect(isPdfAttachment({ id: 'pdf-2', name: 'report.PDF', type: 'application/octet-stream', size: 1 })).toBe(true)
    expect(isPdfAttachment({ id: 'text-1', name: 'report.txt', type: 'text/plain', size: 1 })).toBe(false)
  })

  it('keeps the document module catalog stable for linked records', () => {
    expect(DOCUMENT_MODULES.map((module) => module.id)).toEqual([
      'body',
      'cycle',
      'sexualHealth',
      'allergies',
      'vision',
      'gutHealth',
      'dental',
      'sleep',
      'heart',
      'movement',
      'gym',
      'bodyMeasurements',
      'nutrition',
      'medications',
    ])
  })

  it('localizes save and synchronization messages', () => {
    expect(documentErrorMessage('attachment_hash_mismatch', 'it')).toContain('documento sincronizzato')
    expect(documentErrorMessage('attachment_hash_mismatch', 'en')).toContain('synchronized document')
    expect(syncStateLabel('pending', 'it')).toBe('In attesa di sincronizzazione')
    expect(syncStateLabel('synced', 'en')).toBe('Synced')
  })
})
