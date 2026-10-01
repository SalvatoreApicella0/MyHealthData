import type { AttachmentMetadata } from '../core/types'
import { resolveVerifiedAttachment } from '../core/attachmentResolution'
import type { AttachmentResolution } from '../core/attachmentIntegrity'
import { getHubAttachment } from './hubRepository'
import { getAttachmentBlob, saveAttachmentBlob } from './repository'

export type AttachmentAccessErrorCode = Exclude<AttachmentResolution, 'ok'>

export class AttachmentAccessError extends Error {
  readonly code: AttachmentAccessErrorCode

  constructor(code: AttachmentAccessErrorCode) {
    super(`attachment_${code}`)
    this.name = 'AttachmentAccessError'
    this.code = code
  }
}

function isPdfAttachment(metadata: AttachmentMetadata): boolean {
  return metadata.type === 'application/pdf' || metadata.name.toLocaleLowerCase().endsWith('.pdf')
}

function normalizeAttachmentBlob(metadata: AttachmentMetadata, blob: Blob): Blob {
  return isPdfAttachment(metadata) && blob.type !== 'application/pdf'
    ? new Blob([blob], { type: 'application/pdf' })
    : blob
}

/**
 * Resolves an attachment from the local vault first and the Hub second.
 * Every candidate is checked against the canonical metadata hash before it is
 * returned, and a verified remote copy is cached for offline use.
 */
export async function loadVerifiedAttachment(metadata: AttachmentMetadata): Promise<Blob> {
  const local = await getAttachmentBlob(metadata.id)
  const localResolution = await resolveVerifiedAttachment({ local }, metadata.sha256)
  if (localResolution.blob) return normalizeAttachmentBlob(metadata, localResolution.blob)

  let remote: Blob | undefined
  try {
    remote = await getHubAttachment(metadata.id)
  } catch {
    // Standalone/local-only mode: a missing Hub is not an integrity failure.
  }
  const resolution = await resolveVerifiedAttachment({ remote }, metadata.sha256)
  if (!resolution.blob) {
    const code: AttachmentAccessErrorCode = resolution.status === 'hash_mismatch' ? 'hash_mismatch' : 'missing'
    throw new AttachmentAccessError(code)
  }

  const blob = normalizeAttachmentBlob(metadata, resolution.blob)
  if (resolution.source === 'remote') await saveAttachmentBlob(metadata, blob).catch(() => undefined)
  return blob
}
