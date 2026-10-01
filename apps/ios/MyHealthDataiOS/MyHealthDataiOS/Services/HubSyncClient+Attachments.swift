import Foundation

extension HubSyncClient {
    private enum AttachmentSyncResult {
        case skipped
        case deferred
        case uploaded
        case downloaded(AttachmentMetadata)
        case failed
    }

    func syncAttachments(snapshot: inout MHDDataSnapshot, config: Configuration, state: inout HubSyncState) async throws -> AttachmentSyncSummary {
        let vault = LocalVaultStore()
        var summary = AttachmentSyncSummary()
        let attachmentIDs = Set(snapshot.documents.compactMap { $0.attachment?.id } + snapshot.events.flatMap { $0.attachments.map(\.id) })
        state.attachmentQueue = state.attachmentQueue.filter { attachmentIDs.contains($0.key) }

        for index in snapshot.documents.indices {
            let document = snapshot.documents[index]
            guard let attachment = document.attachment,
                  let fingerprint = attachment.sha256,
                  !fingerprint.isEmpty else { continue }

            switch try await synchronizeAttachment(attachment, fingerprint: fingerprint, config: config, state: &state, vault: vault) {
            case .skipped:
                continue
            case .deferred:
                summary.deferred += 1
            case .uploaded:
                summary.uploaded += 1
            case .downloaded(let updatedAttachment):
                snapshot.documents[index].attachment = updatedAttachment
                summary.downloaded += 1
            case .failed:
                summary.failed += 1
            }
            HubSyncStateStore.save(state)
        }

        // Events can carry the same encrypted attachment metadata as
        // documents. Keep their files symmetric across Web and iOS too.
        for eventIndex in snapshot.events.indices {
            for attachmentIndex in snapshot.events[eventIndex].attachments.indices {
                let attachment = snapshot.events[eventIndex].attachments[attachmentIndex]
                guard let fingerprint = attachment.sha256, !fingerprint.isEmpty else { continue }

                switch try await synchronizeAttachment(attachment, fingerprint: fingerprint, config: config, state: &state, vault: vault) {
                case .skipped:
                    continue
                case .deferred:
                    summary.deferred += 1
                case .uploaded:
                    summary.uploaded += 1
                case .downloaded(let updatedAttachment):
                    snapshot.events[eventIndex].attachments[attachmentIndex] = updatedAttachment
                    summary.downloaded += 1
                case .failed:
                    summary.failed += 1
                }
                HubSyncStateStore.save(state)
            }
        }
        summary.pending = state.attachmentQueue.count
        return summary
    }

    private func synchronizeAttachment(
        _ attachment: AttachmentMetadata,
        fingerprint: String,
        config: Configuration,
        state: inout HubSyncState,
        vault: LocalVaultStore
    ) async throws -> AttachmentSyncResult {
        if let data = try? vault.decryptedAttachmentData(attachment) {
            guard state.attachmentsUploaded[attachment.id] != fingerprint else {
                state.attachmentQueue.removeValue(forKey: attachment.id)
                return .skipped
            }
            guard shouldAttemptAttachment(id: attachment.id, fingerprint: fingerprint, direction: .upload, state: &state) else {
                return .deferred
            }
            do {
                try await uploadAttachment(attachment, fingerprint: fingerprint, data: data, config: config)
                markAttachmentSucceeded(id: attachment.id, fingerprint: fingerprint, state: &state)
                return .uploaded
            } catch is CancellationError {
                markAttachmentCancelled(id: attachment.id, fingerprint: fingerprint, direction: .upload, state: &state)
                HubSyncStateStore.save(state)
                throw CancellationError()
            } catch {
                markAttachmentFailed(id: attachment.id, fingerprint: fingerprint, direction: .upload, error: error, state: &state)
                return .failed
            }
        }

        // A record pulled from Web has metadata but no local vault file. Fetch
        // it through the signed device endpoint and immediately restore it
        // encrypted at rest. A transient failure remains retryable.
        guard shouldAttemptAttachment(id: attachment.id, fingerprint: fingerprint, direction: .download, state: &state) else {
            return .deferred
        }
        do {
            let updatedAttachment = try await downloadAttachment(attachment, config: config, vault: vault)
            markAttachmentSucceeded(id: attachment.id, fingerprint: fingerprint, state: &state)
            return .downloaded(updatedAttachment)
        } catch is CancellationError {
            markAttachmentCancelled(id: attachment.id, fingerprint: fingerprint, direction: .download, state: &state)
            HubSyncStateStore.save(state)
            throw CancellationError()
        } catch {
            markAttachmentFailed(id: attachment.id, fingerprint: fingerprint, direction: .download, error: error, state: &state)
            return .failed
        }
    }

    static let attachmentRetryBase: TimeInterval = 15
    static let attachmentRetryCap: TimeInterval = 6 * 60 * 60

    func shouldAttemptAttachment(
        id: String,
        fingerprint: String,
        direction: HubSyncState.AttachmentSyncState.Direction,
        state: inout HubSyncState
    ) -> Bool {
        if let current = state.attachmentQueue[id],
           current.fingerprint == fingerprint,
           current.direction == direction {
            return current.nextAttemptAt.map { $0 <= Date() } ?? true
        }

        state.attachmentQueue[id] = HubSyncState.AttachmentSyncState(fingerprint: fingerprint, direction: direction)
        return true
    }

    func markAttachmentSucceeded(id: String, fingerprint: String, state: inout HubSyncState) {
        state.attachmentQueue.removeValue(forKey: id)
        // A successful download also proves that the Hub already has this
        // fingerprint; otherwise the next sync would upload it again.
        state.attachmentsUploaded[id] = fingerprint
    }

    func markAttachmentCancelled(
        id: String,
        fingerprint: String,
        direction: HubSyncState.AttachmentSyncState.Direction,
        state: inout HubSyncState
    ) {
        var entry = state.attachmentQueue[id] ?? HubSyncState.AttachmentSyncState(fingerprint: fingerprint, direction: direction)
        entry.fingerprint = fingerprint
        entry.direction = direction
        entry.lastFailure = .cancelled
        entry.nextAttemptAt = nil
        state.attachmentQueue[id] = entry
    }

    func markAttachmentFailed(
        id: String,
        fingerprint: String,
        direction: HubSyncState.AttachmentSyncState.Direction,
        error: Swift.Error,
        state: inout HubSyncState
    ) {
        var entry = state.attachmentQueue[id] ?? HubSyncState.AttachmentSyncState(fingerprint: fingerprint, direction: direction)
        entry.fingerprint = fingerprint
        entry.direction = direction
        entry.attempts = min(entry.attempts + 1, 31)
        entry.lastAttemptAt = Date()
        entry.lastFailure = attachmentFailure(for: error)
        let multiplier = Double(1 << min(max(entry.attempts - 1, 0), 8))
        entry.nextAttemptAt = Date().addingTimeInterval(min(Self.attachmentRetryBase * multiplier, Self.attachmentRetryCap))
        state.attachmentQueue[id] = entry
    }

    func attachmentFailure(for error: Swift.Error) -> HubSyncState.AttachmentSyncState.Failure {
        if error is URLError { return .network }
        if case HubSyncClient.Error.server(let code) = error {
            return code == "not_found" ? .notFound : .server
        }
        if case HubSyncClient.Error.invalidResponse = error { return .invalidResponse }
        return .unknown
    }

    func uploadAttachment(_ attachment: AttachmentMetadata, fingerprint: String, data: Data, config: Configuration) async throws {
        let escaped = attachment.id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? attachment.id
        let path = "/api/v1/sync/attachments/\(escaped)"
        var headers = try config.headers(method: "POST", path: path, idempotency: stableMutationID("attachment:\(attachment.id):\(fingerprint)"), body: data)
        headers["Content-Type"] = attachment.type
        headers["X-MHD-Attachment-Name"] = attachment.name
        headers["X-MHD-Attachment-SHA256"] = fingerprint
        let _: AttachmentUploadResponse = try await perform(path: path, endpoint: config.endpoint, method: "POST", bodyData: data, headers: headers)
    }

    func downloadAttachment(_ attachment: AttachmentMetadata, config: Configuration, vault: LocalVaultStore) async throws -> AttachmentMetadata {
        let escaped = attachment.id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? attachment.id
        let path = "/api/v1/sync/attachments/\(escaped)"
        let plaintext = try await requestData(path: path, endpoint: config.endpoint, headers: try config.headers(method: "GET", path: path))
        let actualHash = Self.sha256Hex(plaintext)
        guard let expectedHash = attachment.sha256,
              !expectedHash.isEmpty,
              actualHash.caseInsensitiveCompare(expectedHash) == .orderedSame else {
            throw Error.invalidResponse
        }

        // The Hub attachment endpoint returns plaintext file bytes. Encrypt
        // them exactly once before writing to the local vault; encrypted backup
        // imports use a separate restore path.
        return try vault.storePlaintextAttachment(plaintext, metadata: attachment)
    }
}
