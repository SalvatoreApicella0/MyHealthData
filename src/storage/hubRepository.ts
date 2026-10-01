import type { Measurement } from '../core/types'
import type { AttachmentMetadata } from '../core/types'
import { stripHubEnvelope, type HubRecord } from './hubCanonical'

type HubMeasurement = Measurement & { revision: number; deleted: boolean; provenance?: string }

export interface HubChange {
  cursor: number
  record: HubRecord
}

export interface HubChanges {
  nextCursor: number
  changes: HubChange[]
}

/**
 * Hub probe timeout. The standalone vault is the supported default path
 * (AGENTS.md: "The standalone Web/iOS vault remains usable without a Hub"), so
 * a missing Hub must never stall the app.
 */
const HUB_PROBE_TIMEOUT_MS = 1500
const HUB_PROBE_CACHE_MS = 5000

let hubProbeCache: { available: boolean; checkedAt: number } | undefined
let hubProbeInFlight: Promise<boolean> | undefined

async function request(path: string, init?: RequestInit, timeoutMs?: number): Promise<Response> {
  const controller = timeoutMs === undefined ? undefined : new AbortController()
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined

  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      signal: controller?.signal ?? init?.signal ?? null,
      headers: { accept: 'application/json', ...(init?.headers || {}) },
      credentials: 'same-origin',
    })
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: unknown }
    const message = typeof payload.error === 'string' ? payload.error : 'hub_request_failed'
    throw new Error(message)
  }
  return response
}

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
  const response = await request(
    path,
    { ...init, headers: { 'content-type': 'application/json', ...(init?.headers || {}) } },
    timeoutMs,
  )
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    // A static host serves the SPA shell (HTML) for unknown paths: that is not a Hub.
    throw new Error('hub_unavailable')
  }
  return (await response.json()) as T
}

/**
 * Fail-safe Hub detection.
 *
 * Returns true only when the origin answers with a successful JSON status
 * document. HTML responses, 404s, timeouts, aborts and network errors all
 * resolve to false without throwing, so the standalone Web vault never shows a
 * spurious error.
 */
export async function isHubAvailable(): Promise<boolean> {
  const now = Date.now()
  if (hubProbeCache && now - hubProbeCache.checkedAt < HUB_PROBE_CACHE_MS) return hubProbeCache.available
  if (hubProbeInFlight) return hubProbeInFlight

  hubProbeInFlight = (async () => {
    let available = false
    try {
      await requestJson<unknown>('/api/v1/status', { method: 'GET' }, HUB_PROBE_TIMEOUT_MS)
      available = true
    } catch {
      available = false
    }
    // Cache only failures: a local vault should not pay the timeout repeatedly
    // while offline, but an available Hub must still be rechecked on each
    // refresh so a disconnect is never hidden behind a stale positive result.
    hubProbeCache = available ? undefined : { available: false, checkedAt: Date.now() }
    hubProbeInFlight = undefined
    return available
  })()

  return hubProbeInFlight
}

export interface HubStatus {
  available: boolean
  deviceCount: number
}

export async function getHubStatus(): Promise<HubStatus> {
  try {
    const payload = await requestJson<{ deviceCount?: unknown }>(
      '/api/v1/status',
      { method: 'GET' },
      HUB_PROBE_TIMEOUT_MS,
    )
    return {
      available: true,
      deviceCount: typeof payload.deviceCount === 'number' ? payload.deviceCount : 0,
    }
  } catch {
    return { available: false, deviceCount: 0 }
  }
}

export async function getHubMeasurements(): Promise<Measurement[]> {
  const payload = await requestJson<{ measurements?: HubMeasurement[] }>('/api/v1/measurements')
  if (!Array.isArray(payload.measurements)) return []
  return payload.measurements
    .filter((record) => record && record.deleted !== true && typeof record.id === 'string')
    .map((record) => stripHubEnvelope(record as unknown as HubRecord) as unknown as Measurement)
}

export async function saveHubMeasurement(measurement: Measurement): Promise<void> {
  await requestJson('/api/v1/measurements', { method: 'POST', body: JSON.stringify(measurement) })
}

export async function deleteHubMeasurement(id: string): Promise<void> {
  await requestJson(`/api/v1/measurements/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/* ------------------------------------------------ canonical domain records */

export async function getHubRecords(domain: string): Promise<HubRecord[]> {
  const payload = await requestJson<{ records?: HubRecord[] }>(
    `/api/v1/records/${encodeURIComponent(domain)}`,
  )
  return Array.isArray(payload.records) ? payload.records : []
}

export async function getHubRecordChanges(domain: string, since: number): Promise<HubChanges> {
  const payload = await requestJson<HubChanges>(
    `/api/v1/records/${encodeURIComponent(domain)}?since=${encodeURIComponent(since)}`,
  )
  return {
    nextCursor: typeof payload.nextCursor === 'number' ? payload.nextCursor : since,
    changes: Array.isArray(payload.changes) ? payload.changes : [],
  }
}

export async function saveHubRecord(domain: string, record: Record<string, unknown>): Promise<HubRecord> {
  return requestJson<HubRecord>(`/api/v1/records/${encodeURIComponent(domain)}`, {
    method: 'POST',
    body: JSON.stringify(record),
  })
}

export async function deleteHubRecord(domain: string, id: string): Promise<void> {
  await requestJson(`/api/v1/records/${encodeURIComponent(domain)}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export async function getHubAttachment(id: string): Promise<Blob> {
  const response = await request(`/api/v1/attachments/${encodeURIComponent(id)}`)
  return response.blob()
}

export async function saveHubAttachment(metadata: AttachmentMetadata, file: Blob): Promise<AttachmentMetadata> {
  return requestJson<AttachmentMetadata>(`/api/v1/attachments/${encodeURIComponent(metadata.id)}`, {
    method: 'POST',
    body: file,
    headers: {
      'content-type': metadata.type || 'application/octet-stream',
      'x-mhd-attachment-name': metadata.name,
      ...(metadata.sha256 ? { 'x-mhd-attachment-sha256': metadata.sha256 } : {}),
    },
  })
}
