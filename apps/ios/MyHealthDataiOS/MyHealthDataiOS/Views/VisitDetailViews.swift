import SwiftUI

struct RescheduleVisitView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let visit: AppointmentRecord
    @State private var date: Date

    init(visit: AppointmentRecord) {
        self.visit = visit
        _date = State(initialValue: visit.scheduledAt)
    }

    var body: some View {
        Form {
            Section { DatePicker("Nuova data e ora", selection: $date, in: Date.now..., displayedComponents: [.date, .hourAndMinute]) }
        }
        .navigationTitle("Sposta appuntamento")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Salva") {
                var updated = visit
                updated.scheduledAt = date.roundedToQuarterHour
                updated.updatedAt = .now
                store.updateAppointment(updated)
                LocalReminderService.shared.cancelAppointment(id: updated.id)
                LocalReminderService.shared.scheduleAppointment(updated)
                dismiss()
                }
            }
        }
    }
}

struct VisitDetailView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var isCompleting = false
    @State private var isRescheduling = false
    @State private var isEditing = false
    @State private var isAddingReport = false
    let visit: AppointmentRecord

    private var linkedDocument: HealthDocument? {
        guard let id = visit.linkedDocumentId else { return nil }
        return store.snapshot.documents.first { $0.id == id }
    }

    var body: some View {
        List {
            Section {
                Label {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(visit.reason ?? visit.title).font(.headline)
                        Text(visit.category?.label ?? "Appuntamento").font(.subheadline).foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: visit.category?.symbol ?? "calendar")
                        .foregroundStyle(.blue)
                }
            }
            Section("Dettagli") { visitInformation }
            Section("Referto") {
                if let document = linkedDocument {
                    NavigationLink { DocumentPreviewView(document: document) } label: {
                        Label("Apri referto", systemImage: "doc.text.fill")
                    }
                } else if visit.status != .cancelled {
                    Button("Aggiungi referto", systemImage: "doc.badge.plus") { isAddingReport = true }
                }
            }
            if visit.status == .planned {
                Section {
                    Button("Segna svolta", systemImage: "checkmark") { isCompleting = true }
                    Button("Sposta appuntamento", systemImage: "calendar.badge.clock") { isRescheduling = true }
                }
            } else if visit.status == .awaitingReport {
                Section { Button("Registra il ritiro del referto", systemImage: "doc.badge.plus") { isCompleting = true } }
            }
        }
        .navigationTitle("Appuntamento")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $isCompleting) { NavigationStack { CompleteVisitView(visit: visit) } }
        .sheet(isPresented: $isRescheduling) { NavigationStack { RescheduleVisitView(visit: visit) } }
        .sheet(isPresented: $isEditing) { NavigationStack { EditVisitView(visit: visit) } }
        .sheet(isPresented: $isAddingReport) {
            NavigationStack {
                AddDocumentView(
                    initialType: visit.category == .bloodwork ? .bloodTest : .specialistVisit,
                    initialTitle: "Referto - \(visit.reason ?? visit.title)",
                    linkedModuleId: visit.category?.documentModuleLink,
                    linkedAppointmentId: visit.id,
                    hidesClassification: true
                )
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu("Modifica", systemImage: "square.and.pencil") {
                    Button("Modifica visita", systemImage: "square.and.pencil") {
                        isEditing = true
                    }
                    Button("Elimina visita", systemImage: "trash", role: .destructive) {
                        store.deleteAppointment(id: visit.id)
                        LocalReminderService.shared.cancelAppointment(id: visit.id)
                        dismiss()
                    }
                }
            }
        }
    }

    private var visitInformation: some View {
        VStack(alignment: .leading, spacing: 16) {
            VisitDetailLine("Quando", value: visit.scheduledAt.formatted(date: .complete, time: .shortened), symbol: "calendar")
            if let clinician = visit.clinician {
                VisitDetailLine("Medico o struttura", value: clinician, symbol: "building.2")
            }
            VisitDetailLine("Stato", value: visit.status.label, symbol: visit.status == .awaitingReport ? "doc.badge.clock" : "checkmark.circle")
            if let outcome = visit.outcome {
                VisitDetailLine("Esito", value: outcome, symbol: "note.text")
            }
            if let followUpAt = visit.followUpAt {
                VisitDetailLine("Da prenotare", value: "Follow-up dal \(followUpAt.formatted(date: .abbreviated, time: .omitted))", symbol: "calendar.badge.exclamationmark")
            }
        }
    }
}

private struct VisitDetailLine: View {
    let title: String
    let value: String
    let symbol: String

    init(_ title: String, value: String, symbol: String) {
        self.title = title
        self.value = value
        self.symbol = symbol
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: symbol)
                .foregroundStyle(.blue)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Text(value).font(.body)
            }
            Spacer(minLength: 0)
        }
    }
}

private struct EditVisitView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let visit: AppointmentRecord

    @State private var category: VisitCategory
    @State private var reason: String
    @State private var clinician: String
    @State private var scheduledAt: Date
    @State private var questions: String
    @State private var recurrenceNote: String
    @State private var preparationNotes: String
    @State private var outcome: String
    @State private var linkedDocumentId: String?
    @State private var hasReportCollectionDate: Bool
    @State private var reportCollectionAt: Date
    @State private var hasFollowUp: Bool
    @State private var followUpAt: Date
    @State private var hasReminder: Bool
    @State private var reminderMinutes: Int
    @State private var showsCategoryPicker = false
    @State private var isAddingReport = false

    init(visit: AppointmentRecord) {
        self.visit = visit
        _category = State(initialValue: visit.category ?? .general)
        _reason = State(initialValue: visit.reason ?? (visit.title == (visit.category?.label ?? "") ? "" : visit.title))
        _clinician = State(initialValue: visit.clinician ?? "")
        _scheduledAt = State(initialValue: visit.scheduledAt)
        _questions = State(initialValue: (visit.questions ?? []).joined(separator: "\n"))
        _recurrenceNote = State(initialValue: visit.recurrenceNote ?? "")
        _preparationNotes = State(initialValue: visit.preparationNotes ?? "")
        _outcome = State(initialValue: visit.outcome ?? "")
        _linkedDocumentId = State(initialValue: visit.linkedDocumentId)
        _hasReportCollectionDate = State(initialValue: visit.reportCollectionAt != nil)
        _reportCollectionAt = State(initialValue: visit.reportCollectionAt ?? visit.scheduledAt.addingTimeInterval(7 * 86_400))
        _hasFollowUp = State(initialValue: visit.followUpAt != nil)
        _followUpAt = State(initialValue: visit.followUpAt ?? Date().addingTimeInterval(365 * 86_400))
        _hasReminder = State(initialValue: visit.reminderMinutesBefore != nil)
        _reminderMinutes = State(initialValue: visit.reminderMinutesBefore ?? 1_440)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Button {
                    showsCategoryPicker = true
                } label: {
                    Label(category.label, systemImage: category.symbol)
                        .font(.headline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.vertical, 8)
                }
                .mhdGlassCapsule(tint: Color.blue.opacity(0.10), interactive: true)

                TextField("Motivo o titolo (facoltativo)", text: $reason, axis: .vertical)
                    .mhdInputField()
                TextField("Medico o struttura (facoltativo)", text: $clinician)
                    .mhdInputField()
                DatePicker("Quando", selection: $scheduledAt, displayedComponents: [.date, .hourAndMinute])
                TextField("Cose da ricordare o da chiedere", text: $questions, axis: .vertical)
                    .lineLimit(3...7)
                    .mhdInputField()
                DisclosureGroup("Dettagli avanzati") {
                    VStack(alignment: .leading, spacing: 12) {
                        TextField("Ricorrenza o cadenza", text: $recurrenceNote, axis: .vertical)
                            .lineLimit(2...4)
                            .mhdInputField()
                        TextField("Preparazione", text: $preparationNotes, axis: .vertical)
                            .lineLimit(2...5)
                            .mhdInputField()
                        TextField("Esito o indicazioni", text: $outcome, axis: .vertical)
                            .lineLimit(2...6)
                            .mhdInputField()
                        Toggle("Ricorda il ritiro del referto", isOn: $hasReportCollectionDate)
                        if hasReportCollectionDate {
                            DatePicker("Quando ritirarlo", selection: $reportCollectionAt, displayedComponents: [.date, .hourAndMinute])
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
                    }
                    .padding(.top, 8)
                }
                .font(.headline)
                Toggle("Ricorda un follow-up", isOn: $hasFollowUp)
                if hasFollowUp {
                    DatePicker("Da quando prenotarlo", selection: $followUpAt, displayedComponents: .date)
                }
                Text("Referto").font(.headline).padding(.top, 4)
                if linkedDocumentId == nil {
                    Button("Aggiungi referto", systemImage: "doc.badge.plus") { isAddingReport = true }
                        .buttonStyle(.bordered)
                } else {
                    Label("Referto collegato", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Button("Sostituisci referto", systemImage: "arrow.triangle.2.circlepath") { isAddingReport = true }
                        .buttonStyle(.bordered)
                }
            }
            .padding(20)
        }
        .navigationTitle("Modifica visita")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) { Button("Salva", action: save) }
        }
        .sheet(isPresented: $showsCategoryPicker) {
            NavigationStack { VisitCategoryPicker(selection: $category) }
        }
        .sheet(isPresented: $isAddingReport) {
            NavigationStack {
                AddDocumentView(
                    initialType: category == .bloodwork ? .bloodTest : .specialistVisit,
                    initialTitle: "Referto - \(displayTitle)",
                    linkedModuleId: category.documentModuleLink,
                    linkedAppointmentId: visit.id,
                    hidesClassification: true
                ) { document in
                    linkedDocumentId = document.id
                }
            }
        }
    }

    private var displayTitle: String {
        let trimmed = reason.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? category.label : trimmed
    }

    private func save() {
        var updated = visit
        let trimmedQuestions = questions
            .components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        updated.category = category
        updated.title = displayTitle
        updated.reason = reason.trimmingCharacters(in: .whitespacesAndNewlines).nilIfBlankForDashboard
        updated.clinician = clinician.nilIfBlankForDashboard
        updated.scheduledAt = scheduledAt.roundedToQuarterHour
        updated.questions = trimmedQuestions.isEmpty ? nil : trimmedQuestions
        updated.recurrenceNote = recurrenceNote.nilIfBlankForDashboard
        updated.preparationNotes = preparationNotes.nilIfBlankForDashboard
        updated.outcome = outcome.nilIfBlankForDashboard
        updated.linkedDocumentId = linkedDocumentId
        updated.reportCollectionAt = hasReportCollectionDate ? reportCollectionAt.roundedToQuarterHour : nil
        updated.followUpAt = hasFollowUp ? Calendar.current.startOfDay(for: followUpAt) : nil
        updated.reminderMinutesBefore = hasReminder ? reminderMinutes : nil
        updated.updatedAt = .now
        store.updateAppointment(updated)
        dismiss()
    }
}
