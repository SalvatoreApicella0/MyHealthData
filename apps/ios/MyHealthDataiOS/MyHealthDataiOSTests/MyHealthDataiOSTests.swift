import Foundation
import SceneKit
import Testing
#if canImport(PDFKit) && canImport(UIKit)
import PDFKit
import UIKit
#endif
@testable import MyHealthDataiOS

struct MyHealthDataiOSTests {
    @Test @MainActor func dataScrollDefaultOrderMatchesWebBaseSections() {
        #expect(DataScrollView.defaultSectionFeatures.map(\.id) == [
            "body", "bodyMeasurements", "heart", "activity", "sleep",
            "nutrition", "medications", "cycle", "gym", "bloodwork",
            "allergies", "vision", "gutHealth", "dental", "sexualHealth"
        ])
    }

    @Test func bodyPainCameraStateRoundTripsWithoutHealthData() throws {
        let suiteName = "mhd.ios.tests.camera.\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suiteName))
        defer { defaults.removePersistentDomain(forName: suiteName) }

        let expected = BodyPainCameraState(
            position: .init(SCNVector3(0.4, 0.2, 7.4)),
            orientation: .init(SCNQuaternion(0.1, 0.2, 0.3, 0.9)),
            target: .init(SCNVector3(0, 0.15, 0)),
            fieldOfView: 24
        )
        BodyPainCameraStateStore.save(expected, to: defaults)

        #expect(BodyPainCameraStateStore.load(from: defaults) == expected)
    }

#if canImport(PDFKit) && canImport(UIKit)
    @Test func documentScanPDFPreservesEveryPageAndAttachmentMetadata() throws {
        let pages = [
            scanTestImage(color: .red),
            scanTestImage(color: .green),
            scanTestImage(color: .blue)
        ]
        let data = try DocumentScanPDFEncoder.makePDF(from: pages)
        let pdf = try #require(PDFDocument(data: data))
        let metadata = AttachmentMetadata(
            name: "Scansione (3 pagine).pdf",
            type: "application/pdf",
            size: data.count,
            pageCount: pages.count
        )

        #expect(pdf.pageCount == pages.count)
        #expect(metadata.pageCount == pages.count)
        #expect(data.starts(with: Data("%PDF".utf8)))
    }

    @Test func documentScanPDFRejectsInvalidPageInMultipageScan() {
        do {
            _ = try DocumentScanPDFEncoder.makePDF(from: [scanTestImage(color: .red), UIImage()])
            Issue.record("Una scansione multipagina con una pagina senza dimensioni valide non deve produrre un PDF.")
        } catch let error as DocumentScanPDFEncoder.Error {
            #expect(error == .invalidPageSize)
        } catch {
            Issue.record("Errore inatteso nella conversione PDF: \(error)")
        }
    }

    private func scanTestImage(color: UIColor) -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: 160, height: 220)).image { _ in
            color.setFill()
            UIRectFill(CGRect(x: 0, y: 0, width: 160, height: 220))
        }
    }
#endif

    @Test func documentScanErrorsUseSanitizedItalianMessages() {
        #expect(DocumentScanError.noPages.localizedDescription == "La scansione non contiene pagine. Riprova o importa una foto o un PDF.")
        #expect(DocumentScanError.pdfConversionFailed.localizedDescription == "Non è stato possibile creare il PDF della scansione. Nessun dato è stato salvato: riprova o importa una foto o un PDF.")
        #expect(DocumentScanError.cameraFailed.localizedDescription == "La scansione non è riuscita. Nessun dato è stato salvato: riprova o importa una foto o un PDF.")
    }

    @Test func dentalContractNormalizesCrossPlatformAliases() {
        #expect(DentalContract.fdiTeeth.count == 32)
        #expect(Set(DentalContract.fdiTeeth).count == 32)
        #expect(DentalContract.action(fromRaw: "ROOT-CANAL") == .rootCanal)
        #expect(DentalContract.action(fromRaw: "Devitalizzazione") == .rootCanal)
        #expect(DentalContract.action(fromRaw: "Ripristino dente") == .restoration)

        let removed = dentalContractEvent(
            id: "removed",
            action: "checkup",
            occurredAt: 1,
            tags: ["tooth=16", "state=removed", "intervention=check"]
        )
        let restoration = dentalContractEvent(
            id: "restored",
            action: "checkup",
            occurredAt: 2,
            tags: ["tooth=16", "state=healthy", "restored=SI"]
        )
        let projection = DentalContract.resolve([restoration, removed])

        #expect(projection.byTooth["16"]?.removed == false)
        #expect(projection.byTooth["16"]?.state == .healthy)
        #expect(projection.events.map(\.event.id) == ["removed", "restored"])
    }

    @Test func dentalContractDeduplicatesRevisionsAndKeepsExtractionMonotonic() {
        let oldRevision = dentalContractEvent(
            id: "same",
            action: "carie",
            occurredAt: 1,
            updatedAt: 2,
            tags: ["tooth=16"]
        )
        let newRevision = dentalContractEvent(
            id: "same",
            action: "filling",
            occurredAt: 1,
            updatedAt: 3,
            tags: ["tooth=16"]
        )
        let extraction = dentalContractEvent(
            id: "extraction",
            action: "Estrazione",
            occurredAt: 4,
            tags: ["tooth=16"]
        )
        let ordinaryAfterExtraction = dentalContractEvent(
            id: "ordinary-after-extraction",
            action: "ROOT-CANAL",
            occurredAt: 5,
            tags: ["tooth=16"]
        )

        let projection = DentalContract.resolve([
            ordinaryAfterExtraction,
            extraction,
            oldRevision,
            newRevision,
        ])

        #expect(projection.events.count == 3)
        #expect(projection.byTooth["16"]?.removed == true)
        #expect(projection.byTooth["16"]?.state == .removed)
        #expect(projection.byTooth["16"]?.history.count == 3)
        #expect(projection.byTooth["16"]?.history.first?.state == .treated)
    }

    @Test func dentalContractDeduplicationIsIndependentOfImportOrderWhenTimestampsTie() {
        var lowerRevisionKey = dentalContractEvent(
            id: "same-timestamp",
            action: "caries",
            occurredAt: 1,
            tags: ["tooth=1\t6"]
        )
        lowerRevisionKey.intensity = 1

        var higherRevisionKey = lowerRevisionKey
        higherRevisionKey.intensity = 2

        let firstOrder = DentalContract.resolve([lowerRevisionKey, higherRevisionKey])
        let reversedOrder = DentalContract.resolve([higherRevisionKey, lowerRevisionKey])

        #expect(firstOrder.events.first?.event.intensity == 2)
        #expect(reversedOrder.events.first?.event.intensity == 2)
        #expect(firstOrder.byTooth["16"]?.state == reversedOrder.byTooth["16"]?.state)
    }

    @Test func dentalContractIgnoresInvalidFDIInToothProjection() {
        let invalid = dentalContractEvent(
            id: "invalid",
            action: "caries",
            occurredAt: 1,
            tags: ["tooth=19"]
        )

        let projection = DentalContract.resolve([invalid])

        #expect(projection.events.count == 1)
        #expect(projection.events.first?.tooth == nil)
        #expect(projection.byTooth.isEmpty)
    }

    @MainActor
    @Test func appointmentUpdatePreservesAdvancedFields() {
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let documentID = "document_report"
        let original = AppointmentRecord(
            id: "appointment_advanced",
            title: "Controllo",
            scheduledAt: date,
            category: .bloodwork,
            recurrenceNote: "Ogni sei mesi",
            clinician: "Centro analisi",
            reason: "Controllo ematico",
            outcome: "Ripetere tra sei mesi",
            linkedDocumentId: documentID,
            parentAppointmentId: "appointment_parent",
            reportCollectionAt: date.addingTimeInterval(86_400),
            questions: ["Devo essere a digiuno?"],
            preparationNotes: "Otto ore di digiuno",
            followUpAt: date.addingTimeInterval(30 * 86_400),
            reminderMinutesBefore: 1_440,
            status: .awaitingReport,
            createdAt: date,
            updatedAt: date
        )
        let store = HealthDataStore(testingSnapshot: MHDDataSnapshot(
            profile: nil,
            events: [],
            measurements: [],
            documents: [],
            appointments: [original]
        ))

        var edited = original
        edited.title = "Controllo aggiornato"
        edited.scheduledAt = date.addingTimeInterval(3_600)
        edited.updatedAt = date.addingTimeInterval(7_200)
        store.updateAppointment(edited)

        let saved = store.appointments.first
        #expect(saved?.title == "Controllo aggiornato")
        #expect(saved?.scheduledAt == edited.scheduledAt)
        #expect(saved?.recurrenceNote == original.recurrenceNote)
        #expect(saved?.outcome == original.outcome)
        #expect(saved?.linkedDocumentId == original.linkedDocumentId)
        #expect(saved?.parentAppointmentId == original.parentAppointmentId)
        #expect(saved?.reportCollectionAt == original.reportCollectionAt)
        #expect(saved?.questions == original.questions)
        #expect(saved?.preparationNotes == original.preparationNotes)
        #expect(saved?.followUpAt == original.followUpAt)
        #expect(saved?.reminderMinutesBefore == original.reminderMinutesBefore)
        #expect(saved?.status == original.status)
    }

    private func dentalContractEvent(
        id: String,
        action: String,
        occurredAt: TimeInterval,
        updatedAt: TimeInterval? = nil,
        tags: [String]
    ) -> HealthEvent {
        let date = Date(timeIntervalSince1970: occurredAt)
        return HealthEvent(
            id: id,
            type: .dentalCare,
            occurredAt: date,
            description: action,
            tags: ["action=\(action)"] + tags,
            createdAt: date,
            updatedAt: Date(timeIntervalSince1970: updatedAt ?? occurredAt)
        )
    }

    @Test func canonicalSyncUploadsChangedKnownRecords() {
        #expect(HubSyncClient.canonicalRecordNeedsUpload(
            localFingerprint: "local-edit",
            remoteFingerprint: "remote-before-edit",
            lastUploadedFingerprint: "remote-before-edit",
            knownRemote: true
        ))
        #expect(!HubSyncClient.canonicalRecordNeedsUpload(
            localFingerprint: "same",
            remoteFingerprint: "same",
            lastUploadedFingerprint: "same",
            knownRemote: true
        ))
        #expect(!HubSyncClient.canonicalRecordNeedsUpload(
            localFingerprint: "same",
            remoteFingerprint: nil,
            lastUploadedFingerprint: "same",
            knownRemote: true
        ))
        #expect(HubSyncClient.canonicalRecordNeedsUpload(
            localFingerprint: "new",
            remoteFingerprint: nil,
            lastUploadedFingerprint: nil,
            knownRemote: false
        ))
    }

    @Test func hubAttachmentHashIsStableForPlaintextBytes() {
        let expected = "819515f029136115c46eac28b2c14173eafa8144b3f0716eb4b974f3b81ebddc"
        #expect(MHDHashing.sha256Hex(Data("referto PDF".utf8)) == expected)
        #expect(HubSyncClient.sha256Hex(Data("referto PDF".utf8)) == expected)
    }

    @Test func hubMutationIDIsDeterministicAndUUIDShaped() {
        let client = HubSyncClient()
        let mutation = client.stableMutationID("records:events:upsert:event-1:hash")

        #expect(mutation == client.stableMutationID("records:events:upsert:event-1:hash"))
        #expect(mutation != client.stableMutationID("records:events:upsert:event-2:hash"))
        #expect(mutation.split(separator: "-").map(\.count) == [8, 4, 4, 4, 12])
        #expect(mutation.split(separator: "-")[2].first == "4")
        #expect(mutation.split(separator: "-")[3].first == "8")
    }

    @Test func hubSyncDateCodingKeepsCanonicalISO8601Representation() throws {
        let date = Date(timeIntervalSince1970: 1_700_000_000.123)
        let encoded = HubSyncDateCoding.string(from: date)

        #expect(encoded == ISO8601DateFormatter().string(from: date))
        #expect(try #require(HubSyncDateCoding.date(from: encoded)) == Date(timeIntervalSince1970: 1_700_000_000))
    }

    @Test func hubCanonicalFingerprintIgnoresServerEnvelope() {
        let payload: [String: Any] = [
            "id": "event-1",
            "description": "Controllo"
        ]
        var serverRecord = payload
        serverRecord["revision"] = 7
        serverRecord["updatedAt"] = "2026-09-25T16:00:00Z"
        serverRecord["originDeviceId"] = "device-1"

        #expect(HubSyncCanonicalCodec.fingerprint(payload) == HubSyncCanonicalCodec.fingerprint(serverRecord))

        var editedPayload = payload
        editedPayload["description"] = "Controllo aggiornato"
        #expect(HubSyncCanonicalCodec.fingerprint(payload) != HubSyncCanonicalCodec.fingerprint(editedPayload))
    }

    @Test func healthTimeNavigatorUsesExplicitRollingAndCalendarLabels() {
        let anchor = Date(timeIntervalSince1970: 1_753_920_000) // 2025-07-27 00:00 UTC
        let week = HealthTimeWindow(scale: .week, anchor: anchor)
        #expect(week.modeLabel(.rolling) == "Ultimi 7 giorni")
        #expect(week.modeLabel(.calendar).hasPrefix("Settimana "))

        let day = HealthTimeWindow(scale: .day, anchor: anchor)
        #expect(day.modeLabel(.rolling) == "Ultime 24 ore")
        #expect(day.modeLabel(.calendar).hasPrefix("Giorno "))

        let year = HealthTimeWindow(scale: .year, anchor: anchor)
        #expect(year.modeLabel(.rolling) == "Ultimi 365 giorni")
        #expect(year.modeLabel(.calendar).hasPrefix("Anno "))
    }

    @Test func adaptiveChartDomainFitsObservedValuesWithReadableMargin() {
        let domain = AdaptiveChartDomain.range(for: [97.8, 98.1, 98.2])

        #expect(domain.lowerBound < 97.8)
        #expect(domain.upperBound > 98.2)
        #expect(domain.upperBound - domain.lowerBound < 5)
    }

    @Test func adaptiveChartDomainHandlesSingleAndEmptySeries() {
        let single = AdaptiveChartDomain.range(for: [98])
        #expect(single.lowerBound < 98)
        #expect(single.upperBound > 98)
        #expect(AdaptiveChartDomain.range(for: []).lowerBound == 0)
        #expect(AdaptiveChartDomain.range(for: []).upperBound == 1)
    }

    @Test func documentModuleContextSurvivesEncryptedExport() throws {
        let date = Date(timeIntervalSince1970: 1_784_000_000)
        let document = HealthDocument(
            title: "Visita oculistica",
            documentType: .specialistVisit,
            documentDate: "2026-07-24",
            linkedModuleId: DocumentModuleLink.vision.rawValue,
            createdAt: date,
            updatedAt: date
        )
        let snapshot = MHDDataSnapshot(profile: nil, events: [], measurements: [], documents: [document])

        let exported = try MHDExportService().exportData(snapshot: snapshot)
        let restored = try MHDExportService().importSnapshot(from: exported)

        #expect(restored.documents.first?.linkedModuleId == DocumentModuleLink.vision.rawValue)
    }

    @Test func documentDateCodingReadsCanonicalDateOnlyAndLegacyTimestamp() throws {
        let calendar = utcCalendar
        let expected = try #require(calendar.date(from: DateComponents(year: 2026, month: 7, day: 24)))

        #expect(MHDDocumentDateCoding.date(from: "2026-07-24") == expected)
        #expect(MHDDocumentDateCoding.date(from: "2026-07-24T12:30:00Z") != nil)
        #expect(MHDDocumentDateCoding.string(from: expected) == "2026-07-24")
    }

    @Test @MainActor func deletingDocumentRemovesLinkedLabResults() {
        let store = HealthDataStore(testingSnapshot: .empty)
        let document = HealthDocument(
            title: "Referto ematico",
            documentType: .medicalReport,
            documentDate: "2026-09-19"
        )
        store.addDocument(document)
        store.addLabResult(LabResult(
            panelName: document.title,
            analyte: "Emoglobina",
            value: 13.7,
            unit: "g/dL",
            collectedAt: .now,
            linkedDocumentId: document.id
        ))
        store.addLabResult(LabResult(
            panelName: "Altro referto",
            analyte: "Glucosio",
            value: 90,
            unit: "mg/dL",
            collectedAt: .now,
            linkedDocumentId: "document_other"
        ))

        store.deleteDocument(id: document.id)

        #expect(!store.snapshot.documents.contains { $0.id == document.id })
        #expect(store.labResults.count == 1)
        #expect(store.labResults.first?.linkedDocumentId == "document_other")
    }

    @Test @MainActor func derivedCollectionsInvalidateAfterMutationsAndImport() throws {
        let base = Date(timeIntervalSince1970: 1_800_000_000)
        let plannedLater = AppointmentRecord(
            id: "appointment_later",
            title: "Controllo",
            scheduledAt: base.addingTimeInterval(7_200),
            status: .planned
        )
        let completed = AppointmentRecord(
            id: "appointment_completed",
            title: "Già fatto",
            scheduledAt: base,
            status: .completed
        )
        let workoutLater = GymWorkout(
            id: "workout_later",
            name: "Allenamento",
            startedAt: base.addingTimeInterval(7_200)
        )
        let planLater = GymPlan(
            id: "plan_later",
            name: "Scheda",
            updatedAt: base.addingTimeInterval(7_200)
        )
        let snapshot = MHDDataSnapshot(
            profile: nil,
            events: [],
            measurements: [],
            documents: [],
            appointments: [plannedLater, completed],
            gymPlans: [planLater],
            gymWorkouts: [workoutLater]
        )
        let store = HealthDataStore(testingSnapshot: snapshot, currentDate: { base })

        #expect(store.upcomingAppointments.map(\.id) == [plannedLater.id])
        #expect(store.gymWorkouts.map(\.id) == [workoutLater.id])
        #expect(store.gymPlans.map(\.id) == [planLater.id])

        let plannedEarlier = AppointmentRecord(
            id: plannedLater.id,
            title: plannedLater.title,
            scheduledAt: base.addingTimeInterval(3_600),
            status: .planned
        )
        store.updateAppointment(plannedEarlier)
        #expect(store.upcomingAppointments.map(\.id) == [plannedEarlier.id])
        #expect(store.upcomingAppointments.first?.scheduledAt == plannedEarlier.scheduledAt)

        store.updateAppointmentStatus(id: plannedEarlier.id, status: .completed)
        #expect(store.upcomingAppointments.isEmpty)

        let workoutEarlier = GymWorkout(
            id: "workout_earlier",
            name: "Allenamento breve",
            startedAt: base.addingTimeInterval(-3_600)
        )
        store.saveGymWorkout(workoutEarlier)
        #expect(store.gymWorkouts.map(\.id) == [workoutLater.id, workoutEarlier.id])
        store.deleteGymWorkout(id: workoutLater.id)
        #expect(store.gymWorkouts.map(\.id) == [workoutEarlier.id])

        let importedAppointment = AppointmentRecord(
            id: "appointment_imported",
            title: "Importato",
            scheduledAt: base.addingTimeInterval(14_400),
            status: .planned
        )
        let imported = MHDDataSnapshot(
            profile: nil,
            events: [],
            measurements: [],
            documents: [],
            appointments: [importedAppointment],
            gymPlans: [],
            gymWorkouts: []
        )
        store.importSnapshot(from: try MHDExportService().exportData(snapshot: imported))

        #expect(store.upcomingAppointments.map(\.id) == [importedAppointment.id])
        #expect(store.gymPlans.isEmpty)
        #expect(store.gymWorkouts.isEmpty)
    }

#if DEBUG
    @Test func cacheInvalidationOnlyRebuildsRequestedDomain() {
        let date = Date(timeIntervalSince1970: 1_800_000_000)
        let event = HealthEvent(type: .pain, occurredAt: date, description: "Evento")
        let appointment = AppointmentRecord(title: "Visita", scheduledAt: date)
        var snapshot = MHDDataSnapshot.empty
        snapshot.events = [event]
        snapshot.appointments = [appointment]

        var caches = HealthDataStoreCaches()
        caches.rebuildSortedCaches(from: snapshot, invalidation: .all)
        let baseline = caches.rebuildCounts

        snapshot.events.append(HealthEvent(
            type: .pain,
            occurredAt: date.addingTimeInterval(60),
            description: "Secondo evento"
        ))
        caches.rebuildSortedCaches(from: snapshot, invalidation: .events)

        #expect(caches.rebuildCounts[.events] == (baseline[.events] ?? 0) + 1)
        #expect(caches.rebuildCounts[.appointments] == baseline[.appointments])
        #expect(caches.rebuildCounts[.gymPlans] == baseline[.gymPlans])
        #expect(caches.rebuildCounts[.labResults] == baseline[.labResults])
    }
#endif

    @Test @MainActor func upcomingAppointmentsRequirePlannedStatusAndCurrentOrFutureDate() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        var currentDate = now
        let atNow = AppointmentRecord(
            id: "appointment_at_now",
            title: "Ora",
            scheduledAt: now,
            status: .planned
        )
        let future = AppointmentRecord(
            id: "appointment_future",
            title: "Domani",
            scheduledAt: now.addingTimeInterval(3_600),
            status: .planned
        )
        let past = AppointmentRecord(
            id: "appointment_past",
            title: "Ieri",
            scheduledAt: now.addingTimeInterval(-3_600),
            status: .planned
        )
        let completed = AppointmentRecord(
            id: "appointment_completed",
            title: "Completato",
            scheduledAt: now.addingTimeInterval(7_200),
            status: .completed
        )
        let cancelled = AppointmentRecord(
            id: "appointment_cancelled",
            title: "Annullato",
            scheduledAt: now.addingTimeInterval(10_800),
            status: .cancelled
        )
        let awaitingReport = AppointmentRecord(
            id: "appointment_awaiting_report",
            title: "Referto",
            scheduledAt: now.addingTimeInterval(14_400),
            status: .awaitingReport
        )
        let store = HealthDataStore(testingSnapshot: MHDDataSnapshot(
            profile: nil,
            events: [],
            measurements: [],
            documents: [],
            appointments: [awaitingReport, past, cancelled, future, completed, atNow],
            gymPlans: [],
            gymWorkouts: []
        ), currentDate: { currentDate })

        #expect(store.upcomingAppointments.map(\.id) == [atNow.id, future.id])

        currentDate = future.scheduledAt.addingTimeInterval(1)
        #expect(store.upcomingAppointments.isEmpty)
    }

    @Test func appointmentStatusDefaultsToPlannedForWebCompatiblePayload() throws {
        let data = Data(#"""
        {
            "id": "appointment_legacy",
            "title": "Controllo",
            "scheduledAt": "2027-01-15T10:00:00Z",
            "createdAt": "2027-01-01T10:00:00Z",
            "updatedAt": "2027-01-01T10:00:00Z"
        }
        """#.utf8)

        let appointment = try MHDDateCoding.decoder.decode(AppointmentRecord.self, from: data)

        #expect(appointment.status == .planned)
    }

    @Test func canonicalBodyMeasurementAdapterUsesPortableUnitsAndProvenance() throws {
        let date = Date(timeIntervalSince1970: 1_784_000_000)
        let measurement = Measurement(
            id: "measurement_private_1",
            type: .weight,
            value: 78.4,
            unit: "kg",
            measuredAt: date,
            createdAt: date,
            source: .manual
        )

        let record = try CanonicalBodyMeasurementAdapter().convert(
            measurement,
            subjectID: "synthetic-subject-001"
        )

        #expect(record.recordType == "weight")
        #expect(record.unit == "kg")
        #expect(record.provenance.sourcePlatform == "apple")
        #expect(record.provenance.kind == "raw")
        #expect(UUID(uuidString: record.recordId) != nil)
    }

    @Test func okokV20AdvertisementParsesStableWeightAndImpedance() throws {
        var payload = Array(repeating: UInt8(0), count: 19)
        payload[6] = 0x05 // stable, two decimal places
        payload[8] = 0x1C
        payload[9] = 0x84 // 7300 / 100 = 73 kg
        payload[10] = 0x14
        payload[11] = 0x32 // 5170 / 10 = 517 ohm
        var checksum: UInt8 = 0x20
        for byte in payload[0..<12] { checksum ^= byte }
        payload[12] = checksum
        let advertisement = Data([0xCA, 0x20] + payload)

        let reading = try #require(OKOKAdvertisementParser.parse(manufacturerData: advertisement, deviceName: "Yoda1"))

        #expect(reading.protocolVariant == "OKOK V20")
        #expect(reading.weightKilograms == 73)
        #expect(reading.impedanceOhms == 517)
    }

    @Test func okokV20AdvertisementRejectsUnstableOrCorruptedFrames() {
        var payload = Array(repeating: UInt8(0), count: 19)
        payload[8] = 0x02
        payload[9] = 0xDA
        let unstable = Data([0xCA, 0x20] + payload)
        #expect(OKOKAdvertisementParser.parse(manufacturerData: unstable) == nil)

        payload[6] = 0x01
        payload[12] = 0xFF
        let corrupted = Data([0xCA, 0x20] + payload)
        #expect(OKOKAdvertisementParser.parse(manufacturerData: corrupted) == nil)
    }

    @Test func okokC0PreservesButDoesNotMislabelProprietaryBodySignal() throws {
        let advertisement = Data([
            0xC0, 0x5B,
            0x26, 0x39, 0x17, 0x70, 0x0A, 0x01, 0x25,
            0xF8, 0x8F, 0xC8, 0x35, 0x68, 0x5B
        ])

        let reading = try #require(OKOKAdvertisementParser.parse(manufacturerData: advertisement))

        #expect(reading.weightKilograms == 97.85)
        #expect(reading.rawBodySignalCode == 0x1770)
        #expect(reading.impedanceOhms == nil)
    }

    @Test func exportEnvelopeUsesMhdManifest() throws {
        let snapshot = MHDDataSnapshot(
            profile: LocalProfile(alias: "Test"),
            events: [
                HealthEvent(
                    type: .pain,
                    bodyPoint: BodyPoint(x: 0.1, y: 0.2, z: 0.3, approximateRegionId: .head),
                    occurredAt: Date(timeIntervalSince1970: 0),
                    description: "Headache",
                    attachments: [
                        AttachmentMetadata(name: "note.pdf", type: "application/pdf", size: 128)
                    ]
                )
            ],
            measurements: [],
            documents: []
        )

        let exportFile = MHDExportFile(
            snapshot: snapshot,
            exportedAt: Date(timeIntervalSince1970: 0),
            packageId: "mhdpkg_test",
            appVersion: "1.0",
            buildNumber: "10"
        )

        #expect(exportFile.manifest.app == "MyHealthData")
        #expect(exportFile.manifest.schemaVersion == "0.1.0")
        #expect(exportFile.manifest.formatVersion == "mhd-json-0.1")
        #expect(exportFile.manifest.packageId == "mhdpkg_test")
        #expect(exportFile.manifest.appVersion == "1.0")
        #expect(exportFile.metadata.recordCounts.profile == 1)
        #expect(exportFile.metadata.recordCounts.events == 1)
        #expect(exportFile.metadata.recordCounts.attachments == 1)
        #expect(exportFile.metadata.recordCounts.preciseBodyPoints == 1)
        #expect(exportFile.metadata.recordCounts.totalRecords == 2)
    }

    @Test func exportServiceAddsIntegrityAndImportsRoundTrip() throws {
        let fixedDate = Date(timeIntervalSince1970: 0)
        let snapshot = MHDDataSnapshot(
            profile: nil,
            events: [],
            measurements: [
                Measurement(
                    type: .weight,
                    value: 72,
                    unit: "kg",
                    measuredAt: fixedDate,
                    createdAt: fixedDate
                )
            ],
            documents: [],
            sleepSessions: [
                SleepSession(
                    startAt: fixedDate,
                    endAt: Date(timeIntervalSince1970: 8 * 3600),
                    quality: 4,
                    createdAt: fixedDate,
                    updatedAt: fixedDate
                )
            ]
        )
        let service = MHDExportService()

        let data = try service.exportData(snapshot: snapshot)
        let exportFile = try MHDDateCoding.decoder.decode(MHDExportFile.self, from: data)
        let imported = try service.importSnapshot(from: data)

        #expect(exportFile.integrity?.algorithm == "SHA-256")
        #expect(exportFile.integrity?.recordsSHA256.count == 64)
        #expect(exportFile.integrity?.recordCountsSHA256.count == 64)
        #expect(exportFile.metadata.recordCounts.measurements == 1)
        #expect(exportFile.metadata.recordCounts.sleepSessions == 1)
        #expect(imported == snapshot)
    }

    @Test func foodRecipeNutritionIsComputedPerServing() {
        let recipe = FoodRecipe(
            name: "Pasta",
            servings: 2,
            ingredients: [
                FoodRecipeIngredient(name: "Pasta", quantity: 100, calories: 300, protein: 10, carbohydrates: 60, fat: 2),
                FoodRecipeIngredient(name: "Sugo", quantity: 150, calories: 100, protein: 3, carbohydrates: 12, fat: 4)
            ]
        )

        #expect(recipe.caloriesPerServing == 200)
        #expect(recipe.proteinPerServing == 6.5)
        #expect(recipe.carbohydratesPerServing == 36)
        #expect(recipe.fatPerServing == 3)
    }

    @Test func mhdZipArchiveRoundTripsStoredMembers() throws {
        let entries = [("records.json", Data(#"{"ok":true}"#.utf8)), ("attachments/test.vault", Data([0, 1, 2, 3]))]
        let archive = try MHDZipArchive.make(entries: entries)
        let extracted = try MHDZipArchive.extract(archive)
        #expect(extracted["records.json"] == entries[0].1)
        #expect(extracted["attachments/test.vault"] == entries[1].1)
    }

    @Test func mhdZipArchiveRejectsTruncatedMemberWithoutCrashing() throws {
        let payload = Data(#"{"ok":true}"#.utf8)
        let archive = try MHDZipArchive.make(entries: [("records.json", payload)])
        let truncated = Data(archive.prefix(30 + "records.json".utf8.count + payload.count - 1))

        #expect(throws: MHDZipArchive.ArchiveError.invalidArchive) {
            try MHDZipArchive.extract(truncated)
        }
    }

    @Test func mhdBackupIncludesCsvManifestAndEncryptedAttachmentBytes() throws {
        let snapshot = MHDDataSnapshot(
            profile: nil,
            events: [HealthEvent(type: .pain, occurredAt: .now, description: "test")],
            measurements: [Measurement(type: .weight, value: 80, unit: "kg", measuredAt: .now)],
            documents: []
        )
        let service = MHDExportService()
        let archive = try service.exportBackup(snapshot: snapshot, encryptedAttachments: ["attachment_test": Data([9, 8, 7])])
        let entries = try MHDZipArchive.extract(archive)
        #expect(entries["manifest.json"] != nil)
        #expect(entries["records.json"] != nil)
        #expect(entries["csv/measurements.csv"] != nil)
        #expect(entries["csv/events.csv"] != nil)
        #expect(entries["attachments/attachment_test.vault"] == Data([9, 8, 7]))
        let imported = try service.importBackup(from: archive)
        #expect(imported.snapshot.measurements.count == 1)
        #expect(imported.attachments.count == 1)
    }

    @Test func exportHandlesSixteenThousandMeasurements() throws {
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        let measurements = (0..<16_000).map { index in
            Measurement(id: "fixture_\(index)", type: .weight, value: 70 + Double(index % 30) / 10, unit: "kg", measuredAt: start.addingTimeInterval(Double(index) * 60))
        }
        let snapshot = MHDDataSnapshot(profile: nil, events: [], measurements: measurements, documents: [])
        let data = try MHDExportService().exportData(snapshot: snapshot)
        let imported = try MHDExportService().importSnapshot(from: data)
        #expect(imported.measurements.count == 16_000)
    }

    @Test func healthKitMeasurementProvenanceSurvivesExport() throws {
        let fixedDate = Date(timeIntervalSince1970: 0)
        let measurement = Measurement(
            id: "measurement_apple_health_test",
            type: .walkingSpeed,
            value: 1.2,
            unit: "m/s",
            measuredAt: fixedDate,
            note: "Imported from Apple Health",
            createdAt: fixedDate,
            source: .appleHealth,
            sourceRecordId: "healthkit-uuid"
        )
        let snapshot = MHDDataSnapshot(
            profile: nil,
            events: [],
            measurements: [measurement],
            documents: []
        )
        let data = try MHDExportService().exportData(snapshot: snapshot)
        let imported = try MHDExportService().importSnapshot(from: data)
        let restored = try #require(imported.measurements.first)

        #expect(restored.type == MeasurementType.walkingSpeed)
        #expect(restored.unit == "m/s")
        #expect(restored.source == RecordSource.appleHealth)
        #expect(restored.sourceRecordId == "healthkit-uuid")
    }

    @Test func exportRoundTripPreservesDetailedFoodLog() throws {
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let entry = FoodLogEntry(
            name: "Yogurt bianco",
            brand: "Test",
            barcode: "8000000000000",
            meal: .breakfast,
            loggedAt: date,
            quantity: 125,
            servingUnit: "g",
            calories: 78,
            protein: 5.1,
            carbohydrates: 6.2,
            fat: 3.4,
            source: .openFoodFacts,
            createdAt: date
        )
        let snapshot = MHDDataSnapshot(
            profile: nil,
            events: [],
            measurements: [],
            documents: [],
            foodLogEntries: [entry],
            foodRecipes: [
                FoodRecipe(
                    name: "Bowl yogurt",
                    servings: 1,
                    ingredients: [FoodRecipeIngredient(name: "Yogurt", quantity: 125, calories: 78, protein: 5.1, carbohydrates: 6.2, fat: 3.4)],
                    createdAt: date
                )
            ]
        )

        let data = try MHDExportService().exportData(snapshot: snapshot)
        let imported = try MHDExportService().importSnapshot(from: data)

        #expect(imported.foodLogEntries == [entry])
        #expect(imported.foodRecipes == snapshot.foodRecipes)
        #expect(imported.totalRecordCount == 1)
    }

    @Test func cyclePredictionCanUseLastCompletedCycle() throws {
        let calendar = utcCalendar
        let firstStart = try #require(calendar.date(from: DateComponents(year: 2026, month: 1, day: 1)))
        let secondStart = try #require(calendar.date(from: DateComponents(year: 2026, month: 1, day: 31)))
        let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 2, day: 15)))
        let entries = [firstStart, secondStart].map {
            CycleEntry(
                date: $0,
                isPeriodStart: true,
                isPeriodEnd: false,
                isPeriodDay: true,
                flow: .medium,
                symptoms: nil,
                note: nil
            )
        }
        let settings = CycleSettings(
            typicalCycleLength: 28,
            typicalPeriodLength: 5,
            predictionMethod: .lastCycle,
            isConfigured: true
        )

        let forecast = try #require(CyclePredictor.forecast(
            entries: entries,
            settings: settings,
            calendar: calendar,
            now: now
        ))
        let expectedNextStart = try #require(calendar.date(from: DateComponents(year: 2026, month: 3, day: 2)))

        #expect(forecast.cycleLength == 30)
        #expect(forecast.nextPeriodStart == expectedNextStart)
        #expect(!forecast.usedTypicalFallback)
    }

    @Test func cycleEntryRoundTripsAsLocalCalendarDateAndReadsLegacyTimestamp() throws {
        var localCalendar = Calendar(identifier: .gregorian)
        localCalendar.timeZone = .current
        let selectedDate = try #require(localCalendar.date(from: DateComponents(year: 2026, month: 3, day: 1)))
        let entry = CycleEntry(date: selectedDate, isPeriodStart: true, isPeriodEnd: false)
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let payload = try encoder.encode(entry)
        let row = try #require(JSONSerialization.jsonObject(with: payload) as? [String: Any])
        #expect(row["date"] as? String == "2026-03-01")

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let restored = try decoder.decode(CycleEntry.self, from: payload)
        let restoredDay = localCalendar.dateComponents([.year, .month, .day], from: restored.date)
        #expect(restoredDay.year == 2026)
        #expect(restoredDay.month == 3)
        #expect(restoredDay.day == 1)

        let legacy = Data("{\"id\":\"legacy\",\"date\":\"2026-03-01T00:00:00.000Z\",\"isPeriodStart\":true,\"isPeriodEnd\":false}".utf8)
        let restoredLegacy = try decoder.decode(CycleEntry.self, from: legacy)
        let expectedLegacyInstant = try #require(ISO8601DateFormatter().date(from: "2026-03-01T00:00:00Z"))
        let expectedLegacyDay = localCalendar.dateComponents([.year, .month, .day], from: expectedLegacyInstant)
        let restoredLegacyDay = localCalendar.dateComponents([.year, .month, .day], from: restoredLegacy.date)
        #expect(restoredLegacy.id == "legacy")
        #expect(restoredLegacyDay.year == expectedLegacyDay.year)
        #expect(restoredLegacyDay.month == expectedLegacyDay.month)
        #expect(restoredLegacyDay.day == expectedLegacyDay.day)
    }

    @Test func cyclePredictionSupportsWeeklyCycles() throws {
        let calendar = utcCalendar
        let firstStart = try #require(calendar.date(from: DateComponents(year: 2026, month: 1, day: 1)))
        let secondStart = try #require(calendar.date(from: DateComponents(year: 2026, month: 1, day: 8)))
        let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 1, day: 9)))
        let entries = [firstStart, secondStart].map {
            CycleEntry(
                date: $0,
                isPeriodStart: true,
                isPeriodEnd: false,
                isPeriodDay: true,
                flow: .medium,
                symptoms: nil,
                note: nil
            )
        }
        let settings = CycleSettings(
            typicalCycleLength: 28,
            typicalPeriodLength: 5,
            predictionMethod: .lastCycle,
            isConfigured: true
        )

        let forecast = try #require(CyclePredictor.forecast(
            entries: entries,
            settings: settings,
            calendar: calendar,
            now: now
        ))
        let expectedNextStart = try #require(calendar.date(from: DateComponents(year: 2026, month: 1, day: 15)))

        #expect(forecast.cycleLength == 7)
        #expect(forecast.nextPeriodStart == expectedNextStart)
        #expect(!forecast.usedTypicalFallback)
    }

    @Test func cyclePredictionRollsOldAnchorForward() throws {
        let calendar = utcCalendar
        let start = try #require(calendar.date(from: DateComponents(year: 2026, month: 1, day: 1)))
        let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 3, day: 5)))
        let entry = CycleEntry(
            date: start,
            isPeriodStart: true,
            isPeriodEnd: false,
            isPeriodDay: true,
            flow: .light,
            symptoms: nil,
            note: nil
        )
        let settings = CycleSettings(typicalCycleLength: 28, typicalPeriodLength: 5, isConfigured: true)

        let forecast = try #require(CyclePredictor.forecast(
            entries: [entry],
            settings: settings,
            calendar: calendar,
            now: now
        ))
        let expectedNextStart = try #require(calendar.date(from: DateComponents(year: 2026, month: 3, day: 26)))

        #expect(forecast.nextPeriodStart == expectedNextStart)
        #expect(forecast.currentCycleDay == 8)
    }

    @Test func cyclePredictionKeepsARecentlyOverduePeriodVisible() throws {
        let calendar = utcCalendar
        let start = try #require(calendar.date(from: DateComponents(year: 2026, month: 1, day: 1)))
        let now = try #require(calendar.date(from: DateComponents(year: 2026, month: 1, day: 30)))
        let entry = CycleEntry(
            date: start,
            isPeriodStart: true,
            isPeriodEnd: false,
            isPeriodDay: true,
            flow: .medium,
            symptoms: nil,
            note: nil
        )
        let settings = CycleSettings(typicalCycleLength: 28, typicalPeriodLength: 5, isConfigured: true)

        let forecast = try #require(CyclePredictor.forecast(
            entries: [entry],
            settings: settings,
            calendar: calendar,
            now: now
        ))
        let expectedStart = try #require(calendar.date(from: DateComponents(year: 2026, month: 1, day: 29)))

        #expect(forecast.nextPeriodStart == expectedStart)
        #expect(forecast.periodDelayDays == 1)
        #expect(forecast.currentCycleDay == 30)
    }

    @Test func exportRoundTripPreservesCycleSettings() throws {
        let settings = CycleSettings(
            typicalCycleLength: 31,
            typicalPeriodLength: 6,
            predictionMethod: .lastCycle,
            showsFertileWindow: false,
            isConfigured: true
        )
        let snapshot = MHDDataSnapshot(
            profile: nil,
            events: [],
            measurements: [],
            documents: [],
            cycleSettings: settings
        )

        let data = try MHDExportService().exportData(snapshot: snapshot)
        let imported = try MHDExportService().importSnapshot(from: data)

        #expect(imported.cycleSettings == settings)
    }

    @Test func exportRoundTripPreservesEnhancedModuleData() throws {
        let fixedDate = Date(timeIntervalSince1970: 1_000)
        let medication = MedicationStatement(
            id: "med_test",
            name: "Test",
            dose: "1 compressa",
            schedule: "08:00",
            scheduleStyle: .fixedTimes,
            scheduledTimes: [MedicationTime(hour: 8, minute: 0)],
            stockQuantity: 12,
            refillThreshold: 3,
            createdAt: fixedDate,
            updatedAt: fixedDate
        )
        let episode = ConditionEpisode(
            id: "episode_test",
            title: "Recupero",
            startedAt: fixedDate,
            createdAt: fixedDate,
            updatedAt: fixedDate
        )
        let snapshot = MHDDataSnapshot(
            profile: nil,
            events: [],
            measurements: [],
            documents: [],
            sleepSettings: SleepSettings(goalMinutes: 450),
            appointments: [
                AppointmentRecord(
                    title: "Controllo",
                    scheduledAt: fixedDate,
                    questions: ["Qual e il prossimo passo?"],
                    followUpAt: fixedDate,
                    createdAt: fixedDate,
                    updatedAt: fixedDate
                )
            ],
            medications: [medication],
            medicationDoseEvents: [
                MedicationDoseEvent(
                    medicationId: medication.id,
                    scheduledAt: fixedDate,
                    recordedAt: fixedDate,
                    status: .taken,
                    createdAt: fixedDate
                )
            ],
            conditionEpisodes: [episode],
            conditionCheckIns: [
                ConditionCheckIn(
                    episodeId: episode.id,
                    recordedAt: fixedDate,
                    severity: 4,
                    change: .better,
                    createdAt: fixedDate
                )
            ]
        )

        let data = try MHDExportService().exportData(snapshot: snapshot)
        let exportFile = try MHDDateCoding.decoder.decode(MHDExportFile.self, from: data)
        let imported = try MHDExportService().importSnapshot(from: data)

        #expect(imported == snapshot)
        #expect(exportFile.metadata.recordCounts.medicationDoseEvents == 1)
        #expect(exportFile.metadata.recordCounts.conditionCheckIns == 1)
        #expect(exportFile.metadata.recordCounts.totalRecords == 5)
    }

    @Test func exportRoundTripPreservesSpecialtyModuleEvents() throws {
        let types: [EventType] = [.allergy, .visionPrescription, .digestiveHealth, .dentalCare]
        let events = types.enumerated().map { index, type in
            let date = Date(timeIntervalSince1970: Double(index + 1) * 1_000)
            return HealthEvent(
                id: "specialty_\(index)",
                type: type,
                occurredAt: date,
                description: type.label,
                tags: ["kind=test", "value=\(index)"],
                createdAt: date,
                updatedAt: date
            )
        }
        let snapshot = MHDDataSnapshot(profile: nil, events: events, measurements: [], documents: [])

        let data = try MHDExportService().exportData(snapshot: snapshot)
        let imported = try MHDExportService().importSnapshot(from: data)

        #expect(imported.events == events)
        #expect(Set(imported.events.map(\.type)) == Set(types))
    }

    @Test func labReportParserExtractsValueRangeAndFlags() {
        let text = """
        Glucosio 112 mg/dL 70 - 100 H
        Emoglobina 14,2 g/dL 13,0 - 17,5
        Ferritina 18 ng/mL 30 - 400
        """

        let results = LabReportParser().parse(text)

        #expect(results.count == 3)
        #expect(results[0].analyte == "Glucosio")
        #expect(results[0].value == 112)
        #expect(results[0].flag == "Alto")
        #expect(results[1].value == 14.2)
        #expect(results[2].flag == "Basso")
    }

    @MainActor
    @Test func dailyHealthKitStepAggregateReplacesRawSamplesForTheSameDay() async throws {
        let store = HealthDataStore(testingSnapshot: .empty)

        let day = try #require(
            utcCalendar.date(from: DateComponents(year: 2040, month: 1, day: 12))
        )
        let nextDay = try #require(utcCalendar.date(byAdding: .day, value: 1, to: day))
        let rawSamples = [
            Measurement(
                id: "raw_steps_phone",
                type: .stepCount,
                value: 600,
                unit: "count",
                measuredAt: day.addingTimeInterval(3_600),
                source: .appleHealth,
                sourceRecordId: "raw_steps_phone"
            ),
            Measurement(
                id: "raw_steps_watch",
                type: .stepCount,
                value: 800,
                unit: "count",
                measuredAt: day.addingTimeInterval(4_200),
                source: .appleHealth,
                sourceRecordId: "raw_steps_watch"
            )
        ]
        store.mergeAppleHealthMeasurements(rawSamples)

        let aggregate = Measurement(
            id: "daily_steps",
            type: .stepCount,
            value: 1_050,
            unit: "count",
            measuredAt: day,
            note: "aggregation=healthkit_daily_cumulative_sum",
            source: .appleHealth,
            sourceRecordId: "healthkit_daily_steps_2040-01-12"
        )
        store.mergeAppleHealthMeasurements([aggregate])

        let stored = store.measurements(for: .stepCount, from: day, to: nextDay)
        let onlyValue = try #require(stored.first)
        #expect(stored.count == 1)
        #expect(onlyValue.value == 1_050)
        #expect(onlyValue.sourceRecordId == "healthkit_daily_steps_2040-01-12")
    }

    private var utcCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }
}
