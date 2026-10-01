import CryptoKit
import Foundation

/// Incremental, local-first synchronization for the canonical body-measurement slice.
/// The relay only sees AES-GCM envelopes and technical cursor metadata.
@MainActor
struct PersonalRelaySyncClient {
    private let keychain = KeychainService()
    private let defaults = UserDefaults.standard

    private enum Keys {
        static let endpoint = "personalRelay.endpoint"
        static let cursor = "personalRelay.cursor"
        static let uploadedRecordIDs = "personalRelay.uploadedRecordIDs"
        static let importedRecordIDs = "personalRelay.importedRecordIDs"
        static let vaultID = "vault-id"
        static let bootstrapToken = "bootstrap-token"
        static let deviceID = "device-id"
        static let deviceToken = "device-token"
        static let vaultKey = "vault-key-v1"
        static let subjectID = "subject-id"
    }

    struct Invitation: Codable, Equatable {
        let version: String
        let endpoint: String
        let vaultID: String
        let bootstrapToken: String
        let vaultKeyBase64: String
        let subjectID: String

        func encodedCode() throws -> String {
            let data = try JSONEncoder().encode(self)
            return data.base64EncodedString()
        }

        static func decode(_ value: String) throws -> Invitation {
            guard let data = Data(base64Encoded: value.trimmingCharacters(in: .whitespacesAndNewlines)) else {
                throw RelaySyncError.invalidInvitation
            }
            return try JSONDecoder().decode(Invitation.self, from: data)
        }
    }

    struct SyncOutcome: Equatable {
        let uploadedCount: Int
        let importedMeasurements: [Measurement]
    }

    enum RelaySyncError: LocalizedError {
        case notConfigured
        case invalidEndpoint
        case insecureNonLocalEndpoint
        case invalidInvitation
        case invalidResponse
        case server(String)
        case decryptionFailed

        var errorDescription: String? {
            switch self {
            case .notConfigured: "Configura prima il relay personale."
            case .invalidEndpoint: "L'indirizzo del relay non è valido."
            case .insecureNonLocalEndpoint: "HTTP è ammesso solo per un relay locale .local o localhost. Per Internet usa HTTPS."
            case .invalidInvitation: "Il codice di collegamento non è valido."
            case .invalidResponse: "Il relay ha restituito una risposta non valida."
            case .server(let code): "Il relay ha rifiutato l'operazione: \(code)."
            case .decryptionFailed: "Una busta sync non può essere decifrata con la chiave di questo vault."
            }
        }
    }

    func isConfigured() -> Bool {
        (try? configuration()) != nil
    }

    func createVault(endpoint: URL) async throws -> Invitation {
        try validateEndpoint(endpoint)
        let request = URLRequest(url: endpoint.appending(path: "v1/vaults"))
        let response: CreateVaultResponse = try await perform(request)
        let vaultKey = SymmetricKey(size: .bits256).withUnsafeBytes { Data($0) }
        let subjectID = UUID().uuidString.lowercased()
        let invitation = Invitation(
            version: "0.1.0",
            endpoint: endpoint.trimmingTrailingSlash.absoluteString,
            vaultID: response.vaultId,
            bootstrapToken: response.bootstrapToken,
            vaultKeyBase64: vaultKey.base64EncodedString(),
            subjectID: subjectID
        )
        try await join(invitation: invitation)
        return invitation
    }

    func join(invitation: Invitation) async throws {
        guard invitation.version == "0.1.0",
              let endpoint = URL(string: invitation.endpoint),
              UUID(uuidString: invitation.vaultID) != nil,
              invitation.subjectID.count >= 16,
              let vaultKey = Data(base64Encoded: invitation.vaultKeyBase64), vaultKey.count == 32 else {
            throw RelaySyncError.invalidInvitation
        }
        try validateEndpoint(endpoint)
        let deviceID = UUID().uuidString.lowercased()
        var request = URLRequest(url: endpoint.appending(path: "v1/vaults/\(invitation.vaultID)/devices"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(DeviceEnrollmentRequest(deviceId: deviceID, bootstrapToken: invitation.bootstrapToken))
        let device: DeviceEnrollmentResponse = try await perform(request)

        defaults.set(endpoint.trimmingTrailingSlash.absoluteString, forKey: Keys.endpoint)
        defaults.set(0, forKey: Keys.cursor)
        defaults.set([], forKey: Keys.uploadedRecordIDs)
        defaults.set([], forKey: Keys.importedRecordIDs)
        try keychain.savePersonalRelaySecret(Data(invitation.vaultID.utf8), account: Keys.vaultID)
        try keychain.savePersonalRelaySecret(Data(invitation.bootstrapToken.utf8), account: Keys.bootstrapToken)
        try keychain.savePersonalRelaySecret(Data(device.deviceId.utf8), account: Keys.deviceID)
        try keychain.savePersonalRelaySecret(Data(device.deviceToken.utf8), account: Keys.deviceToken)
        try keychain.savePersonalRelaySecret(vaultKey, account: Keys.vaultKey)
        try keychain.savePersonalRelaySecret(Data(invitation.subjectID.utf8), account: Keys.subjectID)
    }

    func currentInvitationCode() throws -> String {
        let configuration = try configuration()
        return try Invitation(
            version: "0.1.0",
            endpoint: configuration.endpoint.absoluteString,
            vaultID: configuration.vaultID,
            bootstrapToken: configuration.bootstrapToken,
            vaultKeyBase64: configuration.vaultKey.base64EncodedString(),
            subjectID: configuration.subjectID
        ).encodedCode()
    }

    func synchronize(measurements: [Measurement]) async throws -> SyncOutcome {
        let configuration = try configuration()
        var imported = try await downloadChanges(configuration: configuration, existingMeasurements: measurements)
        var uploadedCount = 0
        let adapter = CanonicalBodyMeasurementAdapter()
        var uploaded = Set(defaults.stringArray(forKey: Keys.uploadedRecordIDs) ?? [])

        for measurement in measurements where !isRelayImported(measurement) {
            guard let record = try? adapter.convert(measurement, subjectID: configuration.subjectID), !uploaded.contains(record.recordId) else {
                continue
            }
            let payload = try JSONEncoder().encode(record)
            let sealed = try AES.GCM.seal(payload, using: SymmetricKey(data: configuration.vaultKey))
            let envelope = EncryptedEnvelopeRequest(
                recordId: record.recordId,
                revision: record.revision,
                operation: "upsert",
                envelopeVersion: "aes-gcm-256-v1",
                nonceBase64: Data(sealed.nonce).base64EncodedString(),
                ciphertextBase64: sealed.ciphertext.base64EncodedString(),
                authTagBase64: sealed.tag.base64EncodedString()
            )
            do {
                try await upload(envelope, configuration: configuration)
                uploaded.insert(record.recordId)
                uploadedCount += 1
            } catch RelaySyncError.server(let code) where code == "record_revision_exists" {
                uploaded.insert(record.recordId)
            }
        }
        defaults.set(Array(uploaded).sorted(), forKey: Keys.uploadedRecordIDs)
        imported += try await downloadChanges(configuration: configuration, existingMeasurements: measurements + imported)
        return SyncOutcome(uploadedCount: uploadedCount, importedMeasurements: uniqueMeasurements(imported))
    }

    private func upload(_ envelope: EncryptedEnvelopeRequest, configuration: Configuration) async throws {
        var request = URLRequest(url: configuration.endpoint.appending(path: "v1/vaults/\(configuration.vaultID)/envelopes"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.deviceID, forHTTPHeaderField: "X-MHD-Device-ID")
        request.setValue(configuration.deviceToken, forHTTPHeaderField: "X-MHD-Device-Token")
        request.setValue(UUID().uuidString.lowercased(), forHTTPHeaderField: "Idempotency-Key")
        request.httpBody = try JSONEncoder().encode(envelope)
        let _: UploadResponse = try await perform(request)
    }

    private func downloadChanges(configuration: Configuration, existingMeasurements: [Measurement]) async throws -> [Measurement] {
        let cursor = defaults.integer(forKey: Keys.cursor)
        var components = URLComponents(url: configuration.endpoint.appending(path: "v1/vaults/\(configuration.vaultID)/changes"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "cursor", value: String(cursor)), URLQueryItem(name: "limit", value: "500")]
        guard let url = components?.url else { throw RelaySyncError.invalidEndpoint }
        var request = URLRequest(url: url)
        request.setValue(configuration.deviceID, forHTTPHeaderField: "X-MHD-Device-ID")
        request.setValue(configuration.deviceToken, forHTTPHeaderField: "X-MHD-Device-Token")
        let response: ChangeResponse = try await perform(request)
        var importedIDs = Set(defaults.stringArray(forKey: Keys.importedRecordIDs) ?? [])
        let existingRemoteIDs = Set(existingMeasurements.compactMap { relayRecordID(from: $0) })
        var imported: [Measurement] = []

        for envelope in response.changes {
            guard envelope.operation == "upsert", !importedIDs.contains(envelope.recordId), !existingRemoteIDs.contains(envelope.recordId) else {
                importedIDs.insert(envelope.recordId)
                continue
            }
            let record = try decrypt(envelope, key: configuration.vaultKey)
            if let measurement = measurement(from: record) {
                imported.append(measurement)
                importedIDs.insert(envelope.recordId)
            }
        }
        defaults.set(response.nextCursor, forKey: Keys.cursor)
        defaults.set(Array(importedIDs).sorted(), forKey: Keys.importedRecordIDs)
        return imported
    }

    private func decrypt(_ envelope: EncryptedEnvelopeResponse, key: Data) throws -> CanonicalBodyMeasurementAdapter.Record {
        guard let nonce = Data(base64Encoded: envelope.nonceBase64),
              let ciphertext = Data(base64Encoded: envelope.ciphertextBase64),
              let tag = Data(base64Encoded: envelope.authTagBase64) else {
            throw RelaySyncError.invalidResponse
        }
        do {
            let box = try AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: nonce), ciphertext: ciphertext, tag: tag)
            let data = try AES.GCM.open(box, using: SymmetricKey(data: key))
            return try JSONDecoder().decode(CanonicalBodyMeasurementAdapter.Record.self, from: data)
        } catch {
            throw RelaySyncError.decryptionFailed
        }
    }

    private func measurement(from record: CanonicalBodyMeasurementAdapter.Record) -> Measurement? {
        let type: MeasurementType
        switch record.recordType {
        case "weight": type = .weight
        case "height": type = .height
        case "waist_circumference": type = .waistCircumference
        case "hip_circumference": type = .hipCircumference
        case "body_fat_percentage": type = .bodyFatPercentage
        default: return nil
        }
        let formatter = ISO8601DateFormatter()
        guard let measuredAt = formatter.date(from: record.observedAt) else { return nil }
        let createdAt = formatter.date(from: record.createdAt) ?? measuredAt
        return Measurement(
            id: "relay_\(record.recordId)",
            type: type,
            value: record.value,
            unit: record.unit == "percent" ? "%" : record.unit,
            measuredAt: measuredAt,
            createdAt: createdAt,
            source: .mhdImport,
            sourceRecordId: "mhd-relay:\(record.recordId)"
        )
    }

    private func isRelayImported(_ measurement: Measurement) -> Bool {
        relayRecordID(from: measurement) != nil
    }

    private func relayRecordID(from measurement: Measurement) -> String? {
        let marker = "mhd-relay:"
        guard let sourceRecordId = measurement.sourceRecordId, sourceRecordId.hasPrefix(marker) else { return nil }
        return String(sourceRecordId.dropFirst(marker.count))
    }

    private func uniqueMeasurements(_ values: [Measurement]) -> [Measurement] {
        var ids = Set<String>()
        return values.filter { ids.insert($0.id).inserted }
    }

    private func configuration() throws -> Configuration {
        guard let endpointString = defaults.string(forKey: Keys.endpoint), let endpoint = URL(string: endpointString),
              let vaultID = try keychain.string(account: Keys.vaultID),
              let bootstrapToken = try keychain.string(account: Keys.bootstrapToken),
              let deviceID = try keychain.string(account: Keys.deviceID),
              let deviceToken = try keychain.string(account: Keys.deviceToken),
              let vaultKey = try keychain.loadPersonalRelaySecret(account: Keys.vaultKey), vaultKey.count == 32,
              let subjectID = try keychain.string(account: Keys.subjectID) else {
            throw RelaySyncError.notConfigured
        }
        return Configuration(endpoint: endpoint, vaultID: vaultID, bootstrapToken: bootstrapToken, deviceID: deviceID, deviceToken: deviceToken, vaultKey: vaultKey, subjectID: subjectID)
    }

    private func validateEndpoint(_ endpoint: URL) throws {
        guard let host = endpoint.host, endpoint.port == nil || endpoint.port! > 0 else { throw RelaySyncError.invalidEndpoint }
        guard endpoint.scheme == "https" || (endpoint.scheme == "http" && isLocalHost(host)) else {
            throw RelaySyncError.insecureNonLocalEndpoint
        }
    }

    private func isLocalHost(_ host: String) -> Bool {
        let lowered = host.lowercased()
        return lowered == "localhost" || lowered.hasSuffix(".local") || lowered.hasPrefix("127.") || lowered.hasPrefix("192.168.") || lowered.hasPrefix("10.") || lowered.hasPrefix("172.16.") || lowered.hasPrefix("172.17.") || lowered.hasPrefix("172.18.") || lowered.hasPrefix("172.19.") || lowered.hasPrefix("172.2") || lowered.hasPrefix("172.30.") || lowered.hasPrefix("172.31.")
    }

    private func perform<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw RelaySyncError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let error = (try? JSONDecoder().decode(APIError.self, from: data))?.code ?? "http_\(http.statusCode)"
            throw RelaySyncError.server(error)
        }
        guard let decoded = try? JSONDecoder().decode(Response.self, from: data) else { throw RelaySyncError.invalidResponse }
        return decoded
    }

    private struct Configuration {
        let endpoint: URL
        let vaultID: String
        let bootstrapToken: String
        let deviceID: String
        let deviceToken: String
        let vaultKey: Data
        let subjectID: String
    }

    private struct CreateVaultResponse: Codable { let vaultId: String; let bootstrapToken: String }
    private struct DeviceEnrollmentRequest: Codable { let deviceId: String; let bootstrapToken: String }
    private struct DeviceEnrollmentResponse: Codable { let deviceId: String; let deviceToken: String }
    private struct APIError: Codable { let code: String }
    private struct UploadResponse: Codable { let cursor: Int64; let idempotent: Bool }
    private struct ChangeResponse: Codable { let nextCursor: Int; let changes: [EncryptedEnvelopeResponse] }
    private struct EncryptedEnvelopeRequest: Codable {
        let recordId: String
        let revision: Int
        let operation: String
        let envelopeVersion: String
        let nonceBase64: String
        let ciphertextBase64: String
        let authTagBase64: String
    }
    private struct EncryptedEnvelopeResponse: Codable {
        let cursor: Int
        let recordId: String
        let revision: Int
        let operation: String
        let envelopeVersion: String
        let nonceBase64: String
        let ciphertextBase64: String
        let authTagBase64: String
    }
}

private extension KeychainService {
    func string(account: String) throws -> String? {
        guard let data = try loadPersonalRelaySecret(account: account) else { return nil }
        return String(data: data, encoding: .utf8)
    }
}

private extension URL {
    var trimmingTrailingSlash: URL {
        let value = absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: value) ?? self
    }
}
