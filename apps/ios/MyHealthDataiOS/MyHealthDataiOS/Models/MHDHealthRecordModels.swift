import Foundation

struct LocalProfile: Codable, Equatable {
    var id: String = "local-profile"
    var alias: String?
    var birthDate: String?
    var biologicalSex: BiologicalSex?
    var gender: String?
    var heightCm: Double?
    var currentWeightKg: Double?
    var personalNotes: String?
    var knownAllergies: String?
    var regularMedications: String?
    var knownConditions: String?
    var updatedAt: Date = .now
}

struct AttachmentMetadata: Codable, Equatable, Identifiable {
    var id: String = "attachment_\(UUID().uuidString)"
    var name: String
    var type: String
    var size: Int
    var lastModified: TimeInterval?
    /// Present for scanner-created PDFs so the original page count survives
    /// vault, export and Hub round-trips without putting page content in the
    /// record metadata.
    var pageCount: Int? = nil
    var vaultFileName: String?
    var sha256: String?
    var storedAt: Date?
}

struct HealthEvent: Codable, Equatable, Identifiable {
    var id: String = "event_\(UUID().uuidString)"
    var type: EventType
    var bodyRegionId: BodyRegionId?
    var bodyPoint: BodyPoint?
    var occurredAt: Date
    var intensity: Int?
    var durationMinutes: Double?
    var description: String
    var suspectedTrigger: String?
    var helpedBy: String?
    var tags: [String] = []
    var attachments: [AttachmentMetadata] = []
    var createdAt: Date = .now
    var updatedAt: Date = .now
    var source: RecordSource = .manual
    var sourceRecordId: String?
}

struct Measurement: Codable, Equatable, Identifiable {
    var id: String = "measurement_\(UUID().uuidString)"
    var type: MeasurementType
    var value: Double
    var unit: String
    var measuredAt: Date
    var note: String?
    var createdAt: Date = .now
    var source: RecordSource = .manual
    var sourceRecordId: String?
}

struct HealthDocument: Codable, Equatable, Identifiable {
    var id: String = "document_\(UUID().uuidString)"
    var title: String
    var documentType: DocumentType
    var documentDate: String
    var description: String?
    var linkedEventId: String?
    var linkedModuleId: String?
    var linkedAppointmentId: String?
    var bodyRegionId: BodyRegionId?
    var attachment: AttachmentMetadata?
    var ocrText: String?
    var needsClassification: Bool? = nil
    var createdAt: Date = .now
    var updatedAt: Date = .now
}

/// Canonical document dates are date-only strings, while older exports may
/// contain a full ISO-8601 timestamp. Keep both representations readable so
/// editing metadata never changes a document's clinical date accidentally.
enum MHDDocumentDateCoding {
    static func date(from rawValue: String) -> Date? {
        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let dateOnlyFormatter = ISO8601DateFormatter()
        dateOnlyFormatter.formatOptions = [.withFullDate]
        return dateOnlyFormatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    static func string(from date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter.string(from: date)
    }
}

struct SleepSession: Codable, Equatable, Identifiable {
    var id: String = "sleep_\(UUID().uuidString)"
    var startAt: Date
    var endAt: Date
    var quality: Int?
    var awakenings: Int?
    var note: String?
    var source: RecordSource = .manual
    var createdAt: Date = .now
    var updatedAt: Date = .now

    var durationHours: Double {
        max(endAt.timeIntervalSince(startAt) / 3600, 0)
    }
}

struct SleepSettings: Codable, Equatable {
    var goalMinutes: Int

    init(goalMinutes: Int = 480) {
        self.goalMinutes = min(max(goalMinutes, 180), 900)
    }

    private enum CodingKeys: String, CodingKey { case goalMinutes }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(goalMinutes: try container.decodeIfPresent(Int.self, forKey: .goalMinutes) ?? 480)
    }
}
