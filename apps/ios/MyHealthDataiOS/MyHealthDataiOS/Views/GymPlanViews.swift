import SwiftUI

struct GymPlanCard: View {
    let plan: GymPlan
    let onOpen: () -> Void
    let onEdit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "rectangle.stack.fill")
                    .foregroundStyle(.orange)
                Text(plan.name)
                    .font(.headline)
                Spacer()
                Button("Modifica", systemImage: "pencil", action: onEdit)
                    .labelStyle(.iconOnly)
            }

            Text("\(plan.days.count) giorni · \(exerciseCount) esercizi")
                .font(.caption)
                .foregroundStyle(.secondary)

            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    ForEach(plan.days.sorted { $0.order < $1.order }) { day in
                        Text(day.name)
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 9)
                            .padding(.vertical, 6)
                            .background(.orange.opacity(0.1), in: Capsule())
                    }
                }
            }
            .scrollIndicators(.hidden)
            // Preserve the compact day carousel while the parent owns the
            // vertical Dati gesture stream.
            .scrollDisabled(false)

            Button("Apri scheda", systemImage: "chevron.right", action: onOpen)
                .frame(maxWidth: .infinity)
                .mhdGlassButton(prominent: true)
        }
        .padding(16)
        .mhdGlassPanel(tint: .orange.opacity(0.05))
    }

    private var exerciseCount: Int {
        plan.days.reduce(0) { $0 + $1.exercises.count }
    }
}

struct GymPlanDetail: View {
    let plan: GymPlan
    let dataset: GymDatasetService
    let onComplete: (GymPlanDay) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(plan.days.sorted { $0.order < $1.order }) { day in
                        dayCard(day)
                    }
                }
                .padding()
            }
            .navigationTitle(plan.name)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Chiudi") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func dayCard(_ day: GymPlanDay) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(day.name)
                    .font(.headline)
                Spacer()
                Button("Fatto", systemImage: "checkmark.circle.fill") {
                    onComplete(day)
                    dismiss()
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(.orange)
            }

            if day.exercises.isEmpty {
                Text("Nessun esercizio pianificato")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(day.exercises) { planned in
                    HStack(spacing: 9) {
                        Image(systemName: "figure.strengthtraining.traditional")
                            .foregroundStyle(.orange)
                        Text(dataset.exercise(id: planned.exerciseId)?.name ?? planned.exerciseId)
                            .lineLimit(2)
                        Spacer()
                        Text(planned.summary)
                            .font(.caption)
                            .monospacedDigit()
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .mhdGlassPanel(tint: .orange.opacity(0.05))
    }
}

struct GymPlanEditor: View {
    @State private var plan: GymPlan
    @State private var exerciseEditor: ExerciseEditorValue?

    let dataset: GymDatasetService
    let onSave: (GymPlan) -> Void

    @Environment(\.dismiss) private var dismiss

    init(plan: GymPlan, dataset: GymDatasetService, onSave: @escaping (GymPlan) -> Void) {
        _plan = State(initialValue: plan)
        self.dataset = dataset
        self.onSave = onSave
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Scheda") {
                    TextField("Nome", text: $plan.name)
                }

                ForEach(plan.days.indices, id: \.self) { dayIndex in
                    daySection(at: dayIndex)
                }
                .onMove(perform: moveDays)

                Button("Aggiungi giorno", systemImage: "plus.circle") {
                    plan.days.append(
                        GymPlanDay(
                            name: "Giorno \(plan.days.count + 1)",
                            order: plan.days.count
                        )
                    )
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Modifica scheda")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva") {
                        plan.updatedAt = .now
                        onSave(plan)
                        dismiss()
                    }
                    .disabled(plan.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .sheet(item: $exerciseEditor) { value in
            GymExercisePlanner(value: value, dataset: dataset) {
                updateExercise($0)
            }
        }
    }

    @ViewBuilder
    private func daySection(at dayIndex: Int) -> some View {
        Section {
            TextField("Nome giorno", text: $plan.days[dayIndex].name)

            ForEach(plan.days[dayIndex].exercises.indices, id: \.self) { exerciseIndex in
                Button {
                    exerciseEditor = ExerciseEditorValue(
                        dayID: plan.days[dayIndex].id,
                        exercise: plan.days[dayIndex].exercises[exerciseIndex]
                    )
                } label: {
                    HStack {
                        Text(exerciseName(plan.days[dayIndex].exercises[exerciseIndex]))
                        Spacer()
                        Text(plan.days[dayIndex].exercises[exerciseIndex].summary)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)
            }
            .onDelete {
                plan.days[dayIndex].exercises.remove(atOffsets: $0)
            }

            Button("Aggiungi esercizio", systemImage: "plus") {
                guard let firstExercise = dataset.all.first else { return }
                exerciseEditor = ExerciseEditorValue(
                    dayID: plan.days[dayIndex].id,
                    exercise: GymPlanExercise(exerciseId: firstExercise.id)
                )
            }
            .disabled(dataset.all.isEmpty)
        } header: {
            Text(plan.days[dayIndex].name)
        }
    }

    private func exerciseName(_ exercise: GymPlanExercise) -> String {
        dataset.exercise(id: exercise.exerciseId)?.name ?? exercise.exerciseId
    }

    private func moveDays(from source: IndexSet, to destination: Int) {
        plan.days.move(fromOffsets: source, toOffset: destination)
        for index in plan.days.indices {
            plan.days[index].order = index
        }
    }

    private func updateExercise(_ value: ExerciseEditorValue) {
        guard let dayIndex = plan.days.firstIndex(where: { $0.id == value.dayID }) else {
            return
        }

        if let exerciseIndex = plan.days[dayIndex].exercises.firstIndex(where: { $0.id == value.exercise.id }) {
            plan.days[dayIndex].exercises[exerciseIndex] = value.exercise
        } else {
            plan.days[dayIndex].exercises.append(value.exercise)
        }
    }
}

struct ExerciseEditorValue: Identifiable {
    let dayID: String
    var exercise: GymPlanExercise

    var id: String {
        exercise.id
    }
}

struct GymExercisePlanner: View {
    let value: ExerciseEditorValue
    let dataset: GymDatasetService
    let onSave: (ExerciseEditorValue) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var exercise: GymPlanExercise

    init(
        value: ExerciseEditorValue,
        dataset: GymDatasetService,
        onSave: @escaping (ExerciseEditorValue) -> Void
    ) {
        self.value = value
        self.dataset = dataset
        self.onSave = onSave
        _exercise = State(initialValue: value.exercise)
    }

    private var results: [GymExercise] {
        Array(dataset.search(query).prefix(20))
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Esercizio") {
                    TextField("Cerca per nome, muscolo o attrezzo", text: $query)

                    ForEach(results) { item in
                        Button {
                            exercise.exerciseId = item.id
                        } label: {
                            HStack {
                                Image(systemName: "figure.strengthtraining.traditional")
                                    .foregroundStyle(.orange)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.name)
                                    Text(item.muscleGroup.isEmpty ? item.bodyPart : item.muscleGroup)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if exercise.exerciseId == item.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(.orange)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }

                Section("Programmazione") {
                    Stepper("Serie: \(exercise.sets)", value: $exercise.sets, in: 1...20)
                    Stepper("Ripetizioni: \(exercise.repetitions)", value: $exercise.repetitions, in: 1...100)
                    HStack {
                        Text("Carico")
                        Spacer()
                        TextField("0", value: $exercise.load, format: .number)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 80)
                        Text(exercise.unit)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Esercizio")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annulla") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva") {
                        onSave(ExerciseEditorValue(dayID: value.dayID, exercise: exercise))
                        dismiss()
                    }
                }
            }
        }
    }
}

extension GymPlanExercise {
    var summary: String {
        let base = "\(sets) × \(repetitions)"
        guard load > 0 else { return base }
        return "\(base) · \(load.formatted(.number)) \(unit)"
    }
}
