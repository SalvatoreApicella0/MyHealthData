import type { SyncOutboxEntry } from './db'

/**
 * Retry policy for the local Hub outbox.
 *
 * The outbox is deliberately not a dead-letter queue: silently dropping a
 * health record or its PDF would be worse than retrying. The bounds here are
 * on the amount of work per turn and on the delay, so a disconnected Hub
 * cannot create a hot loop or an unbounded timer storm.
 */
export const HUB_SYNC_RETRY_BASE_DELAY_MS = 5_000
export const HUB_SYNC_RETRY_MAX_DELAY_MS = 6 * 60 * 60 * 1_000
export const HUB_SYNC_RETRY_MIN_TIMER_MS = 250
export const HUB_SYNC_RETRY_MAX_BATCH_SIZE = 16
export const HUB_SYNC_RETRY_CONCURRENCY = 4

const SAFE_HUB_SYNC_ERRORS = new Set([
  'attachment_hash_mismatch',
  'attachment_missing_locally',
  'attachment_size_mismatch',
  'hub_request_failed',
  'hub_unavailable',
  'document_sync_unconfirmed',
  'record_not_found',
  'network_error',
])

export function hubSyncRetryDelay(retryCount: number): number {
  const count = Math.max(1, Math.floor(Number.isFinite(retryCount) ? retryCount : 1))
  return Math.min(HUB_SYNC_RETRY_MAX_DELAY_MS, HUB_SYNC_RETRY_BASE_DELAY_MS * (2 ** (count - 1)))
}

export function hubSyncRetryAt(now: number, retryCount: number): number {
  return now + hubSyncRetryDelay(retryCount)
}

export function isHubSyncEntryDue(entry: Pick<SyncOutboxEntry, 'nextAttemptAt'>, now = Date.now()): boolean {
  return typeof entry.nextAttemptAt !== 'number' || entry.nextAttemptAt <= now
}

export function nextHubSyncAttemptAt(entries: readonly SyncOutboxEntry[], now = Date.now()): number | undefined {
  if (entries.length === 0) return undefined
  return entries.reduce((earliest, entry) => {
    const candidate = typeof entry.nextAttemptAt === 'number'
      ? entry.nextAttemptAt
      : hubSyncRetryAt(now, Math.max(1, entry.retryCount ?? 0))
    return Math.min(earliest, candidate)
  }, Number.POSITIVE_INFINITY)
}

/**
 * Persist only a safe, low-cardinality error code. Never put an Error.message
 * (which may contain a URL, a filename or user data) in IndexedDB.
 */
export function hubSyncErrorCode(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : ''
  return SAFE_HUB_SYNC_ERRORS.has(message) ? message : 'hub_sync_failed'
}

export interface HubSyncRetrySchedulerOptions {
  getPending: () => Promise<SyncOutboxEntry[]>
  onRetry: () => Promise<void>
  isActive: () => boolean
  now?: () => number
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
}

/**
 * One-shot scheduler for the outbox. It intentionally has no interval:
 * schedule() installs at most one timer, hidden/offline pages install none,
 * and every callback schedules the next one only after the current refresh is
 * complete. `generation` makes an in-flight queue read harmless after pause
 * or dispose.
 */
export class HubSyncRetryScheduler {
  private readonly getPending: HubSyncRetrySchedulerOptions['getPending']
  private readonly onRetry: HubSyncRetrySchedulerOptions['onRetry']
  private readonly isActive: HubSyncRetrySchedulerOptions['isActive']
  private readonly now: NonNullable<HubSyncRetrySchedulerOptions['now']>
  private readonly setTimer: NonNullable<HubSyncRetrySchedulerOptions['setTimer']>
  private readonly clearTimer: NonNullable<HubSyncRetrySchedulerOptions['clearTimer']>
  private timer: ReturnType<typeof setTimeout> | undefined
  private generation = 0
  private disposed = false

  constructor(options: HubSyncRetrySchedulerOptions) {
    this.getPending = options.getPending
    this.onRetry = options.onRetry
    this.isActive = options.isActive
    this.now = options.now ?? (() => Date.now())
    this.setTimer = options.setTimer ?? ((callback, delay) => setTimeout(callback, delay))
    this.clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer))
  }

  async schedule(): Promise<void> {
    const generation = ++this.generation
    this.clearScheduledTimer()
    if (this.disposed || !this.isActive()) return

    const pending = await this.getPending()
    if (this.disposed || generation !== this.generation || !this.isActive()) return
    const nextAt = nextHubSyncAttemptAt(pending, this.now())
    if (nextAt === undefined) return

    const delay = Math.max(
      HUB_SYNC_RETRY_MIN_TIMER_MS,
      Math.min(HUB_SYNC_RETRY_MAX_DELAY_MS, nextAt - this.now()),
    )
    this.timer = this.setTimer(() => {
      this.timer = undefined
      if (this.disposed || !this.isActive()) return
      void this.onRetry().finally(() => {
        void this.schedule()
      })
    }, delay)
  }

  wake(): void {
    void this.schedule()
  }

  pause(): void {
    ++this.generation
    this.clearScheduledTimer()
  }

  dispose(): void {
    this.disposed = true
    this.pause()
  }

  get hasScheduledTimer(): boolean {
    return this.timer !== undefined
  }

  private clearScheduledTimer(): void {
    if (this.timer === undefined) return
    this.clearTimer(this.timer)
    this.timer = undefined
  }
}
