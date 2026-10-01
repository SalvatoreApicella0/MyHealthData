import Foundation
import HealthKit

@MainActor
extension HealthKitImporter {
    private struct DailyAggregationKey: Hashable {
        let type: MeasurementType
        let day: Date
    }

    func compactHighFrequencyHistory(_ measurements: [Measurement]) -> [Measurement] {
        let dailyTotals = HealthKitImportCatalog.dailyTotalTypes
        let dailyAverages = HealthKitImportCatalog.dailyAverageTypes
        let compactedTypes = dailyTotals.union(dailyAverages)
        let calendar = Calendar.current
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        let createdAt = Date()

        let preserved = measurements.filter { !compactedTypes.contains($0.type) }
        let grouped = Dictionary(grouping: measurements.filter { compactedTypes.contains($0.type) }) {
            DailyAggregationKey(type: $0.type, day: calendar.startOfDay(for: $0.measuredAt))
        }
        let compacted = grouped.values.compactMap { values -> Measurement? in
            guard let first = values.first else { return nil }
            let isTotal = dailyTotals.contains(first.type)
            let value = isTotal
                ? values.reduce(0) { $0 + $1.value }
                : values.reduce(0) { $0 + $1.value } / Double(values.count)
            let day = calendar.startOfDay(for: first.measuredAt)
            let dateKey = formatter.string(from: day)
            let aggregation = isTotal ? "sum" : "average"
            let recordID = "healthkit_daily_\(aggregation)_\(first.type.rawValue)_\(dateKey)"
            return Measurement(
                id: "measurement_apple_health_\(recordID)",
                type: first.type,
                value: value,
                unit: first.unit,
                measuredAt: day,
                note: "aggregation=healthkit_daily_\(aggregation)|sample_count=\(values.count)",
                createdAt: createdAt,
                source: .appleHealth,
                sourceRecordId: recordID
            )
        }

        return preserved + compacted
    }

    func importDailyStepTotals(from startDate: Date, to endDate: Date) async throws -> [Measurement] {
        guard isAvailable else {
            throw AppError.healthKitUnavailable
        }

        let calendar = Calendar.current
        let normalizedStart = calendar.startOfDay(for: startDate)
        guard normalizedStart < endDate else { return [] }

        let stepType = HKQuantityType(.stepCount)
        let predicate = HKQuery.predicateForSamples(
            withStart: normalizedStart,
            end: endDate,
            options: .strictStartDate
        )
        let samplePredicate = HKSamplePredicate.quantitySample(
            type: stepType,
            predicate: predicate
        )
        let descriptor = HKStatisticsCollectionQueryDescriptor(
            predicate: samplePredicate,
            options: .cumulativeSum,
            anchorDate: normalizedStart,
            intervalComponents: DateComponents(day: 1)
        )
        let result = try await descriptor.result(for: store)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        let createdAt = Date()
        var measurements: [Measurement] = []

        result.enumerateStatistics(
            from: normalizedStart,
            to: endDate
        ) { statistics, _ in
            guard let quantity = statistics.sumQuantity() else { return }
            let dateKey = formatter.string(from: statistics.startDate)
            let sourceID = "healthkit_daily_steps_\(dateKey)"
            measurements.append(
                Measurement(
                    id: "measurement_apple_health_\(sourceID)",
                    type: .stepCount,
                    value: quantity.doubleValue(for: .count()),
                    unit: "count",
                    measuredAt: statistics.startDate,
                    note: "aggregation=healthkit_daily_cumulative_sum",
                    createdAt: createdAt,
                    source: .appleHealth,
                    sourceRecordId: sourceID
                )
            )
        }

        return measurements
    }
}
