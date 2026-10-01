export async function blobArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  if (typeof FileReader !== 'undefined') {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error ?? new Error('attachment_read_failed'))
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) resolve(reader.result)
        else reject(new Error('attachment_read_failed'))
      }
      reader.readAsArrayBuffer(blob)
    })
  }
  return new Response(blob).arrayBuffer()
}

export async function sha256Hex(blob: Blob): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined
  const bytes = await blobArrayBuffer(blob)
  // Typed views also work with buffers created by FileReader in another realm.
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function attachmentMatchesHash(blob: Blob, expected?: string): Promise<boolean> {
  if (!expected) return true
  const actual = await sha256Hex(blob)
  if (!actual) return false
  return actual.toLowerCase() === expected.toLowerCase()
}

export type AttachmentResolution = 'ok' | 'missing' | 'hash_mismatch'

export async function classifyAttachment(blob: Blob | undefined, expected?: string): Promise<AttachmentResolution> {
  if (!blob) return 'missing'
  return await attachmentMatchesHash(blob, expected) ? 'ok' : 'hash_mismatch'
}
