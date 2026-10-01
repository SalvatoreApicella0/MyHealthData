import Foundation
import CryptoKit
import Security

struct SelfHostedSyncClient: Sendable {
    private let keychain = KeychainService()

    var endpoint: URL? { URL(string: UserDefaults.standard.string(forKey: "selfHostedSync.endpoint") ?? "") }

    func isConfigured() async -> Bool {
        guard endpoint != nil else { return false }
        return await Task.detached {
            ((try? keychain.loadSyncToken()) ?? nil) != nil
                && ((try? keychain.loadSyncEncryptionKey()) ?? nil) != nil
        }.value
    }

    func configure(endpoint: URL, token: String, encryptionSecret: String) async throws {
        let isLocalDevelopmentHost = endpoint.host == "127.0.0.1" || endpoint.host == "localhost"
        guard endpoint.scheme == "https" || (isLocalDevelopmentHost && endpoint.scheme == "http") else {
            throw AppError.importFailed("Il server sync deve usare HTTPS, salvo localhost.")
        }
        guard let encryptionKey = Data(base64Encoded: encryptionSecret), encryptionKey.count == 32 else {
            throw AppError.importFailed("La chiave E2E deve essere una chiave Base64 valida a 256 bit.")
        }
        UserDefaults.standard.set(endpoint.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/")), forKey: "selfHostedSync.endpoint")
        try await Task.detached {
            try keychain.saveSyncToken(token)
            try keychain.saveSyncEncryptionKey(encryptionKey)
        }.value
    }

    func uploadBackup(_ data: Data) async throws {
        let (endpoint, token, encryptionKey) = try await credentials()
        let sealed = try AES.GCM.seal(data, using: SymmetricKey(data: encryptionKey))
        guard let combined = sealed.combined else { throw AppError.crypto("Impossibile preparare il backup sync.") }
        var request = URLRequest(url: endpoint.appending(path: "v1/backups"))
        request.httpMethod = "POST"; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let payload: [String: String] = ["checksum": MHDHashing.sha256Hex(combined), "ciphertext": combined.base64EncodedString()]
        request.httpBody = try JSONEncoder().encode(payload)
        let (_, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 201 else { throw AppError.importFailed("Il server sync ha rifiutato il backup.") }
    }

    func downloadLatestBackup() async throws -> Data {
        let (endpoint, token, encryptionKey) = try await credentials()
        var request = URLRequest(url: endpoint.appending(path: "v1/backups"))
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw AppError.importFailed("Il server sync non ha restituito i backup.") }
        let backups = try JSONDecoder().decode([[String: String]].self, from: data)
        guard let latest = backups.last,
              let ciphertext = latest["ciphertext"],
              let expectedChecksum = latest["checksum"],
              let decoded = Data(base64Encoded: ciphertext) else {
            throw AppError.importFailed("Nessun backup disponibile.")
        }
        guard MHDHashing.sha256Hex(decoded) == expectedChecksum else {
            throw AppError.crypto("Il backup sync non ha superato la verifica di integrità.")
        }
        do {
            return try AES.GCM.open(AES.GCM.SealedBox(combined: decoded), using: SymmetricKey(data: encryptionKey))
        } catch {
            throw AppError.crypto("Il backup sync non è decifrabile con questa chiave E2E.")
        }
    }

    static func generateEncryptionSecret() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else {
            throw AppError.crypto("Impossibile generare una chiave E2E sicura.")
        }
        return Data(bytes).base64EncodedString()
    }

    private func credentials() async throws -> (URL, String, Data) {
        guard let endpoint else { throw AppError.importFailed("Configura prima il server sync.") }
        let values = try await Task.detached {
            (try keychain.loadSyncToken(), try keychain.loadSyncEncryptionKey())
        }.value
        guard let token = values.0, let encryptionKey = values.1 else {
            throw AppError.importFailed("Configura token e chiave E2E prima di sincronizzare.")
        }
        return (endpoint, token, encryptionKey)
    }
}
