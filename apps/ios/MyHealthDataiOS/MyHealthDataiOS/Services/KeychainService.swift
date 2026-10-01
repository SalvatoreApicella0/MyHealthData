import CryptoKit
import Foundation
import Security

struct KeychainService: Sendable {
    private let service = "org.myhealthdata.ios.local-vault"
    private let account = "vault-key-v1"
    private let syncService = "org.myhealthdata.ios.sync"
    private let syncTokenAccount = "bearer-token"
    private let syncEncryptionKeyAccount = "backup-encryption-key-v1"
    private let personalRelayService = "org.myhealthdata.ios.personal-relay"
    private let hubService = "org.myhealthdata.ios.hub"

    func saveHubSecret(_ data: Data, account: String) throws { try saveSecret(data, service: hubService, account: account) }
    func loadHubSecret(account: String) throws -> Data? { try loadSecret(service: hubService, account: account) }
    func deleteHubSecret(account: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: hubService,
            kSecAttrAccount as String: account
        ]
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw AppError.keychain("delete failed with status \(status)")
        }
    }

    func savePersonalRelaySecret(_ data: Data, account: String) throws {
        try saveSecret(data, service: personalRelayService, account: account)
    }

    func loadPersonalRelaySecret(account: String) throws -> Data? {
        try loadSecret(service: personalRelayService, account: account)
    }

    func saveSyncToken(_ token: String) throws {
        try saveSecret(Data(token.utf8), service: syncService, account: syncTokenAccount)
    }

    func loadSyncToken() throws -> String? {
        guard let data = try loadSecret(service: syncService, account: syncTokenAccount) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func saveSyncEncryptionKey(_ data: Data) throws {
        guard data.count == 32 else {
            throw AppError.keychain("La chiave di cifratura deve contenere 32 byte.")
        }
        try saveSecret(data, service: syncService, account: syncEncryptionKeyAccount)
    }

    func loadSyncEncryptionKey() throws -> Data? {
        try loadSecret(service: syncService, account: syncEncryptionKeyAccount)
    }

    func loadOrCreateVaultKey() throws -> SymmetricKey {
        if let existing = try readKeyData() {
            return SymmetricKey(data: existing)
        }

        let key = SymmetricKey(size: .bits256)
        let keyData = key.withUnsafeBytes { Data($0) }
        try writeKeyData(keyData)
        return key
    }

    private func readKeyData() throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess else {
            throw AppError.keychain("read failed with status \(status)")
        }
        guard let data = result as? Data else {
            throw AppError.keychain("stored key was not data")
        }
        return data
    }

    private func writeKeyData(_ data: Data) throws {
        try saveSecret(data, service: service, account: account)
    }

    private func saveSecret(_ data: Data, service: String, account: String) throws {
        let identity: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        var add = identity
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        add[kSecValueData as String] = data

        switch SecItemAdd(add as CFDictionary, nil) {
        case errSecSuccess:
            return
        case errSecDuplicateItem:
            let status = SecItemUpdate(
                identity as CFDictionary,
                [
                    kSecValueData as String: data,
                    kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
                ] as CFDictionary
            )
            guard status == errSecSuccess else {
                throw AppError.keychain("update failed with status \(status)")
            }
        case let status:
            throw AppError.keychain("write failed with status \(status)")
        }
    }

    private func loadSecret(service: String, account: String) throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else {
            throw AppError.keychain("read failed with status \(status)")
        }
        guard let data = result as? Data else {
            throw AppError.keychain("stored secret was not data")
        }
        return data
    }
}
