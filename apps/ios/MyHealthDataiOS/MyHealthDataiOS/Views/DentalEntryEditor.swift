import SwiftUI

struct DentalEntryEditor: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    let event: HealthEvent?
    let tooth: String?
    let isRemovalCorrection: Bool
    @State private var state: DentalToothState = .healthy
    @State private var intervention: DentalIntervention = .check
    @State private var hygieneAction = "brushing"
    @State private var date = Date.now
    @State private var note = ""

    init(event: HealthEvent? = nil, tooth: String?, isRemovalCorrection: Bool = false) {
        self.event = event
        self.tooth = tooth
        self.isRemovalCorrection = isRemovalCorrection
        self._intervention = State(initialValue: isRemovalCorrection ? .restoration : .check)
    }

    private var hygieneActions: [(id: String, title: String)] {
        [("brushing", "Spazzolamento"), ("flossing", "Filo interdentale"), ("mouthwash", "Collutorio"), ("cleaning", "Pulizia professionale"), ("checkup", "Controllo")]
    }

    private let toothInterventions: [DentalIntervention] = [
        .check, .caries, .filling, .rootCanal, .crown, .implant,
        .orthodontics, .pain, .extraction,
    ]

    private var hygieneActionTitle: String { hygieneActions.first { $0.id == hygieneAction }?.title ?? "Spazzolamento" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 12) {
                    if let tooth {
                        Label("Dente FDI \(tooth)", systemImage: "scope")
                            .font(.headline)
                        if isRemovalCorrection {
                            Label("Ripristino esplicito", systemImage: "arrow.uturn.backward.circle.fill")
                                .font(.subheadline.weight(.semibold))
                            Text("Il dente verrà sbloccato con un nuovo evento; la precedente estrazione resta nello storico.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            Picker("Stato clinico", selection: $state) {
                                ForEach(DentalToothState.allCases.filter { $0 != .unrecorded }) { value in
                                    Label(value.title, systemImage: value.symbol).tag(value)
                                }
                            }
                            Picker("Intervento", selection: $intervention) {
                                ForEach(toothInterventions) { value in
                                    Text(value.title).tag(value)
                                }
                            }
                        }
                    } else {
                        Picker("Attività", selection: $hygieneAction) {
                            ForEach(hygieneActions, id: \.id) { action in Text(action.title).tag(action.id) }
                        }
                    }
                    DatePicker("Quando", selection: $date, in: ...Date.now)
                    TextField("Nota", text: $note, axis: .vertical)
                        .lineLimit(2...5)
                        .specialtyInput()
                }
                .padding(18)
                .mhdGlassPanel(tint: Color.cyan.opacity(0.05))

                Button(isRemovalCorrection ? "Salva ripristino" : "Salva", action: save)
                    .frame(maxWidth: .infinity)
                    .mhdGlassButton(prominent: true)

                if let event {
                    Button("Elimina", role: .destructive) {
                        store.deleteEvent(id: event.id)
                        dismiss()
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(20)
        }
        .navigationTitle(isRemovalCorrection ? "Ripristina dente" : tooth == nil ? "Igiene orale" : "Dente \(tooth!)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Annulla") { dismiss() }
            }
        }
        .onAppear(perform: load)
    }

    private func load() {
        guard let event else { return }
        date = event.occurredAt
        note = event.tag("note") ?? ""
        if tooth != nil {
            state = DentalToothState.from(event)
            intervention = DentalIntervention.from(event)
        } else {
            let raw = DentalContract.resolve(event).action?.rawValue
            hygieneAction = hygieneActions.contains { $0.id == raw }
                ? (raw ?? hygieneAction)
                : hygieneAction
        }
    }

    private func save() {
        let resolvedState: DentalToothState = switch intervention {
        case .caries: .caries
        case .extraction: .removed
        case .crown: .crown
        case .implant: .implant
        case .filling, .rootCanal, .orthodontics: .treated
        case .pain: .observation
        case .cleaning, .brushing, .flossing, .mouthwash: .healthy
        case .restoration: .healthy
        case .check: state
        }
        var value = isRemovalCorrection
            ? HealthEvent(type: .dentalCare, occurredAt: date, description: "Ripristino dente")
            : event ?? HealthEvent(type: .dentalCare, occurredAt: date, description: tooth == nil ? hygieneActionTitle : intervention.title)
        value.occurredAt = date
        value.description = isRemovalCorrection ? "Ripristino dente" : tooth == nil ? hygieneActionTitle : "\(resolvedState.title) · \(intervention.title)"
        let persistedAction = isRemovalCorrection ? "checkup" : tooth == nil ? hygieneAction : intervention.contractAction
        value.tags = ["action=\(persistedAction)", "note=\(note)"]
        if let tooth {
            // Keep action for older iOS data while state/intervention carry the FDI contract.
            let persistedIntervention = isRemovalCorrection ? "checkup" : intervention.rawValue
            value.tags += ["tooth=\(tooth)", "state=\(resolvedState.rawValue)", "status=\(resolvedState.rawValue)", "intervention=\(persistedIntervention)"]
            if isRemovalCorrection { value.tags += ["restored=true"] }
        }
        value.updatedAt = .now
        store.saveEvent(value)
        dismiss()
    }
}
