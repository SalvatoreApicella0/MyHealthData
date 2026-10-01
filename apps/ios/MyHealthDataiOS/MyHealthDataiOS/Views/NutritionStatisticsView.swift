import Charts
import SwiftUI

struct NutritionStatisticsView: View {
    enum Period: Int, CaseIterable, Identifiable {
        case week = 7, month = 30, quarter = 90
        var id: Int { rawValue }
        var title: String { switch self { case .week: "7 giorni"; case .month: "30 giorni"; case .quarter: "90 giorni" } }
    }

    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @AppStorage("nutrition.dailyCalorieGoal") private var calorieGoal = 2_000.0
    let tint: Color
    @State private var period: Period = .week

    private var points: [NutritionDayPoint] {
        let calendar = Calendar.current
        let end = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: .now)) ?? .now
        let start = calendar.date(byAdding: .day, value: -(period.rawValue - 1), to: calendar.startOfDay(for: .now)) ?? .now
        let grouped = Dictionary(grouping: store.foodLogEntries(from: start, to: end)) { calendar.startOfDay(for: $0.loggedAt) }
        return (0..<period.rawValue).compactMap { offset in
            guard let date = calendar.date(byAdding: .day, value: offset, to: start) else { return nil }
            let entries = grouped[date] ?? []
            return NutritionDayPoint(
                date: date,
                calories: entries.reduce(0) { $0 + $1.calories },
                protein: entries.reduce(0) { $0 + ($1.protein ?? 0) },
                carbohydrates: entries.reduce(0) { $0 + ($1.carbohydrates ?? 0) },
                fat: entries.reduce(0) { $0 + ($1.fat ?? 0) }
            )
        }
    }

    private var loggedPoints: [NutritionDayPoint] { points.filter { $0.calories > 0 } }
    private var averageCalories: Double {
        guard !loggedPoints.isEmpty else { return 0 }
        return loggedPoints.reduce(0) { $0 + $1.calories } / Double(loggedPoints.count)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                Picker("Periodo", selection: $period) {
                    ForEach(Period.allCases) { Text($0.title).tag($0) }
                }.pickerStyle(.segmented)

                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Media giornaliera").font(.subheadline).foregroundStyle(.secondary)
                        Text("\(averageCalories.formatted(.number.precision(.fractionLength(0)))) kcal")
                            .font(.largeTitle.bold().monospacedDigit())
                    }
                    Spacer()
                    Image(systemName: averageCalories <= calorieGoal ? "checkmark.circle.fill" : "arrow.up.circle.fill")
                        .font(.title).foregroundStyle(averageCalories <= calorieGoal ? tint : .orange)
                }.padding(20).mhdGlassPanel(tint: tint.opacity(0.06))

                chartPanel("Calorie per giorno") {
                    Chart(points) { point in
                        BarMark(x: .value("Giorno", point.date, unit: .day), y: .value("kcal", point.calories))
                            .foregroundStyle(point.calories <= calorieGoal ? tint : Color.orange)
                        RuleMark(y: .value("Obiettivo", calorieGoal)).foregroundStyle(.secondary.opacity(0.5)).lineStyle(.init(dash: [5]))
                    }
                }

                chartPanel("Macronutrienti") {
                    Chart(points) { point in
                        BarMark(x: .value("Giorno", point.date, unit: .day), y: .value("Grammi", point.protein))
                            .foregroundStyle(by: .value("Macro", "Proteine"))
                        BarMark(x: .value("Giorno", point.date, unit: .day), y: .value("Grammi", point.carbohydrates))
                            .foregroundStyle(by: .value("Macro", "Carboidrati"))
                        BarMark(x: .value("Giorno", point.date, unit: .day), y: .value("Grammi", point.fat))
                            .foregroundStyle(by: .value("Macro", "Grassi"))
                    }
                    .chartForegroundStyleScale(["Proteine": Color.blue, "Carboidrati": Color.orange, "Grassi": Color.pink])
                }
            }
            .frame(maxWidth: 820).padding()
        }
        .navigationTitle("Statistiche alimentari")
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Fine") { dismiss() } } }
    }

    private func chartPanel<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title).font(.title2.bold())
            content().frame(height: 250)
        }
        .padding(20)
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(.primary.opacity(0.08), lineWidth: 0.75))
    }
}

private struct NutritionDayPoint: Identifiable {
    var id: Date { date }
    let date: Date
    let calories: Double
    let protein: Double
    let carbohydrates: Double
    let fat: Double
}
