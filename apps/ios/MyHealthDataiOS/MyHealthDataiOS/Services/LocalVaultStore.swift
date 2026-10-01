import CryptoKit
import Foundation

struct LocalVaultStore {
    private let keychain = KeychainService()
    private let fileName = "myhealthdata-v01.vault"

    private var vaultURL: URL {
        get throws {
            try vaultFolderURL().appending(path: fileName)
        }
    }

    private func vaultFolderURL() throws -> URL {
        let base = try FileManager.default.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
        )
        let folder = base.appending(path: "MyHealthData", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    private func attachmentsFolderURL() throws -> URL {
        let folder = try vaultFolderURL().appending(path: "Attachments", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    func loadSnapshot() throws -> MHDDataSnapshot {
        let url = try vaultURL
        guard FileManager.default.fileExists(atPath: url.path) else {
            return .empty
        }

        let encrypted = try Data(contentsOf: url)
        let key = try keychain.loadOrCreateVaultKey()
        let sealedBox = try AES.GCM.SealedBox(combined: encrypted)
        let plaintext = try AES.GCM.open(sealedBox, using: key)
        return try MHDDateCoding.decoder.decode(MHDDataSnapshot.self, from: plaintext)
    }

    func saveSnapshot(_ snapshot: MHDDataSnapshot) throws {
        let key = try keychain.loadOrCreateVaultKey()
        let plaintext = try MHDDateCoding.encoder.encode(snapshot)
        let sealedBox = try AES.GCM.seal(plaintext, using: key)
        guard let combined = sealedBox.combined else {
            throw AppError.crypto("unable to combine AES-GCM sealed box")
        }
        let url = try vaultURL
        try combined.write(to: url, options: [.atomic, .completeFileProtection])
    }

    func saveAttachment(from sourceURL: URL, metadata: AttachmentMetadata) throws -> AttachmentMetadata {
        let didAccess = sourceURL.startAccessingSecurityScopedResource()
        defer {
            if didAccess {
                sourceURL.stopAccessingSecurityScopedResource()
            }
        }

        let data = try Data(contentsOf: sourceURL)
        return try storePlaintextAttachment(data, metadata: metadata)
    }

    /// Stores bytes that are known to be plaintext (for example, bytes
    /// downloaded from the Hub attachment endpoint) by encrypting them before
    /// they cross the local-vault boundary.
    func storePlaintextAttachment(_ data: Data, metadata: AttachmentMetadata) throws -> AttachmentMetadata {
        let key = try keychain.loadOrCreateVaultKey()
        let sealedBox = try AES.GCM.seal(data, using: key)
        guard let combined = sealedBox.combined else {
            throw AppError.crypto("unable to combine attachment sealed box")
        }

        let vaultFileName = "\(metadata.id).vault"
        let destinationURL = try attachmentsFolderURL().appending(path: vaultFileName)
        try combined.write(to: destinationURL, options: [.atomic, .completeFileProtection])

        var storedMetadata = metadata
        storedMetadata.vaultFileName = vaultFileName
        storedMetadata.sha256 = MHDHashing.sha256Hex(data)
        storedMetadata.storedAt = .now
        return storedMetadata
    }

    func deleteAttachment(_ metadata: AttachmentMetadata) throws {
        guard let vaultFileName = metadata.vaultFileName else { return }
        let url = try attachmentsFolderURL().appending(path: vaultFileName)
        guard FileManager.default.fileExists(atPath: url.path) else { return }
        try FileManager.default.removeItem(at: url)
    }

    func materializeAttachment(_ metadata: AttachmentMetadata) throws -> URL {
        guard let vaultFileName = metadata.vaultFileName else {
            throw CocoaError(.fileNoSuchFile)
        }
        let encryptedURL = try attachmentsFolderURL().appending(path: vaultFileName)
        let encrypted = try Data(contentsOf: encryptedURL)
        let key = try keychain.loadOrCreateVaultKey()
        let sealedBox = try AES.GCM.SealedBox(combined: encrypted)
        let data = try AES.GCM.open(sealedBox, using: key)
        let previewFolder = FileManager.default.temporaryDirectory
            .appending(path: "MyHealthDataPreview", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: previewFolder, withIntermediateDirectories: true)
        let safeName = metadata.name.replacingOccurrences(of: "/", with: "-")
        let destination = previewFolder.appending(path: "\(metadata.id)__\(safeName)")
        try data.write(to: destination, options: [.atomic, .completeFileProtection])
        return destination
    }

    func cleanupTemporaryFiles() {
        let fileManager = FileManager.default
        let temporaryDirectory = fileManager.temporaryDirectory
        let previewFolder = temporaryDirectory.appending(path: "MyHealthDataPreview", directoryHint: .isDirectory)
        try? fileManager.removeItem(at: previewFolder)

        guard let files = try? fileManager.contentsOfDirectory(
            at: temporaryDirectory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else { return }
        for file in files where file.lastPathComponent.hasPrefix("mhd-document-") {
            try? fileManager.removeItem(at: file)
        }
    }

    func removeMaterializedFile(at url: URL?) {
        guard let url else { return }
        let temporaryRoot = FileManager.default.temporaryDirectory.standardizedFileURL.path
        guard url.standardizedFileURL.path.hasPrefix(temporaryRoot) else { return }
        try? FileManager.default.removeItem(at: url)
    }

    func encryptedAttachmentData(_ metadata: AttachmentMetadata) throws -> Data {
        guard let vaultFileName = metadata.vaultFileName else { throw CocoaError(.fileNoSuchFile) }
        return try Data(contentsOf: attachmentsFolderURL().appending(path: vaultFileName))
    }

    func decryptedAttachmentData(_ metadata: AttachmentMetadata) throws -> Data {
        guard let vaultFileName = metadata.vaultFileName else { throw CocoaError(.fileNoSuchFile) }
        let encrypted = try Data(contentsOf: attachmentsFolderURL().appending(path: vaultFileName))
        let key = try keychain.loadOrCreateVaultKey()
        let sealedBox = try AES.GCM.SealedBox(combined: encrypted)
        return try AES.GCM.open(sealedBox, using: key)
    }

    func restoreEncryptedAttachment(_ data: Data, metadata: AttachmentMetadata) throws -> AttachmentMetadata {
        // Backup packages carry the already-encrypted vault representation.
        // Reject raw PDF/image bytes here so a plaintext Hub response can
        // never be mistaken for an at-rest attachment.
        _ = try AES.GCM.SealedBox(combined: data)
        let fileName = "\(metadata.id).vault"
        let destination = try attachmentsFolderURL().appending(path: fileName)
        try data.write(to: destination, options: [.atomic, .completeFileProtection])
        var restored = metadata
        restored.vaultFileName = fileName
        restored.storedAt = restored.storedAt ?? .now
        return restored
    }
}
