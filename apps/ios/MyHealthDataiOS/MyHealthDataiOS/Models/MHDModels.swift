import Foundation

private func localizedLabel(_ key: String, fallback: String) -> String {
    let translated = NSLocalizedString(key, comment: "")
    return translated == key ? fallback : translated
}

enum BodyRegionId: String, CaseIterable, Codable, Identifiable {
    case head
    case neck
    case chest
    case abdomen
    case upperBack = "upper_back"
    case lowerBack = "lower_back"
    case rightShoulder = "right_shoulder"
    case leftShoulder = "left_shoulder"
    case rightArm = "right_arm"
    case leftArm = "left_arm"
    case rightElbow = "right_elbow"
    case leftElbow = "left_elbow"
    case rightHand = "right_hand"
    case leftHand = "left_hand"
    case rightHip = "right_hip"
    case leftHip = "left_hip"
    case rightLeg = "right_leg"
    case leftLeg = "left_leg"
    case rightKnee = "right_knee"
    case leftKnee = "left_knee"
    case rightFoot = "right_foot"
    case leftFoot = "left_foot"

    var id: String { rawValue }

    var label: String {
        return switch self {
        case .head: localizedLabel("body.head", fallback: "Head")
        case .neck: localizedLabel("body.neck", fallback: "Neck")
        case .chest: localizedLabel("body.chest", fallback: "Chest")
        case .abdomen: localizedLabel("body.abdomen", fallback: "Abdomen")
        case .upperBack: localizedLabel("body.upperBack", fallback: "Upper back")
        case .lowerBack: localizedLabel("body.lowerBack", fallback: "Lower back")
        case .rightShoulder: localizedLabel("body.rightShoulder", fallback: "Right shoulder")
        case .leftShoulder: localizedLabel("body.leftShoulder", fallback: "Left shoulder")
        case .rightArm: localizedLabel("body.rightArm", fallback: "Right arm")
        case .leftArm: localizedLabel("body.leftArm", fallback: "Left arm")
        case .rightElbow: localizedLabel("body.rightElbow", fallback: "Right elbow")
        case .leftElbow: localizedLabel("body.leftElbow", fallback: "Left elbow")
        case .rightHand: localizedLabel("body.rightHand", fallback: "Right hand")
        case .leftHand: localizedLabel("body.leftHand", fallback: "Left hand")
        case .rightHip: localizedLabel("body.rightHip", fallback: "Right hip")
        case .leftHip: localizedLabel("body.leftHip", fallback: "Left hip")
        case .rightLeg: localizedLabel("body.rightLeg", fallback: "Right leg")
        case .leftLeg: localizedLabel("body.leftLeg", fallback: "Left leg")
        case .rightKnee: localizedLabel("body.rightKnee", fallback: "Right knee")
        case .leftKnee: localizedLabel("body.leftKnee", fallback: "Left knee")
        case .rightFoot: localizedLabel("body.rightFoot", fallback: "Right foot")
        case .leftFoot: localizedLabel("body.leftFoot", fallback: "Left foot")
        }
    }
}

enum EventType: String, CaseIterable, Codable, Identifiable {
    case pain
    case discomfort
    case burning
    case swelling
    case stiffness
    case tingling
    case wound
    case generalSymptom = "general_symptom"
    case measurement
    case note
    case medication
    case document
    case other
    case sexualActivity = "sexual_activity"
    case masturbation
    case allergy
    case visionPrescription = "vision_prescription"
    case digestiveHealth = "digestive_health"
    case dentalCare = "dental_care"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .pain: localizedLabel("event.pain", fallback: "Pain")
        case .discomfort: localizedLabel("event.discomfort", fallback: "Discomfort")
        case .burning: localizedLabel("event.burning", fallback: "Burning")
        case .swelling: localizedLabel("event.swelling", fallback: "Swelling")
        case .stiffness: localizedLabel("event.stiffness", fallback: "Stiffness")
        case .tingling: localizedLabel("event.tingling", fallback: "Tingling")
        case .wound: localizedLabel("event.wound", fallback: "Wound")
        case .generalSymptom: localizedLabel("event.generalSymptom", fallback: "General symptom")
        case .measurement: localizedLabel("event.measurement", fallback: "Measurement")
        case .note: localizedLabel("event.note", fallback: "Note")
        case .medication: localizedLabel("event.medication", fallback: "Medication")
        case .document: localizedLabel("event.document", fallback: "Document")
        case .other: localizedLabel("event.other", fallback: "Other")
        case .sexualActivity: "Rapporto sessuale"
        case .masturbation: "Masturbazione"
        case .allergy: "Allergia"
        case .visionPrescription: "Prescrizione visiva"
        case .digestiveHealth: "Salute intestinale"
        case .dentalCare: "Salute dentale"
        }
    }
}

enum MeasurementType: String, CaseIterable, Codable, Identifiable {
    case weight
    case height
    case waistCircumference = "waist_circumference"
    case chestCircumference = "chest_circumference"
    case hipCircumference = "hip_circumference"
    case neckCircumference = "neck_circumference"
    case shoulderCircumference = "shoulder_circumference"
    case armCircumference = "arm_circumference"
    case forearmCircumference = "forearm_circumference"
    case upperAbdomenCircumference = "upper_abdomen_circumference"
    case lowerAbdomenCircumference = "lower_abdomen_circumference"
    case thighCircumference = "thigh_circumference"
    case calfCircumference = "calf_circumference"
    case leftArmCircumference = "left_arm_circumference"
    case rightArmCircumference = "right_arm_circumference"
    case leftForearmCircumference = "left_forearm_circumference"
    case rightForearmCircumference = "right_forearm_circumference"
    case leftThighCircumference = "left_thigh_circumference"
    case rightThighCircumference = "right_thigh_circumference"
    case leftCalfCircumference = "left_calf_circumference"
    case rightCalfCircumference = "right_calf_circumference"
    case systolicPressure = "systolic_pressure"
    case diastolicPressure = "diastolic_pressure"
    case heartRate = "heart_rate"
    case bloodGlucose = "blood_glucose"
    case bodyTemperature = "body_temperature"
    case stepCount = "step_count"
    case activeEnergyBurned = "active_energy_burned"
    case basalEnergyBurned = "basal_energy_burned"
    case distanceWalkingRunning = "distance_walking_running"
    case flightsClimbed = "flights_climbed"
    case oxygenSaturation = "oxygen_saturation"
    case respiratoryRate = "respiratory_rate"
    case restingHeartRate = "resting_heart_rate"
    case heartRateVariability = "heart_rate_variability"
    case vo2Max = "vo2_max"
    case bodyMassIndex = "body_mass_index"
    case bodyFatPercentage = "body_fat_percentage"
    case leanBodyMass = "lean_body_mass"
    case exerciseMinutes = "exercise_minutes"
    case sleepHours = "sleep_hours"
    case mindfulMinutes = "mindful_minutes"
    case walkingHeartRateAverage = "walking_heart_rate_average"
    case walkingSpeed = "walking_speed"
    case walkingStepLength = "walking_step_length"
    case walkingAsymmetry = "walking_asymmetry"
    case walkingDoubleSupport = "walking_double_support"
    case sixMinuteWalkDistance = "six_minute_walk_distance"
    case stairAscentSpeed = "stair_ascent_speed"
    case stairDescentSpeed = "stair_descent_speed"
    case distanceCycling = "distance_cycling"
    case distanceSwimming = "distance_swimming"
    case swimmingStrokeCount = "swimming_stroke_count"
    case wheelchairPushCount = "wheelchair_push_count"
    case distanceWheelchair = "distance_wheelchair"
    case dietaryWater = "dietary_water"
    case dietaryEnergy = "dietary_energy"
    case dietaryCaffeine = "dietary_caffeine"
    case standMinutes = "stand_minutes"
    case daylightMinutes = "daylight_minutes"
    case physicalEffort = "physical_effort"
    case environmentalAudioExposure = "environmental_audio_exposure"
    case headphoneAudioExposure = "headphone_audio_exposure"
    case workoutMinutes = "workout_minutes"
    case alcoholUnits = "alcohol_units"
    case treadmillCorrectedDistance = "treadmill_corrected_distance"
    case treadmillCorrectedEnergy = "treadmill_corrected_energy"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .weight: localizedLabel("measurement.weight", fallback: "Weight")
        case .height: localizedLabel("measurement.height", fallback: "Height")
        case .waistCircumference: localizedLabel("measurement.waistCircumference", fallback: "Waist circumference")
        case .chestCircumference: localizedLabel("measurement.chestCircumference", fallback: "Chest circumference")
        case .hipCircumference: localizedLabel("measurement.hipCircumference", fallback: "Hip circumference")
        case .neckCircumference: localizedLabel("measurement.neckCircumference", fallback: "Neck circumference")
        case .shoulderCircumference: localizedLabel("measurement.shoulderCircumference", fallback: "Shoulder circumference")
        case .armCircumference: localizedLabel("measurement.armCircumference", fallback: "Arm circumference")
        case .forearmCircumference: localizedLabel("measurement.forearmCircumference", fallback: "Forearm circumference")
        case .upperAbdomenCircumference: localizedLabel("measurement.upperAbdomenCircumference", fallback: "Upper abdomen")
        case .lowerAbdomenCircumference: localizedLabel("measurement.lowerAbdomenCircumference", fallback: "Lower abdomen")
        case .thighCircumference: localizedLabel("measurement.thighCircumference", fallback: "Thigh circumference")
        case .calfCircumference: localizedLabel("measurement.calfCircumference", fallback: "Calf circumference")
        case .leftArmCircumference: "Braccio sinistro"
        case .rightArmCircumference: "Braccio destro"
        case .leftForearmCircumference: "Avambraccio sinistro"
        case .rightForearmCircumference: "Avambraccio destro"
        case .leftThighCircumference: "Coscia sinistra"
        case .rightThighCircumference: "Coscia destra"
        case .leftCalfCircumference: "Polpaccio sinistro"
        case .rightCalfCircumference: "Polpaccio destro"
        case .systolicPressure: localizedLabel("measurement.systolicPressure", fallback: "Systolic pressure")
        case .diastolicPressure: localizedLabel("measurement.diastolicPressure", fallback: "Diastolic pressure")
        case .heartRate: localizedLabel("measurement.heartRate", fallback: "Heart rate")
        case .bloodGlucose: localizedLabel("measurement.bloodGlucose", fallback: "Blood glucose")
        case .bodyTemperature: localizedLabel("measurement.bodyTemperature", fallback: "Body temperature")
        case .stepCount: localizedLabel("measurement.stepCount", fallback: "Steps")
        case .activeEnergyBurned: localizedLabel("measurement.activeEnergyBurned", fallback: "Active energy")
        case .basalEnergyBurned: localizedLabel("measurement.basalEnergyBurned", fallback: "Basal energy")
        case .distanceWalkingRunning: localizedLabel("measurement.distanceWalkingRunning", fallback: "Walking + running distance")
        case .flightsClimbed: localizedLabel("measurement.flightsClimbed", fallback: "Flights climbed")
        case .oxygenSaturation: localizedLabel("measurement.oxygenSaturation", fallback: "Oxygen saturation")
        case .respiratoryRate: localizedLabel("measurement.respiratoryRate", fallback: "Respiratory rate")
        case .restingHeartRate: localizedLabel("measurement.restingHeartRate", fallback: "Resting heart rate")
        case .heartRateVariability: localizedLabel("measurement.heartRateVariability", fallback: "Heart rate variability")
        case .vo2Max: localizedLabel("measurement.vo2Max", fallback: "VO2 max")
        case .bodyMassIndex: localizedLabel("measurement.bodyMassIndex", fallback: "Body mass index")
        case .bodyFatPercentage: localizedLabel("measurement.bodyFatPercentage", fallback: "Body fat percentage")
        case .leanBodyMass: localizedLabel("measurement.leanBodyMass", fallback: "Lean body mass")
        case .exerciseMinutes: localizedLabel("measurement.exerciseMinutes", fallback: "Exercise minutes")
        case .sleepHours: localizedLabel("measurement.sleepHours", fallback: "Sleep")
        case .mindfulMinutes: localizedLabel("measurement.mindfulMinutes", fallback: "Mindful minutes")
        case .walkingHeartRateAverage: "FC durante camminata"
        case .walkingSpeed: "Velocità di camminata"
        case .walkingStepLength: "Lunghezza del passo"
        case .walkingAsymmetry: "Asimmetria della camminata"
        case .walkingDoubleSupport: "Doppio appoggio"
        case .sixMinuteWalkDistance: "Cammino in 6 minuti"
        case .stairAscentSpeed: "Velocità salita scale"
        case .stairDescentSpeed: "Velocità discesa scale"
        case .distanceCycling: "Distanza in bicicletta"
        case .distanceSwimming: "Distanza a nuoto"
        case .swimmingStrokeCount: "Bracciate"
        case .wheelchairPushCount: "Spinte in carrozzina"
        case .distanceWheelchair: "Distanza in carrozzina"
        case .dietaryWater: localizedLabel("measurement.dietaryWater", fallback: "Water")
        case .dietaryEnergy: localizedLabel("measurement.dietaryEnergy", fallback: "Dietary energy")
        case .dietaryCaffeine: localizedLabel("measurement.dietaryCaffeine", fallback: "Caffeine")
        case .standMinutes: "Minuti in piedi"
        case .daylightMinutes: "Tempo alla luce del giorno"
        case .physicalEffort: "Sforzo fisico"
        case .environmentalAudioExposure: "Esposizione al rumore ambientale"
        case .headphoneAudioExposure: "Esposizione audio in cuffia"
        case .workoutMinutes: "Minuti di allenamento"
        case .alcoholUnits: "Unità alcoliche"
        case .treadmillCorrectedDistance: "Distanza tapis roulant corretta"
        case .treadmillCorrectedEnergy: "Energia tapis roulant stimata"
        }
    }

    var defaultUnit: String {
        switch self {
        case .weight, .leanBodyMass: "kg"
        case .height: "cm"
        case .waistCircumference, .chestCircumference, .hipCircumference,
             .neckCircumference, .shoulderCircumference, .armCircumference,
             .forearmCircumference, .upperAbdomenCircumference,
             .lowerAbdomenCircumference, .thighCircumference, .calfCircumference,
             .leftArmCircumference, .rightArmCircumference,
             .leftForearmCircumference, .rightForearmCircumference,
             .leftThighCircumference, .rightThighCircumference,
             .leftCalfCircumference, .rightCalfCircumference: "cm"
        case .systolicPressure, .diastolicPressure: "mmHg"
        case .heartRate, .restingHeartRate: "bpm"
        case .bloodGlucose: "mg/dL"
        case .bodyTemperature: "C"
        case .stepCount: "count"
        case .activeEnergyBurned, .basalEnergyBurned: "kcal"
        case .distanceWalkingRunning: "km"
        case .flightsClimbed: "count"
        case .oxygenSaturation, .bodyFatPercentage: "%"
        case .respiratoryRate: "breaths/min"
        case .heartRateVariability: "ms"
        case .vo2Max: "mL/kg/min"
        case .bodyMassIndex: "kg/m2"
        case .exerciseMinutes, .mindfulMinutes: "min"
        case .sleepHours: "h"
        case .walkingHeartRateAverage: "bpm"
        case .walkingSpeed, .stairAscentSpeed, .stairDescentSpeed: "m/s"
        case .walkingStepLength: "cm"
        case .walkingAsymmetry, .walkingDoubleSupport: "%"
        case .sixMinuteWalkDistance: "m"
        case .distanceCycling, .distanceSwimming, .distanceWheelchair: "km"
        case .swimmingStrokeCount, .wheelchairPushCount: "count"
        case .dietaryWater: "mL"
        case .dietaryEnergy: "kcal"
        case .dietaryCaffeine: "mg"
        case .standMinutes, .daylightMinutes, .workoutMinutes: "min"
        case .alcoholUnits: "UA"
        case .treadmillCorrectedDistance: "km"
        case .treadmillCorrectedEnergy: "kcal"
        case .physicalEffort: "kcal/kg/hr"
        case .environmentalAudioExposure, .headphoneAudioExposure: "dBASPL"
        }
    }
}

enum DocumentType: String, CaseIterable, Codable, Identifiable {
    case medicalReport = "medical_report"
    case bloodTest = "blood_test"
    case xray
    case mri
    case ultrasound
    case specialistVisit = "specialist_visit"
    case prescription
    case photo
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .medicalReport: localizedLabel("document.medicalReport", fallback: "Medical report")
        case .bloodTest: localizedLabel("document.bloodTest", fallback: "Blood test")
        case .xray: localizedLabel("document.xray", fallback: "X-ray")
        case .mri: localizedLabel("document.mri", fallback: "MRI")
        case .ultrasound: localizedLabel("document.ultrasound", fallback: "Ultrasound")
        case .specialistVisit: localizedLabel("document.specialistVisit", fallback: "Specialist visit")
        case .prescription: localizedLabel("document.prescription", fallback: "Prescription")
        case .photo: localizedLabel("document.photo", fallback: "Photo")
        case .other: localizedLabel("document.other", fallback: "Other")
        }
    }
}

/// Optional clinical context for a file. The document remains visible in the
/// global File tab and can additionally be surfaced by its related module.
enum DocumentModuleLink: String, CaseIterable, Codable, Identifiable {
    case body, cycle, sexualHealth, allergies, vision, gutHealth, dental
    case sleep, heart, movement, gym, bodyMeasurements, nutrition
    // Retained for decoding legacy documents, but intentionally omitted from
    // allCases so retired hydration never appears in the module picker.
    case hydration
    case medications
    // Legacy decoding only. This retired link is not offered in any picker.
    case legacyConditionTimeline = "conditionTimeline"

    static var allCases: [DocumentModuleLink] {
        [
            .body, .cycle, .sexualHealth, .allergies, .vision, .gutHealth, .dental,
            .sleep, .heart, .movement, .gym, .bodyMeasurements, .nutrition,
            .medications,
        ]
    }

    var id: String { rawValue }

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
        case .movement: "Movimento"
        case .gym: "Palestra"
        case .bodyMeasurements: "Misure corporee"
        case .nutrition: "Diario alimentare"
        case .hydration: "Acqua e alcol"
        case .medications: "Farmaci"
        case .legacyConditionTimeline: "Documento"
        }
    }
}

enum BiologicalSex: String, Codable, CaseIterable, Identifiable {
    case female
    case male
    case intersex
    case unspecified

    var id: String { rawValue }

    var label: String {
        switch self {
        case .female: localizedLabel("sex.female", fallback: "Female")
        case .male: localizedLabel("sex.male", fallback: "Male")
        case .intersex: localizedLabel("sex.intersex", fallback: "Intersex")
        case .unspecified: localizedLabel("sex.unspecified", fallback: "Unspecified")
        }
    }
}

enum RecordSource: String, Codable {
    case manual
    case appleHealth = "apple_health"
    case mhdImport = "mhd_import"
}

struct BodyPoint: Codable, Equatable, Identifiable {
    var id: String = "body_point_\(UUID().uuidString)"
    var x: Double
    var y: Double
    var z: Double
    var approximateRegionId: BodyRegionId?
    var modelVersion: String = "final-base-mesh-v1"

    var approximateRegionLabel: String {
        approximateRegionId?.label ?? localizedLabel("body.precisePoint", fallback: "Precise point")
    }
}
