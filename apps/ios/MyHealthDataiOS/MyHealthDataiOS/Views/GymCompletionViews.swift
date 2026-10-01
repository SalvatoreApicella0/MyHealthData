import SwiftUI

struct GymCompletionContext: Identifiable {
    let plan: GymPlan
    let day: GymPlanDay

    var id: String {
        "\(plan.id)-\(day.id)"
    }
}

struct GymCompletionView: View {
    let context: GymCompletionContext
    let onSave: (GymWorkout) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(context.day.name)
                        .font(.title2.bold())
                    Text("\(context.day.exercises.count) esercizi · \(setCount) serie")
                        .foregroundStyle(.secondary)
                }

                TextField("Nota opzionale su come è andata", text: $notes, axis: .vertical)
                    .lineLimit(3...6)
                    .padding(14)
                    .mhdGlassPanel(tint: .orange.opacity(0.04))

                Button("Registra come completato", systemImage: "checkmark.circle.fill") {
                    onSave(makeWorkout())
                    dismiss()
                }
                .frame(maxWidth: .infinity)
                .mhdGlassButton(prominent: true)

                Spacer()
            }
            .padding()
            .navigationTitle("Completa allenamento")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var setCount: Int {
        context.day.exercises.reduce(0) { $0 + $1.sets }
    }

    private func makeWorkout() -> GymWorkout {
        let sets = context.day.exercises.flatMap { planned in
            (1...planned.sets).map { setNumber in
                GymSet(
                    exerciseId: planned.exerciseId,
                    setNumber: setNumber,
                    repetitions: planned.repetitions,
                    load: planned.load,
                    unit: planned.unit
                )
            }
        }

        return GymWorkout(
            name: "\(context.plan.name) · \(context.day.name)",
            startedAt: .now,
            endedAt: .now,
            sets: sets,
            notes: notes.isEmpty ? nil : notes,
            planId: context.plan.id,
            planDayId: context.day.id
        )
    }
}
