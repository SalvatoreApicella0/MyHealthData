import Foundation

@MainActor
extension HealthDataStore {
    func replaceAppleHealthMeasurements(with imported: [Measurement]) {
        mutate(measurementsChanged: true) { snapshot in
            snapshot.measurements.removeAll { $0.source == .appleHealth }
            snapshot.measurements.append(contentsOf: imported)
        }
    }

    func mergeAppleHealthMeasurements(_ imported: [Measurement]) {
        guard !imported.isEmpty else { return }
        if isBulkAppleHealthImport {
            AppleHealthMeasurementMaintenance.merge(imported, into: &snapshot.measurements, indexes: &bulkAppleHealthIndexes)
            return
        }
        mutate(measurementsChanged: true) { snapshot in
            var indexes = AppleHealthMeasurementMaintenance.indexes(in: snapshot.measurements)
            AppleHealthMeasurementMaintenance.merge(imported, into: &snapshot.measurements, indexes: &indexes)
        }
    }

    /// Starts a bounded-memory import. Measurements are made visible atomically
    /// when `finishBulkAppleHealthImport()` rebuilds the view caches.
    func beginBulkAppleHealthImport() {
        guard isLoaded, !loadFailed, !isBulkAppleHealthImport else { return }
        bulkAppleHealthIndexes = AppleHealthMeasurementMaintenance.indexes(in: snapshot.measurements)
        isBulkAppleHealthImport = true
    }

    /// Commits a completed or interrupted import. Partial windows are valid and
    /// are persisted rather than being discarded after a cancellation.
    func finishBulkAppleHealthImport() {
        guard isBulkAppleHealthImport else { return }
        isBulkAppleHealthImport = false
        bulkAppleHealthIndexes.removeAll(keepingCapacity: false)
        AppleHealthMeasurementMaintenance.compactLegacyTelemetry(&snapshot.measurements)
        rebuildMeasurementCache()
        lastError = nil
        schedulePersistence()
    }

    func replaceAppleHealthDailyAggregates(_ imported: [Measurement], type: MeasurementType) {
        guard isLoaded, !loadFailed, !imported.isEmpty else { return }
        let calendar = Calendar.current
        let importedDays = Set(imported.map { calendar.startOfDay(for: $0.measuredAt) })

        func shouldReplace(_ measurement: Measurement) -> Bool {
            measurement.source == .appleHealth
                && measurement.type == type
                && importedDays.contains(calendar.startOfDay(for: measurement.measuredAt))
        }

        snapshot.measurements.removeAll(where: shouldReplace)
        removeMeasurementsFromCache(matching: shouldReplace, for: type)

        for measurement in imported {
            snapshot.measurements.append(measurement)
            insertIntoMeasurementCache(measurement)
        }

        lastError = nil
        schedulePersistence()
    }
}
