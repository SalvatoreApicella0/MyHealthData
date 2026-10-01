import Foundation

/// Temporary Apple-side adapter for the versioned cross-platform body-measurement contract.
/// It deliberately does not alter the existing vault or trigger network activity.
struct CanonicalBodyMeasurementAdapter {
    static let schemaVersion = "0.1.0"
    static let protocolVersion = "0.1.0"

    struct Record: Codable, Equatable {
        struct Provenance: Codable, Equatable {
            let sourcePlatform: String
            let sourceApplication: String
            let sourceRecordId: String
            let kind: String
            let sourceDevice: String?
        }

        let recordId: String
        let subjectId: String
        let moduleId: String
        let recordType: String
        let schemaVersion: String
        let protocolVersion: String
        let provenance: Provenance
        let createdAt: String
        let observedAt: String
        let updatedAt: String?
        let revision: Int
        let unit: String
        let value: Double
        let deleted: Bool
        let integrity: [String: String]
    }

    enum AdapterError: LocalizedError {
        case unsupportedMeasurementType
        case unsupportedUnit
        case invalidSubjectID

        var errorDescription: String? {
            switch self {
            case .unsupportedMeasurementType: "La misura non fa parte del contratto corporeo iniziale."
            case .unsupportedUnit: "L'unità della misura non è compatibile con il contratto corporeo iniziale."
            case .invalidSubjectID: "L'identificatore pseudonimo del soggetto non è valido."
            }
        }
    }

    func convert(_ measurement: Measurement, subjectID: String) throws -> Record {
        guard subjectID.count >= 16 else { throw AdapterError.invalidSubjectID }
        let recordType: String
        let canonicalUnit: String

        switch measurement.type {
        case .weight:
            recordType = "weight"; canonicalUnit = "kg"
        case .height:
            recordType = "height"; canonicalUnit = "cm"
        case .waistCircumference:
            recordType = "waist_circumference"; canonicalUnit = "cm"
        case .hipCircumference:
            recordType = "hip_circumference"; canonicalUnit = "cm"
        case .bodyFatPercentage:
            recordType = "body_fat_percentage"; canonicalUnit = "percent"
        default:
            throw AdapterError.unsupportedMeasurementType
        }

        guard matches(measurement.unit, canonical: canonicalUnit) else { throw AdapterError.unsupportedUnit }
        let formatter = ISO8601DateFormatter()
        let source = measurement.source == .appleHealth ? "apple" : "apple"
        let kind = measurement.source == .appleHealth ? "normalized" : "raw"
        return Record(
            recordId: canonicalRecordID(for: measurement),
            subjectId: subjectID,
            moduleId: "body_measurements",
            recordType: recordType,
            schemaVersion: Self.schemaVersion,
            protocolVersion: Self.protocolVersion,
            provenance: .init(
                sourcePlatform: source,
                sourceApplication: "MyHealthData",
                sourceRecordId: measurement.sourceRecordId ?? measurement.id,
                kind: kind,
                sourceDevice: nil
            ),
            createdAt: formatter.string(from: measurement.createdAt),
            observedAt: formatter.string(from: measurement.measuredAt),
            updatedAt: nil,
            revision: 1,
            unit: canonicalUnit,
            value: measurement.value,
            deleted: false,
            integrity: [:]
        )
    }

    private func matches(_ unit: String, canonical: String) -> Bool {
        switch canonical {
        case "kg": unit.caseInsensitiveCompare("kg") == .orderedSame
        case "cm": unit.caseInsensitiveCompare("cm") == .orderedSame
        case "percent": unit == "%" || unit.caseInsensitiveCompare("percent") == .orderedSame
        default: false
        }
    }

    private func stableUUID(from value: String) -> String {
        if UUID(uuidString: value) != nil { return value }
        let digest = MHDHashing.sha256Hex(value)
        let parts = [String(digest.prefix(8)), String(digest.dropFirst(8).prefix(4)), String(digest.dropFirst(12).prefix(4)), String(digest.dropFirst(16).prefix(4)), String(digest.dropFirst(20).prefix(12))]
        return parts.joined(separator: "-")
    }

    private func canonicalRecordID(for measurement: Measurement) -> String {
        let marker = "mhd-relay:"
        if let sourceRecordId = measurement.sourceRecordId,
           sourceRecordId.hasPrefix(marker) {
            let value = String(sourceRecordId.dropFirst(marker.count))
            if UUID(uuidString: value) != nil {
                return value
            }
        }
        return stableUUID(from: measurement.id)
    }
}
