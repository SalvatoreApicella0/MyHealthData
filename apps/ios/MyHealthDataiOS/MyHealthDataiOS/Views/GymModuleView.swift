import SwiftUI

struct GymModuleView: View {
    @Environment(HealthDataStore.self) private var store

    private let dataset = GymDatasetService()

    @State private var selectedPlan: GymPlan?
    @State private var editingPlan: GymPlan?
    @State private var completionContext: GymCompletionContext?

    private var recentWorkouts: [GymWorkout] {
        Array(store.gymWorkouts.prefix(8))
    }

    private var weekWorkouts: [GymWorkout] {
        let start = Calendar.current.date(byAdding: .day, value: -7, to: .now) ?? .distantPast
        return store.gymWorkouts.filter { $0.startedAt >= start }
    }

    private var muscleSets: [(name: String, count: Int)] {
        let muscleByExercise = Dictionary(
            uniqueKeysWithValues: dataset.all.map {
                ($0.id, $0.muscleGroup.isEmpty ? "Altro" : $0.muscleGroup)
            }
        )

        return Dictionary(
            grouping: weekWorkouts.flatMap(\.sets),
            by: { muscleByExercise[$0.exerciseId] ?? "Altro" }
        )
        .map { (name: $0.key, count: $0.value.count) }
        .sorted { $0.count > $1.count }
        .prefix(6)
        .map { $0 }
    }

    var body: some View {
        MHDDataModuleScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                MHDModuleHeader(
                    title: "Palestra",
                    subtitle: "Schede semplici e allenamenti registrati in un tocco",
                    symbol: "figure.strengthtraining.traditional",
                    tint: .orange
                )

                HStack(spacing: 10) {
                    GymSummaryTile(
                        title: "Ultimi 7 giorni",
                        value: "\(weekWorkouts.count)",
                        symbol: "calendar"
                    )
                    GymSummaryTile(
                        title: "Serie completate",
                        value: "\(weekWorkouts.flatMap(\.sets).count)",
                        symbol: "repeat"
                    )
                }

                if !muscleSets.isEmpty {
                    MuscleSetSummary(values: muscleSets)
                }

                sectionHeader

                ForEach(store.gymPlans) { plan in
                    GymPlanCard(
                        plan: plan,
                        onOpen: { selectedPlan = plan },
                        onEdit: { editingPlan = plan }
                    )
                }

                if store.gymPlans.isEmpty {
                    ContentUnavailableView(
                        "Nessuna scheda",
                        systemImage: "rectangle.stack.badge.plus",
                        description: Text("Crea Giorno 1, Giorno 2 e Giorno 3 con gli esercizi che vuoi monitorare.")
                    )
                    .padding()
                    .mhdGlassPanel(tint: .orange.opacity(0.05))
                }

                Text("Storico")
                    .font(.title3.bold())
                    .padding(.top, 4)

                if recentWorkouts.isEmpty {
                    Text("Nessun allenamento registrato")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(recentWorkouts) { workout in
                        workoutRow(workout)
                    }
                }
            }
            .frame(maxWidth: 860)
            .padding()
            .frame(maxWidth: .infinity)
        }
        .onAppear {
            if store.gymPlans.isEmpty {
                store.saveGymPlan(Self.defaultPlan)
            }
        }
        .sheet(item: $editingPlan) { plan in
            GymPlanEditor(plan: plan, dataset: dataset) {
                store.saveGymPlan($0)
            }
        }
        .sheet(item: $selectedPlan) { plan in
            GymPlanDetail(plan: plan, dataset: dataset) { day in
                selectedPlan = nil
                completionContext = GymCompletionContext(plan: plan, day: day)
            }
        }
        .sheet(item: $completionContext) { context in
            GymCompletionView(context: context) {
                store.saveGymWorkout($0)
            }
        }
    }

    private var sectionHeader: some View {
        HStack {
            Text("Le tue schede")
                .font(.title3.bold())
            Spacer()
            Button("Nuova", systemImage: "plus") {
                editingPlan = GymPlan(
                    name: "Nuova scheda",
                    days: [GymPlanDay(name: "Giorno 1")]
                )
            }
            .font(.subheadline.weight(.semibold))
        }
    }

    private func workoutRow(_ workout: GymWorkout) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
            VStack(alignment: .leading, spacing: 3) {
                Text(workout.name)
                    .font(.subheadline.weight(.semibold))
                Text(workout.startedAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text("\(workout.sets.count) serie")
                .font(.caption)
                .monospacedDigit()
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .mhdGlassPanel(tint: .orange.opacity(0.03))
    }

    static var defaultPlan: GymPlan {
        GymPlan(
            name: "Scheda base",
            days: (1...3).map {
                GymPlanDay(name: "Giorno \($0)", order: $0 - 1)
            }
        )
    }
}
