import Foundation

extension HubSyncClient {
    struct CanonicalSyncResult {
        let dictionary: [String: Any]
        let state: HubSyncState
        let uploaded: Int
        let deleted: Int
        let imported: Int
    }

    /// Pulls and pushes the generic record graph independently from the
    /// measurement and attachment channels. Keeping this loop separate makes
    /// the sync orchestration readable while preserving one ordered cursor per
    /// domain and the existing conflict/ownership rules.
    func syncCanonicalDomains(
        dictionary initialDictionary: [String: Any],
        state initialState: HubSyncState,
        config: Configuration,
        uploaded initialUploaded: Int,
        imported initialImported: Int
    ) async throws -> CanonicalSyncResult {
        var dictionary = initialDictionary
        var state = initialState
        var remoteOwned = Set(state.remoteOwned)
        var uploaded = initialUploaded
        var deleted = 0
        var imported = initialImported

        for domain in Self.canonicalDomains {
            try Task.checkCancellation()
            guard let localRecords = dictionary[domain] as? [[String: Any]] else { continue }
            var domainState = state.domain(domain)
            let localIDs = Set(localRecords.compactMap { $0["id"] as? String })

            // Pull first: known remote ids + revisions, adopting unknown records.
            var byID: [String: [String: Any]] = [:]
            var localFingerprints: [String: String] = [:]
            for record in localRecords {
                if let id = record["id"] as? String {
                    byID[id] = record
                    localFingerprints[id] = fingerprint(record)
                }
            }
            var pulledRemoteFingerprints: [String: String] = [:]
            var knownRemote = Set(domainState.knownRemote).union(domainState.uploaded.keys)
            var cursor = domainState.cursor
            for _ in 0..<500 {
                try Task.checkCancellation()
                let path = "/api/v1/sync/records/\(domain)?since=\(cursor)&limit=\(Self.pullPageSize)"
                let data = try await requestData(path: path, endpoint: config.endpoint, headers: try config.headers(method: "GET", path: path))
                let response = try parseDomainChanges(data)
                for change in response.changes {
                    guard let id = change.record["id"] as? String else { continue }
                    if change.record["deleted"] as? Bool == true {
                        byID.removeValue(forKey: id)
                        knownRemote.remove(id)
                    } else {
                        knownRemote.insert(id)
                        pulledRemoteFingerprints[id] = fingerprint(change.record)
                        if let revision = change.record["revision"] as? Int { domainState.revisions[id] = revision }
                        let localIsDirty: Bool
                        if let localRecord = byID[id], localIDs.contains(id) {
                            localIsDirty = Self.canonicalRecordNeedsUpload(
                                localFingerprint: localFingerprints[id] ?? fingerprint(localRecord),
                                remoteFingerprint: pulledRemoteFingerprints[id],
                                lastUploadedFingerprint: domainState.uploaded[id],
                                knownRemote: true
                            )
                        } else {
                            localIsDirty = false
                        }
                        if !localIDs.contains(id) || !localIsDirty {
                            byID[id] = stripEnvelope(change.record)
                            imported += 1
                        }
                    }
                }
                if response.nextCursor <= cursor {
                    cursor = max(cursor, response.nextCursor)
                    break
                }
                cursor = response.nextCursor
            }
            domainState.cursor = cursor
            domainState.knownRemote = Array(knownRemote)
            dictionary[domain] = Array(byID.values)

            // Push only what the Hub does not know yet.
            let pending = localRecords.filter { record in
                guard let id = record["id"] as? String else { return false }
                return Self.canonicalRecordNeedsUpload(
                    localFingerprint: localFingerprints[id] ?? fingerprint(record),
                    remoteFingerprint: pulledRemoteFingerprints[id],
                    lastUploadedFingerprint: domainState.uploaded[id],
                    knownRemote: knownRemote.contains(id)
                )
            }
            for record in pending {
                guard let id = record["id"] as? String, !remoteOwned.contains(id) else { continue }
                var body = record
                if let baseRevision = domainState.revisions[id] { body["baseRevision"] = baseRevision }
                let payload = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
                let recordFingerprint = localFingerprints[id] ?? fingerprint(record)
                let path = "/api/v1/sync/records/\(domain)"
                let mutation = stableMutationID("records:\(domain):upsert:\(id):\(recordFingerprint)")
                do {
                    let response: PushResponse = try await perform(path: path, endpoint: config.endpoint, method: "POST", bodyData: payload, headers: try config.headers(method: "POST", path: path, idempotency: mutation, body: payload))
                    domainState.revisions[id] = response.record.revision
                    domainState.uploaded[id] = recordFingerprint
                    uploaded += 1
                } catch HubSyncClient.Error.server(let code) where code == "record_not_owned" {
                    remoteOwned.insert(id)
                } catch HubSyncClient.Error.server(let code) where code == "conflict" {
                    // A later pull realigns the revision.
                }
            }

            for (id, _) in domainState.uploaded where !localIDs.contains(id) && !remoteOwned.contains(id) {
                guard let revision = domainState.revisions[id] else { continue }
                let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
                let path = "/api/v1/sync/records/\(domain)/\(escaped)?baseRevision=\(revision)"
                let mutation = stableMutationID("records:\(domain):delete:\(id):\(revision)")
                do {
                    let _: DeleteResponse = try await perform(path: path, endpoint: config.endpoint, method: "DELETE", headers: try config.headers(method: "DELETE", path: path, idempotency: mutation))
                    domainState.uploaded.removeValue(forKey: id)
                    domainState.revisions.removeValue(forKey: id)
                    deleted += 1
                } catch {
                    // A later sync retries the deletion.
                }
            }

            state.update(domain, domainState)
        }

        state.remoteOwned = Array(remoteOwned)
        return CanonicalSyncResult(
            dictionary: dictionary,
            state: state,
            uploaded: uploaded,
            deleted: deleted,
            imported: imported
        )
    }

    func encode(_ snapshot: MHDDataSnapshot) throws -> [String: Any] {
        try HubSyncCanonicalCodec.encode(snapshot)
    }

    func decode(_ dictionary: [String: Any]) throws -> MHDDataSnapshot {
        try HubSyncCanonicalCodec.decode(dictionary)
    }

    /// Fallback used when any single record breaks strict decoding: each domain
    /// is decoded on its own so one bad payload never blocks the others.
    func decodeDomains(_ dictionary: [String: Any], into base: MHDDataSnapshot) throws -> MHDDataSnapshot {
        HubSyncCanonicalCodec.decodeDomains(dictionary, into: base)
    }

    /// A successfully decoded snapshot is authoritative for the synced domains only.
    func merge(_ remote: MHDDataSnapshot, into base: MHDDataSnapshot) -> MHDDataSnapshot {
        HubSyncCanonicalCodec.merge(remote, into: base)
    }

    func stripEnvelope(_ record: [String: Any]) -> [String: Any] {
        HubSyncCanonicalCodec.stripEnvelope(record)
    }

    func fingerprint(_ record: [String: Any]) -> String {
        HubSyncCanonicalCodec.fingerprint(record)
    }

    /// Returns true when a local canonical record must be sent to the Hub.
    /// A known remote ID is not sufficient to skip a write: the local payload
    /// may have changed since the last confirmed upload, or the remote change
    /// may have arrived in the current pull page.
    static func canonicalRecordNeedsUpload(
        localFingerprint: String,
        remoteFingerprint: String?,
        lastUploadedFingerprint: String?,
        knownRemote: Bool
    ) -> Bool {
        if let remoteFingerprint {
            return localFingerprint != remoteFingerprint
        }
        if let lastUploadedFingerprint {
            return localFingerprint != lastUploadedFingerprint
        }
        return !knownRemote
    }

    func parseDomainChanges(_ data: Data) throws -> DomainChanges {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw Error.invalidResponse }
        let nextCursor = object["nextCursor"] as? Int ?? 0
        let changes = (object["changes"] as? [[String: Any]] ?? []).compactMap { entry -> DomainChange? in
            guard let record = entry["record"] as? [String: Any] else { return nil }
            return DomainChange(record: record)
        }
        return DomainChanges(nextCursor: nextCursor, changes: changes)
    }
}
