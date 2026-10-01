import SwiftUI

enum HealthMetricModule {
    case heart
    case activity
    case nutrition
    case bodyMeasurements

    var title: String {
        switch self {
        case .heart: "Cuore e respiro"
        case .activity: "Movimento"
        case .nutrition: "Alimentazione"
        case .bodyMeasurements: "Misure corporee"
        }
    }

    var storageKey: String {
        switch self {
        case .heart: "heart"
        case .activity: "activity"
        case .nutrition: "nutrition"
        case .bodyMeasurements: "bodyMeasurements"
        }
    }

    var subtitle: String {
        switch self {
        case .heart: "Parametri vitali, ritmo e recupero"
        case .activity: "Movimento, allenamenti e mobilità"
        case .nutrition: "Energia alimentare e andamento"
        case .bodyMeasurements: "Peso, circonferenze e composizione"
        }
    }

    var symbol: String {
        switch self {
        case .heart: "heart.fill"
        case .activity: "figure.run"
        case .nutrition: "fork.knife"
        case .bodyMeasurements: "figure.arms.open"
        }
    }

    var tint: Color {
        switch self {
        case .heart: MHDPalette.coral
        case .activity: MHDPalette.mint
        case .nutrition: .green
        case .bodyMeasurements: .blue
        }
    }

    var types: [MeasurementType] {
        switch self {
        case .heart:
            [.heartRate, .restingHeartRate, .heartRateVariability, .oxygenSaturation, .respiratoryRate, .vo2Max, .systolicPressure, .diastolicPressure, .bodyTemperature]
        case .activity:
            [.stepCount, .workoutMinutes, .exerciseMinutes, .standMinutes, .activeEnergyBurned, .distanceWalkingRunning, .treadmillCorrectedDistance, .treadmillCorrectedEnergy, .distanceCycling, .distanceSwimming, .walkingSpeed, .walkingStepLength, .walkingAsymmetry, .walkingDoubleSupport, .stairAscentSpeed, .stairDescentSpeed, .daylightMinutes]
        case .nutrition:
            [.dietaryEnergy]
        case .bodyMeasurements:
            [.weight, .neckCircumference, .shoulderCircumference, .chestCircumference,
             .armCircumference, .forearmCircumference, .waistCircumference,
             .upperAbdomenCircumference, .lowerAbdomenCircumference,
             .hipCircumference, .thighCircumference, .calfCircumference,
             .bodyMassIndex, .bodyFatPercentage, .leanBodyMass]
        }
    }
}

struct MeasurementDetailRequest: Identifiable, Hashable {
    let type: MeasurementType
    let title: String
    let symbol: String
    let tint: Color

    var id: String { "\(type.rawValue)|\(symbol)" }

    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
