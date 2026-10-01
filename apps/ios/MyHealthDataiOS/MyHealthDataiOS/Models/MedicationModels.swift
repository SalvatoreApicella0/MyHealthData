import Foundation

enum MedicationScheduleStyle: String, CaseIterable, Codable, Identifiable {
    case fixedTimes
    case interval
    case asNeeded

    var id: String { rawValue }

    var label: String {
        switch self {
        case .fixedTimes: "Orari fissi"
        case .interval: "Ogni N ore"
        case .asNeeded: "Al bisogno"
        }
    }
}

struct MedicationTime: Codable, Equatable, Hashable, Identifiable {
    var hour: Int
    var minute: Int

    var id: String { "\(hour):\(minute)" }

    init(hour: Int, minute: Int) {
        self.hour = min(max(hour, 0), 23)
        self.minute = min(max(minute, 0), 59)
    }

    var label: String { String(format: "%02d:%02d", hour, minute) }
}

struct MedicationStatement: Codable, Equatable, Identifiable {
    enum Status: String, CaseIterable, Codable, Identifiable {
        case active
        case paused
        case stopped

        var id: String { rawValue }

        var label: String {
            switch self {
            case .active: "Attivo"
            case .paused: "In pausa"
            case .stopped: "Interrotto"
            }
        }
    }

    var id: String = "medication_\(UUID().uuidString)"
    var name: String
    var dose: String
    var schedule: String
    var startDate: Date?
    var endDate: Date?
    var reason: String?
    var note: String?
    var scheduleStyle: MedicationScheduleStyle?
    var scheduledTimes: [MedicationTime]?
    var intervalHours: Int?
    var stockQuantity: Double?
    var refillThreshold: Double?
    var remindersEnabled: Bool?
    var status: Status = .active
    var createdAt: Date = .now
    var updatedAt: Date = .now
}

struct MedicationDoseEvent: Codable, Equatable, Identifiable {
    enum Status: String, CaseIterable, Codable, Identifiable {
        case taken
        case skipped
        case postponed

        var id: String { rawValue }

        var label: String {
            switch self {
            case .taken: "Presa"
            case .skipped: "Saltata"
            case .postponed: "Posticipata"
            }
        }
    }

    var id: String = "dose_\(UUID().uuidString)"
    var medicationId: String
    var scheduledAt: Date?
    var recordedAt: Date
    var status: Status
    var note: String?
    var createdAt: Date = .now
}
