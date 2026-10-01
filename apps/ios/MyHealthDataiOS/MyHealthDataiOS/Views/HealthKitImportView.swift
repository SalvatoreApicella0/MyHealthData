import SwiftUI
import HealthKit

private enum HealthImportRange: String, CaseIterable, Identifiable {
    case month = "30 giorni"
    case year = "1 anno"
    case all = "Tutto"

    var id: String { rawValue }
    var days: Int? {
        switch self {
        case .month: 30
        case .year: 365
        case .all: nil
        }
    }
}

struct HealthKitImportView: View {
    @Environment(HealthDataStore.self) private var store
    private let importer = HealthKitImporter()

    @State private var isImporting = false
    @State private var isRequestingPermissions = false
    @State private var statusMessage = String(localized: "Apple Health import is optional and runs only after you grant permission.")
    @State private var importRange: HealthImportRange = .month
    @State private var importProgress: HealthKitImportProgress?
    @State private var importTask: Task<Void, Never>?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack(spacing: 16) {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 28, weight: .semibold))
                        .foregroundStyle(MHDPalette.coral)
                        .frame(width: 62, height: 62)
                        .mhdGlassCircle(tint: MHDPalette.coral.opacity(0.14))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Apple Health")
                            .font(.largeTitle.bold())
                        Text("Import locale, privato e sotto il tuo controllo")
                            .foregroundStyle(.secondary)
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    Label("Permessi", systemImage: "lock.shield.fill")
                        .font(.headline)
                        .foregroundStyle(Color.mhdPrimary)

                    Text(String(
                        format: NSLocalizedString("The app requests read access for %d HealthKit data types. iOS may not show categories you already answered; you can always adjust access in the Health app or iOS Settings.", comment: ""),
                        importer.requestedReadableTypeCount
                    ))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                    Button {
                        Task { await requestPermissions() }
                    } label: {
                        if isRequestingPermissions {
                            ProgressView()
                        } else {
                            Label("Rivedi i permessi", systemImage: "arrow.clockwise")
                        }
                    }
                    .mhdGlassButton()
                    .disabled(isRequestingPermissions || isImporting)
                }
                .padding(18)
                .mhdGlassPanel(tint: Color.mhdPrimary.opacity(0.05))

                VStack(alignment: .leading, spacing: 12) {
                    Text("Intervallo")
                        .font(.headline)
                    Picker("Intervallo da importare", selection: $importRange) {
                        ForEach(HealthImportRange.allCases) { range in
                            Text(range.rawValue).tag(range)
                        }
                    }
                    .pickerStyle(.segmented)
                    Text(importRange == .all ? "La cronologia completa può richiedere più tempo. L’import resta limitato per singola categoria per proteggere memoria e batteria." : "Puoi ampliare l’intervallo in qualsiasi momento senza duplicare i record.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(18)
                .mhdGlassPanel()

                VStack(alignment: .leading, spacing: 14) {
                    if let importProgress {
                        ProgressView(value: importProgress.fractionCompleted)
                            .tint(MHDPalette.coral)
                        HStack {
                            Text(importProgress.currentType)
                                .lineLimit(1)
                            Spacer()
                            Text("\(importProgress.processedTypes)/\(importProgress.totalTypes)")
                                .monospacedDigit()
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }

                    Text(statusMessage)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    HStack(spacing: 12) {
                        Button {
                            importTask = Task { await importHealthData() }
                        } label: {
                            Label(isImporting ? "Importazione..." : "Autorizza e importa", systemImage: "square.and.arrow.down")
                        }
                        .mhdGlassButton(prominent: true)
                        .disabled(isImporting)

                        if isImporting {
                            Button("Interrompi") {
                                importTask?.cancel()
                            }
                            .mhdGlassButton()
                        }
                    }
                }
                .padding(18)
                .mhdGlassPanel(tint: MHDPalette.coral.opacity(0.05))

                VStack(alignment: .leading, spacing: 12) {
                    Text("Importati")
                        .font(.title2.bold())
                    if store.appleHealthMeasurements.isEmpty {
                        ContentUnavailableView("Nessun dato Apple Health importato", systemImage: "heart.circle")
                            .frame(maxWidth: .infinity, minHeight: 180)
                    } else {
                        ForEach(store.appleHealthMeasurements.prefix(20)) { measurement in
                            MeasurementRow(measurement: measurement)
                            if measurement.id != store.appleHealthMeasurements.prefix(20).last?.id {
                                Divider()
                            }
                        }
                    }
                }
                .padding(18)
                .mhdGlassPanel()
            }
            .frame(maxWidth: 820)
            .padding()
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Apple Health")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear { importTask?.cancel() }
    }

    @MainActor
    private func requestPermissions() async {
        isRequestingPermissions = true
        defer { isRequestingPermissions = false }

        do {
            let summary = try await importer.requestAuthorization()
            statusMessage = String(format: NSLocalizedString("Requested permission for %d Apple Health data types.", comment: ""), summary.requestedReadTypes)
        } catch {
            statusMessage = error.localizedDescription
        }
    }

    @MainActor
    private func importHealthData() async {
        isImporting = true
        importProgress = nil
        defer {
            isImporting = false
            importTask = nil
        }

        do {
            _ = try await importer.requestAuthorization()
            let summary: HealthKitImportSummary
            if importRange == .all {
                let start = await importer.earliestReadableSampleDate()
                    ?? Calendar.current.date(byAdding: .day, value: -30, to: .now)
                    ?? .now
                store.beginBulkAppleHealthImport()
                defer { store.finishBulkAppleHealthImport() }
                summary = try await importer.importMeasurementsInWindows(
                    from: start,
                    maxSamplesPerType: HKObjectQueryNoLimit,
                    progress: { importProgress = $0 },
                    onWindow: { measurements in
                        store.mergeAppleHealthMeasurements(measurements)
                    }
                )
            } else {
                let result = try await importer.importMeasurements(
                    days: importRange.days,
                    maxSamplesPerType: 1_500
                ) {
                    importProgress = $0
                }
                // A partial import must never erase older Apple Health records.
                store.mergeAppleHealthMeasurements(result.measurements)
                summary = result.summary
            }
            statusMessage = importMessage(summary)
        } catch {
            statusMessage = Task.isCancelled ? "Importazione interrotta. I dati già presenti non sono stati modificati." : error.localizedDescription
        }
    }

    private func importMessage(_ summary: HealthKitImportSummary) -> String {
        guard summary.importedMeasurements > 0 else {
            return "Nessun dato accessibile. In Salute > Profilo > App > MyHealthData verifica le categorie consentite e l'intervallo di accesso."
        }
        let oldest = summary.oldestSampleDate?.formatted(.dateTime.day().month().year()) ?? "-"
        let limitNote = summary.limitedTypes > 0 ? " \(summary.limitedTypes) categorie hanno raggiunto il limite di sicurezza." : ""
        return "Importati \(summary.importedMeasurements) record da \(summary.dataTypesWithSamples) categorie, a partire dal \(oldest).\(limitNote)"
    }
}
