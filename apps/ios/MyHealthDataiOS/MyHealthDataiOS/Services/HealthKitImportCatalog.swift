import HealthKit

struct HealthKitQuantityDescriptor {
    var identifier: HKQuantityTypeIdentifier
    var measurementType: MeasurementType
    var unit: HKUnit
    var unitLabel: String
    var multiplier: Double = 1
}

struct HealthKitCategoryDescriptor {
    var identifier: HKCategoryTypeIdentifier
    var measurementType: MeasurementType
    var unitLabel: String
    var acceptedValues: Set<Int>?
}

enum HealthKitImportCatalog {
    static let dailyTotalTypes: Set<MeasurementType> = [
        .activeEnergyBurned, .basalEnergyBurned, .distanceWalkingRunning,
        .distanceCycling, .distanceSwimming, .flightsClimbed,
        .exerciseMinutes, .standMinutes, .daylightMinutes, .dietaryWater,
        .dietaryEnergy, .dietaryCaffeine, .swimmingStrokeCount,
        .wheelchairPushCount, .distanceWheelchair
    ]

    static let dailyAverageTypes: Set<MeasurementType> = [
        .heartRate, .heartRateVariability, .respiratoryRate,
        .walkingHeartRateAverage, .walkingSpeed, .walkingStepLength,
        .walkingAsymmetry, .walkingDoubleSupport, .physicalEffort,
        .environmentalAudioExposure, .headphoneAudioExposure
    ]

    static let quantityDescriptors: [HealthKitQuantityDescriptor] = [
        HealthKitQuantityDescriptor(identifier: .bodyMass, measurementType: .weight, unit: .gramUnit(with: .kilo), unitLabel: "kg"),
        HealthKitQuantityDescriptor(identifier: .height, measurementType: .height, unit: .meterUnit(with: .centi), unitLabel: "cm"),
        HealthKitQuantityDescriptor(identifier: .bodyMassIndex, measurementType: .bodyMassIndex, unit: .count(), unitLabel: "kg/m2"),
        HealthKitQuantityDescriptor(identifier: .bodyFatPercentage, measurementType: .bodyFatPercentage, unit: .percent(), unitLabel: "%", multiplier: 100),
        HealthKitQuantityDescriptor(identifier: .leanBodyMass, measurementType: .leanBodyMass, unit: .gramUnit(with: .kilo), unitLabel: "kg"),
        HealthKitQuantityDescriptor(identifier: .waistCircumference, measurementType: .waistCircumference, unit: .meterUnit(with: .centi), unitLabel: "cm"),
        HealthKitQuantityDescriptor(identifier: .heartRate, measurementType: .heartRate, unit: HKUnit.count().unitDivided(by: .minute()), unitLabel: "bpm"),
        HealthKitQuantityDescriptor(identifier: .restingHeartRate, measurementType: .restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute()), unitLabel: "bpm"),
        HealthKitQuantityDescriptor(identifier: .heartRateVariabilitySDNN, measurementType: .heartRateVariability, unit: .secondUnit(with: .milli), unitLabel: "ms"),
        HealthKitQuantityDescriptor(identifier: .oxygenSaturation, measurementType: .oxygenSaturation, unit: .percent(), unitLabel: "%", multiplier: 100),
        HealthKitQuantityDescriptor(identifier: .respiratoryRate, measurementType: .respiratoryRate, unit: HKUnit.count().unitDivided(by: .minute()), unitLabel: "breaths/min"),
        HealthKitQuantityDescriptor(identifier: .vo2Max, measurementType: .vo2Max, unit: HKUnit(from: "mL/kg*min"), unitLabel: "mL/kg/min"),
        HealthKitQuantityDescriptor(identifier: .bloodGlucose, measurementType: .bloodGlucose, unit: HKUnit(from: "mg/dL"), unitLabel: "mg/dL"),
        HealthKitQuantityDescriptor(identifier: .bodyTemperature, measurementType: .bodyTemperature, unit: .degreeCelsius(), unitLabel: "C"),
        HealthKitQuantityDescriptor(identifier: .bloodPressureSystolic, measurementType: .systolicPressure, unit: .millimeterOfMercury(), unitLabel: "mmHg"),
        HealthKitQuantityDescriptor(identifier: .bloodPressureDiastolic, measurementType: .diastolicPressure, unit: .millimeterOfMercury(), unitLabel: "mmHg"),
        HealthKitQuantityDescriptor(identifier: .stepCount, measurementType: .stepCount, unit: .count(), unitLabel: "count"),
        HealthKitQuantityDescriptor(identifier: .activeEnergyBurned, measurementType: .activeEnergyBurned, unit: .kilocalorie(), unitLabel: "kcal"),
        HealthKitQuantityDescriptor(identifier: .basalEnergyBurned, measurementType: .basalEnergyBurned, unit: .kilocalorie(), unitLabel: "kcal"),
        HealthKitQuantityDescriptor(identifier: .distanceWalkingRunning, measurementType: .distanceWalkingRunning, unit: .meterUnit(with: .kilo), unitLabel: "km"),
        HealthKitQuantityDescriptor(identifier: .flightsClimbed, measurementType: .flightsClimbed, unit: .count(), unitLabel: "count"),
        HealthKitQuantityDescriptor(identifier: .appleExerciseTime, measurementType: .exerciseMinutes, unit: .minute(), unitLabel: "min"),
        HealthKitQuantityDescriptor(identifier: .walkingHeartRateAverage, measurementType: .walkingHeartRateAverage, unit: HKUnit.count().unitDivided(by: .minute()), unitLabel: "bpm"),
        HealthKitQuantityDescriptor(identifier: .walkingSpeed, measurementType: .walkingSpeed, unit: HKUnit(from: "m/s"), unitLabel: "m/s"),
        HealthKitQuantityDescriptor(identifier: .walkingStepLength, measurementType: .walkingStepLength, unit: .meterUnit(with: .centi), unitLabel: "cm"),
        HealthKitQuantityDescriptor(identifier: .walkingAsymmetryPercentage, measurementType: .walkingAsymmetry, unit: .percent(), unitLabel: "%", multiplier: 100),
        HealthKitQuantityDescriptor(identifier: .walkingDoubleSupportPercentage, measurementType: .walkingDoubleSupport, unit: .percent(), unitLabel: "%", multiplier: 100),
        HealthKitQuantityDescriptor(identifier: .sixMinuteWalkTestDistance, measurementType: .sixMinuteWalkDistance, unit: .meter(), unitLabel: "m"),
        HealthKitQuantityDescriptor(identifier: .stairAscentSpeed, measurementType: .stairAscentSpeed, unit: HKUnit(from: "m/s"), unitLabel: "m/s"),
        HealthKitQuantityDescriptor(identifier: .stairDescentSpeed, measurementType: .stairDescentSpeed, unit: HKUnit(from: "m/s"), unitLabel: "m/s"),
        HealthKitQuantityDescriptor(identifier: .distanceCycling, measurementType: .distanceCycling, unit: .meterUnit(with: .kilo), unitLabel: "km"),
        HealthKitQuantityDescriptor(identifier: .distanceSwimming, measurementType: .distanceSwimming, unit: .meterUnit(with: .kilo), unitLabel: "km"),
        HealthKitQuantityDescriptor(identifier: .swimmingStrokeCount, measurementType: .swimmingStrokeCount, unit: .count(), unitLabel: "count"),
        HealthKitQuantityDescriptor(identifier: .pushCount, measurementType: .wheelchairPushCount, unit: .count(), unitLabel: "count"),
        HealthKitQuantityDescriptor(identifier: .distanceWheelchair, measurementType: .distanceWheelchair, unit: .meterUnit(with: .kilo), unitLabel: "km"),
        HealthKitQuantityDescriptor(identifier: .dietaryWater, measurementType: .dietaryWater, unit: .literUnit(with: .milli), unitLabel: "mL"),
        HealthKitQuantityDescriptor(identifier: .dietaryEnergyConsumed, measurementType: .dietaryEnergy, unit: .kilocalorie(), unitLabel: "kcal"),
        HealthKitQuantityDescriptor(identifier: .dietaryCaffeine, measurementType: .dietaryCaffeine, unit: .gramUnit(with: .milli), unitLabel: "mg"),
        HealthKitQuantityDescriptor(identifier: .appleStandTime, measurementType: .standMinutes, unit: .minute(), unitLabel: "min"),
        HealthKitQuantityDescriptor(identifier: .timeInDaylight, measurementType: .daylightMinutes, unit: .minute(), unitLabel: "min"),
        HealthKitQuantityDescriptor(identifier: .physicalEffort, measurementType: .physicalEffort, unit: HKUnit(from: "kcal/kg*hr"), unitLabel: "kcal/kg/hr"),
        HealthKitQuantityDescriptor(identifier: .environmentalAudioExposure, measurementType: .environmentalAudioExposure, unit: .decibelAWeightedSoundPressureLevel(), unitLabel: "dBASPL"),
        HealthKitQuantityDescriptor(identifier: .headphoneAudioExposure, measurementType: .headphoneAudioExposure, unit: .decibelAWeightedSoundPressureLevel(), unitLabel: "dBASPL")
    ]

    static let categoryDescriptors: [HealthKitCategoryDescriptor] = [
        HealthKitCategoryDescriptor(
            identifier: .sleepAnalysis,
            measurementType: .sleepHours,
            unitLabel: "h",
            acceptedValues: [
                HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                HKCategoryValueSleepAnalysis.asleepREM.rawValue,
                HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue
            ]
        ),
        HealthKitCategoryDescriptor(
            identifier: .mindfulSession,
            measurementType: .mindfulMinutes,
            unitLabel: "min",
            acceptedValues: nil
        )
    ]
}
