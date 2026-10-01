import Foundation

struct CacheInvalidation: OptionSet, Hashable {
    let rawValue: UInt16

    static let events = CacheInvalidation(rawValue: 1 << 0)
    static let cycle = CacheInvalidation(rawValue: 1 << 1)
    static let sleep = CacheInvalidation(rawValue: 1 << 2)
    static let appointments = CacheInvalidation(rawValue: 1 << 3)
    static let medications = CacheInvalidation(rawValue: 1 << 4)
    static let medicationDoseEvents = CacheInvalidation(rawValue: 1 << 5)
    static let conditionEpisodes = CacheInvalidation(rawValue: 1 << 6)
    static let conditionCheckIns = CacheInvalidation(rawValue: 1 << 7)
    static let labResults = CacheInvalidation(rawValue: 1 << 8)
    static let foodLogEntries = CacheInvalidation(rawValue: 1 << 9)
    static let gymPlans = CacheInvalidation(rawValue: 1 << 10)
    static let gymWorkouts = CacheInvalidation(rawValue: 1 << 11)

    static let all: CacheInvalidation = [
        .events, .cycle, .sleep, .appointments, .medications,
        .medicationDoseEvents, .conditionEpisodes, .conditionCheckIns,
        .labResults, .foodLogEntries, .gymPlans, .gymWorkouts
    ]
}

struct HealthDataStoreCaches {
#if DEBUG
    /// Debug-only counters make broad cache rebuilds observable in tests
    /// without adding release-build bookkeeping to the hot mutation path.
    private(set) var rebuildCounts: [CacheInvalidation: Int] = [:]
#endif
    private var sortedMeasurements: [Measurement] = []
    private var sortedAppleHealthMeasurements: [Measurement] = []
    private var measurementsByType: [MeasurementType: [Measurement]] = [:]
    private var measurementDaysByType: [MeasurementType: Set<Date>] = [:]
    private var sortedEvents: [HealthEvent] = []
    private var sortedCycleEntries: [CycleEntry] = []
    private var sortedSleepSessions: [SleepSession] = []
    private var sortedAppointments: [AppointmentRecord] = []
    private var sortedMedications: [MedicationStatement] = []
    private var sortedMedicationDoseEvents: [MedicationDoseEvent] = []
    private var sortedConditionEpisodes: [ConditionEpisode] = []
    private var sortedConditionCheckIns: [ConditionCheckIn] = []
    private var sortedLabResults: [LabResult] = []
    private var sortedFoodLogEntries: [FoodLogEntry] = []
    private var sortedGymPlans: [GymPlan] = []
    private var sortedGymWorkouts: [GymWorkout] = []
    private var gymPlansRevision = 0
    private var sortedGymPlansRevision = -1
    private var gymWorkoutsRevision = 0
    private var sortedGymWorkoutsRevision = -1

#if DEBUG
    private mutating func recordRebuild(_ cache: CacheInvalidation) {
        rebuildCounts[cache, default: 0] += 1
    }
#else
    private func recordRebuild(_ cache: CacheInvalidation) {}
#endif

    var events: [HealthEvent] { sortedEvents }
    var measurements: [Measurement] { sortedMeasurements }
    var appleHealthMeasurements: [Measurement] { sortedAppleHealthMeasurements }
    var cycleEntries: [CycleEntry] { sortedCycleEntries }
    var sleepSessions: [SleepSession] { sortedSleepSessions }
    var appointments: [AppointmentRecord] { sortedAppointments }
    var medications: [MedicationStatement] { sortedMedications }
    var medicationDoseEvents: [MedicationDoseEvent] { sortedMedicationDoseEvents }
    var conditionEpisodes: [ConditionEpisode] { sortedConditionEpisodes }
    var conditionCheckIns: [ConditionCheckIn] { sortedConditionCheckIns }
    var labResults: [LabResult] { sortedLabResults }
    var foodLogEntries: [FoodLogEntry] { sortedFoodLogEntries }

    func measurements(for type: MeasurementType, since startDate: Date? = nil) -> [Measurement] {
        let values = measurementsByType[type] ?? []
        guard let startDate else { return values }
        let endIndex = firstIndex(in: values) { $0.measuredAt < startDate }
        return Array(values[..<endIndex])
    }

    func measurements(for type: MeasurementType, from startDate: Date, to endDate: Date) -> [Measurement] {
        let values = measurementsByType[type] ?? []
        let startIndex = firstIndex(in: values) { $0.measuredAt < endDate }
        let endIndex = firstIndex(in: values, range: startIndex..<values.endIndex) { $0.measuredAt < startDate }
        return Array(values[startIndex..<endIndex])
    }

    func measurementDays(for types: [MeasurementType]) -> Set<Date> {
        types.reduce(into: Set<Date>()) { result, type in
            result.formUnion(measurementDaysByType[type] ?? [])
        }
    }

    func foodLogEntries(from startDate: Date, to endDate: Date) -> [FoodLogEntry] {
        sortedFoodLogEntries.filter { $0.loggedAt >= startDate && $0.loggedAt < endDate }
    }

    mutating func gymWorkouts(from source: [GymWorkout]) -> [GymWorkout] {
        if sortedGymWorkoutsRevision != gymWorkoutsRevision {
            sortedGymWorkouts = source.sorted { lhs, rhs in
                lhs.startedAt == rhs.startedAt ? lhs.id < rhs.id : lhs.startedAt > rhs.startedAt
            }
            sortedGymWorkoutsRevision = gymWorkoutsRevision
        }
        return sortedGymWorkouts
    }

    mutating func gymPlans(from source: [GymPlan]) -> [GymPlan] {
        if sortedGymPlansRevision != gymPlansRevision {
            sortedGymPlans = source.sorted { lhs, rhs in
                lhs.updatedAt == rhs.updatedAt ? lhs.id < rhs.id : lhs.updatedAt > rhs.updatedAt
            }
            sortedGymPlansRevision = gymPlansRevision
        }
        return sortedGymPlans
    }

    mutating func rebuildMeasurements(from source: [Measurement]) {
        sortedMeasurements = source.sorted { $0.measuredAt > $1.measuredAt }
        sortedAppleHealthMeasurements = sortedMeasurements.filter { $0.source == .appleHealth }
        measurementsByType = Dictionary(grouping: sortedMeasurements, by: \.type)
        let calendar = Calendar.current
        measurementDaysByType = measurementsByType.mapValues { measurements in
            Set(measurements.lazy.map { calendar.startOfDay(for: $0.measuredAt) })
        }
    }

    mutating func rebuildSortedCaches(from snapshot: MHDDataSnapshot, invalidation: CacheInvalidation) {
        if invalidation.contains(.events) {
            sortedEvents = snapshot.events.sorted { $0.occurredAt > $1.occurredAt }
            recordRebuild(.events)
        }
        if invalidation.contains(.cycle) {
            sortedCycleEntries = snapshot.cycleEntries.sorted { $0.date > $1.date }
            recordRebuild(.cycle)
        }
        if invalidation.contains(.sleep) {
            sortedSleepSessions = snapshot.sleepSessions.sorted { $0.startAt > $1.startAt }
            recordRebuild(.sleep)
        }
        if invalidation.contains(.appointments) {
            sortedAppointments = snapshot.appointments.sorted { lhs, rhs in
                lhs.scheduledAt == rhs.scheduledAt ? lhs.id < rhs.id : lhs.scheduledAt > rhs.scheduledAt
            }
            recordRebuild(.appointments)
        }
        if invalidation.contains(.medications) {
            sortedMedications = snapshot.medications.sorted { $0.updatedAt > $1.updatedAt }
            recordRebuild(.medications)
        }
        if invalidation.contains(.medicationDoseEvents) {
            sortedMedicationDoseEvents = snapshot.medicationDoseEvents.sorted { $0.recordedAt > $1.recordedAt }
            recordRebuild(.medicationDoseEvents)
        }
        if invalidation.contains(.conditionEpisodes) {
            sortedConditionEpisodes = snapshot.conditionEpisodes.sorted { $0.startedAt > $1.startedAt }
            recordRebuild(.conditionEpisodes)
        }
        if invalidation.contains(.conditionCheckIns) {
            sortedConditionCheckIns = snapshot.conditionCheckIns.sorted { $0.recordedAt > $1.recordedAt }
            recordRebuild(.conditionCheckIns)
        }
        if invalidation.contains(.labResults) {
            sortedLabResults = snapshot.labResults.sorted { $0.collectedAt > $1.collectedAt }
            recordRebuild(.labResults)
        }
        if invalidation.contains(.foodLogEntries) {
            sortedFoodLogEntries = snapshot.foodLogEntries.sorted { $0.loggedAt > $1.loggedAt }
            recordRebuild(.foodLogEntries)
        }
        if invalidation.contains(.gymPlans) {
            gymPlansRevision &+= 1
            recordRebuild(.gymPlans)
        }
        if invalidation.contains(.gymWorkouts) {
            gymWorkoutsRevision &+= 1
            recordRebuild(.gymWorkouts)
        }
    }

    mutating func insertMeasurement(_ measurement: Measurement) {
        let sortedIndex = firstIndex(in: sortedMeasurements) { $0.measuredAt <= measurement.measuredAt }
        sortedMeasurements.insert(measurement, at: sortedIndex)

        var values = measurementsByType[measurement.type] ?? []
        let typeIndex = firstIndex(in: values) { $0.measuredAt <= measurement.measuredAt }
        values.insert(measurement, at: typeIndex)
        measurementsByType[measurement.type] = values

        if measurement.source == .appleHealth {
            let index = firstIndex(in: sortedAppleHealthMeasurements) { $0.measuredAt <= measurement.measuredAt }
            sortedAppleHealthMeasurements.insert(measurement, at: index)
        }

        measurementDaysByType[measurement.type, default: []]
            .insert(Calendar.current.startOfDay(for: measurement.measuredAt))
    }

    mutating func removeMeasurement(_ measurement: Measurement) {
        sortedMeasurements.removeAll { $0.id == measurement.id }
        sortedAppleHealthMeasurements.removeAll { $0.id == measurement.id }
        measurementsByType[measurement.type]?.removeAll { $0.id == measurement.id }
        rebuildMeasurementDays(for: measurement.type)
    }

    mutating func removeMeasurements(
        matching predicate: (Measurement) -> Bool,
        for type: MeasurementType
    ) {
        sortedMeasurements.removeAll(where: predicate)
        sortedAppleHealthMeasurements.removeAll(where: predicate)
        measurementsByType[type]?.removeAll(where: predicate)
        rebuildMeasurementDays(for: type)
    }

    private mutating func rebuildMeasurementDays(for type: MeasurementType) {
        let calendar = Calendar.current
        measurementDaysByType[type] = Set((measurementsByType[type] ?? []).lazy.map {
            calendar.startOfDay(for: $0.measuredAt)
        })
    }

    private func firstIndex(
        in values: [Measurement],
        range: Range<Int>? = nil,
        where predicate: (Measurement) -> Bool
    ) -> Int {
        var lower = range?.lowerBound ?? values.startIndex
        var upper = range?.upperBound ?? values.endIndex
        while lower < upper {
            let middle = lower + (upper - lower) / 2
            if predicate(values[middle]) {
                upper = middle
            } else {
                lower = middle + 1
            }
        }
        return lower
    }
}
