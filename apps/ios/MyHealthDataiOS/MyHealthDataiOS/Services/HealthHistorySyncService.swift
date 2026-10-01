import Foundation
import HealthKit
#if !targetEnvironment(macCatalyst)
import BackgroundTasks
#endif

private final class HealthObserverCompletion: @unchecked Sendable {
    private let lock = NSLock()
    private var hasCompleted = false
    private let handler: () -> Void

    init(_ handler: @escaping () -> Void) {
        self.handler = handler
    }

    func complete() {
        lock.lock()
        guard !hasCompleted else {
            lock.unlock()
            return
        }
        hasCompleted = true
        lock.unlock()
        handler()
    }
}

@MainActor
final class HealthHistorySyncService {
    static let shared = HealthHistorySyncService()

    private let cursorKey = "appleHealthHistoryCursor"
    private let historyStartKey = "appleHealthHistoryStart"
    private let historyMigrationVersionKey = "appleHealthHistoryMigrationVersion"
    private let currentHistoryMigrationVersion = 2
    private let recentSyncKey = "appleHealthRecentSync"
    private var activeTask: Task<Void, Never>?
    private let healthStore = HKHealthStore()
    private var observerQueries: [HKObserverQuery] = []

    private static let backgroundIdentifier = "org.myhealthdata.ios.health-refresh"

    private init() {}

#if !targetEnvironment(macCatalyst)
    func startObservingHealthKit(store: HealthDataStore) {
        guard observerQueries.isEmpty else { return }
        let importer = HealthKitImporter()
        guard importer.isAvailable else { return }

        for sampleType in importer.observableSampleTypes {
            let query = HKObserverQuery(
                sampleType: sampleType,
                predicate: nil
            ) { [weak self, weak store] _, completionHandler, error in
                let completion = HealthObserverCompletion(completionHandler)
                guard error == nil else {
                    completion.complete()
                    return
                }
                Task { @MainActor in
                    defer { completion.complete() }
                    guard let self, let store else { return }
                    self.startIfNeeded(store: store, forceRecent: true)
                }
            }
            observerQueries.append(query)
            healthStore.execute(query)

            Task {
                try? await healthStore.enableBackgroundDelivery(
                    for: sampleType,
                    frequency: .hourly
                )
            }
        }
    }

    func registerBackgroundRefresh(store: HealthDataStore) {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.backgroundIdentifier, using: nil) { [weak self, weak store] task in
            guard let refreshTask = task as? BGAppRefreshTask else { task.setTaskCompleted(success: false); return }
            let work = Task { [weak self, weak store] in
                guard let self, let store else { refreshTask.setTaskCompleted(success: false); return }
                defer { self.scheduleBackgroundRefresh() }
                let healthSyncSucceeded = await self.sync(store: store)
                guard !Task.isCancelled else {
                    refreshTask.setTaskCompleted(success: false)
                    return
                }

                // HealthKit and Hub attachments share the same refresh budget.
                // Waiting here is important: a fire-and-forget `syncHub()` can
                // be suspended as soon as this BG task reports completion.
                let hubSyncSucceeded = await store.syncHubAndWait()
                refreshTask.setTaskCompleted(success: healthSyncSucceeded && hubSyncSucceeded)
            }
            refreshTask.expirationHandler = { [weak self, weak store] in
                work.cancel()
                // The Hub task is unstructured so it can also be triggered by
                // UI mutations. Cancel it explicitly when iOS reclaims the
                // refresh budget; the persistent attachment state will retry
                // safely on the next active/background pass.
                Task { @MainActor in
                    self?.cancel()
                    store?.cancelHubSync()
                }
            }
        }
        scheduleBackgroundRefresh()
    }

    private func scheduleBackgroundRefresh() {
        let request = BGAppRefreshTaskRequest(identifier: Self.backgroundIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 3 * 60 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }
#endif

    func startIfNeeded(store: HealthDataStore, forceRecent: Bool = true) {
        guard activeTask == nil else { return }
        scheduleSync(store: store, forceRecent: forceRecent, shouldBackfill: true)
    }

    func cancel() {
        activeTask?.cancel()
        activeTask = nil
    }

    func refreshLiveData(store: HealthDataStore) async {
        if let activeTask {
            await activeTask.value
            return
        }

        let task = scheduleSync(store: store, forceRecent: true, shouldBackfill: false)
        await task.value
    }

    @discardableResult
    private func scheduleSync(
        store: HealthDataStore,
        forceRecent: Bool,
        shouldBackfill: Bool
    ) -> Task<Void, Never> {
        let task = Task(priority: .utility) { [weak self, weak store] in
            guard let self, let store else { return }
            _ = await self.sync(store: store, forceRecent: forceRecent, shouldBackfill: shouldBackfill)
            self.activeTask = nil
        }
        activeTask = task
        return task
    }

    private func sync(
        store: HealthDataStore,
        forceRecent: Bool = false,
        shouldBackfill: Bool = true
    ) async -> Bool {
        let importer = HealthKitImporter()
        guard importer.isAvailable else { return false }

        do {
            await refreshCurrentSteps(store: store, importer: importer)
            try Task.checkCancellation()

            let defaults = UserDefaults.standard
            let now = Date.now
            if defaults.integer(forKey: historyMigrationVersionKey) < currentHistoryMigrationVersion {
                // Older builds persisted a bounded history cursor. Reset it once so the
                // current importer can discover and backfill the actual earliest sample.
                defaults.removeObject(forKey: cursorKey)
                defaults.removeObject(forKey: historyStartKey)
                defaults.set(currentHistoryMigrationVersion, forKey: historyMigrationVersionKey)
            }
            let lastRecentSync = defaults.object(forKey: recentSyncKey) as? Date

            let minimumInterval: TimeInterval = forceRecent ? 2 * 60 : 15 * 60
            if lastRecentSync == nil || now.timeIntervalSince(lastRecentSync!) > minimumInterval {
                store.healthSyncStatus = "Aggiornamento dati recenti..."
                let anchored = try await importer.importAnchoredQuantityMeasurements()
                try Task.checkCancellation()
                store.mergeAppleHealthMeasurements(anchored)
                let recent = try await importer.importMeasurements(days: 30, maxSamplesPerType: HKObjectQueryNoLimit)
                try Task.checkCancellation()
                store.mergeAppleHealthMeasurements(recent.measurements)
                defaults.set(now, forKey: recentSyncKey)
            }

            guard shouldBackfill else {
                store.healthSyncStatus = nil
                return true
            }

            let historyStart: Date
            if let saved = defaults.object(forKey: historyStartKey) as? Date {
                historyStart = saved
            } else if let earliest = await importer.earliestReadableSampleDate() {
                historyStart = earliest
                defaults.set(earliest, forKey: historyStartKey)
            } else {
                // No readable sample was found. Keep the compatibility window rather than
                // issuing unbounded empty HealthKit queries on every foreground refresh.
                historyStart = Calendar.current.date(byAdding: .day, value: -30, to: now) ?? now
                defaults.set(historyStart, forKey: historyStartKey)
            }
            var windowEnd = (defaults.object(forKey: cursorKey) as? Date)
                ?? Calendar.current.date(byAdding: .day, value: -30, to: now)
                ?? now

            store.beginBulkAppleHealthImport()
            defer { store.finishBulkAppleHealthImport() }
            while windowEnd > historyStart {
                try Task.checkCancellation()
                let windowStart = max(
                    Calendar.current.date(byAdding: .day, value: -31, to: windowEnd) ?? historyStart,
                    historyStart
                )
                store.healthSyncStatus = "Storico Apple Health: \(windowStart.formatted(.dateTime.month().year()))"
                let result = try await importer.importMeasurements(
                    from: windowStart,
                    to: windowEnd,
                    maxSamplesPerType: HKObjectQueryNoLimit
                )
                try Task.checkCancellation()
                store.mergeAppleHealthMeasurements(result.measurements)
                defaults.set(windowStart, forKey: cursorKey)
                windowEnd = windowStart
                await Task.yield()
            }

            store.healthSyncStatus = nil
            return true
        } catch is CancellationError {
            store.healthSyncStatus = nil
            return false
        } catch {
            store.healthSyncStatus = "Sincronizzazione sospesa: \(error.localizedDescription)"
            return false
        }
    }

    private func refreshCurrentSteps(
        store: HealthDataStore,
        importer: HealthKitImporter = HealthKitImporter()
    ) async {
        let now = Date.now
        let start = Calendar.current.date(byAdding: .day, value: -1, to: now) ?? now
        do {
            let totals = try await importer.importDailyStepTotals(from: start, to: now)
            try Task.checkCancellation()
            store.replaceAppleHealthDailyAggregates(totals, type: .stepCount)
            if !totals.isEmpty {
                UserDefaults.standard.set(
                    now.timeIntervalSince1970,
                    forKey: "appleHealthLiveStepsUpdatedAt"
                )
            }
        } catch is CancellationError {
            return
        } catch {
            store.healthSyncStatus = "Passi non aggiornati: \(error.localizedDescription)"
        }
    }
}
