import SwiftUI

struct MoreView: View {
    @AppStorage("measurementSystem") private var measurementSystem = "metric"

    var body: some View {
        List {
            Section("Preferenze") {
                Picker("Sistema di misura", selection: $measurementSystem) {
                    Text("Metrico (kg, cm)").tag("metric")
                    Text("Imperiale (lb, in)").tag("imperial")
                }

                NavigationLink {
                    ProfileView()
                } label: {
                    SettingsRow(
                        icon: "person.crop.circle.fill",
                        tint: .mhdPrimary,
                        title: "Profilo",
                        subtitle: "Informazioni personali e preferenze"
                    )
                }

                NavigationLink {
                    HealthKitImportView()
                } label: {
                    SettingsRow(
                        icon: "heart.circle.fill",
                        tint: .red,
                        title: "Apple Health",
                        subtitle: "Permessi e importazione"
                    )
                }

            }

            Section("I tuoi dati") {
                NavigationLink {
                    SelfHostedSyncView()
                } label: {
                    SettingsRow(
                        icon: "arrow.triangle.2.circlepath",
                        tint: .purple,
                        title: "Sync personale",
                        subtitle: "Server self-hosted, opzionale e cifrato"
                    )
                }
                NavigationLink {
                    EnhancedBackupDashboardView()
                } label: {
                    SettingsRow(
                        icon: "externaldrive.fill.badge.checkmark",
                        tint: .teal,
                        title: "Backup e ripristino",
                        subtitle: "Esporta o importa il vault"
                    )
                }

                NavigationLink {
                    EnhancedShareDashboardView()
                } label: {
                    SettingsRow(
                        icon: "square.and.arrow.up.fill",
                        tint: .blue,
                        title: "Condivisione",
                        subtitle: "Prepara un pacchetto selettivo"
                    )
                }
            }

            Section("Privacy e sicurezza") {
                SettingsRow(
                    icon: "lock.shield.fill",
                    tint: .green,
                    title: "Vault cifrato",
                    subtitle: "Chiave protetta nel Portachiavi del dispositivo"
                )
                SettingsRow(
                    icon: "network.slash",
                    tint: .secondary,
                    title: "Dati sotto il tuo controllo",
                    subtitle: "Nessun caricamento automatico su server"
                )
            }

            Section {
                HStack {
                    Text("Versione")
                    Spacer()
                    Text(appVersion)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Impostazioni")
    }

    private var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "-"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "-"
        return "\(version) (\(build))"
    }
}

private struct SettingsRow: View {
    var icon: String
    var tint: Color
    var title: String
    var subtitle: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.headline)
                .foregroundStyle(tint)
                .frame(width: 34, height: 34)
                .background(tint.opacity(0.12), in: Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}
