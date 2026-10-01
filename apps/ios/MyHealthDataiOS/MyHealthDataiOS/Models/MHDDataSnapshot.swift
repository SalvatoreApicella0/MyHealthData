import Foundation

struct MHDDataSnapshot: Codable, Equatable {
    var profile: LocalProfile?
    var events: [HealthEvent]
    var measurements: [Measurement]
    var documents: [HealthDocument]
    var cycleEntries: [CycleEntry]
    var cycleSettings: CycleSettings
    var sleepSessions: [SleepSession]
    var sleepSettings: SleepSettings
    var appointments: [AppointmentRecord]
    var medications: [MedicationStatement]
    var medicationDoseEvents: [MedicationDoseEvent]
    var conditionEpisodes: [ConditionEpisode]
    var conditionCheckIns: [ConditionCheckIn]
    var labResults: [LabResult]
    var foodLogEntries: [FoodLogEntry]
    var foodRecipes: [FoodRecipe]
    var gymPlans: [GymPlan]
    var gymWorkouts: [GymWorkout]

    var totalRecordCount: Int {
        (profile == nil ? 0 : 1) +
            events.count +
            measurements.count +
            documents.count +
            cycleEntries.count +
            sleepSessions.count +
            appointments.count +
            medications.count +
            medicationDoseEvents.count +
            conditionEpisodes.count +
            conditionCheckIns.count +
            labResults.count +
            foodLogEntries.count +
            gymPlans.count +
            gymWorkouts.count
    }

    static let empty = MHDDataSnapshot(
        profile: nil,
        events: [],
        measurements: [],
        documents: [],
        cycleEntries: [],
        cycleSettings: CycleSettings(),
        sleepSessions: [],
        sleepSettings: SleepSettings(),
        appointments: [],
        medications: [],
        medicationDoseEvents: [],
        conditionEpisodes: [],
        conditionCheckIns: [],
        labResults: [],
        foodLogEntries: [],
        foodRecipes: [],
        gymPlans: [],
        gymWorkouts: []
    )

    init(
        profile: LocalProfile?,
        events: [HealthEvent],
        measurements: [Measurement],
        documents: [HealthDocument],
        cycleEntries: [CycleEntry] = [],
        cycleSettings: CycleSettings = CycleSettings(),
        sleepSessions: [SleepSession] = [],
        sleepSettings: SleepSettings = SleepSettings(),
        appointments: [AppointmentRecord] = [],
        medications: [MedicationStatement] = [],
        medicationDoseEvents: [MedicationDoseEvent] = [],
        conditionEpisodes: [ConditionEpisode] = [],
        conditionCheckIns: [ConditionCheckIn] = [],
        labResults: [LabResult] = [],
        foodLogEntries: [FoodLogEntry] = [],
        foodRecipes: [FoodRecipe] = [],
        gymPlans: [GymPlan] = [],
        gymWorkouts: [GymWorkout] = []
    ) {
        self.profile = profile
        self.events = events
        self.measurements = measurements
        self.documents = documents
        self.cycleEntries = cycleEntries
        self.cycleSettings = cycleSettings
        self.sleepSessions = sleepSessions
        self.sleepSettings = sleepSettings
        self.appointments = appointments
        self.medications = medications
        self.medicationDoseEvents = medicationDoseEvents
        self.conditionEpisodes = conditionEpisodes
        self.conditionCheckIns = conditionCheckIns
        self.labResults = labResults
        self.foodLogEntries = foodLogEntries
        self.foodRecipes = foodRecipes
        self.gymPlans = gymPlans
        self.gymWorkouts = gymWorkouts
    }

    private enum CodingKeys: String, CodingKey {
        case profile
        case events
        case measurements
        case documents
        case cycleEntries
        case cycleSettings
        case sleepSessions
        case sleepSettings
        case appointments
        case medications
        case medicationDoseEvents
        case conditionEpisodes
        case conditionCheckIns
        case labResults
        case foodLogEntries
        case foodRecipes
        case gymPlans
        case gymWorkouts
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        profile = try container.decodeIfPresent(LocalProfile.self, forKey: .profile)
        events = try container.decodeIfPresent([HealthEvent].self, forKey: .events) ?? []
        measurements = try container.decodeIfPresent([Measurement].self, forKey: .measurements) ?? []
        documents = try container.decodeIfPresent([HealthDocument].self, forKey: .documents) ?? []
        cycleEntries = try container.decodeIfPresent([CycleEntry].self, forKey: .cycleEntries) ?? []
        cycleSettings = try container.decodeIfPresent(CycleSettings.self, forKey: .cycleSettings) ?? CycleSettings()
        sleepSessions = try container.decodeIfPresent([SleepSession].self, forKey: .sleepSessions) ?? []
        sleepSettings = try container.decodeIfPresent(SleepSettings.self, forKey: .sleepSettings) ?? SleepSettings()
        appointments = try container.decodeIfPresent([AppointmentRecord].self, forKey: .appointments) ?? []
        medications = try container.decodeIfPresent([MedicationStatement].self, forKey: .medications) ?? []
        medicationDoseEvents = try container.decodeIfPresent([MedicationDoseEvent].self, forKey: .medicationDoseEvents) ?? []
        conditionEpisodes = try container.decodeIfPresent([ConditionEpisode].self, forKey: .conditionEpisodes) ?? []
        conditionCheckIns = try container.decodeIfPresent([ConditionCheckIn].self, forKey: .conditionCheckIns) ?? []
        labResults = try container.decodeIfPresent([LabResult].self, forKey: .labResults) ?? []
        foodLogEntries = try container.decodeIfPresent([FoodLogEntry].self, forKey: .foodLogEntries) ?? []
        foodRecipes = try container.decodeIfPresent([FoodRecipe].self, forKey: .foodRecipes) ?? []
        gymPlans = try container.decodeIfPresent([GymPlan].self, forKey: .gymPlans) ?? []
        gymWorkouts = try container.decodeIfPresent([GymWorkout].self, forKey: .gymWorkouts) ?? []
    }
}

// The snapshot is a value-only Codable graph. Persistence owns an immutable copy
// while encoding it away from the main actor.
extension MHDDataSnapshot: @unchecked Sendable {}
