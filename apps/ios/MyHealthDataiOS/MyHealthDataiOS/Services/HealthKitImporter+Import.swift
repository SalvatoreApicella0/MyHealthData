import Foundation
import HealthKit

@MainActor
extension HealthKitImporter {
    func importMeasurements(
        days: Int? = 30,
        maxSamplesPerType: Int = 1_000,
        progress: ((HealthKitImportProgress) -> Void)? = nil
    ) async throws -> (measurements: [Measurement], summary: HealthKitImportSummary) {
        let startDate = days.flatMap { Calendar.current.date(byAdding: .day, value: -$0, to: .now) }
        return try await importMeasurements(
            from: startDate,
            to: .now,
            maxSamplesPerType: maxSamplesPerType,
            progress: progress
        )
    }

    func importMeasurements(
        from startDate: Date?,
        to endDate: Date,
        maxSamplesPerType: Int = 3_000,
        progress: ((HealthKitImportProgress) -> Void)? = nil
    ) async throws -> (measurements: [Measurement], summary: HealthKitImportSummary) {
        guard isAvailable else {
            throw AppError.healthKitUnavailable
        }

        let createdAt = Date()
        var measurements: [Measurement] = []
        var skippedTypes: [String] = []
        var dataTypesWithSamples = 0
        var limitedTypes = 0
        var processedTypes = 0
        let totalTypes = HealthKitImportCatalog.quantityDescriptors.count + HealthKitImportCatalog.categoryDescriptors.count + 1

        func report(_ currentType: String) {
            progress?(
                HealthKitImportProgress(
                    processedTypes: processedTypes,
                    totalTypes: totalTypes,
                    importedMeasurements: measurements.count,
                    currentType: currentType
                )
            )
        }

        report("Preparazione")

        for descriptor in HealthKitImportCatalog.quantityDescriptors {
            try Task.checkCancellation()
            guard let quantityType = HKObjectType.quantityType(forIdentifier: descriptor.identifier) else {
                skippedTypes.append(descriptor.identifier.rawValue)
                processedTypes += 1
                report(descriptor.measurementType.label)
                continue
            }

            let samples: [HKQuantitySample]
            do {
                samples = try await quantitySamples(type: quantityType, startDate: startDate, endDate: endDate, limit: maxSamplesPerType)
            } catch {
                skippedTypes.append(descriptor.identifier.rawValue)
                processedTypes += 1
                report(descriptor.measurementType.label)
                continue
            }
            if !samples.isEmpty { dataTypesWithSamples += 1 }
            if maxSamplesPerType > 0 && samples.count == maxSamplesPerType { limitedTypes += 1 }
            measurements.append(contentsOf: samples.map { sample in
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
            processedTypes += 1
            report(descriptor.measurementType.label)
        }

        for descriptor in HealthKitImportCatalog.categoryDescriptors {
            try Task.checkCancellation()
            guard let categoryType = HKObjectType.categoryType(forIdentifier: descriptor.identifier) else {
                skippedTypes.append(descriptor.identifier.rawValue)
                processedTypes += 1
                report(descriptor.measurementType.label)
                continue
            }

            let categorySamples: [HKCategorySample]
            do {
                categorySamples = try await self.categorySamples(type: categoryType, startDate: startDate, endDate: endDate, limit: maxSamplesPerType)
            } catch {
                skippedTypes.append(descriptor.identifier.rawValue)
                processedTypes += 1
                report(descriptor.measurementType.label)
                continue
            }
            let samples = categorySamples.filter { sample in
                descriptor.acceptedValues?.contains(sample.value) ?? true
            }
            if !samples.isEmpty { dataTypesWithSamples += 1 }
            if maxSamplesPerType > 0 && categorySamples.count == maxSamplesPerType { limitedTypes += 1 }

            measurements.append(contentsOf: samples.map { sample in
                let durationSeconds = max(sample.endDate.timeIntervalSince(sample.startDate), 0)
                let value = descriptor.measurementType == .sleepHours
                    ? durationSeconds / 3600
                    : durationSeconds / 60

                return Measurement(
                    id: "measurement_apple_health_\(sample.uuid.uuidString)",
                    type: descriptor.measurementType,
                    value: value,
                    unit: descriptor.unitLabel,
                    measuredAt: sample.startDate,
                    note: categoryNote(for: sample),
                    createdAt: createdAt,
                    source: .appleHealth,
                    sourceRecordId: sample.uuid.uuidString
                )
            })
            processedTypes += 1
            report(descriptor.measurementType.label)
        }

        try Task.checkCancellation()
        let workoutDateFormatter = ISO8601DateFormatter()
        let workouts = (try? await workoutSamples(startDate: startDate, endDate: endDate, limit: maxSamplesPerType)) ?? []
        if !workouts.isEmpty { dataTypesWithSamples += 1 }
        if maxSamplesPerType > 0 && workouts.count == maxSamplesPerType { limitedTypes += 1 }
        measurements.append(contentsOf: workouts.map { workout in
            let distance = workout.totalDistance?.doubleValue(for: .meterUnit(with: .kilo))
            let activeEnergyType = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)
            let energy = activeEnergyType
                .flatMap { workout.statistics(for: $0)?.sumQuantity() }
                .map { $0.doubleValue(for: .kilocalorie()) }
            let metadataParts: [String?] = [
                "workout_type=\(workout.workoutActivityType.rawValue)",
                "end=\(workoutDateFormatter.string(from: workout.endDate))",
                distance.map { "distance_km=\($0)" },
                energy.map { "energy_kcal=\($0)" },
                "source=\(workout.sourceRevision.source.name)"
            ]
            let metadata = metadataParts.compactMap { $0 }.joined(separator: "|")
            return Measurement(
                id: "measurement_apple_health_\(workout.uuid.uuidString)",
                type: .workoutMinutes,
                value: workout.duration / 60,
                unit: "min",
                measuredAt: workout.startDate,
                note: metadata,
                createdAt: createdAt,
                source: .appleHealth,
                sourceRecordId: workout.uuid.uuidString
            )
        })
        processedTypes += 1
        report(MeasurementType.workoutMinutes.label)

        let earliestImportedStep = measurements
            .lazy
            .filter { $0.type == .stepCount }
            .map(\.measuredAt)
            .min()
        let dailySteps = try await importDailyStepTotals(
            from: startDate
                ?? earliestImportedStep
                ?? Calendar.current.date(byAdding: .day, value: -30, to: endDate)
                ?? endDate,
            to: endDate
        )
        measurements.removeAll { $0.type == .stepCount }
        measurements.append(contentsOf: dailySteps)

        // Apple Watch can generate hundreds of thousands of samples for a
        // multi-year history. Keep clinically useful point observations (for
        // example weight, pressure, glucose and sleep) unchanged, while storing
        // high-frequency telemetry as deterministic daily aggregates.
        measurements = compactHighFrequencyHistory(measurements)

        let uniqueMeasurements = Dictionary(
            measurements.map { ($0.sourceRecordId ?? $0.id, $0) },
            uniquingKeysWith: { first, _ in first }
        ).values.sorted { $0.measuredAt > $1.measuredAt }

        return (
            uniqueMeasurements,
            HealthKitImportSummary(
                importedMeasurements: uniqueMeasurements.count,
                dataTypesWithSamples: dataTypesWithSamples,
                skippedTypes: skippedTypes,
                oldestSampleDate: uniqueMeasurements.map(\.measuredAt).min(),
                newestSampleDate: uniqueMeasurements.map(\.measuredAt).max(),
                limitedTypes: limitedTypes
            )
        )
    }

    /// Reads a long history in bounded date windows. The caller receives each
    /// completed window immediately instead of retaining the entire HealthKit
    /// history plus its normalized representation in memory at once.
    func importMeasurementsInWindows(
        from startDate: Date,
        to endDate: Date = .now,
        windowDays: Int = 14,
        maxSamplesPerType: Int = HKObjectQueryNoLimit,
        progress: ((HealthKitImportProgress) -> Void)? = nil,
        onWindow: ([Measurement]) -> Void
    ) async throws -> HealthKitImportSummary {
        let calendar = Calendar.current
        let safeWindowDays = max(windowDays, 1)
        let secondsPerDay: TimeInterval = 86_400
        let totalWindows = max(
            1,
            Int(ceil(endDate.timeIntervalSince(startDate) / (Double(safeWindowDays) * secondsPerDay)))
        )
        let typesPerWindow = HealthKitImportCatalog.quantityDescriptors.count + HealthKitImportCatalog.categoryDescriptors.count + 1
        var completedWindows = 0
        var importedMeasurements = 0
        var typesWithSamples = 0
        var skippedTypes: [String] = []
        var limitedTypes = 0
        var oldestSampleDate: Date?
        var newestSampleDate: Date?
        var windowEnd = endDate

        while windowEnd > startDate {
            try Task.checkCancellation()
            let windowStart = max(
                calendar.date(byAdding: .day, value: -safeWindowDays, to: windowEnd) ?? startDate,
                startDate
            )
            let result = try await importMeasurements(
                from: windowStart,
                to: windowEnd,
                maxSamplesPerType: maxSamplesPerType,
                progress: { inner in
                    progress?(
                        HealthKitImportProgress(
                            processedTypes: completedWindows * typesPerWindow + inner.processedTypes,
                            totalTypes: totalWindows * typesPerWindow,
                            importedMeasurements: importedMeasurements + inner.importedMeasurements,
                            currentType: "\(inner.currentType) · \(completedWindows + 1)/\(totalWindows)"
                        )
                    )
                }
            )

            onWindow(result.measurements)
            importedMeasurements += result.summary.importedMeasurements
            typesWithSamples += result.summary.dataTypesWithSamples
            skippedTypes.append(contentsOf: result.summary.skippedTypes)
            limitedTypes += result.summary.limitedTypes
            if let date = result.summary.oldestSampleDate {
                oldestSampleDate = min(oldestSampleDate ?? date, date)
            }
            if let date = result.summary.newestSampleDate {
                newestSampleDate = max(newestSampleDate ?? date, date)
            }

            completedWindows += 1
            windowEnd = windowStart
            await Task.yield()
        }

        return HealthKitImportSummary(
            importedMeasurements: importedMeasurements,
            dataTypesWithSamples: typesWithSamples,
            skippedTypes: Array(Set(skippedTypes)).sorted(),
            oldestSampleDate: oldestSampleDate,
            newestSampleDate: newestSampleDate,
            limitedTypes: limitedTypes
        )
    }
}
