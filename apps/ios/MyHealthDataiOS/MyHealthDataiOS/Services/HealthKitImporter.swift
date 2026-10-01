import Foundation
import HealthKit

struct HealthKitImportSummary: Equatable {
    var importedMeasurements: Int
    var dataTypesWithSamples: Int
    var skippedTypes: [String]
    var oldestSampleDate: Date?
    var newestSampleDate: Date?
    var limitedTypes: Int
}

struct HealthKitImportProgress: Equatable, Sendable {
    var processedTypes: Int
    var totalTypes: Int
    var importedMeasurements: Int
    var currentType: String

    var fractionCompleted: Double {
        guard totalTypes > 0 else { return 0 }
        return Double(processedTypes) / Double(totalTypes)
    }
}

struct HealthKitAuthorizationSummary: Equatable {
    var requestedReadTypes: Int
}

@MainActor
final class HealthKitImporter {
    let store = HKHealthStore()

    private let quantityDescriptors = HealthKitImportCatalog.quantityDescriptors
    private let categoryDescriptors = HealthKitImportCatalog.categoryDescriptors

    var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    var requestedReadableTypeCount: Int {
        readableTypes.count
    }

    /// Types that can wake the app when Apple Health receives a new sample.
    /// The app still performs the import locally; the observer itself carries no health value.
    var observableSampleTypes: [HKSampleType] {
        observableSampleTypesCache
    }

    private lazy var observableSampleTypesCache: [HKSampleType] = {
        let quantities = quantityDescriptors.compactMap { HKObjectType.quantityType(forIdentifier: $0.identifier) }
        let categories = categoryDescriptors.compactMap { HKObjectType.categoryType(forIdentifier: $0.identifier) }
        return quantities + categories + [HKObjectType.workoutType()]
    }()

    func requestAuthorization() async throws -> HealthKitAuthorizationSummary {
        guard isAvailable else {
            throw AppError.healthKitUnavailable
        }

        let readTypes = readableTypes

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            store.requestAuthorization(toShare: [], read: readTypes) { success, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                if success {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: AppError.importFailed("HealthKit authorization was not granted."))
                }
            }
        }

        return HealthKitAuthorizationSummary(requestedReadTypes: readTypes.count)
    }

    /// Imports only new quantity samples using one persisted anchor per HealthKit type.
    /// Date-window import remains the compatibility path for categories and workouts.
    func importAnchoredQuantityMeasurements() async throws -> [Measurement] {
        guard isAvailable else { throw AppError.healthKitUnavailable }
        let createdAt = Date()
        var result: [Measurement] = []
        for descriptor in quantityDescriptors {
            try Task.checkCancellation()
            guard let type = HKObjectType.quantityType(forIdentifier: descriptor.identifier) else { continue }
            let update = try await anchoredQuantitySamples(type: type)
            result.append(contentsOf: update.samples.map { sample in
                Measurement(
                    id: "measurement_apple_health_\(sample.uuid.uuidString)",
                    type: descriptor.measurementType,
                    value: sample.quantity.doubleValue(for: descriptor.unit) * descriptor.multiplier,
                    unit: descriptor.unitLabel,
                    measuredAt: sample.startDate,
                    note: String(format: NSLocalizedString("Imported from Apple Health: %@", comment: ""), sample.sourceRevision.source.name),
                    createdAt: createdAt,
                    source: .appleHealth,
                    sourceRecordId: sample.uuid.uuidString
                )
            })
        }
        return result
    }

    /// Finds the oldest readable sample once so history backfill can cover the
    /// user's actual Apple Health history instead of an arbitrary one-year cap.
    func earliestReadableSampleDate() async -> Date? {
        guard isAvailable else { return nil }

        let types = observableSampleTypes
        var earliest: Date?
        for type in types {
            guard let date = try? await earliestSampleDate(for: type) else { continue }
            earliest = earliest.map { min($0, date) } ?? date
        }
        return earliest
    }

    private lazy var readableTypes: Set<HKObjectType> = {
        var types = Set<HKObjectType>()
        for descriptor in quantityDescriptors {
            if let type = HKObjectType.quantityType(forIdentifier: descriptor.identifier) {
                types.insert(type)
            }
        }
        for descriptor in categoryDescriptors {
            if let type = HKObjectType.categoryType(forIdentifier: descriptor.identifier) {
                types.insert(type)
            }
        }
        types.insert(HKObjectType.workoutType())
        return types
    }()

}
