import SceneKit
import SwiftUI
import UIKit


/// Camera-only state for the body viewer. It contains no event, marker or
/// profile data, so it is safe to keep in UserDefaults between view lifecycles.
struct BodyPainCameraState: Codable, Equatable, Sendable {
    struct Vector: Codable, Equatable, Sendable {
        var x: Double
        var y: Double
        var z: Double

        init(_ value: SCNVector3) {
            x = Double(value.x)
            y = Double(value.y)
            z = Double(value.z)
        }

        var sceneKitValue: SCNVector3 {
            SCNVector3(Float(x), Float(y), Float(z))
        }
    }

    struct Quaternion: Codable, Equatable, Sendable {
        var x: Double
        var y: Double
        var z: Double
        var w: Double

        init(_ value: SCNQuaternion) {
            x = Double(value.x)
            y = Double(value.y)
            z = Double(value.z)
            w = Double(value.w)
        }

        var sceneKitValue: SCNQuaternion {
            SCNQuaternion(Float(x), Float(y), Float(z), Float(w))
        }
    }

    var position: Vector
    var orientation: Quaternion
    var target: Vector
    var fieldOfView: Double
}

enum BodyPainCameraStateStore {
    // Keep camera coordinates isolated by model version. A pose saved for one
    // differently-scaled mesh must never be applied to the Web atlas.
    static let userDefaultsKey = "mhd.bodyPain.cameraState.bodyparts3d-4.0.v1"

    static func load(from defaults: UserDefaults = .standard) -> BodyPainCameraState? {
        guard let data = defaults.data(forKey: userDefaultsKey) else { return nil }
        return try? JSONDecoder().decode(BodyPainCameraState.self, from: data)
    }

    static func save(_ state: BodyPainCameraState, to defaults: UserDefaults = .standard) {
        guard let data = try? JSONEncoder().encode(state) else { return }
        defaults.set(data, forKey: userDefaultsKey)
    }
}

/// Canonical 3D pain experience. This is the only body-pain viewer in the app.
struct BodyPain3DView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedFilter: BodyEventFilter = .all
    @State private var isPickingPoint = false
    @State private var pendingPoint: BodyPoint?
    @State private var isAddingEvent = false
    @State private var selectedEventID: String?
    @State private var editingEvent: HealthEvent?
    @State private var deletingEvent: HealthEvent?

    private var visibleEvents: [HealthEvent] {
        selectedFilter.filter(store.events)
    }

    var body: some View {
        MHDDataModuleScrollView {
            VStack(spacing: 18) {
                if store.loadFailed {
                    ContentUnavailableView(
                        "Dati non disponibili",
                        systemImage: "lock.trianglebadge.exclamationmark",
                        description: Text(store.lastError ?? "Impossibile aprire il vault.")
                    )
                } else {
                    MHDModuleHeader(title: "Dolori corporei", subtitle: "Sintomi su punti precisi", symbol: "figure.stand", tint: MHDPalette.coral)
                        .padding(.horizontal)
                    ZStack(alignment: .bottom) {
                        DigitalTwinSceneView(
                            isPickingPoint: isPickingPoint,
                            pendingPoint: pendingPoint,
                            events: visibleEvents,
                            selectedEventID: selectedEventID,
                            onPointPicked: { point in
                                withAnimation(reduceMotion ? nil : .snappy) {
                                    pendingPoint = point
                                    isPickingPoint = false
                                }
                            }
                        )
                        .frame(maxWidth: .infinity)
                        .frame(height: 540)
                        .background(
                            LinearGradient(
                                colors: [
                                    Color(red: 0.02, green: 0.06, blue: 0.08),
                                    Color(red: 0.05, green: 0.13, blue: 0.16),
                                    Color(red: 0.09, green: 0.18, blue: 0.21)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )

                        pointSelectionControls
                            .padding(.horizontal, 14)
                            .padding(.bottom, 12)
                    }

                    painHistory
                        .padding(.horizontal)
                        .padding(.bottom, 24)
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Filtra marker", selection: $selectedFilter) {
                        ForEach(BodyEventFilter.allCases) { filter in
                            Label(filter.title, systemImage: filter.systemImage)
                                .tag(filter)
                        }
                    }
                } label: {
                    Label("Filtri", systemImage: selectedFilter == .all ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill")
                }
                .accessibilityLabel("Filtra marker corpo")
            }
        }
        .sheet(isPresented: $isAddingEvent, onDismiss: {
            pendingPoint = nil
        }) {
            NavigationStack {
                AddEventView(
                    preselectedRegion: pendingPoint?.approximateRegionId,
                    preselectedBodyPoint: pendingPoint
                )
            }
        }
        .sheet(item: $editingEvent) { event in
            NavigationStack { AddEventView(existingEvent: event) }
        }
        .confirmationDialog(
            "Eliminare questo dolore?",
            isPresented: Binding(
                get: { deletingEvent != nil },
                set: { if !$0 { deletingEvent = nil } }
            )
        ) {
            if let event = deletingEvent {
                Button("Elimina", role: .destructive) {
                    store.deleteEvent(id: event.id)
                    if selectedEventID == event.id { selectedEventID = nil }
                    deletingEvent = nil
                }
            }
            Button("Annulla", role: .cancel) {}
        } message: {
            Text("Il record verrà rimosso dal vault locale.")
        }
    }

    private var painHistory: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Storico dolori").font(.title2.bold())
            let events = store.events.filter { $0.bodyPoint != nil || $0.bodyRegionId != nil }
                .sorted { $0.occurredAt > $1.occurredAt }
            if events.isEmpty {
                ContentUnavailableView(
                    "Nessun dolore registrato",
                    systemImage: "figure.stand",
                    description: Text("Scegli un punto sul corpo per iniziare.")
                )
            } else {
                    LazyVStack(spacing: 10) {
                    ForEach(events) { event in
                        HStack(spacing: 12) {
                            Button {
                                withAnimation(reduceMotion ? nil : .snappy) { selectedEventID = event.id }
                            } label: {
                                HStack(spacing: 12) {
                                    Circle().fill(selectedEventID == event.id ? Color.cyan : Color.red).frame(width: 10, height: 10)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(event.type.label).font(.headline)
                                        Text(event.bodyPoint?.approximateRegionLabel ?? event.bodyRegionId?.label ?? "Punto sul corpo")
                                            .font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Text(event.occurredAt.formatted(.dateTime.day().month(.abbreviated).year()))
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("\(event.type.label), \(event.bodyPoint?.approximateRegionLabel ?? event.bodyRegionId?.label ?? "Punto sul corpo")")
                            .accessibilityValue(selectedEventID == event.id ? "Selezionato" : "Non selezionato")
                            .accessibilityHint("Seleziona il punto corrispondente sul corpo 3D")

                            Menu {
                                Button("Modifica", systemImage: "pencil") { editingEvent = event }
                                Button("Elimina", systemImage: "trash", role: .destructive) { deletingEvent = event }
                            } label: {
                                Image(systemName: "ellipsis.circle").frame(width: 34, height: 34)
                            }
                            .accessibilityLabel("Azioni dolore")
                        }
                        .padding(14)
                        .mhdGlassCapsule(tint: (selectedEventID == event.id ? Color.cyan : Color.red).opacity(0.08))
                    }
                }
            }
        }
    }

    private var pointSelectionControls: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(pointSelectionTitle)
                    .font(.headline)
                Text(pointSelectionSubtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if pendingPoint != nil {
                Button("Annulla") {
                    withAnimation(reduceMotion ? nil : .snappy) {
                        pendingPoint = nil
                    }
                }
                .mhdGlassButton()

                Button {
                    isAddingEvent = true
                } label: {
                    Label("Conferma", systemImage: "checkmark")
                }
                .mhdGlassButton(prominent: true)
            } else {
                Button {
                    withAnimation(reduceMotion ? nil : .snappy) {
                        isPickingPoint.toggle()
                    }
                } label: {
                    Label(isPickingPoint ? "Tocca il corpo" : "Scegli punto", systemImage: isPickingPoint ? "hand.tap.fill" : "scope")
                }
                .mhdGlassButton(prominent: true)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .mhdGlassCapsule(tint: Color.mhdPrimary.opacity(0.12))
        .shadow(color: Color.black.opacity(0.18), radius: 12, y: 6)
    }

    private var pointSelectionTitle: String {
        if let pendingPoint {
            return pendingPoint.approximateRegionLabel
        }
        return isPickingPoint ? "Tocca un punto preciso" : "Corpo 3D"
    }

    private var pointSelectionSubtitle: String {
        if pendingPoint != nil {
            return "Conferma per registrare un evento in questo punto."
        }
        return isPickingPoint ? "Ruota/zoom prima, poi tocca il punto esatto." : "Ruota e zooma il modello. Premi Scegli punto per fissare un punto."
    }
}

private enum BodyEventFilter: String, CaseIterable, Identifiable {
    case all
    case today
    case last30Days
    case last60Days
    case lastYear

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: "Tutti"
        case .today: "Nascondi passati"
        case .last30Days: "Ultimi 30 giorni"
        case .last60Days: "Ultimi 60 giorni"
        case .lastYear: "Ultimo anno"
        }
    }

    var systemImage: String {
        switch self {
        case .all: "circle.grid.2x2"
        case .today: "calendar"
        case .last30Days: "calendar.badge.clock"
        case .last60Days: "calendar.badge.clock"
        case .lastYear: "calendar.badge.clock"
        }
    }

    func filter(_ events: [HealthEvent], now: Date = .now, calendar: Calendar = .current) -> [HealthEvent] {
        switch self {
        case .all:
            return events
        case .today:
            let startOfDay = calendar.startOfDay(for: now)
            return events.filter { $0.occurredAt >= startOfDay }
        case .last30Days:
            return eventsSince(daysAgo: 30, from: now, calendar: calendar, in: events)
        case .last60Days:
            return eventsSince(daysAgo: 60, from: now, calendar: calendar, in: events)
        case .lastYear:
            return eventsSince(daysAgo: 365, from: now, calendar: calendar, in: events)
        }
    }

    private func eventsSince(daysAgo days: Int, from now: Date, calendar: Calendar, in events: [HealthEvent]) -> [HealthEvent] {
        guard let start = calendar.date(byAdding: .day, value: -days, to: now) else {
            return events
        }
        return events.filter { $0.occurredAt >= start }
    }
}
