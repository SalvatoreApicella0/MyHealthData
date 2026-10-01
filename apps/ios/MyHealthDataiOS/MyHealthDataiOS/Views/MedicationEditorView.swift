import SwiftUI

struct NewMedicationExperienceView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    var medication: MedicationStatement? = nil
    @State private var name = ""
    @State private var dose = ""
    @State private var style: MedicationScheduleStyle = .fixedTimes
    @State private var scheduledTimes = [defaultTime(hour: 8)]
    @State private var intervalHours = 8
    @State private var status: MedicationStatement.Status = .active
    @State private var hasStartDate = true
    @State private var startDate = Date()
    @State private var hasEndDate = false
    @State private var endDate = Date()
    @State private var reason = ""
    @State private var note = ""
    @State private var tracksStock = false
    @State private var stockQuantity = 30.0
    @State private var hasRefillThreshold = true
    @State private var refillThreshold = 5.0
    @State private var remindersEnabled = false
    @State private var showsAdvanced = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
            medicationPanel("Terapia") {
                TextField("Nome", text: $name)
                    .medicationInput()
                TextField("Dose", text: $dose)
                    .medicationInput()
                Picker("Stato", selection: $status) {
                    ForEach(MedicationStatement.Status.allCases) { value in
                        Text(value.label).tag(value)
                    }
                }
            }

            medicationPanel("Quando") {
                Picker("Programma", selection: $style) {
                    ForEach(MedicationScheduleStyle.allCases) { value in
                        Text(value.label).tag(value)
                    }
                }

                switch style {
                case .fixedTimes:
                    ForEach(scheduledTimes.indices, id: \.self) { index in
                        HStack {
                            DatePicker("Orario \(index + 1)", selection: $scheduledTimes[index], displayedComponents: .hourAndMinute)
                            if scheduledTimes.count > 1 {
                                Button(role: .destructive) { scheduledTimes.remove(at: index) } label: {
                                    Image(systemName: "minus.circle.fill")
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Rimuovi orario \(index + 1)")
                            }
                        }
                    }
                    Button { scheduledTimes.append(Self.defaultTime(hour: 20)) } label: {
                        Label("Aggiungi orario", systemImage: "plus")
                    }
                case .interval:
                    Stepper("Ogni \(intervalHours) ore", value: $intervalHours, in: 1...48)
                case .asNeeded:
                    LabeledContent("Frequenza", value: "Al bisogno")
                }
                if style != .asNeeded {
                    Toggle("Promemoria locali", isOn: $remindersEnabled)
                }
            }

            DisclosureGroup(isExpanded: $showsAdvanced) {
                VStack(spacing: 16) {
            medicationPanel("Periodo") {
                Toggle("Data di inizio", isOn: $hasStartDate)
                if hasStartDate {
                    DatePicker("Inizio", selection: $startDate, displayedComponents: .date)
                }
                Toggle("Data di fine", isOn: $hasEndDate)
                if hasEndDate {
                    DatePicker("Fine", selection: $endDate, in: startDate..., displayedComponents: .date)
                }
            }

            medicationPanel("Scorte") {
                Toggle("Tieni il conto", isOn: $tracksStock)
                if tracksStock {
                    quantityField("Quantita disponibile", value: $stockQuantity)
                    Toggle("Avviso scorta bassa", isOn: $hasRefillThreshold)
                    if hasRefillThreshold {
                        quantityField("Avvisa quando restano", value: $refillThreshold)
                    }
                }
            }

            medicationPanel("Dettagli") {
                TextField("Motivo", text: $reason, axis: .vertical).lineLimit(1...3).medicationInput()
                TextField("Nota", text: $note, axis: .vertical).lineLimit(2...5).medicationInput()
            }
                }
                .padding(.top, 12)
            } label: {
                Label("Periodo, scorte e dettagli", systemImage: "slider.horizontal.3")
                    .font(.headline)
            }
            .padding(16)
            .mhdGlassPanel(tint: ExperiencePalette.medication.opacity(0.04))

            Button("Salva terapia", action: save)
                .disabled(!canSave)
                .frame(maxWidth: .infinity)
                .mhdGlassButton(prominent: true)
            }
            .padding(20)
        }
        .navigationTitle(medication == nil ? "Nuova terapia" : "Modifica terapia")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Annulla") { dismiss() }
            }
        }
        .onAppear(perform: loadMedication)
    }

    private func medicationPanel<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 13) {
            Text(title).font(.title3.bold())
            content()
        }
        .padding(18)
        .mhdGlassPanel(tint: ExperiencePalette.medication.opacity(0.05))
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !dose.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            (!hasEndDate || !hasStartDate || endDate >= startDate)
    }

    private var structuredTimes: [MedicationTime]? {
        guard style == .fixedTimes else { return nil }
        return scheduledTimes.map {
            let components = Calendar.current.dateComponents([.hour, .minute], from: $0)
            return MedicationTime(hour: components.hour ?? 0, minute: components.minute ?? 0)
        }.sorted { ($0.hour, $0.minute) < ($1.hour, $1.minute) }
    }

    private var scheduleText: String {
        switch style {
        case .fixedTimes:
            return (structuredTimes ?? []).map(\.label).joined(separator: ", ")
        case .interval:
            return "Ogni \(intervalHours) ore"
        case .asNeeded:
            return "Al bisogno"
        }
    }

    private func quantityField(_ title: String, value: Binding<Double>) -> some View {
        LabeledContent(title) {
            TextField("0", value: value, format: .number.precision(.fractionLength(0...1)))
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 100)
        }
    }

    private func save() {
        var saved = medication ?? MedicationStatement(name: name, dose: dose, schedule: scheduleText)
        saved.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        saved.dose = dose.trimmingCharacters(in: .whitespacesAndNewlines)
        saved.schedule = scheduleText
        saved.startDate = hasStartDate ? Calendar.current.startOfDay(for: startDate) : nil
        saved.endDate = hasEndDate ? Calendar.current.startOfDay(for: endDate) : nil
        saved.reason = reason.nilIfBlank
        saved.note = note.nilIfBlank
        saved.scheduleStyle = style
        saved.scheduledTimes = structuredTimes
        saved.intervalHours = style == .interval ? intervalHours : nil
        saved.stockQuantity = tracksStock ? max(stockQuantity, 0) : nil
        saved.refillThreshold = tracksStock && hasRefillThreshold ? max(refillThreshold, 0) : nil
        saved.remindersEnabled = style == .asNeeded ? false : remindersEnabled
        saved.status = status
        saved.updatedAt = .now
        store.saveMedication(saved)
        LocalReminderService.shared.cancelMedication(id: saved.id)
        LocalReminderService.shared.scheduleMedication(saved)
        dismiss()
    }

    private func loadMedication() {
        guard let medication else { return }
        name = medication.name
        dose = medication.dose
        style = medication.scheduleStyle ?? .fixedTimes
        status = medication.status
        hasStartDate = medication.startDate != nil
        startDate = medication.startDate ?? .now
        hasEndDate = medication.endDate != nil
        endDate = medication.endDate ?? .now
        reason = medication.reason ?? ""
        note = medication.note ?? ""
        tracksStock = medication.stockQuantity != nil
        stockQuantity = medication.stockQuantity ?? 30
        hasRefillThreshold = medication.refillThreshold != nil
        refillThreshold = medication.refillThreshold ?? 5
        remindersEnabled = medication.remindersEnabled ?? false
        intervalHours = medication.intervalHours ?? 8
        if let times = medication.scheduledTimes, !times.isEmpty {
            scheduledTimes = times.map { Self.defaultTime(hour: $0.hour).addingTimeInterval(Double($0.minute * 60)) }
        }
    }

    private static func defaultTime(hour: Int) -> Date {
        Calendar.current.date(bySettingHour: hour, minute: 0, second: 0, of: .now) ?? .now
    }
}
