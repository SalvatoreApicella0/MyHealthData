import CryptoKit
import Foundation

/// Coarse progress for the sync overlay: phase, counters and a rough ETA based
/// on the observed upload rate.
struct HubSyncProgress: Sendable, Equatable {
    enum Phase: Sendable { case preparing, downloading, uploading, applying, finished }
    var phase: Phase
    var completed: Int
    var total: Int
    var detail: String
    var estimatedRemaining: TimeInterval?

    var label: String {
        guard let estimatedRemaining, estimatedRemaining > 1, completed < total else { return detail }
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = estimatedRemaining > 90 ? [.minute, .second] : [.second]
        formatter.unitsStyle = .abbreviated
        let remaining = formatter.string(from: estimatedRemaining) ?? "\(Int(estimatedRemaining))s"
        return "\(detail) · circa \(remaining)"
    }
}

struct AttachmentSyncSummary: Sendable, Equatable {
    var uploaded = 0
    var downloaded = 0
    var deferred = 0
    var failed = 0
    var pending = 0

    var completed: Int { uploaded + downloaded }
}

/// Sync engine. Deliberately not `@MainActor`: the JSON encoding hashing and
/// merging of tens of thousands of records must never block the UI; callers
/// await it and receive progress on the main actor from the store.
struct HubSyncClient {
    private let keychain = KeychainService()
    private let defaults = UserDefaults.standard
    private enum Keys {
        static let endpoint = "hub.endpoint"
        static let deviceID = "hub.device-id"
        static let deviceToken = "hub.device-token"
        static let signingKey = "hub.device-signing-key"
    }

    /// Canonical snapshot domains replicated through the generic record API,
    /// mirroring the Web `canonicalSyncDomains` list. Measurements keep their
    /// dedicated endpoint; profile remains local-only. Document records use
    /// the generic endpoint and their file bytes use the separate attachment
    /// channel after the record graph has been synchronized.
    static let canonicalDomains = [
        "events", "documents", "appointments", "cycleEntries", "sleepSessions",
        "foodLogEntries", "gymWorkouts", "medications", "medicationDoseEvents",
        "conditionEpisodes", "conditionCheckIns", "labResults", "foodRecipes", "gymPlans"
    ]
    static let pullPageSize = 500
    static let pushChunkSize = 400

    struct PairingCode: Codable {
        let pairingId: String
        let pairingToken: String
        let endpoint: String
        let hubId: String
        let protocolVersion: String
    }
    struct Outcome {
        let uploaded: Int
        let deleted: Int
        let imported: Int
        let snapshot: MHDDataSnapshot
        let attachments: AttachmentSyncSummary
    }
    enum Error: LocalizedError {
        case notConfigured
        case invalidCode
        case insecureEndpoint
        case invalidResponse
        case server(String)

        var errorDescription: String? {
            switch self {
            case .notConfigured: "Nessun Hub collegato."
            case .invalidCode: "Codice Hub non valido."
            case .insecureEndpoint: "HTTP è consentito soltanto per Hub locali."
            case .invalidResponse: "Il Hub ha risposto in modo inatteso."
            case .server(let code):
                switch code {
                case "invalid_or_expired_pairing": "Codice scaduto o già usato. Genera un nuovo QR dal Mac."
                case "invalid_request_body", "invalid_device_signature": "Il Mac ha rifiutato la richiesta. Aggiorna Hub e iPhone all'ultima versione."
                case "unauthorized_device": "Il Mac non riconosce più questo dispositivo (revocato o riassociato). Scollega e scansiona un QR nuovo."
                case "device_not_found": "Dispositivo rimosso dal Mac. Scollega e scansiona un QR nuovo."
                case "record_not_owned": "Record creato su un altro dispositivo: la modifica resta locale."
                case "conflict": "Conflitto di revisione: sincronizza di nuovo."
                case "too_many_requests": "Troppi tentativi: aspetta un minuto."
                default: "Hub: \(code)."
                }
            }
        }
    }

    func isConfigured() -> Bool {
        (try? configuration()) != nil
    }

    func connectedEndpoint() -> String? {
        defaults.string(forKey: Keys.endpoint)
    }

    /// Forgets the pairing on this device. The Mac keeps its own device list, so
    /// the phone can claim a fresh QR right away without touching Hub state.
    func disconnect() {
        defaults.removeObject(forKey: Keys.endpoint)
        defaults.removeObject(forKey: Keys.deviceID)
        try? keychain.deleteHubSecret(account: Keys.deviceToken)
        try? keychain.deleteHubSecret(account: Keys.signingKey)
        HubSyncStateStore.remove()
    }

    func join(code: PairingCode) async throws {
        guard code.protocolVersion == "2", let endpoint = URL(string: code.endpoint) else {
            throw Error.invalidCode
        }
        try validate(endpoint)

        let key = Curve25519.Signing.PrivateKey()
        let publicKey = key.publicKey.rawRepresentation.base64EncodedString()
        let response: ClaimResponse = try await perform(
            path: "/api/v1/pairings/\(code.pairingId)/claim",
            endpoint: endpoint,
            method: "POST",
            body: ClaimRequest(
                pairingToken: code.pairingToken,
                name: "MyHealthData iPhone",
                publicKey: publicKey
            )
        )
        defaults.set(endpoint.absoluteString, forKey: Keys.endpoint)
        defaults.set(response.deviceId, forKey: Keys.deviceID)
        HubSyncStateStore.remove()
        try keychain.saveHubSecret(Data(response.deviceToken.utf8), account: Keys.deviceToken)
        try keychain.saveHubSecret(key.rawRepresentation, account: Keys.signingKey)
    }

    /// Full-graph synchronization, pull first: download the remote index, adopt
    /// what is missing locally and upload only records the Hub does not know.
    /// This keeps a first sync of tens of thousands of records to a few dozen
    /// requests instead of one per record.
    func synchronize(snapshot: MHDDataSnapshot, progress: (@Sendable (HubSyncProgress) -> Void)? = nil) async throws -> Outcome {
        let config = try configuration()
        var state = HubSyncStateStore.load()
        var working = snapshot
        try Task.checkCancellation()
        progress?(HubSyncProgress(phase: .preparing, completed: 0, total: 0, detail: "Preparo i dati…", estimatedRemaining: nil))

        let measurements = try await syncMeasurements(config: config, into: &working, state: &state, progress: progress)
        HubSyncStateStore.save(state)

        progress?(HubSyncProgress(phase: .preparing, completed: 0, total: 0, detail: "Preparo i moduli…", estimatedRemaining: nil))
        let canonical = try await syncCanonicalDomains(
            dictionary: try encode(working),
            state: state,
            config: config,
            uploaded: measurements.uploaded,
            imported: measurements.imported
        )
        let dictionary = canonical.dictionary
        state = canonical.state
        let uploaded = canonical.uploaded
        let deleted = canonical.deleted
        let imported = canonical.imported
        // The record graph is complete at this point. Merge it before the
        // attachment pass so documents created on Web are also materialized
        // into the iOS vault, not merely shown with remote metadata.
        if let merged = try? decode(dictionary) {
            working = merge(merged, into: working)
        } else {
            working = try decodeDomains(dictionary, into: working)
        }
        let attachmentSummary = try await syncAttachments(snapshot: &working, config: config, state: &state)
        HubSyncStateStore.save(state)

        progress?(HubSyncProgress(phase: .applying, completed: 0, total: 0, detail: "Applico i cambi…", estimatedRemaining: nil))
        let attachmentDetail: String?
        if attachmentSummary.failed > 0 || attachmentSummary.deferred > 0 {
            attachmentDetail = "\(attachmentSummary.pending) allegati in coda"
        } else if attachmentSummary.completed > 0 {
            attachmentDetail = "\(attachmentSummary.completed) allegati sincronizzati"
        } else {
            attachmentDetail = nil
        }
        progress?(HubSyncProgress(phase: .finished, completed: uploaded, total: uploaded, detail: attachmentDetail.map { "Sync completata · \($0)" } ?? "Sync completata", estimatedRemaining: 0))
        return Outcome(uploaded: uploaded, deleted: deleted, imported: imported, snapshot: working, attachments: attachmentSummary)
    }

    private func configuration() throws -> Configuration {
        guard
            let value = defaults.string(forKey: Keys.endpoint),
            let endpoint = URL(string: value),
            let id = defaults.string(forKey: Keys.deviceID),
            let tokenData = try keychain.loadHubSecret(account: Keys.deviceToken),
            let token = String(data: tokenData, encoding: .utf8),
            let keyData = try keychain.loadHubSecret(account: Keys.signingKey),
            let signingKey = try? Curve25519.Signing.PrivateKey(rawRepresentation: keyData)
        else {
            throw Error.notConfigured
        }
        return Configuration(endpoint: endpoint, deviceID: id, token: token, signingKey: signingKey)
    }

    private func validate(_ endpoint: URL) throws {
        let localHTTPHost = endpoint.host == "localhost"
            || endpoint.host?.hasSuffix(".local") == true
            || endpoint.host?.hasPrefix("192.168.") == true
            || endpoint.host?.hasPrefix("10.") == true
            || isPrivate172Address(endpoint.host)
        guard endpoint.scheme == "https" || (endpoint.scheme == "http" && localHTTPHost) else {
            throw Error.insecureEndpoint
        }
    }

    private func isPrivate172Address(_ host: String?) -> Bool {
        guard
            let host,
            let second = host.split(separator: ".").dropFirst().first.flatMap({ Int($0) })
        else {
            return false
        }
        return host.hasPrefix("172.") && (16...31).contains(second)
    }
}

/// The client is an immutable value over thread-safe services (Keychain,
/// UserDefaults, URLSession); marking it Sendable lets views and the store call
/// it from any context without hopping actors.
extension HubSyncClient: @unchecked Sendable {}
