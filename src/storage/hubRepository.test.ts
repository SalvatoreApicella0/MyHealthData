import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteHubRecord, getHubMeasurements, isHubAvailable, saveHubRecord } from './hubRepository'

describe('Hub availability probe', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('caches a failed probe for nearby local saves', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    globalThis.fetch = fetchMock

    await expect(isHubAvailable()).resolves.toBe(false)
    await expect(isHubAvailable()).resolves.toBe(false)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('canonical Hub event writes', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses the canonical event record endpoint for upserts and tombstones', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 'event-1', revision: 2 }),
      input,
      init,
    })) as unknown as typeof fetch
    globalThis.fetch = fetchMock

    await saveHubRecord('events', { id: 'event-1', type: 'pain', description: 'Knee' })
    await deleteHubRecord('events', 'event-1')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/records/events',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ id: 'event-1', type: 'pain', description: 'Knee' }) }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/records/events/event-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

describe('Hub measurement reads', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('removes Hub bookkeeping before measurements enter the Web snapshot', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ measurements: [
        {
          id: 'measurement-hub',
          type: 'weight',
          value: 71,
          unit: 'kg',
          measuredAt: '2026-09-20T08:00:00.000Z',
          createdAt: '2026-09-20T08:00:00.000Z',
          updatedAt: '2026-09-20T08:01:00.000Z',
          revision: 2,
          deleted: false,
          provenance: 'ios',
        },
        { id: 'deleted', deleted: true },
      ] }),
    })) as unknown as typeof fetch

    const measurements = await getHubMeasurements()
    expect(measurements).toEqual([expect.objectContaining({ id: 'measurement-hub', createdAt: '2026-09-20T08:00:00.000Z' })])
    expect(measurements[0]).not.toHaveProperty('revision')
    expect(measurements[0]).not.toHaveProperty('deleted')
    expect(measurements[0]).not.toHaveProperty('provenance')
  })
})
