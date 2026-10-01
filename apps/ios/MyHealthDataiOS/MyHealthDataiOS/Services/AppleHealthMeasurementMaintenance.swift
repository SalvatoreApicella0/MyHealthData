import Foundation

enum AppleHealthMeasurementMaintenance {
    static func merge(
        _ imported: [Measurement],
        into measurements: inout [Measurement],
        indexes: inout [String: Int]
    ) {
        let calendar = Calendar.current
        let dailyAggregateDays = Dictionary(
            grouping: imported.filter {
                $0.source == .appleHealth
                    && ($0.note ?? "").contains("aggregation=healthkit_daily_")
            },
            by: \.type
        )
        .mapValues { values in
            Set(values.map { calendar.startOfDay(for: $0.measuredAt) })
        }

        if !dailyAggregateDays.isEmpty {
            measurements.removeAll { measurement in
                guard measurement.source == .appleHealth,
                      let days = dailyAggregateDays[measurement.type] else {
                    return false
                }
                return days.contains(calendar.startOfDay(for: measurement.measuredAt))
            }
            indexes = Self.indexes(in: measurements)
        }

        for measurement in imported {
            let key = measurement.sourceRecordId ?? measurement.id
            if let index = indexes[key] {
                measurements[index] = measurement
            } else {
                indexes[key] = measurements.count
                measurements.append(measurement)
            }
        }
    }

    static func indexes(in measurements: [Measurement]) -> [String: Int] {
        var result: [String: Int] = [:]
        result.reserveCapacity(measurements.count)
        for (index, measurement) in measurements.enumerated() where measurement.source == .appleHealth {
            result[measurement.sourceRecordId ?? measurement.id] = index
        }
        return result
    }

    /// Replaces high-frequency historical Apple Health telemetry with one
    /// daily aggregate per metric. This keeps long-lived vaults compact while
    /// preserving the trend data used by the dashboard.
    static func compactLegacyTelemetry(_ measurements: inout [Measurement]) {
        let totalTypes: Set<MeasurementType> = [
            .activeEnergyBurned, .basalEnergyBurned, .distanceWalkingRunning,
            .distanceCycling, .distanceSwimming, .flightsClimbed,
            .exerciseMinutes, .standMinutes, .daylightMinutes, .dietaryWater,
            .dietaryEnergy, .dietaryCaffeine, .swimmingStrokeCount,
            .wheelchairPushCount, .distanceWheelchair
        ]
        let averageTypes: Set<MeasurementType> = [
            .heartRate, .heartRateVariability, .respiratoryRate,
            .walkingHeartRateAverage, .walkingSpeed, .walkingStepLength,
            .walkingAsymmetry, .walkingDoubleSupport, .physicalEffort,
            .environmentalAudioExposure, .headphoneAudioExposure
        ]
        let compactedTypes = totalTypes.union(averageTypes)
        let calendar = Calendar.current
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        let telemetry = measurements.filter {
            $0.source == .appleHealth && compactedTypes.contains($0.type)
        }
        guard !telemetry.isEmpty else { return }

        let preserved = measurements.filter {
            $0.source != .appleHealth || !compactedTypes.contains($0.type)
        }
        let grouped = Dictionary(grouping: telemetry) {
            "\($0.type.rawValue)|\(formatter.string(from: calendar.startOfDay(for: $0.measuredAt)))"
        }
        let compacted = grouped.values.compactMap { values -> Measurement? in
            guard let first = values.first else { return nil }
            let raw = values.filter { !($0.note ?? "").contains("aggregation=healthkit_daily_") }
            let source = raw.isEmpty ? [values.last ?? first] : raw
            let isTotal = totalTypes.contains(first.type)
            let value = isTotal
                ? source.reduce(0) { $0 + $1.value }
                : source.reduce(0) { $0 + $1.value } / Double(source.count)
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
                note: "aggregation=healthkit_daily_\(aggregation)|sample_count=\(source.count)",
                createdAt: .now,
                source: .appleHealth,
                sourceRecordId: recordID
            )
        }
        measurements = preserved + compacted
    }
}
