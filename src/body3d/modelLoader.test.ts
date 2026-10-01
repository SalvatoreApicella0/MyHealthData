import { Blob as NodeBlob } from 'node:buffer'
import { gzipSync } from 'node:zlib'
import { describe, expect, it, vi } from 'vitest'
import type { Atlas } from './anatomy'
import { decodeModelResponse, loadAtlas, loadChunk } from './modelLoader'

function gunzip(payload: ArrayBuffer): Promise<ArrayBuffer> {
  const stream = new NodeBlob([payload]).stream() as unknown as ReadableStream<Uint8Array>
  return new Response(
    stream.pipeThrough(new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>),
  ).arrayBuffer()
}

const atlas: Atlas = {
  version: 'test',
  parts: [],
  concepts: [],
  triangles: 0,
  chunks: [{ url: '/models/body-0.bin', bytes: 8, gzip: '/models/body-0.bin.gz', gzipBytes: 24 }],
}

describe('loadAtlas', () => {
  it('fetches and parses the manifest', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(atlas), { status: 200 }))
    await expect(loadAtlas(fetchImpl as unknown as typeof fetch)).resolves.toMatchObject({ version: 'test' })
    expect(fetchImpl).toHaveBeenCalledWith('/models/atlas.json', { signal: undefined })
  })

  it('throws the shared error on a failed response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }))
    await expect(loadAtlas(fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      'The anatomy model could not be loaded.',
    )
  })
})

describe('loadChunk', () => {
  it('fetches the gzip path and decodes it', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const gz = new Uint8Array(gzipSync(bytes))
    const fetchImpl = vi.fn().mockResolvedValue(new Response(gz, { status: 200 }))
    const result = await loadChunk(atlas, 0, fetchImpl as unknown as typeof fetch, undefined, gunzip)
    expect(new Uint8Array(result)).toEqual(bytes)
    expect(fetchImpl).toHaveBeenCalledWith('/models/body-0.bin.gz', { signal: undefined })
  })

  it('rejects when the request signal aborts', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted')
            error.name = 'AbortError'
            reject(error)
          })
        }),
    )
    const pending = loadChunk(atlas, 0, fetchImpl as unknown as typeof fetch, controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchImpl).toHaveBeenCalledWith('/models/body-0.bin.gz', { signal: controller.signal })
  })

  it('reports the decompression error when gzip is needed but unsupported', async () => {
    const globals = globalThis as { DecompressionStream?: unknown }
    const original = globals.DecompressionStream
    const fetchImpl = vi.fn()
    try {
      globals.DecompressionStream = undefined
      await expect(
        loadChunk(atlas, 0, fetchImpl as unknown as typeof fetch, undefined, gunzip),
      ).rejects.toThrow('This browser cannot load the anatomy model.')
      expect(fetchImpl).not.toHaveBeenCalled()
    } finally {
      globals.DecompressionStream = original
    }
  })
})

describe('decodeModelResponse', () => {
  it('accepts an already-decoded payload when the gzip signature is absent', async () => {
    const bytes = new Uint8Array([9, 9, 9, 9])
    const response = new Response(bytes, { status: 200 })
    const result = await decodeModelResponse(response, 4, true, gunzip)
    expect(new Uint8Array(result)).toEqual(bytes)
  })

  it('rejects a payload with the wrong byte length', async () => {
    const response = new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    await expect(decodeModelResponse(response, 4, false)).rejects.toThrow(
      'An anatomy file was incomplete. Please reload the viewer.',
    )
  })
})
