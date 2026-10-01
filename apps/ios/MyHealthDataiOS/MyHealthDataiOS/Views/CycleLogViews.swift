import SwiftUI

enum CycleLogPreset {
    case none
    case startPeriod
    case flow
}

struct CycleLogView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    let preset: CycleLogPreset
    @State private var date: Date
    @State private var bleeding: CycleBleeding = .none
    @State private var flow: CycleEntry.Flow = .medium
    @State private var isPeriodStart = false
    @State private var isPeriodEnd = false
    @State private var selectedSymptoms: Set<String> = []
    @State private var mood: CycleEntry.Mood?
    @State private var tracksEnergy = false
    @State private var energy = 3.0
    @State private var temperature = ""
    @State private var ovulationTest: CycleEntry.OvulationTestResult?
    @State private var note = ""
    @State private var originalID: String?
    @State private var originalDate: Date?
    @State private var originalCreatedAt: Date?
    @State private var loaded = false
    @State private var confirmsDelete = false

    private let symptomOptions = [
        "Crampi", "Mal di testa", "Gonfiore", "Seno sensibile",
        "Stanchezza", "Mal di schiena", "Nausea", "Voglie"
    ]

    init(date: Date, preset: CycleLogPreset = .none) {
        self.preset = preset
        _date = State(initialValue: Calendar.current.startOfDay(for: date))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                CyclePalette.background(for: colorScheme).ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(CycleDateText.full(date))
                                .font(.largeTitle.bold())
                            Text("Aggiungi solo quello che vuoi ricordare.")
                                .foregroundStyle(.secondary)
                        }

                        CycleEditorSection(title: "Giorno") {
                            DatePicker("Data", selection: $date, in: ...Date(), displayedComponents: [.date])
                                .disabled(originalID != nil)
                        }

                        CycleEditorSection(title: "Flusso") {
                            VStack(alignment: .leading, spacing: 14) {
                                CycleChoiceGrid(
                                    choices: CycleBleeding.allCases,
                                    selection: $bleeding,
                                    title: { $0.title },
                                    icon: { $0.icon }
                                )

                                if bleeding == .period {
                                    Divider()
                                    Text("Intensita")
                                        .font(.subheadline.weight(.semibold))
                                    HStack(spacing: 8) {
                                        ForEach([CycleEntry.Flow.light, .medium, .heavy]) { option in
                                            Button {
                                                flow = option
                                            } label: {
                                                VStack(spacing: 6) {
                                                    Image(systemName: "drop.fill")
                                                        .font(.system(size: 11 + CGFloat([CycleEntry.Flow.light, .medium, .heavy].firstIndex(of: option) ?? 0) * 4))
                                                    Text(option.label)
                                                        .font(.caption2.weight(.semibold))
                                                }
                                                .foregroundStyle(flow == option ? CyclePalette.coral : .secondary)
                                                .frame(maxWidth: .infinity)
                                                .frame(height: 58)
                                                .mhdGlassCircle(tint: flow == option ? CyclePalette.coral.opacity(0.16) : nil, interactive: true)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }

                                    Toggle("Primo giorno del ciclo", isOn: $isPeriodStart)
                                    Toggle("Ultimo giorno delle mestruazioni", isOn: $isPeriodEnd)
                                }
                            }
                        }

                        CycleEditorSection(title: "Sintomi") {
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 112), spacing: 8)], spacing: 8) {
                                ForEach(symptomOptions, id: \.self) { symptom in
                                    CycleTagButton(
                                        title: symptom,
                                        isSelected: selectedSymptoms.contains(symptom)
                                    ) {
                                        if selectedSymptoms.contains(symptom) {
                                            selectedSymptoms.remove(symptom)
                                        } else {
                                            selectedSymptoms.insert(symptom)
                                        }
                                    }
                                }
                            }
                        }

                        CycleEditorSection(title: "Come ti senti") {
                            VStack(alignment: .leading, spacing: 16) {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        ForEach(CycleEntry.Mood.allCases) { option in
                                            Button {
                                                mood = mood == option ? nil : option
                                            } label: {
                                                VStack(spacing: 6) {
                                                    Image(systemName: option.systemImage)
                                                        .font(.title3)
                                                    Text(option.label)
                                                        .font(.caption.weight(.medium))
                                                }
                                                .foregroundStyle(mood == option ? CyclePalette.ovulation : .primary)
                                                .frame(width: 72, height: 72)
                                                .mhdGlassCircle(tint: mood == option ? CyclePalette.ovulation.opacity(0.16) : nil, interactive: true)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                }

                                Toggle("Registra energia", isOn: $tracksEnergy)
                                if tracksEnergy {
                                    HStack {
                                        Image(systemName: "battery.25")
                                        Slider(value: $energy, in: 1...5, step: 1)
                                        Image(systemName: "battery.100")
                                        Text("\(Int(energy))/5")
                                            .font(.caption.monospacedDigit())
                                            .frame(width: 30)
                                    }
                                    .foregroundStyle(.secondary)
                                }
                            }
                        }

                        CycleEditorSection(title: "Segnali", subtitle: "Opzionale") {
                            VStack(spacing: 14) {
                                HStack {
                                    Text("Temperatura basale")
                                    Spacer()
                                    TextField("36,5", text: $temperature)
                                        .multilineTextAlignment(.trailing)
                                        .frame(width: 72)
                                    Text("C")
                                        .foregroundStyle(.secondary)
                                }
                                Divider()
                                Picker("Test ovulazione", selection: $ovulationTest) {
                                    Text("Non registrato").tag(CycleEntry.OvulationTestResult?.none)
                                    ForEach(CycleEntry.OvulationTestResult.allCases) { result in
                                        Text(result.label).tag(CycleEntry.OvulationTestResult?.some(result))
                                    }
                                }
                            }
                        }

                        CycleEditorSection(title: "Nota") {
                            TextField("Scrivi una nota per questa giornata", text: $note, axis: .vertical)
                                .lineLimit(3...7)
                        }

                        if originalID != nil {
                            Button(role: .destructive) {
                                confirmsDelete = true
                            } label: {
                                Label("Elimina il diario di questo giorno", systemImage: "trash")
                                    .frame(maxWidth: .infinity)
                            }
                            .mhdGlassButton()
                        }
                    }
                    .frame(maxWidth: 700)
                    .padding(20)
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Diario ciclo")
            .navigationBarTitleDisplayMode(.inline)
            .tint(CyclePalette.rose)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva", action: save)
                        .fontWeight(.semibold)
                }
            }
            .confirmationDialog(
                "Eliminare il diario di questo giorno?",
                isPresented: $confirmsDelete,
                titleVisibility: .visible
            ) {
                Button("Elimina", role: .destructive, action: delete)
                Button("Annulla", role: .cancel) {}
            }
            .onAppear { load(for: date) }
            .onChange(of: date) { _, newDate in load(for: newDate) }
            .onChange(of: bleeding) { oldValue, newValue in
                if oldValue != .period && newValue == .period {
                    suggestPeriodStart()
                }
                if newValue != .period {
                    isPeriodStart = false
                    isPeriodEnd = false
                }
            }
        }
    }

    private func load(for selectedDate: Date) {
        let day = Calendar.current.startOfDay(for: selectedDate)
        let entry = store.cycleEntries.first { Calendar.current.isDate($0.date, inSameDayAs: day) }
        originalID = entry?.id
        originalDate = entry?.date
        originalCreatedAt = entry?.createdAt

        if let entry {
            if entry.flow == .spotting && !entry.recordsPeriod {
                bleeding = .spotting
            } else if entry.recordsPeriod {
                bleeding = .period
            } else {
                bleeding = .none
            }
            if let savedFlow = entry.flow, savedFlow != .spotting { flow = savedFlow }
            isPeriodStart = entry.isPeriodStart
            isPeriodEnd = entry.isPeriodEnd
            selectedSymptoms = Set(entry.symptoms?.split(separator: ",").map {
                $0.trimmingCharacters(in: .whitespacesAndNewlines)
            } ?? [])
            mood = entry.mood
            tracksEnergy = entry.energyLevel != nil
            energy = Double(entry.energyLevel ?? 3)
            temperature = entry.basalTemperatureC.map {
                $0.formatted(.number.locale(Locale(identifier: "it_IT")).precision(.fractionLength(1...2)))
            } ?? ""
            ovulationTest = entry.ovulationTestResult
            note = entry.note ?? ""
        } else {
            bleeding = .none
            flow = .medium
            isPeriodStart = false
            isPeriodEnd = false
            selectedSymptoms = []
            mood = nil
            tracksEnergy = false
            energy = 3
            temperature = ""
            ovulationTest = nil
            note = ""
        }
        if entry == nil {
            switch preset {
            case .startPeriod:
                bleeding = .period
                isPeriodStart = true
            case .flow:
                bleeding = .period
            case .none:
                break
            }
        }
        loaded = true
    }

    private func suggestPeriodStart() {
        guard originalID == nil,
              let previousDay = Calendar.current.date(byAdding: .day, value: -1, to: date) else { return }
        let previousWasPeriod = store.cycleEntries.contains {
            Calendar.current.isDate($0.date, inSameDayAs: previousDay) && $0.recordsPeriod
        }
        isPeriodStart = !previousWasPeriod
    }

    private func save() {
        let normalizedDate = Calendar.current.startOfDay(for: date)
        if let originalID, let originalDate,
           !Calendar.current.isDate(originalDate, inSameDayAs: normalizedDate) {
            store.deleteCycleEntry(id: originalID)
        }

        let temperatureValue = Double(
            temperature.replacingOccurrences(of: ",", with: ".")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        )
        let orderedSymptoms = symptomOptions.filter(selectedSymptoms.contains)
        let entry = CycleEntry(
            id: originalID ?? "cycle_\(UUID().uuidString)",
            date: normalizedDate,
            isPeriodStart: bleeding == .period && isPeriodStart,
            isPeriodEnd: bleeding == .period && isPeriodEnd,
            isPeriodDay: bleeding == .period,
            flow: bleeding == .spotting ? .spotting : (bleeding == .period ? flow : nil),
            symptoms: orderedSymptoms.isEmpty ? nil : orderedSymptoms.joined(separator: ", "),
            mood: mood,
            energyLevel: tracksEnergy ? Int(energy) : nil,
            basalTemperatureC: temperatureValue,
            ovulationTestResult: ovulationTest,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : note.trimmingCharacters(in: .whitespacesAndNewlines),
            createdAt: originalCreatedAt ?? .now,
            updatedAt: .now
        )
        store.upsertCycleEntry(entry)
        dismiss()
    }

    private func delete() {
        if let originalID {
            store.deleteCycleEntry(id: originalID)
        }
        dismiss()
    }
}

private enum CycleBleeding: String, CaseIterable, Identifiable {
    case none
    case spotting
    case period

    var id: String { rawValue }

    var title: String {
        switch self {
        case .none: "Nessuno"
        case .spotting: "Spotting"
        case .period: "Ciclo"
        }
    }

    var icon: String {
        switch self {
        case .none: "minus"
        case .spotting: "drop"
        case .period: "drop.fill"
        }
    }
}

private struct CycleChoiceGrid<Choice: Hashable & Identifiable>: View {
    var choices: [Choice]
    @Binding var selection: Choice
    var title: (Choice) -> String
    var icon: (Choice) -> String

    var body: some View {
        HStack(spacing: 8) {
            ForEach(choices) { choice in
                Button {
                    selection = choice
                } label: {
                    VStack(spacing: 7) {
                        Image(systemName: icon(choice))
                            .font(.title3)
                        Text(title(choice))
                            .font(.caption.weight(.semibold))
                    }
                    .foregroundStyle(selection == choice ? .white : .primary)
                    .frame(maxWidth: .infinity, minHeight: 66)
                    .mhdGlassCapsule(tint: selection == choice ? CyclePalette.coral.opacity(0.22) : nil, interactive: true)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

private struct CycleTagButton: View {
    var title: String
    var isSelected: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if isSelected {
                    Image(systemName: "checkmark")
                        .font(.caption.bold())
                }
                Text(title)
                    .font(.caption.weight(.medium))
            }
            .foregroundStyle(isSelected ? CyclePalette.rose : .primary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .padding(.horizontal, 8)
            .mhdGlassCapsule(tint: isSelected ? CyclePalette.rose.opacity(0.16) : nil, interactive: true)
        }
        .buttonStyle(.plain)
    }
}

struct CycleEditorSection<Content: View>: View {
    var title: String
    var subtitle: String?
    @ViewBuilder var content: Content

    init(title: String, subtitle: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.title3.bold())
                if let subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            content
        }
        .padding(18)
        .mhdGlassPanel(tint: CyclePalette.rose.opacity(0.05))
    }
}
