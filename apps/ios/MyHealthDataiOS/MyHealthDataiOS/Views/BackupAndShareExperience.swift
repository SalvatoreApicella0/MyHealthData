import SwiftUI
import UniformTypeIdentifiers

struct EnhancedBackupDashboardView: View {
    @Environment(HealthDataStore.self) private var store
    @State private var exportDocument = MHDExportDocument()
    @State private var backupDocument = MHDZipDocument()
    @State private var isExporting = false
    @State private var isImporting = false
    @State private var statusMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                backupHero
                backupAction(
                    title: "Crea backup completo",
                    subtitle: "Include tutti i record del vault",
                    icon: "square.and.arrow.up",
                    tint: .teal
                ) {
                    Task {
                        backupDocument = await store.exportBackupDocument()
                        isExporting = true
                    }
                }
                backupAction(
                    title: "Ripristina da file",
                    subtitle: "Verifica il pacchetto prima di sostituire i dati",
                    icon: "square.and.arrow.down",
                    tint: .blue
                ) { isImporting = true }

                VStack(alignment: .leading, spacing: 8) {
                    Label("Proteggi il file esportato", systemImage: "lock.trianglebadge.exclamationmark")
                        .font(.headline)
                    Text("Il vault sul dispositivo è cifrato. Il file esportato viene controllato per rilevare modifiche, ma non è cifrato: conservalo in uno spazio protetto.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(14)
                .background(Color.orange.opacity(0.10), in: Capsule())

                if let statusMessage {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
        }
        .navigationTitle("Backup")
        .navigationBarTitleDisplayMode(.inline)
        .fileExporter(
            isPresented: $isExporting,
            document: backupDocument,
            contentType: .mhdZip,
            defaultFilename: "myhealthdata-\(Date.now.formatted(.iso8601.year().month().day())).mhdzip"
        ) { result in
            switch result {
            case .success: statusMessage = "Backup esportato."
            case .failure(let error): statusMessage = error.localizedDescription
            }
        }
        .fileImporter(
            isPresented: $isImporting,
            allowedContentTypes: [.mhdZip, .json],
            allowsMultipleSelection: false,
            onCompletion: importBackup
        )
    }

    private var backupHero: some View {
        HStack(spacing: 16) {
            Image(systemName: "externaldrive.fill.badge.checkmark")
                .font(.system(size: 30))
                .foregroundStyle(.teal)
                .frame(width: 58, height: 58)
                .background(Color.teal.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text("Il tuo vault").font(.caption.bold()).foregroundStyle(.teal)
                Text("\(store.snapshot.totalRecordCount) record").font(.largeTitle.bold())
                Text("Esporta e ripristina senza creare un account.")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .mhdGlassPanel(tint: Color.teal.opacity(0.06))
    }

    private func backupAction(
        title: String,
        subtitle: String,
        icon: String,
        tint: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.headline)
                    .foregroundStyle(tint)
                    .frame(width: 40, height: 40)
                    .background(tint.opacity(0.12), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.headline)
                    Text(subtitle).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.tertiary)
            }
            .padding(14)
            .mhdGlassCapsule(tint: tint.opacity(0.05), interactive: true)
        }
        .buttonStyle(.plain)
    }

    private func importBackup(_ result: Result<[URL], any Error>) {
        do {
            guard let url = try result.get().first else { return }
            let didAccess = url.startAccessingSecurityScopedResource()
            defer { if didAccess { url.stopAccessingSecurityScopedResource() } }
            let data = try Data(contentsOf: url)
            if url.pathExtension.lowercased() == "mhdzip" {
                Task {
                    await store.importBackup(from: data)
                    statusMessage = store.lastError ?? "Backup importato e verificato."
                }
            } else {
                store.importSnapshot(from: data)
                statusMessage = store.lastError ?? "Backup importato e verificato."
            }
        } catch {
            statusMessage = error.localizedDescription
        }
    }
}

private enum CareShareRange: String, CaseIterable, Identifiable {
    case month, threeMonths, year, all
    var id: String { rawValue }
    var title: String {
        switch self {
        case .month: "30 giorni"
        case .threeMonths: "90 giorni"
        case .year: "1 anno"
        case .all: "Tutto"
        }
    }
    var cutoff: Date? {
        switch self {
        case .month: Calendar.current.date(byAdding: .day, value: -30, to: .now)
        case .threeMonths: Calendar.current.date(byAdding: .day, value: -90, to: .now)
        case .year: Calendar.current.date(byAdding: .year, value: -1, to: .now)
        case .all: nil
        }
    }
}

struct EnhancedShareDashboardView: View {
    @Environment(HealthDataStore.self) private var store
    @State private var range: CareShareRange = .threeMonths
    @State private var includeProfile = false
    @State private var includeEvents = true
    @State private var includeMeasurements = true
    @State private var includeDocuments = true
    @State private var includeModules = true
    @State private var exportDocument = MHDExportDocument()
    @State private var isExporting = false
    @State private var statusMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("PACCHETTO SELETTIVO").font(.caption.bold()).foregroundStyle(.blue)
                    Text("Scegli cosa condividere").font(.largeTitle.bold())
                    Text("L’anteprima mostra esattamente quanti record finiranno nel file.")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .mhdGlassPanel(tint: Color.blue.opacity(0.05))

                Picker("Periodo", selection: $range) {
                    ForEach(CareShareRange.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)

                VStack(spacing: 12) {
                    shareToggle("Eventi e sintomi", count: selected.events.count, value: $includeEvents)
                    shareToggle("Misure e trend", count: selected.measurements.count, value: $includeMeasurements)
                    shareToggle("Documenti", count: selected.documents.count, value: $includeDocuments)
                    shareToggle("Moduli salute", count: moduleCount, value: $includeModules)
                    shareToggle("Profilo", count: selected.profile == nil ? 0 : 1, value: $includeProfile)
                }
                .padding(14)
                .mhdGlassPanel()

                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Anteprima").font(.caption).foregroundStyle(.secondary)
                        Text("\(selected.totalRecordCount) record").font(.title2.bold())
                    }
                    Spacer()
                    Button("Esporta") { exportSelection() }
                        .mhdGlassButton(prominent: true)
                        .disabled(selected.totalRecordCount == 0)
                }
                .padding(14)
                .mhdGlassCapsule(tint: Color.blue.opacity(0.10))

                Text("Il file esportato non è cifrato. Controlla destinatario e canale prima di inviarlo.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if let statusMessage { Text(statusMessage).font(.footnote).foregroundStyle(.secondary) }
            }
            .padding()
        }
        .navigationTitle("Condividi")
        .navigationBarTitleDisplayMode(.inline)
        .fileExporter(
            isPresented: $isExporting,
            document: exportDocument,
            contentType: .json,
            defaultFilename: "myhealthdata-condivisione-\(Date.now.formatted(.iso8601.year().month().day())).mhd.json"
        ) { result in
            switch result {
            case .success: statusMessage = "Pacchetto esportato."
            case .failure(let error): statusMessage = error.localizedDescription
            }
        }
    }

    private func shareToggle(_ title: String, count: Int, value: Binding<Bool>) -> some View {
        Toggle(isOn: value) {
            HStack {
                Text(title)
                Spacer()
                Text("\(count)").foregroundStyle(.secondary).monospacedDigit()
            }
        }
    }

    private var selected: MHDDataSnapshot {
        let snapshot = store.snapshot
        return MHDDataSnapshot(
            profile: includeProfile ? snapshot.profile : nil,
            events: includeEvents ? snapshot.events.filter { includes($0.occurredAt) } : [],
            measurements: includeMeasurements ? snapshot.measurements.filter { includes($0.measuredAt) } : [],
            documents: includeDocuments ? snapshot.documents.filter { includes(documentDate($0)) } : [],
            cycleEntries: includeModules ? snapshot.cycleEntries.filter { includes($0.date) } : [],
            cycleSettings: snapshot.cycleSettings,
            sleepSessions: includeModules ? snapshot.sleepSessions.filter { includes($0.startAt) } : [],
            sleepSettings: snapshot.sleepSettings,
            appointments: includeModules ? snapshot.appointments.filter { includes($0.scheduledAt) } : [],
            medications: includeModules ? snapshot.medications.filter { includes($0.updatedAt) } : [],
            medicationDoseEvents: includeModules ? snapshot.medicationDoseEvents.filter { includes($0.recordedAt) } : [],
            conditionEpisodes: includeModules ? snapshot.conditionEpisodes.filter { includes($0.startedAt) } : [],
            conditionCheckIns: includeModules ? snapshot.conditionCheckIns.filter { includes($0.recordedAt) } : [],
            labResults: includeModules ? snapshot.labResults.filter { includes($0.collectedAt) } : []
        )
    }

    private var moduleCount: Int {
        selected.cycleEntries.count + selected.sleepSessions.count + selected.appointments.count
            + selected.medications.count + selected.medicationDoseEvents.count
            + selected.conditionEpisodes.count + selected.conditionCheckIns.count + selected.labResults.count
    }

    private func includes(_ date: Date?) -> Bool {
        guard let cutoff = range.cutoff else { return true }
        guard let date else { return true }
        return date >= cutoff
    }

    private func documentDate(_ document: HealthDocument) -> Date? {
        MHDDocumentDateCoding.date(from: document.documentDate)
    }

    private func exportSelection() {
        do {
            exportDocument = MHDExportDocument(data: try MHDExportService().exportData(snapshot: selected))
            isExporting = true
        } catch {
            statusMessage = error.localizedDescription
        }
    }
}
