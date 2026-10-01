import Foundation

struct GymExercise: Codable, Equatable, Identifiable {
    var id: String
    var name: String
    var category: String
    var bodyPart: String
    var equipment: String
    var muscleGroup: String
    var secondaryMuscles: [String]
    var target: String
    var instructions: [String: String]
    var instructionSteps: [String: [String]]
    var image: String?
    var gifURL: String?
    var attribution: String?

    enum CodingKeys: String, CodingKey {
        case id, name, category, bodyPart = "body_part", equipment
        case muscleGroup = "muscle_group", secondaryMuscles = "secondary_muscles", target
        case instructions, instructionSteps = "instruction_steps", image, gifURL = "gif_url", attribution
    }
}

struct GymSet: Codable, Equatable, Identifiable {
    var id: String = "gym_set_\(UUID().uuidString)"
    var exerciseId: String
    var setNumber: Int
    var repetitions: Int
    var load: Double
    var unit: String = "kg"
    var completedAt: Date = .now

    var volume: Double { Double(repetitions) * load }
}

struct GymWorkout: Codable, Equatable, Identifiable {
    var id: String = "gym_workout_\(UUID().uuidString)"
    var name: String
    var startedAt: Date
    var endedAt: Date?
    var sets: [GymSet] = []
    var notes: String?
    var planId: String?
    var planDayId: String?
    var createdAt: Date = .now
    var updatedAt: Date = .now

    init(id: String = "gym_workout_\(UUID().uuidString)", name: String, startedAt: Date, endedAt: Date? = nil, sets: [GymSet] = [], notes: String? = nil, planId: String? = nil, planDayId: String? = nil, createdAt: Date = .now, updatedAt: Date = .now) {
        self.id = id; self.name = name; self.startedAt = startedAt; self.endedAt = endedAt; self.sets = sets; self.notes = notes; self.planId = planId; self.planDayId = planDayId; self.createdAt = createdAt; self.updatedAt = updatedAt
    }

    private enum CodingKeys: String, CodingKey { case id, name, startedAt, endedAt, sets, notes, planId, planDayId, createdAt, updatedAt }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? "gym_workout_\(UUID().uuidString)"
        name = try c.decode(String.self, forKey: .name); startedAt = try c.decode(Date.self, forKey: .startedAt)
        endedAt = try c.decodeIfPresent(Date.self, forKey: .endedAt); sets = try c.decodeIfPresent([GymSet].self, forKey: .sets) ?? []
        notes = try c.decodeIfPresent(String.self, forKey: .notes); planId = try c.decodeIfPresent(String.self, forKey: .planId); planDayId = try c.decodeIfPresent(String.self, forKey: .planDayId)
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? startedAt; updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt) ?? createdAt
    }
}

struct GymPlanExercise: Codable, Equatable, Identifiable {
    var id: String = "gym_plan_exercise_\(UUID().uuidString)"
    var exerciseId: String
    var sets: Int = 3
    var repetitions: Int = 10
    var load: Double = 0
    var unit: String = "kg"
    var notes: String?

    init(id: String = "gym_plan_exercise_\(UUID().uuidString)", exerciseId: String, sets: Int = 3, repetitions: Int = 10, load: Double = 0, unit: String = "kg", notes: String? = nil) {
        self.id = id; self.exerciseId = exerciseId; self.sets = sets; self.repetitions = repetitions; self.load = load; self.unit = unit; self.notes = notes
    }

    private enum CodingKeys: String, CodingKey { case id, exerciseId, sets, repetitions, load, unit, notes }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? "gym_plan_exercise_\(UUID().uuidString)"
        exerciseId = try c.decode(String.self, forKey: .exerciseId)
        sets = max(1, try c.decodeIfPresent(Int.self, forKey: .sets) ?? 3)
        repetitions = max(1, try c.decodeIfPresent(Int.self, forKey: .repetitions) ?? 10)
        load = max(0, try c.decodeIfPresent(Double.self, forKey: .load) ?? 0)
        unit = try c.decodeIfPresent(String.self, forKey: .unit) ?? "kg"
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
    }
}

struct GymPlanDay: Codable, Equatable, Identifiable {
    var id: String = "gym_plan_day_\(UUID().uuidString)"
    var name: String
    var order: Int = 0
    var exercises: [GymPlanExercise] = []

    init(id: String = "gym_plan_day_\(UUID().uuidString)", name: String, order: Int = 0, exercises: [GymPlanExercise] = []) {
        self.id = id; self.name = name; self.order = order; self.exercises = exercises
    }

    private enum CodingKeys: String, CodingKey { case id, name, order, exercises }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? "gym_plan_day_\(UUID().uuidString)"
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "Giorno 1"
        order = try c.decodeIfPresent(Int.self, forKey: .order) ?? 0
        exercises = try c.decodeIfPresent([GymPlanExercise].self, forKey: .exercises) ?? []
    }
}

struct GymPlan: Codable, Equatable, Identifiable {
    var id: String = "gym_plan_\(UUID().uuidString)"
    var name: String
    var days: [GymPlanDay] = []
    var createdAt: Date = .now
    var updatedAt: Date = .now

    init(id: String = "gym_plan_\(UUID().uuidString)", name: String, days: [GymPlanDay] = [], createdAt: Date = .now, updatedAt: Date = .now) {
        self.id = id; self.name = name; self.days = days; self.createdAt = createdAt; self.updatedAt = updatedAt
    }

    private enum CodingKeys: String, CodingKey { case id, name, days, createdAt, updatedAt }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? "gym_plan_\(UUID().uuidString)"
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "Scheda base"
        days = (try c.decodeIfPresent([GymPlanDay].self, forKey: .days) ?? []).enumerated().map { index, day in
            var value = day; value.order = index; return value
        }
        createdAt = try c.decodeIfPresent(Date.self, forKey: .createdAt) ?? .now
        updatedAt = try c.decodeIfPresent(Date.self, forKey: .updatedAt) ?? createdAt
    }
}
