import SwiftUI

struct EnhancedAddVisitView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    private enum Field: Hashable {
        case title
    }

    private static let reminderOptions = [60, 1_440, 2_880, 10_080]

    @FocusState private var focusedField: Field?
    @State private var title = ""
    @State private var reason = ""
    @State private var category: VisitCategory = .general
    @State private var clinician = ""
    @State private var scheduledAt = Date()
    @State private var preparationNotes = ""
    @State private var outcome = ""
    @State private var recurrenceNote = ""
    @State private var hasReportCollectionDate = false
    @State private var reportCollectionAt = Date().addingTimeInterval(7 * 86_400)
    @State private var questions = ""
    @State private var followUpAt = Date().addingTimeInterval(365 * 86_400)
    @State private var hasFollowUp = false
    @State private var hasReminder = false
    @State private var reminderMinutes = 1_440
    @State private var linkedDocumentId: String?
    @State private var showsAdvanced = false
    @State private var showsCategoryPicker = false
    @State private var validationMessage: String?

    private var trimmedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var linkedDocumentIsValid: Bool {
        guard let linkedDocumentId else { return true }
        return store.snapshot.documents.contains { $0.id == linkedDocumentId }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Button {
                    validationMessage = nil
                    showsCategoryPicker = true
                } label: {
                    Label(category.label, systemImage: category.symbol)
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 14).frame(minHeight: 48)
                }
                .mhdGlassCapsule(tint: Color.blue.opacity(0.10), interactive: true)

                VStack(alignment: .leading, spacing: 10) {
                    TextField("Titolo (obbligatorio)", text: $title)
                        .focused($focusedField, equals: .title)
                        .submitLabel(.next)
                        .onSubmit { focusedField = nil }
                    DatePicker("Quando", selection: $scheduledAt, displayedComponents: [.date, .hourAndMinute])
                    TextField("Medico o struttura (facoltativo)", text: $clinician)
                    TextField("Motivo (facoltativo)", text: $reason, axis: .vertical)
                        .lineLimit(2...4)
                    TextField("Note / preparazione", text: $preparationNotes, axis: .vertical)
                        .lineLimit(2...4)
                }
                .mhdInputField()

                DisclosureGroup(isExpanded: $showsAdvanced) {
                    VStack(alignment: .leading, spacing: 10) {
                        TextField("Esito", text: $outcome, axis: .vertical)
                            .lineLimit(2...5)
                        TextField("Ricorrenza (es. ogni 6 mesi)", text: $recurrenceNote)
                        Toggle("Ricorda il ritiro del referto", isOn: $hasReportCollectionDate)
                        if hasReportCollectionDate {
                            DatePicker("Ritiro referto", selection: $reportCollectionAt, displayedComponents: .date)
                        }
                        TextField("Domande da ricordare (una per riga)", text: $questions, axis: .vertical)
                            .lineLimit(2...6)
                        Toggle("Ricorda un follow-up", isOn: $hasFollowUp)
                        if hasFollowUp {
                            DatePicker("Controllo successivo", selection: $followUpAt, displayedComponents: [.date, .hourAndMinute])
                        }
                        Toggle("Promemoria", isOn: $hasReminder)
                        if hasReminder {
                            Picker("Avvisami", selection: $reminderMinutes) {
                                Text("1 ora prima").tag(60)
                                Text("1 giorno prima").tag(1_440)
                                Text("2 giorni prima").tag(2_880)
                                Text("1 settimana prima").tag(10_080)
                            }
                        }
                        if store.snapshot.documents.isEmpty {
                            Text("Nessun documento disponibile da collegare.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        } else {
                            Picker("Documento collegato", selection: $linkedDocumentId) {
                                Text("Nessun documento").tag(nil as String?)
                                ForEach(store.snapshot.documents) { document in
                                    Text(document.title).tag(Optional(document.id))
                                }
                            }
                        }
                    }
                    .mhdInputField()
                    .padding(.top, 8)
                } label: {
                    Text("Dettagli avanzati")
                }
                .font(.headline)
                .padding(.horizontal, 2)

                if let validationMessage {
                    Label(validationMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .accessibilityAddTraits(.isStaticText)
                }
            }
            .padding(20)
        }
        .navigationTitle("Nuova visita")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Annulla") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Salva", action: save)
            }
        }
        .sheet(isPresented: $showsCategoryPicker) {
            NavigationStack { VisitCategoryPicker(selection: $category) }
        }
    }

    private func save() {
        guard validate() else { return }

        let questionItems = questions
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        let appointment = AppointmentRecord(
            title: trimmedTitle,
            scheduledAt: scheduledAt.roundedToQuarterHour,
            category: category,
            recurrenceNote: recurrenceNote.nilIfBlankForDashboard,
            clinician: clinician.nilIfBlankForDashboard,
            reason: reason.nilIfBlankForDashboard,
            outcome: outcome.nilIfBlankForDashboard,
            linkedDocumentId: linkedDocumentId,
            reportCollectionAt: hasReportCollectionDate ? Calendar.current.startOfDay(for: reportCollectionAt) : nil,
            questions: questionItems.isEmpty ? nil : questionItems,
            preparationNotes: preparationNotes.nilIfBlankForDashboard,
            followUpAt: hasFollowUp ? followUpAt.roundedToQuarterHour : nil,
            reminderMinutesBefore: hasReminder ? reminderMinutes : nil,
            status: .planned
        )
        store.addAppointment(appointment)
        LocalReminderService.shared.scheduleAppointment(appointment)
        dismiss()
    }

    private func validate() -> Bool {
        if trimmedTitle.isEmpty {
            validationMessage = "Inserisci un titolo per l'appuntamento."
            focusedField = .title
            return false
        }
        if hasReminder && !Self.reminderOptions.contains(reminderMinutes) {
            validationMessage = "Scegli un intervallo valido per il promemoria."
            return false
        }
        if !linkedDocumentIsValid {
            validationMessage = "Il documento collegato non è più disponibile."
            linkedDocumentId = nil
            return false
        }
        validationMessage = nil
        return true
    }
}
struct VisitCategoryPicker: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var selection: VisitCategory
    @State private var search = ""

    private var matches: [VisitCategory] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return VisitCategory.allCases }
        return VisitCategory.allCases.filter { $0.label.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        List {
            ForEach(VisitCategory.Group.allCases) { group in
                let categories = matches.filter { $0.group == group }
                if !categories.isEmpty {
                    Section(group.label) {
                        ForEach(categories) { category in
                            Button {
                                selection = category
                                dismiss()
                            } label: {
                                Label(category.label, systemImage: category.symbol).foregroundStyle(.primary)
                            }
                        }
                    }
                }
            }
        }
        .searchable(text: $search, prompt: "Cerca visita o esame")
        .navigationTitle("Tipo di visita")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } } }
    }
}
