import SwiftUI

private enum RootTab: Hashable {
    case data
    case calendar
    case documents
    case settings
}

struct RootView: View {
    @AppStorage("hasSeenHealthKitPermissionPrompt") private var hasSeenHealthKitPermissionPrompt = false
    @AppStorage("deepLink.pendingAction") private var pendingDeepLinkAction = ""
    @State private var showsHealthKitPermissionPrompt = false
    @State private var selectedTab: RootTab = .data

    var body: some View {
        Group {
            if #available(iOS 26.0, *) {
                tabView.tabBarMinimizeBehavior(.onScrollDown)
            } else {
                tabView
            }
        }
        .tint(.mhdPrimary)
        .buttonBorderShape(.capsule)
        .onAppear {
            if !hasSeenHealthKitPermissionPrompt {
                showsHealthKitPermissionPrompt = true
            }
        }
        .sheet(isPresented: $showsHealthKitPermissionPrompt) {
            HealthKitPermissionOnboardingView {
                hasSeenHealthKitPermissionPrompt = true
            }
        }
        .onOpenURL { url in
            if url.host == "smart-scale" {
                pendingDeepLinkAction = "smartScale"
            }
            selectedTab = .data
        }
    }

    private var tabView: some View {
        TabView(selection: $selectedTab) {
            Tab("Dati", systemImage: "list.bullet.rectangle.fill", value: .data) {
                NavigationStack { DataScrollView() }
            }

            Tab("Calendario", systemImage: "calendar", value: .calendar) {
                NavigationStack { EnhancedVisitsDashboardView() }
            }

            Tab("Documenti", systemImage: "folder.fill", value: .documents) {
                NavigationStack { DocumentsDashboardView() }
            }

            Tab("Impostazioni", systemImage: "gearshape.fill", value: .settings) {
                NavigationStack { MoreView() }
            }
        }
    }
}

struct HealthKitPermissionOnboardingView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var isRequesting = false
    @State private var statusMessage: String?
    @State private var importProgress: HealthKitImportProgress?
    @State private var importTask: Task<Void, Never>?

    var onFinished: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                Image(systemName: "heart.text.square.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(Color.mhdPrimary)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Collega Apple Health")
                        .font(.largeTitle.bold())
                    Text("MyHealthData importa attività, parametri vitali, mobilità, sonno, alimentazione e misure corporee nel vault locale cifrato.")
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 12) {
                    PermissionBenefitRow(icon: "lock.shield", title: "Locale e cifrato", subtitle: "I record restano sul dispositivo finche' non decidi di esportarli.")
                    PermissionBenefitRow(icon: "heart.circle", title: "Permessi sotto controllo", subtitle: "Scegli quali categorie permettere all'app di leggere.")
                    PermissionBenefitRow(icon: "arrow.clockwise", title: "Modificabile in ogni momento", subtitle: "Puoi rivedere i permessi dalle Impostazioni dell'app.")
                }

                if let statusMessage {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if let importProgress {
                    VStack(alignment: .leading, spacing: 7) {
                        ProgressView(value: importProgress.fractionCompleted)
                            .tint(Color.mhdPrimary)
                        HStack {
                            Text(importProgress.currentType)
                            Spacer()
                            Text("\(importProgress.processedTypes)/\(importProgress.totalTypes)")
                                .monospacedDigit()
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .padding(14)
                    .mhdGlassCapsule(tint: Color.mhdPrimary.opacity(0.08))
                }

                Spacer()

                Button {
                    importTask = Task { await requestPermissions() }
                } label: {
                    if isRequesting {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Label("Continua", systemImage: "heart.circle")
                            .frame(maxWidth: .infinity)
                    }
                }
                .mhdGlassButton(prominent: true)
                .controlSize(.large)
                .disabled(isRequesting)

                Button(isRequesting ? "Continua senza importare" : "Non ora") {
                    importTask?.cancel()
                    onFinished()
                    dismiss()
                }
                .frame(maxWidth: .infinity)
            }
            .padding()
            .navigationTitle("Apple Health")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    @MainActor
    private func requestPermissions() async {
        isRequesting = true
        defer { isRequesting = false }

        do {
            let importer = HealthKitImporter()
            let summary = try await importer.requestAuthorization()
            statusMessage = "Permessi richiesti per \(summary.requestedReadTypes) categorie. Importazione in corso..."
            let result = try await importer.importMeasurements(days: 30, maxSamplesPerType: 1_000) {
                importProgress = $0
            }
            store.replaceAppleHealthMeasurements(with: result.measurements)
            guard result.summary.importedMeasurements > 0 else {
                statusMessage = "Nessun dato accessibile. Apri Salute > Profilo > App > MyHealthData e verifica categorie e intervallo consentiti."
                return
            }
            statusMessage = "Importati \(result.summary.importedMeasurements) record Apple Health."
            onFinished()
            dismiss()
        } catch {
            if !Task.isCancelled {
                statusMessage = error.localizedDescription
            }
        }
    }
}

struct PermissionBenefitRow: View {
    var icon: String
    var title: LocalizedStringKey
    var subtitle: LocalizedStringKey

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(Color.mhdPrimary)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

extension Color {
    static let mhdPrimary = Color(red: 0.07, green: 0.43, blue: 0.48)
    static let mhdSecondary = Color(red: 0.16, green: 0.27, blue: 0.56)
    static let mhdWarm = Color(red: 0.97, green: 0.67, blue: 0.27)
    static let mhdInk = Color(red: 0.06, green: 0.09, blue: 0.12)
    static let mhdSurface = Color(red: 0.96, green: 0.98, blue: 0.98)
}
