import Charts
import SwiftUI

struct HealthMetricModuleView: View {
    @Environment(HealthDataStore.self) private var store
    var module: HealthMetricModule
    var onlyFavorites = false
    var favoriteIDs: Set<String> = []
    var onToggleFavorite: ((MeasurementType) -> Void)?
    var onOpenDetail: ((MeasurementDetailRequest) -> Void)?

    @State private var timeWindow = HealthTimeWindow(scale: .week, anchor: .now)
    @State private var selectedAddType: MeasurementType?
    @State private var selectedInfoType: MeasurementType?
    @State private var selectedDetailType: MeasurementType?
    @State private var isShowingOrder = false
    @AppStorage private var storedOrder: String
    @AppStorage private var usesTwoColumns: Bool

    init(module: HealthMetricModule) {
        self.module = module
        _storedOrder = AppStorage(wrappedValue: "", "metricOrder.\(module.storageKey)")
        _usesTwoColumns = AppStorage(wrappedValue: false, "metricLayout.twoColumns.\(module.storageKey)")
    }

    init(
        module: HealthMetricModule,
        onlyFavorites: Bool,
        favoriteIDs: Set<String>,
        onToggleFavorite: ((MeasurementType) -> Void)?,
        onOpenDetail: ((MeasurementDetailRequest) -> Void)? = nil
    ) {
        self.module = module
        self.onlyFavorites = onlyFavorites
        self.favoriteIDs = favoriteIDs
        self.onToggleFavorite = onToggleFavorite
        self.onOpenDetail = onOpenDetail
        _storedOrder = AppStorage(wrappedValue: "", "metricOrder.\(module.storageKey)")
        _usesTwoColumns = AppStorage(wrappedValue: false, "metricLayout.twoColumns.\(module.storageKey)")
    }

    private var orderedTypes: [MeasurementType] {
        let saved = storedOrder.split(separator: ",").compactMap { MeasurementType(rawValue: String($0)) }
            .filter { module.types.contains($0) }
        return saved + module.types.filter { !saved.contains($0) }
    }

    @ViewBuilder
    private var moduleContent: some View {
        if onlyFavorites {
            if favoriteTypes.isEmpty {
                Text("Nessuna metrica preferita in questa sezione.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(18)
                    .mhdGlassPanel(tint: module.tint.opacity(0.05))
            } else {
                LazyVGrid(columns: graphColumns, spacing: 14) {
                    ForEach(favoriteTypes) { type in metricPanel(type) }
                }
            }
        } else {
            switch module {
            case .activity:
                activityContent
            case .heart:
                standardContent(orderedTypes)
            default:
                LazyVGrid(columns: graphColumns, spacing: 14) {
                    ForEach(orderedTypes) { type in metricPanel(type) }
                }
            }
        }
    }

    @ViewBuilder
    private func standardContent(_ types: [MeasurementType]) -> some View {
        let populated = types.filter { allTimeHasData($0) }
        let empty = types.filter { !allTimeHasData($0) }
        LazyVGrid(columns: graphColumns, spacing: 14) {
            ForEach(populated) { type in metricPanel(type) }
        }
        if !empty.isEmpty {
            DisclosureGroup {
                LazyVGrid(columns: graphColumns, spacing: 14) {
                    ForEach(empty) { type in metricPanel(type) }
                }
                .padding(.top, 8)
            } label: {
                Label("Altri dati", systemImage: "ellipsis.circle")
                    .font(.headline)
            }
            .padding(16)
            .mhdGlassPanel(tint: module.tint.opacity(0.05))
        }
    }

    @ViewBuilder
    private var activityContent: some View {
        let specialGroups: [[MeasurementType]] = [
            [.exerciseMinutes],
            [.walkingSpeed],
            [.stairAscentSpeed, .stairDescentSpeed],
            [.distanceWalkingRunning, .distanceCycling, .distanceSwimming],
            [.walkingStepLength, .walkingAsymmetry, .walkingDoubleSupport]
        ]
        let specials = Set(specialGroups.flatMap { $0 })
        let remaining = orderedTypes.filter { !specials.contains($0) }
        let remainingPopulated = remaining.filter { allTimeHasData($0) }
        let emptySpecials = specialGroups.filter { !hasAnyData($0) }.flatMap { $0 }
        let emptyTypes = remaining.filter { !allTimeHasData($0) } + emptySpecials

        LazyVGrid(columns: graphColumns, spacing: 14) {
            if hasAnyData([.exerciseMinutes]) { exerciseMinutesPanel }
            if hasAnyData([.walkingSpeed]) { walkingPacePanel }
            if hasAnyData([.stairAscentSpeed, .stairDescentSpeed]) { stairsPanel }
            if hasAnyData([.distanceWalkingRunning, .distanceCycling, .distanceSwimming]) { distancesPanel }
            ForEach(remainingPopulated) { type in metricPanel(type) }
        }
        if hasAnyData([.walkingStepLength, .walkingAsymmetry, .walkingDoubleSupport]) {
            gaitTablePanel
        }
        if !emptyTypes.isEmpty {
            DisclosureGroup {
                LazyVGrid(columns: graphColumns, spacing: 14) {
                    ForEach(emptyTypes) { type in metricPanel(type) }
                }
                .padding(.top, 8)
            } label: {
                Label("Altri dati", systemImage: "ellipsis.circle")
                    .font(.headline)
            }
            .padding(16)
            .mhdGlassPanel(tint: module.tint.opacity(0.05))
        }
    }

    private func allTimeHasData(_ type: MeasurementType) -> Bool {
        !store.measurements(for: type).isEmpty
    }

    private func hasAnyData(_ types: [MeasurementType]) -> Bool {
        types.contains { allTimeHasData($0) }
    }

    @ViewBuilder
    private func specialCardHeader(_ title: String, symbol: String, favoriteTypes: [MeasurementType] = []) -> some View {
        HStack(spacing: 8) {
            Label(title, systemImage: symbol)
                .font(.headline)
                .foregroundStyle(module.tint)
            Spacer()
            ForEach(favoriteTypes) { type in
                metricFavoriteButton(type)
            }
        }
    }

    @ViewBuilder
    private func metricFavoriteButton(_ type: MeasurementType) -> some View {
        if let onToggleFavorite {
            let isFavorite = favoriteIDs.contains("measurement:\(type.rawValue)")
            Button { onToggleFavorite(type) } label: {
                Image(systemName: isFavorite ? "star.fill" : "star")
                    .frame(width: 30, height: 30)
            }
            .buttonStyle(.plain)
            .foregroundStyle(isFavorite ? Color.mhdWarm : .secondary)
            .mhdGlassCircle(tint: module.tint.opacity(0.08), interactive: true)
            .accessibilityLabel(isFavorite ? "Rimuovi \(type.label) dai preferiti" : "Aggiungi \(type.label) ai preferiti")
            .accessibilityAddTraits(isFavorite ? .isSelected : [])
        }
    }

    private func weeklyExercise(_ offset: Int, week: DateInterval, calendar: Calendar) -> Double {
        guard let anchor = calendar.date(byAdding: .weekOfYear, value: -offset, to: week.start),
              let interval = calendar.dateInterval(of: .weekOfYear, for: anchor) else { return 0 }
        return store.measurements(for: .exerciseMinutes, from: interval.start, to: interval.end)
            .reduce(0) { $0 + $1.value }
    }

    private var exerciseMinutesPanel: some View {
        let calendar = Calendar.current
        let now = Date.now
        let week = calendar.dateInterval(of: .weekOfYear, for: now)
            ?? DateInterval(start: now, duration: 7 * 86_400)
        let thisWeek = store.measurements(for: .exerciseMinutes, from: week.start, to: now)
            .reduce(0) { $0 + $1.value }
        let last4 = (1...4).map { weeklyExercise($0, week: week, calendar: calendar) }.filter { $0 > 0 }
        let last12 = (1...12).map { weeklyExercise($0, week: week, calendar: calendar) }.filter { $0 > 0 }
        let average4 = last4.isEmpty ? nil : last4.reduce(0, +) / Double(last4.count)
        let average12 = last12.isEmpty ? nil : last12.reduce(0, +) / Double(last12.count)

        return VStack(alignment: .leading, spacing: 14) {
            specialCardHeader("Minuti di esercizio", symbol: "figure.run", favoriteTypes: [.exerciseMinutes])
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(formattedValue(thisWeek))
                    .font(.system(size: 34, weight: .bold, design: .rounded)).monospacedDigit()
                Text("min questa settimana").font(.subheadline).foregroundStyle(.secondary)
            }
            HStack(spacing: 16) {
                if let average4 {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(formattedValue(average4)).font(.headline.monospacedDigit())
                        Text("media 4 settimane").font(.caption2).foregroundStyle(.secondary)
                    }
                }
                if let average12 {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(formattedValue(average12)).font(.headline.monospacedDigit())
                        Text("media 12 settimane").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
            Text("L'OMS consiglia almeno 150 minuti a settimana di attività moderata.")
                .font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .mhdGlassPanel(tint: module.tint.opacity(0.05))
    }

    private var walkingPacePanel: some View {
        let latest = store.measurements(for: .walkingSpeed).first
        let pace = latest.map { 1_000 / max($0.value, 0.1) / 60 }

        return VStack(alignment: .leading, spacing: 14) {
            specialCardHeader("Passo", symbol: "figure.walk", favoriteTypes: [.walkingSpeed])
            if let pace, let latest {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(formattedValue(pace))
                        .font(.system(size: 34, weight: .bold, design: .rounded)).monospacedDigit()
                    Text("min/km").font(.subheadline).foregroundStyle(.secondary)
                }
                Text("Da velocità media \(formattedValue(latest.value)) \(latest.unit) · \(latest.measuredAt.mhdRelativeDescription())")
                    .font(.caption).foregroundStyle(.secondary)
            } else {
                Text("Nessun dato").font(.subheadline).foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .mhdGlassPanel(tint: module.tint.opacity(0.05))
    }

    private var stairsPanel: some View {
        let ascent = store.measurements(for: .stairAscentSpeed).first
        let descent = store.measurements(for: .stairDescentSpeed).first

        return VStack(alignment: .leading, spacing: 14) {
            specialCardHeader("Scale", symbol: "figure.stairs", favoriteTypes: [.stairAscentSpeed, .stairDescentSpeed])
            if let ascent {
                stairRow("Salita", speed: ascent)
            }
            if let descent {
                stairRow("Discesa", speed: descent)
            }
            Text("Stima indicativa: 3 metri per piano.")
                .font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .mhdGlassPanel(tint: module.tint.opacity(0.05))
    }

    private func stairRow(_ title: String, speed: Measurement) -> some View {
        let floors = speed.value * 60 / 3
        return HStack {
            Text(title).font(.subheadline.weight(.semibold))
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(formattedValue(floors)) piani/min").font(.subheadline.bold().monospacedDigit())
                Text(speed.measuredAt.mhdRelativeDescription()).font(.caption2).foregroundStyle(.secondary)
            }
        }
    }

    private var distancesPanel: some View {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        let walkingToday = store.measurements(for: .distanceWalkingRunning, from: today, to: .now)
            .reduce(0) { $0 + $1.value }
        let weekStart = calendar.date(byAdding: .day, value: -6, to: today) ?? today
        let walkingWeek = store.measurements(for: .distanceWalkingRunning, from: weekStart, to: .now)
        let grouped = Dictionary(grouping: walkingWeek) { calendar.startOfDay(for: $0.measuredAt) }
        let average7 = grouped.isEmpty ? nil : grouped.values.map { $0.reduce(0) { $0 + $1.value } }.reduce(0, +) / Double(grouped.count)
        let cycling = store.measurements(for: .distanceCycling).first
        let swimming = store.measurements(for: .distanceSwimming).first

        return VStack(alignment: .leading, spacing: 14) {
            specialCardHeader("Distanze", symbol: "map", favoriteTypes: [.distanceWalkingRunning, .distanceCycling, .distanceSwimming])
            VStack(alignment: .leading, spacing: 2) {
                Text("Camminata e corsa").font(.caption).foregroundStyle(.secondary)
                Text("\(formattedValue(walkingToday)) km oggi")
                    .font(.headline.monospacedDigit())
                if let average7 {
                    Text("Media \(formattedValue(average7)) km negli ultimi 7 giorni")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }
            if let cycling {
                distanceRow("Bicicletta", measurement: cycling)
            }
            if let swimming {
                distanceRow("Nuoto", measurement: swimming)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .mhdGlassPanel(tint: module.tint.opacity(0.05))
    }

    private func distanceRow(_ title: String, measurement: Measurement) -> some View {
        HStack {
            Text(title).font(.subheadline.weight(.semibold))
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(formattedValue(measurement.value)) \(measurement.unit)").font(.subheadline.bold().monospacedDigit())
                Text(measurement.measuredAt.mhdRelativeDescription()).font(.caption2).foregroundStyle(.secondary)
            }
        }
    }

    private var gaitTablePanel: some View {
        let rows: [(String, MeasurementType, String)] = [
            ("Lunghezza del passo", .walkingStepLength, "cm"),
            ("Asimmetria", .walkingAsymmetry, "%"),
            ("Doppio appoggio", .walkingDoubleSupport, "%")
        ]
        let values = rows.map { ($0.0, store.measurements(for: $0.1).first, $0.2) }

        return VStack(alignment: .leading, spacing: 12) {
            specialCardHeader("Andatura", symbol: "shoeprints.fill", favoriteTypes: [.walkingStepLength, .walkingAsymmetry, .walkingDoubleSupport])
            VStack(spacing: 0) {
                HStack {
                    Text("Metrica").font(.caption.bold()).foregroundStyle(.secondary)
                    Spacer()
                    Text("Ultimo").font(.caption.bold()).foregroundStyle(.secondary)
                    Text("Rilevato").font(.caption.bold()).foregroundStyle(.secondary).frame(width: 92, alignment: .trailing)
                }
                .padding(.bottom, 6)
                ForEach(Array(values.enumerated()), id: \.offset) { _, row in
                    Divider()
                    HStack {
                        Text(row.0).font(.subheadline)
                        Spacer()
                        if let measurement = row.1 {
                            Text("\(formattedValue(measurement.value)) \(row.2)")
                                .font(.subheadline.weight(.semibold).monospacedDigit())
                            Text(measurement.measuredAt.mhdRelativeDescription())
                                .font(.caption).foregroundStyle(.secondary)
                                .frame(width: 92, alignment: .trailing)
                        } else {
                            Text("Nessun dato").font(.caption).foregroundStyle(.secondary)
                            Text("").frame(width: 92)
                        }
                    }
                    .padding(.vertical, 7)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .mhdGlassPanel(tint: module.tint.opacity(0.05))
    }

    var body: some View {
        withDetailNavigation(
            MHDDataModuleScrollView {
                LazyVStack(alignment: .leading, spacing: 18) {
                    MHDModuleHeader(title: module.title, subtitle: module == .heart ? "Battito, pressione, ossigenazione e respiro" : module.subtitle, symbol: module.symbol, tint: module.tint)
                    CompactHealthTimeNavigator(window: $timeWindow, tint: module.tint)
                    moduleContent
                }
                .frame(maxWidth: 900)
                .padding()
                .frame(maxWidth: .infinity)
            }
            .tint(module.tint)
            .toolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    Button("Organizza grafici", systemImage: "slider.horizontal.3") { isShowingOrder = true }
                }
            }
            .sheet(item: $selectedAddType) { type in
                if type == .systolicPressure || type == .diastolicPressure {
                    BloodPressureQuickEntry(tint: module.tint)
                        .presentationDetents([.medium])
                } else {
                    MetricQuickEntry(type: type, tint: module.tint)
                        .presentationDetents([.medium])
                }
            }
            .sheet(item: $selectedInfoType) { type in
                NavigationStack { MetricInfoView(type: type, tint: module.tint) }
                    .presentationDetents([.medium])
            }
            .sheet(isPresented: $isShowingOrder) {
                NavigationStack {
                    MetricOrderView(types: orderedTypes, tint: module.tint, usesTwoColumns: $usesTwoColumns) { order in
                        storedOrder = order.map(\.rawValue).joined(separator: ",")
                    }
                }
            }
        )
    }

    @ViewBuilder
    private func withDetailNavigation<Content: View>(_ content: Content) -> some View {
        if onOpenDetail == nil {
            content.navigationDestination(item: $selectedDetailType) { type in
                MeasurementDetailView(type: type, title: type.label, symbol: module.symbol, tint: module.tint)
            }
        } else {
            content
        }
    }

    private var graphColumns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 14), count: usesTwoColumns ? 2 : 1)
    }

    private var favoriteTypes: [MeasurementType] {
        guard onlyFavorites else { return orderedTypes }
        return orderedTypes.filter { favoriteIDs.contains("measurement:\($0.rawValue)") }
    }

    @ViewBuilder
    private func metricPanel(_ type: MeasurementType) -> some View {
        HealthMetricChartPanel(
            module: module,
            type: type,
            timeWindow: timeWindow,
            usesTwoColumns: usesTwoColumns,
            favoriteIDs: favoriteIDs,
            onToggleFavorite: onToggleFavorite,
            onOpenDetail: onOpenDetail,
            onSelectDetail: { selectedDetailType = $0 },
            onShowInfo: { selectedInfoType = $0 },
            onAdd: { selectedAddType = $0 }
        )
    }

    private func formattedValue(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0...1)))
    }
}
