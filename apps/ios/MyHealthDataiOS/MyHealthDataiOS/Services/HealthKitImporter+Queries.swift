import Foundation
import HealthKit

@MainActor
extension HealthKitImporter {
    func categoryNote(for sample: HKCategorySample) -> String {
        let source = String(
            format: NSLocalizedString("Imported from Apple Health: %@", comment: ""),
            sample.sourceRevision.source.name
        )
        guard sample.categoryType.identifier == HKCategoryTypeIdentifier.sleepAnalysis.rawValue else {
            return source
        }
        let stage: String
        switch sample.value {
        case HKCategoryValueSleepAnalysis.asleepCore.rawValue: stage = "core"
        case HKCategoryValueSleepAnalysis.asleepDeep.rawValue: stage = "deep"
        case HKCategoryValueSleepAnalysis.asleepREM.rawValue: stage = "rem"
        default: stage = "asleep"
        }
        return "\(source)|sleep_stage=\(stage)"
    }

    func quantitySamples(type: HKQuantityType, startDate: Date?, endDate: Date, limit: Int) async throws -> [HKQuantitySample] {
        let predicate = samplePredicate(startDate: startDate, endDate: endDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: limit,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                continuation.resume(returning: samples?.compactMap { $0 as? HKQuantitySample } ?? [])
            }

            store.execute(query)
        }
    }

    func anchoredQuantitySamples(type: HKQuantityType) async throws -> (samples: [HKQuantitySample], anchor: HKQueryAnchor?) {
        let key = "healthKit.anchor.quantity.\(type.identifier)"
        let savedAnchor: HKQueryAnchor? = UserDefaults.standard.data(forKey: key).flatMap { try? NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: $0) }
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKAnchoredObjectQuery(type: type, predicate: nil, anchor: savedAnchor, limit: HKObjectQueryNoLimit) { _, samples, _, anchor, error in
                if let error { continuation.resume(throwing: error); return }
                if let anchor, let data = try? NSKeyedArchiver.archivedData(withRootObject: anchor, requiringSecureCoding: true) {
                    UserDefaults.standard.set(data, forKey: key)
                }
                continuation.resume(returning: (samples?.compactMap { $0 as? HKQuantitySample } ?? [], anchor))
            }
            store.execute(query)
        }
    }

    func categorySamples(type: HKCategoryType, startDate: Date?, endDate: Date, limit: Int) async throws -> [HKCategorySample] {
        let predicate = samplePredicate(startDate: startDate, endDate: endDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: limit,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                continuation.resume(returning: samples?.compactMap { $0 as? HKCategorySample } ?? [])
            }

            store.execute(query)
        }
    }

    func workoutSamples(startDate: Date?, endDate: Date, limit: Int) async throws -> [HKWorkout] {
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: .workoutType(),
                predicate: samplePredicate(startDate: startDate, endDate: endDate),
                limit: limit,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: samples?.compactMap { $0 as? HKWorkout } ?? [])
                }
            }
            store.execute(query)
        }
    }

    func samplePredicate(startDate: Date?, endDate: Date) -> NSPredicate? {
        guard let startDate else { return nil }
        return HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: [.strictStartDate]
        )
    }

    func earliestSampleDate(for type: HKSampleType) async throws -> Date? {
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: nil,
                limit: 1,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: samples?.first?.startDate)
                }
            }
            store.execute(query)
        }
    }
}
