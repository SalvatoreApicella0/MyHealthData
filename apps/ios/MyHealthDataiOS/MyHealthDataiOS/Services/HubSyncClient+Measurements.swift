import Foundation

extension HubSyncClient {
    func fingerprint(_ measurement: Measurement) -> String {
        let value = [
            measurement.id,
            measurement.type.rawValue,
            String(measurement.value),
            measurement.unit,
            HubSyncDateCoding.string(from: measurement.measuredAt),
            measurement.note ?? ""
        ].joined(separator: "\u{1F}")
        return MHDHashing.sha256Hex(value)
    }

    /// Synchronizes the legacy measurement stream through its dedicated index,
    /// payload and batch endpoints. The generic record graph uses a different
    /// path because measurements retain their historical wire format.
    func syncMeasurements(
        config: Configuration,
        into snapshot: inout MHDDataSnapshot,
        state: inout HubSyncState,
        progress: (@Sendable (HubSyncProgress) -> Void)?
    ) async throws -> (uploaded: Int, imported: Int) {
        let syncable = snapshot.measurements.filter { !($0.sourceRecordId?.hasPrefix("mhd-hub:") ?? false) }
        let localIDs = Set(syncable.map(\.id))
        let fingerprints = Dictionary(syncable.map { ($0.id, fingerprint($0)) }, uniquingKeysWith: { _, latest in latest })
        var knownRemote = Set(state.measurementKnownRemote)

        // 1. Pull the remote index first: identity/revision only, so a large
        //    remote history costs a few MB instead of hundreds.
        let startCursor = state.measurementCursor
        var cursor = startCursor
        var finalCursor = startCursor
        var remoteCount = 0
        var pullPages = 0
        var missingRemoteIDs = Set<String>()
        for _ in 0..<2000 {
            try Task.checkCancellation()
            let path = "/api/v1/sync/measurements?since=\(cursor)&limit=\(Self.pullPageSize)&index=1"
            let response: IndexChangesResponse = try await perform(path: path, endpoint: config.endpoint, headers: try config.headers(method: "GET", path: path))
            for change in response.changes {
                let record = change.record
                knownRemote.insert(record.id)
                state.measurementRevisions[record.id] = record.revision
                if !record.deleted && !localIDs.contains(record.id) { missingRemoteIDs.insert(record.id) }
            }
            remoteCount += response.changes.count
            pullPages += 1
            if pullPages % 5 == 0 {
                progress?(HubSyncProgress(phase: .downloading, completed: remoteCount, total: 0, detail: "Leggo indice misure… \(remoteCount)", estimatedRemaining: nil))
            }
            if response.nextCursor <= cursor { cursor = max(cursor, response.nextCursor); break }
            cursor = response.nextCursor
            finalCursor = cursor
        }

        // 2. Download payloads only when the Hub has records this device misses.
        var imported = 0
        if !missingRemoteIDs.isEmpty {
            var payloadCursor = startCursor
            let startedDownload = Date()
            var downloaded = 0
            for _ in 0..<2000 {
                try Task.checkCancellation()
                let path = "/api/v1/sync/measurements?since=\(payloadCursor)&limit=\(Self.pullPageSize)"
                let response: ChangesResponse = try await perform(path: path, endpoint: config.endpoint, headers: try config.headers(method: "GET", path: path))
                for change in response.changes {
                    let record = change.record
                    guard !record.deleted, missingRemoteIDs.contains(record.id), let measurement = record.measurement else { continue }
                    snapshot.measurements.append(measurement)
                    imported += 1
                    downloaded += 1
                }
                let elapsed = Date().timeIntervalSince(startedDownload)
                let rate = elapsed > 0 ? Double(downloaded) / elapsed : 0
                progress?(HubSyncProgress(phase: .downloading, completed: downloaded, total: missingRemoteIDs.count, detail: "Scarico misure mancanti… \(downloaded)/\(missingRemoteIDs.count)", estimatedRemaining: rate > 0 ? Double(missingRemoteIDs.count - downloaded) / rate : nil))
                if response.nextCursor <= payloadCursor { break }
                payloadCursor = response.nextCursor
            }
        }
        state.measurementCursor = finalCursor
        state.measurementKnownRemote = Array(knownRemote)

        // 2. Push only measurements the Hub has never seen.
        let pending = syncable.filter { !knownRemote.contains($0.id) && state.measurementUploaded[$0.id] != fingerprints[$0.id] }
        var uploaded = 0
        let startedAt = Date()
        var offset = 0
        while offset < pending.count {
            try Task.checkCancellation()
            let chunk = Array(pending[offset..<min(offset + Self.pushChunkSize, pending.count)])
            let bodies = chunk.map { RequestMeasurement($0, baseRevision: state.measurementRevisions[$0.id]) }
            do {
                let results = try await pushMeasurementBatch(bodies, config: config)
                for (index, result) in results.enumerated() {
                    guard let revision = result.revision else { continue }
                    state.measurementRevisions[chunk[index].id] = revision
                    state.measurementUploaded[chunk[index].id] = fingerprints[chunk[index].id]; uploaded += 1
                }
            } catch HubSyncClient.Error.server(let code) where code == "not_found" {
                // Older Hub without the batch route: fall back to single pushes.
                for measurement in chunk {
                    let body = RequestMeasurement(measurement, baseRevision: state.measurementRevisions[measurement.id])
                    let payload = try JSONEncoder().encode(body)
                    let measurementFingerprint = fingerprints[measurement.id] ?? fingerprint(measurement)
                    let path = "/api/v1/sync/measurements"; let mutation = stableMutationID("upsert:\(measurement.id):\(measurementFingerprint)")
                    do {
                        let response: PushResponse = try await perform(path: path, endpoint: config.endpoint, method: "POST", bodyData: payload, headers: try config.headers(method: "POST", path: path, idempotency: mutation, body: payload))
                        state.measurementRevisions[measurement.id] = response.record.revision
                        state.measurementUploaded[measurement.id] = measurementFingerprint; uploaded += 1
                    } catch HubSyncClient.Error.server(let code) where code == "record_not_owned" || code == "conflict" { continue }
                }
            }
            offset += Self.pushChunkSize
            let done = min(offset, pending.count)
            let elapsed = Date().timeIntervalSince(startedAt)
            let rate = elapsed > 0 ? Double(done) / elapsed : 0
            progress?(HubSyncProgress(phase: .uploading, completed: done, total: pending.count, detail: "Invio misure… \(done)/\(pending.count)", estimatedRemaining: rate > 0 ? Double(pending.count - done) / rate : nil))
            if offset % (Self.pushChunkSize * 5) == 0 { HubSyncStateStore.save(state) }
        }

        // 3. Propagate local deletions only for records this client uploaded.
        for (id, _) in state.measurementUploaded where !localIDs.contains(id) && !knownRemote.contains(id) {
            guard let revision = state.measurementRevisions[id] else { continue }
            let path = "/api/v1/sync/measurements/\(id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id)?baseRevision=\(revision)"; let mutation = stableMutationID("delete:\(id)")
            do {
                let _: DeleteResponse = try await perform(path: path, endpoint: config.endpoint, method: "DELETE", headers: try config.headers(method: "DELETE", path: path, idempotency: mutation))
                state.measurementUploaded.removeValue(forKey: id); state.measurementRevisions.removeValue(forKey: id); uploaded += 1
            } catch { /* a later sync retries */ }
        }
        return (uploaded, imported)
    }

    func pushMeasurementBatch(_ records: [RequestMeasurement], config: Configuration) async throws -> [BatchResult] {
        let body = try JSONEncoder().encode(BatchRequest(records: records))
        let path = "/api/v1/sync/measurements/batch"
        let mutation = stableMutationID("batch:\(records.count):\(records.first?.id ?? "")")
        let response: BatchResponse = try await perform(
            path: path,
            endpoint: config.endpoint,
            method: "POST",
            bodyData: body,
            headers: try config.headers(method: "POST", path: path, idempotency: mutation, body: body)
        )
        return response.records
    }
}
