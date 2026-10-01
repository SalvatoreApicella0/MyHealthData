import SwiftUI

private enum WaterQuickOption: Double, CaseIterable, Identifiable {
    case glass = 250, bottle = 500, largeBottle = 750, liter = 1000
    var id: Double { rawValue }
    var title: String { "\(Int(rawValue)) mL" }
}

private enum CoffeeQuickDrink: String, CaseIterable, Identifiable {
    case espresso, cappuccino, americano
    var id: String { rawValue }
    var title: String {
        switch self { case .espresso: "Espresso"; case .cappuccino: "Cappuccino"; case .americano: "Americano" }
    }
    var caffeineMG: Double {
        switch self { case .espresso: 63; case .cappuccino: 63; case .americano: 154 }
    }
    var volumeML: Double {
        switch self { case .espresso: 30; case .cappuccino: 150; case .americano: 200 }
    }
}

private enum AlcoholQuickDrink: String, CaseIterable, Identifiable {
    case wine, beer, longDrink, shortDrink, shot
    var id: String { rawValue }
    var title: String {
        switch self {
        case .wine: "Vino"; case .beer: "Birra"; case .longDrink: "Long drink"
        case .shortDrink: "Short drink"; case .shot: "Shot"
        }
    }
    var units: Double {
        switch self {
        case .wine: 1.5; case .beer: 1.3; case .longDrink: 1.0; case .shortDrink: 1.0; case .shot: 1.0
        }
    }
    var symbol: String {
        switch self {
        case .wine: "wineglass.fill"; case .beer: "mug.fill"
        case .longDrink: "wineglass"; case .shortDrink: "cylinder.fill"; case .shot: "cylinder.fill"
        }
    }
}

private struct QuickLogPreferences: Codable, Equatable {
    var waterML = 250.0
    var coffeeDrink = CoffeeQuickDrink.espresso.rawValue
    var alcoholDrink = AlcoholQuickDrink.wine.rawValue

    static func decode(_ raw: String) -> QuickLogPreferences {
        guard let data = raw.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(QuickLogPreferences.self, from: data) else { return QuickLogPreferences() }
        return decoded
    }

    var encoded: String {
        guard let data = try? JSONEncoder().encode(self) else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }
}

private struct HydrationGoalPreferences: Codable, Equatable {
    var waterGoalML = 2_000.0
    var alcoholWeeklyUA = 10.0
    var caffeineDailyReferenceMG = 400.0

    static func decode(_ raw: String) -> HydrationGoalPreferences {
        guard let data = raw.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(HydrationGoalPreferences.self, from: data) else { return HydrationGoalPreferences() }
        return decoded
    }

    var encoded: String {
        guard let data = try? JSONEncoder().encode(self) else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }
}

struct FoodHydrationBlock: View {
    @Environment(HealthDataStore.self) private var store
    let date: Date
    let tint: Color
    let favoriteMeasurementIDs: Set<String>
    let onToggleMeasurementFavorite: ((MeasurementType) -> Void)?

    @AppStorage("mhd.quicklog") private var quickLogRaw = ""
    @AppStorage("mhd.hydration.goals") private var goalsRaw = ""
    @State private var isShowingSettings = false

    private let calendar = Calendar.current

    private var interval: DateInterval {
        calendar.dateInterval(of: .day, for: date) ?? DateInterval(start: date, duration: 86_400)
    }

    private var preferences: QuickLogPreferences { QuickLogPreferences.decode(quickLogRaw) }
    private var goals: HydrationGoalPreferences { HydrationGoalPreferences.decode(goalsRaw) }

    private var waterML: Double {
        store.measurements(for: .dietaryWater, from: interval.start, to: interval.end)
            .reduce(0) { $0 + milliliters($1) }
    }

    private var caffeineMG7: Double {
        let start = calendar.date(byAdding: .day, value: -6, to: interval.start) ?? interval.start
        return store.measurements(for: .dietaryCaffeine, from: start, to: interval.end).reduce(0) { $0 + $1.value }
    }

    private var alcoholUA7: Double {
        let start = calendar.date(byAdding: .day, value: -6, to: interval.start) ?? interval.start
        return store.measurements(for: .alcoholUnits, from: start, to: interval.end).reduce(0) { $0 + $1.value }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Acqua, caffè e alcol").font(.title2.bold())
                Spacer()
                favoriteButton(for: .dietaryWater)
                favoriteButton(for: .dietaryCaffeine)
                favoriteButton(for: .alcoholUnits)
                Button { isShowingSettings = true } label: {
                    Image(systemName: "gearshape.fill").frame(width: 34, height: 34)
                }
                .buttonStyle(.plain)
                .mhdGlassCircle(tint: tint.opacity(0.12), interactive: true)
                .accessibilityLabel("Impostazioni rapide bevande")
            }

            hydrationRings
            quickAdds

            Text("Linea guida: meno è meglio; non esiste una quantità di alcol priva di rischio.")
                .font(.caption).foregroundStyle(.secondary)
        }
        .padding(18)
        .mhdGlassPanel(tint: tint.opacity(0.06))
        .sheet(isPresented: $isShowingSettings) {
            NavigationStack { HydrationQuickSettingsView(tint: tint) }
        }
    }

    @ViewBuilder
    private func favoriteButton(for type: MeasurementType) -> some View {
        if let onToggleMeasurementFavorite {
            MHDMetricFavoriteButton(
                type: type,
                tint: tint,
                isFavorite: favoriteMeasurementIDs.contains("measurement:\(type.rawValue)"),
                onToggle: { onToggleMeasurementFavorite(type) }
            )
        }
    }

    private func quickLogMenu<Content: View>(
        title: String,
        subtitle: String,
        symbol: String,
        color: Color,
        compact: Bool = false,
        @ViewBuilder options: () -> Content,
        primaryAction: @escaping () -> Void
    ) -> some View {
        Menu {
            options()
        } label: {
            Group {
                if compact {
                    HStack(spacing: 7) {
                        Image(systemName: symbol).font(.subheadline).foregroundStyle(color)
                            .frame(width: 28, height: 28).mhdGlassCircle(tint: color.opacity(0.14))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(title).font(.caption.weight(.semibold)).foregroundStyle(.primary).lineLimit(1)
                            Text(subtitle).font(.caption2).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.75)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(7)
                    .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
                } else {
                    HStack(spacing: 10) {
                        Image(systemName: symbol).font(.headline).foregroundStyle(color)
                            .frame(width: 38, height: 38).mhdGlassCircle(tint: color.opacity(0.14))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                            Text(subtitle).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 0)
                        Image(systemName: "plus.circle.fill").foregroundStyle(color)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, minHeight: 76, alignment: .leading)
                }
            }
            .contentShape(Rectangle())
            .mhdGlassPanel(tint: color.opacity(0.05))
        } primaryAction: {
            primaryAction()
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Registra \(title)")
        .accessibilityValue(subtitle)
        .accessibilityHint("Tocca per aggiungere \(subtitle). Apri il menu per scegliere un'altra quantità.")
    }

    private var hydrationRings: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) {
                waterRing
                caffeineRing
                alcoholRing
            }

            VStack(spacing: 10) {
                HStack(spacing: 10) { waterRing; caffeineRing }
                HStack { Spacer(minLength: 0); alcoholRing; Spacer(minLength: 0) }
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var waterRing: some View {
        NutritionProgressRing(value: waterML, goal: goals.waterGoalML, title: "Acqua oggi", tint: tint, size: 88)
    }

    private var caffeineRing: some View {
        NutritionProgressRing(value: caffeineMG7, goal: goals.caffeineDailyReferenceMG * 7, title: "Caffeina · 7 gg", tint: .brown, size: 88)
    }

    private var alcoholRing: some View {
        NutritionProgressRing(value: alcoholUA7, goal: goals.alcoholWeeklyUA, title: "Alcol · 7 gg", tint: .purple, size: 88)
    }

    @ViewBuilder
    private var quickAdds: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) {
                waterQuickAdd(compact: true)
                coffeeQuickAdd(compact: true)
                alcoholQuickAdd(compact: true)
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 12)], spacing: 12) {
                waterQuickAdd(compact: false)
                coffeeQuickAdd(compact: false)
                alcoholQuickAdd(compact: false)
            }
        }
    }

    private func waterQuickAdd(compact: Bool) -> some View {
        quickLogMenu(title: "Acqua", subtitle: "\(Int(preferences.waterML)) mL", symbol: "drop.fill", color: tint, compact: compact) {
            ForEach(WaterQuickOption.allCases) { option in
                Button(option.title) { logWater(option.rawValue) }
            }
        } primaryAction: {
            logWater(preferences.waterML)
        }
    }

    private func coffeeQuickAdd(compact: Bool) -> some View {
        quickLogMenu(title: "Caffè", subtitle: CoffeeQuickDrink(rawValue: preferences.coffeeDrink)?.title ?? "Espresso", symbol: "cup.and.saucer.fill", color: .brown, compact: compact) {
            ForEach(CoffeeQuickDrink.allCases) { drink in
                Button(drink.title) { logCoffee(drink) }
            }
        } primaryAction: {
            logCoffee(CoffeeQuickDrink(rawValue: preferences.coffeeDrink) ?? .espresso)
        }
    }

    private func alcoholQuickAdd(compact: Bool) -> some View {
        quickLogMenu(title: "Alcol", subtitle: AlcoholQuickDrink(rawValue: preferences.alcoholDrink)?.title ?? "Vino", symbol: "wineglass.fill", color: .purple, compact: compact) {
            ForEach(AlcoholQuickDrink.allCases) { drink in
                Button(drink.title, systemImage: drink.symbol) { logAlcohol(drink) }
            }
        } primaryAction: {
            logAlcohol(AlcoholQuickDrink(rawValue: preferences.alcoholDrink) ?? .wine)
        }
    }

    private func logDate() -> Date {
        let components = calendar.dateComponents([.hour, .minute, .second], from: .now)
        let logged = calendar.date(
            bySettingHour: components.hour ?? 12,
            minute: components.minute ?? 0,
            second: components.second ?? 0,
            of: date
        ) ?? date
        return min(logged, .now)
    }

    private func logWater(_ amount: Double) {
        guard amount > 0 else { return }
        store.addMeasurement(Measurement(type: .dietaryWater, value: amount, unit: "mL", measuredAt: logDate(), note: "Quick log"))
    }

    private func logCoffee(_ drink: CoffeeQuickDrink) {
        store.addMeasurement(Measurement(
            type: .dietaryCaffeine,
            value: drink.caffeineMG,
            unit: "mg",
            measuredAt: logDate(),
            note: "drink=\(drink.rawValue)|volume_ml=\(drink.volumeML)"
        ))
    }

    private func logAlcohol(_ drink: AlcoholQuickDrink) {
        store.addMeasurement(Measurement(
            type: .alcoholUnits,
            value: drink.units,
            unit: "UA",
            measuredAt: logDate(),
            note: "drink=\(drink.rawValue)"
        ))
    }

    private func milliliters(_ entry: Measurement) -> Double {
        switch entry.unit.lowercased() {
        case "l": entry.value * 1_000
        case "fl oz", "floz", "oz": entry.value * 29.5735295625
        default: entry.value
        }
    }
}

private struct HydrationQuickSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("mhd.quicklog") private var quickLogRaw = ""
    @AppStorage("mhd.hydration.goals") private var goalsRaw = ""
    let tint: Color

    @State private var quick = QuickLogPreferences()
    @State private var goals = HydrationGoalPreferences()

    var body: some View {
        Form {
            Section("Obiettivi") {
                stepper("Acqua giornaliera", value: $goals.waterGoalML, range: 500...6_000, step: 100, unit: "mL")
                stepper("Linea guida alcol", value: $goals.alcoholWeeklyUA, range: 0...40, step: 1, unit: "UA/settimana")
                stepper("Riferimento caffeina", value: $goals.caffeineDailyReferenceMG, range: 0...600, step: 50, unit: "mg/giorno")
            }

            Section("Quick log") {
                Picker("Acqua", selection: $quick.waterML) {
                    ForEach(WaterQuickOption.allCases) { Text($0.title).tag($0.rawValue) }
                }
                Picker("Caffè", selection: $quick.coffeeDrink) {
                    ForEach(CoffeeQuickDrink.allCases) { Text($0.title).tag($0.rawValue) }
                }
                Picker("Alcol", selection: $quick.alcoholDrink) {
                    ForEach(AlcoholQuickDrink.allCases) { Text($0.title).tag($0.rawValue) }
                }
            }

            Section {
                Text("Un tocco registra il valore predefinito; tieni premuto o tocca il menu per scegliere un'alternativa.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Impostazioni rapide")
        .navigationBarTitleDisplayMode(.inline)
        .tint(tint)
        .onAppear {
            quick = QuickLogPreferences.decode(quickLogRaw)
            goals = HydrationGoalPreferences.decode(goalsRaw)
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                Button("Salva") {
                    quickLogRaw = quick.encoded
                    goalsRaw = goals.encoded
                    dismiss()
                }
                .fontWeight(.semibold)
            }
        }
    }

    private func stepper(_ title: String, value: Binding<Double>, range: ClosedRange<Double>, step: Double, unit: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                Spacer()
                Text("\(value.wrappedValue.formatted(.number.precision(.fractionLength(0)))) \(unit)")
                    .font(.subheadline.weight(.semibold)).monospacedDigit().foregroundStyle(tint)
            }
            Slider(value: value, in: range, step: step).tint(tint)
        }
    }
}
