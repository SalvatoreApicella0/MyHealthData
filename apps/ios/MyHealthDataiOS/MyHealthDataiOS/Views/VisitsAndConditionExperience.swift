import SwiftUI

struct EnhancedVisitsDashboardView: View {
    @Environment(HealthDataStore.self) private var store
    @State private var isAddingVisit = false
    @State private var pendingStatusChange: VisitStatusChange?
    @State private var reschedulingVisit: AppointmentRecord?
    @State private var completingVisit: AppointmentRecord?
    @State private var selectedDay = Date()

    private let tint = Color.blue
    private let calendar = Calendar.current

    private var plannedVisits: [AppointmentRecord] {
        store.upcomingAppointments
    }

    private var reportCollections: [AppointmentRecord] {
        store.appointments
            .filter { $0.status == .awaitingReport }
            .sorted { ($0.reportCollectionAt ?? $0.scheduledAt) < ($1.reportCollectionAt ?? $1.scheduledAt) }
    }

    private var visitHistory: [AppointmentRecord] {
        store.appointments.filter { $0.status == .completed || $0.status == .cancelled }
    }

    private var followUpsToBook: [AppointmentRecord] {
        store.appointments
            .filter { ($0.status == .completed || $0.status == .awaitingReport) && $0.followUpAt != nil }
            .sorted { ($0.followUpAt ?? .distantFuture) < ($1.followUpAt ?? .distantFuture) }
    }

    private var selectedDayAppointments: [AppointmentRecord] {
        store.appointments
            .filter { calendar.isDate($0.scheduledAt, inSameDayAs: selectedDay) }
            .sorted { $0.scheduledAt < $1.scheduledAt }
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                MHDModuleHeader(title: "Appuntamenti", subtitle: "Visite, esami, ritiri e referti", symbol: "calendar", tint: tint)
                VisitsConditionSection(title: "Calendario") {
                    DatePicker("Giorno", selection: $selectedDay, in: Date.distantPast...Date.distantFuture, displayedComponents: .date)
                        .datePickerStyle(.graphical)
                        .labelsHidden()
                        .tint(tint)

                    if selectedDayAppointments.isEmpty {
                        Text("Nessun appuntamento per questo giorno.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 4)
                    } else {
                        ForEach(selectedDayAppointments) { visit in
                            NavigationLink { VisitDetailView(visit: visit) } label: {
                                VisitHistoryRow(visit: visit)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                VisitsConditionSection(title: "In programma") {
                    if plannedVisits.isEmpty {
                        VisitsConditionEmptyState(
                            title: "Nessuna visita in programma",
                            icon: "calendar",
                            detail: "Le nuove visite compariranno qui."
                        )
                    } else {
                        ForEach(plannedVisits) { visit in
                            EnhancedVisitRow(
                                visit: visit,
                                onComplete: { completingVisit = visit },
                                onReschedule: { reschedulingVisit = visit },
                                onCancel: { pendingStatusChange = .init(visit: visit, status: .cancelled) }
                            )
                        }
                    }
                }

                if !reportCollections.isEmpty {
                    VisitsConditionSection(title: "Referti da ritirare") {
                        ForEach(reportCollections) { visit in
                            NavigationLink {
                                VisitDetailView(visit: visit)
                            } label: {
                                VisitHistoryRow(visit: visit)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if !followUpsToBook.isEmpty {
                    VisitsConditionSection(title: "Da prenotare") {
                        ForEach(followUpsToBook) { visit in
                            NavigationLink { VisitDetailView(visit: visit) } label: {
                                FollowUpRow(visit: visit)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                VisitsConditionSection(title: "Storico") {
                    if visitHistory.isEmpty {
                        VisitsConditionEmptyState(
                            title: "Storico vuoto",
                            icon: "clock.arrow.circlepath",
                            detail: "Le visite completate o annullate resteranno disponibili qui."
                        )
                    } else {
                        ForEach(visitHistory) { visit in
                            NavigationLink {
                                VisitDetailView(visit: visit)
                            } label: {
                                VisitHistoryRow(visit: visit)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding()
        }
        .background(tint.opacity(0.035))
        .overlay(alignment: .bottomTrailing) {
            Button { isAddingVisit = true } label: {
                Label("Aggiungi visita", systemImage: "plus")
                    .font(.headline)
                    .padding(.horizontal, 18)
                    .frame(height: 48)
            }
            .mhdGlassCapsule(tint: tint.opacity(0.18), interactive: true)
            .padding(22)
            .accessibilityLabel("Aggiungi appuntamento")
        }
        .sheet(isPresented: $isAddingVisit) {
            NavigationStack {
                EnhancedAddVisitView()
            }
        }
        .sheet(item: $reschedulingVisit) { visit in
            NavigationStack { RescheduleVisitView(visit: visit) }
        }
        .sheet(item: $completingVisit) { visit in
            NavigationStack { CompleteVisitView(visit: visit) }
        }
        .alert(
            pendingStatusChange?.status == .completed ? "Segnare la visita come completata?" : "Annullare la visita?",
            isPresented: Binding(
                get: { pendingStatusChange != nil },
                set: { if !$0 { pendingStatusChange = nil } }
            ),
        ) {
            if let change = pendingStatusChange {
                Button(change.status == .completed ? "Segna completata" : "Annulla visita", role: change.status == .cancelled ? .destructive : nil) {
                    store.updateAppointmentStatus(id: change.visit.id, status: change.status)
                    pendingStatusChange = nil
                }
            }
            Button("Indietro", role: .cancel) {
                pendingStatusChange = nil
            }
        }
    }

}
