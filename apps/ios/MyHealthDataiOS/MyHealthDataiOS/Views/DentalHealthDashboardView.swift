import SwiftUI

struct DentalHealthModuleView: View {
    private struct ToothSelection: Identifiable { let id: String }

    @Environment(HealthDataStore.self) private var store
    @State private var selectedTooth: ToothSelection?
    @State private var editingTooth: ToothSelection?
    @State private var editing: HealthEvent?
    @State private var isAddingHygiene = false
    private let upper = dentalUpperFDI
    private let lower = dentalLowerFDI

    private var rawEntries: [HealthEvent] {
        store.events.filter { $0.type == .dentalCare }.sorted { $0.occurredAt > $1.occurredAt }
    }

    private var dentalProjection: DentalContract.Projection {
        DentalContract.resolve(rawEntries)
    }

    private var entries: [HealthEvent] {
        // The visible history consumes the deduplicated canonical stream too;
        // a repeated Hub delivery must not appear twice in the UI.
        dentalProjection.events.reversed().map(\.event)
    }

    private var latestToothEvents: [String: HealthEvent] {
        dentalProjection.byTooth.compactMapValues { $0.latestEvent }
    }

    private var trackedToothCount: Int {
        dentalProjection.byTooth.count
    }

    var body: some View {
        MHDDataModuleScrollView {
            VStack(alignment: .leading, spacing: 20) {
                MHDModuleHeader(title: "Denti", subtitle: "Odontogramma FDI, stato e interventi", symbol: "mouth.fill", tint: .cyan)
                odontogram
                summary

                HStack {
                    Button("Registra igiene orale", systemImage: "sparkles") {
                        isAddingHygiene = true
                    }
                    .mhdGlassButton(prominent: true)
                    Spacer(minLength: 0)
                }

                SpecialtySection("Storico") {
                    if entries.isEmpty {
                        ContentUnavailableView(
                            "Nessun evento dentale",
                            systemImage: "mouth",
                            description: Text("Registra igiene, visite e trattamenti su un dente preciso.")
                        )
                        .frame(minHeight: 240)
                    } else {
                        ForEach(entries) { event in
                            Button {
                                if let tooth = DentalContract.resolve(event).tooth, dentalProjection.byTooth[tooth]?.removed == true {
                                    selectedTooth = ToothSelection(id: tooth)
                                } else {
                                    editing = event
                                }
                            } label: {
                                dentalHistoryRow(event)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button("Elimina", role: .destructive) { store.deleteEvent(id: event.id) }
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .sheet(item: $editingTooth) { tooth in
            NavigationStack {
                DentalEntryEditor(
                    event: dentalProjection.byTooth[tooth.id]?.removed == true ? nil : latestToothEvents[tooth.id],
                    tooth: tooth.id,
                    isRemovalCorrection: dentalProjection.byTooth[tooth.id]?.removed == true
                )
            }
        }
        .sheet(isPresented: $isAddingHygiene) {
            NavigationStack { DentalEntryEditor(tooth: nil) }
        }
        .sheet(item: $editing) { event in
            NavigationStack { DentalEntryEditor(event: event, tooth: DentalContract.resolve(event).tooth) }
        }
    }

    private var odontogram: some View {
        DentalOdontogramView(
            projection: dentalProjection,
            upper: upper,
            lower: lower,
            selectedTooth: selectedTooth?.id,
            onSelect: { selectedTooth = ToothSelection(id: $0) }
        )
    }

    private var summary: some View {
        let states = dentalProjection.byTooth.values.compactMap { projection in
            projection.state.flatMap { DentalToothState(rawValue: $0.rawValue) }
        }
        let cariesCount = states.count(where: { $0 == .caries })
        let removedCount = states.count(where: { $0.isRemoved })
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                summaryMetric("Tracciati", value: "\(trackedToothCount)", color: .cyan)
                summaryMetric("Carie", value: "\(cariesCount)", color: .red)
                summaryMetric("Rimossi", value: "\(removedCount)", color: .gray)
            }
            if let selectedTooth {
                Divider()
                let projection = dentalProjection.byTooth[selectedTooth.id]
                let event = projection?.latestEvent
                let state = DentalToothState(rawValue: projection?.state?.rawValue ?? "") ?? .unrecorded
                Label("Dente FDI \(selectedTooth.id): \(state.title)", systemImage: state.symbol)
                    .font(.headline)
                    .foregroundStyle(state.color)
                if let event {
                    Text("Ultimo intervento: \(DentalIntervention.from(event).title) · \(event.occurredAt.formatted(date: .abbreviated, time: .omitted))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Nessun intervento registrato per questo dente.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if !state.isRemoved {
                    Button("Registra intervento", systemImage: "plus") {
                        editingTooth = ToothSelection(id: selectedTooth.id)
                    }
                    .mhdGlassButton(prominent: true)
                } else {
                    Button("Correggi stato rimosso", systemImage: "arrow.uturn.backward") {
                        // Add a restoration event; keep the historical extraction intact.
                        editingTooth = ToothSelection(id: selectedTooth.id)
                    }
                    .mhdGlassButton(prominent: true)
                    .accessibilityHint("Registra un evento esplicito di ripristino senza eliminare l’estrazione dallo storico.")
                }
            } else {
                Text("Seleziona un dente per vedere stato e ultimo intervento.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .mhdGlassPanel(tint: Color.cyan.opacity(0.04))
    }

    private func summaryMetric(_ title: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(value).font(.title3.bold().monospacedDigit()).foregroundStyle(color)
            Text(title).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func dentalHistoryRow(_ event: HealthEvent) -> some View {
        let state = DentalToothState.from(event)
        let intervention = DentalIntervention.from(event)
        let tooth = DentalContract.resolve(event).tooth
        return HStack(spacing: 12) {
            Image(systemName: tooth == nil ? "sparkles" : intervention == .check ? "magnifyingglass" : "cross.case.fill")
                .foregroundStyle(intervention.color)
            VStack(alignment: .leading, spacing: 3) {
                Text(tooth.map { "Dente FDI \($0)" } ?? "Igiene orale")
                    .font(.headline)
                Text([state.title, intervention.title, event.occurredAt.formatted(date: .abbreviated, time: .omitted)].joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let note = event.tag("note"), !note.isEmpty {
                    Text(note).font(.caption2).foregroundStyle(.secondary).lineLimit(2)
                }
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.tertiary)
        }
        .padding(15)
        .mhdGlassPanel(tint: intervention.color.opacity(0.05))
        .accessibilityElement(children: .combine)
    }
}
