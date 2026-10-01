import Foundation

/// Persistent sync bookkeeping. A first sync can involve tens of thousands of
/// records, so fingerprints and revisions live in a JSON file instead of
/// `UserDefaults`, which is not meant for multi-megabyte dictionaries.
struct HubSyncState: Codable, Sendable {
    struct DomainState: Codable, Sendable {
        var cursor = 0
        var uploaded: [String: String] = [:]
        var revisions: [String: Int] = [:]
        var knownRemote: [String] = []
    }

    /// Bookkeeping for an attachment that could not be completed yet. This
    /// deliberately stores no filename, MIME data or error text: the state
    /// file must remain useful for retry without becoming a PHI log.
    struct AttachmentSyncState: Codable, Sendable, Equatable {
        enum Direction: String, Codable, Sendable {
            case upload
            case download
        }

        enum Failure: String, Codable, Sendable {
            case network
            case notFound
            case invalidResponse
            case server
            case cancelled
            case unknown
        }

        var fingerprint: String
        var direction: Direction
        var attempts: Int = 0
        var nextAttemptAt: Date?
        var lastAttemptAt: Date?
        var lastFailure: Failure?

        init(fingerprint: String, direction: Direction) {
            self.fingerprint = fingerprint
            self.direction = direction
        }
    }

    var measurementCursor = 0
    var measurementUploaded: [String: String] = [:]
    var measurementRevisions: [String: Int] = [:]
    var measurementKnownRemote: [String] = []
    var remoteOwned: [String] = []
    var domains: [String: DomainState] = [:]
    var attachmentsUploaded: [String: String] = [:]
    var attachmentQueue: [String: AttachmentSyncState] = [:]

    init() {}

    private enum CodingKeys: String, CodingKey {
        case measurementCursor, measurementUploaded, measurementRevisions
        case measurementKnownRemote, remoteOwned, domains, attachmentsUploaded
        case attachmentQueue
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        measurementCursor = try container.decodeIfPresent(Int.self, forKey: .measurementCursor) ?? 0
        measurementUploaded = try container.decodeIfPresent([String: String].self, forKey: .measurementUploaded) ?? [:]
        measurementRevisions = try container.decodeIfPresent([String: Int].self, forKey: .measurementRevisions) ?? [:]
        measurementKnownRemote = try container.decodeIfPresent([String].self, forKey: .measurementKnownRemote) ?? []
        remoteOwned = try container.decodeIfPresent([String].self, forKey: .remoteOwned) ?? []
        domains = try container.decodeIfPresent([String: DomainState].self, forKey: .domains) ?? [:]
        attachmentsUploaded = try container.decodeIfPresent([String: String].self, forKey: .attachmentsUploaded) ?? [:]
        attachmentQueue = try container.decodeIfPresent([String: AttachmentSyncState].self, forKey: .attachmentQueue) ?? [:]
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(measurementCursor, forKey: .measurementCursor)
        try container.encode(measurementUploaded, forKey: .measurementUploaded)
        try container.encode(measurementRevisions, forKey: .measurementRevisions)
        try container.encode(measurementKnownRemote, forKey: .measurementKnownRemote)
        try container.encode(remoteOwned, forKey: .remoteOwned)
        try container.encode(domains, forKey: .domains)
        try container.encode(attachmentsUploaded, forKey: .attachmentsUploaded)
        try container.encode(attachmentQueue, forKey: .attachmentQueue)
    }

    func domain(_ key: String) -> DomainState { domains[key] ?? DomainState() }
    mutating func update(_ key: String, _ value: DomainState) { domains[key] = value }
}

enum HubSyncStateStore {
    private static var fileURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base.appending(path: "MyHealthDataHub", directoryHint: .isDirectory).appending(path: "hub-sync-state.json")
    }

    static func load() -> HubSyncState {
        guard let data = try? Data(contentsOf: fileURL), let state = try? JSONDecoder().decode(HubSyncState.self, from: data) else {
            return HubSyncState()
        }
        return state
    }

    static func save(_ state: HubSyncState) {
        do {
            try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let data = try JSONEncoder().encode(state)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            // Losing bookkeeping only costs a slower next sync; never block sync on it.
        }
    }

    static func remove() {
        try? FileManager.default.removeItem(at: fileURL)
    }
}
