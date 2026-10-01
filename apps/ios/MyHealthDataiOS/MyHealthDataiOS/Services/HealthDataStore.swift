import Foundation
import Observation

@MainActor
@Observable
final class HealthDataStore {
    let persistence = VaultPersistenceCoordinator()
    let exportService = MHDExportService()

    var snapshot: MHDDataSnapshot = .empty
    private var caches = HealthDataStoreCaches()
    // A full HealthKit import may span years. Keep the raw vault mutable while
    // batching and rebuild the derived UI caches only once at the end.
    var isBulkAppleHealthImport = false
    var bulkAppleHealthIndexes: [String: Int] = [:]
    private var persistenceGeneration = 0
    var isLoaded = false
    var loadFailed = false
    var lastError: String?
    var healthSyncStatus: String?
    var personalRelaySyncStatus: String?
    var hubSyncStatus: String?
    var hubSyncProgress: HubSyncProgress?
    var isHubSyncing = false
    var hubSyncTask: Task<Void, Never>?
    var hubSyncRequestedWhileBusy = false
    var hubSyncLastResult: Bool?
    var personalRelaySyncTask: Task<Void, Never>?
    private let currentDate: () -> Date

    var events: [HealthEvent] {
        caches.events
    }

    var measurements: [Measurement] {
        caches.measurements
    }

    var appleHealthMeasurements: [Measurement] {
        caches.appleHealthMeasurements
    }

    func measurements(for type: MeasurementType, since startDate: Date? = nil) -> [Measurement] {
        caches.measurements(for: type, since: startDate)
    }

    func measurements(for type: MeasurementType, from startDate: Date, to endDate: Date) -> [Measurement] {
        caches.measurements(for: type, from: startDate, to: endDate)
    }

    func measurementDays(for types: [MeasurementType]) -> Set<Date> {
        caches.measurementDays(for: types)
    }

    var cycleEntries: [CycleEntry] {
        caches.cycleEntries
    }

    var cycleSettings: CycleSettings {
        snapshot.cycleSettings
    }

    var sleepSessions: [SleepSession] {
        caches.sleepSessions
    }

    var sleepSettings: SleepSettings { snapshot.sleepSettings }

    var appointments: [AppointmentRecord] {
        caches.appointments
    }

    var upcomingAppointments: [AppointmentRecord] {
        let now = currentDate()
        return caches.appointments
            .filter { $0.status == .planned && $0.scheduledAt >= now }
            .sorted { lhs, rhs in
                lhs.scheduledAt == rhs.scheduledAt ? lhs.id < rhs.id : lhs.scheduledAt < rhs.scheduledAt
            }
    }

    var medications: [MedicationStatement] {
        caches.medications
    }

    var medicationDoseEvents: [MedicationDoseEvent] {
        caches.medicationDoseEvents
    }

    var conditionEpisodes: [ConditionEpisode] {
        caches.conditionEpisodes
    }

    var conditionCheckIns: [ConditionCheckIn] {
        caches.conditionCheckIns
    }

    var labResults: [LabResult] {
        caches.labResults
    }

    var foodLogEntries: [FoodLogEntry] {
        caches.foodLogEntries
    }

    var gymWorkouts: [GymWorkout] {
        caches.gymWorkouts(from: snapshot.gymWorkouts)
    }

    var gymPlans: [GymPlan] {
        caches.gymPlans(from: snapshot.gymPlans)
    }

    init() {
        currentDate = { Date() }
    }

    /// Test-only fixture injection keeps cache invalidation tests independent
    /// from the user's on-device vault. Production mutations still go through
    /// `mutate`, which is the single owner of cache revisions.
    init(testingSnapshot: MHDDataSnapshot, currentDate: @escaping () -> Date = { Date() }) {
        self.currentDate = currentDate
        snapshot = testingSnapshot
        rebuildMeasurementCache()
        rebuildSortedCaches(.all)
        isLoaded = true
        loadFailed = false
    }

    func foodLogEntries(from startDate: Date, to endDate: Date) -> [FoodLogEntry] {
        caches.foodLogEntries(from: startDate, to: endDate)
    }

    func mutate(
        invalidate: CacheInvalidation = [],
        measurementsChanged: Bool = false,
        _ operation: (inout MHDDataSnapshot) -> Void
    ) {
        guard isLoaded, !loadFailed else {
            lastError = "I dati non sono disponibili. Riprova ad aprire il vault prima di salvare."
            return
        }
        var next = snapshot
        operation(&next)
        snapshot = next
        if measurementsChanged {
            rebuildMeasurementCache()
        }
        rebuildSortedCaches(invalidate)
        lastError = nil

        schedulePersistence()
    }

    func rebuildMeasurementCache() {
        caches.rebuildMeasurements(from: snapshot.measurements)
    }

    func rebuildSortedCaches(_ invalidation: CacheInvalidation) {
        caches.rebuildSortedCaches(from: snapshot, invalidation: invalidation)
    }

    func insertIntoMeasurementCache(_ measurement: Measurement) {
        caches.insertMeasurement(measurement)
    }

    func removeFromMeasurementCache(_ measurement: Measurement) {
        caches.removeMeasurement(measurement)
    }

    func removeMeasurementsFromCache(
        matching predicate: (Measurement) -> Bool,
        for type: MeasurementType
    ) {
        caches.removeMeasurements(matching: predicate, for: type)
    }

    func schedulePersistence() {
        lastError = nil
        persistenceGeneration += 1
        let generation = persistenceGeneration
        let currentSnapshot = snapshot
        Task { [persistence] in
            await persistence.enqueue(currentSnapshot, generation: generation)
        }
    }

    func schedulePersonalRelaySync() {
        guard PersonalRelaySyncClient().isConfigured() else { return }
        personalRelaySyncTask?.cancel()
        personalRelaySyncTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            await self?.syncPersonalRelay()
        }
    }

}
