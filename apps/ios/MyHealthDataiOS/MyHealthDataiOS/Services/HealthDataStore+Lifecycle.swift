import Foundation

extension HealthDataStore {
    func load() async {
        do {
            snapshot = try await persistence.loadSnapshot()
            rebuildMeasurementCache()
            rebuildSortedCaches(.all)
            isLoaded = true
            loadFailed = false
            lastError = nil
        } catch {
            isLoaded = true
            loadFailed = true
            lastError = error.localizedDescription
        }
    }

    func flushPersistence() async {
        do {
            try await persistence.flush()
        } catch {
            lastError = error.localizedDescription
        }
    }

    func syncPersonalRelay() async {
        guard isLoaded, !loadFailed else { return }
        let client = PersonalRelaySyncClient()
        guard client.isConfigured() else { return }
        personalRelaySyncTask?.cancel()
        personalRelaySyncStatus = "Sincronizzazione misure corporee..."
        do {
            let outcome = try await client.synchronize(measurements: snapshot.measurements)
            let existingIDs = Set(snapshot.measurements.map(\.id))
            let additions = outcome.importedMeasurements.filter { !existingIDs.contains($0.id) }
            if !additions.isEmpty {
                snapshot.measurements.append(contentsOf: additions)
                rebuildMeasurementCache()
                schedulePersistence()
            }
            personalRelaySyncStatus = [
                outcome.uploadedCount > 0 ? "\(outcome.uploadedCount) inviate" : nil,
                additions.isEmpty ? nil : "\(additions.count) ricevute",
                "aggiornata ora"
            ].compactMap { $0 }.joined(separator: " · ")
        } catch {
            personalRelaySyncStatus = "Sync non riuscita: \(error.localizedDescription)"
        }
    }

    /// Starts the Hub sync in a background task: the heavy work runs off the
    /// main actor, progress stays observable and the user can cancel.
    func syncHub() {
        guard isLoaded, !loadFailed else { return }
        if isHubSyncing {
            hubSyncRequestedWhileBusy = true
            return
        }
        let client = HubSyncClient()
        guard client.isConfigured() else { return }
        isHubSyncing = true
        hubSyncLastResult = nil
        hubSyncProgress = nil
        hubSyncStatus = "Sincronizzazione Hub…"
        let syncSnapshot = snapshot
        hubSyncTask = Task { [weak self] in
            do {
                let outcome = try await client.synchronize(snapshot: syncSnapshot) { [weak self] progress in
                    Task { @MainActor in self?.applyHubProgress(progress) }
                }
                guard let self else { return }
                if outcome.snapshot != self.snapshot {
                    self.snapshot = outcome.snapshot
                    self.rebuildMeasurementCache()
                    self.rebuildSortedCaches(.all)
                    self.schedulePersistence()
                }
                self.hubSyncStatus = [
                    outcome.uploaded > 0 ? "\(outcome.uploaded) inviate" : nil,
                    outcome.deleted > 0 ? "\(outcome.deleted) eliminate" : nil,
                    outcome.imported > 0 ? "\(outcome.imported) ricevute" : nil,
                    outcome.attachments.completed > 0 ? "\(outcome.attachments.completed) allegati sincronizzati" : nil,
                    outcome.attachments.pending > 0 ? "\(outcome.attachments.pending) allegati in coda, nuovo tentativo automatico" : nil,
                    outcome.uploaded == 0 && outcome.deleted == 0 && outcome.imported == 0 && outcome.attachments.completed == 0 ? "già allineata" : nil
                ].compactMap { $0 }.joined(separator: " · ")
                // The sync engine keeps attachment failures non-fatal so one
                // broken PDF cannot block the record graph. Surface that
                // partial failure to BGTaskScheduler, though, so the next
                // refresh remains eligible while the durable queue retries.
                self.hubSyncLastResult = outcome.attachments.failed == 0
            } catch is CancellationError {
                self?.hubSyncStatus = "Sincronizzazione annullata."
                self?.hubSyncLastResult = false
            } catch {
                self?.hubSyncStatus = "Sync Hub non riuscita: \(error.localizedDescription)"
                self?.hubSyncLastResult = false
            }
            self?.isHubSyncing = false
            self?.hubSyncProgress = nil
            if self?.hubSyncRequestedWhileBusy == true {
                self?.hubSyncRequestedWhileBusy = false
                self?.syncHub()
            }
        }
    }

    /// Requests a Hub sync and waits for the coalesced work to finish.
    ///
    /// Foreground callers can keep using `syncHub()` for fire-and-forget UI
    /// actions. Background refresh needs a completion signal, otherwise the
    /// system may suspend the process immediately after the request is queued.
    /// Repeated requests while a sync is running are coalesced by `syncHub()`;
    /// this method waits through the follow-up pass as well.
    @discardableResult
    func syncHubAndWait() async -> Bool {
        guard isLoaded, !loadFailed else { return false }
        let client = HubSyncClient()
        // A standalone vault remains fully usable without a Hub. There is no
        // retry work to perform when pairing is absent, so treat this as a
        // successful no-op for lifecycle/background-task accounting.
        guard client.isConfigured() else { return true }

        syncHub()
        while isHubSyncing || hubSyncRequestedWhileBusy {
            guard let task = hubSyncTask else { break }
            await task.value
            await Task.yield()
        }
        return hubSyncLastResult ?? false
    }

    func cancelHubSync() {
        hubSyncTask?.cancel()
        hubSyncTask = nil
        hubSyncRequestedWhileBusy = false
        isHubSyncing = false
        hubSyncLastResult = false
        hubSyncProgress = nil
        hubSyncStatus = "Sincronizzazione annullata."
    }

    private func applyHubProgress(_ progress: HubSyncProgress) {
        hubSyncProgress = progress
        hubSyncStatus = progress.label
    }
}
