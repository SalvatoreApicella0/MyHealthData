import Foundation

struct MHDExportRecordsPayload: Codable {
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

    init(snapshot: MHDDataSnapshot) {
        profile = snapshot.profile
        events = snapshot.events
        measurements = snapshot.measurements
        documents = snapshot.documents
        cycleEntries = snapshot.cycleEntries
        cycleSettings = snapshot.cycleSettings
        sleepSessions = snapshot.sleepSessions
        sleepSettings = snapshot.sleepSettings
        appointments = snapshot.appointments
        medications = snapshot.medications
        medicationDoseEvents = snapshot.medicationDoseEvents
        conditionEpisodes = snapshot.conditionEpisodes
        conditionCheckIns = snapshot.conditionCheckIns
        labResults = snapshot.labResults
        foodLogEntries = snapshot.foodLogEntries
        foodRecipes = snapshot.foodRecipes
        gymPlans = snapshot.gymPlans
        gymWorkouts = snapshot.gymWorkouts
    }
}

struct MHDPreGymPlansExportRecordsPayload: Codable {
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
    var gymWorkouts: [GymWorkout]

    init(snapshot: MHDDataSnapshot) {
        profile = snapshot.profile
        events = snapshot.events
        measurements = snapshot.measurements
        documents = snapshot.documents
        cycleEntries = snapshot.cycleEntries
        cycleSettings = snapshot.cycleSettings
        sleepSessions = snapshot.sleepSessions
        sleepSettings = snapshot.sleepSettings
        appointments = snapshot.appointments
        medications = snapshot.medications
        medicationDoseEvents = snapshot.medicationDoseEvents
        conditionEpisodes = snapshot.conditionEpisodes
        conditionCheckIns = snapshot.conditionCheckIns
        labResults = snapshot.labResults
        foodLogEntries = snapshot.foodLogEntries
        foodRecipes = snapshot.foodRecipes
        gymWorkouts = snapshot.gymWorkouts
    }
}

struct MHDPreviousExportRecordsPayload: Codable {
    var profile: LocalProfile?
    var events: [HealthEvent]
    var measurements: [Measurement]
    var documents: [HealthDocument]
    var cycleEntries: [CycleEntry]
    var cycleSettings: CycleSettings
    var sleepSessions: [SleepSession]
    var appointments: [AppointmentRecord]
    var medications: [MedicationStatement]
    var conditionEpisodes: [ConditionEpisode]
    var labResults: [LabResult]

    init(snapshot: MHDDataSnapshot) {
        profile = snapshot.profile
        events = snapshot.events
        measurements = snapshot.measurements
        documents = snapshot.documents
        cycleEntries = snapshot.cycleEntries
        cycleSettings = snapshot.cycleSettings
        sleepSessions = snapshot.sleepSessions
        appointments = snapshot.appointments
        medications = snapshot.medications
        conditionEpisodes = snapshot.conditionEpisodes
        labResults = snapshot.labResults
    }
}

struct MHDLegacyExportRecordsPayload: Codable {
    var profile: LocalProfile?
    var events: [HealthEvent]
    var measurements: [Measurement]
    var documents: [HealthDocument]
    var cycleEntries: [CycleEntry]
    var sleepSessions: [SleepSession]
    var appointments: [AppointmentRecord]
    var medications: [MedicationStatement]
    var conditionEpisodes: [ConditionEpisode]
    var labResults: [LabResult]

    init(snapshot: MHDDataSnapshot) {
        profile = snapshot.profile
        events = snapshot.events
        measurements = snapshot.measurements
        documents = snapshot.documents
        cycleEntries = snapshot.cycleEntries
        sleepSessions = snapshot.sleepSessions
        appointments = snapshot.appointments
        medications = snapshot.medications
        conditionEpisodes = snapshot.conditionEpisodes
        labResults = snapshot.labResults
    }
}
