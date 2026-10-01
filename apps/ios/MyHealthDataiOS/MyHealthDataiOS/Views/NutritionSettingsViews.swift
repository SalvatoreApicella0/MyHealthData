import SwiftUI

struct NutritionSettingsView: View {
    private enum ActivityLevel: String, CaseIterable, Identifiable {
        case sedentary, light, moderate, high, veryHigh

        var id: String { rawValue }
        var title: String {
            switch self {
            case .sedentary: "Sedentario · 0 allenamenti"
            case .light: "Leggero · 1–2 a settimana"
            case .moderate: "Moderato · 3–4 a settimana"
            case .high: "Molto attivo · 5–6 a settimana"
            case .veryHigh: "Intenso · 7+ o lavoro fisico"
            }
        }
        var factor: Double {
            switch self {
            case .sedentary: 1.2
            case .light: 1.375
            case .moderate: 1.55
            case .high: 1.725
            case .veryHigh: 1.9
            }
        }
        var proteinFactor: Double {
            switch self {
            case .sedentary: 1.0
            case .light: 1.2
            case .moderate: 1.4
            case .high: 1.6
            case .veryHigh: 1.8
            }
        }
    }

    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @AppStorage("nutrition.dailyCalorieGoal") private var calories = 2_000.0
    @AppStorage("nutrition.proteinGoal") private var protein = 120.0
    @AppStorage("nutrition.carbohydrateGoal") private var carbohydrates = 250.0
    @AppStorage("nutrition.fatGoal") private var fat = 70.0
    @AppStorage("nutrition.activityLevel") private var activityRaw = ActivityLevel.moderate.rawValue
    @AppStorage("health.weightGoalKg") private var storedGoalWeight = 0.0
    @AppStorage("health.weightGoalStartKg") private var storedGoalStartWeight = 0.0
    @AppStorage("health.weightGoalStartDate") private var storedGoalStartDate = 0.0
    let tint: Color

    @State private var weight = 70.0
    @State private var height = 170.0
    @State private var goalWeight = 65.0
    @State private var weeklyLoss = 0.5

    private var activity: ActivityLevel {
        get { ActivityLevel(rawValue: activityRaw) ?? .moderate }
        nonmutating set { activityRaw = newValue.rawValue }
    }

    private var age: Int {
        guard let raw = store.snapshot.profile?.birthDate,
              let date = ISO8601DateFormatter().date(from: raw) else { return 30 }
        return max(Calendar.current.dateComponents([.year], from: date, to: .now).year ?? 30, 18)
    }

    private var sexOffset: Double {
        switch store.snapshot.profile?.biologicalSex {
        case .male: 5
        case .female: -161
        default: -78
        }
    }

    private var restingEnergy: Double { max(10 * weight + 6.25 * height - 5 * Double(age) + sexOffset, 0) }
    private var maintenanceEnergy: Double { restingEnergy * activity.factor }
    private var suggestedCalories: Double { max((maintenanceEnergy - weeklyLoss * 7_700 / 7).rounded(), 1_200) }
    private var suggestedProtein: Double { (weight * activity.proteinFactor).rounded() }
    private var suggestedFat: Double { (suggestedCalories * 0.28 / 9).rounded() }
    private var suggestedCarbohydrates: Double {
        max(((suggestedCalories - suggestedProtein * 4 - suggestedFat * 9) / 4).rounded(), 0)
    }
    private var estimatedWeeks: Double { goalWeight < weight && weeklyLoss > 0 ? (weight - goalWeight) / weeklyLoss : 0 }

    var body: some View {
        Form {
            Section("Dati utilizzati") {
                LabeledContent("Peso") {
                    TextField("kg", value: $weight, format: .number).multilineTextAlignment(.trailing)
                    Text("kg").foregroundStyle(.secondary)
                }
                LabeledContent("Altezza") {
                    TextField("cm", value: $height, format: .number).multilineTextAlignment(.trailing)
                    Text("cm").foregroundStyle(.secondary)
                }
                LabeledContent("Peso obiettivo") {
                    TextField("kg", value: $goalWeight, format: .number).multilineTextAlignment(.trailing)
                    Text("kg").foregroundStyle(.secondary)
                }
                Picker("Livello di attività", selection: Binding(get: { activity }, set: { activity = $0 })) {
                    ForEach(ActivityLevel.allCases) { Text($0.title).tag($0) }
                }
            }

            Section("Ritmo desiderato") {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("Perdita settimanale")
                        Spacer()
                        Text("\(weeklyLoss.formatted(.number.precision(.fractionLength(1)))) kg").fontWeight(.semibold)
                    }
                    Slider(value: $weeklyLoss, in: 0.1...2.0, step: 0.1).tint(tint)
                    if estimatedWeeks > 0 {
                        Text("Stima lineare: circa \(Int(ceil(estimatedWeeks))) settimane")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }

            Section("Piano suggerito") {
                planRow("Metabolismo a riposo", restingEnergy, "kcal")
                planRow("Mantenimento stimato", maintenanceEnergy, "kcal")
                planRow("Obiettivo energetico", suggestedCalories, "kcal")
                planRow("Proteine", suggestedProtein, "g")
                planRow("Carboidrati", suggestedCarbohydrates, "g")
                planRow("Grassi", suggestedFat, "g")
            }

            Section("Metodo") {
                Text("Stima energetica Mifflin–St Jeor, corretta per il livello di attività. Il deficit deriva dal ritmo settimanale selezionato; i macro vengono ripartiti dando priorità alle proteine in base a peso e attività.")
                    .font(.footnote).foregroundStyle(.secondary)
                Link("Equazione Mifflin–St Jeor", destination: URL(string: "https://pubmed.ncbi.nlm.nih.gov/2305711/")!)
                Link("NIDDK Body Weight Planner", destination: URL(string: "https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner")!)
                Link("Indicazioni CDC sul dimagrimento graduale", destination: URL(string: "https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html")!)
            }

            Section {
                ForEach(NutritionMealType.allCases.filter { $0 != .other }) { meal in
                    MealCategorySettingsRow(meal: meal)
                }
            } header: {
                Text("Categorie dei pasti")
            } footer: {
                Text("Puoi rinominare le categorie e scegliere quali mostrare nella griglia del diario.")
            }
        }
        .navigationTitle("Piano alimentare")
        .onAppear(perform: loadSharedValues)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Fine") { applyPlan(); dismiss() }.fontWeight(.semibold)
            }
        }
    }

    private func planRow(_ title: String, _ value: Double, _ unit: String) -> some View {
        LabeledContent(title) {
            Text("\(value.formatted(.number.precision(.fractionLength(0)))) \(unit)")
                .fontWeight(.semibold).monospacedDigit()
        }
    }

    private func loadSharedValues() {
        weight = store.measurements(for: .weight).first?.value ?? store.snapshot.profile?.currentWeightKg ?? 70
        height = store.measurements(for: .height).first?.value ?? store.snapshot.profile?.heightCm ?? 170
        goalWeight = storedGoalWeight > 0 ? storedGoalWeight : max(weight - 5, 1)
    }

    private func applyPlan() {
        calories = suggestedCalories
        protein = suggestedProtein
        carbohydrates = suggestedCarbohydrates
        fat = suggestedFat
        storedGoalWeight = goalWeight
        if storedGoalStartWeight <= 0 {
            storedGoalStartWeight = weight
            storedGoalStartDate = Date.now.timeIntervalSince1970
        }

        var profile = store.snapshot.profile ?? LocalProfile()
        profile.currentWeightKg = weight
        profile.heightCm = height
        profile.updatedAt = .now
        store.saveProfile(profile)

        if store.measurements(for: .weight).first?.value != weight {
            store.addMeasurement(Measurement(type: .weight, value: weight, unit: "kg", measuredAt: .now, note: "Aggiornato dal piano alimentare"))
        }
        if store.measurements(for: .height).first?.value != height {
            store.addMeasurement(Measurement(type: .height, value: height, unit: "cm", measuredAt: .now, note: "Aggiornato dal piano alimentare"))
        }
    }
}

struct NutritionProgressRing: View {
    let value: Double
    let goal: Double
    let title: String
    let tint: Color
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle().stroke(tint.opacity(0.13), lineWidth: 13)
            Circle().trim(from: 0, to: min(max(value / max(goal, 1), 0), 1))
                .stroke(tint, style: StrokeStyle(lineWidth: 13, lineCap: .round)).rotationEffect(.degrees(-90))
            VStack(spacing: 1) {
                Text("\(value.formatted(.number.precision(.fractionLength(0)))) / \(goal.formatted(.number.precision(.fractionLength(0))))")
                    .font(.headline.bold().monospacedDigit())
                    .lineLimit(1)
                    .minimumScaleFactor(0.65)
                Text(title).font(.caption).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.8)
            }
        }
        .frame(width: size, height: size)
    }
}

struct CompactMacroRing: View {
    let title: String
    let value: Double
    let goal: Double
    let tint: Color

    var body: some View {
        VStack(spacing: 5) {
            ZStack {
                Circle().stroke(tint.opacity(0.13), lineWidth: 6)
                Circle().trim(from: 0, to: min(value / max(goal, 1), 1))
                    .stroke(tint, style: StrokeStyle(lineWidth: 6, lineCap: .round)).rotationEffect(.degrees(-90))
                Text(value.formatted(.number.precision(.fractionLength(0))))
                    .font(.caption.bold().monospacedDigit()).foregroundStyle(tint)
            }
            .frame(width: 54, height: 54)
            Text(title).font(.caption2.weight(.semibold)).lineLimit(1)
            Text("/ \(goal.formatted(.number.precision(.fractionLength(0)))) g")
                .font(.caption2.monospacedDigit()).foregroundStyle(.secondary).lineLimit(1)
        }
        .frame(maxWidth: .infinity)
    }
}

struct NutritionTotals {
    var calories = 0.0
    var protein = 0.0
    var carbohydrates = 0.0
    var fat = 0.0

    mutating func add(_ entry: FoodLogEntry) {
        calories += entry.calories
        protein += entry.protein ?? 0
        carbohydrates += entry.carbohydrates ?? 0
        fat += entry.fat ?? 0
    }
}

private struct MealCategorySettingsRow: View {
    let meal: NutritionMealType
    @AppStorage("nutrition.mealCategories.visible") private var visibleRaw = "breakfast,lunch,dinner,snack"
    @AppStorage private var customName: String

    init(meal: NutritionMealType) {
        self.meal = meal
        _customName = AppStorage(wrappedValue: "", "nutrition.mealName.\(meal.rawValue)")
    }

    private var isVisible: Binding<Bool> {
        Binding {
            visibleRaw.split(separator: ",").map(String.init).contains(meal.rawValue)
        } set: { visible in
            var values = visibleRaw.split(separator: ",").map(String.init)
            if visible && !values.contains(meal.rawValue) { values.append(meal.rawValue) }
            if !visible { values.removeAll { $0 == meal.rawValue } }
            visibleRaw = values.joined(separator: ",")
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle(meal.title, isOn: isVisible)
            if isVisible.wrappedValue {
                TextField(meal.title, text: $customName).font(.subheadline)
            }
        }
        .padding(.vertical, 3)
    }
}
