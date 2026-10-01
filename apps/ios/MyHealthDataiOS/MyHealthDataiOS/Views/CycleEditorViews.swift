import SwiftUI

struct CycleSetupView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @State private var lastPeriodStart = Date()
    @State private var draft = CycleSettings()
    @State private var loaded = false

    var body: some View {
        NavigationStack {
            ZStack {
                CyclePalette.background(for: colorScheme).ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        VStack(alignment: .leading, spacing: 12) {
                            Image(systemName: "calendar.circle.fill")
                                .font(.system(size: 46))
                                .foregroundStyle(CyclePalette.rose)
                            Text("Imposta il tuo ritmo")
                                .font(.largeTitle.bold())
                            Text("Partiamo dall'ultimo ciclo e dalle tue durate abituali. Potrai cambiare tutto in qualsiasi momento.")
                                .font(.body)
                                .foregroundStyle(.secondary)
                        }

                        CycleEditorSection(title: "Ultimo ciclo", subtitle: "Qual e stato il primo giorno delle ultime mestruazioni?") {
                            DatePicker(
                                "Primo giorno",
                                selection: $lastPeriodStart,
                                in: ...Date(),
                                displayedComponents: [.date]
                            )
                            .datePickerStyle(.compact)
                        }

                        CycleSettingsEditor(draft: $draft)

                        Button(action: save) {
                            Text("Crea la mia previsione")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .frame(minHeight: 50)
                        }
                        .mhdGlassButton(prominent: true)
                    }
                    .frame(maxWidth: 680)
                    .padding(20)
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Configurazione")
            .navigationBarTitleDisplayMode(.inline)
            .tint(CyclePalette.rose)
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        draft = store.cycleSettings
        if let latestStart = CyclePredictor.normalizedPeriodStarts(entries: store.cycleEntries).last {
            lastPeriodStart = latestStart
        }
    }

    private func save() {
        draft.isConfigured = true
        store.saveCycleSettings(draft)

        let day = Calendar.current.startOfDay(for: lastPeriodStart)
        if var existing = store.cycleEntries.first(where: { Calendar.current.isDate($0.date, inSameDayAs: day) }) {
            existing.date = day
            existing.isPeriodStart = true
            existing.isPeriodDay = true
            existing.updatedAt = .now
            store.upsertCycleEntry(existing)
        } else {
            store.upsertCycleEntry(
                CycleEntry(
                    date: day,
                    isPeriodStart: true,
                    isPeriodEnd: false,
                    isPeriodDay: true,
                    flow: nil,
                    symptoms: nil,
                    note: nil
                )
            )
        }
        dismiss()
    }
}

struct CycleSettingsView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @State private var draft = CycleSettings()
    @State private var loaded = false

    var body: some View {
        NavigationStack {
            ZStack {
                CyclePalette.background(for: colorScheme).ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("Il tuo ritmo")
                                .font(.title.bold())
                            Text("Le modifiche aggiornano subito calendario e previsioni.")
                                .foregroundStyle(.secondary)
                        }

                        CycleSettingsEditor(draft: $draft)

                        if let preview = CyclePredictor.forecast(
                            entries: store.cycleEntries,
                            settings: draft
                        ) {
                            CycleEditorSection(title: "Anteprima") {
                                HStack {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text("Prossimo ciclo stimato")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                        Text(CycleDateText.full(preview.nextPeriodStart))
                                            .font(.headline)
                                    }
                                    Spacer()
                                    Image(systemName: "calendar")
                                        .foregroundStyle(CyclePalette.rose)
                                }
                            }
                        }
                    }
                    .frame(maxWidth: 680)
                    .padding(20)
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Impostazioni ciclo")
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
            .onAppear(perform: load)
        }
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        draft = store.cycleSettings
    }

    private func save() {
        draft.isConfigured = true
        store.saveCycleSettings(draft)
        dismiss()
    }
}

struct CyclePredictionInfoView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        NavigationStack {
            ZStack {
                CyclePalette.background(for: colorScheme).ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        Image(systemName: "wand.and.stars")
                            .font(.system(size: 42))
                            .foregroundStyle(CyclePalette.rose)

                        VStack(alignment: .leading, spacing: 7) {
                            Text("Come funzionano le stime")
                                .font(.largeTitle.bold())
                            Text("Le date cambiano quando aggiorni il diario o il metodo di calcolo.")
                                .foregroundStyle(.secondary)
                        }

                        PredictionInfoRow(
                            icon: "calendar",
                            title: "Prossime mestruazioni",
                            text: "La data usa la durata abituale che hai scelto oppure la durata dell'ultimo ciclo completo."
                        )
                        PredictionInfoRow(
                            icon: "leaf.fill",
                            title: "Finestra fertile stimata",
                            text: "E mostrata come i cinque giorni precedenti l'ovulazione stimata e il giorno stimato stesso."
                        )
                        PredictionInfoRow(
                            icon: "exclamationmark.shield",
                            title: "Un'indicazione, non contraccezione",
                            text: "Una stima basata sul calendario non conferma l'ovulazione e non va usata per evitare una gravidanza."
                        )
                    }
                    .frame(maxWidth: 620)
                    .padding(22)
                    .frame(maxWidth: .infinity)
                }
            }
            .navigationTitle("Informazioni")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fine") { dismiss() }
                }
            }
            .tint(CyclePalette.rose)
        }
    }
}

private struct PredictionInfoRow: View {
    var icon: String
    var title: String
    var text: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(CyclePalette.rose)
                .frame(width: 42, height: 42)
                .mhdGlassCircle(tint: CyclePalette.rose.opacity(0.12))
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.headline)
                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .mhdGlassPanel(tint: CyclePalette.rose.opacity(0.05))
    }
}

private struct CycleSettingsEditor: View {
    @Binding var draft: CycleSettings

    var body: some View {
        CycleEditorSection(title: "Durate abituali", subtitle: "Indica il ritmo che ti rappresenta meglio.") {
            VStack(spacing: 18) {
                CycleNumberControl(
                    title: "Ciclo completo",
                    subtitle: "Dal primo giorno a quello successivo",
                    value: $draft.typicalCycleLength,
                    range: CycleSettings.allowedCycleLength,
                    unit: "giorni"
                )
                Divider()
                CycleNumberControl(
                    title: "Mestruazioni",
                    subtitle: "Per quanti giorni durano di solito",
                    value: $draft.typicalPeriodLength,
                    range: 1...min(draft.typicalCycleLength, 15),
                    unit: "giorni"
                )
            }
        }
        .onChange(of: draft.typicalCycleLength) { _, cycleLength in
            draft.typicalPeriodLength = min(draft.typicalPeriodLength, cycleLength)
        }

        CycleEditorSection(title: "Calcolo del prossimo ciclo", subtitle: "Scegli quale durata applicare alla previsione.") {
            VStack(spacing: 10) {
                ForEach(CyclePredictionMethod.allCases) { method in
                    Button {
                        draft.predictionMethod = method
                    } label: {
                        HStack(alignment: .top, spacing: 12) {
                            Image(systemName: draft.predictionMethod == method ? "checkmark" : "circle.dashed")
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(draft.predictionMethod == method ? CyclePalette.rose : .secondary)
                                .frame(width: 36, height: 36)
                                .mhdGlassCircle(tint: draft.predictionMethod == method ? CyclePalette.rose.opacity(0.14) : nil)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(method.title)
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                Text(method.subtitle)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer()
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .mhdGlassCapsule(tint: draft.predictionMethod == method ? CyclePalette.rose.opacity(0.12) : nil, interactive: true)
                    }
                    .buttonStyle(.plain)
                }
            }
        }

        CycleEditorSection(title: "Calendario") {
            Toggle(isOn: $draft.showsFertileWindow) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Mostra finestra fertile")
                        .font(.headline)
                    Text("Visualizza una stima nel calendario e nell'anello del ciclo.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct CycleNumberControl: View {
    var title: String
    var subtitle: String
    @Binding var value: Int
    var range: ClosedRange<Int>
    var unit: String

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.headline)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            HStack(spacing: 10) {
                Button { value = max(value - 1, range.lowerBound) } label: {
                    Image(systemName: "minus")
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
                .mhdGlassCircle(interactive: true)
                .disabled(value <= range.lowerBound)

                VStack(spacing: 0) {
                    Text("\(value)")
                        .font(.title2.bold().monospacedDigit())
                    Text(unit)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .frame(minWidth: 48)

                Button { value = min(value + 1, range.upperBound) } label: {
                    Image(systemName: "plus")
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
                .mhdGlassCircle(interactive: true)
                .disabled(value >= range.upperBound)
            }
        }
    }
}
