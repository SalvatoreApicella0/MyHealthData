import Foundation

struct ConditionEpisode: Codable, Equatable, Identifiable {
    enum Status: String, CaseIterable, Codable, Identifiable {
        case active
        case monitoring
        case recovered
        case archived

        var id: String { rawValue }

        var label: String {
            switch self {
            case .active: "Attivo"
            case .monitoring: "In monitoraggio"
            case .recovered: "Risolto"
            case .archived: "Archiviato"
            }
        }
    }

    var id: String = "episode_\(UUID().uuidString)"
    var title: String
    var startedAt: Date
    var status: Status = .active
    var bodyRegionId: BodyRegionId?
    var summary: String?
    var linkedEventIds: [String] = []
    var linkedDocumentIds: [String] = []
    var createdAt: Date = .now
    var updatedAt: Date = .now
}

struct ConditionCheckIn: Codable, Equatable, Identifiable {
    enum Change: String, CaseIterable, Codable, Identifiable {
        case better
        case same
        case worse

        var id: String { rawValue }

        var label: String {
            switch self {
            case .better: "Meglio"
            case .same: "Uguale"
            case .worse: "Peggio"
            }
        }
    }

    var id: String = "checkin_\(UUID().uuidString)"
    var episodeId: String
    var recordedAt: Date
    var severity: Int
    var change: Change
    var impact: Int?
    var note: String?
    var createdAt: Date = .now
}

struct LabResult: Codable, Equatable, Identifiable {
    var id: String = "lab_\(UUID().uuidString)"
    var panelName: String
    var analyte: String
    var value: Double
    var unit: String
    var referenceRange: String?
    var collectedAt: Date
    var labName: String?
    var linkedDocumentId: String?
    var note: String?
    var comparator: String?
    var referenceLow: Double?
    var referenceHigh: Double?
    var laboratoryFlag: String?
    var createdAt: Date = .now
    var updatedAt: Date = .now
}
