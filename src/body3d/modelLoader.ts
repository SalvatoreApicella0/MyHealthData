import type { Atlas } from './anatomy'

export type DecompressFn = (payload: ArrayBuffer) => Promise<ArrayBuffer>

export const MODEL_LOAD_ERROR = 'The anatomy model could not be loaded.'
export const MODEL_INCOMPLETE_ERROR = 'An anatomy file was incomplete. Please reload the viewer.'
export const MODEL_DECOMPRESS_ERROR = 'This browser cannot load the anatomy model.'

async function defaultDecompress(payload: ArrayBuffer): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(MODEL_DECOMPRESS_ERROR)
  }
  return new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}

/** Static hosts may serve .gz as a compressed response or as a gzip file.
 * Fetch already decodes Content-Encoding; inspect the payload to avoid decoding twice.
 */
export async function decodeModelResponse(
  response: Response,
  expectedBytes: number,
  compressed: boolean,
  decompress: DecompressFn = defaultDecompress,
): Promise<ArrayBuffer> {
  if (!response.ok) {
    throw new Error(MODEL_LOAD_ERROR)
  }
  const payload = await response.arrayBuffer()
  const signature = new Uint8Array(payload, 0, Math.min(2, payload.byteLength))
  const gzip = compressed && signature[0] === 0x1f && signature[1] === 0x8b
  const buffer = gzip ? await decompress(payload) : payload
  if (buffer.byteLength !== expectedBytes) {
    throw new Error(MODEL_INCOMPLETE_ERROR)
  }
  return buffer
}

export async function loadAtlas(fetchImpl: typeof fetch = fetch, signal?: AbortSignal): Promise<Atlas> {
  const response = await fetchImpl('/models/atlas.json', { signal })
  if (!response.ok) {
    throw new Error(MODEL_LOAD_ERROR)
  }
  return (await response.json()) as Atlas
}

export async function loadChunk(
  atlas: Atlas,
  index: number,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
  decompress?: DecompressFn,
): Promise<ArrayBuffer> {
  const chunk = atlas.chunks[index]
  if (!chunk) {
    throw new Error(MODEL_LOAD_ERROR)
  }
  if (chunk.gzip && typeof DecompressionStream === 'undefined') {
    throw new Error(MODEL_DECOMPRESS_ERROR)
  }
  const compressed = Boolean(chunk.gzip) && typeof DecompressionStream !== 'undefined'
  const url = compressed && chunk.gzip ? chunk.gzip : chunk.url
  const response = await fetchImpl(url, { signal })
  return decodeModelResponse(response, chunk.bytes, compressed, decompress)
}
