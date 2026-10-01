import SwiftUI

struct NutritionModuleView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let onlyFavorites: Bool
    let favoriteMeasurementIDs: Set<String>
    let onToggleMeasurementFavorite: ((MeasurementType) -> Void)?
    @AppStorage("nutrition.dailyCalorieGoal") private var calorieGoal = 2_000.0
    @AppStorage("nutrition.proteinGoal") private var proteinGoal = 120.0
    @AppStorage("nutrition.carbohydrateGoal") private var carbohydrateGoal = 250.0
    @AppStorage("nutrition.fatGoal") private var fatGoal = 70.0

    @State private var selectedDate = Date()
    @State private var detailedMeal: NutritionMealGroup?
    @State private var isShowingSettings = false
    @State private var isShowingStatistics = false
    @State private var isShowingRecipes = false
    @State private var directAddMeal: NutritionMealType?

    private let tint = Color(red: 0.22, green: 0.76, blue: 0.38)
    private let calendar = Calendar.current

    init(
        onlyFavorites: Bool = false,
        favoriteMeasurementIDs: Set<String> = [],
        onToggleMeasurementFavorite: ((MeasurementType) -> Void)? = nil
    ) {
        self.onlyFavorites = onlyFavorites
        self.favoriteMeasurementIDs = favoriteMeasurementIDs
        self.onToggleMeasurementFavorite = onToggleMeasurementFavorite
    }

    private var supportedFavoriteTypes: [MeasurementType] {
        [.dietaryEnergy, .dietaryWater, .dietaryCaffeine, .alcoholUnits]
    }

    private var favoriteTypes: [MeasurementType] {
        guard onlyFavorites else { return supportedFavoriteTypes }
        return supportedFavoriteTypes.filter { favoriteMeasurementIDs.contains(favoriteID(for: $0)) }
    }

    private func favoriteID(for type: MeasurementType) -> String {
        "measurement:\(type.rawValue)"
    }

    @ViewBuilder
    private func favoriteButton(for type: MeasurementType) -> some View {
        if let onToggleMeasurementFavorite {
            MHDMetricFavoriteButton(
                type: type,
                tint: tint,
                isFavorite: favoriteMeasurementIDs.contains(favoriteID(for: type)),
                onToggle: { onToggleMeasurementFavorite(type) }
            )
        }
    }

    private var interval: DateInterval {
        calendar.dateInterval(of: .day, for: selectedDate) ?? DateInterval(start: selectedDate, duration: 86_400)
    }

    private var entries: [FoodLogEntry] {
        store.foodLogEntries(from: interval.start, to: interval.end).sorted { $0.loggedAt < $1.loggedAt }
    }

    private var mealGroups: [NutritionMealGroup] { NutritionMealGroup.allCases }

    private var legacyEnergy: Double {
        store.measurements(for: .dietaryEnergy, from: interval.start, to: interval.end)
            .reduce(0) { $0 + ($1.unit.lowercased() == "kj" ? $1.value / 4.184 : $1.value) }
    }

    private var totals: NutritionTotals {
        entries.reduce(into: NutritionTotals(calories: legacyEnergy)) { $0.add($1) }
    }

    var body: some View {
        MHDDataModuleScrollView {
            LazyVStack(spacing: 20) {
                HStack(alignment: .top, spacing: 10) {
                    MHDModuleHeader(title: "Diario alimentare", subtitle: "Pasti, energia, idratazione e alcol", symbol: "fork.knife", tint: tint)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    favoriteButton(for: .dietaryEnergy)
                }
                if onlyFavorites {
                    favoritesContent
                } else {
                    dayNavigator
                    energyHero
                    meals
                    FoodHydrationBlock(
                        date: selectedDate,
                        tint: tint,
                        favoriteMeasurementIDs: favoriteMeasurementIDs,
                        onToggleMeasurementFavorite: onToggleMeasurementFavorite
                    )
                    if legacyEnergy > 0 { importedEnergy }
                }
            }
            .frame(maxWidth: 900)
            .padding()
            .frame(maxWidth: .infinity)
        }
        .tint(tint)
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Button("Ricette", systemImage: "book.pages") { isShowingRecipes = true }
                Button("Statistiche", systemImage: "chart.bar.xaxis") { isShowingStatistics = true }
                Button("Impostazioni", systemImage: "gearshape.fill") { isShowingSettings = true }
            }
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 45).onEnded { value in
                guard abs(value.translation.width) > abs(value.translation.height) * 1.4 else { return }
                if value.translation.width > 0 { moveDay(-1) }
                else if !calendar.isDateInToday(selectedDate) { moveDay(1) }
            }
        )
        .sheet(item: $detailedMeal) { group in
            NavigationStack {
                MealDetailView(group: group, date: selectedDate, tint: tint)
            }
        }
        .sheet(item: $directAddMeal) { meal in
            NavigationStack { FoodPickerView(meal: meal, date: selectedDate, tint: tint) }
        }
        .sheet(isPresented: $isShowingRecipes) {
            NavigationStack {
                RecipeLibraryView(meal: .snack, date: selectedDate, tint: tint) { isShowingRecipes = false }
                    .navigationTitle("Ricette")
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Chiudi") { isShowingRecipes = false } } }
            }
        }
        .sheet(isPresented: $isShowingStatistics) {
            NavigationStack { NutritionStatisticsView(tint: tint) }
        }
        .sheet(isPresented: $isShowingSettings) {
            NavigationStack { NutritionSettingsView(tint: tint) }
        }
    }

    @ViewBuilder
    private var favoritesContent: some View {
        if favoriteTypes.isEmpty {
            ContentUnavailableView(
                "Nessuna metrica alimentare preferita",
                systemImage: "star",
                description: Text("Aggiungi una stella a energia, acqua, caffeina o alcol per mostrarla qui.")
            )
        } else {
            VStack(alignment: .leading, spacing: 14) {
                Text("Preferiti").font(.title2.bold())
                ForEach(favoriteTypes) { type in
                    favoriteMeasurementCard(type)
                }
            }
        }
    }

    private func favoriteMeasurementCard(_ type: MeasurementType) -> some View {
        let measurement = store.measurements(for: type).first
        let value = measurement?.value.formatted(.number.precision(.fractionLength(0...1))) ?? "-"
        return HStack(spacing: 12) {
            Image(systemName: symbol(for: type))
                .foregroundStyle(color(for: type))
                .frame(width: 38, height: 38)
                .mhdGlassCircle(tint: color(for: type).opacity(0.12))
            VStack(alignment: .leading, spacing: 3) {
                Text(type.label).font(.headline)
                Text(measurement.map { "\(value) \($0.unit) · \($0.measuredAt.mhdRelativeDescription())" } ?? "Nessun dato")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            favoriteButton(for: type)
        }
        .padding(14)
        .mhdGlassPanel(tint: color(for: type).opacity(0.05))
    }

    private func symbol(for type: MeasurementType) -> String {
        switch type {
        case .dietaryEnergy: "flame.fill"
        case .dietaryWater: "drop.fill"
        case .dietaryCaffeine: "cup.and.saucer.fill"
        case .alcoholUnits: "wineglass.fill"
        default: "fork.knife"
        }
    }

    private func color(for type: MeasurementType) -> Color {
        switch type {
        case .dietaryEnergy: tint
        case .dietaryWater: .cyan
        case .dietaryCaffeine: .brown
        case .alcoholUnits: .purple
        default: tint
        }
    }

    private var dayNavigator: some View {
        HStack(spacing: 10) {
            Button { moveDay(-1) } label: { Image(systemName: "chevron.left").frame(width: 38, height: 38) }
                .mhdGlassCircle(tint: tint.opacity(0.1), interactive: true)
                .accessibilityLabel("Giorno precedente")
            Text(compactDateTitle)
                .font(.headline)
                .accessibilityLabel("Diario del \(compactDateTitle)")
            Button { moveDay(1) } label: { Image(systemName: "chevron.right").frame(width: 38, height: 38) }
                .mhdGlassCircle(tint: tint.opacity(0.1), interactive: true)
                .disabled(calendar.isDateInToday(selectedDate))
                .accessibilityLabel("Giorno successivo")
        }
        .frame(maxWidth: .infinity)
    }

    private var energyHero: some View {
        HStack(alignment: .center, spacing: 14) {
                NutritionProgressRing(
                    value: totals.calories,
                    goal: calorieGoal,
                    title: "kcal",
                    tint: tint,
                    size: 132
                )
            HStack(spacing: 8) {
                CompactMacroRing(title: "Proteine", value: totals.protein, goal: proteinGoal, tint: .blue)
                CompactMacroRing(title: "Carbo", value: totals.carbohydrates, goal: carbohydrateGoal, tint: .orange)
                CompactMacroRing(title: "Grassi", value: totals.fat, goal: fatGoal, tint: .pink)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(16)
        .mhdGlassPanel(tint: tint.opacity(0.07))
    }

    private var meals: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Pasti").font(.title2.bold())
                Spacer()
                Text("4 gruppi · le categorie extra confluiscono in Spuntini")
                    .font(.caption2).foregroundStyle(.secondary)
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(mealGroups) { group in
                    MealTile(
                        group: group,
                        entries: entries.filter { group.contains($0.meal) },
                        onOpen: { detailedMeal = group },
                        onAdd: { directAddMeal = group.representativeMeal }
                    )
                }
            }
        }
    }

    private var importedEnergy: some View {
        Label("\(legacyEnergy.formatted(.number.precision(.fractionLength(0)))) kcal da Apple Health o dati precedenti", systemImage: "heart.circle.fill")
            .font(.subheadline.weight(.medium))
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(17)
            .mhdGlassCapsule(tint: tint.opacity(0.05))
    }

    private var compactDateTitle: String {
        let date = selectedDate.formatted(.dateTime.day().month(.wide))
        return calendar.isDateInToday(selectedDate) ? "Oggi, \(date)" : date
    }

    private func moveDay(_ offset: Int) {
        withAnimation(reduceMotion ? nil : .snappy) {
            selectedDate = calendar.date(byAdding: .day, value: offset, to: selectedDate) ?? selectedDate
        }
    }
}
private enum NutritionMealGroup: String, CaseIterable, Identifiable {
    case breakfast, lunch, dinner, snacks

    var id: String { rawValue }

    var title: String {
        switch self {
        case .breakfast: "Colazione"
        case .lunch: "Pranzo"
        case .dinner: "Cena"
        case .snacks: "Spuntini"
        }
    }

    var symbol: String {
        switch self {
        case .breakfast: "sunrise.fill"
        case .lunch: "sun.max.fill"
        case .dinner: "moon.stars.fill"
        case .snacks: "carrot.fill"
        }
    }

    var color: Color {
        switch self {
        case .breakfast: MHDPalette.sun
        case .lunch: MHDPalette.mint
        case .dinner: MHDPalette.iris
        case .snacks: MHDPalette.coral
        }
    }

    var representativeMeal: NutritionMealType {
        switch self {
        case .breakfast: .breakfast
        case .lunch: .lunch
        case .dinner: .dinner
        case .snacks: .snack
        }
    }

    func contains(_ meal: NutritionMealType) -> Bool {
        switch self {
        case .breakfast: meal == .breakfast
        case .lunch: meal == .lunch
        case .dinner: meal == .dinner
        case .snacks: ![.breakfast, .lunch, .dinner].contains(meal)
        }
    }
}

private struct MealTile: View {
    let group: NutritionMealGroup
    let entries: [FoodLogEntry]
    let onOpen: () -> Void
    let onAdd: () -> Void

    private var total: Double { entries.reduce(0) { $0 + $1.calories } }
    private var color: Color { group.color }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: group.symbol)
                        .font(.headline)
                        .foregroundStyle(color)
                        .frame(width: 42, height: 42)
                        .mhdGlassCircle(tint: color.opacity(0.14))
                    Spacer()
                    Button(action: onAdd) {
                        Image(systemName: "plus").font(.headline).foregroundStyle(color).frame(width: 36, height: 36)
                    }
                    .buttonStyle(.plain).mhdGlassCircle(tint: color.opacity(0.1), interactive: true)
                    .accessibilityLabel("Aggiungi alimento a \(group.title)")
                    .accessibilityHint("Apre la scelta dell'alimento.")
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(group.title).font(.headline)
                    Text(entries.isEmpty ? "Aggiungi" : "\(total.formatted(.number.precision(.fractionLength(0)))) kcal")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(entries.isEmpty ? Color.secondary : color)
                    if !entries.isEmpty {
                        HStack(spacing: -6) {
                            ForEach(entries.prefix(3)) { FoodThumbnail(entry: $0, size: 26) }
                            Spacer()
                            Text("P \(macroTotal(\.protein)) · C \(macroTotal(\.carbohydrates)) · G \(macroTotal(\.fat))")
                                .font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                }
        }
        .frame(maxWidth: .infinity, minHeight: 128, alignment: .topLeading)
        .padding(15)
        .contentShape(Rectangle())
        .onTapGesture(perform: onOpen)
        .mhdGlassPanel(tint: color.opacity(0.045))
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel("\(group.title), \(entries.count) \(entries.count == 1 ? "alimento" : "alimenti")")
        .accessibilityHint("Tocca per aprire il diario del pasto.")
        .accessibilityAction(.default, onOpen)
    }

    private func macroTotal(_ keyPath: KeyPath<FoodLogEntry, Double?>) -> String {
        entries.reduce(0) { $0 + ($1[keyPath: keyPath] ?? 0) }.formatted(.number.precision(.fractionLength(0)))
    }
}

private struct MealDetailView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let group: NutritionMealGroup
    let date: Date
    let tint: Color
    @State private var isAdding = false

    private var entries: [FoodLogEntry] {
        let interval = Calendar.current.dateInterval(of: .day, for: date) ?? DateInterval(start: date, duration: 86_400)
        return store.foodLogEntries(from: interval.start, to: interval.end)
            .filter { group.contains($0.meal) }.sorted { $0.loggedAt < $1.loggedAt }
    }

    var body: some View {
        List {
            if entries.isEmpty {
                ContentUnavailableView("Nessun alimento", systemImage: group.symbol, description: Text("Aggiungi il primo alimento a \(group.title.lowercased())."))
                    .listRowBackground(Color.clear)
            } else {
                ForEach(entries) { entry in
                    HStack(spacing: 12) {
                        FoodThumbnail(entry: entry, size: 42)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(entry.name).font(.headline)
                            Text("\(entry.quantity.formatted(.number.precision(.fractionLength(0...1)))) \(entry.servingUnit) · \(entry.calories.formatted(.number.precision(.fractionLength(0)))) kcal")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Menu("Sposta", systemImage: "arrowshape.turn.up.right") {
                            ForEach(NutritionMealGroup.allCases.filter { $0 != group }) { destination in
                                Button(destination.title, systemImage: destination.symbol) {
                                    store.moveFoodLogEntry(id: entry.id, to: destination.representativeMeal)
                                }
                            }
                        }
                        .labelStyle(.iconOnly)
                    }
                    .swipeActions {
                        Button("Elimina", systemImage: "trash", role: .destructive) { store.deleteFoodLogEntry(id: entry.id) }
                        Button(entry.isFavorite ? "Rimuovi" : "Preferito", systemImage: entry.isFavorite ? "star.slash" : "star") {
                            store.toggleFoodFavorite(id: entry.id)
                        }.tint(.yellow)
                    }
                }
            }
        }
        .navigationTitle(group.title)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button("Chiudi") { dismiss() } }
            ToolbarItem(placement: .primaryAction) { Button("Aggiungi", systemImage: "plus") { isAdding = true } }
        }
        .sheet(isPresented: $isAdding) {
            NavigationStack { FoodPickerView(meal: group.representativeMeal, date: date, tint: tint) }
        }
    }
}
