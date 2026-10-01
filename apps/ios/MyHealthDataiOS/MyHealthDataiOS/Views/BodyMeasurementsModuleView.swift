import SwiftUI

struct BodyMeasurementsModuleView: View {
    @Environment(HealthDataStore.self) private var store
    let onlyFavorites: Bool
    let favoriteMeasurementIDs: Set<String>
    let onToggleMeasurementFavorite: ((MeasurementType) -> Void)?
    let onOpenDetail: ((MeasurementDetailRequest) -> Void)?
    @AppStorage("measurementSystem") private var measurementSystem = MeasurementSystem.metric.rawValue
    @State private var isAdding = false
    @State private var detailType: MeasurementType?
    @State private var isShowingWeightGoal = false
    @State private var scaleScanner = SmartScaleBluetoothScanner()
    @State private var savedScaleReadingID: String?
    @State private var lastSavedScaleWeight: Double?
    @State private var lastSavedScaleAt: Date?
    @State private var scaleResultText: String?
    @AppStorage("bodyMeasurements.showDerivedEstimates") private var showsDerivedEstimates = false
    @AppStorage("health.weightGoalKg") private var weightGoal = 0.0
    @AppStorage("health.weightGoalStartKg") private var weightGoalStart = 0.0
    @AppStorage("health.weightGoalStartDate") private var weightGoalStartDate = 0.0

    init(
        onlyFavorites: Bool = false,
        favoriteMeasurementIDs: Set<String> = [],
        onToggleMeasurementFavorite: ((MeasurementType) -> Void)? = nil,
        onOpenDetail: ((MeasurementDetailRequest) -> Void)? = nil
    ) {
        self.onlyFavorites = onlyFavorites
        self.favoriteMeasurementIDs = favoriteMeasurementIDs
        self.onToggleMeasurementFavorite = onToggleMeasurementFavorite
        self.onOpenDetail = onOpenDetail
    }

    private var supportedFavoriteTypes: [MeasurementType] {
        HealthFeature.bodyMeasurements.measurementTypes
    }

    private var favoriteTypes: [MeasurementType] {
        guard onlyFavorites else { return supportedFavoriteTypes }
        return supportedFavoriteTypes.filter { favoriteMeasurementIDs.contains(bodyMeasurementFavoriteID(for: $0)) }
    }

    var body: some View {
        withDetailNavigation(
            MHDDataModuleScrollView {
                LazyVStack(alignment: .leading, spacing: 16) {
                    MHDModuleHeader(title: "Misure corporee", subtitle: "Peso, circonferenze e composizione", symbol: "figure.arms.open", tint: .blue)
                    if onlyFavorites {
                        BodyMeasurementsFavoritesView(
                            favoriteTypes: favoriteTypes,
                            favoriteMeasurementIDs: favoriteMeasurementIDs,
                            onToggleMeasurementFavorite: onToggleMeasurementFavorite
                        )
                    } else {
                        BodyMeasurementsScaleControl(scanner: scaleScanner, resultText: $scaleResultText)
                        BodyMeasurementsOverviewView(
                            favoriteMeasurementIDs: favoriteMeasurementIDs,
                            onToggleMeasurementFavorite: onToggleMeasurementFavorite,
                            onOpenDetail: { openDetail($0) },
                            onAddMeasurement: { isAdding = true },
                            isShowingWeightGoal: $isShowingWeightGoal,
                            weightGoal: $weightGoal,
                            weightGoalStart: $weightGoalStart,
                            weightGoalStartDate: $weightGoalStartDate,
                            showsDerivedEstimates: showsDerivedEstimates
                        )
                    }
                }
                .padding()
                .frame(maxWidth: 960)
                .frame(maxWidth: .infinity)
            }
            .sheet(isPresented: $isAdding) {
                NavigationStack { BodyMeasurementAddView(system: system) }
            }
            .sheet(isPresented: $isShowingWeightGoal) {
                NavigationStack {
                    WeightGoalEditor(
                        latestWeight: latestWeightKg,
                        goalWeight: $weightGoal,
                        startWeight: $weightGoalStart,
                        startDateTimestamp: $weightGoalStartDate
                    )
                }
                .presentationDetents([.medium, .large])
            }
            .onChange(of: scaleScanner.latestReading) { _, reading in
                guard let reading, savedScaleReadingID != reading.id else { return }
                if let lastSavedScaleWeight, let lastSavedScaleAt,
                   abs(lastSavedScaleWeight - reading.weightKilograms) < 0.05,
                   reading.capturedAt.timeIntervalSince(lastSavedScaleAt) < 300 {
                    return
                }
                saveScaleReading(reading)
            }
            .onDisappear { scaleScanner.stopScan() }
        )
    }

    @ViewBuilder
    private func withDetailNavigation<Content: View>(_ content: Content) -> some View {
        if onOpenDetail == nil {
            content.navigationDestination(item: $detailType) { type in
                MeasurementDetailView(type: type, title: type.label, symbol: "figure.arms.open", tint: MHDPalette.aqua)
            }
        } else {
            content
        }
    }

    private func openDetail(_ type: MeasurementType) {
        if let onOpenDetail {
            onOpenDetail(MeasurementDetailRequest(type: type, title: type.label, symbol: "figure.arms.open", tint: MHDPalette.aqua))
        } else {
            detailType = type
        }
    }

    private var system: MeasurementSystem {
        MeasurementSystem(rawValue: measurementSystem) ?? .metric
    }

    private var latestWeightKg: Double? {
        store.measurements(for: .weight).first.map { normalizedWeight($0) }
    }

    private func normalizedWeight(_ measurement: Measurement) -> Double {
        switch measurement.unit.lowercased() {
        case "lb", "lbs": measurement.value * 0.45359237
        default: measurement.value
        }
    }

    private func saveScaleReading(_ reading: SmartScaleReading) {
        guard savedScaleReadingID != reading.id else { return }
        savedScaleReadingID = reading.id
        lastSavedScaleWeight = reading.weightKilograms
        lastSavedScaleAt = reading.capturedAt
        scaleScanner.stopScan()
        var note = "Bilancia Bluetooth \(reading.deviceName) · \(reading.protocolVariant) · raw=\(reading.rawManufacturerData)"
        if let impedance = reading.impedanceOhms { note += " · impedenza grezza \(impedance) Ω" }
        if let code = reading.rawBodySignalCode { note += " · segnale non validato \(String(format: "0x%04X", code))" }
        store.addMeasurement(Measurement(type: .weight, value: reading.weightKilograms, unit: "kg", measuredAt: reading.capturedAt, note: note))
        var profile = store.snapshot.profile ?? LocalProfile()
        profile.currentWeightKg = reading.weightKilograms
        profile.updatedAt = .now
        store.saveProfile(profile)
        withAnimation(.snappy) { scaleResultText = "\(reading.weightKilograms.formatted(.number.precision(.fractionLength(1...2)))) kg salvati" }
        Task {
            try? await Task.sleep(for: .seconds(2.2))
            withAnimation(.snappy) { scaleResultText = nil }
        }
    }
}
