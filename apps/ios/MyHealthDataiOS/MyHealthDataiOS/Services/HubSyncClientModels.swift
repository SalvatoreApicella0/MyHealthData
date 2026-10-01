import CryptoKit
import Foundation

enum HubSyncDateCoding {
    private static let iso8601 = Date.ISO8601FormatStyle()

    static func string(from date: Date) -> String {
        date.formatted(iso8601)
    }

    static func date(from string: String) -> Date? {
        try? Date(string, strategy: iso8601)
    }
}

extension HubSyncClient {
    struct Configuration {
        let endpoint: URL
        let deviceID: String
        let token: String
        let signingKey: Curve25519.Signing.PrivateKey

        func headers(method: String, path: String, idempotency: String? = nil, body: Data = Data()) throws -> [String: String] {
            let timestamp = String(Int(Date().timeIntervalSince1970))
            let idempotencyValue = idempotency ?? ""
            let bodyHash = Data(SHA256.hash(data: body)).base64EncodedString()
            let payload = "\(method)\n\(path)\n\(timestamp)\n\(idempotencyValue)\n\(bodyHash)"
            let signature = try signingKey.signature(for: Data(payload.utf8)).base64EncodedString()
            var values = [
                "X-MHD-Device-ID": deviceID,
                "X-MHD-Device-Token": token,
                "X-MHD-Timestamp": timestamp,
                "X-MHD-Body-SHA256": bodyHash,
                "X-MHD-Signature": signature
            ]
            if let idempotency {
                values["Idempotency-Key"] = idempotency
            }
            return values
        }
    }

    struct Empty: Codable {}

    struct ClaimRequest: Codable {
        let pairingToken: String
        let name: String
        let publicKey: String
    }

    struct ClaimResponse: Codable {
        let deviceId: String
        let deviceToken: String
    }

    struct APIError: Codable {
        let error: String
    }

    struct PushResponse: Codable {
        let idempotent: Bool
        let record: RevisionRecord
    }

    struct DeleteResponse: Codable {
        let idempotent: Bool
    }

    struct RevisionRecord: Codable {
        let revision: Int
    }

    struct BatchRequest: Encodable {
        let records: [RequestMeasurement]
    }

    struct BatchResponse: Decodable {
        let records: [BatchResult]
    }

    struct BatchResult: Decodable {
        let id: String?
        let revision: Int?
        let idempotent: Bool?
        let error: String?
    }

    struct ChangesResponse: Codable {
        let nextCursor: Int
        let changes: [Change]
    }

    struct Change: Codable {
        let record: HubMeasurement
    }

    struct HubMeasurement: Codable {
        let id: String
        let type: MeasurementType
        let value: Double
        let unit: String
        let measuredAt: String
        let note: String?
        let createdAt: String
        let deleted: Bool
        let revision: Int

        var measurement: Measurement? {
            guard let measured = HubSyncDateCoding.date(from: measuredAt),
                  let created = HubSyncDateCoding.date(from: createdAt) else {
                return nil
            }
            return Measurement(
                id: id,
                type: type,
                value: value,
                unit: unit,
                measuredAt: measured,
                note: note,
                createdAt: created,
                source: .mhdImport,
                sourceRecordId: "mhd-hub:\(id)"
            )
        }
    }

    struct IndexChangesResponse: Codable {
        let nextCursor: Int
        let changes: [IndexChange]
    }

    struct IndexChange: Codable {
        let record: IndexRecord
    }

    struct IndexRecord: Codable {
        let id: String
        let revision: Int
        let deleted: Bool
    }

    struct RequestMeasurement: Codable {
        let id: String
        let type: MeasurementType
        let value: Double
        let unit: String
        let measuredAt: String
        let note: String?
        let baseRevision: Int?

        init(_ value: Measurement, baseRevision: Int?) {
            id = value.id
            type = value.type
            self.value = value.value
            unit = value.unit
            measuredAt = HubSyncDateCoding.string(from: value.measuredAt)
            note = value.note
            self.baseRevision = baseRevision
        }
    }

    struct DomainChanges {
        let nextCursor: Int
        let changes: [DomainChange]
    }

    struct DomainChange {
        let record: [String: Any]
    }

    struct AttachmentUploadResponse: Decodable {
        let id: String
        let sha256: String
        let size: Int
    }
}
