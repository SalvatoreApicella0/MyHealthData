import SwiftUI

/// Pairing and sync. The local Hub is the only mechanism here: one clear state
/// card when connected, one clear action when not.
struct SelfHostedSyncView: View {
    @Environment(HealthDataStore.self) private var store
    @State private var hubPairingCode = ""
    @State private var showManualCode = false
    @State private var showDisconnectConfirm = false
    @State private var isHubConfigured = false
    @State private var isWorking = false
    @State private var message: String?
    @State private var showHubScanner = false
    @State private var hubAddress = ""
    @State private var discoveredHubs = HubDiscoveryService()
    private let hubClient = HubSyncClient()

    var body: some View {
        Form {
            hubSection

            if isHubConfigured {
                Section {
                    Button("Scollega questo iPhone", systemImage: "link.badge.minus", role: .destructive) {
                        showDisconnectConfirm = true
                    }
                } footer: {
                    Text("Scollegare cancella la chiave del dispositivo dall'iPhone. Sul Mac il dispositivo resta nell'elenco finché non lo revochi da Dispositivi.")
                }
            }

            if !isHubConfigured, !discoveredHubs.hubs.isEmpty {
                Section {
                    ForEach(discoveredHubs.hubs) { hub in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(hub.title).font(.body.monospaced())
                                if let subtitle = hub.subtitle {
                                    Text(subtitle).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            Button("Collega") { showHubScanner = true }
                                .buttonStyle(.bordered)
                        }
                    }
                } header: {
                    Text("Hub sulla rete locale")
                } footer: {
                    Text("Serve comunque il QR monouso del Mac: è quello che autorizza il dispositivo.")
                }
            }

            if let message {
                Section {
                    Label(message, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            }
        }
        .navigationTitle("Sync")
        .navigationBarTitleDisplayMode(.inline)
        .overlay {
            if isWorking {
                ProgressView("Sincronizzazione…")
                    .padding(20)
                    .mhdGlassPanel(tint: Color.mhdPrimary.opacity(0.08))
            }
        }
        #if os(iOS) && !targetEnvironment(macCatalyst)
        .sheet(isPresented: $showHubScanner) {
            NavigationStack {
                HubPairingScannerView(onCode: { value in
                    hubPairingCode = value
                    showHubScanner = false
                    Task { await joinHub() }
                }, onFailure: { error in
                    showHubScanner = false
                    message = error
                })
                .ignoresSafeArea()
                .navigationTitle("Scansiona il QR")
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Annulla") { showHubScanner = false } } }
            }
        }
        #endif
        .confirmationDialog("Scollegare il Hub?", isPresented: $showDisconnectConfirm, titleVisibility: .visible) {
            Button("Scollega", role: .destructive) { disconnectHub() }
            Button("Annulla", role: .cancel) {}
        } message: {
            Text("Dovrai scansionare un nuovo QR dal Mac per risincronizzare.")
        }
        .task {
            refreshState()
            discoveredHubs.start()
        }
        .onDisappear { discoveredHubs.stop() }
    }

    @ViewBuilder private var hubSection: some View {
        Section {
            if isHubConfigured {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Label("Collegato", systemImage: "checkmark.circle.fill")
                            .font(.headline)
                            .foregroundStyle(.green)
                        if !hubAddress.isEmpty {
                            Text(hubAddress)
                                .font(.footnote.monospaced())
                                .foregroundStyle(.secondary)
                        }
                        if let status = store.hubSyncStatus {
                            Text(status)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer(minLength: 0)
                    if store.isHubSyncing { ProgressView() }
                }
                if store.isHubSyncing {
                    if let progress = store.hubSyncProgress, progress.total > 0 {
                        ProgressView(value: Double(progress.completed), total: Double(progress.total))
                    }
                    Button("Annulla", systemImage: "stop.circle", role: .cancel) {
                        store.cancelHubSync()
                    }
                } else {
                    Button {
                        store.syncHub()
                    } label: {
                        Label("Sincronizza ora", systemImage: "arrow.triangle.2.circlepath")
                            .frame(maxWidth: .infinity)
                    }
                    .mhdGlassButton(prominent: true)
                }
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Label("Collega questo iPhone al Mac", systemImage: "desktopcomputer")
                        .font(.headline)
                    Text("Sul Mac apri MyHealthData Hub → Dispositivi → Genera codice, poi scansiona il QR qui. I dati restano cifrati e viaggiano solo sulla tua rete locale.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 2)

                #if os(iOS) && !targetEnvironment(macCatalyst)
                Button {
                    showHubScanner = true
                } label: {
                    Label("Scansiona il QR", systemImage: "qrcode.viewfinder")
                        .frame(maxWidth: .infinity)
                }
                .mhdGlassButton(prominent: true)
                .disabled(isWorking)
                #endif

                DisclosureGroup("Incolla il codice manualmente", isExpanded: $showManualCode) {
                    TextEditor(text: $hubPairingCode)
                        .frame(minHeight: 84)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Collega") { Task { await joinHub() } }
                        .disabled(isWorking || hubPairingCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        } header: {
            Text("MyHealthData Hub")
        } footer: {
            if !isHubConfigured {
                Text("Il codice è monouso e scade in pochi minuti.")
            }
        }
    }

    private func refreshState() {
        isHubConfigured = hubClient.isConfigured()
        if let value = hubClient.connectedEndpoint(), let url = URL(string: value) {
            hubAddress = url.port.map { "\(url.host ?? value):\($0)" } ?? (url.host ?? value)
        } else {
            hubAddress = ""
        }
    }

    @MainActor private func disconnectHub() {
        hubClient.disconnect()
        message = nil
        refreshState()
    }

    @MainActor private func joinHub() async {
        isWorking = true; defer { isWorking = false }
        do {
            let data = Data(hubPairingCode.trimmingCharacters(in: .whitespacesAndNewlines).utf8)
            try await hubClient.join(code: try JSONDecoder().decode(HubSyncClient.PairingCode.self, from: data))
            hubPairingCode = ""; message = nil; refreshState()
            store.syncHub()
        } catch { message = error.localizedDescription }
    }
}
