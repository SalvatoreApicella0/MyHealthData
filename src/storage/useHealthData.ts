import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HealthDataSnapshot, HealthDocument, HealthEvent, LocalProfile, Measurement } from '../core/types'
import {
  clearAllData,
  getDueHubSyncQueue,
  forceHubSyncRetry,
  getHubSyncQueue,
  getSnapshot,
  getSnapshotParts,
  claimHubSync,
  markHubSyncFailure,
  replaceSnapshot,
} from './repository'
import { getHubMeasurements, isHubAvailable } from './hubRepository'
import { getLastCanonicalSyncFailedDomains, getLastDocumentSyncResult, syncCanonicalDomainsFromHub } from './canonicalHubSync'
import { healthDataErrorCode } from './errorCodes'
import { createHealthDataActions, type HealthAttachmentInput } from './healthDataActions'
import { HubSyncRetryScheduler } from './hubSyncRetry'
import { flushHubSyncQueue } from './hubSyncQueue'
import { shareUnchangedSnapshotParts } from './snapshotParts'
import { EMPTY_HEALTH_SYNC_STATUS, summarizeHealthSync, type HealthSyncStatus } from './syncStatus'

export { healthDataErrorCode } from './errorCodes'
export { flushHubSyncQueue } from './hubSyncQueue'
export { shareUnchangedSnapshotParts } from './snapshotParts'

export interface HealthDataController extends HealthDataSnapshot {
  loading: boolean
  error?: string
  syncStatus: HealthSyncStatus
  refresh: (syncDomains?: string[]) => Promise<void>
  saveProfile: (profile: LocalProfile) => Promise<void>
  saveEvent: (event: HealthEvent, attachments?: HealthAttachmentInput[]) => Promise<void>
  deleteEvent: (eventId: string) => Promise<void>
  saveMeasurement: (measurement: Measurement) => Promise<void>
  deleteMeasurement: (measurementId: string) => Promise<void>
  saveDocument: (document: HealthDocument, file?: Blob | ArrayBuffer) => Promise<void>
  deleteDocument: (documentId: string) => Promise<void>
  replaceAll: (snapshot: HealthDataSnapshot) => Promise<void>
  clearAll: () => Promise<void>
  saveCanonicalRecord: (domain: string, record: Record<string, unknown>) => Promise<void>
  deleteCanonicalRecord: (domain: string, id: string) => Promise<void>
  retrySync: (domain: string, recordId: string) => Promise<void>
}

export type { HealthAttachmentInput } from './healthDataActions'

const emptySnapshot: HealthDataSnapshot = {
  events: [],
  measurements: [],
  documents: [],
}

export function useHealthData(): HealthDataController {
  const [snapshot, setSnapshot] = useState<HealthDataSnapshot>(emptySnapshot)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [syncStatus, setSyncStatus] = useState<HealthSyncStatus>(EMPTY_HEALTH_SYNC_STATUS)
  const [hubMode, setHubMode] = useState(false)
  const refreshInFlight = useRef<Promise<void> | undefined>()
  const pendingSyncDomains = useRef<Set<string>>(new Set())
  const pendingFullRefresh = useRef(false)
  const snapshotRef = useRef(snapshot)
  const retrySchedulerRef = useRef<HubSyncRetryScheduler | undefined>()
  const confirmedDocumentIdsRef = useRef<Set<string>>(new Set())
  const actions = useMemo(() => createHealthDataActions({
    hubMode,
    snapshot,
    onDocumentConfirmed: (documentId) => confirmedDocumentIdsRef.current.add(documentId),
  }), [hubMode, snapshot])

  const refresh = useCallback(async (syncDomains?: string[]) => {
    if (syncDomains === undefined) pendingFullRefresh.current = true
    else syncDomains.forEach((domain) => pendingSyncDomains.current.add(domain))
    if (refreshInFlight.current) {
      await refreshInFlight.current
      return
    }

    const run = async () => {
      do {
        const fullRefresh = pendingFullRefresh.current
        const requestedDomains = fullRefresh ? undefined : [...pendingSyncDomains.current]
        pendingFullRefresh.current = false
        pendingSyncDomains.current.clear()
        let canonicalSyncPartiallyFailed = false
        try {
          setError(undefined)
          const hub = await isHubAvailable()
          setHubMode(hub)
          if (hub) {
            for (const documentId of await flushHubSyncQueue()) confirmedDocumentIdsRef.current.add(documentId)
          }
          else {
            // An online browser without a running Hub still gets a bounded
            // retry schedule; an offline/hidden browser is paused by the
            // scheduler and never keeps background work alive.
            const due = await getDueHubSyncQueue()
            await Promise.all(due.map(async (entry) => {
              const claimed = await claimHubSync(entry.id)
              if (claimed?.lastAttemptAt !== undefined) await markHubSyncFailure(claimed.id, claimed.lastAttemptAt, new Error('hub_unavailable'))
            }))
          }
          if (hub && requestedDomains === undefined) {
            await syncCanonicalDomainsFromHub()
            canonicalSyncPartiallyFailed = getLastCanonicalSyncFailedDomains().length > 0
            const result = getLastDocumentSyncResult()
            result.removed.forEach((id) => confirmedDocumentIdsRef.current.delete(id))
            result.confirmed.forEach((id) => confirmedDocumentIdsRef.current.add(id))
          } else if (hub && requestedDomains && requestedDomains.length > 0) {
            await syncCanonicalDomainsFromHub(requestedDomains)
            canonicalSyncPartiallyFailed = getLastCanonicalSyncFailedDomains().length > 0
            const result = getLastDocumentSyncResult()
            result.removed.forEach((id) => confirmedDocumentIdsRef.current.delete(id))
            result.confirmed.forEach((id) => confirmedDocumentIdsRef.current.add(id))
          }
          const currentSnapshot = snapshotRef.current
          const next = requestedDomains === undefined
            ? await getSnapshot()
            : { ...currentSnapshot, ...(await getSnapshotParts(requestedDomains)) }
          if (hub && (requestedDomains === undefined || requestedDomains.includes('measurements'))) {
            next.measurements = await getHubMeasurements()
          }
          setSnapshot((previous) => {
            const shared = shareUnchangedSnapshotParts(previous, next)
            snapshotRef.current = shared
            return shared
          })
          setSyncStatus(summarizeHealthSync(await getHubSyncQueue(), hub, [...confirmedDocumentIdsRef.current]))
          if (canonicalSyncPartiallyFailed) setError('hub_partial_sync_failed')
        } catch (cause) {
          setError(healthDataErrorCode(cause))
        } finally {
          setLoading(false)
          retrySchedulerRef.current?.wake()
        }
      } while (pendingFullRefresh.current || pendingSyncDomains.current.size > 0)
    }

    const request = run().finally(() => {
      if (refreshInFlight.current === request) refreshInFlight.current = undefined
    })
    refreshInFlight.current = request
    await request
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const scheduler = new HubSyncRetryScheduler({
      getPending: getHubSyncQueue,
      onRetry: () => refresh(),
      isActive: () => {
        const visible = typeof document === 'undefined' || !document.hidden
        const online = typeof navigator === 'undefined' || navigator.onLine !== false
        return visible && online
      },
    })
    retrySchedulerRef.current = scheduler

    const onOnline = () => scheduler.wake()
    const onOffline = () => scheduler.pause()
    const onVisibility = () => {
      if (document.hidden) scheduler.pause()
      else scheduler.wake()
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisibility)
    scheduler.wake()

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisibility)
      scheduler.dispose()
      if (retrySchedulerRef.current === scheduler) retrySchedulerRef.current = undefined
    }
  }, [refresh])

  const withRefresh = useCallback(
    async (operation: () => Promise<void>, syncDomains?: string[]) => {
      try {
        setError(undefined)
        await operation()
        await refresh(syncDomains)
      } catch (cause) {
        const operationError = new Error(healthDataErrorCode(cause))
        setError(operationError.message)
        // The UI owns the transaction state (sheet open, retry, optimistic close).
        // Do not turn a failed write into a fulfilled Promise: callers must be able
        // to keep their draft and offer a real retry.
        throw operationError
      }
    },
    [refresh],
  )

  return useMemo(
    () => ({
      ...snapshot,
      loading,
      error,
      syncStatus,
      refresh,
      saveProfile: (profile: LocalProfile) => withRefresh(() => actions.saveProfile(profile), []),
      saveEvent: (event: HealthEvent, attachments: HealthAttachmentInput[] = []) => withRefresh(() => actions.saveEvent(event, attachments), ['events']),
      deleteEvent: (eventId: string) => withRefresh(() => actions.deleteEvent(eventId), ['events']),
      saveMeasurement: (measurement: Measurement) => withRefresh(() => actions.saveMeasurement(measurement), ['measurements']),
      deleteMeasurement: (measurementId: string) => withRefresh(() => actions.deleteMeasurement(measurementId), ['measurements']),
      saveDocument: (document: HealthDocument, file?: Blob | ArrayBuffer) => withRefresh(() => actions.saveDocument(document, file), ['documents']),
      deleteDocument: (documentId: string) => withRefresh(() => actions.deleteDocument(documentId), ['documents', 'labResults']),
      replaceAll: (nextSnapshot: HealthDataSnapshot) => withRefresh(() => replaceSnapshot(nextSnapshot), []),
      clearAll: () => withRefresh(() => clearAllData(), []),
      retrySync: (domain: string, recordId: string) => withRefresh(() => forceHubSyncRetry(domain, recordId).then(() => undefined), [domain]),
      saveCanonicalRecord: (domain: string, record: Record<string, unknown>) => withRefresh(() => actions.saveCanonicalRecord(domain, record), [domain]),
      deleteCanonicalRecord: (domain: string, id: string) => withRefresh(() => actions.deleteCanonicalRecord(domain, id), [domain]),
    }),
    [actions, error, loading, refresh, snapshot, syncStatus, withRefresh],
  )
}
