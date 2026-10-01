import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SyncOutboxEntry } from './db'
import {
  HUB_SYNC_RETRY_BASE_DELAY_MS,
  HUB_SYNC_RETRY_MAX_DELAY_MS,
  HubSyncRetryScheduler,
  hubSyncErrorCode,
  hubSyncRetryDelay,
} from './hubSyncRetry'

const pendingEntry = (nextAttemptAt?: number, retryCount = 0): SyncOutboxEntry => ({
  id: 'documents:document-1',
  domain: 'documents',
  operation: 'upsert',
  recordId: 'document-1',
  createdAt: new Date(0).toISOString(),
  nextAttemptAt,
  retryCount,
})

describe('Hub outbox retry policy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses exponential backoff with a hard maximum', () => {
    expect(hubSyncRetryDelay(1)).toBe(HUB_SYNC_RETRY_BASE_DELAY_MS)
    expect(hubSyncRetryDelay(2)).toBe(HUB_SYNC_RETRY_BASE_DELAY_MS * 2)
    expect(hubSyncRetryDelay(99)).toBe(HUB_SYNC_RETRY_MAX_DELAY_MS)
    expect(hubSyncRetryDelay(Number.NaN)).toBe(HUB_SYNC_RETRY_BASE_DELAY_MS)
  })

  it('schedules one bounded retry only while the page is active', async () => {
    let active = true
    let pending: SyncOutboxEntry[] = [pendingEntry(10_000)]
    const onRetry = vi.fn(async () => {
      pending = []
    })
    const scheduler = new HubSyncRetryScheduler({
      getPending: async () => pending,
      onRetry,
      isActive: () => active,
      now: () => 5_000,
    })

    scheduler.wake()
    await Promise.resolve()
    expect(scheduler.hasScheduledTimer).toBe(true)
    expect(vi.getTimerCount()).toBe(1)

    // A second wake replaces the first one instead of adding another timer.
    scheduler.wake()
    await Promise.resolve()
    expect(vi.getTimerCount()).toBe(1)

    await vi.advanceTimersByTimeAsync(HUB_SYNC_RETRY_BASE_DELAY_MS)
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(scheduler.hasScheduledTimer).toBe(false)

    active = false
    pending = [pendingEntry(0, 1)]
    scheduler.wake()
    await Promise.resolve()
    expect(scheduler.hasScheduledTimer).toBe(false)

    scheduler.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('sanitizes errors so retry state never stores PHI or URLs', () => {
    expect(hubSyncErrorCode(new Error('attachment_hash_mismatch'))).toBe('attachment_hash_mismatch')
    expect(hubSyncErrorCode(new Error('https://example.test/private/referto.pdf'))).toBe('hub_sync_failed')
  })
})
