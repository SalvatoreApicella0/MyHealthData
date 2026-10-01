import SwiftUI


enum HealthModuleCardStyle: String, CaseIterable, Identifiable {
    case photography
    case glass

    var id: String { rawValue }

    var title: String { self == .photography ? "Fotografie" : "Vetro" }
    var symbol: String { self == .photography ? "photo.fill" : "circle.hexagongrid.fill" }
}

enum HealthFeature: String, CaseIterable, Identifiable {
    case body
    case cycle
    case sexualHealth
    case allergies
    case vision
    case gutHealth
    case dental
    case sleep
    case heart
    case activity
    case gym
    case bodyMeasurements
    case nutrition
    case medications
    case bloodwork
    case trends
    case backupSync
    case shareForCare

    var id: String { rawValue }

    var measurementTypes: [MeasurementType] {
        switch self {
        case .heart: HealthMetricModule.heart.types
        case .activity: HealthMetricModule.activity.types
        case .sleep: [.sleepHours]
        case .nutrition: [.dietaryEnergy, .dietaryWater, .dietaryCaffeine, .alcoholUnits]
        case .bodyMeasurements: [
            .weight,
            .neckCircumference,
            .shoulderCircumference,
            .chestCircumference,
            .armCircumference,
            .forearmCircumference,
            .waistCircumference,
            .upperAbdomenCircumference,
            .lowerAbdomenCircumference,
            .hipCircumference,
            .thighCircumference,
            .calfCircumference,
            .bodyMassIndex,
            .bodyFatPercentage,
            .leanBodyMass
        ]
        default: []
        }
    }

    static var healthModules: [HealthFeature] {
        allCases.filter { ![.backupSync, .shareForCare, .trends, .gym].contains($0) }
    }

    var title: String {
        switch self {
        case .body: "Dolori corporei"
        case .cycle: "Ciclo mestruale"
        case .sexualHealth: "Salute sessuale"
        case .allergies: "Allergie"
        case .vision: "Vista"
        case .gutHealth: "Salute intestinale"
        case .dental: "Denti"
        case .sleep: "Sonno"
        case .heart: "Cuore e respiro"
        case .activity: "Movimento"
        case .gym: "Palestra"
        case .bodyMeasurements: "Misure corporee"
        case .nutrition: "Diario alimentare"
        case .medications: "Farmaci"
        case .bloodwork: "Analisi"
        case .trends: "Trend"
        case .backupSync: "Backup"
        case .shareForCare: "Condividi"
        }
    }

    var subtitle: String {
        switch self {
        case .body: "Sintomi su punti precisi"
        case .cycle: "Flusso, sintomi e diario"
        case .sexualHealth: "Attività, protezione e controlli"
        case .allergies: "Allergeni, reazioni e piano"
        case .vision: "Occhiali e prescrizioni"
        case .gutHealth: "Sintomi e regolarità"
        case .dental: "Igiene e trattamenti"
        case .sleep: "Durata e qualità"
        case .heart: "Parametri vitali e recupero"
        case .activity: "Movimento e mobilità"
        case .gym: "Allenamenti, serie e volume muscolare"
        case .bodyMeasurements: "Peso e circonferenze"
        case .nutrition: "Pasti ed energia"
        case .medications: "Terapie e programmi"
        case .bloodwork: "Valori e confronti"
        case .trends: "Andamenti nel tempo"
        case .backupSync: "Esporta e ripristina"
        case .shareForCare: "Scegli cosa inviare"
        }
    }

    var systemImage: String {
        switch self {
        case .body: "figure.stand"
        case .cycle: "calendar.circle.fill"
        case .sexualHealth: "heart.circle.fill"
        case .allergies: "allergens.fill"
        case .vision: "eyeglasses"
        case .gutHealth: "fork.knife.circle.fill"
        case .dental: "mouth.fill"
        case .sleep: "bed.double.fill"
        case .heart: "heart.fill"
        case .activity: "figure.run"
        case .gym: "figure.strengthtraining.traditional"
        case .bodyMeasurements: "figure.arms.open"
        case .nutrition: "fork.knife"
        case .medications: "pills.fill"
        case .bloodwork: "testtube.2"
        case .trends: "chart.xyaxis.line"
        case .backupSync: "externaldrive.fill.badge.checkmark"
        case .shareForCare: "square.and.arrow.up.fill"
        }
    }

    var tint: Color {
        switch self {
        case .body: .mhdPrimary
        case .cycle: .pink
        case .sexualHealth: .pink
        case .allergies: .orange
        case .vision: .blue
        case .gutHealth: .green
        case .dental: .cyan
        case .sleep: .indigo
        case .heart: MHDPalette.coral
        case .activity: MHDPalette.mint
        case .gym: .orange
        case .bodyMeasurements: .blue
        case .nutrition: .green
        case .medications: .orange
        case .bloodwork: .red
        case .trends: .green
        case .backupSync: .teal
        case .shareForCare: .cyan
        }
    }

    var cardImageName: String {
        switch self {
        case .body: "ModuleBodyPain"
        case .cycle: "ModuleCycle"
        case .sexualHealth: "ModuleSexualHealth"
        case .allergies: "ModuleAllergies"
        case .vision: "ModuleVision"
        case .gutHealth: "ModuleGutHealth"
        case .dental: "ModuleDental"
        case .sleep: "ModuleSleep"
        case .heart: "ModuleHeart"
        case .activity: "ModuleMovement"
        case .gym: "ModuleGym"
        case .bodyMeasurements: "ModuleBodyMeasurements"
        case .nutrition: "ModuleNutrition"
        case .medications: "ModuleMedications"
        case .bloodwork: "ModuleBloodwork"
        default: "ModuleDocuments"
        }
    }

    @MainActor
    func metric(in store: HealthDataStore) -> String {
        let calendar = Calendar.current
        let coveredDays: Set<Date>

        switch self {
        case .body:
            coveredDays = Set(store.snapshot.events.lazy
                .filter { $0.bodyPoint != nil || $0.bodyRegionId != nil }
                .map { calendar.startOfDay(for: $0.occurredAt) })
        case .cycle:
            coveredDays = Set(store.snapshot.cycleEntries.lazy.map { calendar.startOfDay(for: $0.date) })
        case .sexualHealth:
            coveredDays = Set(store.snapshot.events.lazy.filter { $0.type == .sexualActivity || $0.type == .masturbation }.map { calendar.startOfDay(for: $0.occurredAt) })
        case .allergies:
            coveredDays = eventDays(.allergy, store: store, calendar: calendar)
        case .vision:
            coveredDays = eventDays(.visionPrescription, store: store, calendar: calendar)
        case .gutHealth:
            coveredDays = eventDays(.digestiveHealth, store: store, calendar: calendar)
        case .dental:
            coveredDays = eventDays(.dentalCare, store: store, calendar: calendar)
        case .sleep:
            coveredDays = Set(store.snapshot.sleepSessions.lazy.map { calendar.startOfDay(for: $0.startAt) })
                .union(measurementDays(in: store, types: [.sleepHours]))
        case .heart:
            coveredDays = measurementDays(in: store, types: HealthMetricModule.heart.types)
        case .activity:
            coveredDays = measurementDays(in: store, types: HealthMetricModule.activity.types)
        case .gym:
            coveredDays = Set(store.gymWorkouts.lazy.map { calendar.startOfDay(for: $0.startedAt) })
        case .bodyMeasurements:
            coveredDays = measurementDays(in: store, types: HealthMetricModule.bodyMeasurements.types)
        case .nutrition:
            coveredDays = measurementDays(in: store, types: HealthMetricModule.nutrition.types)
                .union(store.snapshot.foodLogEntries.lazy.map { calendar.startOfDay(for: $0.loggedAt) })
        case .medications:
            coveredDays = Set(store.snapshot.medicationDoseEvents.lazy.map { calendar.startOfDay(for: $0.recordedAt) })
        case .bloodwork:
            coveredDays = Set(store.snapshot.labResults.lazy.map { calendar.startOfDay(for: $0.collectedAt) })
        case .trends:
            coveredDays = Set(store.snapshot.measurements.lazy.map { calendar.startOfDay(for: $0.measuredAt) })
        case .backupSync:
            return "\(store.snapshot.totalRecordCount) record nel vault"
        case .shareForCare:
            return "Pacchetto personalizzato"
        }

        guard !coveredDays.isEmpty else { return "Nessun giorno disponibile" }
        return coveredDays.count == 1 ? "Dati di 1 giorno" : "Dati di \(coveredDays.count) giorni"
    }
}

@MainActor
private func measurementDays(in store: HealthDataStore, types: [MeasurementType]) -> Set<Date> {
    store.measurementDays(for: types)
}

@MainActor
private func eventDays(_ type: EventType, store: HealthDataStore, calendar: Calendar) -> Set<Date> {
    Set(store.snapshot.events.lazy.filter { $0.type == type }.map { calendar.startOfDay(for: $0.occurredAt) })
}
