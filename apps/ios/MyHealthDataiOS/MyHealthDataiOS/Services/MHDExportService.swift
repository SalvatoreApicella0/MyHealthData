import Foundation

struct MHDExportService {
    func exportData(snapshot: MHDDataSnapshot) throws -> Data {
        var exportFile = MHDExportFile(
            snapshot: snapshot,
            appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
            buildNumber: Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String
        )
        exportFile.integrity = try integrity(
            for: snapshot,
            recordCounts: exportFile.metadata.recordCounts,
            generatedAt: exportFile.manifest.exportedAt
        )
        return try MHDDateCoding.encoder.encode(exportFile)
    }

    func importSnapshot(from data: Data) throws -> MHDDataSnapshot {
        let exportFile = try MHDDateCoding.decoder.decode(MHDExportFile.self, from: data)
        guard exportFile.manifest.app == "MyHealthData" else {
            throw AppError.importFailed("manifest app is not MyHealthData")
        }
        guard exportFile.manifest.schemaVersion == "0.1.0" else {
            throw AppError.importFailed("unsupported schema version \(exportFile.manifest.schemaVersion)")
        }
        try validate(exportFile)
        return exportFile.snapshot
    }

    func exportBackup(snapshot: MHDDataSnapshot, encryptedAttachments: [String: Data]) throws -> Data {
        let records = try exportData(snapshot: snapshot)
        let measurementsCSV = csv(headers: ["id", "type", "value", "unit", "measuredAt"], rows: snapshot.measurements.map { [$0.id, String($0.type.rawValue), String($0.value), $0.unit, $0.measuredAt.formatted(.iso8601)] })
        let eventsCSV = csv(headers: ["id", "type", "occurredAt", "description"], rows: snapshot.events.map { [$0.id, $0.type.rawValue, $0.occurredAt.formatted(.iso8601), $0.description] })
        var entries: [(String, Data)] = [("records.json", records), ("csv/measurements.csv", measurementsCSV), ("csv/events.csv", eventsCSV)]
        let safeAttachmentCharacters = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_."))
        entries.append(contentsOf: encryptedAttachments.compactMap { key, value in
            guard let safeID = key.addingPercentEncoding(withAllowedCharacters: safeAttachmentCharacters) else { return nil }
            return ("attachments/\(safeID).vault", value)
        })
        let checksums = entries.reduce(into: [String: String]()) { $0[$1.0] = MHDHashing.sha256Hex($1.1) }
        let manifest: [String: Any] = ["format": "mhdzip", "schema": "1", "createdAt": Date.now.formatted(.iso8601), "members": entries.map(\.0), "checksums": checksums]
        let manifestData = try JSONSerialization.data(withJSONObject: manifest, options: [.sortedKeys])
        entries.insert(("manifest.json", manifestData), at: 0)
        return try MHDZipArchive.make(entries: entries)
    }

    func importBackup(from data: Data) throws -> (snapshot: MHDDataSnapshot, attachments: [String: Data]) {
        let entries = try MHDZipArchive.extract(data)
        if let manifestData = entries["manifest.json"],
           let manifest = try JSONSerialization.jsonObject(with: manifestData) as? [String: Any],
           let checksums = manifest["checksums"] as? [String: String] {
            for (path, expected) in checksums {
                guard let member = entries[path], MHDHashing.sha256Hex(member) == expected else {
                    throw AppError.importFailed("backup checksum mismatch for \(path)")
                }
            }
        }
        guard let records = entries["records.json"] else { throw AppError.importFailed("backup is missing records.json") }
        return (try importSnapshot(from: records), entries.filter { $0.key.hasPrefix("attachments/") })
    }

    private func csv(headers: [String], rows: [[String]]) -> Data {
        func escaped(_ value: String) -> String { "\"\(value.replacingOccurrences(of: "\"", with: "\"\""))\"" }
        return ([headers] + rows).map { $0.map(escaped).joined(separator: ",") }.joined(separator: "\n").data(using: .utf8) ?? Data()
    }

    private func validate(_ exportFile: MHDExportFile) throws {
        let snapshot = exportFile.snapshot
        guard exportFile.metadata.recordCounts.matches(snapshot: snapshot) else {
            throw AppError.importFailed("record counts do not match export contents")
        }

        guard let integrity = exportFile.integrity else {
            return
        }
        guard integrity.algorithm == "SHA-256" else {
            throw AppError.importFailed("unsupported integrity algorithm \(integrity.algorithm)")
        }

        let expectedIntegrity = try self.integrity(
            for: snapshot,
            recordCounts: exportFile.metadata.recordCounts,
            generatedAt: integrity.generatedAt
        )
        let legacyRecordsSHA256 = try legacyRecordsSHA256(for: snapshot)
        let previousRecordsSHA256 = try previousRecordsSHA256(for: snapshot)
        let preGymPlansRecordsSHA256 = try preGymPlansRecordsSHA256(for: snapshot)
        guard integrity.recordsSHA256 == expectedIntegrity.recordsSHA256
                || integrity.recordsSHA256 == previousRecordsSHA256
                || integrity.recordsSHA256 == preGymPlansRecordsSHA256
                || integrity.recordsSHA256 == legacyRecordsSHA256 else {
            throw AppError.importFailed("records checksum mismatch")
        }
        guard integrity.recordCountsSHA256 == expectedIntegrity.recordCountsSHA256 else {
            throw AppError.importFailed("record counts checksum mismatch")
        }
    }

    private func integrity(
        for snapshot: MHDDataSnapshot,
        recordCounts: MHDExportFile.Metadata.RecordCounts,
        generatedAt: Date
    ) throws -> MHDExportFile.Integrity {
        let recordsData = try MHDDateCoding.encoder.encode(MHDExportRecordsPayload(snapshot: snapshot))
        let recordCountsData = try MHDDateCoding.encoder.encode(recordCounts)
        return MHDExportFile.Integrity(
            recordsSHA256: MHDHashing.sha256Hex(recordsData),
            recordCountsSHA256: MHDHashing.sha256Hex(recordCountsData),
            generatedAt: generatedAt
        )
    }

    private func legacyRecordsSHA256(for snapshot: MHDDataSnapshot) throws -> String {
        let data = try MHDDateCoding.encoder.encode(MHDLegacyExportRecordsPayload(snapshot: snapshot))
        return MHDHashing.sha256Hex(data)
    }

    private func previousRecordsSHA256(for snapshot: MHDDataSnapshot) throws -> String {
        let data = try MHDDateCoding.encoder.encode(MHDPreviousExportRecordsPayload(snapshot: snapshot))
        return MHDHashing.sha256Hex(data)
    }

    private func preGymPlansRecordsSHA256(for snapshot: MHDDataSnapshot) throws -> String {
        let data = try MHDDateCoding.encoder.encode(MHDPreGymPlansExportRecordsPayload(snapshot: snapshot))
        return MHDHashing.sha256Hex(data)
    }
}
