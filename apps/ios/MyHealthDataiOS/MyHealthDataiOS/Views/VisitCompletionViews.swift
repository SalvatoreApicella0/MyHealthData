import SwiftUI

private enum ReportHandling: String, CaseIterable, Identifiable {
    case notExpected
    case availableNow
    case collectLater

    var id: String { rawValue }
    var label: String {
        switch self {
        case .notExpected: "Nessun referto"
        case .availableNow: "Lo ricevo ora"
        case .collectLater: "Lo ritiro dopo"
        }
    }
}

struct CompleteVisitView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let visit: AppointmentRecord
    @State private var outcome: String
    @State private var linkedDocumentId: String?
    @State private var isAddingReport = false
    @State private var reportHandling: ReportHandling = .notExpected
    @State private var collectionAt = Date().addingTimeInterval(7 * 86_400)
    @State private var wantsFollowUp = false
    @State private var followUpAt = Date().addingTimeInterval(365 * 86_400)

    init(visit: AppointmentRecord) {
        self.visit = visit
        _outcome = State(initialValue: visit.outcome ?? "")
        _linkedDocumentId = State(initialValue: visit.linkedDocumentId)
        _reportHandling = State(initialValue: visit.status == .awaitingReport ? .availableNow : .notExpected)
        _collectionAt = State(initialValue: visit.reportCollectionAt ?? Date().addingTimeInterval(7 * 86_400))
        _wantsFollowUp = State(initialValue: visit.followUpAt != nil)
        _followUpAt = State(initialValue: visit.followUpAt ?? Date().addingTimeInterval(365 * 86_400))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Com'è andata").font(.title3.bold())
                    TextField("Esito, indicazioni o prossimi passi", text: $outcome, axis: .vertical)
                        .lineLimit(4...10)
                        .mhdInputField()
                }
                .padding(18)
                .mhdGlassPanel(tint: Color.blue.opacity(0.05))

                VStack(alignment: .leading, spacing: 10) {
                    Toggle("Ricordami un follow-up", isOn: $wantsFollowUp)
                    if wantsFollowUp {
                        DatePicker("Da quando prenotarlo", selection: $followUpAt, in: Date.now..., displayedComponents: .date)
                        Text("Non crea un nuovo appuntamento: resta un promemoria da programmare quando sarai pronto.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(18)
                .mhdGlassPanel(tint: Color.blue.opacity(0.05))

                VStack(alignment: .leading, spacing: 12) {
                    Text("Referto").font(.title3.bold())
                    Picker("Consegna", selection: $reportHandling) {
                        ForEach(ReportHandling.allCases) { handling in
                            Text(handling.label).tag(handling)
                        }
                    }
                    .pickerStyle(.segmented)
                    if linkedDocumentId != nil {
                        Label("Documento collegato", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }
                    if reportHandling == .availableNow {
                        Button(linkedDocumentId == nil ? "Carica referto" : "Sostituisci referto", systemImage: "doc.badge.plus") {
                            isAddingReport = true
                        }
                        .frame(maxWidth: .infinity)
                        .mhdGlassButton(prominent: linkedDocumentId == nil)
                    } else if reportHandling == .collectLater {
                        DatePicker("Quando ritirarlo", selection: $collectionAt, in: Date.now..., displayedComponents: [.date, .hourAndMinute])
                        Text("Verrà creato un promemoria collegato a questa visita. La visita resterà in stato “Referto da ritirare”.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .padding(18)
                .mhdGlassPanel(tint: Color.blue.opacity(0.05))

                Button("Completa visita") { completeVisit() }
                    .frame(maxWidth: .infinity)
                    .mhdGlassButton(prominent: true)
            }
            .padding(20)
        }
        .navigationTitle("Completa visita")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
        }
        .sheet(isPresented: $isAddingReport) {
            NavigationStack {
                AddDocumentView(
                    initialType: visit.category == .bloodwork ? .bloodTest : .specialistVisit,
                    initialTitle: "Referto - \(visit.reason ?? visit.title)",
                    linkedModuleId: visit.category?.documentModuleLink,
                    linkedAppointmentId: visit.id,
                    hidesClassification: true
                ) { document in
                    linkedDocumentId = document.id
                }
            }
        }
    }

    private func completeVisit() {
        var updated = visit
        updated.outcome = outcome.nilIfBlankForDashboard
        updated.linkedDocumentId = linkedDocumentId
        updated.status = reportHandling == .collectLater ? .awaitingReport : .completed
        updated.reportCollectionAt = reportHandling == .collectLater ? collectionAt.roundedToQuarterHour : nil
        updated.followUpAt = wantsFollowUp ? Calendar.current.startOfDay(for: followUpAt) : nil
        updated.updatedAt = .now
        store.updateAppointment(updated)
        LocalReminderService.shared.cancelAppointment(id: updated.id)

        if let parentID = visit.parentAppointmentId,
           var parent = store.appointments.first(where: { $0.id == parentID }) {
            parent.status = .completed
            parent.linkedDocumentId = linkedDocumentId
            parent.updatedAt = .now
            store.updateAppointment(parent)
        }

        if reportHandling == .collectLater {
            let collection = AppointmentRecord(
                title: "Ritira referto: \(visit.reason ?? visit.title)",
                scheduledAt: collectionAt.roundedToQuarterHour,
                category: visit.category,
                clinician: visit.clinician,
                reason: "Ritiro referto",
                parentAppointmentId: visit.id,
                reminderMinutesBefore: 1_440
            )
            store.addAppointment(collection)
            LocalReminderService.shared.scheduleAppointment(collection)
        }
        dismiss()
    }
}
