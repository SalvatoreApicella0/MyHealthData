import SwiftUI

public struct EnhancedMedicationsDashboardView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.colorScheme) private var colorScheme
    @State private var showsNewMedication = false
    @State private var editingMedication: MedicationStatement?

    public init() {}

    public var body: some View {
        ZStack {
            ExperiencePalette.background(for: colorScheme).ignoresSafeArea()

            MHDDataModuleScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    MHDModuleHeader(title: "Farmaci", subtitle: "Terapie e programmi", symbol: "pills.fill", tint: ExperiencePalette.medication)
                    header
                    activeTherapies
                    stockSection
                    doseHistory
                }
                .frame(maxWidth: 880)
                .padding(.horizontal)
                .padding(.top, 8)
                .padding(.bottom, 28)
                .frame(maxWidth: .infinity)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .tint(ExperiencePalette.medication)
        .sheet(isPresented: $showsNewMedication) {
            NavigationStack { NewMedicationExperienceView() }
        }
        .sheet(item: $editingMedication) { medication in
            NavigationStack { NewMedicationExperienceView(medication: medication) }
        }
    }

    private var activeMedications: [MedicationStatement] {
        store.medications.filter { $0.status == .active }
    }

    private var medicationsWithStock: [MedicationStatement] {
        activeMedications.filter { $0.stockQuantity != nil }
    }

    private var header: some View {
        HStack {
            Text(activeMedications.isEmpty ? "Nessuna terapia attiva" : "\(activeMedications.count) terapie attive")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Button { showsNewMedication = true } label: {
                Label("Aggiungi", systemImage: "plus")
                    .font(.subheadline.weight(.semibold))
                    .frame(minHeight: 42)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
        }
    }

    private var activeTherapies: some View {
        ExperienceSection(title: "Terapie attive") {
            if activeMedications.isEmpty {
                MedicationEmptyState { showsNewMedication = true }
            } else {
                VStack(spacing: 12) {
                    ForEach(activeMedications) { medication in
                        MedicationExperienceCard(
                            medication: medication,
                            onLog: { status in log(status, for: medication) },
                            onStatusChange: { status in
                                store.updateMedicationStatus(id: medication.id, status: status)
                            },
                            onEdit: { editingMedication = medication }
                        )
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var stockSection: some View {
        if !activeMedications.isEmpty {
            ExperienceSection(title: "Scorte") {
                if medicationsWithStock.isEmpty {
                    ExperienceInlineEmptyState(
                        icon: "shippingbox",
                        title: "Scorte non indicate",
                        detail: "Puoi aggiungerle quando registri una nuova terapia."
                    )
                } else {
                    VStack(spacing: 10) {
                        ForEach(medicationsWithStock) { medication in
                            MedicationStockRow(medication: medication)
                        }
                    }
                }
            }
        }
    }

    private var doseHistory: some View {
        ExperienceSection(title: "Storico dosi") {
            if store.medicationDoseEvents.isEmpty {
                ExperienceInlineEmptyState(
                    icon: "clock.arrow.circlepath",
                    title: "Nessuna dose registrata",
                    detail: "Le dosi segnate dalle terapie attive appariranno qui."
                )
            } else {
                VStack(spacing: 0) {
                    ForEach(store.medicationDoseEvents.prefix(20)) { event in
                        MedicationDoseExperienceRow(
                            event: event,
                            medicationName: store.medications.first { $0.id == event.medicationId }?.name ?? "Terapia"
                        )
                        if event.id != store.medicationDoseEvents.prefix(20).last?.id {
                            Divider().padding(.leading, 44)
                        }
                    }
                }
                .padding(.horizontal, 12)
                .background(ExperiencePalette.surface(for: colorScheme), in: RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    private func log(_ status: MedicationDoseEvent.Status, for medication: MedicationStatement) {
        let now = Date()
        store.addMedicationDoseEvent(
            MedicationDoseEvent(
                medicationId: medication.id,
                scheduledAt: now,
                recordedAt: now,
                status: status
            )
        )
    }
}
