import SwiftUI

struct MeasurementsView: View {
    @Environment(HealthDataStore.self) private var store
    @State private var isAdding = false

    var body: some View {
        List {
            Section {
                Button {
                    isAdding = true
                } label: {
                    Label("Aggiungi misura", systemImage: "plus")
                }
            }

            Section("Misure") {
                if store.measurements.isEmpty {
                    ContentUnavailableView("Nessuna misura", systemImage: "chart.xyaxis.line")
                } else {
                    ForEach(store.measurements) { measurement in
                        MeasurementRow(measurement: measurement)
                    }
                }
            }
        }
        .navigationTitle("Misure")
        .sheet(isPresented: $isAdding) {
            NavigationStack {
                AddMeasurementView()
            }
        }
    }
}

struct AddMeasurementView: View {
    @Environment(HealthDataStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var searchText = ""
    @State private var type: MeasurementType = .weight
    @State private var value = ""
    @State private var unit = MeasurementType.weight.defaultUnit
    @State private var measuredAt = Date()
    @State private var includeTime = false
    @State private var note = ""

    private var filteredTypes: [MeasurementType] {
        let supported = MeasurementType.allCases.filter { $0 != .sixMinuteWalkDistance }
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return supported }
        return supported.filter { type in
            type.searchText.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        Form {
            Section("Tipo") {
                TextField("Cerca: peso, glucosio, pressione...", text: $searchText)
                    .textInputAutocapitalization(.never)

                Picker("Misura", selection: $type) {
                    ForEach(MeasurementCategory.allCases) { category in
                        let categoryTypes = filteredTypes.filter { $0.category == category }
                        if !categoryTypes.isEmpty {
                            Section(category.title) {
                                ForEach(categoryTypes) { type in
                                    Text(type.label).tag(type)
                                }
                            }
                        }
                    }
                }
                .onChange(of: type) { _, newValue in
                    unit = newValue.defaultUnit
                }
            }

            Section("Valore") {
                TextField("Valore", text: $value)
                    .keyboardType(.decimalPad)

                Picker("Unita'", selection: $unit) {
                    ForEach(type.allowedUnits, id: \.self) { unit in
                        Text(unit).tag(unit)
                    }
                }
            }

            Section("Quando") {
                Toggle("Includi ora", isOn: $includeTime)
                DatePicker(
                    includeTime ? "Data e ora" : "Data",
                    selection: $measuredAt,
                    displayedComponents: includeTime ? [.date, .hourAndMinute] : [.date]
                )
            }

            Section("Note") {
                TextField("Nota", text: $note, axis: .vertical)
                    .lineLimit(2...5)
            }
        }
        .navigationTitle("Aggiungi misura")
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Annulla") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Salva") {
                    save()
                }
                .disabled(Double(value.replacingOccurrences(of: ",", with: ".")) == nil)
            }
        }
    }

    private func save() {
        guard let numericValue = Double(value.replacingOccurrences(of: ",", with: ".")) else {
            return
        }

        let storedDate = includeTime ? measuredAt : Calendar.current.startOfDay(for: measuredAt)
        let measurement = Measurement(
            type: type,
            value: numericValue,
            unit: unit,
            measuredAt: storedDate,
            note: note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : note
        )
        store.addMeasurement(measurement)
        dismiss()
    }
}

private enum MeasurementCategory: String, CaseIterable, Identifiable {
    case body
    case vitals
    case labs
    case activity
    case mobility
    case nutrition
    case environment
    case sleepMind

    var id: String { rawValue }

    var title: String {
        switch self {
        case .body: "Corpo"
        case .vitals: "Parametri vitali"
        case .labs: "Laboratorio"
        case .activity: "Attivita'"
        case .mobility: "Mobilita'"
        case .nutrition: "Alimentazione"
        case .environment: "Esposizione"
        case .sleepMind: "Sonno e benessere"
        }
    }
}

private extension MeasurementType {
    var category: MeasurementCategory {
        switch self {
        case .weight, .height, .waistCircumference, .chestCircumference, .hipCircumference,
             .neckCircumference, .shoulderCircumference, .armCircumference,
             .forearmCircumference, .upperAbdomenCircumference,
             .lowerAbdomenCircumference, .thighCircumference, .calfCircumference,
             .leftArmCircumference, .rightArmCircumference,
             .leftForearmCircumference, .rightForearmCircumference,
             .leftThighCircumference, .rightThighCircumference,
             .leftCalfCircumference, .rightCalfCircumference,
             .bodyMassIndex, .bodyFatPercentage, .leanBodyMass:
            .body
        case .systolicPressure, .diastolicPressure, .heartRate, .bodyTemperature, .oxygenSaturation, .respiratoryRate, .restingHeartRate, .heartRateVariability, .vo2Max, .walkingHeartRateAverage:
            .vitals
        case .bloodGlucose:
            .labs
        case .stepCount, .activeEnergyBurned, .basalEnergyBurned, .distanceWalkingRunning, .flightsClimbed, .exerciseMinutes, .distanceCycling, .distanceSwimming, .swimmingStrokeCount, .wheelchairPushCount, .distanceWheelchair, .standMinutes, .physicalEffort, .workoutMinutes, .treadmillCorrectedDistance, .treadmillCorrectedEnergy:
            .activity
        case .walkingSpeed, .walkingStepLength, .walkingAsymmetry, .walkingDoubleSupport, .sixMinuteWalkDistance, .stairAscentSpeed, .stairDescentSpeed:
            .mobility
        case .dietaryWater, .dietaryEnergy, .dietaryCaffeine, .alcoholUnits:
            .nutrition
        case .environmentalAudioExposure, .headphoneAudioExposure:
            .environment
        case .sleepHours, .mindfulMinutes, .daylightMinutes:
            .sleepMind
        }
    }

    var allowedUnits: [String] {
        switch self {
        case .weight, .leanBodyMass: ["kg", "lb"]
        case .height, .waistCircumference, .chestCircumference, .hipCircumference,
             .neckCircumference, .shoulderCircumference, .armCircumference,
             .forearmCircumference, .upperAbdomenCircumference,
             .lowerAbdomenCircumference, .thighCircumference, .calfCircumference,
             .leftArmCircumference, .rightArmCircumference,
             .leftForearmCircumference, .rightForearmCircumference,
             .leftThighCircumference, .rightThighCircumference,
             .leftCalfCircumference, .rightCalfCircumference: ["cm", "m", "in"]
        case .systolicPressure, .diastolicPressure: ["mmHg"]
        case .heartRate, .restingHeartRate, .walkingHeartRateAverage: ["bpm"]
        case .bloodGlucose: ["mg/dL", "mmol/L"]
        case .bodyTemperature: ["C", "F"]
        case .stepCount, .flightsClimbed, .swimmingStrokeCount, .wheelchairPushCount: ["count"]
        case .activeEnergyBurned, .basalEnergyBurned, .dietaryEnergy: ["kcal", "kJ"]
        case .distanceWalkingRunning, .distanceCycling, .distanceSwimming, .distanceWheelchair: ["km", "m", "mi"]
        case .oxygenSaturation, .bodyFatPercentage, .walkingAsymmetry, .walkingDoubleSupport: ["%"]
        case .respiratoryRate: ["breaths/min"]
        case .heartRateVariability: ["ms"]
        case .vo2Max: ["mL/kg/min"]
        case .bodyMassIndex: ["kg/m2"]
        case .exerciseMinutes, .mindfulMinutes, .standMinutes, .daylightMinutes, .workoutMinutes: ["min"]
        case .sleepHours: ["h", "min"]
        case .walkingSpeed, .stairAscentSpeed, .stairDescentSpeed: ["m/s", "km/h"]
        case .walkingStepLength: ["cm", "m", "in"]
        case .sixMinuteWalkDistance: ["m", "km", "mi"]
        case .dietaryWater: ["mL", "L", "fl oz"]
        case .dietaryCaffeine: ["mg", "g"]
        case .alcoholUnits: ["UA"]
        case .treadmillCorrectedDistance: ["km", "m", "mi"]
        case .treadmillCorrectedEnergy: ["kcal", "kJ"]
        case .physicalEffort: ["kcal/kg/hr"]
        case .environmentalAudioExposure, .headphoneAudioExposure: ["dBASPL"]
        }
    }

    var searchText: String {
        let synonyms: String
        switch self {
        case .bloodGlucose:
            synonyms = "glucosio glicemia glucose sugar zucchero"
        case .weight:
            synonyms = "peso massa bilancia kg"
        case .height:
            synonyms = "altezza statura"
        case .waistCircumference:
            synonyms = "vita girovita addome circonferenza"
        case .chestCircumference:
            synonyms = "petto torace circonferenza"
        case .hipCircumference:
            synonyms = "fianchi anche circonferenza"
        case .systolicPressure, .diastolicPressure:
            synonyms = "pressione arteriosa blood pressure"
        default:
            synonyms = ""
        }
        return "\(label) \(rawValue) \(synonyms)"
    }
}
