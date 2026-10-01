import type { AttachmentMetadata } from '../core/types'
import { documentSyncState } from '../storage/syncStatus'
import type { Language } from '../i18n'

export interface DocumentModuleOption {
  id: string
  it: string
  en: string
}

export const DOCUMENT_MODULES: readonly DocumentModuleOption[] = [
  { id: 'body', it: 'Dolori corporei', en: 'Body pain' },
  { id: 'cycle', it: 'Ciclo mestruale', en: 'Cycle' },
  { id: 'sexualHealth', it: 'Salute sessuale', en: 'Sexual health' },
  { id: 'allergies', it: 'Allergie', en: 'Allergies' },
  { id: 'vision', it: 'Vista', en: 'Vision' },
  { id: 'gutHealth', it: 'Salute intestinale', en: 'Gut health' },
  { id: 'dental', it: 'Denti', en: 'Dental' },
  { id: 'sleep', it: 'Sonno', en: 'Sleep' },
  { id: 'heart', it: 'Cuore e respiro', en: 'Heart and breathing' },
  { id: 'movement', it: 'Movimento', en: 'Movement' },
  { id: 'gym', it: 'Palestra', en: 'Gym' },
  { id: 'bodyMeasurements', it: 'Misure corporee', en: 'Body measurements' },
  { id: 'nutrition', it: 'Diario alimentare', en: 'Food diary' },
  { id: 'medications', it: 'Farmaci', en: 'Medications' },
]

export function isPdfAttachment(attachment: AttachmentMetadata | undefined): boolean {
  return Boolean(attachment && (attachment.type === 'application/pdf' || attachment.name.toLocaleLowerCase().endsWith('.pdf')))
}

export function documentErrorMessage(code: string, language: Language): string {
  if (language === 'en') {
    if (code === 'attachment_size_mismatch') return 'The selected file does not match its metadata. Choose the file again.'
    if (code === 'attachment_hash_mismatch') return 'The file does not match the synchronized document. Try syncing again.'
    return 'The document could not be saved. Your local draft is still available; try again.'
  }
  if (code === 'attachment_size_mismatch') return 'Il file selezionato non corrisponde ai suoi metadati. Scegli di nuovo il file.'
  if (code === 'attachment_hash_mismatch') return 'Il file non corrisponde al documento sincronizzato. Riprova la sincronizzazione.'
  return 'Impossibile salvare il documento. La bozza locale è ancora disponibile: riprova.'
}

export function syncStateLabel(state: ReturnType<typeof documentSyncState>, language: Language): string {
  if (state === 'pending') return language === 'it' ? 'In attesa di sincronizzazione' : 'Waiting to sync'
  if (state === 'error') return language === 'it' ? 'Sincronizzazione da riprovare' : 'Sync needs a retry'
  if (state === 'synced') return language === 'it' ? 'Sincronizzato' : 'Synced'
  return language === 'it' ? 'Disponibile localmente' : 'Available locally'
}
