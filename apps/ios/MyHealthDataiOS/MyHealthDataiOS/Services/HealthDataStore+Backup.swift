import Foundation

@MainActor
extension HealthDataStore {
    func storeAttachment(from sourceURL: URL, metadata: AttachmentMetadata) async throws -> AttachmentMetadata {
        try await persistence.saveAttachment(from: sourceURL, metadata: metadata)
    }

    func previewURL(for attachment: AttachmentMetadata) async throws -> URL {
        try await persistence.materializeAttachment(attachment)
    }

    func exportBackupDocument() async -> MHDZipDocument {
        do {
            var attachments: [String: Data] = [:]
            for document in snapshot.documents {
                if let attachment = document.attachment {
                    attachments[attachment.id] = try await persistence.encryptedAttachmentData(attachment)
                }
            }
            for event in snapshot.events {
                for attachment in event.attachments {
                    attachments[attachment.id] = try await persistence.encryptedAttachmentData(attachment)
                }
            }
            return MHDZipDocument(data: try exportService.exportBackup(snapshot: snapshot, encryptedAttachments: attachments))
        } catch {
            lastError = error.localizedDescription
            return MHDZipDocument()
        }
    }

    func importBackup(from data: Data) async {
        await applyBackup(data, merge: false)
    }

    func mergeBackup(from data: Data) async {
        await applyBackup(data, merge: true)
    }

    private func applyBackup(_ data: Data, merge: Bool) async {
        do {
            let imported = try exportService.importBackup(from: data)
            var restored = imported.snapshot
            var attachmentData: [String: Data] = [:]
            for (path, bytes) in imported.attachments {
                let encodedID = URL(fileURLWithPath: path).deletingPathExtension().lastPathComponent
                let id = encodedID.removingPercentEncoding ?? encodedID
                attachmentData[id] = bytes
            }
            for index in restored.documents.indices {
                guard let attachment = restored.documents[index].attachment,
                      let bytes = attachmentData[attachment.id] else { continue }
                restored.documents[index].attachment = try await persistence.restoreEncryptedAttachment(bytes, metadata: attachment)
            }
            for eventIndex in restored.events.indices {
                for attachmentIndex in restored.events[eventIndex].attachments.indices {
                    let attachment = restored.events[eventIndex].attachments[attachmentIndex]
                    guard let bytes = attachmentData[attachment.id] else { continue }
                    restored.events[eventIndex].attachments[attachmentIndex] = try await persistence.restoreEncryptedAttachment(bytes, metadata: attachment)
                }
            }
            if merge {
                mutate(invalidate: .all, measurementsChanged: true) { $0 = mergeSnapshots(local: $0, remote: restored) }
            } else {
                mutate(invalidate: .all, measurementsChanged: true) { $0 = restored }
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    private func mergeSnapshots(local: MHDDataSnapshot, remote: MHDDataSnapshot) -> MHDDataSnapshot {
        func mergeByID<T: Identifiable>(_ local: [T], _ remote: [T]) -> [T] where T.ID: Hashable {
            var result = local
            var ids = Set(local.map(\.id))
            for value in remote where ids.insert(value.id).inserted { result.append(value) }
            return result
        }
        var merged = local
        merged.profile = remote.profile ?? local.profile
        merged.events = mergeByID(local.events, remote.events)
        merged.measurements = mergeByID(local.measurements, remote.measurements)
        merged.documents = mergeByID(local.documents, remote.documents)
        merged.cycleEntries = mergeByID(local.cycleEntries, remote.cycleEntries)
        merged.sleepSessions = mergeByID(local.sleepSessions, remote.sleepSessions)
        merged.appointments = mergeByID(local.appointments, remote.appointments)
        merged.medications = mergeByID(local.medications, remote.medications)
        merged.medicationDoseEvents = mergeByID(local.medicationDoseEvents, remote.medicationDoseEvents)
        merged.conditionEpisodes = mergeByID(local.conditionEpisodes, remote.conditionEpisodes)
        merged.conditionCheckIns = mergeByID(local.conditionCheckIns, remote.conditionCheckIns)
        merged.labResults = mergeByID(local.labResults, remote.labResults)
        merged.foodLogEntries = mergeByID(local.foodLogEntries, remote.foodLogEntries)
        merged.foodRecipes = mergeByID(local.foodRecipes, remote.foodRecipes)
        merged.gymPlans = mergeByID(local.gymPlans, remote.gymPlans)
        merged.gymWorkouts = mergeByID(local.gymWorkouts, remote.gymWorkouts)
        return merged
    }

    func importSnapshot(from data: Data) {
        do {
            let imported = try exportService.importSnapshot(from: data)
            mutate(invalidate: .all, measurementsChanged: true) { snapshot in
                snapshot = imported
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    func exportDocument() -> MHDExportDocument {
        do {
            return MHDExportDocument(data: try exportService.exportData(snapshot: snapshot))
        } catch {
            lastError = error.localizedDescription
            return MHDExportDocument()
        }
    }
}
