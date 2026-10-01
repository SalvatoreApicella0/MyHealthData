import { classifyAttachment, type AttachmentResolution } from './attachmentIntegrity'

export interface AttachmentSource {
  local?: Blob
  remote?: Blob
}

export interface AttachmentResolutionResult {
  blob?: Blob
  source?: 'local' | 'remote'
  status: AttachmentResolution
}

/** Chooses a verified local copy first, then a verified Hub copy. */
export async function resolveVerifiedAttachment(source: AttachmentSource, expected?: string): Promise<AttachmentResolutionResult> {
  let localStatus: AttachmentResolution | undefined
  if (source.local) {
    localStatus = expected ? await classifyAttachment(source.local, expected) : 'ok'
    if (localStatus === 'ok') return { blob: source.local, source: 'local', status: localStatus }
  }
  if (source.remote) {
    const status = await classifyAttachment(source.remote, expected)
    if (status === 'ok') return { blob: source.remote, source: 'remote', status }
    return { status }
  }
  return { status: localStatus === 'hash_mismatch' ? 'hash_mismatch' : 'missing', blob: undefined }
}
