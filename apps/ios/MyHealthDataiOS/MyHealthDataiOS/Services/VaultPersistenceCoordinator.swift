import Foundation

actor VaultPersistenceCoordinator {
    private let vaultStore = LocalVaultStore()
    private var pendingSave: (generation: Int, snapshot: MHDDataSnapshot)?
    private var saveTask: Task<Void, Never>?
    private var latestGeneration = 0
    private var persistenceError: Error?

    func loadSnapshot() throws -> MHDDataSnapshot {
        try vaultStore.loadSnapshot()
    }

    func saveAttachment(from sourceURL: URL, metadata: AttachmentMetadata) throws -> AttachmentMetadata {
        try vaultStore.saveAttachment(from: sourceURL, metadata: metadata)
    }

    func deleteAttachment(_ metadata: AttachmentMetadata) throws {
        try vaultStore.deleteAttachment(metadata)
    }

    func materializeAttachment(_ metadata: AttachmentMetadata) throws -> URL {
        try vaultStore.materializeAttachment(metadata)
    }

    func encryptedAttachmentData(_ metadata: AttachmentMetadata) throws -> Data {
        try vaultStore.encryptedAttachmentData(metadata)
    }

    func restoreEncryptedAttachment(_ data: Data, metadata: AttachmentMetadata) throws -> AttachmentMetadata {
        try vaultStore.restoreEncryptedAttachment(data, metadata: metadata)
    }

    func enqueue(_ snapshot: MHDDataSnapshot, generation: Int) {
        guard generation >= latestGeneration else { return }
        latestGeneration = generation
        pendingSave = (generation, snapshot)

        guard saveTask == nil else { return }
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(180))
            guard !Task.isCancelled else { return }
            await self?.drainPendingSaves()
        }
    }

    func flush() throws {
        saveTask?.cancel()
        saveTask = nil
        drainPendingSaves()
        if let persistenceError {
            throw persistenceError
        }
    }

    private func drainPendingSaves() {
        defer { saveTask = nil }

        while let pendingSave {
            self.pendingSave = nil
            do {
                try vaultStore.saveSnapshot(pendingSave.snapshot)
                persistenceError = nil
            } catch {
                persistenceError = error
            }
        }
    }
}
