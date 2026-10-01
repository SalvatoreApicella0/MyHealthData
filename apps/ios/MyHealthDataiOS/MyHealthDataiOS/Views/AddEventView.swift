import SwiftUI

private extension View {
    func bodyInput() -> some View {
        textFieldStyle(.plain).padding(.horizontal, 14).padding(.vertical, 12)
            .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct AddEventView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    var preselectedRegion: BodyRegionId?
    var preselectedBodyPoint: BodyPoint?
    var existingEvent: HealthEvent?

    @State private var eventType: EventType?
    @State private var occurredAt = Date()
    @State private var intensity: Int?
    @State private var durationMinutes = 0.0
    @State private var description = ""
    @State private var suspectedTrigger = ""
    @State private var helpedBy = ""
    @State private var showsDetails = false

    private let tint = Color.mhdPrimary

    init(preselectedRegion: BodyRegionId? = nil, preselectedBodyPoint: BodyPoint? = nil, existingEvent: HealthEvent? = nil) {
        self.preselectedRegion = preselectedRegion ?? existingEvent?.bodyRegionId
        self.preselectedBodyPoint = preselectedBodyPoint ?? existingEvent?.bodyPoint
        self.existingEvent = existingEvent
        _eventType = State(initialValue: existingEvent?.type)
        _occurredAt = State(initialValue: existingEvent?.occurredAt ?? .now)
        _intensity = State(initialValue: existingEvent?.intensity)
        _durationMinutes = State(initialValue: existingEvent?.durationMinutes ?? 0)
        _description = State(initialValue: existingEvent?.description ?? "")
        _suspectedTrigger = State(initialValue: existingEvent?.suspectedTrigger ?? "")
        _helpedBy = State(initialValue: existingEvent?.helpedBy ?? "")
    }

    private var selectedRegion: BodyRegionId? {
        preselectedRegion ?? preselectedBodyPoint?.approximateRegionId
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                selectionSection
                intensitySection
                durationSection
                DisclosureGroup("Aggiungi dettagli", isExpanded: $showsDetails) { notesSection.padding(.top, 10) }
                    .font(.headline).padding(16).mhdGlassPanel(tint: tint.opacity(0.04))
                Button(existingEvent == nil ? "Registra dolore" : "Salva modifiche", action: save)
                    .disabled(!canSave).frame(maxWidth: .infinity).mhdGlassButton(prominent: true)
            }
            .padding(18)
        }
        .navigationTitle(existingEvent == nil ? "Registra sintomo" : "Modifica sintomo")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
        }
    }

    private var selectionSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Cosa senti?").font(.title3.bold())
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 94))], spacing: 8) {
                ForEach([EventType.pain, .discomfort, .burning, .swelling, .stiffness, .tingling, .wound]) { type in
                    Button(type.label) { eventType = type }
                        .buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                        .tint(eventType == type ? tint : Color.secondary.opacity(0.18))
                }
            }

            if let preselectedBodyPoint {
                Label("Punto selezionato · \(preselectedBodyPoint.approximateRegionLabel)", systemImage: "mappin.and.ellipse")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(tint)
            } else if let selectedRegion {
                Label(selectedRegion.label, systemImage: "figure.stand")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(tint)
            }

            DatePicker("Data e ora", selection: $occurredAt, in: ...Date.now)
                .datePickerStyle(.compact)
        }
        .padding(18)
        .mhdGlassPanel(tint: tint.opacity(0.05))
    }

    private var intensitySection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Intensità").font(.title3.bold())
                Spacer()
                Text(intensity.map { "\($0)/10" } ?? "Da impostare")
                    .font(.headline.monospacedDigit()).foregroundStyle(intensity == nil ? .secondary : tint)
            }
            HStack(spacing: 6) {
                ForEach(1...10, id: \.self) { value in
                    Button("\(value)") { intensity = value }
                        .font(.caption.bold()).frame(maxWidth: .infinity, minHeight: 34)
                        .background(intensity == value ? tint : Color.secondary.opacity(0.10), in: Circle())
                        .foregroundStyle(intensity == value ? .white : .primary)
                        .buttonStyle(.plain)
                }
            }
        }
        .padding(18)
        .mhdGlassPanel(tint: tint.opacity(0.05))
    }

    private var durationSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Durata").font(.title3.bold())
                Spacer()
                Text(durationText).font(.headline.monospacedDigit()).foregroundStyle(tint)
            }
            HStack(spacing: 8) {
                ForEach([(0.0, "Ora"), (15.0, "15 min"), (60.0, "1 ora"), (240.0, "4 ore"), (480.0, "8 ore")], id: \.0) { value, label in
                    Button(label) { durationMinutes = value }
                        .buttonStyle(.borderedProminent).buttonBorderShape(.capsule)
                        .tint(durationMinutes == value ? tint : Color.secondary.opacity(0.18))
                }
            }.font(.caption).minimumScaleFactor(0.75)
        }
        .padding(18)
        .mhdGlassPanel(tint: tint.opacity(0.05))
    }

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Dettagli").font(.title3.bold())
            TextField("Descrizione facoltativa", text: $description, axis: .vertical).lineLimit(2...5).bodyInput()
            TextField("Possibile causa", text: $suspectedTrigger).bodyInput()
            TextField("Cosa ha aiutato", text: $helpedBy).bodyInput()
        }
        .padding(18)
        .mhdGlassPanel(tint: tint.opacity(0.04))
    }

    private var durationText: String {
        let minutes = Int(durationMinutes)
        if minutes == 0 { return "Istantaneo" }
        if minutes < 60 { return "\(minutes) min" }
        let hours = minutes / 60, remainder = minutes % 60
        return remainder == 0 ? "\(hours) h" : "\(hours) h \(remainder) min"
    }

    private var canSave: Bool {
        eventType != nil && intensity != nil
    }

    private func save() {
        guard let eventType, let intensity else { return }
        var event = existingEvent ?? HealthEvent(type: eventType, bodyRegionId: selectedRegion, bodyPoint: preselectedBodyPoint, occurredAt: occurredAt, description: description)
        event.type = eventType
        event.occurredAt = occurredAt
        event.intensity = intensity
        event.durationMinutes = durationMinutes > 0 ? durationMinutes : nil
        event.description = description.nilIfBlank ?? eventType.label
        event.suspectedTrigger = suspectedTrigger.nilIfBlank
        event.helpedBy = helpedBy.nilIfBlank
        event.updatedAt = .now
        store.saveEvent(event)
        dismiss()
    }
}
